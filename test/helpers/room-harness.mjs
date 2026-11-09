// Banco de pruebas de la sala (src/truco-room.js) en Node: storage, sockets, Lobby y reloj de mentira.
// El reloj es manual: tick(ms) lo adelanta y dispara la alarma si ya venció, como hace Cloudflare.
import { registerHooks } from 'node:module';
import { resolve } from './cf-hooks.mjs';

registerHooks({ resolve });

globalThis.WebSocket ||= { OPEN: 1 };

// ---- reloj
let now = Date.UTC(2026, 10, 7, 12, 0, 0);
const realNow = Date.now;
Date.now = () => now;

class Storage {
  constructor() {
    this.map = new Map();
    this.alarm = null;
  }
  async get(k) {
    if (Array.isArray(k)) return new Map(k.filter((x) => this.map.has(x)).map((x) => [x, structuredClone(this.map.get(x))]));
    return this.map.has(k) ? structuredClone(this.map.get(k)) : undefined;
  }
  async put(k, v) {
    if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.map.set(a, structuredClone(b));
    else this.map.set(k, structuredClone(v));
  }
  async delete(k) {
    for (const x of [].concat(k)) this.map.delete(x);
  }
  async list({ prefix = '', limit = Infinity } = {}) {
    return new Map([...this.map].filter(([k]) => k.startsWith(prefix)).slice(0, limit));
  }
  async setAlarm(t) {
    this.alarm = t;
  }
  async deleteAlarm() {
    this.alarm = null;
  }
  async getAlarm() {
    return this.alarm;
  }
}

class FakeSocket {
  constructor(room) {
    this.room = room;
    this.readyState = 1;
    this.att = null;
    this.got = [];
  }
  send(s) {
    this.got.push(JSON.parse(s));
  }
  serializeAttachment(a) {
    this.att = a;
  }
  deserializeAttachment() {
    return this.att;
  }
  close() {
    this.readyState = 3;
  }
  last(t) {
    for (let i = this.got.length - 1; i >= 0; i--) if (this.got[i].t === t) return this.got[i];
    return null;
  }
}

// Lobby de mentira: sin cerebros guardados, aprende sin hacer nada.
const lobbyStub = new Proxy(
  {
    brains: async () => ({}),
    learn: async () => ({}),
    memoGet: async () => [],
    memoPut: async () => 0,
  },
  { get: (o, k) => o[k] || (async () => ({})) },
);

export async function makeRoom({ mode = '2v2', target = 15, options = {}, host = 'u0', name = 'Ana' } = {}) {
  const { TrucoRoom } = await import('../../src/truco-room.js');
  const storage = new Storage();
  const sockets = [];
  let ready;
  const ctx = {
    storage,
    getWebSockets: () => sockets,
    acceptWebSocket: () => {},
    blockConcurrencyWhile: (fn) => (ready = fn()),
  };
  const env = { LOBBY: { idFromName: () => 'global', get: () => lobbyStub } };
  const room = new TrucoRoom(ctx, env);
  await ready;
  await room.create({ code: '1234', mode, target, options, isPublic: false, pid: host, name });
  const h = {
    room,
    storage,
    sockets,
    get now() {
      return now;
    },
    // conecta un jugador (token = id) y lo hace entrar
    async join(pid, extra = {}) {
      const ws = new FakeSocket(room);
      sockets.push(ws);
      await room.webSocketMessage(ws, JSON.stringify({ t: 'join', token: pid, ...extra }));
      return ws;
    },
    async send(ws, msg) {
      await room.webSocketMessage(ws, JSON.stringify(msg));
    },
    async disconnect(ws) {
      ws.readyState = 3;
      sockets.splice(sockets.indexOf(ws), 1);
      await room.webSocketClose(ws, 1000);
    },
    // adelanta el reloj de a `step` ms hasta `ms`, disparando la alarma cuando vence
    async tick(ms, step = 100) {
      for (let t = 0; t < ms; t += step) {
        now += step;
        if (storage.alarm != null && now >= storage.alarm) {
          storage.alarm = null;
          await room.alarm();
        }
      }
    },
    chat: () => room.chat.map((c) => (c.system ? '· ' + c.text : `${c.seat}: ${c.text}`)),
    state: (ws) => ws.last('state'),
  };
  return h;
}

export const restoreClock = () => (Date.now = realNow);
