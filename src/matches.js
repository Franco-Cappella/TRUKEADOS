// Partidas terminadas: ELO, monedas e historial en la base de Supabase (tablas matches y match_players,
// función record_match en supabase/migrations). Lo usa la sala al terminar y las rutas /api/matches.
import { COINS, ELO_START, HISTORY_PAGE } from '../public/js/config.js';
import { eloDeltas, milestoneCoins } from '../public/js/elo.js';
import { team } from '../public/js/engine.js';
import { rest, forgetProfile } from './auth.js';

/**
 * Guarda una partida terminada y actualiza ELO y monedas. meta: lo de MatchRecorder; game: el estado final.
 * Devuelve { id, players: [{ seat, eloBefore, eloDelta, coins, milestone }] } para avisarle a cada uno.
 */
export async function recordMatch(env, meta, log, game) {
  const winner = game.winner;
  const seats = meta.seats.map((s, seat) => ({ ...s, seat }));
  const humans = seats.filter((s) => s.uid);
  if (!humans.length) return null;

  // ELO de ahora (sin caché: puede haber cambiado en otra partida). Todas las columnas: elo_peak puede no existir.
  const ids = humans.map((s) => s.uid);
  const res = await rest(env, `profiles?id=in.(${ids.join(',')})&select=*`);
  if (!res.ok) throw new Error('No se pudieron leer los perfiles');
  const prof = new Map((await res.json()).map((p) => [p.id, p]));

  const players = humans.map((s) => ({
    user_id: s.uid,
    seat: s.seat,
    team: team(s.seat),
    won: team(s.seat) === winner,
    elo_before: prof.get(s.uid)?.[`elo_${meta.mode}`] ?? ELO_START,
    games: prof.get(s.uid)?.[`games_${meta.mode}`] ?? 0,
  }));
  // los rivales automáticos de la partida rápida cuentan con su ELO para el promedio del equipo
  const rivals = seats.filter((s) => s.disguised).map((s) => ({ team: team(s.seat), elo: s.elo ?? ELO_START, games: 999 }));
  const deltas = meta.rated
    ? eloDeltas([...players.map((p) => ({ team: p.team, elo: p.elo_before, games: p.games })), ...rivals], winner).slice(0, players.length)
    : players.map(() => 0);
  const factor = meta.rated ? 1 : COINS.botFactor;
  const peaks = [];
  players.forEach((p, i) => {
    p.elo_delta = deltas[i];
    p.coins = p.won ? Math.round((COINS.game + COINS.win) * factor) : 0; // monedas solo si ganás
    p.milestone = 0;
    const row = prof.get(p.user_id);
    // sin la columna elo_peak (migración pendiente) no hay premio: no se puede saber si ya lo cobró
    if (meta.rated && row && 'elo_peak' in row) {
      const peak = row.elo_peak ?? Math.max(row.elo_1v1 ?? 0, row.elo_2v2 ?? 0, row.elo_3v3 ?? 0);
      const now = p.elo_before + p.elo_delta;
      p.milestone = milestoneCoins(peak, now, COINS.milestoneStep, COINS.milestone);
      p.coins += p.milestone;
      if (now > peak) peaks.push([p.user_id, now]);
    }
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
  await Promise.all(peaks.map(([uid, elo]) => rest(env, `profiles?id=eq.${uid}`, { method: 'PATCH', body: JSON.stringify({ elo_peak: elo }) }).catch(() => null)));
  ids.forEach(forgetProfile);
  return {
    id,
    players: players.map((p) => ({ seat: p.seat, eloBefore: meta.rated ? p.elo_before : null, eloDelta: p.elo_delta, coins: p.coins, milestone: p.milestone })),
  };
}

// Lo que sabe el servidor de cada asiento y el navegador no necesita.
const clientSeats = (seats) => (seats || []).map(({ disguised, ...s }) => (disguised ? { ...s, bot: false } : s));
const forClient = (m) => (m ? { ...m, seats: clientSeats(m.seats), ...(m.log ? { log: { ...m.log, seats: clientSeats(m.log.seats) } } : {}) } : m);

const LIST_FIELDS = 'seat,team,won,elo_before,elo_after,coins,ended_at,match:matches(id,mode,target,options,rated,winner_team,score,hands,seats,started_at)';

/** Historial de un jugador, de la más nueva a la más vieja. before: ended_at de la última que ya tiene. */
export async function listMatches(env, userId, before) {
  const older = before && !Number.isNaN(Date.parse(before)) ? `&ended_at=lt.${encodeURIComponent(new Date(before).toISOString())}` : '';
  const res = await rest(env, `match_players?user_id=eq.${userId}${older}&select=${LIST_FIELDS}&order=ended_at.desc&limit=${HISTORY_PAGE}`);
  if (!res.ok) throw new Error('No se pudo leer el historial');
  return (await res.json()).map((r) => ({ ...r, match: forClient(r.match) }));
}

// Una fila de match_players -> lo que se muestra en el cartel de la mesa.
export const recentRow = (r) => {
  const m = r.match || {};
  const score = Array.isArray(m.score) ? m.score : [0, 0];
  const t = r.team ?? 0;
  return {
    won: !!r.won,
    mode: m.mode || null,
    score: [score[t] ?? 0, score[1 - t] ?? 0],
    delta: m.rated && r.elo_after != null && r.elo_before != null ? r.elo_after - r.elo_before : null,
    at: r.ended_at || null,
  };
};

/** Las últimas n partidas de alguien, para el cartel de la mesa: [{ won, mode, score: [suyos, rivales], delta, at }]. */
export async function recentMatches(env, userId, n = 3) {
  const res = await rest(env, `match_players?user_id=eq.${userId}&select=team,won,elo_before,elo_after,ended_at,match:matches(mode,rated,score)&order=ended_at.desc&limit=${n}`);
  if (!res.ok) return [];
  return (await res.json()).map(recentRow);
}

// ------------------------------------------------------------------ compartir (tabla match_shares)

const SHARE_RE = /^[A-Za-z0-9_-]{16,32}$/;
// Sin ids de cuentas: el enlace lo puede abrir cualquiera.
const anonSeats = (seats) => (seats || []).map(({ uid, ...s }) => s);
const newShareId = () => {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/**
 * El enlace para compartir una partida (lo pide uno que la jugó; se ve desde su lugar). Siempre el mismo por jugador
 * y partida. Devuelve la clave, o null si no la jugó.
 */
export async function shareMatch(env, userId, id) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const mine = await rest(env, `match_players?match_id=eq.${id}&user_id=eq.${userId}&select=seat`);
  const me = mine.ok ? (await mine.json())[0] : null;
  if (!me) return null;
  const had = await rest(env, `match_shares?match_id=eq.${id}&user_id=eq.${userId}&select=id`);
  if (!had.ok) throw new Error('No se pudo compartir la partida (¿falta la migración compartir_partidas?)');
  const old = (await had.json())[0];
  if (old) return old.id;
  const share = newShareId();
  const res = await rest(env, 'match_shares', {
    method: 'POST',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify({ id: share, match_id: id, user_id: userId, seat: me.seat }),
  });
  if (res.ok) return share;
  // dos pedidos a la vez: ganó el otro, se usa ese
  const again = await rest(env, `match_shares?match_id=eq.${id}&user_id=eq.${userId}&select=id`);
  const row = again.ok ? (await again.json())[0] : null;
  if (row) return row.id;
  throw new Error('No se pudo compartir la partida');
}

/** Una partida compartida, para cualquiera que tenga el enlace: sin ids de cuentas ni de la partida. */
export async function getShared(env, share) {
  if (!SHARE_RE.test(share || '')) return null;
  const res = await rest(env, `match_shares?id=eq.${share}&select=seat,match:matches(mode,target,options,rated,winner_team,score,hands,seats,log,started_at,ended_at)`);
  const row = res.ok ? (await res.json())[0] : null;
  const m = row?.match;
  if (!m) return null;
  const c = forClient(m);
  return {
    ...c,
    seats: anonSeats(c.seats),
    log: { ...c.log, seats: anonSeats(c.log?.seats) },
    me: { seat: row.seat, won: team(row.seat) === m.winner_team },
    shared: { id: share, by: m.seats?.[row.seat]?.name || null },
  };
}

/** Una partida con su registro, solo si el jugador estuvo sentado en ella. */
export async function getMatch(env, userId, id) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const mine = await rest(env, `match_players?match_id=eq.${id}&user_id=eq.${userId}&select=seat,won,elo_before,elo_after,coins`);
  const me = mine.ok ? (await mine.json())[0] : null;
  if (!me) return null;
  const res = await rest(env, `matches?id=eq.${id}&select=*`);
  const match = res.ok ? (await res.json())[0] : null;
  return match ? { ...forClient(match), me } : null;
}
