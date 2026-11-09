// Lo social: foto de perfil, amigos por nombre de usuario y ranking. Si la migración 20261109000000_social todavía
// no se aplicó, leer devuelve vacío y escribir avisa, sin romper el resto del juego.
import { AUTH, AVATAR, MODES, ELO_START, RANKING_SIZE } from '../public/js/config.js';
import { rest, forgetProfile } from './auth.js';
import { rosterAt } from './roster.js';

const NOT_READY = 'Esta función todavía se está activando. Probá de nuevo en un rato.';
const UUID = /^[0-9a-f-]{36}$/;
const isMissing = (res) => res.status === 404 || res.status === 400;

/** Lo que cualquiera puede ver de un jugador. */
export function publicCard(p) {
  const out = { id: p.id, username: p.username, avatar: p.avatar || null };
  for (const m of Object.keys(MODES)) {
    out[`elo_${m}`] = p[`elo_${m}`] ?? ELO_START;
    out[`games_${m}`] = p[`games_${m}`] ?? 0;
  }
  return out;
}

/** Los bytes de un GIF válido en base64, o null si no lo es o pesa demasiado. */
export function parseGif(dataUrl) {
  if (typeof dataUrl !== 'string' || dataUrl.length > AVATAR.gifMaxBytes * 1.4 || !AVATAR.gifRe.test(dataUrl)) return null;
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  let bin;
  try {
    bin = atob(b64);
  } catch {
    return null;
  }
  if (bin.length > AVATAR.gifMaxBytes || !/^GIF8[79]a/.test(bin.slice(0, 6))) return null;
  return b64;
}

const dropGif = (env, uid) => rest(env, `avatar_gifs?user_id=eq.${uid}`, { method: 'DELETE' }).catch(() => null);

/** El GIF de alguien, para servirlo. null si no tiene. */
export async function avatarGif(env, uid) {
  const res = await rest(env, `avatar_gifs?user_id=eq.${uid}&select=data`);
  if (!res.ok) return null;
  const row = (await res.json())[0];
  return row ? Uint8Array.from(atob(row.data), (c) => c.charCodeAt(0)) : null;
}

async function setGif(env, uid, dataUrl) {
  const data = parseGif(dataUrl);
  if (!data) return { error: 'Ese GIF no sirve o pesa más de 800 KB' };
  const up = await rest(env, 'avatar_gifs?on_conflict=user_id', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ user_id: uid, data, updated_at: new Date().toISOString() }) });
  if (!up.ok) return { error: NOT_READY };
  // la foto del perfil pasa a ser la dirección del GIF: así todas las pantallas lo muestran sin cargar el archivo
  const avatar = `/api/avatars/${uid}?v=${Date.now()}`;
  const res = await rest(env, `profiles?id=eq.${uid}`, { method: 'PATCH', body: JSON.stringify({ avatar }) });
  if (!res.ok) return { error: NOT_READY };
  forgetProfile(uid);
  return { avatar };
}

/** { avatar } o { error }. avatar null borra la foto. */
export async function setAvatar(env, uid, avatar) {
  if (typeof avatar === 'string' && avatar.startsWith('data:image/gif')) return setGif(env, uid, avatar);
  if (avatar !== null && (typeof avatar !== 'string' || avatar.length > AVATAR.maxChars || !AVATAR.re.test(avatar))) {
    return { error: 'Esa imagen no sirve: probá con otra' };
  }
  const res = await rest(env, `profiles?id=eq.${uid}`, { method: 'PATCH', body: JSON.stringify({ avatar }) });
  if (!res.ok) return { error: NOT_READY };
  await dropGif(env, uid);
  forgetProfile(uid);
  return { avatar };
}

const pair = (a, b) => (a < b ? [a, b] : [b, a]);

async function profilesById(env, ids) {
  if (!ids.length) return new Map();
  const res = await rest(env, `profiles?id=in.(${ids.join(',')})&select=*`);
  if (!res.ok) return new Map();
  return new Map((await res.json()).map((p) => [p.id, publicCard(p)]));
}

/** { friends, incoming, outgoing }. Cada uno con los datos públicos del otro. */
export async function listFriends(env, uid) {
  const empty = { friends: [], incoming: [], outgoing: [] };
  const res = await rest(env, `friendships?or=(user_a.eq.${uid},user_b.eq.${uid})&select=*&order=created_at.desc`);
  if (!res.ok) {
    if (isMissing(res)) return empty;
    throw new Error('No se pudo leer la lista de amigos');
  }
  const rows = await res.json();
  const other = (r) => (r.user_a === uid ? r.user_b : r.user_a);
  const cards = await profilesById(env, rows.map(other));
  for (const r of rows) {
    const card = cards.get(other(r));
    if (!card) continue;
    if (r.status === 'accepted') empty.friends.push(card);
    else (r.requested_by === uid ? empty.outgoing : empty.incoming).push(card);
  }
  empty.friends.sort((a, b) => a.username.localeCompare(b.username, 'es'));
  return empty;
}

