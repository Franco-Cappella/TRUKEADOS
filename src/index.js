// Worker: rutas /api. Los archivos estáticos (public/) los sirve Cloudflare directamente;
// /sala/CÓDIGO cae en index.html por "single-page-application" (ver wrangler.jsonc).
import { TrucoRoom } from './truco-room.js';
import { Lobby } from './lobby.js';
import { cleanName, cleanPid, newRoomCode, json } from './util.js';
import { MODES, DEFAULT_MODE, DEFAULT_TARGET, TARGETS } from '../public/js/config.js';

export { TrucoRoom, Lobby };

const lobbyStub = (env) => env.LOBBY.get(env.LOBBY.idFromName('global'));
const roomStub = (env, code) => env.TRUCO_ROOM.get(env.TRUCO_ROOM.idFromName('truco:' + code));
const pickMode = (m) => (MODES[m] ? m : DEFAULT_MODE);

async function createRoom(env, opts) {
  for (let i = 0; i < 6; i++) {
    const code = newRoomCode();
    if ((await roomStub(env, code).create({ code, ...opts })).ok) return code;
  }
  throw new Error('No se pudo crear la sala');
}

async function readPlayer(request) {
  const body = await request.json().catch(() => ({}));
  return { body, pid: cleanPid(body.pid), name: cleanName(body.name) };
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    const method = request.method;

    if (path === '/api/rooms' && method === 'POST') {
      const { body, pid, name } = await readPlayer(request);
      if (!pid) return json({ error: 'pid inválido' }, 400);
      const code = await createRoom(env, {
        mode: pickMode(body.mode),
        target: TARGETS.includes(Number(body.target)) ? Number(body.target) : DEFAULT_TARGET,
        ayudas: !!body.ayudas,
        isPublic: !!body.isPublic,
        pid,
        name,
      });
      return json({ code });
    }

    if (path === '/api/quick' && method === 'POST') {
      const { body, pid, name } = await readPlayer(request);
      if (!pid) return json({ error: 'pid inválido' }, 400);
      const mode = pickMode(body.mode);
      const found = await lobbyStub(env).findOpen(mode);
      if (found) return json({ code: found, joined: true });
      const code = await createRoom(env, { mode, target: DEFAULT_TARGET, ayudas: false, isPublic: true, pid, name });
      return json({ code, joined: false });
    }

    if (path === '/api/lobby' && method === 'GET') return json(await lobbyStub(env).list());

    const info = path.match(/^\/api\/rooms\/([A-Z0-9]{5})$/);
    if (info && method === 'GET') return json(await roomStub(env, info[1]).info());

    const ws = path.match(/^\/api\/rooms\/([A-Z0-9]{5})\/ws$/);
    if (ws) {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Se esperaba un WebSocket', { status: 426 });
      return roomStub(env, ws[1]).fetch(request);
    }

    return json({ error: 'No encontrado' }, 404);
  },
};
