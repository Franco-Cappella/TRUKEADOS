// Verificación del token de Supabase en el Worker (src/auth.js), con claves generadas acá y fetch simulado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyToken, createProfile, requireUser, getProfile, renameProfile } from '../src/auth.js';
import { AUTH, usernameFreeAt } from '../public/js/config.js';

const env = { SUPABASE_URL: 'https://demo.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'pk', SUPABASE_SECRET_KEY: 'sk' };
const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

const { privateKey, publicKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'k1', alg: 'ES256' };

async function sign(claims, { kid = 'k1', key = privateKey } = {}) {
  const head = enc({ alg: 'ES256', kid, typ: 'JWT' });
  const body = enc(claims);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${Buffer.from(sig).toString('base64url')}`;
}

const good = () => ({ iss: `${env.SUPABASE_URL}/auth/v1`, aud: 'authenticated', sub: 'u-1', email: 'a@b.c', exp: Date.now() / 1000 + 600 });

let restReply = { status: 200, body: '[]' }; // lo que responde la base (profiles) en cada prueba
let restCalls = [];
globalThis.fetch = async (url, init) => {
  if (String(url).includes('/rest/v1/profiles')) restCalls.push({ url: String(url), init });
  if (String(url).endsWith('/jwks.json')) return new Response(JSON.stringify({ keys: [jwk] }));
  if (String(url).endsWith('/auth/v1/user')) return new Response('{}', { status: 401 });
  if (String(url).includes('/rest/v1/profiles')) return new Response(restReply.body, { status: restReply.status });
  throw new Error('fetch inesperado: ' + url);
};

test('acepta un token firmado por el proyecto', async () => {
  assert.deepEqual(await verifyToken(env, await sign(good())), { id: 'u-1', email: 'a@b.c' });
});

test('rechaza tokens vencidos, de otro proyecto, sin audiencia o con otra firma', async () => {
  assert.equal(await verifyToken(env, await sign({ ...good(), exp: Date.now() / 1000 - 1 })), null);
  assert.equal(await verifyToken(env, await sign({ ...good(), iss: 'https://otro.supabase.co/auth/v1' })), null);
  assert.equal(await verifyToken(env, await sign({ ...good(), aud: 'anon' })), null);
  const other = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  assert.equal(await verifyToken(env, await sign(good(), { key: other.privateKey })), null);
  // clave desconocida: se le pregunta a Supabase Auth, que dice que no
  assert.equal(await verifyToken(env, await sign(good(), { kid: 'otra' })), null);
  assert.equal(await verifyToken(env, 'basura'), null);
  assert.equal(await verifyToken(env, undefined), null);
});

test('el nombre del perfil se valida antes de ir a la base', async () => {
  for (const bad of ['ab', 'con espacio', 'x'.repeat(21), '<b>', '']) {
    assert.ok((await createProfile(env, 'u-1', bad)).error, bad);
  }
});

test('sin clave secreta, leer el perfil falla diciendo por qué', async () => {
  await assert.rejects(getProfile({ ...env, SUPABASE_SECRET_KEY: '' }, 'u-2'), /SUPABASE_SECRET_KEY/);
});

test('si Supabase rechaza la clave secreta, el error lo dice (y no parece falta de sesión)', async () => {
  restReply = { status: 401, body: '{"message":"Invalid API key"}' };
  const request = new Request('https://game.test/api/me', { headers: { authorization: `Bearer ${await sign(good())}` } });
  await assert.rejects(requireUser(env, request), /Supabase respondió 401.*SUPABASE_SECRET_KEY/);
  restReply = { status: 200, body: '[]' };
});

test('cambiar el nombre: la primera vez se puede y queda la fecha', async () => {
  restCalls = [];
  restReply = { status: 200, body: JSON.stringify([{ id: 'u-3', username: 'Nuevo' }]) };
  const r = await renameProfile(env, 'u-3', { username: 'Viejo', username_changed_at: null }, ' Nuevo ');
  assert.equal(r.profile.username, 'Nuevo');
  const { url, init } = restCalls[0];
  assert.equal(init.method, 'PATCH');
  assert.match(url, /or=\(username_changed_at\.is\.null,username_changed_at\.lte\.%22/);
  const sent = JSON.parse(init.body);
  assert.equal(sent.username, 'Nuevo');
  assert.ok(Date.parse(sent.username_changed_at));
  restReply = { status: 200, body: '[]' };
});

test('cambiar el nombre: antes de 14 días no va a la base', async () => {
  restCalls = [];
  const hace13 = new Date(Date.now() - 13 * 24 * 60 * 60_000).toISOString();
  const r = await renameProfile(env, 'u-3', { username: 'Viejo', username_changed_at: hace13 }, 'Nuevo');
  assert.match(r.error, /volver a cambiarlo/);
  assert.equal(restCalls.length, 0);
  assert.equal(usernameFreeAt(hace13), Date.parse(hace13) + AUTH.usernameCooldown);
  assert.equal(usernameFreeAt(null), 0);
});

test('cambiar el nombre: a los 14 días se puede de nuevo', async () => {
  restReply = { status: 200, body: JSON.stringify([{ id: 'u-3', username: 'Otro' }]) };
  const hace15 = new Date(Date.now() - 15 * 24 * 60 * 60_000).toISOString();
  assert.equal((await renameProfile(env, 'u-3', { username: 'Viejo', username_changed_at: hace15 }, 'Otro')).profile.username, 'Otro');
  restReply = { status: 200, body: '[]' };
});

test('cambiar el nombre: inválido, igual, ocupado u otro pedido que ganó de mano', async () => {
  const p = { username: 'Viejo', username_changed_at: null };
  assert.ok((await renameProfile(env, 'u-3', p, 'a b')).error);
  assert.match((await renameProfile(env, 'u-3', p, 'Viejo')).error, /Ya te llamás/);
  restReply = { status: 409, body: '{}' };
  assert.match((await renameProfile(env, 'u-3', p, 'Ocupado')).error, /otra persona/);
  restReply = { status: 200, body: '[]' };
  assert.match((await renameProfile(env, 'u-3', p, 'Tarde')).error, /14 días/);
});