/** Solicitud por nombre de usuario. Si el otro ya te la había mandado, quedan amigos. { ok, status } o { error }. */
export async function requestFriend(env, uid, username) {
  const name = String(username ?? '').trim();
  if (!AUTH.usernameRe.test(name)) return { error: 'Escribí el nombre de usuario completo' };
  // ilike toma "_" como comodín: se confirma el nombre exacto
  const found = await rest(env, `profiles?username=ilike.${encodeURIComponent(name)}&select=id,username`);
  if (!found.ok) throw new Error('No se pudo buscar a esa persona');
  const target = (await found.json()).find((p) => p.username.toLowerCase() === name.toLowerCase());
  if (!target) return { error: 'No hay nadie con ese nombre' };
  if (target.id === uid) return { error: 'Sos vos' };

  const [a, b] = pair(uid, target.id);
  const cur = await rest(env, `friendships?user_a=eq.${a}&user_b=eq.${b}&select=*`);
  if (!cur.ok) return { error: NOT_READY };
  const row = (await cur.json())[0];
  if (row?.status === 'accepted') return { error: 'Ya son amigos' };
  if (row?.requested_by === uid) return { error: 'Ya le mandaste una solicitud' };
  if (row) {
    await accept(env, a, b);
    return { ok: true, status: 'accepted' };
  }
  const res = await rest(env, 'friendships', { method: 'POST', body: JSON.stringify({ user_a: a, user_b: b, requested_by: uid }) });
  if (!res.ok) return { error: NOT_READY };
  return { ok: true, status: 'pending' };
}

function accept(env, a, b) {
  return rest(env, `friendships?user_a=eq.${a}&user_b=eq.${b}`, { method: 'PATCH', body: JSON.stringify({ status: 'accepted' }) });
}

/** Aceptar o rechazar una solicitud que te mandaron. */
export async function respondFriend(env, uid, otherId, yes) {
  if (!UUID.test(String(otherId))) return { error: 'Solicitud inválida' };
  const [a, b] = pair(uid, otherId);
  if (!yes) return removeFriend(env, uid, otherId);
  const res = await rest(env, `friendships?user_a=eq.${a}&user_b=eq.${b}&requested_by=eq.${otherId}&status=eq.pending`, {
    method: 'PATCH',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify({ status: 'accepted' }),
  });
  if (!res.ok) return { error: NOT_READY };
  return (await res.json()).length ? { ok: true } : { error: 'Esa solicitud ya no está' };
}

/** Sacar a un amigo, cancelar o rechazar una solicitud. */
export async function removeFriend(env, uid, otherId) {
  if (!UUID.test(String(otherId))) return { error: 'Solicitud inválida' };
  const [a, b] = pair(uid, otherId);
  const res = await rest(env, `friendships?user_a=eq.${a}&user_b=eq.${b}`, { method: 'DELETE' });
  return res.ok ? { ok: true } : { error: NOT_READY };
}

/** Personas y usuarios automáticos juntos, de mayor a menor ELO. */
export function mergeRanking(real, mode, now = Date.now()) {
  const key = `elo_${mode}`;
  return [...real, ...rosterAt(now)].sort((a, b) => b[key] - a[key]).slice(0, RANKING_SIZE);
}

/** ¿Son amigos de verdad? (para que no se pueda invitar a cualquiera) */
export async function areFriends(env, a, b) {
  if (!UUID.test(String(b))) return false;
  const [x, y] = pair(a, b);
  const res = await rest(env, `friendships?user_a=eq.${x}&user_b=eq.${y}&status=eq.accepted&select=user_a`);
  return res.ok && (await res.json()).length > 0;
}

/** Los mejores de un modo (solo quien jugó alguna partida por ELO). */
export async function ranking(env, mode) {
  const m = MODES[mode] ? mode : Object.keys(MODES)[0];
  const res = await rest(env, `profiles?games_${m}=gt.0&select=*&order=elo_${m}.desc&limit=${RANKING_SIZE}`);
  if (!res.ok) throw new Error('No se pudo leer el ranking');
  return { mode: m, players: mergeRanking((await res.json()).map(publicCard), m) };
}
