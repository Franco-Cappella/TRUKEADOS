// Cuentas: verifica la sesión de Supabase Auth (el token que manda el navegador) y lee el perfil del jugador.
// La base de datos es la de Supabase; el Worker la usa con la clave secreta (SUPABASE_SECRET_KEY), así que las
// tablas no necesitan políticas de escritura para el navegador. Ver docs/CUENTAS.md.
import { AUTH, COINS, levelElo, usernameFreeAt, usernameFreeDay } from '../public/js/config.js';
import { json } from './util.js';

// ------------------------------------------------------------------ token (JWT de Supabase)
let jwks = null;
let jwksAt = 0;

async function signingKeys(env) {
  if (!jwks || Date.now() - jwksAt > AUTH.jwksTtl) {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`).catch(() => null);
    jwks = res?.ok ? (await res.json()).keys || [] : jwks || [];
    jwksAt = Date.now();
  }
  return jwks;
}

const b64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const part = (s) => JSON.parse(new TextDecoder().decode(b64(s)));

const ALGS = {
  ES256: { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' },
  RS256: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
};

// Firma con las claves públicas del proyecto (JWKS). Si el proyecto todavía firma con el secreto compartido
// (HS256, claves viejas) no hay clave pública: se le pregunta a Supabase Auth directamente.
async function signatureOk(env, token, header) {
  const alg = ALGS[header.alg];
  const jwk = alg && (await signingKeys(env)).find((k) => k.kid === header.kid);
  if (!jwk) {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${token}` },
    }).catch(() => null);
    return !!res?.ok;
  }
  const [h, p, s] = token.split('.');
  const key = await crypto.subtle.importKey('jwk', jwk, alg, false, ['verify']);
  return crypto.subtle.verify(alg, key, b64(s), new TextEncoder().encode(`${h}.${p}`));
}

/** Usuario de un token de Supabase ({ id, email }) o null si no es válido o venció. */
export async function verifyToken(env, token) {
  if (typeof token !== 'string' || token.split('.').length !== 3 || !env.SUPABASE_URL) return null;
  try {
    const [h, p] = token.split('.');
    const header = part(h);
    const claims = part(p);
    const aud = [].concat(claims.aud);
    if (claims.iss !== `${env.SUPABASE_URL}/auth/v1` || !aud.includes('authenticated')) return null;
    if (!claims.sub || claims.exp * 1000 < Date.now()) return null;
    if (!(await signatureOk(env, token, header))) return null;
    return { id: claims.sub, email: claims.email || '' };
  } catch {
    return null;
  }
}

const bearer = (request) => request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];

// ------------------------------------------------------------------ base de datos (PostgREST)
// La clave secreta es un secreto del Worker (SUPABASE_SECRET_KEY). Si falta o Supabase la rechaza, el motivo queda
// en los logs del Worker y el jugador recibe un aviso genérico (index.js), no una pantalla de entrada muda.
export function rest(env, path, init = {}) {
  if (!env.SUPABASE_SECRET_KEY) throw new Error('Falta SUPABASE_SECRET_KEY en el Worker (ver docs/CUENTAS.md)');
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: env.SUPABASE_SECRET_KEY, 'content-type': 'application/json', ...init.headers },
  });
}

const dbError = (res, what) =>
  new Error(`${what}: Supabase respondió ${res.status}${res.status === 401 ? ' (revisá SUPABASE_SECRET_KEY en el Worker, ver docs/CUENTAS.md)' : ''}`);

// Todas las columnas: las nuevas (foto, récord) pueden no existir todavía si falta aplicar una migración.
const PROFILE_FIELDS = '*';

// Perfiles leídos hace poco (por isolate): cada pedido y cada "join" no tiene que ir a la base.
const cache = new Map();

export const forgetProfile = (id) => cache.delete(id);

export async function getProfile(env, id, { fresh = false } = {}) {
  const hit = cache.get(id);
  if (!fresh && hit && Date.now() - hit.at < AUTH.profileTtl) return hit.profile;
  const res = await rest(env, `profiles?id=eq.${encodeURIComponent(id)}&select=${PROFILE_FIELDS}`);
  if (!res.ok) throw dbError(res, 'No se pudo leer el perfil');
  const profile = (await res.json())[0] || null;
  if (profile) cache.set(id, { profile, at: Date.now() });
  return profile;
}

