// La sala (src/truco-room.js) de punta a punta, con el banco de pruebas de test/helpers/room-harness.mjs:
// partidas con bots que no se traban, consulta al compañero, desconexiones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRoom } from './helpers/room-harness.mjs';
import { newGame, waitingFor } from '../public/js/engine.js';
import { botAction } from '../public/js/bot.js';
import { ASK_TALK } from '../public/js/talk.js';
import { TIMING } from '../public/js/config.js';

const answers = (kind) => [...ASK_TALK[kind].si, ...ASK_TALK[kind].callado, ...ASK_TALK[kind].nada];

// Sala 2v2: la persona u0 en el asiento 0 y tres bots. `dealer` fija quién reparte (y entonces quién es mano y pie).
async function table({ dealer = null, humans = ['u0'] } = {}) {
  const h = await makeRoom({ mode: '2v2' });
  const ws = [];
  for (const pid of humans) ws.push(await h.join(pid));
  await h.send(ws[0], { t: 'start', fillBots: true });
  const r = h.room.room;
  if (dealer != null) {
    r.game = newGame({ mode: '2v2', target: 15, dealer }, Math.random);
    r.dealUntil = h.now;
    r.botReadyAt = 0;
    h.room.broadcastState();
    await h.room.scheduleAlarm();
  }
  return { h, ws, r };
}

// La persona del asiento `seat` juega sola (con la cabeza de un bot) cuando le toca.
async function autoplay(h, ws, r, seat, ms) {
  for (let t = 0; t < ms && r.status === 'playing'; t += 300) {
    await h.tick(300);
    const g = r.game;
    if (g.h.phase === 'play' && waitingFor(g).seats.includes(seat) && h.now >= (r.dealUntil || 0)) {
      const a = botAction(g, seat, Math.random, {});
      if (a) await h.send(ws, { t: 'act', a });
    }
  }
}

test('sala: una partida 2v2 con tres bots se juega hasta el final sin trabarse', async () => {
  const { h, ws, r } = await table();
  await autoplay(h, ws[0], r, 0, 40 * 60_000);
  assert.equal(r.status, 'ended');
  assert.ok(Math.max(...r.game.score) >= 15);
});

test('sala: si le consultás al compañero bot cuando le toca, primero contesta y después juega', async () => {
  // reparte el 1: es mano el 2 (el compañero bot) y el pie del equipo es el 0 (la persona)
  const { h, ws, r } = await table({ dealer: 1 });
  assert.deepEqual(waitingFor(r.game).seats, [2]);
  assert.equal(h.state(ws[0]).ask.can.tantos, true);
  await h.send(ws[0], { t: 'ask', kind: 'tantos' });
  assert.ok(ASK_TALK.tantos.ask.includes(r.game && h.room.chat.at(-1).text));
  // hasta que contesta, el 2 no tira
  let answeredAt = null;
  for (let t = 0; t < 15_000 && !r.game.h.rounds[0].plays.some((p) => p.seat === 2); t += 100) {
    await h.tick(100);
    if (answeredAt == null && h.room.chat.some((c) => c.seat === 2 && answers('tantos').includes(c.text))) answeredAt = t;
    if (r.game.h.rounds[0].plays.some((p) => p.seat === 2)) assert.ok(answeredAt != null, 'jugó antes de contestar');
  }
  assert.ok(answeredAt != null, 'el compañero no contestó');
  // una sola consulta de tantos por mano
  assert.equal(h.state(ws[0]).ask.can.tantos, false);
});

test('sala: "¿Tienen tantos?" solo lo puede preguntar el que canta el envido (el pie)', async () => {
  // reparte el 2: los pies son el 2 y el 1; la persona (0) no es pie
  const { h, ws } = await table({ dealer: 2 });
  assert.equal(h.state(ws[0]).ask.can.tantos, false);
  assert.equal(h.state(ws[0]).ask.can.truco, true);
  const n = h.room.chat.length;
  await h.send(ws[0], { t: 'ask', kind: 'tantos' });
  assert.equal(h.room.chat.length, n); // no pasó nada
});

