// Irse al mazo en equipo: se va todo el equipo, así que es un pedido (2 de 2 en 2v2, 2 de 3 en 3v3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRoom } from './helpers/room-harness.mjs';
import { TIMING } from '../public/js/config.js';
import { act } from '../public/js/engine.js';

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

const gone = (r, ...seats) => seats.every((s) => r.game.h.mazo[s]);

test('mazo 2v2: es un pedido; si tu compañero no acepta, siguen la mano', async () => {
  const { h, ws, r } = await table('2v2', { u0: 0, u1: 2 });
  const hand = r.game.handNo;
  await h.send(ws.u0, { t: 'act', a: { t: 'mazo' } });
  assert.ok(!gone(r, 0), 'se fue sin preguntar');
  assert.equal(r.game.h.phase, 'play');
  const v = h.state(ws.u1).mazoVote;
  assert.ok(v && !v.voted && v.need === 2 && v.of === 2, 'al compañero le llega el pedido');
  assert.equal(h.state(ws.u0).mazoVote.voted, true);
  assert.match(ws.u1.last('notice').msg, /quiere irse al mazo/);
  await h.send(ws.u1, { t: 'mazo-vote', yes: false });
  assert.equal(h.state(ws.u0).mazoVote, null, 'se cancela');
  assert.equal(r.game.handNo, hand);
  assert.ok(!gone(r, 0, 2));
  // y por un rato no se puede volver a pedir
  await h.send(ws.u0, { t: 'act', a: { t: 'mazo' } });
  assert.equal(h.state(ws.u1).mazoVote, null);
  assert.match(ws.u0.last('error').msg, /Esperá/);
});

test('mazo 2v2: si los dos están de acuerdo, se va el equipo (y queda grabado)', async () => {
  const { h, ws, r } = await table('2v2', { u0: 0, u1: 2 });
  await h.send(ws.u0, { t: 'act', a: { t: 'mazo', show: true } });
  assert.equal(h.state(ws.u1).mazoVote.show, true);
  await h.send(ws.u1, { t: 'mazo-vote', yes: true });
  assert.ok(gone(r, 0, 2));
  assert.notEqual(r.game.h.phase, 'play');
  assert.ok(r.game.ev.some((e) => e.type === 'mazo' && e.seat === 0), 'se fue el que lo pidió');
  assert.equal(h.state(ws.u0).mazoVote, null);
});

test('mazo 2v2: si el compañero también toca "Irse al mazo", vale como que sí', async () => {
  const { h, ws, r } = await table('2v2', { u0: 0, u1: 2 });
  await h.send(ws.u0, { t: 'act', a: { t: 'mazo' } });
  await h.send(ws.u1, { t: 'act', a: { t: 'mazo' } });
  assert.ok(gone(r, 0, 2));
});

test('mazo 2v2: con un bot de compañero, se van al toque', async () => {
  const { h, ws, r } = await table('2v2', { u0: 0 });
  await h.send(ws.u0, { t: 'act', a: { t: 'mazo' } });
  assert.ok(gone(r, 0, 2));
});

test('mazo 2v2: un bot no se lleva al mazo a su compañero persona', async () => {
  const { h, r } = await table('2v2', { u0: 0 });
  assert.equal(h.room.mazoNeedsPeople(2), true, 'el bot del asiento 2 tendría que preguntar');
  assert.equal(h.room.mazoNeedsPeople(1), false, 'entre bots, no');
  const orig = h.room.botAct.bind(h.room);
  const tried = [];
  h.room.botAct = (seat, a) => (tried.push([seat, a.t]), orig(seat, a));
  await h.tick(60_000);
  assert.ok(!tried.some(([s, t]) => s === 2 && t === 'mazo'), 'el bot se fue al mazo por el equipo');
});

test('mazo 3v3: alcanza con 2 de 3', async () => {
  const { h, ws, r } = await table('3v3', { u0: 0, u1: 2, u2: 4 });
  await h.send(ws.u0, { t: 'act', a: { t: 'mazo' } });
  const v = h.state(ws.u2).mazoVote;
  assert.equal(v.need, 2);
  assert.equal(v.of, 3);
  await h.send(ws.u2, { t: 'mazo-vote', yes: false });
  assert.ok(!gone(r, 0), 'con uno en contra todavía puede salir');
  await h.send(ws.u1, { t: 'mazo-vote', yes: true });
  assert.ok(gone(r, 0, 2, 4));
});

test('mazo 3v3: si dos dicen que no, no sale; y el pedido vence si no contestan', async () => {
  const { h, ws, r } = await table('3v3', { u0: 0, u1: 2, u2: 4 });
  await h.send(ws.u0, { t: 'act', a: { t: 'mazo' } });
  await h.send(ws.u1, { t: 'mazo-vote', yes: false });
  await h.send(ws.u2, { t: 'mazo-vote', yes: false });
  assert.equal(h.state(ws.u0).mazoVote, null);
  assert.ok(!gone(r, 0));
  await h.tick(TIMING.mazoCooldown + 100);
  if (r.game.h.phase === 'play' && !r.game.h.mazo[0]) {
    await h.send(ws.u0, { t: 'act', a: { t: 'mazo' } });
    assert.ok(h.state(ws.u1).mazoVote, 'se puede volver a pedir');
  }
});

test('mazo: el pedido es de esa mano; si la mano termina, se cae', async () => {
  const { h, ws, r } = await table('2v2', { u0: 0, u1: 2 });
  await h.send(ws.u0, { t: 'act', a: { t: 'mazo' } });
  assert.ok(h.state(ws.u1).mazoVote);
  // los rivales se van al mazo antes: la mano terminó
  assert.ok(act(r.game, 1, { t: 'mazo' }).ok);
  h.room.onGameChange();
  h.room.broadcastState();
  assert.equal(h.state(ws.u1).mazoVote, null);
  await h.send(ws.u1, { t: 'mazo-vote', yes: true });
  assert.ok(!gone(r, 0), 'no se fueron');
});

test('mazo 1v1: sigue siendo al toque', async () => {
  const { h, ws, r } = await table('1v1', { u0: 0 });
  await h.send(ws.u0, { t: 'act', a: { t: 'mazo' } });
  assert.ok(gone(r, 0));
});
