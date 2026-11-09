import { DurableObject } from 'cloudflare:workers';
import { newGame, act, nextHand, rematch, viewFor, waitingFor, team, closeShow, envidoVoices, trucoCallable, isPie } from '../public/js/engine.js';
import { botAction, botSena, botClaims, botShow, stackDeck, fallbackActions, BotMemo, botAnswer, botAsks, botCallsTantos } from '../public/js/bot.js';
import { talkFor, talkHandEnd, talkCaught, talkEvent, talkIdle, talkReply, talkAsk, talkAnswer, talkTellTantos, ASK_ANSWERS } from '../public/js/talk.js';
import { observe } from '../public/js/brain.js';
import { MODES, TARGETS, SENAS, BOT, BOT_NAMES, TIMING, dealMs, speechMs, MAX_CHAT_HISTORY, MAX_CHAT_TEXT, ROOM_OPTIONS, roomOptions, roomOptionsText, ROOM_REUSE_MS, cleanEquipped, botSkill, ELO_START, MATCH } from '../public/js/config.js';
import { cleanName, rng } from './util.js';
import { verifyToken, getProfile } from './auth.js';
import { MatchRecorder } from './recorder.js';
import { rivalSeat, nextRivalIn } from './matchmaking.js';
import { recordMatch } from './matches.js';

// Memoria de situaciones de los bots (ver BotMemo en bot.js): una por isolate, compartida por todas las salas
// que corren en él. Al arrancar se trae lo que guardó el Lobby; lo que madura se le manda al terminar cada mano.
const MEMO = new BotMemo(60000);
let memoLoaded = false;

const BOT_SHOW_DELAY = 1200; // el bot que ganó el envido muestra a los 1,2 s
const REACT_MS = 1100; // las reacciones de los bots salen un poco después de lo que las provocó
const BOT_CLAIM_DELAY = 6000; // + hasta 4 s al azar: un bot rival reclama si el humano no muestra

