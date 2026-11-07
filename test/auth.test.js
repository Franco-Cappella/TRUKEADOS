// Verificación del token de Supabase en el Worker (src/auth.js), con claves generadas acá y fetch simulado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyToken, createProfile } from '../src/auth.js';

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

globalThis.fetch = async (url) => {
  if (String(url).endsWith('/jwks.json')) return new Response(JSON.stringify({ keys: [jwk] }));
  if (String(url).endsWith('/auth/v1/user')) return new Response('{}', { status: 401 });
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
