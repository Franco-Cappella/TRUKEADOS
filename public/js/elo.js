// ELO por equipos (compartido: lo usa el servidor al terminar la partida y los tests). Sin DOM.
import { ELO } from './config.js';

const expected = (mine, theirs) => 1 / (1 + 10 ** ((theirs - mine) / 400));

/**
 * players: [{ team, elo, games }] (games: partidas por ELO que ya jugó en este modo). winner: 0 o 1.
 * Devuelve la diferencia de cada uno (mismo orden). El equipo se mide por su promedio; cada uno suma con su K
 * (las primeras partidas mueven más).
 */
export function eloDeltas(players, winner) {
  const avg = [0, 1].map((t) => {
    const xs = players.filter((p) => p.team === t).map((p) => p.elo);
    return xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  });
  return players.map((p) => {
    const k = (p.games ?? 0) < ELO.newGames ? ELO.kNew : ELO.k;
    const score = p.team === winner ? 1 : 0;
    return Math.round(k * (score - expected(avg[p.team], avg[1 - p.team])));
  });
}