// Una sala de truco = un Durable Object. Guarda la sala, valida jugadas y reparte el estado por WebSocket.
// Protocolo de mensajes: ver AGENTS.md.
export class TrucoRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.gaze = {}; // asiento -> a quién mira (asiento, 'table' o null). Vive en memoria.
    this.brains = null; // lo que los bots saben de cada persona (pid -> cerebro, + global). Lo guarda el Lobby.
    this.learnBuf = []; // lo que hicieron las personas en esta mano, para aprender al terminarla
    this.rec = new MatchRecorder(ctx.storage); // la partida en curso, para el historial (ver recorder.js)
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get('room')) || null;
      this.chat = (await ctx.storage.get('chat')) || [];
      this.specChat = (await ctx.storage.get('specChat')) || [];
      await this.rec.load();
    });
  }

  // ---- RPC desde el Worker ----
  async create({ code, mode, target, options, isPublic, pid, name, quick = null, rated = true }) {
    if (this.room && !this.reusable()) return { ok: false };
    // código reciclado: se arranca de cero (sin chat ni miradas de la sala anterior)
    this.chat = [];
    this.specChat = [];
    this.gaze = {};
    await this.ctx.storage.put({ chat: this.chat, specChat: this.specChat });
    await this.ctx.storage.deleteAlarm();
    this.room = {
      code,
      cfg: { mode, target, isPublic: !!isPublic, rated: !!rated, trucoDesdeSegunda: true, ...roomOptions(options) },
      seats: Array(MODES[mode]).fill(null),
      host: pid,
      status: 'lobby', // lobby | playing | ended
      game: null,
      handEndedAt: 0,
      afkSince: {},
      createdAt: Date.now(),
      // partida rápida: arranca sola cuando se llena y, si no aparece gente, la completan rivales automáticos
      quick: quick ? { elo: quick.elo, startedAt: Date.now(), nextAt: Date.now() + nextRivalIn(true, rng) } : null,
    };
    this.room.seats[0] = { pid, name: cleanName(name) };
    await this.save();
    await this.updateLobby();
    return { ok: true };
  }

  // Mesa en juego del lobby: todos son usuarios automáticos y corre solo mientras alguien la mira. score: cómo va ahora.
  async showUp({ code, mode, target, seats, score }) {
    const cur = this.room;
    if (cur?.show && cur.status === 'playing') {
      // ya estaba armada: si nadie la miraba, se pone al día con el tanteador del lobby
      if (!this.online().size) cur.game.score = cur.game.score.map((v, i) => Math.max(v, Math.min(score[i], target - 1)));
      await this.save();
      return { ok: true };
    }
    if (cur && !cur.show && !this.reusable()) return { ok: false };
    this.chat = [];
    this.specChat = [];
    this.gaze = {};
    await this.ctx.storage.put({ chat: this.chat, specChat: this.specChat });
    await this.ctx.storage.deleteAlarm();
    this.room = {
      code,
      cfg: { mode, target, isPublic: true, trucoDesdeSegunda: true, ...roomOptions() },
      seats: seats.map((s) => ({ ...s })),
      host: null,
      status: 'playing',
      show: true,
      quick: null,
      game: newGame({ mode, target, trucoDesdeSegunda: true, ...roomOptions(), dealer: Math.floor(rng() * seats.length) }, rng),
      handEndedAt: 0,
      afkSince: {},
      createdAt: Date.now(),
    };
    this.room.game.score = score.map((v) => Math.min(v, target - 1));
    await this.loadBrains();
    this.afterDeal();
    await this.save();
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
    return {
      exists: true,
      mode: r.cfg.mode,
      status: r.status,
      free: r.seats.filter((s) => !s).length,
      isPublic: r.cfg.isPublic,
      quick: !!r.quick,
      cfg: r.cfg,
      players: r.seats.filter(Boolean).map((s) => s.name),
      host: r.seats.find((s) => s && !s.bot && s.pid === r.host)?.name || null,
    };
  }

  // Para el cartel de reconectar: si seguís sentado en la partida y cuánto te queda para volver.
  async mine(pid) {
    const r = this.room;
    const seat = r && pid ? this.seatOf(pid) : null;
    if (!r || seat == null || r.status !== 'playing') return { playing: false };
    const since = r.afkSince?.[seat];
    return {
      playing: true,
      mode: r.cfg.mode,
      score: r.game.score,
      myTeam: team(seat),
      left: since ? Math.max(0, since + TIMING.afk - Date.now()) : null,
      forfeit: !this.partnerOnline(seat, this.online()),
    };
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

    // entrar pide sesión: el jugador es el id de la cuenta y el nombre, el de su perfil (ver src/auth.js)
    let account = null;
    if (msg.t === 'join') {
      const user = await verifyToken(this.env, msg.token);
      // sin caché: lo que tiene puesto de la tienda puede haber cambiado recién
      const profile = user && (await getProfile(this.env, user.id, { fresh: true }).catch(() => null));
      if (!profile) return this.send(ws, { t: 'auth' });
      account = { pid: user.id, name: profile.username, cos: cleanEquipped(profile.equipped), elo: profile[`elo_${this.room.cfg.mode}`] ?? ELO_START, avatar: profile.avatar || null };
    }

    const r = this.room;
    const pid = account ? account.pid : ws.deserializeAttachment()?.pid;
    const seat = pid ? this.seatOf(pid) : null;
    const isHost = pid && pid === r.host;
    const lobbyHost = isHost && r.status === 'lobby';

    switch (msg.t) {
      case 'join': {
        const name = cleanName(account.name);
        const cos = account.cos;
        ws.serializeAttachment({ pid, name, cos });
        if (seat != null) {
          r.seats[seat].name = name;
          r.seats[seat].cos = cos;
          r.seats[seat].elo = account.elo;
          r.seats[seat].avatar = account.avatar;
          // volvió después de cortarse: se avisa (y si ya jugaba el bot por él, que deja de jugar)
          if (r.status === 'playing' && r.afkSince[seat] && !this.online(ws).has(pid)) {
            this.addSystemChat(r.afkBot?.[seat] ? `${name} volvió: deja de jugar el bot en su lugar` : `${name} volvió`);
          }
          delete r.afkSince[seat];
          if (r.afkBot) delete r.afkBot[seat];
        } else if (r.status === 'lobby' && !msg.spectate) {
          const free = this.openSeat(!!msg.invited);
          if (free != null) {
            r.seats[free] = { pid, name, cos, elo: account.elo, avatar: account.avatar };
            this.addSystemChat(`${name} se sentó a la mesa`);
          }
        }
        if (r.quick && r.status === 'lobby' && r.seats.every(Boolean)) await this.beginGame();
        if (!r.host || this.seatOf(r.host) == null) r.host = this.seatOf(pid) != null ? pid : r.host;
        this.send(ws, { t: 'chat-history', messages: this.chat });
        if (this.seatOf(pid) == null) this.send(ws, { t: 'spec-history', messages: this.specChat });
        if (r.status === 'ended' && r.lastMatch) this.send(ws, { t: 'match', ...r.lastMatch });
        this.send(ws, { t: 'gaze-all', gaze: this.gaze });
        return this.commit();
      }

      case 'sit': {
        if (r.status !== 'lobby' || !pid) return;
        const to = msg.seat;
        if (!Number.isInteger(to) || to < 0 || to >= r.seats.length || r.seats[to]) return;
        const att = ws.deserializeAttachment() || {};
        const me = seat != null ? r.seats[seat] : { pid, name: att.name || 'Invitado', cos: att.cos || {} };
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
        for (const k of ['isPublic', 'rated', 'trucoDesdeSegunda', ...ROOM_OPTIONS.map((o) => o.key)]) if (typeof c[k] === 'boolean') r.cfg[k] = c[k];
        if (MODES[c.mode] && c.mode !== r.cfg.mode) {
          const people = r.seats.filter((s) => s && !s.bot);
          r.cfg.mode = c.mode;
          r.seats = Array(MODES[c.mode]).fill(null);
          people.slice(0, r.seats.length).forEach((p, i) => (r.seats[i] = p));
        }
        return this.commit();
      }

      case 'start': {
        if (!lobbyHost || r.quick) return;
        // de a uno: así botName() ve los nombres que ya se pusieron y no repite
        if (msg.fillBots) r.seats.forEach((s, i) => s || (r.seats[i] = { bot: true, name: this.botName() }));
        if (r.seats.some((s) => !s)) return this.send(ws, { t: 'error', msg: 'Faltan jugadores (o llená con bots)' });
        await this.beginGame();
        return this.commit();
      }

      case 'act': {
        if (r.status !== 'playing' || seat == null) return;
        if (Date.now() < (r.dealUntil || 0)) {
          this.send(ws, { t: 'error', msg: 'Esperá que terminen de repartir' });
          return this.sendState(ws); // el cliente pintó la jugada: el estado real lo corrige
        }
        const seen = observe(r.game, seat, msg.a);
        const res = act(r.game, seat, msg.a);
        if (res.error) {
          this.send(ws, { t: 'error', msg: res.error });
          return this.sendState(ws); // por si el cliente tenía un estado viejo
        }
        this.rec.step(seat, msg.a);
        for (const e of seen) this.learnBuf.push({ pid, ...e });
        if (msg.a?.t === 'reclamar' && r.claimWatch?.includes(pid)) {
          this.learnBuf.push({ pid, key: 'claim', y: true });
          this.botSay(r.game.h.show?.seat, talkCaught(rng));
          r.claimWatch = r.claimWatch.filter((p) => p !== pid);
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
        this.deliverSena(seat, msg.sena);
        return this.save();
      }

      case 'chat': {
        const text = String(msg.text ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, MAX_CHAT_TEXT);
        if (!text || !pid) return;
        // los que miran tienen su chat aparte: a los jugadores no les llega
        if (seat == null && r.status !== 'lobby') return this.specSay(ws, text);
        const name = seat != null ? r.seats[seat].name : ws.deserializeAttachment()?.name || 'Espectador';
        const entry = { name, seat, text, ts: Date.now() };
        this.pushChat(entry);
        await this.ctx.storage.put('chat', this.chat);
        return this.broadcastRaw({ t: 'chat', msg: entry });
      }

      // Consulta al compañero: "¿tienen tantos?" / "¿le canto truco?" y la respuesta ("Cantá" o "Callado").
      case 'ask': {
        if (!this.canAsk(seat, msg.kind)) return;
        this.startAsk(seat, msg.kind);
        return this.commit();
      }

      case 'answer': {
        const q = seat != null ? this.openAsk(team(seat)) : null;
        if (!q || !ASK_ANSWERS[q.kind]?.includes(msg.ans) || !this.answerAsk(seat, msg.ans)) return;
        return this.commit();
      }

      // Partida rápida en equipo: el que busca invita a su equipo y se le guardan los lugares.
      case 'invite-team': {
        if (!r.quick || r.status !== 'lobby' || !isHost || r.seats.length <= 2) return;
        r.quick.holdUntil = Date.now() + MATCH.inviteHold;
        return this.commit();
      }

      case 'invite-cancel': {
        if (!r.quick || r.status !== 'lobby' || !isHost) return;
        r.quick.holdUntil = 0;
        r.quick.nextAt = Math.min(r.quick.nextAt, Date.now() + nextRivalIn(false, rng));
        return this.commit();
      }

      case 'rematch': {
        if (seat == null || r.status !== 'ended') return;
        (r.rematch ||= {})[seat] = true;
        // los rivales automáticos la aceptan como cualquiera: un ratito después
        if (r.seats.some((s) => s?.disguised) && !r.rematchBotAt) r.rematchBotAt = Date.now() + MATCH.rematchMin + Math.floor(rng() * MATCH.rematchRand);
        return this.tryRematch();
      }

      case 'to-lobby': {
        if (!isHost || r.status !== 'ended' || r.quick) return;
        r.rematch = null;
        r.rematchBotAt = 0;
        r.status = 'lobby';
        r.game = null;
        r.lastMatch = null;
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
    if (seat != null && r?.status === 'playing' && !r.seats[seat]?.bot && !this.online(ws).has(pid)) {
      // se cortó: corre la cuenta (la ven todos en su cartel) hasta que juegue un bot por él
      if (!r.afkSince[seat]) {
        r.afkSince[seat] = Date.now();
        const secs = Math.round(TIMING.afk / 1000);
        this.addSystemChat(`${r.seats[seat].name} se desconectó. Si no vuelve en ${secs} s, ${this.partnerOnline(seat, this.online(ws)) ? 'juega un bot en su lugar' : 'pierde la partida'}.`);
      }
      await this.save();
    }
    this.broadcastState(ws);
    await this.scheduleAlarm();
    await this.updateLobby(ws);
    // si se fue el único que faltaba, la revancha ya no lo espera
    if (r?.status === 'ended' && r.rematch) await this.tryRematch(ws);
  }

  async webSocketError(ws) {
    this.broadcastState(ws);
  }

  // Bots, AFK, pausa entre manos y miradas de los bots.
  // Si algo falla adentro, se avisa en los logs y se vuelve a programar: la partida no se traba.
  async alarm() {
    try {
      await this.tick();
    } catch (e) {
      console.error('alarm failed', e);
      try {
        await this.commit(); // manda el estado (si un bot ya jugó antes del error, que se vea) y reprograma
      } catch {}
    }
  }

  async tick() {
    const r = this.room;
    if (r?.status === 'lobby' && r.quick) return this.quickTick();
    if (r?.status === 'ended' && r.rematchBotAt && Date.now() >= r.rematchBotAt) {
      r.seats.forEach((s, i) => {
        if (s?.disguised) r.rematch[i] = true;
      });
      r.rematchBotAt = 0;
      return this.tryRematch();
    }
    if (!r || r.status !== 'playing') return;
    if (this.forfeitDue(Date.now())) return this.commit();
    const g = r.game;
    const now = Date.now();
    let changed = false;
    if (!this.brains) await this.loadBrains();

    if (g.h.phase === 'ended' && g.status === 'playing' && now - r.handEndedAt >= TIMING.handPause) {
      nextHand(g, rng);
      this.afterDeal();
      changed = true;
    } else if (g.h.phase === 'show') {
      // el que ganó el envido muestra (si es bot); los bots rivales reclaman si no muestra; al rato vale igual
      const sh = g.h.show;
      const since = r.showSince || now;
      if (this.isAway(sh.seat, now) && now - since > BOT_SHOW_DELAY && !sh.folded) {
        // si mintió en el envido, se va sin mostrar y reza que no le reclamen
        const a = botShow(g, sh.seat);
        changed = this.botAct(sh.seat, a);
        if (changed && a.t === 'nomostrar') this.onFold(sh.seat);
      }
      // si el bot no pudo mostrar o reclamar, igual se cierra por tiempo (si no, la mesa queda trabada en el show)
      if (!changed && sh.folded && r.botClaimAt && now >= r.botClaimAt) changed = this.botAct(r.botClaimer, { t: 'reclamar' });
      if (!changed && now - since >= TIMING.showWindow) {
        if (sh.folded) {
          changed = closeShow(g);
          if (changed) this.rec.step('close');
        } else if (this.botAct(sh.seat, { t: 'nomostrar' })) {
          // se le acabó el tiempo sin mostrar: es como irse sin mostrar, y los rivales pueden reclamar
          changed = true;
          this.onFold(sh.seat);
        }
      }
      if (changed) this.onGameChange();
    } else if (g.h.phase === 'play' && now >= (r.dealUntil || 0) && now >= (r.botReadyAt || 0)) {
      const actor = this.autoActor();
      const ctx = actor != null && this.botCtx(actor);
      const before = waitingFor(g);
      const ev0 = g.evId;
      let a = null;
      // si a este bot le acaban de consultar y todavía no contestó, primero contesta (y juega después)
      const pending = actor != null && r.seats[actor]?.bot ? this.openAsk(team(actor), now) : null;
      const mustAnswer = !!pending && pending.seat !== actor && pending.answers[actor] == null;
      if (mustAnswer) {
        this.answerAsk(actor, botAnswer(g, actor, pending.kind, rng));
        changed = true;
      }
      // un bot que tiene que decidir a veces primero le consulta al compañero ("¿tienen tantos?")
      const human = (s) => s != null && !r.seats[s]?.bot && !this.isAway(s, now);
      // el que no es pie le avisa al pie que tiene tantos (o farolea), sin que le pregunten
      const tells = !mustAnswer && actor != null && r.seats[actor]?.bot && before.kind === 'play' && this.mayTellTantos(actor) && botCallsTantos(g, actor, rng);
      if (tells) {
        this.tellTantos(actor);
        changed = true;
      }
      const askKind = !tells && !mustAnswer && actor != null && r.seats[actor]?.bot && before.kind === 'play' && g.n > 2 &&
        botAsks(g, actor, rng, this.partnersOf(actor).some(human), human(this.pieOf(team(actor))));
      const asked = !!askKind && this.canAsk(actor, askKind);
      if (asked) {
        this.startAsk(actor, askKind);
        changed = true;
      } else if (actor != null && !mustAnswer && !tells) {
        try {
          a = botAction(g, actor, rng, ctx);
        } catch (e) {
          console.error('bot failed', e);
        }
      }
      let ok = !!a && this.botAct(actor, a);
      // si el bot falló o eligió algo que no vale, juega lo primero que entre (nunca se traba la mesa)
      if (!ok && !asked && !mustAnswer && !tells && actor != null && waitingFor(g).seats.includes(actor)) {
        for (const f of fallbackActions(g, actor)) {
          if (this.botAct(actor, f)) {
            console.warn('bot fallback', JSON.stringify(a), '->', JSON.stringify(f));
            a = f;
            ok = true;
            break;
          }
        }
      }
      if (ok) {
        // contestó por el equipo sin esperar al compañero humano
        const partner = before.seats.some((s) => !r.seats[s].bot && !this.isAway(s, now));
        const speaker = r.seats[actor].bot ? actor : partner ? this.teamBot(actor) : null;
        // la frase dice el canto que hizo de verdad (truco, retruco, real envido...)
        const canto = g.ev.find((e) => e.id > ev0 && e.type === 'call' && e.seat === actor)?.text || '';
        const t = talkFor(a, before.kind, ctx.out, rng, partner, canto);
        // si contesta por el compañero, el "quiero" es del compañero: el bot solo avisa que contesta él
        if (t && !(t.call && speaker !== actor)) this.botSay(speaker, t.text, { call: t.call });
        if (a.t === 'truco' && (ctx.out?.p ?? 1) < 0.4) r.bluff = { seat: actor, hand: g.handNo };
        this.onGameChange();
        changed = true;
      }
    }
    if (this.botAnswers(now)) changed = true;
    if (this.noteAfk(now) && !changed) {
      await this.save();
      this.broadcastState();
    }
    this.botGlances();
    this.botSenas(now);
    this.botChatter(now);
    if (changed) await this.commit();
    else await this.scheduleAlarm();
  }

  // La revancha arranca cuando quieren todos los que siguen en la mesa (los bots elegidos por el anfitrión no opinan).
  async tryRematch(exclude) {
    const r = this.room;
    const online = this.online(exclude);
    const agreed = (s, i) => r.rematch?.[i] || (s.bot && !s.disguised) || (!s.bot && !online.has(s.pid));
    if (!online.size || !Object.keys(r.rematch || {}).length || !r.seats.every(agreed)) return this.commit();
    r.rematch = null;
    r.rematchBotAt = 0;
    rematch(r.game, rng);
    r.lastMatch = null;
    await this.rec.start(r);
    r.status = 'playing';
    this.addSystemChat('¡Revancha!');
    this.afterDeal();
    return this.commit();
  }

  // ---- partida rápida ----
  // Si el que buscaba se fue, no se sigue llenando (la sala queda vacía y el Lobby la olvida).
  async quickTick() {
    const r = this.room;
    const q = r.quick;
    if (!this.online().size) return;
    if (Date.now() >= q.nextAt) {
      const free = this.openSeat(false);
      if (free != null) {
        const used = new Set(r.seats.filter(Boolean).map((s) => s.name));
        const seat = rivalSeat(q.elo, rng, used, r.cfg.mode);
        r.seats[free] = seat;
        this.addSystemChat(`${seat.name} se sentó a la mesa`);
      }
      // solo quedan los lugares guardados: se sigue cuando termine la espera
      q.nextAt = free == null && q.holdUntil > Date.now() ? q.holdUntil + 100 : Date.now() + nextRivalIn(false, rng);
      if (r.seats.every(Boolean)) await this.beginGame();
    }
    await this.commit();
  }

  async beginGame() {
    const r = this.room;
    r.status = 'playing';
    const { mode, target, trucoDesdeSegunda } = r.cfg;
    r.game = newGame({ mode, target, trucoDesdeSegunda, ...roomOptions(r.cfg), dealer: Math.floor(rng() * r.seats.length) }, rng);
    await this.rec.start(r);
    await this.loadBrains();
    this.addSystemChat('¡Arranca la partida! Reparte ' + r.seats[r.game.dealer].name);
    this.afterDeal();
  }

  // ---- lógica de sala ----
  // Jugada de un bot (o de un ausente): si el motor la acepta, queda grabada.
  botAct(seat, a) {
    const ok = !!act(this.room.game, seat, a).ok;
    if (ok) this.rec.step(seat, a, !this.room.seats[seat]?.bot);
    return ok;
  }

  // Partida terminada: va al historial con el ELO y las monedas de cada uno, y se les avisa.
  async finishMatch() {
    const r = this.room;
    if (!this.rec.active) return;
    const meta = this.rec.meta;
    try {
      const done = await recordMatch(this.env, meta, this.rec.log(), r.game);
      if (done) {
        r.lastMatch = { ...done, rated: meta.rated };
        await this.save();
        this.broadcastRaw({ t: 'match', ...r.lastMatch });
      }
    } catch (err) {
      console.error('finishMatch', err);
    }
    await this.rec.clear();
  }

  afterDeal() {
    const r = this.room;
    r.handEndedAt = 0;
    r.showSince = 0;
    r.botClaimAt = 0;
    r.dealUntil = Date.now() + dealMs(r.game.n);
    r.botSenaDue = {};
    r.senaSeen = {}; // señas que vio cada bot en esta mano
    r.claimWatch = null;
    r.paceEv = r.game.evId;
    r.botReadyAt = 0;
    this.botCheats();
    this.rec.hand(r.game);
    this.botReact();
    if (r.game.n > 2) {
      r.seats.forEach((s, i) => {
        if (s?.bot) r.botSenaDue[i] = r.dealUntil + 400 + Math.floor(rng() * 2500);
      });
    }
  }

  // Trampas de los bots al empezar la mano (solo en mesas que las permiten): alguno espía las cartas
  // de los rivales y, si reparte un bot, a veces se acomoda una carta buena. Más seguido si va perdiendo.
  botCheats() {
    const r = this.room;
    const g = r.game;
    r.botPeek = {};
    if (!g.trampas) return;
    const behind = (s) => g.score[1 - team(s)] - g.score[team(s)] > g.target * BOT.behind;
    r.seats.forEach((s, i) => {
      // en partida rápida (por ELO) los rivales automáticos no hacen trampa
      if (s?.bot && !s.disguised && rng() < (behind(i) ? BOT.peekBehind : BOT.peek)) r.botPeek[i] = true;
    });
    if (r.seats[g.dealer]?.bot && !r.seats[g.dealer].disguised && rng() < (behind(g.dealer) ? BOT.stackBehind : BOT.stack)) stackDeck(g, g.dealer, rng);
  }

  // Lo que necesita un bot para decidir: si espía esta mano, quiénes son bots (sus compañeros bots le
  // pasan las cartas por señas) y lo aprendido de cada rival.
  botCtx(seat) {
    const r = this.room;
    return {
      peek: !!r.botPeek?.[seat],
      memo: MEMO,
      skill: r.seats[seat]?.disguised ? botSkill(r.seats[seat].elo) : null,
      // de quién es el modelo con el que se imagina a cada rival (parte de la clave de la memoria)
      brainKey: (s) => {
        const p = r.seats[s];
        const b = p && !p.bot ? this.brains?.[p.pid] : null;
        if (b && b.hands >= 20) return p.pid + ':' + Math.floor(b.hands / 50);
        return p?.bot ? 'bot' : 'g:' + Math.floor((this.brains?.global?.hands || 0) / 500);
      },
      senas: [...(r.senaSeen?.[seat] || []), ...this.askSenas(seat)],
      hush: this.askHush(seat),
      primera: this.askPrimera(seat),
      // los compañeros bots se pasan las cartas por señas; en partida rápida, no
      bots: r.seats.map((s, i) => (s?.bot && !s.disguised ? i : -1)).filter((i) => i >= 0),
      brainOf: (s) => {
        const p = r.seats[s];
        return !p || p.bot ? null : this.brains?.[p.pid] || this.brains?.global || null;
      },
    };
  }

  lobby() {
    return this.env.LOBBY.get(this.env.LOBBY.idFromName('global'));
  }

  async loadBrains() {
    const pids = this.room.seats.filter((s) => s && !s.bot).map((s) => s.pid);
    try {
      this.brains = await this.lobby().brains(pids);
    } catch (e) {
      console.error('brains load failed', e);
      this.brains = {};
    }
    if (!memoLoaded) {
      memoLoaded = true;
      try {
        MEMO.load(await this.lobby().memoGet());
      } catch (e) {
        console.error('memo load failed', e);
      }
    }
  }

  // Al terminar la mano: lo que hicieron las personas va al Lobby, que entrena y devuelve los cerebros nuevos.
  async flushLearning() {
    const r = this.room;
    for (const pid of r.claimWatch || []) this.learnBuf.push({ pid, key: 'claim', y: false });
    r.claimWatch = null;
    const ripe = MEMO.takeRipe();
    if (ripe.length) {
      try {
        await this.lobby().memoPut(ripe);
      } catch (e) {
        console.error('memo save failed', e);
      }
    }
    const batch = this.learnBuf.splice(0);
    if (!batch.length) return;
    try {
      this.brains = { ...this.brains, ...(await this.lobby().learn(batch)) };
    } catch (e) {
      console.error('learn failed', e);
    }
  }

  // "Cantámelo que tengo": una vez por mano y por equipo, en primera, si el pie todavía puede cantar el envido.
  mayTellTantos(seat) {
    const r = this.room;
    const g = r.game;
    const h = g.h;
    const T = team(seat);
    const pie = this.pieOf(T);
    if (g.n <= 2 || h.r !== 0 || h.envido.state !== 'none' || h.truco.level > 1 || pie == null || pie === seat || !envidoVoices(g, T).includes(pie)) return false;
    if (h.rounds[0].plays.some((p) => p.seat === seat || p.seat === pie)) return false;
    r.toldTantos ||= {};
    const key = g.handNo + ':' + T;
    if (r.toldTantos[key]) return false;
    r.toldTantos[key] = true; // se decide una sola vez
    return true;
  }

  tellTantos(seat) {
    const r = this.room;
    const pie = this.pieOf(team(seat));
    this.teamSay(seat, talkTellTantos(rng));
    // el pie bot lo toma como una seña de que tiene tantos
    if (r.seats[pie]?.bot) ((r.senaSeen ||= {})[pie] ||= []).push({ seat, sena: 'envido_alto' });
  }

  // ---- consulta al compañero
  // r.asks[equipo] = { seat, kind, hand, at, answers: { asiento: sí/no }, botDue }: la consulta abierta del equipo.
  // Cada equipo puede consultar una vez por mano cada cosa (r.asked). Todos la escuchan (es en voz alta).

  partnersOf(seat) {
    const g = this.room.game;
    return this.room.seats.map((_, i) => i).filter((i) => i !== seat && team(i) === team(seat) && !g.h.mazo[i]);
  }

  openAsk(T, now = Date.now()) {
    const r = this.room;
    const q = r.asks?.[T];
    return q && q.hand === r.game.handNo && !q.done && now < q.at + TIMING.askWait ? q : null;
  }

  canAsk(seat, kind) {
    const r = this.room;
    const g = r.game;
    if (seat == null || r.status !== 'playing' || !g?.h || g.h.phase !== 'play' || g.n <= 2 || g.h.mazo[seat]) return false;
    const T = team(seat);
    if (this.openAsk(T) || (r.asked?.[T] || []).includes(g.handNo + ':' + kind) || !this.partnersOf(seat).length) return false;
    // los tantos los pregunta el que canta el envido del equipo (el pie), mientras todavía lo puede cantar
    if (kind === 'tantos') {
      const h = g.h;
      return h.r === 0 && h.envido.state === 'none' && envidoVoices(g, T).includes(seat) && !h.rounds[0].plays.some((p) => p.seat === seat);
    }
    // el truco, si el equipo lo puede cantar o subir en esta mano y al que pregunta todavía le toca en esta ronda
    if (kind === 'truco') return trucoCallable(g, seat);
    // "¿pongo o voy?": en primera, el que no es pie le pregunta al pie (los dos sin tirar todavía)
    if (kind === 'primera') {
      const h = g.h;
      const pie = this.pieOf(T);
      const played = (s) => h.rounds[0].plays.some((p) => p.seat === s);
      return h.r === 0 && pie != null && pie !== seat && !played(seat) && !played(pie);
    }
    return false;
  }

  // El pie del equipo que sigue en la mano (null si se fue al mazo).
  pieOf(T) {
    const g = this.room.game;
    const i = this.room.seats.findIndex((_, s) => team(s) === T && isPie(g, s) && !g.h.mazo[s]);
    return i < 0 ? null : i;
  }

  // Quiénes contestan la consulta: "¿pongo o voy?" la contesta el pie; lo demás, todos los compañeros.
  answerers(q) {
    if (q.kind === 'primera') {
      const pie = this.pieOf(team(q.seat));
      return pie == null ? [] : [pie];
    }
    return this.partnersOf(q.seat);
  }

  startAsk(seat, kind) {
    const r = this.room;
    const g = r.game;
    const now = Date.now();
    const T = team(seat);
    r.asks ||= {};
    r.asked ||= {};
    (r.asked[T] ||= []).push(g.handNo + ':' + kind);
    const q = { seat, kind, hand: g.handNo, at: now, answers: {}, botDue: 0 };
    const bots = this.answerers(q).filter((s) => r.seats[s]?.bot);
    if (bots.length) q.botDue = now + TIMING.askBotAnswer + Math.floor(rng() * 900);
    r.asks[T] = q;
    this.teamSay(seat, talkAsk(kind, rng, g.h.truco.level));
    // si pregunta un bot, espera la respuesta antes de jugar (como mucho TIMING.askWait)
    if (r.seats[seat]?.bot) r.botReadyAt = Math.max(r.botReadyAt || 0, now + TIMING.askWait);
  }

  answerAsk(seat, ans) {
    const r = this.room;
    if (seat == null || !r.game?.h) return false;
    const T = team(seat);
    const q = this.openAsk(T);
    if (!q || q.seat === seat || q.answers[seat] != null || r.game.h.mazo[seat] || !this.answerers(q).includes(seat)) return false;
    q.answers[seat] = ans;
    const text = talkAnswer(q.kind, ans, rng);
    this.teamSay(seat, text);
    if (this.answerers(q).every((s) => q.answers[s] != null)) {
      q.done = true;
      // ya contestaron todos: el que preguntó (si es bot) sigue apenas se termina de decir la respuesta
      if (r.seats[q.seat]?.bot) r.botReadyAt = Math.max(r.botReadyAt || 0, Date.now() + speechMs(text) + TIMING.botAfterTalk + 300);
    }
    return true;
  }

  // Los bots compañeros contestan la consulta abierta (con lo que tienen ellos).
  botAnswers(now) {
    const r = this.room;
    let any = false;
    for (const T of [0, 1]) {
      const q = this.openAsk(T, now);
      if (!q || !q.botDue || now < q.botDue) continue;
      q.botDue = 0;
      for (const s of this.answerers(q)) {
        if (r.seats[s]?.bot && q.answers[s] == null) any = this.answerAsk(s, botAnswer(r.game, s, q.kind, rng)) || any;
      }
    }
    return any;
  }

  // Lo que le contestaron a un bot en esta mano. "Cantá" y "No tengo nada" son como señas (tiene / no tiene):
  // con eso decide él (si le dicen que no tienen nada y él tiene, igual puede cantar). "Callado" no dice qué
  // tiene (puede ir a la pesca): solo que no lo cante él.
  askSenas(seat) {
    const q = this.myAsk(seat);
    if (!q) return [];
    const map = { tantos: { si: 'envido_alto', nada: 'nada_envido' }, truco: { si: 'truco_si', nada: 'truco_no' } }[q.kind];
    if (!map) return [];
    return Object.entries(q.answers).filter(([, ans]) => map[ans]).map(([s, ans]) => ({ seat: Number(s), sena: map[ans] }));
  }

  askHush(seat) {
    const q = this.myAsk(seat);
    const answers = q ? Object.values(q.answers) : [];
    return answers.includes('callado') && !answers.includes('si') ? { [q.kind]: true } : null;
  }

  // Lo que le contestó el pie a "¿pongo o voy?" ('poner' / 'ir'), para el bot que preguntó.
  askPrimera(seat) {
    const q = this.myAsk(seat);
    return q?.kind === 'primera' ? Object.values(q.answers)[0] || null : null;
  }

  myAsk(seat) {
    const r = this.room;
    const q = r.asks?.[team(seat)];
    return q && q.seat === seat && q.hand === r.game.handNo ? q : null;
  }

  // Algo dicho en la mesa por cualquiera (persona o bot), sin el límite de charla de los bots.
  teamSay(seat, text) {
    const r = this.room;
    const now = Date.now();
    const entry = { name: r.seats[seat].name, seat, text, ts: now };
    this.pushChat(entry);
    this.ctx.storage.put('chat', this.chat);
    this.broadcastRaw({ t: 'chat', msg: entry });
    this.waitTalk(now, text);
  }

  // Un bot dice algo en el chat (como mucho uno cada TIMING.botChatGap).
  // A veces otro bot (mejor un rival) le contesta un rato después: se arma la charla.
  // call: la frase ya dice el canto (el cliente no repite el "¡Truco!"). chat: puede contestarle otro bot.
  botSay(seat, text, { call = false, chat = false, reply = false } = {}) {
    const r = this.room;
    const now = Date.now();
    if (!text || seat == null || !r.seats[seat]?.bot || now - (this.lastBotChat || 0) < TIMING.botChatGap) return false;
    this.lastBotChat = now;
    this.waitTalk(now, text);
    const entry = { name: r.seats[seat].name, seat, text, ts: now, ...(call ? { call: true } : {}) };
    this.pushChat(entry);
    this.ctx.storage.put('chat', this.chat);
    this.broadcastRaw({ t: 'chat', msg: entry });
    if (chat && !reply && rng() < 0.3) {
      const others = this.botSeats().filter((s) => s !== seat);
      const rivals = others.filter((s) => team(s) !== team(seat));
      const pool = rivals.length ? rivals : others;
      if (pool.length) this.botLater(pool[Math.floor(rng() * pool.length)], talkReply(rng), 2300 + Math.floor(rng() * 1500), { reply: true });
    }
    return true;
  }

  // Lo dice un rato después: las reacciones salen DESPUÉS del canto o la jugada que las provocó (el estado
  // con los eventos llega al cliente al final), así la charla sigue el orden de la mesa.
  botLater(seat, text, ms, opts) {
    if (!text) return false;
    if (this.room.game?.status !== 'playing') return this.botSay(seat, text, opts); // terminó: ya no hay alarmas
    const q = (this.room.talkQueue ||= []);
    if (q.length >= 2) return false;
    const at = Date.now() + ms;
    q.push({ seat, text, opts, at });
    // nadie juega mientras se dice (las respuestas entre bots no frenan: si alguien juega, se callan)
    if (!opts?.reply) this.waitTalk(at, text);
    q.sort((a, b) => a.at - b.at);
    return true;
  }

  botSeats() {
    return this.room.seats.map((s, i) => (s?.bot ? i : -1)).filter((i) => i >= 0);
  }

  // Los bots reaccionan a lo que pasó desde la última vez (cantos, cartas, rondas, mazo, envido...).
  botReact() {
    const r = this.room;
    const g = r.game;
    if (!g) return;
    const fresh = g.ev.filter((e) => e.id > (r.talkEv || 0)).slice(-4);
    r.talkEv = g.evId;
    r.lastMove = Date.now();
    const bots = this.botSeats();
    if (!bots.length) return;
    const humans = r.seats.map((s, i) => (s && !s.bot ? i : -1)).filter((i) => i >= 0);
    for (const e of fresh) {
      const order = bots.slice().sort(() => rng() - 0.5);
      for (const s of order) if (this.botLater(s, talkEvent(g, s, e, humans, rng), REACT_MS, { chat: true })) return;
    }
  }

  // Charla sin que pase nada: la respuesta pendiente de otro bot, o apurar a la persona que tarda.
  botChatter(now) {
    const r = this.room;
    const g = r.game;
    const q = r.talkQueue || [];
    while (q.length && now >= q[0].at) {
      const t = q.shift();
      this.botSay(t.seat, t.text, t.opts);
    }
    if (g.h.phase !== 'play' || now - (r.lastMove || now) < TIMING.botIdle || r.idleAt === g.evId) return;
    const w = waitingFor(g);
    if (!w.seats.length || w.seats.some((s) => r.seats[s]?.bot)) return;
    r.idleAt = g.evId;
    const rivals = this.botSeats().filter((s) => team(s) !== team(w.seats[0]));
    const pool = rivals.length ? rivals : this.botSeats();
    if (pool.length) this.botSay(pool[Math.floor(rng() * pool.length)], talkIdle(rng), { chat: true });
  }

  // Al terminar la mano, algún bot comenta (si le salió un farol, a veces se burla).
  botHandTalk() {
    const r = this.room;
    const g = r.game;
    const res = g.h.result;
    const bots = r.seats.map((s, i) => (s?.bot ? i : -1)).filter((i) => i >= 0);
    if (!bots.length || !res) return;
    const b = r.bluff?.hand === g.handNo ? r.bluff : null;
    const bluffWon = b && res.reason === 'noquiero' && res.winner === team(b.seat);
    const seat = bluffWon ? b.seat : bots[Math.floor(rng() * bots.length)];
    this.botLater(seat, talkHandEnd(g, seat, bluffWon, rng), REACT_MS + 400, { chat: true });
  }

  // Avisa en el chat cuando a un desconectado se le terminó la cuenta y empieza a jugar el bot por él.
  noteAfk(now) {
    const r = this.room;
    let any = false;
    for (const [k, since] of Object.entries(r.afkSince || {})) {
      const seat = Number(k);
      const p = r.seats[seat];
      if (!p || p.bot || r.afkBot?.[seat] || now - since < TIMING.afk || this.online().has(p.pid)) continue;
      (r.afkBot ||= {})[seat] = true;
      this.addSystemChat(`${p.name} no volvió: ahora juega un bot en su lugar`);
      any = true;
    }
    return any;
  }

  // ¿Le queda a este asiento algún compañero persona conectado?
  partnerOnline(seat, online) {
    return this.room.seats.some((s, i) => s && !s.bot && i !== seat && team(i) === team(seat) && online.has(s.pid));
  }

  // Se fue y no volvió a tiempo, y no le queda ningún compañero en la mesa: su equipo pierde la partida.
  forfeitDue(now) {
    const r = this.room;
    const online = this.online();
    for (const [k, since] of Object.entries(r.afkSince || {})) {
      const seat = Number(k);
      const p = r.seats[seat];
      if (!p || p.bot || now - since < TIMING.afk || online.has(p.pid) || this.partnerOnline(seat, online)) continue;
      if (!this.botAct(seat, { t: 'rendirse' })) continue;
      this.addSystemChat(`${p.name} no volvió: pierde la partida`);
      this.onGameChange();
      return true;
    }
    return false;
  }

  // Bot, o humano desconectado hace más de TIMING.afk: juega el servidor por él.
  isAway(seat, now = Date.now()) {
    const r = this.room;
    const p = r.seats[seat];
    if (!p || p.bot) return !!p;
    if (this.online().has(p.pid)) return false;
    return now - (r.afkSince[seat] || now) >= TIMING.afk;
  }

  // Los bots no juegan hasta que se terminó de decir lo que empieza en `at` (más un respiro).
  waitTalk(at, text) {
    const r = this.room;
    r.botReadyAt = Math.max(r.botReadyAt || 0, at + speechMs(text) + TIMING.botAfterTalk);
  }

  // Ritmo de la mesa: después de cada cosa que pasa, el próximo bot espera a que se vea y se escuche.
  // Piensa un rato; si hubo un canto, espera a que se diga; si se cerró una ronda o el envido, una pausa más.
  pace() {
    const r = this.room;
    const g = r.game;
    const now = Date.now();
    let wait = TIMING.botThinkMin + Math.floor(rng() * TIMING.botThinkRand);
    for (const e of g.ev) {
      if (e.id <= (r.paceEv || 0)) continue;
      if (e.type === 'call') wait = Math.max(wait, speechMs(e.text) + TIMING.botAfterTalk + 400);
      if (e.type === 'tanto') wait = Math.max(wait, speechMs(e.value ?? 'Son buenas') + TIMING.botAfterTalk + 400);
      if (e.type === 'show') wait = Math.max(wait, speechMs(`${e.value} en mesa`) + TIMING.botAfterTalk + 400);
      if (e.type === 'round' || e.type === 'envido-done' || e.type === 'flor-done') wait += TIMING.roundPause;
    }
    r.paceEv = g.evId;
    r.botReadyAt = Math.max(r.botReadyAt || 0, now + wait);
  }

  onGameChange() {
    const r = this.room;
    const g = r.game;
    this.pace();
    if (g.status === 'ended' || (g.h.phase === 'ended' && !r.handEndedAt)) {
      this.learnDue = true;
      this.botHandTalk();
    }
    this.botReact();
    // momento en que se cantó lo que está esperando respuesta (para el compañero bot que contesta)
    if (['truco', 'envido', 'flor'].includes(waitingFor(g).kind)) r.callAt = Date.now();
    if (g.status === 'ended') {
      r.status = 'ended';
      this.matchDue = true;
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
      if (!r.seats[sh.seat]?.bot && claimer >= 0 && botClaims(g, claimer, rng, this.botCtx(claimer))) {
        r.botClaimer = claimer;
        r.botClaimAt = r.showSince + BOT_CLAIM_DELAY + Math.floor(rng() * 4000);
      }
    }
  }

  // El que ganó el envido se fue al mazo sin mostrar: a los rivales les quedan TIMING.foldWindow ms para
  // reclamar (si hay un bot rival que iba a reclamar, lo hace ahora, un poco después).
  // Si el que no mostró es un bot, se anota qué personas rivales reclaman (los bots aprenden a quién mentirle).
  onFold(botSeat = null) {
    const r = this.room;
    const now = Date.now();
    r.showSince = now - TIMING.showWindow + TIMING.foldWindow;
    if (r.botClaimAt) r.botClaimAt = now + 1200 + Math.floor(rng() * 2000);
    if (botSeat != null && r.seats[botSeat]?.bot) {
      r.claimWatch = r.seats.filter((s, i) => s && !s.bot && team(i) !== team(botSeat)).map((s) => s.pid);
    }
  }

  // Asiento al que le toca y que debe jugar el servidor (bot o humano ausente).
  autoActor() {
    const r = this.room;
    const w = waitingFor(r.game);
    if (!w.seats.length) return null;
    const now = Date.now();
    const bot = w.seats.find((s) => r.seats[s].bot);
    if (!w.seats.some((s) => !this.isAway(s, now))) return bot ?? w.seats[0];
    // hay un humano conectado que puede contestar: si el canto también lo puede contestar un compañero bot, el bot
    // contesta por los dos pasado un buen rato. Lo que tiene que contestar la persona lo contesta la persona: el
    // servidor nunca juega en el asiento de alguien que está conectado.
    const at = this.partnerAt(w);
    return at != null && now >= at ? bot ?? null : null;
  }

  // Un compañero bot de `seat` que siga en la mano (null si no hay).
  teamBot(seat) {
    const r = this.room;
    const i = r.seats.findIndex((s, j) => s?.bot && j !== seat && team(j) === team(seat) && !r.game.h.mazo[j]);
    return i < 0 ? null : i;
  }

  // Cuándo contesta el compañero bot el canto pendiente (null si no corresponde).
  partnerAt(w = waitingFor(this.room.game)) {
    const r = this.room;
    if (!['truco', 'envido', 'flor'].includes(w.kind) || !w.seats.some((s) => r.seats[s]?.bot)) return null;
    return (r.callAt || 0) + TIMING.partnerAnswer;
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
    // los bots la anotan para decidir: el compañero siempre está atento; un rival, solo si justo lo miraba
    const r = this.room;
    r.senaSeen ||= {};
    r.seats.forEach((p, b) => {
      if (!p?.bot || b === seat || (team(b) !== team(seat) && !watchers.has(b))) return;
      (r.senaSeen[b] ||= []).push({ seat, sena });
    });
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

  // Los lugares de tu equipo que se están guardando para tus invitados.
  heldSeats() {
    const r = this.room;
    if (!r.quick || !(r.quick.holdUntil > Date.now())) return [];
    const mine = team(this.seatOf(r.host) ?? 0);
    return r.seats.map((s, i) => (s || team(i) !== mine ? -1 : i)).filter((i) => i >= 0);
  }

  // Dónde se sienta el que llega: el invitado, con el que invitó; los demás, fuera de los lugares guardados.
  openSeat(invited) {
    const r = this.room;
    const held = this.heldSeats();
    if (!r.quick || (!held.length && !invited)) return this.freeSeat();
    if (invited) {
      const mine = team(this.seatOf(r.host) ?? 0);
      return r.seats.findIndex((s, i) => !s && team(i) === mine) >= 0 ? r.seats.findIndex((s, i) => !s && team(i) === mine) : this.freeSeat();
    }
    const i = r.seats.findIndex((s, k) => !s && !held.includes(k));
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
    if (this.learnDue) {
      this.learnDue = false;
      await this.flushLearning();
    }
    await this.rec.flush();
    await this.save();
    if (this.matchDue) {
      this.matchDue = false;
      await this.finishMatch();
    }
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
    if (r?.status === 'lobby' && r.quick && this.online().size) return this.ctx.storage.setAlarm(Math.max(Date.now() + 100, r.quick.nextAt));
    if (r?.status === 'ended' && r.rematchBotAt && this.online().size) return this.ctx.storage.setAlarm(Math.max(Date.now() + 100, r.rematchBotAt));
    if (r?.status === 'playing' && !this.online().size) {
      // nadie mirando: se duerme, salvo que haya que darle la derrota al que se fue
      const due = Object.values(r.afkSince || {}).map((t) => t + TIMING.afk);
      return due.length ? this.ctx.storage.setAlarm(Math.max(Date.now() + 100, Math.min(...due))) : this.ctx.storage.deleteAlarm();
    }
    if (!r || r.status !== 'playing') return this.ctx.storage.deleteAlarm();
    const now = Date.now();
    const g = r.game;
    let at = now + TIMING.botHeartbeat;
    if (g.h.phase === 'ended') at = Math.min(at, r.handEndedAt + TIMING.handPause);
    else if (g.h.phase === 'show') {
      const since = r.showSince || now;
      at = Math.min(at, since + TIMING.showWindow, since + BOT_SHOW_DELAY + 100);
      if (r.botClaimAt && g.h.show.folded) at = Math.min(at, r.botClaimAt);
    } else if (now < (r.dealUntil || 0)) at = Math.min(at, r.dealUntil + 50);
    else if (this.autoActor() != null) at = Math.min(at, Math.max(now + 100, r.botReadyAt || now + TIMING.botThinkMin));
    else if (this.partnerAt() != null) at = Math.min(at, Math.max(now + 100, this.partnerAt()));
    else for (const s of waitingFor(g).seats) if (r.afkSince[s]) at = Math.min(at, Math.max(now + 200, r.afkSince[s] + TIMING.afk));
    for (const t of Object.values(r.botSenaDue || {})) at = Math.min(at, Math.max(now + 100, t));
    for (const [s, since] of Object.entries(r.afkSince || {})) if (!r.afkBot?.[s]) at = Math.min(at, Math.max(now + 100, since + TIMING.afk));
    if (r.talkQueue?.length) at = Math.min(at, Math.max(now + 100, r.talkQueue[0].at));
    for (const T of [0, 1]) {
      const q = this.openAsk(T, now);
      if (q?.botDue) at = Math.min(at, Math.max(now + 100, q.botDue));
      if (q) at = Math.min(at, q.at + TIMING.askWait + 50);
    }
    await this.ctx.storage.setAlarm(Math.max(now + 100, at));
  }

  addSystemChat(text) {
    const entry = { system: true, text, ts: Date.now() };
    this.pushChat(entry);
    this.ctx.storage.put('chat', this.chat);
    this.broadcastRaw({ t: 'chat', msg: entry });
  }

  async specSay(ws, text) {
    const entry = { name: ws.deserializeAttachment()?.name || 'Espectador', text, ts: Date.now(), spec: true };
    this.specChat.push(entry);
    if (this.specChat.length > MAX_CHAT_HISTORY) this.specChat.splice(0, this.specChat.length - MAX_CHAT_HISTORY);
    await this.ctx.storage.put('specChat', this.specChat);
    for (const s of this.sockets()) {
      const pid = s.deserializeAttachment()?.pid;
      if (pid && this.seatOf(pid) == null) this.send(s, { t: 'spec-chat', msg: entry });
    }
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
      quick: r.quick ? { elo: r.quick.elo, startedAt: r.quick.startedAt, holding: this.heldSeats().length } : null,
      rematch: r.status === 'ended' && r.rematch ? Object.keys(r.rematch).map(Number) : [],
      seats: r.seats.map((s, i) => {
        if (!s) return null;
        const on = s.bot || online.has(s.pid);
        // desconectado en partida: cuánto falta (ms) para que juegue un bot por él (0 = ya juega el bot)
        const since = !on && r.status === 'playing' ? r.afkSince?.[i] : null;
        const botIn = since ? Math.max(0, since + TIMING.afk - Date.now()) : null;
        // cos: lo que tiene puesto de la tienda (ropa, gorro, anteojos, lo que tiene delante)
        return { forfeit: !!since && !this.partnerOnline(i, online), name: s.name, bot: !!s.bot && !s.disguised, online: on, host: !s.bot && s.pid === r.host, botIn, cos: s.cos || {}, elo: s.elo ?? null, avatar: s.avatar || null };
      }),
      // el paño y el mazo son los del anfitrión
      table: (() => {
        const h = r.seats.find((s) => s && !s.bot && s.pid === r.host)?.cos || {};
        return { pano: h.pano || null, dorso: h.dorso || null };
      })(),
      spectators,
    };
  }

  askView(seat) {
    const q = this.openAsk(team(seat));
    return {
      can: { tantos: this.canAsk(seat, 'tantos'), truco: this.canAsk(seat, 'truco'), primera: this.canAsk(seat, 'primera') },
      open: q ? { seat: q.seat, kind: q.kind, answered: q.answers[seat] != null, mine: q.seat === seat, mineToAnswer: this.answerers(q).includes(seat) } : null,
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
      // consulta al compañero: qué puede preguntar y la consulta abierta de su equipo
      ask: seat != null && r.status === 'playing' && r.game?.h ? this.askView(seat) : null,
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
        rated: r.cfg.rated !== false,
        quick: !!r.quick,
        show: !!r.show,
        elo: r.quick?.elo ?? null,
        status: r.status,
        players: r.seats.map((s) => s?.name ?? null),
        free: r.seats.filter((s) => !s).length - this.heldSeats().length,
        online: r.seats.filter((s) => s && !s.bot && online.has(s.pid)).length,
        score: r.game?.score ?? null,
        options: roomOptionsText(r.cfg),
      });
    } catch (e) {
      console.error('lobby update failed', e);
    }
  }
}
