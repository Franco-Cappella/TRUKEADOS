// Límite de pedidos a /api (src/limits.js): por IP para todo, por cuenta para lo que escribe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ipLimited, writeLimited } from '../src/limits.js';

// un limitador de mentira: deja pasar `n` pedidos por clave
const limiter = (n) => {
  const seen = new Map();
  return { keys: seen, limit: async ({ key }) => ({ success: seen.set(key, (seen.get(key) || 0) + 1).get(key) <= n }) };
};
const req = (path, method = 'GET', ip = '1.2.3.4') => new Request('https://game.trukeados.com' + path, { method, headers: { 'cf-connecting-ip': ip } });

test('límite por IP: corta al pasarse y cada IP tiene su cuenta', async () => {
  const env = { API_LIMIT: limiter(2) };
  assert.equal(await ipLimited(env, req('/api/me')), false);
  assert.equal(await ipLimited(env, req('/api/me')), false);
  assert.equal(await ipLimited(env, req('/api/me')), true);
  assert.equal(await ipLimited(env, req('/api/me', 'GET', '5.6.7.8')), false);
});

test('límite de escrituras: solo POST, por cuenta, y el aviso de conectado no cuenta', async () => {
  const env = { WRITE_LIMIT: limiter(1) };
  assert.equal(await writeLimited(env, req('/api/shop'), 'u1'), false); // GET: no cuenta
  assert.equal(await writeLimited(env, req('/api/presence', 'POST'), 'u1'), false);
  assert.equal(await writeLimited(env, req('/api/presence', 'POST'), 'u1'), false);
  assert.equal(await writeLimited(env, req('/api/shop/buy', 'POST'), 'u1'), false);
  assert.equal(await writeLimited(env, req('/api/shop/buy', 'POST'), 'u1'), true);
  assert.equal(await writeLimited(env, req('/api/shop/buy', 'POST'), 'u2'), false);
  assert.deepEqual([...env.WRITE_LIMIT.keys.keys()], ['u:u1', 'u:u2']);
});

test('sin el limitador, o si falla, deja pasar', async () => {
  assert.equal(await ipLimited({}, req('/api/me')), false);
  const broken = { WRITE_LIMIT: { limit: async () => { throw new Error('caído'); } } };
  assert.equal(await writeLimited(broken, req('/api/rooms', 'POST'), 'u1'), false);
});
