// La sala (src/truco-room.js) de punta a punta, con el banco de pruebas de test/helpers/room-harness.mjs:
// partidas con bots que no se traban, consulta al compañero, desconexiones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRoom } from './helpers/room-harness.mjs';
import { newGame, waitingFor } from '../public/js/engine.js';
import { botAction } from '../public/js/bot.js';
import { ASK_TALK, TELL_TANTOS } from '../public/js/talk.js';
import { TIMING } from '../public/js/config.js';

const answers = (kind) => [...ASK_TALK[kind].si, ...ASK_TALK[kind].callado, ...ASK_TALK[kind].nada];

// Sala 2v2: la persona u0 en el asiento 0 y tres bots. `dealer` fija quién reparte (y entonces quién es mano y pie).
async function table({ dealer = null, humans = ['u0'], trucoDesdeSegunda = false } = {}) {
  const h = await makeRoom({ mode: '2v2' });
  const ws = [];
  for (const pid of humans) ws.push(await h.join(pid));
  await h.send(ws[0], { t: 'start', fillBots: true });
  const r = h.room.room;
  if (dealer != null) {
    r.game = newGame({ mode: '2v2', target: 15, dealer, trucoDesdeSegunda }, Math.random);
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

test('sala: lo que tenés que contestar vos no lo contesta nadie por vos', async () => {
  const { h, ws, r } = await table({ dealer: 1 });
  r.game.h.envido = { ...r.game.h.envido, state: 'pending', calls: ['envido'], by: 1, bySeat: 1 };
  r.callAt = h.now;
  const w = waitingFor(r.game);
  assert.equal(w.kind, 'envido');
  assert.deepEqual(w.seats, [0]);
  await h.room.scheduleAlarm();
  await h.tick(90_000, 500);
  assert.equal(r.game.h.envido.state, 'pending', 'se contestó solo');
  await h.send(ws[0], { t: 'act', a: { t: 'quiero' } });
  assert.notEqual(r.game.h.envido.state, 'pending');
});

test('sala: el truco pendiente de los dos lo contesta el bot recién pasado un buen rato', async () => {
  const { h, r } = await table({ dealer: 1 });
  r.game.h.truco.pending = { level: 2, byTeam: 1, bySeat: 1 };
  r.callAt = h.now;
  assert.deepEqual([...waitingFor(r.game).seats].sort(), [0, 2]);
  await h.room.scheduleAlarm();
  await h.tick(TIMING.partnerAnswer - 2000, 500);
  assert.ok(r.game.h.truco.pending, 'contestó demasiado rápido');
});

test('sala: si el compañero bot tiene tantos, le avisa al pie "Cantámelo que tengo" sin que le pregunten', async () => {
  let told = 0;
  for (let i = 0; i < 12 && !told; i++) {
    const { h, r } = await table({ dealer: 1, trucoDesdeSegunda: true });
    const g = r.game;
    g.h.cards = [['4B', '5O', '6C'], ['4O', '5C', '6B'], ['7E', '6E', '4C'], ['4E', '5B', '6O']];
    g.h.inHand = g.h.cards.map((c) => c.slice());
    for (let t = 0; t < 6000 && !g.h.rounds[0].plays.some((p) => p.seat === 2); t += 100) {
      await h.tick(100);
      if (h.room.chat.some((c) => c.seat === 2 && TELL_TANTOS.includes(c.text))) {
        told++;
        break;
      }
      if (g.h.envido.state !== 'none' || g.h.phase !== 'play') break;
    }
  }
  assert.ok(told > 0, 'nunca avisó');
});

test('sala: si el ganador del envido se queda sin tiempo, recién ahí se le puede reclamar', async () => {
  const { h, ws, r } = await table({ dealer: 1 });
  const g = r.game;
  g.h.phase = 'show';
  g.h.show = { seat: 0, value: 30 };
  g.h.envido = { ...g.h.envido, state: 'done', needsShow: true, winnerSeat: 0, saidValue: 30 };
  r.showSince = h.now;
  await h.room.scheduleAlarm();
  await h.tick(TIMING.showWindow - 1000, 500);
  assert.equal(g.h.show.folded, undefined);
  await h.tick(1500, 500);
  assert.equal(g.h.show.folded, true);
  assert.ok(ws[0]);
});

test('sala: una jugada que llega mientras reparten se rechaza y se manda el estado (el cliente corrige la carta pintada)', async () => {
  const h = await makeRoom({ mode: '1v1', target: 30 });
  const w0 = await h.join('u0');
  await h.join('u1');
  await h.send(w0, { t: 'start', fillBots: false });
  const r = h.room.room;
  assert.ok(r.dealUntil > h.now, 'todavía están repartiendo');
  w0.got.length = 0;
  await h.send(w0, { t: 'act', a: { t: 'play', card: r.game.h.inHand[0][0], mode: 'normal' } });
  assert.ok(w0.got.some((m) => m.t === 'error'), 'la jugada se rechaza mientras reparten');
  assert.ok(w0.got.some((m) => m.t === 'state'), 'y el servidor manda el estado real para que la carta pintada vuelva a la mano');
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
  [r.seats[1], r.seats[2]] = [r.seats[2], r.seats[1]]; // compañeros: si se va uno, sigue el otro
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

test('sala: "¿Le canto truco?" solo cuando tu equipo lo puede cantar y todavía no tiraste en la ronda', async () => {
  // reparte el 3: es mano la persona (0)
  const { h, ws, r } = await table({ dealer: 3 });
  h.room.broadcastState();
  assert.equal(h.state(ws[0]).ask.can.truco, true);
  // si el truco lo tienen los rivales (lo quisieron ellos), tu equipo no lo puede subir
  r.game.h.truco.level = 2;
  r.game.h.truco.holder = 1;
  h.room.broadcastState();
  assert.equal(h.state(ws[0]).ask.can.truco, false);
  r.game.h.truco.holder = 0;
  h.room.broadcastState();
  assert.equal(h.state(ws[0]).ask.can.truco, true);
  // ya tiraste en esta ronda: no tiene sentido preguntar
  await h.send(ws[0], { t: 'act', a: { t: 'play', card: r.game.h.inHand[0][0] } });
  assert.equal(h.state(ws[0]).ask.can.truco, false);
});

// Fija las cartas de la mano (asientos 0..3).
const deal = (r, cards) => {
  r.game.h.cards = cards.map((c) => c.slice());
  r.game.h.inHand = cards.map((c) => c.slice());
};

for (const [ans, expected] of [['ir', '4C'], ['poner', '1E']]) {
  test(`sala: el compañero bot te pregunta "¿pongo o voy?" (sos pie); le decís ${ans === 'ir' ? '"Vení"' : '"Poné"'} y tira ${expected}`, async () => {
    let asked = 0;
    for (let hand = 0; hand < 20 && !asked; hand++) {
      // reparte el 1: es mano el 2 (compañero bot, no pie) y el pie del equipo sos vos (0). Como en las salas de
      // equipo, el truco se canta desde segunda (si no, con el ancho el bot canta truco antes de tirar)
      const { h, ws, r } = await table({ dealer: 1, trucoDesdeSegunda: true });
      deal(r, [['4B', '5O', '6C'], ['4O', '5C', '6B'], ['1E', '4C', '5E'], ['4E', '5B', '6O']]);
      for (let t = 0; t < 20_000; t += 100) {
        await h.tick(100);
        const q = h.state(ws[0])?.ask?.open;
        if (q?.kind === 'primera' && q.mineToAnswer && !q.answered) {
          asked++;
          assert.ok(ASK_TALK.primera.ask.includes(h.room.chat.find((c) => c.seat === 2 && ASK_TALK.primera.ask.includes(c.text))?.text));
          await h.send(ws[0], { t: 'answer', ans });
          assert.ok(ASK_TALK.primera[ans].includes(h.room.chat.at(-1).text));
          break;
        }
        if (r.game.h.rounds[0].plays.some((p) => p.seat === 2) || r.game.h.phase !== 'play') break; // no preguntó: otra mano
      }
      if (!asked) continue;
      for (let t = 0; t < 20_000 && !r.game.h.rounds[0].plays.some((p) => p.seat === 2) && r.game.h.phase === 'play'; t += 100) {
        await h.tick(100);
        // si le cantan algo a la persona, contesta "no quiero" (para que siga la mano)
        const w = waitingFor(r.game);
        if (w.seats.includes(0) && w.kind !== 'play') await h.send(ws[0], { t: 'act', a: { t: 'noquiero' } });
      }
      const play = r.game.h.rounds[0].plays.find((p) => p.seat === 2);
      if (!play) {
        asked = 0; // se terminó la mano por un truco no querido: otra
        continue;
      }
      assert.equal(play.c, expected);
    }
    assert.ok(asked > 0, 'el bot nunca preguntó');
  });
}

test('sala: le preguntás al pie bot "¿pongo o voy?" y te contesta con un clic (vení si tiene con qué)', async () => {
  // reparte el 2: es mano el 3, después vos (0); el pie de tu equipo es el bot 2, que tiene el ancho de espada
  const { h, ws, r } = await table({ dealer: 2 });
  deal(r, [['4B', '5O', '6C'], ['4O', '5C', '6B'], ['1E', '4C', '5E'], ['4E', '5B', '6O']]);
  h.room.broadcastState();
  const st = h.state(ws[0]).ask;
  assert.equal(st.can.primera, true);
  assert.equal(st.can.tantos, false); // no sos pie
  await h.send(ws[0], { t: 'ask', kind: 'primera' });
  assert.ok(ASK_TALK.primera.ask.includes(h.room.chat.at(-1).text));
  await h.tick(TIMING.askBotAnswer + 1500);
  assert.ok(h.room.chat.some((c) => c.seat === 2 && ASK_TALK.primera.ir.includes(c.text)), h.chat().slice(-3).join(' | '));
  assert.equal(h.state(ws[0]).ask.can.primera, false); // una vez por mano
});

test('sala: "¿pongo o voy?" no lo tiene el pie ni se puede en 1v1', async () => {
  const { h, ws } = await table({ dealer: 1 }); // sos pie
  assert.equal(h.state(ws[0]).ask.can.primera, false);
  const one = await makeRoom({ mode: '1v1' });
  const w1 = await one.join('u0');
  await one.send(w1, { t: 'start', fillBots: true });
  one.room.broadcastState();
  assert.equal(one.state(w1).ask.can.primera, false);
});

test('sala: en 3v3 "¿pongo o voy?" lo contesta solo el pie (no el otro compañero)', async () => {
  const h = await makeRoom({ mode: '3v3' });
  const ws = await h.join('u0');
  await h.send(ws, { t: 'start', fillBots: true });
  const r = h.room.room;
  // reparte el 3: el pie de tu equipo (0, 2, 4) es el bot 2
  r.game = newGame({ mode: '3v3', target: 15, dealer: 3 }, Math.random);
  r.dealUntil = h.now;
  r.botReadyAt = h.now + 60_000; // que los bots no jueguen mientras tanto
  h.room.broadcastState();
  assert.equal(h.state(ws).ask.can.primera, true);
  await h.send(ws, { t: 'ask', kind: 'primera' });
  r.asks[0].botDue = h.now; // que contesten ya
  h.room.botAnswers(h.now);
  const said = h.room.chat.filter((c) => [...ASK_TALK.primera.poner, ...ASK_TALK.primera.ir].includes(c.text));
  assert.deepEqual(said.map((c) => c.seat), [2]);
  assert.equal(r.asks[0].done, true);
});

const CANTO = ['nada', 'vos', 'algo', 'cargado'].flatMap((k) => ASK_TALK.canto[k]);

test('sala: te cantan envido y le preguntás al compañero bot "¿queremos?": contesta y no te contesta el canto', async () => {
  const { h, ws, r } = await table({ dealer: 1 });
  r.game.h.envido = { ...r.game.h.envido, state: 'pending', calls: ['envido'], by: 1, bySeat: 1 };
  r.callAt = h.now;
  h.room.broadcastState();
  assert.equal(h.state(ws[0]).ask.can.canto, true);
  await h.send(ws[0], { t: 'ask', kind: 'canto' });
  assert.ok(ASK_TALK.canto.ask.includes(h.room.chat.at(-1).text));
  assert.equal(h.state(ws[0]).ask.can.canto, false);
  await h.tick(4000);
  assert.ok(h.room.chat.some((c) => c.seat === 2 && CANTO.includes(c.text)), 'el compañero no contestó');
  assert.equal(r.game.h.envido.state, 'pending', 'sigue siendo tuyo contestar');
});

test('sala: con el truco, si lo suben se puede volver a preguntar', async () => {
  const { h, ws, r } = await table({ dealer: 1 });
  const tr = r.game.h.truco;
  tr.pending = { level: 2, byTeam: 1, bySeat: 1 };
  r.callAt = h.now;
  h.room.broadcastState();
  await h.send(ws[0], { t: 'ask', kind: 'canto' });
  await h.tick(TIMING.askWait + 500);
  assert.equal(h.room.canAsk(0, 'canto'), false, 'dos veces por el mismo canto');
  tr.pending = { level: 3, byTeam: 1, bySeat: 1 };
  assert.equal(h.room.canAsk(0, 'canto'), true);
});

test('sala: entre personas, el compañero contesta con un toque y no se puede preguntar si no te cantaron nada', async () => {
  const { h, ws, r } = await table({ dealer: 1, humans: ['u0', 'u1'] });
  [r.seats[1], r.seats[2]] = [r.seats[2], r.seats[1]];
  assert.equal(h.room.canAsk(0, 'canto'), false);
  r.game.h.truco.pending = { level: 2, byTeam: 1, bySeat: 1 };
  r.callAt = h.now;
  await h.send(ws[0], { t: 'ask', kind: 'canto' });
  const q = h.state(ws[1]).ask.open;
  assert.ok(q.mineToAnswer && q.kind === 'canto');
  await h.send(ws[1], { t: 'answer', ans: 'cargado' });
  assert.ok(ASK_TALK.canto.cargado.includes(h.room.chat.at(-1).text));
});

test('sala: las respuestas al "¿queremos?" le sirven al bot que preguntó', async () => {
  const { h, r } = await table({ dealer: 1 });
  const T = 1;
  r.game.h.truco.pending = { level: 2, byTeam: 0, bySeat: 0 };
  r.asks = { [T]: { seat: 1, kind: 'canto', on: 'truco', hand: r.game.handNo, at: h.now, answers: { 3: 'cargado' }, botDue: 0 } };
  assert.deepEqual(h.room.askSenas(1), [{ seat: 3, sena: 'truco_si' }]);
  r.asks[T].on = 'envido';
  r.asks[T].answers = { 3: 'nada' };
  assert.deepEqual(h.room.askSenas(1), [{ seat: 3, sena: 'nada_envido' }]);
  r.asks[T].answers = { 3: 'vos' };
  assert.deepEqual(h.room.askSenas(1), []);
});

test('sala: "callado" sabe si los rivales todavía pueden cantar', async () => {
  // reparte el 0: es mano el 1 y los pies son el 0 (nosotros) y el 3 (ellos), que tira antes
  const { h, r } = await table({ dealer: 0 });
  const tantos = { seat: 0, kind: 'tantos' };
  const truco = { seat: 0, kind: 'truco' };
  assert.equal(h.room.rivalsCan(tantos), true);
  r.game.h.rounds[0].plays.push({ seat: 3, c: '4E' }); // su pie ya tiró: se le pasó el envido
  assert.equal(h.room.rivalsCan(tantos), false);
  assert.equal(h.room.rivalsCan(truco), true);
  r.game.h.truco.level = 2; // el quiero es nuestro
  assert.equal(h.room.rivalsCan(truco), false);
  r.game.h.truco.level = 1;
  r.game.h.r = 2; // en tercera, si ya tiraron todos los rivales no les queda turno
  r.game.h.rounds[2] = { plays: [{ seat: 1, c: '4C' }, { seat: 3, c: '5C' }] };
  assert.equal(h.room.rivalsCan(truco), false);
});

test('sala: en 3 vs 3 los bots pie no hacen señas, y los demás se las hacen a su pie', async () => {
  const h = await makeRoom({ mode: '3v3' });
  const me = await h.join('u0');
  await h.send(me, { t: 'start', fillBots: true });
  const r = h.room.room;
  r.game = newGame({ mode: '3v3', target: 15, dealer: 2 }, Math.random);
  r.dealUntil = h.now;
  const pies = [2, 1]; // el que reparte y el que corta (dealer - 1)
  const sent = [];
  h.room.deliverSena = (seat, sena) => sent.push({ seat, sena, gaze: h.room.gaze[seat] });
  r.botSenaDue = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  h.room.botSenas(h.now + 10);
  const from = sent.map((s) => s.seat).sort();
  assert.deepEqual(from, [3, 4, 5], 'solo los que no son pie');
  for (const s of sent) assert.ok(pies.includes(s.gaze) && s.gaze % 2 === s.seat % 2, `el ${s.seat} mira a su pie`);
});
