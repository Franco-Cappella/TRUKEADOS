import { DurableObject } from 'cloudflare:workers';
import { newBrain, train, BRAIN_VERSION } from '../public/js/brain.js';
import { MATCH } from '../public/js/config.js';
import { newShowTable, scoreAt, isOver, wantedTables, showSummary } from './show-tables.js';
import { rng } from './util.js';

const MIN = 60_000;
const MAX_LISTED = 50;

const BRAIN_GLOBAL = 'brain:*';
// Memoria de situaciones de los bots (ver BotMemo en public/js/bot.js). Cada situación es una clave
// "memo:<hash>"; se guardan como mucho MEMO_MAX y al arrancar una sala se traen MEMO_LOAD.
const MEMO_MAX = 200_000;
const MEMO_LOAD = 20_000;
const MEMO_COUNT = 'memo#';
const fresh = (b) => (b && b.v === BRAIN_VERSION ? b : null);

// Un único Durable Object ("global") con un resumen de cada sala para el menú
// y lo que los bots aprendieron de cada persona (ver public/js/brain.js).
export class Lobby extends DurableObject {
  // Cerebros de esas personas (los que no se conocen arrancan con lo que se sabe de todos).
  async brains(pids = []) {
    const global = fresh(await this.ctx.storage.get(BRAIN_GLOBAL)) || newBrain();
    const out = { global };
    for (const pid of new Set(pids)) out[pid] = fresh(await this.ctx.storage.get('brain:' + pid)) || newBrain(global);
    return out;
  }

  // Situaciones de los bots que ya maduraron: [[hash, sumas]].
  async memoPut(entries = []) {
    let count = (await this.ctx.storage.get(MEMO_COUNT)) || 0;
    const fresh = entries.filter(([k, v]) => typeof k === 'string' && k.length < 40 && v && typeof v.n === 'number');
    for (let i = 0; i < fresh.length && count < MEMO_MAX; i += 100) {
      const chunk = fresh.slice(i, i + 100);
      const old = await this.ctx.storage.get(chunk.map(([k]) => 'memo:' + k));
      count += chunk.filter(([k]) => !old.has('memo:' + k)).length;
      await this.ctx.storage.put(Object.fromEntries(chunk.map(([k, v]) => ['memo:' + k, v])));
    }
    await this.ctx.storage.put(MEMO_COUNT, count);
    return count;
  }

  async memoGet(limit = MEMO_LOAD) {
    const m = await this.ctx.storage.list({ prefix: 'memo:', limit });
    return [...m].map(([k, v]) => [k.slice(5), v]);
  }

  // Ejemplos de una mano ({ pid, key, x, y }): entrena el cerebro de cada uno y el global.
  async learn(batch = []) {
    const pids = [...new Set(batch.map((e) => e.pid).filter(Boolean))];
    const b = await this.brains(pids);
    train(b.global, batch);
    b.global.hands++;
    const put = { [BRAIN_GLOBAL]: b.global };
    for (const pid of pids) {
      train(b[pid], batch.filter((e) => e.pid === pid));
      b[pid].hands++;
      put['brain:' + pid] = b[pid];
    }
    await this.ctx.storage.put(put);
    return b;
  }

  // Mesas en juego: saca las que terminaron y completa las que falten.
  async showTables(now = Date.now()) {
    const saved = (await this.ctx.storage.get('show')) || [];
    const tables = saved.filter((t) => !isOver(t, now));
    const want = wantedTables(now);
    const taken = new Set(tables.map((t) => t.code));
    while (tables.length < want) {
      const t = newShowTable(rng, now, taken);
      taken.add(t.code);
      tables.push(t);
    }
    if (tables.length !== saved.length || tables.some((t, i) => t !== saved[i])) await this.ctx.storage.put('show', tables);
    return tables;
  }

  // Alguien entra a mirar una mesa: se arma la sala con el tanteador de ahora.
  async ensureShow(code, now = Date.now()) {
    const t = (await this.showTables(now)).find((x) => x.code === code);
    if (!t) return false;
    const room = this.env.TRUCO_ROOM.get(this.env.TRUCO_ROOM.idFromName('truco:' + code));
    await room.showUp({ code, mode: t.mode, target: t.target, seats: t.seats, score: scoreAt(t, now) });
    return true;
  }

  // Lo que pasó de verdad en una mesa que estaban mirando: el tanteador sigue desde ahí.
  async showProgress(summary, now = Date.now()) {
    const tables = (await this.ctx.storage.get('show')) || [];
    const t = tables.find((x) => x.code === summary.code);
    if (!t) return;
    if (summary.status === 'ended') tables.splice(tables.indexOf(t), 1);
    else if (summary.score) Object.assign(t, { score: summary.score, at: now });
    await this.ctx.storage.put('show', tables);
  }

  // Invitaciones a un equipo: duran poco y se guardan por persona.
  async invites(uid, now = Date.now()) {
    const list = (await this.ctx.storage.get('inv:' + uid)) || [];
    return list.filter((i) => now - i.at < MATCH.inviteTtl);
  }

  async invite(uid, inv, now = Date.now()) {
    const list = (await this.invites(uid, now)).filter((i) => i.code !== inv.code);
    await this.ctx.storage.put('inv:' + uid, [...list, { ...inv, at: now }]);
  }

  async inviteDone(uid, code) {
    const list = (await this.ctx.storage.get('inv:' + uid)) || [];
    await this.ctx.storage.put('inv:' + uid, list.filter((i) => i.code !== code));
  }

  async upsert(summary) {
    if (summary.show) return this.showProgress(summary);
    await this.ctx.storage.put('t:' + summary.code, { ...summary, updatedAt: Date.now() });
  }

  async list() {
    const all = await this.ctx.storage.list({ prefix: 't:' });
    const now = Date.now();
    const open = [];
    const live = [];
    const stale = [];
    for (const [key, r] of all) {
      const age = now - r.updatedAt;
      const expired = (r.online === 0 && age > 10 * MIN) || (r.status === 'ended' && age > 5 * MIN) || age > 24 * 60 * MIN;
      if (expired) {
        stale.push(key);
        continue;
      }
      if (!r.isPublic || r.online === 0) continue;
      if (r.status === 'lobby' && r.free > 0) open.push(r);
      else if (r.status === 'playing') live.push(r);
    }
    for (let i = 0; i < stale.length; i += 128) await this.ctx.storage.delete(stale.slice(i, i + 128));
    const byRecent = (a, b) => b.updatedAt - a.updatedAt;
    const shows = (await this.showTables(now)).map((t) => showSummary(t, now));
    return { open: open.sort(byRecent).slice(0, MAX_LISTED), live: [...live.sort(byRecent), ...shows].slice(0, MAX_LISTED) };
  }

  // Partida rápida: la mesa de partida rápida de ese modo y de un ELO parecido a la que le falta menos gente.
  async findOpen(mode, elo) {
    const { open } = await this.list();
    const near = (x) => x.quick && (elo == null || x.elo == null || Math.abs(x.elo - elo) <= MATCH.joinRange);
    const r = open.filter((x) => x.mode === mode && near(x)).sort((a, b) => a.free - b.free)[0];
    return r ? r.code : null;
  }
}