/**
 * Crea el perfil con el nombre elegido y el ELO del nivel que dijo tener, más las monedas de bienvenida.
 * { profile } o { error } (nombre inválido u ocupado).
 */
export async function createProfile(env, id, username, level) {
  const name = String(username ?? '').trim();
  if (!AUTH.usernameRe.test(name)) return { error: AUTH.usernameHint };
  const elo = levelElo(level);
  const res = await rest(env, `profiles?select=${PROFILE_FIELDS}`, {
    method: 'POST',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify({ id, username: name, coins: COINS.signup, elo_1v1: elo, elo_2v2: elo, elo_3v3: elo }),
  });
  if (res.status === 409) {
    const taken = (await res.json().catch(() => ({}))).message?.includes('username');
    return { error: taken ? 'Ese nombre ya lo usa otra persona' : 'Ya tenés un perfil' };
  }
  if (!res.ok) throw dbError(res, 'No se pudo crear el perfil');
  const profile = (await res.json())[0];
  cache.set(id, { profile, at: Date.now() });
  return { profile };
}

/**
 * Cambia el nombre, una vez cada AUTH.usernameCooldown. La fecha también se controla en la base (el filtro del
 * PATCH): dos pedidos a la vez no pueden cambiarlo dos veces. { profile } o { error }.
 */
export async function renameProfile(env, id, profile, username) {
  const name = String(username ?? '').trim();
  if (!AUTH.usernameRe.test(name)) return { error: AUTH.usernameHint };
  if (name === profile.username) return { error: 'Ya te llamás así' };
  const now = Date.now();
  const free = usernameFreeAt(profile.username_changed_at);
  if (now < free) return { error: `Podés volver a cambiarlo el ${usernameFreeDay(free)}` };
  const cutoff = new Date(now - AUTH.usernameCooldown).toISOString();
  const patchName = (body, filter = '') =>
    rest(env, `profiles?id=eq.${encodeURIComponent(id)}${filter}&select=${PROFILE_FIELDS}`, {
      method: 'PATCH',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
  let res = await patchName({ username: name, username_changed_at: new Date(now).toISOString() }, `&or=(username_changed_at.is.null,username_changed_at.lte.%22${encodeURIComponent(cutoff)}%22)`);
  if (res.status === 409) return { error: 'Ese nombre ya lo usa otra persona' };
  if (!res.ok) {
    const why = await res.text().catch(() => '');
    // falta la migración 20261112000000_username_change (no existe la columna): se cambia igual, sin la espera
    if (/username_changed_at/.test(why)) {
      console.error('Falta aplicar la migración 20261112000000_username_change: el nombre se cambia sin controlar los 14 días');
      res = await patchName({ username: name });
      if (res.status === 409) return { error: 'Ese nombre ya lo usa otra persona' };
    } else {
      console.error('No se pudo cambiar el nombre:', res.status, why);
      if (/duplicate|unique|23505/i.test(why)) return { error: 'Ese nombre ya lo usa otra persona' };
    }
    if (!res.ok) throw dbError(res, 'No se pudo cambiar el nombre');
  }
  const updated = (await res.json())[0];
  if (!updated) return { error: `Solo se puede cambiar una vez cada ${AUTH.usernameCooldownDays} días` };
  cache.set(id, { profile: updated, at: now });
  return { profile: updated };
}

/**
 * Usuario y perfil del pedido (token en "Authorization: Bearer"). Si falta algo devuelve { error: Response }:
 * 401 sin sesión, 403 si todavía no eligió su nombre (salvo con allowNoProfile).
 */
export async function requireUser(env, request, { allowNoProfile = false, fresh = false } = {}) {
  const user = await verifyToken(env, bearer(request));
  if (!user) return { error: json({ error: 'Tenés que iniciar sesión' }, 401) };
  const profile = await getProfile(env, user.id, { fresh });
  if (!profile && !allowNoProfile) return { error: json({ error: 'Elegí tu nombre antes de jugar' }, 403) };
  return { user, profile };
}
