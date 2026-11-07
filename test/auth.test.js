// Verificación del token de Supabase en el Worker (src/auth.js), con claves generadas acá y fetch simulado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyToken, createProfile, requireUser, getProfile } from '../src/auth.js';

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
globalThis.fetch = async (url) => {
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
