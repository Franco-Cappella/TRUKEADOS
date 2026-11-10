// Ausentes: pestaña oculta (sigue conectado) y tantos que se cantan solos; "mostrá lo que tenías"; encimadas que
// valen si gana el equipo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRoom } from './helpers/room-harness.mjs';
import { newGame, waitingFor, act, actionsFor, viewFor, tanto } from '../public/js/engine.js';
import { honestTanto } from '../public/js/bot.js';
import { TIMING } from '../public/js/config.js';
import { encodeGif, quantize } from '../public/js/gif.js';
import { parseGif } from '../src/social.js';

const ok = (r) => assert.ok(r.ok, r.error);

// 1v1: la persona u0 (asiento 0) contra un bot. Reparte el 1: es mano la persona.
async function table(cards) {
  const h = await makeRoom({ mode: '1v1' });
  const ws = await h.join('u0');
  await h.send(ws, { t: 'start', fillBots: true });
  const r = h.room.room;
  r.game = newGame({ mode: '1v1', target: 30, dealer: 1, trampas: false }, Math.random);
  if (cards) {
    r.game.h.cards = cards.map((c) => c.slice());
    r.game.h.inHand = cards.map((c) => c.slice());
  }
  r.dealUntil = h.now;
  r.botReadyAt = 0;
  h.room.onGameChange();
  h.room.broadcastState();
  await h.room.scheduleAlarm();
  return { h, ws, r };
}

test('pestaña oculta: corre la cuenta y después juega un bot por vos (sin perder la partida)', async () => {
  const { h, ws, r } = await table();
  assert.deepEqual(waitingFor(r.game).seats, [0]);
  await h.send(ws, { t: 'away', on: true });
  const evBefore = r.game.evId;
  const plate = h.state(ws).room.seats[0];
  assert.equal(plate.away, true);
  assert.ok(plate.botIn > 0 && plate.botIn <= TIMING.afk);
  await h.tick(TIMING.afk - 2000);
  assert.deepEqual(waitingFor(r.game).seats, [0], 'jugó por vos antes de la cuenta');
  await h.tick(6000);
  assert.ok(r.game.ev.some((e) => e.id > evBefore && e.seat === 0 && ['play', 'call', 'mazo', 'tanto'].includes(e.type)), 'no jugó nadie por vos');
  assert.equal(r.status, 'playing', 'con la pestaña oculta no se pierde la partida');
  assert.ok(h.chat().some((c) => /no está mirando/.test(c)));
  await h.send(ws, { t: 'away', on: false });
  assert.equal(h.state(ws).room.seats[0].away, false);
});

test('pestaña oculta: si volvés antes de la cuenta, no juega nadie por vos', async () => {
  const { h, ws, r } = await table();
  await h.send(ws, { t: 'away', on: true });
  await h.tick(TIMING.afk / 2);
  await h.send(ws, { t: 'away', on: false });
  await h.tick(TIMING.afk);
  assert.deepEqual(waitingFor(r.game).seats, [0]);
  assert.equal(r.game.h.rounds[0].plays.length, 0);
});

test('tantos de un ausente: a los 10 s se cantan solos, sin mentir', async () => {
  // la persona tiene 33 y canta envido; el bot quiere y canta primero... acá forzamos el orden: canta la persona
  const { h, ws, r } = await table([['7E', '6E', '4C'], ['1O', '4B', '5C']]);
  ok(act(r.game, 0, { t: 'envido', kind: 'envido' }));
  ok(act(r.game, 1, { t: 'quiero' }));
  h.room.onGameChange();
  assert.equal(waitingFor(r.game).kind, 'declare');
  assert.deepEqual(waitingFor(r.game).seats, [0]); // la mano canta primero
  await h.send(ws, { t: 'away', on: true });
  assert.equal(h.state(ws).room.seats[0].tantoIn, true);
  await h.tick(TIMING.autoTanto - 1500);
  assert.equal(waitingFor(r.game).kind, 'declare', 'se cantaron antes de tiempo');
  await h.tick(3000);
  const said = r.game.h.envido.declare?.said || [];
  assert.equal(said[0]?.seat, 0);
  assert.equal(said[0]?.value, 33, 'se cantó otro número');
});

test('tantos solos: lo que tiene si gana, "son buenas" si no', () => {
  const g = newGame({ mode: '1v1', dealer: 1 });
  g.h.cards = [['7E', '6E', '4C'], ['1O', '4B', '5C']];
  g.h.inHand = g.h.cards.map((c) => c.slice());
  ok(act(g, 0, { t: 'envido', kind: 'envido' }));
  ok(act(g, 1, { t: 'quiero' }));
  assert.deepEqual(honestTanto(g, 0), { t: 'cantar', value: 33 });
  ok(act(g, 0, honestTanto(g, 0)));
  assert.deepEqual(honestTanto(g, 1), { t: 'buenas' });
});

test('mostrá lo que tenías: terminada la mano, se dan vuelta las cartas que no tiraste', () => {
  const g = newGame({ mode: '1v1', dealer: 1 });
  g.h.cards = [['1E', '7E', '3C'], ['4B', '5C', '6O']];
  g.h.inHand = g.h.cards.map((c) => c.slice());
  assert.equal(actionsFor(g, 0).lucir, false, 'en la mano no se puede');
  ok(act(g, 0, { t: 'truco' }));
  ok(act(g, 1, { t: 'noquiero' }));
  assert.equal(g.h.phase, 'ended');
  const score = g.score.slice();
  assert.equal(actionsFor(g, 0).lucir, true);
  ok(act(g, 0, { t: 'lucir' }));
  assert.deepEqual(g.score, score, 'cambió el tanteador');
  const seen = viewFor(g, 1).h.table[0].map((p) => p.c).sort();
  assert.deepEqual(seen, ['1E', '3C', '7E']);
  assert.equal(actionsFor(g, 0).lucir, false, 'ya no le queda nada para mostrar');
  assert.equal(g.ev.at(-1).type, 'lucir');
});

