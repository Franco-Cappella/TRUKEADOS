// Mesas en juego para el lobby: partidas entre usuarios automáticos que se pueden mirar. Mientras nadie mira, la
// partida no corre de verdad (no gasta nada): el Lobby calcula cómo va el tanteador según pasa el tiempo. Cuando
// alguien entra a mirar, la sala se arma con ese tanteador y se juega en serio.
import { SHOW_TABLES, MODES } from '../public/js/config.js';
import { rivalSeat } from './matchmaking.js';

function pickMode(rng) {
  const r = rng();
  return r < SHOW_TABLES.share1v1 ? '1v1' : r < SHOW_TABLES.share1v1 + SHOW_TABLES.share2v2 ? '2v2' : '3v3';
}

/**
 * Una mesa nueva, con un código que no esté en `taken` (los códigos que empiezan con 9 son solo de estas mesas) y
 * jugadores que no estén en otra mesa (`busy`: los nombres que ya están jugando).
 */
export function newShowTable(rng, now, taken = new Set(), busy = new Set()) {
  let code;
  do code = SHOW_TABLES.codePrefix + String(Math.floor(rng() * 1000)).padStart(3, '0');
  while (taken.has(code));
  const mode = pickMode(rng);
  const target = rng() < 0.7 ? 30 : 15;
  const elo = 600 + Math.floor(rng() * 1300);
  const used = new Set(busy);
  const seats = Array.from({ length: MODES[mode] }, () => {
    const s = rivalSeat(elo, rng, used, mode);
    used.add(s.name);
    return s;
  });
  // ya viene empezada: no parece que todas arrancaron juntas
  const start = [0, 1].map(() => Math.floor(rng() * target * 0.55));
  return { code, mode, target, seats, score: start, at: now, pace: SHOW_TABLES.paceMin + rng() * SHOW_TABLES.paceRand, seed: Math.floor(rng() * 1e9) };
}

/** Cómo va la mesa en este momento: determinístico, así todos ven lo mismo. */
export function scoreAt(t, now) {
  const score = t.score.slice();
  let seed = t.seed;
  const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const steps = Math.floor(Math.max(0, now - t.at) / t.pace);
  for (let i = 0; i < steps && Math.max(...score) < t.target; i++) {
    const who = next() < 0.5 ? 0 : 1;
    score[who] = Math.min(t.target, score[who] + 1 + Math.floor(next() * 3));
  }
  return score;
}

export const isOver = (t, now) => Math.max(...scoreAt(t, now)) >= t.target;

/** Las mesas sin jugadores repetidos: si una tiene a alguien que ya juega en otra anterior, se saca (se arma otra). */
export function uniquePlayers(tables) {
  const seen = new Set();
  return tables.filter((t) => {
    const names = t.seats.map((s) => s.name);
    if (names.some((n) => seen.has(n))) return false;
    names.forEach((n) => seen.add(n));
    return true;
  });
}

// Cuántas mesas tiene que haber ahora: cambia cada tanto entre el mínimo y el máximo.
export function wantedTables(now) {
  const span = SHOW_TABLES.max - SHOW_TABLES.min + 1;
  const slot = Math.floor(now / SHOW_TABLES.refreshMs);
  return SHOW_TABLES.min + (Math.imul(slot, 2654435761) >>> 16) % span;
}

/** Lo que muestra el menú de una mesa. */
export const showSummary = (t, now) => ({ code: t.code, mode: t.mode, target: t.target, status: 'playing', isPublic: true, players: t.seats.map((s) => s.name), score: scoreAt(t, now), options: '', updatedAt: t.at });
