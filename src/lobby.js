import { DurableObject } from 'cloudflare:workers';

const MIN = 60_000;
const MAX_LISTED = 50;

// Un único Durable Object ("global") con un resumen de cada sala para el menú.
export class Lobby extends DurableObject {
  async upsert(summary) {
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
    return { open: open.sort(byRecent).slice(0, MAX_LISTED), live: live.sort(byRecent).slice(0, MAX_LISTED) };
  }

  // Partida rápida: la sala pública de ese modo a la que le falta menos gente.
  async findOpen(mode) {
    const { open } = await this.list();
    const r = open.filter((x) => x.mode === mode).sort((a, b) => a.free - b.free)[0];
    return r ? r.code : null;
  }
}
