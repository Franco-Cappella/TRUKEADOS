// Worker: rutas /api. Los archivos estáticos (public/) los sirve Cloudflare directamente;
// /sala/CÓDIGO cae en index.html por "single-page-application" (ver wrangler.jsonc).
// Todo lo que sea jugar pide sesión de Supabase (ver auth.js): el jugador es el id de su cuenta y su nombre,
// el del perfil. El navegador ya no elige ni su identificador ni su nombre.
import { TrucoRoom } from './truco-room.js';
import { Lobby } from './lobby.js';
import { newRoomCode, json } from './util.js';
import { requireUser, createProfile, renameProfile } from './auth.js';
import { listMatches, getMatch, shareMatch, getShared } from './matches.js';
import { ownedItems, buyItem, equipItem } from './shop.js';
import { areFriends, setAvatar, setLook, avatarGif, listFriends, requestFriend, respondFriend, removeFriend, ranking, publicProfile } from './social.js';
import { recentMatches } from './matches.js';
import { exportData, deleteAccount } from './account.js';
import { fakeRecent } from './matchmaking.js';
import { MODES, DEFAULT_MODE, DEFAULT_TARGET, TARGETS, ELO_START, SHOW_TABLES, roomOptions } from '../public/js/config.js';

export { TrucoRoom, Lobby };

// Lo que ve el jugador si un pedido falla del lado del servidor (la base no responde o rechaza su clave).
// El motivo técnico queda en los logs del Worker (ver docs/CUENTAS.md).
const SERVER_DOWN = 'No pudimos completar el pedido: el servidor o la base de datos no responden. Probá de nuevo en un rato.';

const lobbyStub = (env) => env.LOBBY.get(env.LOBBY.idFromName('global'));
const roomStub = (env, code) => env.TRUCO_ROOM.get(env.TRUCO_ROOM.idFromName('truco:' + code));
const pickMode = (m) => (MODES[m] ? m : DEFAULT_MODE);

async function createRoom(env, opts) {
  for (let i = 0; i < 30; i++) { // con 4 dígitos puede tocar uno ocupado: se prueba otro
    const code = newRoomCode();
    if ((await roomStub(env, code).create({ code, ...opts })).ok) return code;
  }
  throw new Error('No se pudo crear la sala');
}

// Jugador logueado y con perfil, más el cuerpo del pedido. Si falta la sesión, { error: Response }.
async function readPlayer(env, request) {
  const auth = await requireUser(env, request);
  if (auth.error) return auth;
  const body = await request.json().catch(() => ({}));
  return { body, pid: auth.user.id, name: auth.profile.username, profile: auth.profile };
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (err) {
      // antes, un error no atrapado era un 500 mudo: el navegador lo tomaba como "no hay sesión" y volvía a la entrada
      console.error('Error del servidor:', err?.message ?? err);
      return json({ error: SERVER_DOWN }, 503);
    }
  },
};

