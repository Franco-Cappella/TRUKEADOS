import { DurableObject } from 'cloudflare:workers';
import { newGame, act, nextHand, rematch, viewFor, waitingFor, team, closeShow } from '../public/js/engine.js';
import { botAction, botSena, botClaims } from '../public/js/bot.js';
import { MODES, TARGETS, SENAS, BOT_NAMES, TIMING, dealMs, MAX_CHAT_HISTORY, MAX_CHAT_TEXT, ROOM_OPTIONS, roomOptions, roomOptionsText, ROOM_REUSE_MS } from '../public/js/config.js';
import { cleanName, cleanPid, rng } from './util.js';

const BOT_SHOW_DELAY = 1200; // el bot que ganó el envido muestra a los 1,2 s
const BOT_CLAIM_DELAY = 6000; // + hasta 4 s al azar: un bot rival reclama si el humano no muestra

// Una sala de truco = un Durable Object. Guarda la sala, valida jugadas y reparte el estado por WebSocket.
// Protocolo de mensajes: ver AGENTS.md.
export class TrucoRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.gaze = {}; // asiento -> a quién mira (asiento, 'table' o null). Vive en memoria.
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get('room')) || null;
      this.chat = (await ctx.storage.get('chat')) || [];
    });
  }

  // ---- RPC desde el Worker ----
  async create({ code, mode, target, options, isPublic, pid, name }) {
    if (this.room && !this.reusable()) return { ok: false };
    // código reciclado: se arranca de cero (sin chat ni miradas de la sala anterior)
    this.chat = [];
    this.gaze = {};
    await this.ctx.storage.put('chat', this.chat);
    await this.ctx.storage.deleteAlarm();
    this.room = {
      code,
      cfg: { mode, target, isPublic: !!isPublic, trucoDesdeSegunda: true, ...roomOptions(options) },
      seats: Array(MODES[mode]).fill(null),
      host: pid,
      status: 'lobby', // lobby | playing | ended
      game: null,
      handEndedAt: 0,
      afkSince: {},
      createdAt: Date.now(),
    };
    this.room.seats[0] = { pid, name: cleanName(name) };
    await this.save();
    await this.updateLobby();
    return { ok: true };
  }

  // Una sala vieja (nadie conectado y sin movimiento hace rato) presta su código a una nueva.
  reusable() {
    const r = this.room;
    return !this.online().size && Date.now() - (r.lastActive || r.createdAt || 0) > ROOM_REUSE_MS;
  }

  async info() {
    if (!this.room) return { exists: false };
    const r = this.room;
    return { exists: true, mode: r.cfg.mode, status: r.status, free: r.seats.filter((s) => !s).length, isPublic: r.cfg.isPublic };
  }

  async fetch() {
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ pid: null });
    return new Response(null, { status: 101, webSocket: client });
  }

  // ---- WebSocket ----
  async webSocketMessage(ws, raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.t === 'ping') return this.send(ws, { t: 'pong', now: Date.now() });
    if (!this.room) return this.send(ws, { t: 'notfound' });

    const r = this.room;
    const pid = msg.t === 'join' ? cleanPid(msg.pid) : ws.deserializeAttachment()?.pid;
    const seat = pid ? this.seatOf(pid) : null;
    const isHost = pid && pid === r.host;
    const lobbyHost = isHost && r.status === 'lobby';

    switch (msg.t) {
      case 'join': {
        if (!pid) return this.send(ws, { t: 'error', msg: 'Identificador inválido' });
        const name = cleanName(msg.name);
        ws.serializeAttachment({ pid, name });
        if (seat != null) {
          r.seats[seat].name = name;
          delete r.afkSince[seat];
        } else if (r.status === 'lobby' && !msg.spectate) {
          const free = this.freeSeat();
          if (free != null) {
            r.seats[free] = { pid, name };
            this.addSystemChat(`${name} se sentó a la mesa`);
          }
        }
        if (!r.host || this.seatOf(r.host) == null) r.host = this.seatOf(pid) != null ? pid : r.host;
        this.send(ws, { t: 'chat-history', messages: this.chat });
        this.send(ws, { t: 'gaze-all', gaze: this.gaze });
        return this.commit();
      }

      case 'sit': {
        if (r.status !== 'lobby' || !pid) return;
        const to = msg.seat;
        if (!Number.isInteger(to) || to < 0 || to >= r.seats.length || r.seats[to]) return;
        const me = seat != null ? r.seats[seat] : { pid, name: ws.deserializeAttachment()?.name || 'Invitado' };
        if (seat != null) r.seats[seat] = null;
        r.seats[to] = me;
        return this.commit();
      }

      case 'move': {
        // el anfitrión arrastra a alguien a otro lugar (si está ocupado, se intercambian)
        if (!lobbyHost) return;
        const { from, to } = msg;
        const ok = (i) => Number.isInteger(i) && i >= 0 && i < r.seats.length;
        if (!ok(from) || !ok(to) || from === to || !r.seats[from]) return;
        [r.seats[from], r.seats[to]] = [r.seats[to], r.seats[from]];
        return this.commit();
      }

      case 'stand': {
        if (r.status !== 'lobby' || seat == null) return;
        r.seats[seat] = null;
        return this.commit();
      }

      case 'addbot': {
        if (!lobbyHost) return;
        const to = Number.isInteger(msg.seat) && !r.seats[msg.seat] ? msg.seat : this.freeSeat();
        if (to == null || to >= r.seats.length) return;
        r.seats[to] = { bot: true, name: this.botName() };
        return this.commit();
      }

      case 'removebot': {
        if (!lobbyHost) return;
        if (r.seats[msg.seat]?.bot) r.seats[msg.seat] = null;
        return this.commit();
      }

      case 'kick': {
        if (!lobbyHost) return;
        const s = r.seats[msg.seat];
        if (s && !s.bot && s.pid !== r.host) r.seats[msg.seat] = null;
        return this.commit();
      }

      case 'config': {
        if (!lobbyHost) return;
        const c = msg.cfg || {};
        if (TARGETS.includes(c.target)) r.cfg.target = c.target;
        for (const k of ['isPublic', 'trucoDesdeSegunda', ...ROOM_OPTIONS.map((o) => o.key)]) if (typeof c[k] === 'boolean') r.cfg[k] = c[k];
        if (MODES[c.mode] && c.mode !== r.cfg.mode) {
          const people = r.seats.filter((s) => s && !s.bot);
          r.cfg.mode = c.mode;
          r.seats = Array(MODES[c.mode]).fill(null);
          people.slice(0, r.seats.length).forEach((p, i) => (r.seats[i] = p));
        }
        return this.commit();
      }

      case 'start': {
        if (!lobbyHost) return;
        // de a uno: así botName() ve los nombres que ya se pusieron y no repite
        if (msg.fillBots) r.seats.forEach((s, i) => s || (r.seats[i] = { bot: true, name: this.botName() }));
        if (r.seats.some((s) => !s)) return this.send(ws, { t: 'error', msg: 'Faltan jugadores (o llená con bots)' });
        r.status = 'playing';
        const { mode, target, trucoDesdeSegunda } = r.cfg;
        r.game = newGame({ mode, target, trucoDesdeSegunda, ...roomOptions(r.cfg), dealer: Math.floor(rng() * r.seats.length) }, rng);
        this.addSystemChat('¡Arranca la partida! Reparte ' + r.seats[r.game.dealer].name);
        this.afterDeal();
        return this.commit();
      }

      case 'act': {
        if (r.status !== 'playing' || seat == null) return;
        if (Date.now() < (r.dealUntil || 0)) return this.send(ws, { t: 'error', msg: 'Esperá que terminen de repartir' });
        const res = act(r.game, seat, msg.a);
        if (res.error) {
          this.send(ws, { t: 'error', msg: res.error });
          return this.sendState(ws); // por si el cliente tenía un estado viejo
        }
        if (msg.a?.t === 'nomostrar') this.onFold();
        this.onGameChange();
        return this.commit();
      }

      case 'look': {
        if (seat == null) return;
        const tgt = msg.target === 'table' ? 'table' : Number.isInteger(msg.target) && msg.target >= 0 && msg.target < r.seats.length ? msg.target : null;
        if (this.gaze[seat] === tgt) return;
        this.gaze[seat] = tgt;
        return this.broadcastRaw({ t: 'gaze', seat, target: tgt }, ws);
      }

      case 'sena': {
        if (seat == null || !SENAS[msg.sena] || r.status !== 'playing') return;
        return this.deliverSena(seat, msg.sena);
      }

      case 'chat': {
        const text = String(msg.text ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, MAX_CHAT_TEXT);
        if (!text || !pid) return;
        const name = seat != null ? r.seats[seat].name : ws.deserializeAttachment()?.name || 'Espectador';
        const entry = { name, seat, text, ts: Date.now() };
        this.pushChat(entry);
        await this.ctx.storage.put('chat', this.chat);
        return this.broadcastRaw({ t: 'chat', msg: entry });
      }

      case 'rematch': {
        if (seat == null || r.status !== 'ended') return;
        rematch(r.game, rng);
        r.status = 'playing';
        this.addSystemChat('¡Revancha!');
        this.afterDeal();
        return this.commit();
      }

      case 'to-lobby': {
        if (!isHost || r.status !== 'ended') return;
        r.status = 'lobby';
        r.game = null;
        return this.commit();
      }
    }
  }

  async webSocketClose(ws, code) {
    try {
      ws.close(code === 1005 ? 1000 : code, 'bye');
    } catch {}
    const r = this.room;
    const pid = ws.deserializeAttachment()?.pid;
    const seat = pid ? this.seatOf(pid) : null;
    if (seat != null && r?.status === 'lobby' && !this.online(ws).has(pid)) {
      // en la sala de espera, si se va libera el asiento
      r.seats[seat] = null;
      if (r.host === pid) r.host = r.seats.find((s) => s && !s.bot)?.pid || null;
      await this.save();
    }
    if (seat != null && r?.status === 'playing') r.afkSince[seat] = Date.now();
    this.broadcastState(ws);
    await this.scheduleAlarm();
    await this.updateLobby(ws);
  }

  async webSocketError(ws) {
    this.broadcastState(ws);
  }

  // Bots, AFK, pausa entre manos y miradas de los bots.
  async alarm() {
    const r = this.room;
    if (!r || r.status !== 'playing') return;
    const g = r.game;
    const now = Date.now();
    let changed = false;

    if (g.h.phase === 'ended' && g.status === 'playing' && now - r.handEndedAt >= TIMING.handPause) {
      nextHand(g, rng);
      this.afterDeal();
      changed = true;
    } else if (g.h.phase === 'show') {
      // el que ganó el envido muestra (si es bot); los bots rivales reclaman si no muestra; al rato vale igual
      const sh = g.h.show;
      const since = r.showSince || now;
      if (this.isAway(sh.seat, now) && now - since > BOT_SHOW_DELAY && !sh.folded) {
        changed = !!act(g, sh.seat, { t: 'mostrar' }).ok;
      } else if (r.botClaimAt && now >= r.botClaimAt) {
        changed = !!act(g, r.botClaimer, { t: 'reclamar' }).ok;
      } else if (now - since >= TIMING.showWindow) {
        changed = closeShow(g);
      }
      if (changed) this.onGameChange();
    } else if (g.h.phase === 'play' && now >= (r.dealUntil || 0)) {
      const actor = this.autoActor();
      const a = actor != null && botAction(g, actor, rng);
      if (a && act(g, actor, a).ok) {
        this.onGameChange();
        changed = true;
      }
    }
    this.botGlances();
    this.botSenas(now);
    if (changed) await this.commit();
    else await this.scheduleAlarm();
  }

  // ---- lógica de sala ----
  afterDeal() {
    const r = this.room;
    r.handEndedAt = 0;
    r.showSince = 0;
    r.botClaimAt = 0;
    r.dealUntil = Date.now() + dealMs(r.game.n);
    r.botSenaDue = {};
    if (r.game.n > 2) {
      r.seats.forEach((s, i) => {
        if (s?.bot) r.botSenaDue[i] = r.dealUntil + 400 + Math.floor(rng() * 2500);
      });
    }
  }

  // Bot, o humano desconectado hace más de TIMING.afk: juega el servidor por él.
  isAway(seat, now = Date.now()) {
    const r = this.room;
    const p = r.seats[seat];
    if (!p || p.bot) return !!p;
    if (this.online().has(p.pid)) return false;
    return now - (r.afkSince[seat] || now) >= TIMING.afk;
  }

  onGameChange() {
    const r = this.room;
    const g = r.game;
    if (g.status === 'ended') {
      r.status = 'ended';
      const t = g.winner;
      const names = r.seats.filter((_, i) => team(i) === t).map((s) => s.name).join(' y ');
      this.addSystemChat(`Ganaron ${names} (${g.score[t]} a ${g.score[1 - t]})`);
    } else if (g.h.phase === 'ended' && !r.handEndedAt) {
      r.handEndedAt = Date.now();
    } else if (g.h.phase === 'show' && !r.showSince) {
      r.showSince = Date.now();
      // si el que tiene que mostrar es humano, algún bot rival puede reclamarle
      const sh = g.h.show;
      const claimer = r.seats.findIndex((s, i) => s?.bot && team(i) !== team(sh.seat));
      r.botClaimAt = 0;
      if (!r.seats[sh.seat]?.bot && claimer >= 0 && botClaims(g, claimer, rng)) {
        r.botClaimer = claimer;
        r.botClaimAt = r.showSince + BOT_CLAIM_DELAY + Math.floor(rng() * 4000);
      }
    }
  }

  // El que ganó el envido se fue al mazo sin mostrar: a los rivales les quedan TIMING.foldWindow ms para
  // reclamar (si hay un bot rival que iba a reclamar, lo hace ahora, un poco después).
  onFold() {
    const r = this.room;
    const now = Date.now();
    r.showSince = now - TIMING.showWindow + TIMING.foldWindow;
    if (r.botClaimAt) r.botClaimAt = now + 1200 + Math.floor(rng() * 2000);
  }

  // Asiento al que le toca y que debe jugar el servidor (bot o humano ausente).
  autoActor() {
    const r = this.room;
    const w = waitingFor(r.game);
    if (!w.seats.length) return null;
    // Si en el equipo que responde hay un humano conectado, esperamos a que decida él.
    const now = Date.now();
    if (w.seats.some((s) => !this.isAway(s, now))) return null;
    return w.seats.find((s) => r.seats[s].bot) ?? w.seats[0];
  }

  // La mayor parte del tiempo los bots miran la mesa; a veces a un compañero o a un rival.
  botGlances() {
    const r = this.room;
    r.seats.forEach((s, i) => {
      if (!s?.bot || rng() >= 0.3) return;
      const others = r.seats.map((_, j) => j).filter((j) => j !== i);
      const partners = others.filter((j) => team(j) === team(i));
      const roll = rng();
      let tgt = 'table';
      if (roll > 0.55 && roll < 0.75 && partners.length) tgt = partners[Math.floor(rng() * partners.length)];
      else if (roll >= 0.75) tgt = others[Math.floor(rng() * others.length)];
      this.gaze[i] = tgt;
      this.broadcastRaw({ t: 'gaze', seat: i, target: tgt });
    });
  }

  botSenas(now) {
    const r = this.room;
    const due = r.botSenaDue || {};
    for (const [k, at] of Object.entries(due)) {
      if (now < at) continue;
      const seat = Number(k);
      delete due[k];
      if (r.game.h.phase !== 'play' || r.game.h.mazo[seat]) continue;
      // el bot mira a un compañero antes de hacer la seña
      const partners = r.seats.map((_, j) => j).filter((j) => j !== seat && team(j) === team(seat));
      const p = partners[Math.floor(rng() * partners.length)];
      this.gaze[seat] = p;
      this.broadcastRaw({ t: 'gaze', seat, target: p });
      this.deliverSena(seat, botSena(r.game, seat));
    }
  }

  // La seña solo la ven los que en ese momento están mirando al que la hace.
  deliverSena(seat, sena) {
    const watchers = new Set(Object.entries(this.gaze).filter(([s, t]) => t === seat && Number(s) !== seat).map(([s]) => Number(s)));
    for (const s of this.sockets()) {
      const pid = s.deserializeAttachment()?.pid;
      const viewer = pid ? this.seatOf(pid) : null;
      if (viewer === seat) this.send(s, { t: 'sena', seat, sena, self: true, seenBy: [...watchers] });
      else if (viewer != null && watchers.has(viewer)) this.send(s, { t: 'sena', seat, sena });
    }
  }

  seatOf(pid) {
    const i = this.room.seats.findIndex((s) => s && !s.bot && s.pid === pid);
    return i < 0 ? null : i;
  }

  // Balancea equipos: primero un lugar libre del equipo con menos gente.
  freeSeat() {
    const seats = this.room.seats;
    const count = [0, 1].map((t) => seats.filter((s, i) => s && team(i) === t).length);
    const prefer = count[0] <= count[1] ? 0 : 1;
    const free = seats.map((s, i) => (s ? null : i)).filter((i) => i != null);
    return free.find((i) => team(i) === prefer) ?? free[0] ?? null;
  }

  botName() {
    const used = new Set(this.room.seats.filter(Boolean).map((s) => s.name));
    const names = BOT_NAMES.filter((n) => !used.has(n));
    return names[Math.floor(rng() * names.length)] || 'Bot';
  }

  async commit() {
    await this.save();
    this.broadcastState();
    await this.scheduleAlarm();
    await this.updateLobby();
  }

  async save() {
    this.room.lastActive = Date.now();
    await this.ctx.storage.put('room', this.room);
  }

  async scheduleAlarm() {
    const r = this.room;
    if (!r || r.status !== 'playing' || !this.online().size) return this.ctx.storage.deleteAlarm(); // nadie mirando: se duerme
    const now = Date.now();
    const g = r.game;
    let at = now + TIMING.botHeartbeat;
    if (g.h.phase === 'ended') at = Math.min(at, r.handEndedAt + TIMING.handPause);
    else if (g.h.phase === 'show') {
      const since = r.showSince || now;
      at = Math.min(at, since + TIMING.showWindow, since + BOT_SHOW_DELAY + 100);
      if (r.botClaimAt) at = Math.min(at, r.botClaimAt);
    } else if (now < (r.dealUntil || 0)) at = Math.min(at, r.dealUntil + 50);
    else if (this.autoActor() != null) at = Math.min(at, now + TIMING.botThinkMin + Math.floor(rng() * TIMING.botThinkRand));
    else for (const s of waitingFor(g).seats) if (r.afkSince[s]) at = Math.min(at, Math.max(now + 200, r.afkSince[s] + TIMING.afk));
    for (const t of Object.values(r.botSenaDue || {})) at = Math.min(at, Math.max(now + 100, t));
    await this.ctx.storage.setAlarm(Math.max(now + 100, at));
  }

  addSystemChat(text) {
    const entry = { system: true, text, ts: Date.now() };
    this.pushChat(entry);
    this.ctx.storage.put('chat', this.chat);
    this.broadcastRaw({ t: 'chat', msg: entry });
  }

  pushChat(entry) {
    this.chat.push(entry);
    if (this.chat.length > MAX_CHAT_HISTORY) this.chat.splice(0, this.chat.length - MAX_CHAT_HISTORY);
  }

  sockets(exclude) {
    return this.ctx.getWebSockets().filter((s) => s !== exclude && s.readyState === WebSocket.OPEN);
  }

  online(exclude) {
    const set = new Set();
    for (const s of this.sockets(exclude)) {
      const pid = s.deserializeAttachment()?.pid;
      if (pid) set.add(pid);
    }
    return set;
  }

  publicRoom(online) {
    const r = this.room;
    let spectators = 0;
    for (const pid of online) if (this.seatOf(pid) == null) spectators++;
    return {
      code: r.code,
      cfg: r.cfg,
      status: r.status,
      seats: r.seats.map((s) => (s ? { name: s.name, bot: !!s.bot, online: s.bot || online.has(s.pid), host: !s.bot && s.pid === r.host } : null)),
      spectators,
    };
  }

  stateFor(ws, online) {
    const pid = ws.deserializeAttachment()?.pid;
    const seat = pid ? this.seatOf(pid) : null;
    const r = this.room;
    return {
      t: 'state',
      room: this.publicRoom(online),
      you: seat,
      isHost: !!pid && pid === r.host,
      game: r.game ? viewFor(r.game, seat) : null,
      dealLeft: r.status === 'playing' ? Math.max(0, (r.dealUntil || 0) - Date.now()) : 0, // ms de reparto que faltan
      now: Date.now(),
    };
  }

  sendState(ws) {
    this.send(ws, this.stateFor(ws, this.online()));
  }

  broadcastState(exclude) {
    if (!this.room) return;
    const online = this.online(exclude);
    for (const s of this.sockets(exclude)) this.send(s, this.stateFor(s, online));
  }

  broadcastRaw(obj, exclude) {
    const data = JSON.stringify(obj);
    for (const s of this.sockets(exclude)) {
      try {
        s.send(data);
      } catch {}
    }
  }

  send(ws, obj) {
    try {
      ws.send(JSON.stringify(obj));
    } catch {}
  }

  async updateLobby(exclude) {
    const r = this.room;
    if (!r) return;
    const online = this.online(exclude);
    try {
      await this.env.LOBBY.get(this.env.LOBBY.idFromName('global')).upsert({
        code: r.code,
        mode: r.cfg.mode,
        target: r.cfg.target,
        isPublic: r.cfg.isPublic,
        status: r.status,
        players: r.seats.map((s) => s?.name ?? null),
        free: r.seats.filter((s) => !s).length,
        online: r.seats.filter((s) => s && !s.bot && online.has(s.pid)).length,
        score: r.game?.score ?? null,
        options: roomOptionsText(r.cfg),
      });
    } catch (e) {
      console.error('lobby update failed', e);
    }
  }
}
