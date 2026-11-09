// Graba la partida que se está jugando en una sala, para el historial y el análisis (formato en
// public/js/replay.js). Cada mano va en su propia clave del storage del Durable Object (una partida larga no
// entra en un solo valor) y se escribe solo lo que cambió.
import { snapshot, LOG_VERSION } from '../public/js/replay.js';
import { roomOptions } from '../public/js/config.js';

const META = 'log:meta';
const handKey = (i) => `log:h:${i}`;

// Solo los campos que usa el motor: lo demás que mande el navegador no se guarda.
const ACTION_KEYS = ['t', 'card', 'mode', 'bottom', 'top', 'kind', 'value', 'target'];
const cleanAction = (a) => Object.fromEntries(ACTION_KEYS.filter((k) => a?.[k] !== undefined).map((k) => [k, a[k]]));

export class MatchRecorder {
  constructor(storage) {
    this.storage = storage;
    this.meta = null; // { v, code, mode, target, options, seats, rated, startedAt, hands: n }
    this.hands = [];
    this.dirty = new Set();
  }

  async load() {
    this.meta = (await this.storage.get(META)) || null;
    if (!this.meta) return;
    const keys = Array.from({ length: this.meta.hands }, (_, i) => handKey(i));
    const got = keys.length ? await this.storage.get(keys) : new Map();
    this.hands = keys.map((k) => got.get(k) || { start: null, steps: [] });
  }

  get active() {
    return !!this.meta;
  }

  /** Empieza a grabar una partida nueva (borra la anterior). */
  async start(room) {
    await this.clear();
    const seats = room.seats.map((s) => ({ name: s.name, uid: s.bot ? null : s.pid, bot: !!s.bot, cos: s.cos || {}, ...(s.disguised ? { disguised: true, elo: s.elo } : {}) }));
    this.meta = {
      v: LOG_VERSION,
      code: room.code,
      mode: room.cfg.mode,
      target: room.cfg.target,
      options: { ...roomOptions(room.cfg), trucoDesdeSegunda: !!room.cfg.trucoDesdeSegunda },
      seats,
      rated: seats.every((s) => !s.bot || s.disguised),
      startedAt: new Date().toISOString(),
      hands: 0,
    };
    this.dirty.add(META);
  }

  /** Mano nueva: el estado ya repartido (con las trampas de los bots hechas). */
  hand(g) {
    if (!this.meta) return;
    this.hands.push({ start: snapshot(g), steps: [] });
    this.meta.hands = this.hands.length;
    this.dirty.add(META).add(handKey(this.hands.length - 1));
  }

  /**
   * Una jugada que el motor aceptó ([asiento, acción]) o el cierre de "mostrar los tantos" ('close').
   * auto: la hizo un bot en lugar de la persona sentada ahí (desconectada o su compañero bot contestó por ella):
   * queda como [asiento, acción, 1] y el análisis no se la cuenta.
   */
  step(seat, a, auto = false) {
    const cur = this.hands[this.hands.length - 1];
    if (!this.meta || !cur) return;
    cur.steps.push(seat === 'close' ? ['close'] : auto ? [seat, cleanAction(a), 1] : [seat, cleanAction(a)]);
    this.dirty.add(handKey(this.hands.length - 1));
  }

  async flush() {
    if (!this.dirty.size) return;
    const put = {};
    for (const k of this.dirty) put[k] = k === META ? this.meta : this.hands[Number(k.split(':')[2])];
    this.dirty.clear();
    await this.storage.put(put);
  }

  /** El registro completo (lo que va a la base). */
  log() {
    const { v, mode, target, options, seats } = this.meta;
    return { v, mode, target, options, seats, hands: this.hands };
  }

  async clear() {
    const n = this.meta?.hands || 0;
    const keys = [META, ...Array.from({ length: n }, (_, i) => handKey(i))];
    for (let i = 0; i < keys.length; i += 128) await this.storage.delete(keys.slice(i, i + 128));
    this.meta = null;
    this.hands = [];
    this.dirty.clear();
  }
}
