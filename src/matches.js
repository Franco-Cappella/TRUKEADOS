// Partidas terminadas: ELO, monedas e historial en la base de Supabase (tablas matches y match_players,
// función record_match en supabase/migrations). Lo usa la sala al terminar y las rutas /api/matches.
import { COINS, HISTORY_PAGE } from '../public/js/config.js';
import { eloDeltas } from '../public/js/elo.js';
import { team } from '../public/js/engine.js';
import { rest, forgetProfile } from './auth.js';

/**
 * Guarda una partida terminada y actualiza ELO y monedas. meta: lo de MatchRecorder; game: el estado final.
 * Devuelve { id, players: [{ seat, eloBefore, eloDelta, coins }] } para avisarle a cada uno.
 */
export async function recordMatch(env, meta, log, game) {
  const winner = game.winner;
  const humans = meta.seats.map((s, seat) => ({ ...s, seat })).filter((s) => s.uid);
  if (!humans.length) return null;

  // ELO de ahora (sin caché: puede haber cambiado en otra partida)
  const ids = humans.map((s) => s.uid);
  const res = await rest(env, `profiles?id=in.(${ids.join(',')})&select=id,elo_${meta.mode},games_${meta.mode}`);
  if (!res.ok) throw new Error('No se pudieron leer los perfiles');
  const prof = new Map((await res.json()).map((p) => [p.id, p]));

  const players = humans.map((s) => ({
    user_id: s.uid,
    seat: s.seat,
    team: team(s.seat),
    won: team(s.seat) === winner,
    elo_before: prof.get(s.uid)?.[`elo_${meta.mode}`] ?? null,
    games: prof.get(s.uid)?.[`games_${meta.mode}`] ?? 0,
  }));
  const deltas = meta.rated ? eloDeltas(players.map((p) => ({ team: p.team, elo: p.elo_before, games: p.games })), winner) : players.map(() => 0);
  const factor = meta.rated ? 1 : COINS.botFactor;
  players.forEach((p, i) => {
    p.elo_delta = deltas[i];
    p.coins = Math.round((COINS.game + (p.won ? COINS.win : 0)) * factor);
    delete p.games;
  });

  const body = {
    room_code: meta.code,
    mode: meta.mode,
    target: meta.target,
    options: meta.options,
    rated: meta.rated,
    winner_team: winner,
    score: game.score,
    hands: log.hands.length,
    seats: meta.seats,
    log,
    started_at: meta.startedAt,
    players,
  };
  const r = await rest(env, 'rpc/record_match', { method: 'POST', body: JSON.stringify({ m: body }) });
  if (!r.ok) throw new Error('No se pudo guardar la partida: ' + (await r.text()).slice(0, 200));
  const id = await r.json();
  ids.forEach(forgetProfile);
  return {
    id,
    players: players.map((p) => ({ seat: p.seat, eloBefore: meta.rated ? p.elo_before : null, eloDelta: p.elo_delta, coins: p.coins })),
  };
}

const LIST_FIELDS = 'seat,team,won,elo_before,elo_after,coins,ended_at,match:matches(id,mode,target,options,rated,winner_team,score,hands,seats,started_at)';

/** Historial de un jugador, de la más nueva a la más vieja. before: ended_at de la última que ya tiene. */
export async function listMatches(env, userId, before) {
  const older = before && !Number.isNaN(Date.parse(before)) ? `&ended_at=lt.${encodeURIComponent(new Date(before).toISOString())}` : '';
  const res = await rest(env, `match_players?user_id=eq.${userId}${older}&select=${LIST_FIELDS}&order=ended_at.desc&limit=${HISTORY_PAGE}`);
  if (!res.ok) throw new Error('No se pudo leer el historial');
  return res.json();
}

/** Una partida con su registro, solo si el jugador estuvo sentado en ella. */
export async function getMatch(env, userId, id) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const mine = await rest(env, `match_players?match_id=eq.${id}&user_id=eq.${userId}&select=seat,won,elo_before,elo_after,coins`);
  const me = mine.ok ? (await mine.json())[0] : null;
  if (!me) return null;
  const res = await rest(env, `matches?id=eq.${id}&select=*`);
  const match = res.ok ? (await res.json())[0] : null;
  return match ? { ...match, me } : null;
}
