// Lo que los bots aprenden de cómo juega cada persona. Corre solo en el servidor (y en los tests).
//
// Cada "cerebro" tiene cuatro regresiones logísticas que se entrenan en línea, mano a mano:
//   trucoCall    P(canta truco | qué tan buena tiene la mano, nivel, ronda)
//   trucoAccept  P(quiere o sube el truco | mano, a qué nivel se lo cantan)
//   envidoCall   P(canta envido | sus tantos)
//   envidoAccept P(quiere o sube el envido | sus tantos, cuántos cantos van, si es falta)
// y dos tasas: cuánto miente en el envido (`lie`) y cuánto reclama cuando el rival no muestra (`claim`).
// Al final de cada mano el servidor sabe las cartas de verdad: con eso etiqueta lo que hizo cada uno
// (si cantó truco con nada, fue farol) y el modelo se corrige. Los bots lo usan para pesar las manos
// que imaginan del rival (bot.js): contra alguien que farolea mucho, un truco suyo asusta menos.
import { rank, team, tanto, waitingFor, actionsFor, envidoOpenFor } from './engine.js';

export const BRAIN_VERSION = 1;

// Lo que se supone de alguien que todavía no se conoce (el cerebro global arranca así).
const PRIORS = {
  trucoCall: [-2.4, 3.4, 0, 0],
  trucoAccept: [-1.6, 3.6, -0.5],
  envidoCall: [-3.4, 4.2],
  envidoAccept: [-2.0, 3.6, -0.4, -1.5],
};
const RATES = { lie: [1, 4], claim: [3, 2] }; // [veces sí, veces no] de arranque
export const MODEL_KEYS = Object.keys(PRIORS);
const MAX_W = 12;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const dot = (w, x) => w.reduce((s, wi, i) => s + wi * (x[i] ?? 0), 0);

// Cerebro nuevo; `base` (el global) le presta lo que ya sabe de la gente en general.
export function newBrain(base = null) {
  const src = base && base.v === BRAIN_VERSION ? base : null;
  return {
    v: BRAIN_VERSION,
    m: Object.fromEntries(MODEL_KEYS.map((k) => [k, { w: (src?.m[k]?.w || PRIORS[k]).slice(), n: 0 }])),
    rates: Object.fromEntries(Object.keys(RATES).map((k) => [k, (src?.rates[k] || RATES[k]).slice()])),
    hands: 0,
  };
}

const usable = (b) => b && b.v === BRAIN_VERSION;

export function predict(brain, key, x) {
  const w = usable(brain) ? brain.m[key].w : PRIORS[key];
  return sigmoid(dot(w, x));
}

export function rate(brain, key) {
  const [yes, no] = usable(brain) ? brain.rates[key] : RATES[key];
  return yes / (yes + no);
}

// Un paso de descenso por gradiente por ejemplo. Aprende rápido al principio y después se asienta.
export function train(brain, examples) {
  for (const { key, x, y } of examples) {
    if (RATES[key]) {
      const r = brain.rates[key];
      r[y ? 0 : 1]++;
      // ventana móvil: lo último que hizo pesa más que lo de hace mil manos
      const total = r[0] + r[1];
      if (total > 200) (r[0] *= 200 / total), (r[1] *= 200 / total);
      continue;
    }
    const m = brain.m[key];
    if (!m || !Array.isArray(x)) continue;
    const lr = 0.04 + 0.4 / (1 + m.n / 25);
    const err = (y ? 1 : 0) - sigmoid(dot(m.w, x));
    m.w = m.w.map((wi, i) => clamp(wi + lr * err * (x[i] ?? 0) - 0.0005 * wi, -MAX_W, MAX_W));
    m.n++;
  }
  return brain;
}

// ---------------------------------------------------------------- features

// 0..1: qué tan buena es una mano para el truco en este momento de la mano (cartas + rondas ganadas).
export function strength(g, seat, cards = g.h.inHand[seat]) {
  const h = g.h;
  const max = h.muestra ? 19 : 14;
  const rs = cards.map((c) => rank(c, h.muestra)).sort((a, b) => b - a);
  let won = 0;
  let lost = 0;
  for (const r of h.rounds) {
    if (r.result == null || r.result === 'parda') continue;
    if (r.result === team(seat)) won++;
    else lost++;
  }
  return clamp(((rs[0] || 0) / max) * 0.55 + ((rs[1] || 0) / max) * 0.25 + won * 0.3 - lost * 0.3, 0, 1);
}

// Tantos llevados a una escala chica (20 = 0, 33 = 1; los de una sola carta quedan negativos).
const tn = (t) => (t >= 20 ? (t - 20) / 13 : -0.6 + t / 14);

export const X = {
  trucoCall: (s, level, r) => [1, s, level / 4, r / 2],
  trucoAccept: (s, pendingLevel) => [1, s, (pendingLevel - 2) / 2],
  envidoCall: (t) => [1, tn(t)],
  envidoAccept: (t, calls) => [1, tn(t), calls.length - 1, calls.includes('falta') ? 1 : 0],
};

// Lo que se aprende de una jugada de una persona (se llama ANTES de aplicarla, con sus cartas reales).
export function observe(g, seat, a) {
  const h = g.h;
  if (!h || h.phase !== 'play' || !a) return [];
  const w = waitingFor(g);
  if (!w.seats.includes(seat)) return [];
  const out = [];
  const t = tanto(h.cards[seat], h.muestra).value;
  if (w.kind === 'play' && h.turn === seat) {
    const moved = ['play', 'play2', 'truco', 'envido'].includes(a.t);
    if (moved && actionsFor(g, seat).truco && a.t !== 'envido') out.push({ key: 'trucoCall', x: X.trucoCall(strength(g, seat), h.truco.level, h.r), y: a.t === 'truco' });
    if (moved && envidoOpenFor(g, seat)) out.push({ key: 'envidoCall', x: X.envidoCall(t), y: a.t === 'envido' });
  } else if (w.kind === 'truco') {
    const y = { quiero: true, truco: true, noquiero: false, mazo: false }[a.t];
    if (y != null) out.push({ key: 'trucoAccept', x: X.trucoAccept(strength(g, seat), h.truco.pending.level), y });
  } else if (w.kind === 'envido') {
    const y = { quiero: true, envido: true, noquiero: false }[a.t];
    if (y != null) out.push({ key: 'envidoAccept', x: X.envidoAccept(t, h.envido.calls), y });
  } else if (w.kind === 'declare' && a.t === 'cantar') {
    out.push({ key: 'lie', y: a.value != null && Number(a.value) !== t });
  }
  return out;
}
