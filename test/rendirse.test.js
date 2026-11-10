// Rendirse en equipo: no te rendís solo, se lo pedís a tu equipo (2 de 2 en 2v2, 2 de 3 en 3v3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRoom } from './helpers/room-harness.mjs';
import { TIMING } from '../public/js/config.js';

// Personas en los asientos pedidos (el resto, bots) y la partida empezada.
async function table(mode, seats) {
  const h = await makeRoom({ mode });
  const ws = {};
  for (const [pid, seat] of Object.entries(seats)) {
    ws[pid] = await h.join(pid);
    await h.send(ws[pid], { t: 'sit', seat });
  }
  await h.send(ws[Object.keys(seats)[0]], { t: 'start', fillBots: true });
  const r = h.room.room;
  assert.equal(r.status, 'playing');
  r.dealUntil = h.now;
  return { h, ws, r };
}

test('rendirse 2v2: si tu compañero no acepta, no te rendís', async () => {
  const { h, ws, r } = await table('2v2', { u0: 0, u1: 2 });
  await h.send(ws.u0, { t: 'act', a: { t: 'rendirse' } });
  assert.equal(r.status, 'playing', 'se rindió solo');
  const v = h.state(ws.u1).surrender;
  assert.ok(v && !v.voted && v.need === 2, 'al compañero le llega el pedido');
  assert.equal(h.state(ws.u0).surrender.voted, true);
  await h.send(ws.u1, { t: 'surrender-vote', yes: false });
  assert.equal(r.status, 'playing');
  assert.equal(h.state(ws.u0).surrender, null, 'se cancela');
  // y por un rato no se puede volver a pedir
  await h.send(ws.u0, { t: 'act', a: { t: 'rendirse' } });
  assert.equal(h.state(ws.u1).surrender, null);
  assert.match(ws.u0.last('error').msg, /Esperá/);
});

test('rendirse 2v2: si los dos están de acuerdo, pierden', async () => {
  const { h, ws, r } = await table('2v2', { u0: 0, u1: 2 });
  await h.send(ws.u0, { t: 'act', a: { t: 'rendirse' } });
  await h.send(ws.u1, { t: 'surrender-vote', yes: true });
  assert.equal(r.game.status, 'ended');
  assert.equal(r.game.winner, 1);
});

test('rendirse 2v2: con un bot de compañero, el bot acepta', async () => {
  const { h, ws, r } = await table('2v2', { u0: 0 });
  await h.send(ws.u0, { t: 'act', a: { t: 'rendirse' } });
  assert.equal(r.game.status, 'ended');
});

test('rendirse 3v3: alcanza con 2 de 3, y el pedido vence si no contestan', async () => {
  const { h, ws, r } = await table('3v3', { u0: 0, u1: 2, u2: 4 });
  await h.send(ws.u0, { t: 'act', a: { t: 'rendirse' } });
  assert.equal(h.state(ws.u2).surrender.need, 2);
  await h.tick(TIMING.surrenderVote + 1000);
  assert.equal(h.state(ws.u1).surrender, null, 'venció');
  assert.equal(r.status, 'playing');
  await h.tick(TIMING.surrenderCooldown);
  await h.send(ws.u0, { t: 'act', a: { t: 'rendirse' } });
  await h.send(ws.u2, { t: 'surrender-vote', yes: false });
  assert.equal(r.status, 'playing', 'con uno en contra todavía puede salir');
  await h.send(ws.u1, { t: 'surrender-vote', yes: true });
  assert.equal(r.game.status, 'ended');
  assert.equal(r.game.winner, 1);
});

test('rendirse 1v1: sigue siendo al toque', async () => {
  const { h, ws, r } = await table('1v1', { u0: 0 });
  await h.send(ws.u0, { t: 'act', a: { t: 'rendirse' } });
  assert.equal(r.game.status, 'ended');
});