test('encimadas: si la ronda la gana tu compañero, la de arriba no se quema', () => {
  // 2v2, reparte el 3: el 0 es mano. El 0 tira dos encimadas (abajo un 4), el 2 (compañero) mata con el ancho.
  const g = newGame({ mode: '2v2', dealer: 3 });
  g.h.cards = [['4E', '5C', '6B'], ['3E', '6O', '7C'], ['1E', '4O', '5B'], ['3O', '4C', '5E']];
  g.h.inHand = g.h.cards.map((c) => c.slice());
  ok(act(g, 0, { t: 'play2', bottom: '4E', top: '5C' }));
  ok(act(g, 1, { t: 'play', card: '3E' }));
  ok(act(g, 2, { t: 'play', card: '1E' }));
  ok(act(g, 3, { t: 'play', card: '3O' }));
  assert.equal(g.h.rounds[0].result, 0);
  assert.equal(g.h.table[0].find((p) => p.over).burned, false);
});

test('encimadas: si la ronda la pierde tu equipo, la de arriba se quema', () => {
  const g = newGame({ mode: '1v1', dealer: 1 });
  g.h.cards = [['4E', '5C', '6B'], ['3E', '6O', '7C']];
  g.h.inHand = g.h.cards.map((c) => c.slice());
  ok(act(g, 0, { t: 'play2', bottom: '4E', top: '5C' }));
  ok(act(g, 1, { t: 'play', card: '3E' }));
  assert.equal(g.h.table[0].find((p) => p.over).burned, true);
});

// Decodificador de GIF mínimo (para verificar el que arma gif.js).
function decodeFrames(b) {
  let p = 13 + 768;
  const frames = [];
  const w = b[6] | (b[7] << 8);
  const h = b[8] | (b[9] << 8);
  while (p < b.length) {
    const t = b[p++];
    if (t === 0x3b) break;
    if (t === 0x21) {
      p++;
      while (b[p]) p += b[p] + 1;
      p++;
      continue;
    }
    assert.equal(t, 0x2c, 'bloque inesperado');
    p += 9;
    const min = b[p++];
    const data = [];
    while (b[p]) {
      for (let i = 1; i <= b[p]; i++) data.push(b[p + i]);
      p += b[p] + 1;
    }
    p++;
    const clear = 1 << min;
    const eoi = clear + 1;
    let size;
    let dict;
    let prev;
    let bit = 0;
    const out = [];
    const reset = () => {
      dict = Array.from({ length: clear }, (_, i) => [i]);
      dict.push([], null);
      size = min + 1;
      prev = null;
    };
    reset();
    for (;;) {
      let code = 0;
      for (let i = 0; i < size; i++) code |= ((data[(bit + i) >> 3] >> ((bit + i) & 7)) & 1) << i;
      bit += size;
      if (code === clear) {
        reset();
        continue;
      }
      if (code === eoi) break;
      const entry = code < dict.length ? dict[code] : prev.concat(prev[0]);
      out.push(...entry);
      if (prev) {
        dict.push(prev.concat(entry[0]));
        if (dict.length === 1 << size && size < 12) size++;
      }
      prev = entry;
    }
    assert.equal(out.length, w * h);
    frames.push(out);
  }
  return frames;
}

test('GIF: lo que arma gif.js se lee igual y el servidor lo acepta', () => {
  const w = 64;
  const src = [];
  let seed = 1;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32) * 255;
  for (let f = 0; f < 8; f++) {
    const px = new Uint8ClampedArray(w * w * 4);
    for (let i = 0; i < w * w; i++) px.set([rnd(), (i * 7 + f) & 255, rnd(), 255], i * 4);
    src.push({ indices: quantize(px, w, w), delay: 60 });
  }
  const bytes = encodeGif(w, w, src);
  const dec = decodeFrames(bytes);
  assert.equal(dec.length, src.length);
  for (let f = 0; f < src.length; f++) assert.deepEqual(dec[f], Array.from(src[f].indices));
  assert.ok(parseGif('data:image/gif;base64,' + Buffer.from(bytes).toString('base64')));
});

test('tanto() sigue igual para los tantos solos', () => {
  assert.equal(tanto(['7E', '6E', '4C']).value, 33);
});

test('irse al mazo mostrando: se da vuelta lo que no tiraste y no cambia el tanteador', () => {
  const g = newGame({ mode: '1v1', dealer: 1 });
  g.h.cards = [['1E', '7E', '3C'], ['4B', '5C', '6O']];
  g.h.inHand = g.h.cards.map((c) => c.slice());
  ok(act(g, 0, { t: 'play', card: '3C' }));
  ok(act(g, 1, { t: 'play', card: '4B' }));
  const before = g.score.slice();
  ok(act(g, 0, { t: 'mazo', show: true }));
  assert.equal(g.h.phase, 'ended');
  assert.deepEqual(g.score.map((v, i) => v - before[i]), [0, 1], 'el mazo vale lo mismo');
  const seen = viewFor(g, 1).h.table[0].map((p) => p.c).sort();
  assert.deepEqual(seen, ['1E', '3C', '7E']);
  assert.ok(g.ev.some((e) => e.type === 'lucir' && e.seat === 0));
});
