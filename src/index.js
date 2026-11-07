// Worker: rutas /api. Los archivos estáticos (public/) los sirve Cloudflare directamente;
// /sala/CÓDIGO cae en index.html por "single-page-application" (ver wrangler.jsonc).
// Todo lo que sea jugar pide sesión de Supabase (ver auth.js): el jugador es el id de su cuenta y su nombre,
// el del perfil. El navegador ya no elige ni su identificador ni su nombre.
import { TrucoRoom } from './truco-room.js';
import { Lobby } from './lobby.js';
import { newRoomCode, json } from './util.js';
import { requireUser, createProfile } from './auth.js';
import { listMatches, getMatch } from './matches.js';
import { ownedItems, buyItem, equipItem } from './shop.js';
import { MODES, DEFAULT_MODE, DEFAULT_TARGET, TARGETS, roomOptions } from '../public/js/config.js';

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
  return { body, pid: auth.user.id, name: auth.profile.username };
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
    const r = await createProfile(env, auth.user.id, body.username);
    return r.error ? json({ error: r.error }, 400) : json({ user: auth.user, profile: r.profile });
  }

  if (path === '/api/rooms' && method === 'POST') {
    const { error, body, pid, name } = await readPlayer(env, request);
    if (error) return error;
    const code = await createRoom(env, {
      mode: pickMode(body.mode),
      target: TARGETS.includes(Number(body.target)) ? Number(body.target) : DEFAULT_TARGET,
      options: roomOptions(body.options),
      isPublic: !!body.isPublic,
      pid,
      name,
    });
    return json({ code });
  }

  if (path === '/api/quick' && method === 'POST') {
    const { error, body, pid, name } = await readPlayer(env, request);
    if (error) return error;
    const mode = pickMode(body.mode);
    const found = await lobbyStub(env).findOpen(mode);
    if (found) return json({ code: found, joined: true });
    const code = await createRoom(env, { mode, target: DEFAULT_TARGET, options: roomOptions(), isPublic: true, pid, name });
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

  const ws = path.match(/^\/api\/rooms\/(\d{4})\/ws$/);
  if (ws) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Se esperaba un WebSocket', { status: 426 });
    return roomStub(env, ws[1]).fetch(request);
  }

  return json({ error: 'No encontrado' }, 404);
}
