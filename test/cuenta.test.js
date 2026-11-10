// Ajustes → Tu cuenta: borrarla (con el nombre escrito a mano) y bajar los datos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteAccount, exportData } from '../src/account.js';

const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test' };
const user = { id: '11111111-1111-1111-1111-111111111111', email: 'a@b.c' };
const profile = { username: 'Trosman', elo: 1200, coins: 50 };

function withFetch(fn, respond) {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', headers: init.headers || {} });
    return respond(String(url), init);
  };
  return fn(calls).finally(() => (globalThis.fetch = real));
}

test('cuenta: sin el nombre bien escrito no se borra nada', async () => {
  await withFetch(async (calls) => {
    const r = await deleteAccount(env, user, profile, 'trosma');
    assert.match(r.error, /nombre de usuario/);
    assert.equal(calls.length, 0);
  }, () => new Response('{}'));
});

test('cuenta: con el nombre (sin importar mayúsculas) se borra el usuario de Supabase Auth', async () => {
  await withFetch(async (calls) => {
    const r = await deleteAccount(env, user, profile, ' trosman ');
    assert.deepEqual(r, { ok: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'DELETE');
    assert.equal(calls[0].url, `${env.SUPABASE_URL}/auth/v1/admin/users/${user.id}`);
    assert.equal(calls[0].headers.apikey, env.SUPABASE_SECRET_KEY);
  }, () => new Response('{}', { status: 200 }));
});

test('cuenta: si Supabase falla, se avisa y no se dice que se borró', async () => {
  await withFetch(async () => {
    const r = await deleteAccount(env, user, profile, 'Trosman');
    assert.ok(r.error);
  }, () => new Response('nope', { status: 500 }));
});

test('cuenta: los datos que se bajan traen el perfil, las compras, los amigos y las partidas', async () => {
  await withFetch(async (calls) => {
    const d = await exportData(env, user, { ...profile, id: user.id, avatar: 'x' });
    assert.equal(d.cuenta.mail, 'a@b.c');
    assert.equal(d.perfil.username, 'Trosman');
    assert.equal(d.perfil.avatar, undefined, 'solo lo que sirve, no la foto entera');
    assert.deepEqual(d.compras, [{ item_id: 'mate' }]);
    assert.ok(Array.isArray(d.amigos) && Array.isArray(d.partidas));
    assert.ok(calls.every((c) => c.url.includes(user.id)), 'solo lo tuyo');
  }, (url) => new Response(JSON.stringify(url.includes('inventory') ? [{ item_id: 'mate' }] : []), { status: 200 }));
});
