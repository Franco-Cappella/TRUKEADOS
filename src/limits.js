// Límite de pedidos a /api, con los "ratelimits" de wrangler.jsonc (Workers Rate Limiting):
// - API_LIMIT: todo /api por IP, generoso (en Argentina muchos comparten IP: CGNAT, cibers, la facultad).
// - WRITE_LIMIT: lo que escribe (POST) por cuenta: comprar, amigos, invitaciones, mensajes, crear mesas…
//   El aviso de "conectado" (presence) no cuenta: el menú lo manda solo, cada PRESENCE.ping.
// Sin el binding (tests, wrangler viejo) o si falla, deja pasar: un límite caído no puede tirar el juego.

const FREE_WRITES = new Set(['/api/presence']);

export const TOO_MANY = 'Estás yendo muy rápido. Esperá un ratito y probá de nuevo.';

async function over(limiter, key) {
  if (!limiter?.limit) return false;
  try {
    return !(await limiter.limit({ key })).success;
  } catch (err) {
    console.error('rate limit', err?.message ?? err);
    return false;
  }
}

/** Antes de todo: ¿esta IP ya mandó demasiados pedidos? */
export const ipLimited = (env, request) => over(env.API_LIMIT, 'ip:' + (request.headers.get('cf-connecting-ip') || 'local'));

/** Con la cuenta ya conocida: ¿escribió demasiado? Solo cuentan los POST (salvo FREE_WRITES). */
export function writeLimited(env, request, uid) {
  if (request.method !== 'POST' || FREE_WRITES.has(new URL(request.url).pathname)) return false;
  return over(env.WRITE_LIMIT, 'u:' + uid);
}
