// Antitrampas (ANTICHEAT en config.js): las señas solo le llegan a quien venía mirando al que la hace, barrer la
// mesa con la mirada no sirve, y los enlaces compartidos no llevan ids de cuentas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRoom } from './helpers/room-harness.mjs';
import { ANTICHEAT } from '../public/js/config.js';
import { getShared, shareMatch } from '../src/matches.js';

// 2v2 con dos personas: u0 (asiento 0) y u1 (asiento 1, rival), más dos bots.
async function table() {
  const h = await makeRoom({ mode: '2v2' });
  const ws = [await h.join('u0'), await h.join('u1')];
  await h.send(ws[0], { t: 'start', fillBots: true });
  await h.tick(5000); // termina de repartir
  return { h, ws, r: h.room.room };
}
const senas = (ws) => ws.got.filter((m) => m.t === 'sena');

test('antitrampas: la seña no le llega al que recién empezó a mirar (ni rastro de que hubo una)', async () => {
  const { h, ws } = await table();
  await h.send(ws[1], { t: 'look', target: 0 });
  await h.send(ws[0], { t: 'sena', sena: 'ancho_espada' });
  assert.equal(senas(ws[1]).length, 0);
  assert.deepEqual(senas(ws[0]).at(-1).seenBy, []);
  await h.tick(ANTICHEAT.senaDwell + ANTICHEAT.senaGap);
  await h.send(ws[0], { t: 'sena', sena: 'tres' });
  assert.equal(senas(ws[1]).at(-1).sena, 'tres');
});

test('antitrampas: barrer la mesa con la mirada deja un rato sin ver señas', async () => {
  const { h, ws } = await table();
  for (let i = 0; i <= ANTICHEAT.lookBurst.n; i++) await h.send(ws[1], { t: 'look', target: i % 2 ? 'table' : 0 });
  await h.tick(ANTICHEAT.senaDwell + 100);
  assert.equal(h.room.gaze[1], 0); // la mirada se mueve igual: los demás la ven
  await h.send(ws[0], { t: 'sena', sena: 'ancho_espada' });
  assert.equal(senas(ws[1]).length, 0);
  await h.tick(ANTICHEAT.lookPenalty + ANTICHEAT.senaGap);
  await h.send(ws[0], { t: 'sena', sena: 'tres' });
  assert.equal(senas(ws[1]).at(-1)?.sena, 'tres');
});

test('antitrampas: las señas en ráfaga se descartan y el que se fue al mazo no hace señas', async () => {
  const { h, ws, r } = await table();
  await h.tick(1000);
  const before = senas(ws[0]).length;
  await h.send(ws[0], { t: 'sena', sena: 'tres' });
  await h.send(ws[0], { t: 'sena', sena: 'dos' });
  assert.equal(senas(ws[0]).length, before + 1);
  await h.tick(ANTICHEAT.senaGap);
  r.game.h.mazo[0] = true;
  await h.send(ws[0], { t: 'sena', sena: 'dos' });
  assert.equal(senas(ws[0]).length, before + 1);
});

test('antitrampas: un cliente que manda de más pierde lo que sobra', async () => {
  const { h, ws } = await table();
  for (let i = 0; i < ANTICHEAT.msgBurst.n + 20; i++) await h.send(ws[1], { t: 'look', target: i % 2 ? 'table' : 0 });
  assert.ok(h.room.lookLog[1].length <= ANTICHEAT.msgBurst.n);
});

// ------------------------------------------------------------------ compartir

function fakeDb(routes) {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url).split('/rest/v1/')[1];
    calls.push({ path, init });
    for (const [re, fn] of routes) if (re.test(path)) return fn(path, init);
    return new Response('[]', { status: 200 });
  };
  return { calls, restore: () => (globalThis.fetch = real) };
}
const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SECRET_KEY: 'k' };
const json = (v, status = 200) => new Response(JSON.stringify(v), { status });

test('compartir: el enlace de una partida compartida no lleva ids de cuentas', async () => {
  const seats = [{ name: 'Ana', uid: 'a-1' }, { name: 'Rival', uid: null, bot: false, disguised: true, elo: 1300 }];
  const db = fakeDb([[/^match_shares\?id=eq\./, () => json([{ seat: 0, match: { mode: '1v1', winner_team: 0, score: [30, 12], seats, log: { seats, hands: [] } } }])]]);
  try {
    const m = await getShared(env, 'AbCdEfGhIjKlMnOp');
    assert.equal(m.shared.by, 'Ana');
    assert.equal(m.me.won, true);
    assert.ok(!JSON.stringify(m).includes('a-1'));
    assert.ok(!JSON.stringify(m).includes('disguised'));
    assert.equal(await getShared(env, '../profiles'), null);
  } finally {
    db.restore();
  }
});

test('compartir: solo el que jugó puede crear el enlace, y siempre es el mismo', async () => {
  const id = '11111111-2222-3333-4444-555555555555';
  let stored = null;
  const db = fakeDb([
    [/^match_players\?match_id=eq\.[^&]+&user_id=eq\.u1/, () => json([{ seat: 1 }])],
    [/^match_players/, () => json([])],
    [/^match_shares\?match_id/, () => json(stored ? [{ id: stored }] : [])],
    [/^match_shares$/, (p, init) => ((stored = JSON.parse(init.body).id), new Response(null, { status: 201 }))],
  ]);
  try {
    assert.equal(await shareMatch(env, 'u9', id), null);
    const a = await shareMatch(env, 'u1', id);
    assert.match(a, /^[A-Za-z0-9_-]{16}$/);
    assert.equal(await shareMatch(env, 'u1', id), a);
  } finally {
    db.restore();
  }
});
