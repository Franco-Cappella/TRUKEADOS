// Análisis post-partida, como la revisión de chess.com. Para cada decisión: cuánto valía cada opción (con lo que el
// jugador veía en ese momento: sus cartas y las de la mesa), cuánta chance de ganar la partida perdió con la que
// eligió, y qué calificación le toca. Además, la chance de ganar de cada equipo a lo largo de la partida.
// La evaluación es la de los bots (bot.js), sin faroles ni ruido y con más manos imaginadas.
// Compartido y sin DOM: corre en un Web Worker (analysis-worker.js) y en los tests.
import { evaluateDecision, winChance } from './bot.js';
import { team } from './engine.js';
import { ANALYSIS, GRADES } from './config.js';
import { handFrames } from './replay.js';
import { TRUCO_NAMES, envidoAcceptedPoints } from './engine.js';

const clone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

/** Generador al azar con semilla: el mismo análisis da siempre lo mismo. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// La opción evaluada que corresponde a lo que hizo (una carta tapada o dos encimadas cuentan como esa carta).
function chosenOption(options, a) {
  if (a.t === 'play' || a.t === 'play2') {
    const card = a.t === 'play' ? a.card : a.bottom;
    return options.find((o) => o.a?.t === 'play' && o.a.card === card);
  }
  if (a.t === 'envido') return options.find((o) => o.a?.t === 'envido' && o.a.kind === a.kind);
  return options.find((o) => o.a?.t === a.t);
}

export const gradeOf = (loss) => ANALYSIS.grades.find((g) => loss <= g.max);

const isCall = (a) => a?.t === 'truco' || a?.t === 'envido';

// Qué contestó el otro equipo al canto del cuadro i: 'fold' (no quiso o se fue al mazo), 'accept', 'raise' o null.
function answerTo(frames, i, seat) {
  for (let j = i + 1; j < frames.length; j++) {
    const f = frames[j];
    if (f.seat == null || !f.a || team(f.seat) === team(seat)) continue;
    const t = f.a.t;
    if (t === 'noquiero' || t === 'mazo') return 'fold';
    if (t === 'quiero') return 'accept';
    if (t === 'envido' || t === 'truco' || t === 'flor') return 'raise';
    return null;
  }
  return null;
}

/**
 * Calificación de una jugada. loss: chance de ganar perdida (0 a 1). gap: cuánto peor era la segunda opción.
 * strength: chance de ganar lo que se está cantando (la mano o el envido), con lo que veía. folded: no se lo quisieron.
 */
export function classify({ a, best, loss, gap, strength, folded }) {
  const S = ANALYSIS;
  const bluff = isCall(a) && strength < S.bluffStrength;
  // un canto que salió (no lo quisieron) es buena jugada: si era mentira, brillante; si no, al menos buena
  if (isCall(a) && folded) {
    if (bluff) return 'brillante';
    if (loss > S.grades[2].max) return 'buena';
    return loss <= S.grades[0].max && gap >= S.onlyMoveGap ? 'genial' : gradeOf(loss).key;
  }
  if (bluff && loss <= S.grades[0].max) return 'brillante';
  if (bluff && loss <= S.grades[3].max) return 'arriesgada';
  if (!isCall(a) && isCall(best) && strength >= 0.6 && loss >= S.missLoss) return 'perdida';
  if (loss <= S.grades[0].max && gap >= S.onlyMoveGap) return 'genial';
  return gradeOf(loss).key;
}

/**
 * Analiza las decisiones de `seats` en una mano. Devuelve una lista con un elemento por paso evaluado:
 * { frame, seat, loss, points, grade, chosen: {a, ev}, best: {a, ev}, options }. loss: chance de ganar perdida;
 * points: lo mismo en puntos de la partida. Las decisiones que no se evalúan (cantar los tantos, flor, mostrar, irse al
 * mazo) no aparecen.
 */
