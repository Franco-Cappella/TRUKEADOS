// ELO por equipos (compartido: lo usa el servidor al terminar la partida y los tests). Sin DOM.
// Como en chess.com: al principio el sistema no sabe tu nivel y cada partida mueve mucho; a medida que juega
// te ubica y el número varía poco. Es la idea de la "desviación" de Glicko, con las partidas jugadas como medida.
import { ELO } from './config.js';

const expected = (mine, theirs) => 1 / (1 + 10 ** ((theirs - mine) / 400));

/** Cuánto mueve una partida a alguien que ya jugó `games`. */
export const eloK = (games = 0) => ELO.kMin + (ELO.kStart - ELO.kMin) * Math.exp(-games / ELO.settle);

/**
 * players: [{ team, elo, games }] (games: partidas por ELO que ya jugó en este modo). winner: 0 o 1.
 * Devuelve la diferencia de cada uno (mismo orden). El equipo se mide por su promedio; cada uno suma con su K.
 * Nadie baja de ELO.floor.
 */
export function eloDeltas(players, winner) {
  const avg = [0, 1].map((t) => {
    const xs = players.filter((p) => p.team === t).map((p) => p.elo);
    return xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  });
  return players.map((p) => {
    const score = p.team === winner ? 1 : 0;
    const d = Math.round(eloK(p.games) * (score - expected(avg[p.team], avg[1 - p.team])));
    return Math.max(d, ELO.floor - p.elo);
  });
}

/** Monedas por pasar escalones de ELO que nunca habías alcanzado. peak: tu récord hasta ahora. */
export function milestoneCoins(peak, elo, step, reward) {
  const steps = Math.floor(elo / step) - Math.floor(peak / step);
  return steps > 0 ? steps * reward : 0;
}

/**
 * Cuántas partidas por ELO ya jugaron uno contra otro alguien de `teamA` y alguien de `teamB` (ids de cuenta),
 * según `rows`: las filas de match_players de los de `teamA`, con su partida ({ match_id, team, match: { seats } }).
 * El equipo de cada asiento es asiento % 2. Cada partida cuenta una vez.
 */
export function rematchCount(rows, teamA, teamB) {
  const a = new Set(teamA);
  const b = new Set(teamB);
  const ids = new Set();
  for (const r of rows || []) {
    if (!a.has(r.user_id)) continue;
    const seats = r.match?.seats || [];
    if (seats.some((s, i) => s?.uid && b.has(s.uid) && i % 2 !== r.team)) ids.add(r.match_id);
  }
  return ids.size;
}