test('sala: el bot pie te consulta los tantos; si le decís callado, no canta envido', async () => {
  let asked = 0;
  for (let hand = 0; hand < 15 && !asked; hand++) {
    // reparte el 3: es mano la persona (0); el pie del equipo es el bot 2, con 33 de envido; los rivales, flojos
    const { h, ws, r } = await table({ dealer: 3 });
    const cards = [['4B', '5O', '6C'], ['4O', '5C', '6B'], ['7E', '6E', '4C'], ['4E', '5B', '6O']];
    r.game.h.cards = cards.map((c) => c.slice());
    r.game.h.inHand = cards.map((c) => c.slice());
    for (let t = 0; t < 20_000; t += 100) {
      const g = r.game;
      if (g.h.phase === 'play' && waitingFor(g).seats.includes(0) && !g.h.rounds[0].plays.length) await h.send(ws[0], { t: 'act', a: { t: 'play', card: '4B' } });
      await h.tick(100);
      const st = h.state(ws[0]);
      if (st?.ask?.open && !st.ask.open.mine && !st.ask.open.answered && st.ask.open.kind === 'tantos') {
        asked++;
        await h.send(ws[0], { t: 'answer', ans: 'callado' });
        assert.ok(ASK_TALK.tantos.callado.includes(h.room.chat.at(-1).text));
        break;
      }
      if (r.game.h.rounds[0].plays.some((p) => p.seat === 2) || r.game.h.envido.state !== 'none') break; // no consultó: otra mano
    }
    if (!asked) continue;
    // después de "callado", el 2 sigue (tira, canta truco...) pero no canta envido
    const ev0 = r.game.evId;
    const moved = () => r.game.ev.some((e) => e.id > ev0 && e.seat === 2 && (e.type === 'play' || e.type === 'call'));
    for (let t = 0; t < 15_000 && !moved(); t += 100) await h.tick(100);
    assert.ok(moved(), 'el bot no siguió jugando');
    assert.ok(r.game.h.envido.bySeat !== 2, 'cantó envido después de "callado"');
  }
  assert.ok(asked > 0, 'el bot nunca consultó');
});

test('sala: desconexión, cuenta regresiva, juega el bot y vuelve', async () => {
  const { h, ws, r } = await table({ humans: ['u0', 'u1'] });
  const seat1 = r.seats.findIndex((s) => s?.pid === 'u1');
  await h.disconnect(ws[1]);
  assert.match(h.chat().at(-1), /se desconectó.*juega un bot en su lugar/);
  const st = h.room.publicRoom(h.room.online()).seats[seat1];
  assert.equal(st.online, false);
  assert.equal(st.botIn, TIMING.afk);
  await h.tick(TIMING.afk + 1000);
  assert.ok(h.chat().some((c) => /no volvió: ahora juega un bot/.test(c)));
  assert.equal(h.room.publicRoom(h.room.online()).seats[seat1].botIn, 0);
  await h.join('u1');
  assert.match(h.chat().at(-1), /volvió: deja de jugar el bot/);
  assert.equal(h.room.publicRoom(h.room.online()).seats[seat1].botIn, null);
});

test('sala: tu compañero bot anota tus señas (y un rival solo si te estaba mirando)', async () => {
  const { h, ws, r } = await table({ dealer: 3 });
  await h.tick(200);
  h.room.gaze = { 1: 'table', 3: 0 }; // el 3 (rival) te está mirando; el 1 no
  await h.send(ws[0], { t: 'sena', sena: 'ancho_espada' });
  assert.deepEqual(r.senaSeen[2], [{ seat: 0, sena: 'ancho_espada' }]); // compañero: siempre
  assert.deepEqual(r.senaSeen[3], [{ seat: 0, sena: 'ancho_espada' }]); // rival que miraba
  assert.equal(r.senaSeen[1], undefined); // rival distraído
  assert.ok(h.room.botCtx(2).senas.some((x) => x.sena === 'ancho_espada'));
});

test('sala: si los bots fallan al decidir, juegan una de respaldo y la partida no se traba', async () => {
  const { h, ws, r } = await table();
  const real = h.room.botCtx.bind(h.room);
  h.room.botCtx = (s) => {
    const ctx = real(s);
    Object.defineProperty(ctx, 'senas', { get: () => { throw new Error('bot roto'); } });
    return ctx;
  };
  const err = console.error;
  const warn = console.warn;
  console.error = console.warn = () => {};
  try {
    await autoplay(h, ws[0], r, 0, 40 * 60_000);
  } finally {
    console.error = err;
    console.warn = warn;
  }
  assert.equal(r.status, 'ended');
});
