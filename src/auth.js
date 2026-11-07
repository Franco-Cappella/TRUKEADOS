// Cuentas: verifica la sesión de Supabase Auth (el token que manda el navegador) y lee el perfil del jugador.
// La base de datos es la de Supabase; el Worker la usa con la clave secreta (SUPABASE_SECRET_KEY), así que las
// tablas no necesitan políticas de escritura para el navegador. Ver docs/CUENTAS.md.
import { AUTH } from '../public/js/config.js';
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
export function rest(env, path, init = {}) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: env.SUPABASE_SECRET_KEY, 'content-type': 'application/json', ...init.headers },
  });
}

const PROFILE_FIELDS = 'id,username,coins,elo_1v1,elo_2v2,elo_3v3,games_1v1,games_2v2,games_3v3,created_at';

// Perfiles leídos hace poco (por isolate): cada pedido y cada "join" no tiene que ir a la base.
const cache = new Map();

export const forgetProfile = (id) => cache.delete(id);

export async function getProfile(env, id, { fresh = false } = {}) {
  const hit = cache.get(id);
  if (!fresh && hit && Date.now() - hit.at < AUTH.profileTtl) return hit.profile;
  const res = await rest(env, `profiles?id=eq.${encodeURIComponent(id)}&select=${PROFILE_FIELDS}`);
  if (!res.ok) throw new Error('No se pudo leer el perfil');
  const profile = (await res.json())[0] || null;
  if (profile) cache.set(id, { profile, at: Date.now() });
  return profile;
}

/** Crea el perfil con el nombre elegido. { profile } o { error } (nombre inválido u ocupado). */
export async function createProfile(env, id, username) {
  const name = String(username ?? '').trim();
  if (!AUTH.usernameRe.test(name)) return { error: AUTH.usernameHint };
  const res = await rest(env, `profiles?select=${PROFILE_FIELDS}`, {
    method: 'POST',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify({ id, username: name }),
  });
  if (res.status === 409) {
    const taken = (await res.json().catch(() => ({}))).message?.includes('username');
    return { error: taken ? 'Ese nombre ya lo usa otra persona' : 'Ya tenés un perfil' };
  }
  if (!res.ok) throw new Error('No se pudo crear el perfil');
  const profile = (await res.json())[0];
  cache.set(id, { profile, at: Date.now() });
  return { profile };
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