async function handle(request, env) {
  const path = new URL(request.url).pathname;
  const method = request.method;

  // lo público del proyecto de Supabase, para que el navegador pueda iniciar sesión
  if (path === '/api/config' && method === 'GET') {
    return json({ supabaseUrl: env.SUPABASE_URL || '', supabaseKey: env.SUPABASE_PUBLISHABLE_KEY || '' });
  }

  // los GIF de perfil: públicos, como cualquier foto de perfil
  const gif = path.match(/^\/api\/avatars\/([0-9a-f-]{36})$/);
  if (gif && method === 'GET') {
    const bytes = await avatarGif(env, gif[1]);
    if (!bytes) return new Response('No encontrado', { status: 404 });
    return new Response(bytes, { headers: { 'content-type': 'image/gif', 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff' } });
  }

  if (path === '/api/me' && method === 'GET') {
    // sin caché: el menú lo pide al volver de una partida, con el ELO y las monedas nuevos
    const auth = await requireUser(env, request, { allowNoProfile: true, fresh: true });
    return auth.error || json({ user: auth.user, profile: auth.profile });
  }

  // primera vez: elegir el nombre con el que aparece en la mesa y en el ranking
  if (path === '/api/me' && method === 'POST') {
    const auth = await requireUser(env, request, { allowNoProfile: true });
    if (auth.error) return auth.error;
    if (auth.profile) return json({ error: 'Ya tenés un perfil' }, 409);
    const body = await request.json().catch(() => ({}));
    const r = await createProfile(env, auth.user.id, body.username, body.level);
    return r.error ? json({ error: r.error }, 400) : json({ user: auth.user, profile: r.profile });
  }

  if (path === '/api/me/username' && method === 'POST') {
    const auth = await requireUser(env, request, { fresh: true });
    if (auth.error) return auth.error;
    const body = await request.json().catch(() => ({}));
    const r = await renameProfile(env, auth.user.id, auth.profile, body.username);
    return r.error ? json({ error: r.error }, 400) : json(r);
  }

  // Ajustes: bajar tus datos y borrar la cuenta (con tu nombre de usuario escrito a mano)
  if (path === '/api/me/export' && method === 'GET') {
    const auth = await requireUser(env, request, { fresh: true });
    if (auth.error) return auth.error;
    return json(await exportData(env, auth.user, auth.profile));
  }
  if (path === '/api/me/delete' && method === 'POST') {
    const auth = await requireUser(env, request, { fresh: true });
    if (auth.error) return auth.error;
    const body = await request.json().catch(() => ({}));
    const r = await deleteAccount(env, auth.user, auth.profile, body.confirm);
    return r.error ? json({ error: r.error }, 400) : json(r);
  }

  if (path === '/api/me/avatar' && method === 'POST') {
    const auth = await requireUser(env, request);
    if (auth.error) return auth.error;
    const body = await request.json().catch(() => ({}));
    const r = await setAvatar(env, auth.user.id, body.avatar ?? null);
    return r.error ? json({ error: r.error }, 400) : json(r);
  }

  // tu personaje dibujado (el creador de personaje)
  if (path === '/api/me/look' && method === 'POST') {
    const auth = await requireUser(env, request);
    if (auth.error) return auth.error;
    const body = await request.json().catch(() => ({}));
    const r = await setLook(env, auth.user.id, body.look);
    return r.error ? json({ error: r.error }, 400) : json(r);
  }

  // amigos: por nombre de usuario; una solicitud que se acepta
  if (path === '/api/friends' && method === 'GET') {
    const auth = await requireUser(env, request);
    if (auth.error) return auth.error;
    const list = await listFriends(env, auth.user.id);
    // de cada amigo: si está conectado y qué hace, y el último mensaje del chat
    const ids = list.friends.map((f) => f.id);
    if (ids.length) {
      const lobby = lobbyStub(env);
      const [pres, last] = await Promise.all([lobby.presenceOf(ids), lobby.dmLast(auth.user.id, ids)]);
      for (const f of list.friends) {
        f.presence = pres[f.id] || { online: false };
        f.lastMsg = last[f.id] || null;
      }
    }
    return json(list);
  }

  // presencia: el navegador avisa dónde está (menú o sala) para que lo vean sus amigos
  if (path === '/api/presence' && method === 'POST') {
    const auth = await requireUser(env, request);
    if (auth.error) return auth.error;
    const body = await request.json().catch(() => ({}));
    await lobbyStub(env).ping(auth.user.id, body);
    return json({ ok: true });
  }

  // chat entre amigos (solo entre amigos de verdad)
  if (path === '/api/dm') {
    const auth = await requireUser(env, request);
    if (auth.error) return auth.error;
    const url = new URL(request.url);
    const body = method === 'POST' ? await request.json().catch(() => ({})) : {};
    const other = method === 'POST' ? body.to : url.searchParams.get('with');
    if (!(await areFriends(env, auth.user.id, other))) return json({ error: 'Solo podés hablar con tus amigos' }, 403);
    const lobby = lobbyStub(env);
    if (method === 'POST') {
      const msg = await lobby.dmSend(auth.user.id, other, body.text);
      return msg ? json({ msg }) : json({ error: 'Escribí algo' }, 400);
    }
    return json({ me: auth.user.id, messages: await lobby.dmGet(auth.user.id, other, Number(url.searchParams.get('after')) || 0) });
  }
  if (path.startsWith('/api/friends') && method === 'POST') {
    const auth = await requireUser(env, request);
    if (auth.error) return auth.error;
    const body = await request.json().catch(() => ({}));
    const uid = auth.user.id;
    const r = path === '/api/friends' ? await requestFriend(env, uid, body.username, !!body.fromProfile)
      : path === '/api/friends/respond' ? await respondFriend(env, uid, body.id, !!body.accept)
      : path === '/api/friends/remove' ? await removeFriend(env, uid, body.id)
      : { error: 'No encontrado' };
    return r.error ? json({ error: r.error }, 400) : json(r);
  }

  // invitaciones a tu equipo: solo a amigos, las ve el otro en su menú
  if (path === '/api/invites' && method === 'GET') {
    const auth = await requireUser(env, request);
    return auth.error || json({ invites: await lobbyStub(env).invites(auth.user.id) });
  }
  if (path === '/api/invites' && method === 'POST') {
    const auth = await requireUser(env, request);
    if (auth.error) return auth.error;
    const body = await request.json().catch(() => ({}));
    if (!/^\d{4}$/.test(String(body.code)) || !(await areFriends(env, auth.user.id, body.friend))) return json({ error: 'Solo podés invitar a tus amigos' }, 400);
    const info = await roomStub(env, body.code).info();
    if (!info.exists) return json({ error: 'Esa mesa ya no existe' }, 400);
    await lobbyStub(env).invite(body.friend, { from: auth.profile.username, code: body.code, mode: info.mode });
    return json({ ok: true });
  }
  if (path === '/api/invites/done' && method === 'POST') {
    const auth = await requireUser(env, request);
    if (auth.error) return auth.error;
    const body = await request.json().catch(() => ({}));
    await lobbyStub(env).inviteDone(auth.user.id, String(body.code));
    return json({ ok: true });
  }

  // el perfil de otro jugador (para verlo y agregarlo de amigo)
  const user = path.match(/^\/api\/users\/([^/]+)$/);
  if (user && method === 'GET') {
    const auth = await requireUser(env, request);
    if (auth.error) return auth.error;
    const r = await publicProfile(env, auth.user.id, decodeURIComponent(user[1]), recentMatches, fakeRecent);
    return r.error ? json({ error: r.error }, 404) : json(r);
  }

  if (path === '/api/ranking' && method === 'GET') {
    const auth = await requireUser(env, request);
    return auth.error || json(await ranking(env, new URL(request.url).searchParams.get('mode')));
  }

  if (path === '/api/rooms' && method === 'POST') {
    const { error, body, pid, name } = await readPlayer(env, request);
    if (error) return error;
    const code = await createRoom(env, {
      mode: pickMode(body.mode),
      target: TARGETS.includes(Number(body.target)) ? Number(body.target) : DEFAULT_TARGET,
      options: roomOptions(body.options),
      isPublic: !!body.isPublic,
      rated: body.rated !== false,
      pid,
      name,
    });
    return json({ code });
  }

  if (path === '/api/quick' && method === 'POST') {
    const { error, body, pid, name, profile } = await readPlayer(env, request);
    if (error) return error;
    const mode = pickMode(body.mode);
    const elo = profile[`elo_${mode}`] ?? ELO_START;
    const found = await lobbyStub(env).findOpen(mode, elo);
    if (found) return json({ code: found, joined: true });
    const code = await createRoom(env, { mode, target: DEFAULT_TARGET, options: roomOptions(), isPublic: true, pid, name, quick: { elo } });
    return json({ code, joined: false });
  }

  // historial: tus partidas (de a páginas) y una partida entera con su registro para rebobinarla
  if (path === '/api/matches' && method === 'GET') {
    const auth = await requireUser(env, request);
    if (auth.error) return auth.error;
    return json({ matches: await listMatches(env, auth.user.id, new URL(request.url).searchParams.get('before')) });
  }
  const matchId = path.match(/^\/api\/matches\/([0-9a-f-]{36})$/);
  if (matchId && method === 'GET') {
    const auth = await requireUser(env, request);
    if (auth.error) return auth.error;
    const match = await getMatch(env, auth.user.id, matchId[1]);
    return match ? json({ match }) : json({ error: 'No encontramos esa partida' }, 404);
  }
  // compartir: el que jugó pide el enlace; cualquiera (aun sin cuenta) lo abre y ve la repetición y el análisis
  const shareReq = path.match(/^\/api\/matches\/([0-9a-f-]{36})\/share$/);
  if (shareReq && method === 'POST') {
    const auth = await requireUser(env, request);
    if (auth.error) return auth.error;
    const share = await shareMatch(env, auth.user.id, shareReq[1]);
    return share ? json({ share }) : json({ error: 'Solo podés compartir partidas que jugaste' }, 404);
  }
  const shared = path.match(/^\/api\/shared\/([A-Za-z0-9_-]{16,32})$/);
  if (shared && method === 'GET') {
    const match = await getShared(env, shared[1]);
    return match ? json({ match }) : json({ error: 'Ese enlace no existe o la partida se borró' }, 404);
  }

  // tienda: lo que tenés, comprar y ponerte algo
  if (path === '/api/shop' && method === 'GET') {
    const auth = await requireUser(env, request, { fresh: true });
    if (auth.error) return auth.error;
    return json({ owned: await ownedItems(env, auth.user.id), coins: auth.profile.coins, equipped: auth.profile.equipped || {} });
  }
  if (path === '/api/shop/buy' && method === 'POST') {
    const auth = await requireUser(env, request);
    if (auth.error) return auth.error;
    const body = await request.json().catch(() => ({}));
    const r = await buyItem(env, auth.user.id, body.item);
    return r.error ? json({ error: r.error }, 400) : json(r);
  }
  if (path === '/api/shop/equip' && method === 'POST') {
    const auth = await requireUser(env, request, { fresh: true });
    if (auth.error) return auth.error;
    const body = await request.json().catch(() => ({}));
    const r = await equipItem(env, auth.user.id, auth.profile, body.slot, body.item ?? null);
    return r.error ? json({ error: r.error }, 400) : json(r);
  }

  if (path === '/api/lobby' && method === 'GET') return json(await lobbyStub(env).list());

  const info = path.match(/^\/api\/rooms\/(\d{4})$/);
  if (info && method === 'GET') return json(await roomStub(env, info[1]).info());

  // ¿Sigo sentado en esa partida? (el cartel de reconectar del menú)
  const mine = path.match(/^\/api\/rooms\/(\d{4})\/me$/);
  if (mine && method === 'GET') {
    const auth = await requireUser(env, request);
    return auth.error || json(await roomStub(env, mine[1]).mine(auth.user.id));
  }

  const ws = path.match(/^\/api\/rooms\/(\d{4})\/ws$/);
  if (ws) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Se esperaba un WebSocket', { status: 426 });
    if (ws[1].startsWith(SHOW_TABLES.codePrefix)) await lobbyStub(env).ensureShow(ws[1]);
    return roomStub(env, ws[1]).fetch(request);
  }

  return json({ error: 'No encontrado' }, 404);
}
