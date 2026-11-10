// Volver a una partida después de cortarse: que se pueda seguir jugando (contestar lo que te cantaron).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRoom } from './helpers/room-harness.mjs';
import { newGame, waitingFor, act } from '../public/js/engine.js';

// 1v1: la persona u0 (asiento 0) contra un bot; reparte el 0, así el bot (1) es mano.
async function table() {
  const h = await makeRoom({ mode: '1v1' });
  const ws = await h.join('u0');
  await h.send(ws, { t: 'start', fillBots: true });
  const r = h.room.room;
  r.game = newGame({ mode: '1v1', target: 30, dealer: 0 }, Math.random);
  r.dealUntil = h.now;
  r.botReadyAt = h.now + 60_000; // el bot no juega solo: lo movemos nosotros
  h.room.broadcastState();
  await h.room.scheduleAlarm();
  return { h, ws, r };
}

test('reconectar: te cantan truco mientras no estás y al volver lo podés contestar', async () => {
  const { h, ws, r } = await table();
  await h.disconnect(ws);
  // el bot canta truco mientras no está
  assert.ok(act(r.game, 1, { t: 'truco' }).ok);
  r.callAt = h.now;
  h.room.broadcastState();
  await h.room.scheduleAlarm();
  await h.tick(2000);
  const ws2 = await h.join('u0');
  await h.tick(300);
  const st = h.state(ws2);
  assert.equal(waitingFor(r.game).kind, 'truco', 'ya no se espera la respuesta');
  assert.ok(st.game.actions.quiero, 'al volver no tiene el botón de quiero');
  await h.send(ws2, { t: 'act', a: { t: 'quiero' } });
  assert.equal(r.game.h.truco.level, 2, 'no se aceptó el quiero');
  assert.equal(ws2.last('error'), null, 'el servidor rechazó la jugada');
});
