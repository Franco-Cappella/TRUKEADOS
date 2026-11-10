// Partida rápida: si no aparece gente en un rato, completan la mesa rivales automáticos de un ELO parecido.
// En la mesa se ven como cualquier jugador; su fuerza depende de su ELO (botSkill en config.js).
import { MATCH, ELO, COSMETICS, cleanEquipped } from '../public/js/config.js';
import { rosterPick } from './roster.js';

const FIRST = ['mati', 'nacho', 'lucho', 'facu', 'juani', 'santi', 'tomi', 'gonza', 'pato', 'vicky', 'caro', 'sofi', 'flor', 'agus', 'maxi', 'fede', 'nico', 'rama', 'seba', 'gaby', 'lau', 'mechi', 'pau', 'cande', 'cami', 'ezequiel', 'dani', 'leo', 'ale', 'marce', 'bruno', 'joaco', 'lolo', 'negro', 'turco', 'gringo', 'tano', 'colo', 'pipi', 'chino'];
const PLACE = ['lanus', 'quilmes', 'rosario', 'cba', 'mdq', 'tucuman', 'salta', 'moron', 'tigre', 'avella', 'bahia', 'mendoza'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

const PATTERNS = [
  (f, n) => `${f}_${n % 100}`,
  (f, n) => `${f}.${1980 + (n % 28)}`,
  (f) => `${f}_truco`,
  (f) => `el${cap(f)}`,
  (f, n, p) => `${f}_${p}`,
  (f, n) => `${cap(f)}${n % 1000}`,
  (f, n, p) => `${cap(f)}De${cap(p)}`,
  (f) => `don_${f}`,
  (f, n) => `${f}${n % 10}${n % 7}`,
];

/** Nombre de usuario creíble que no esté en la mesa (válido para AUTH.usernameRe: 3 a 20 caracteres). */
export function rivalName(rng, used = new Set()) {
  for (let i = 0; i < 30; i++) {
    const f = FIRST[Math.floor(rng() * FIRST.length)];
    const p = PLACE[Math.floor(rng() * PLACE.length)];
    const name = PATTERNS[Math.floor(rng() * PATTERNS.length)](f, Math.floor(rng() * 10000), p).slice(0, 20);
    if (!used.has(name)) return name;
  }
  return `jugador_${Math.floor(rng() * 100000)}`;
}

/** ELO cercano al de la mesa: casi siempre parecido, a veces un poco más lejos. */
export function rivalElo(base, rng) {
  const spread = ((rng() + rng() + rng()) / 3 - 0.5) * 2 * MATCH.eloSpread * 1.6;
  return Math.max(ELO.floor, Math.round(base + spread));
}

// Algunos tienen cosas de la tienda, como cualquiera que ya jugó un poco.
function rivalCos(rng) {
  const cos = {};
  for (const slot of ['ropa', 'gorro', 'anteojos', 'objeto']) {
    if (rng() > MATCH.cosmeticChance) continue;
    const items = COSMETICS.filter((c) => c.slot === slot);
    cos[slot] = items[Math.floor(rng() * items.length)].id;
  }
  return cleanEquipped(cos);
}

// Siempre que se pueda, uno de los usuarios del plantel (los del ranking).
export function rivalSeat(base, rng, used, mode = '1v1') {
  const p = rosterPick(base, MATCH.eloSpread * 1.6, mode, rng, used);
  if (p) return { bot: true, disguised: true, recent: fakeRecent(rng, mode), name: p.username, elo: p[`elo_${mode}`], cos: rivalCos(rng) };
  return { bot: true, disguised: true, recent: fakeRecent(rng, mode), name: rivalName(rng, used), elo: rivalElo(base, rng), cos: rivalCos(rng) };
}

/** Lo que tarda en aparecer el próximo rival (el primero tarda más: se está buscando). */
export const nextRivalIn = (first, rng) => (first ? MATCH.waitMin + rng() * MATCH.waitRand : MATCH.gapMin + rng() * MATCH.gapRand);

// Las últimas partidas de un rival automático (como las de una persona: si no, se notaría que es un bot).
export function fakeRecent(rng, mode) {
  const target = rng() < 0.5 ? 15 : 30;
  return Array.from({ length: 3 }, (_, i) => {
    const won = rng() < 0.52;
    const loser = Math.floor(rng() * (target - 2));
    const delta = Math.round((6 + rng() * 14) * (won ? 1 : -1));
    return { won, mode, score: won ? [target, loser] : [loser, target], delta, at: new Date(Date.now() - (i + 1) * (3 + rng() * 40) * 3600e3).toISOString() };
  });
}
