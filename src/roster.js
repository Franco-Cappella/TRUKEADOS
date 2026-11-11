// Los usuarios automáticos: siempre los mismos nombres, con su ELO y sus partidas. Juegan las mesas del lobby y la
// partida rápida, y aparecen en el ranking. Determinístico (no hay nada guardado): cambia un poco cada día.
import { MODES } from '../public/js/config.js';
import { rivalName } from './matchmaking.js';

const SIZE = 240; // alcanza para todas las mesas en juego sin repetir a nadie (y para el ranking)
const EPOCH = Date.UTC(2026, 10, 1);
const DAY = 86_400_000;
const modes = Object.keys(MODES);

let base = null;

function build() {
  let seed = 20261101;
  const rng = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const used = new Set();
  base = Array.from({ length: SIZE }, (_, i) => {
    const username = rivalName(rng, used);
    used.add(username);
    const skill = 1250 + ((rng() + rng() + rng() + rng()) / 4 - 0.5) * 2 * 1050; // de ~300 a ~2300, la mayoría en el medio
    return {
      id: `r${i}`,
      username,
      phase: rng() * 6.28,
      modes: Object.fromEntries(modes.map((m, k) => [m, { elo: Math.round(Math.max(420, skill + (rng() - 0.5) * 140)), games: Math.round(30 + rng() * 600 * (1 - k * 0.3)), perDay: rng() * 6 }])),
    };
  });
}

/** El plantel de hoy, con la misma forma que publicCard (social.js). */
export function rosterAt(now = Date.now()) {
  if (!base) build();
  const day = Math.max(0, Math.floor((now - EPOCH) / DAY));
  return base.map((p) => {
    const card = { id: p.id, username: p.username, avatar: null };
    for (const m of modes) {
      const s = p.modes[m];
      card[`elo_${m}`] = Math.round(s.elo + 28 * Math.sin(day / 4 + p.phase) + 9 * Math.sin(day / 17 + p.phase * 2));
      card[`games_${m}`] = Math.round(s.games + s.perDay * day);
    }
    return card;
  });
}

/** Uno del plantel con ELO cercano y un nombre que no esté en la mesa (null si no hay). */
export function rosterPick(elo, spread, mode, rng, used, now = Date.now()) {
  const near = rosterAt(now).filter((p) => Math.abs(p[`elo_${mode}`] - elo) <= spread && !used.has(p.username));
  return near.length ? near[Math.floor(rng() * near.length)] : null;
}
