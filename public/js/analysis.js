// Análisis post-partida, al estilo de los de ajedrez: para cada decisión de un jugador, cuánto valía cada opción
// (con lo que él veía en ese momento: sus cartas y las de la mesa) y cuánto perdió con la que eligió. La evaluación
// es la de los bots (bot.js, evaluateDecision), sin faroles ni ruido y con más manos imaginadas.
// Compartido y sin DOM: corre en un Web Worker (analysis-worker.js) y en los tests.
import { evaluateDecision } from './bot.js';
import { ANALYSIS } from './config.js';
import { handFrames } from './replay.js';

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

/**
 * Analiza las decisiones de `seats` en una mano. Devuelve una lista con un elemento por paso evaluado:
 * { frame, seat, loss, grade, chosen: {a, ev}, best: {a, ev}, options }. Las decisiones que no se evalúan
 * (cantar los tantos, flor, mostrar, irse al mazo) no aparecen.
 */
export function analyzeHand(hand, seats, seed = 1) {
  const rng = seeded(seed);
  const frames = handFrames(hand);
  const out = [];
  for (let i = 1; i < frames.length; i++) {
    const f = frames[i];
    if (f.seat == null || !f.a || f.step[2] || !seats.includes(f.seat)) continue; // f.step[2]: jugó un bot por él
    const ev = evaluateDecision(clone(frames[i - 1].g), f.seat, rng, { samples: ANALYSIS.samples, honest: true });
    if (!ev || ev.options.length < 2) continue;
    const chosen = chosenOption(ev.options, f.a);
    if (!chosen) continue;
    const best = ev.options.reduce((x, y) => (y.ev > x.ev ? y : x));
    const loss = Math.max(0, best.ev - chosen.ev);
    out.push({ frame: i, seat: f.seat, loss, grade: gradeOf(loss).key, chosen, best, options: ev.options });
  }
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
  const c = Object.fromEntries(ANALYSIS.grades.map((g) => [g.key, 0]));
  for (const r of results) c[r.grade]++;
  return c;
}