export function analyzeHand(hand, seats, seed = 1) {
  const rng = seeded(seed);
  const frames = handFrames(hand);
  const out = [];
  for (let i = 1; i < frames.length; i++) {
    const f = frames[i];
    if (f.seat == null || !f.a || f.step[2] || !seats.includes(f.seat)) continue; // f.step[2]: jugó un bot por él
    const ev = evaluateDecision(clone(frames[i - 1].g), f.seat, rng, { samples: ANALYSIS.samples });
    if (!ev || ev.options.length < 2) continue;
    const chosen = chosenOption(ev.options, f.a);
    if (!chosen) continue;
    const best = ev.options.reduce((x, y) => (y.ev > x.ev ? y : x));
    let points = Math.max(0, best.ev - chosen.ev);
    let loss = points * ev.slope;
    const others = ev.options.filter((o) => o !== chosen).map((o) => o.ev);
    const gap = Math.max(0, (chosen.ev - Math.max(...others)) * ev.slope);
    const folded = isCall(f.a) && answerTo(frames, i, f.seat) === 'fold';
    const strength = f.a.t === 'envido' ? ev.envidoWin : ev.handWin;
    const grade = classify({ a: f.a, best: best.a, loss, gap, strength, folded });
    // si el canto salió, no cuenta como chance perdida en la precisión (o cuenta poco, si no era mentira)
    if (folded) {
      loss = strength < ANALYSIS.bluffStrength ? 0 : Math.min(loss, ANALYSIS.grades[2].max);
      points = ev.slope ? loss / ev.slope : 0;
    }
    const before = frames[i - 1].g;
    const tr = before.h.truco;
    const ctx = { calls: before.h.envido.calls, trucoNext: TRUCO_NAMES[(tr.pending?.level ?? tr.level) + 1] };
    // lo que tenía cada opción frente a la mejor, de mejor a peor
    const ranked = ev.options.slice().sort((x, y) => y.ev - x.ev).map((o) => ({ a: o.a, cost: Math.max(0, (best.ev - o.ev) * ev.slope), mine: o === chosen }));
    const falta = f.a.t === 'envido' && f.a.kind === 'falta' ? envidoAcceptedPoints(before, ['falta'], team(f.seat)) : null;
    out.push({ frame: i, seat: f.seat, loss, points, grade, chosen, best, options: ev.options, ranked, ctx, kind: ev.kind, a: f.a, handWin: ev.handWin, envidoWin: ev.envidoWin, tanto: ev.tanto, falta });
  }
  return out;
}

const pct = (x) => `${Math.round(x * 100)}%`;

/** Por qué la jugada vale lo que vale, en una frase, con lo que el jugador podía saber en ese momento. */
export function explain(r) {
  const envido = r.a.t === 'envido' || r.kind === 'envido';
  const parts = [];
  if (envido) parts.push(`Con ${r.tanto} de tantos ganaba el envido ${pct(r.envidoWin)} de las veces.`);
  else if (r.a.t === 'truco' || r.kind === 'truco') parts.push(`Con lo que veía ganaba la mano ${pct(r.handWin)} de las veces.`);
  if (r.falta != null) parts.push(`La falta se jugaba ${r.falta} ${r.falta === 1 ? 'punto' : 'puntos'}: el rival solo la quiere si le conviene.`);
  return parts.join(' ');
}

/**
 * Chance de ganar del equipo 0 en cada cuadro de la partida, viendo todas las cartas (para el gráfico).
 * [{ hand, frame, p }], en orden.
 */
export function winSeries(handsFrames) {
  const out = [];
  handsFrames.forEach((frames, hand) => frames.forEach((f, frame) => out.push({ hand, frame, p: winChance(f.g, 0) })));
  return out;
}

/** Precisión (0 a 100) de un conjunto de decisiones analizadas. */
export function accuracy(results) {
  if (!results.length) return null;
  const s = results.reduce((a, r) => a + Math.exp(-r.loss / ANALYSIS.accuracyScale), 0);
  return Math.round((100 * s) / results.length);
}

/** Cuántas decisiones hubo de cada calificación. */
export function gradeCounts(results) {
  const c = Object.fromEntries(GRADES.map((g) => [g.key, 0]));
  for (const r of results) c[r.grade]++;
  return c;
}
