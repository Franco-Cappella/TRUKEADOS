// Pica-pica (opción de la sala, solo 3 vs 3): una mano redonda y una de pica-pica, en la que cada uno juega mano a
// mano contra el de enfrente (tres duelos seguidos). Ver docs/REGLAS.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, actionsFor, waitingFor, viewFor, nextHand, closeShow, picaDue, team } from '../public/js/engine.js';
import { botAction } from '../public/js/bot.js';
import { PICA_PICA, ROOM_OPTIONS, optionForMode, roomOptionsText } from '../public/js/config.js';
import { makeRoom } from './helpers/room-harness.mjs';

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ok = (r) => assert.ok(r.ok, r.error);

// Termina la mano de ahora: el que tiene que jugar se va al mazo (o se contesta lo que haya con "no quiero").
function endHand(g) {
  const w = waitingFor(g);
  ok(act(g, w.seats[0], { t: 'mazo' }));
  if (g.h.phase === 'show') closeShow(g);
  assert.equal(g.h.phase, 'ended');
}

// Partida 3v3 con pica-pica en la que ya toca (un equipo tiene 5) y reparte el 0.
function picaGame(opts = {}) {
  const g = newGame({ mode: '3v3', target: 30, dealer: 5, picapica: true, ...opts }, seeded(7));
  g.score = [PICA_PICA.from, 0];
  endHand(g); // termina la mano redonda 1
  g.score = [PICA_PICA.from, 0];
  g.dealer = 5; // nextHand pasa el mazo: reparte el 0
  nextHand(g, seeded(8));
  return g;
}

test('pica-pica: solo en 3 vs 3 y con la opción', () => {
  assert.equal(newGame({ mode: '2v2', picapica: true }).picapica, false);
  assert.equal(newGame({ mode: '1v1', picapica: true }).picapica, false);
  assert.equal(newGame({ mode: '3v3' }).picapica, false);
  assert.equal(newGame({ mode: '3v3', picapica: true }).picapica, true);
  const o = ROOM_OPTIONS.find((x) => x.key === 'picapica');
  assert.ok(o && o.def === false);
  assert.equal(optionForMode(o, '3v3'), true);
  assert.equal(optionForMode(o, '2v2'), false);
  assert.equal(roomOptionsText({ mode: '2v2', flor: false, muestra: false, picapica: true, trampas: true }), '');
  assert.equal(roomOptionsText({ mode: '3v3', flor: false, muestra: false, picapica: true, trampas: true }), 'con pica-pica');
});

test('pica-pica: se juega desde 5 hasta que a alguno le faltan 5', () => {
  const g = newGame({ mode: '3v3', target: 30, picapica: true });
  g.score = [4, 4];
  assert.equal(picaDue(g), false);
  g.score = [5, 0];
  assert.equal(picaDue(g), true);
  g.score = [24, 10];
  assert.equal(picaDue(g), true);
  g.score = [12, 25]; // las 10 buenas: solo redondas
  assert.equal(picaDue(g), false);
  g.picapica = false;
  g.score = [10, 10];
  assert.equal(picaDue(g), false);
});

test('pica-pica: una redonda, tres duelos contra el de enfrente (reparte el mismo) y otra redonda', () => {
  const g = picaGame();
  assert.equal(g.dealer, 0);
  const seen = [];
  for (let k = 0; k < 3; k++) {
    const d = g.h.duel;
    assert.ok(d, `falta el duelo ${k}`);
    assert.equal(d.k, k);
    assert.equal(g.dealer, 0, 'en los tres duelos reparte el mismo');
    const [a, b] = d.seats;
    assert.equal(a, (g.dealer + 1 + k) % 6, 'es mano el k-ésimo a la derecha del que reparte');
    assert.equal(b, (a + 3) % 6, 'contra el de enfrente');
    assert.notEqual(team(a), team(b));
    assert.equal(g.h.mano, a);
    for (let s = 0; s < 6; s++) {
      const plays = d.seats.includes(s);
      assert.equal(g.h.inHand[s].length, plays ? 3 : 0);
      assert.equal(g.h.mazo[s], !plays);
    }
    seen.push(a, b);
    endHand(g);
    nextHand(g, seeded(20 + k));
  }
  assert.deepEqual(seen.sort(), [0, 1, 2, 3, 4, 5], 'juegan los seis');
  assert.equal(g.h.duel, null, 'después del pica-pica viene una redonda');
  assert.equal(g.dealer, 1);
  assert.ok(g.h.inHand.every((c) => c.length === 3));
  endHand(g);
  nextHand(g);
  assert.ok(g.h.duel, 'y después de la redonda, otra vuelta de pica-pica');
});

test('pica-pica: en el duelo solo juegan los dos; los demás miran', () => {
  const g = picaGame();
  const [a, b] = g.h.duel.seats;
  const watcher = [0, 1, 2, 3, 4, 5].find((s) => !g.h.duel.seats.includes(s));
  assert.deepEqual(waitingFor(g).seats, [a]);
  const r = act(g, watcher, { t: 'truco' });
  assert.match(r.error, /pica-pica/);
  assert.equal(actionsFor(g, watcher).mazo, false);
  const v = viewFor(g, watcher);
  assert.deepEqual(v.h.duel.seats, [a, b]);
  assert.equal(v.h.myTanto, null);
  ok(act(g, a, { t: 'play', card: g.h.inHand[a][0] }));
  assert.deepEqual(waitingFor(g).seats, [b], 'después del mano juega su rival, no el de al lado');
});

test('pica-pica: el truco se canta desde primera y el envido lo canta cada uno', () => {
  const g = picaGame({ trucoDesdeSegunda: true });
  const [a, b] = g.h.duel.seats;
  const acts = actionsFor(g, a);
  assert.ok(acts.truco, 'en el duelo el truco se canta desde primera');
  assert.deepEqual(acts.envido, ['envido', 'real', 'falta']);
  ok(act(g, a, { t: 'envido', kind: 'envido' }));
  assert.deepEqual(waitingFor(g).seats, [b], 'contesta el de enfrente');
});

test('pica-pica: la falta envido vale 6 fija', () => {
  const g = picaGame({ trampas: false });
  const [a, b] = g.h.duel.seats;
  g.h.cards[a] = ['7E', '6E', '1O'];
  g.h.inHand[a] = g.h.cards[a].slice();
  g.h.cards[b] = ['4B', '5C', '12O'];
  g.h.inHand[b] = g.h.cards[b].slice();
  ok(act(g, a, { t: 'envido', kind: 'falta' }));
  ok(act(g, b, { t: 'quiero' }));
  while (waitingFor(g).kind === 'declare') ok(act(g, waitingFor(g).seats[0], { t: g.h.envido.declare.best ? 'buenas' : 'cantar' }));
  assert.equal(g.h.envido.points, PICA_PICA.falta);
  const before = g.score[team(a)];
  endHand(g);
  assert.ok(g.score[team(a)] >= before + PICA_PICA.falta);
});

test('pica-pica: sin la opción, en 3 vs 3 todas las manos son redondas', () => {
  const rng = seeded(3);
  const g = newGame({ mode: '3v3', target: 30 }, rng);
  g.score = [10, 10];
  for (let i = 0; i < 6; i++) {
    endHand(g);
    g.score = [10, 10];
    nextHand(g, rng);
    assert.equal(g.h.duel, null);
  }
});

test('pica-pica: partidas completas entre bots (con y sin trampas, flor y muestra)', () => {
  for (const opts of [{}, { trampas: false }, { flor: true, muestra: true }]) {
    let duels = 0;
    for (let seed = 1; seed <= 15; seed++) {
      const rng = seeded(seed * 31);
      const g = newGame({ mode: '3v3', target: 30, picapica: true, ...opts }, rng);
      let steps = 0;
      while (g.status === 'playing') {
        assert.ok(steps++ < 20000, 'la partida no termina');
        if (g.h.phase === 'ended') {
          nextHand(g, rng);
          if (g.h.duel) duels++;
          continue;
        }
        const w = waitingFor(g);
        if (g.h.duel) for (const s of w.seats) assert.ok(g.h.duel.seats.includes(s), 'en el duelo solo juegan los dos');
        if (w.kind === 'show') {
          const a = botAction(g, w.seats[0], rng);
          if (!a) closeShow(g);
          else ok(act(g, w.seats[0], a));
          continue;
        }
        const seat = w.seats[Math.floor(rng() * w.seats.length)];
        const a = botAction(g, seat, rng);
        assert.ok(a, `bot sin acción en ${w.kind}`);
        const r = act(g, seat, a);
        assert.ok(r.ok, `seed ${seed}: ${JSON.stringify(a)} -> ${r.error}`);
      }
      assert.equal(g.score[g.winner], g.target);
    }
    assert.ok(duels > 0, 'se jugó algún duelo');
  }
});

// Una sala 3v3 con la persona u0 (que juega con la cabeza de un bot) y cinco bots, con pica-pica, hasta el final.
async function playRoom() {
  const h = await makeRoom({ mode: '3v3' });
  const ws = await h.join('u0');
  await h.send(ws, { t: 'config', cfg: { picapica: true, target: 30 } });
  const r = h.room.room;
  assert.equal(r.cfg.picapica, true);
  await h.send(ws, { t: 'start', fillBots: true });
  assert.equal(r.game.picapica, true);
  r.game.score = [PICA_PICA.from, 0]; // ya toca: después de esta mano redonda viene el pica-pica
  const me = r.seats.findIndex((x) => x && !x.bot);
  let duel = false;
  for (let t = 0; t < 60 * 60_000 && r.status === 'playing'; t += 300) {
    await h.tick(300);
    const g = r.game;
    if (g.h.duel) duel = true;
    if (me >= 0 && g.h.phase === 'play' && waitingFor(g).seats.includes(me) && h.now >= (r.dealUntil || 0)) {
      const a = botAction(g, me, Math.random, {});
      if (a) await h.send(ws, { t: 'act', a });
    }
  }
  assert.equal(r.status, 'ended', 'la partida se traba');
  return duel;
}

test('sala: el anfitrión activa el pica-pica y la partida 3v3 con bots se juega hasta el final', async () => {
  // una falta envido en la primera mano puede saltear la ventana del pica-pica: se prueba hasta que haya duelos
  let duel = false;
  for (let i = 0; i < 6 && !duel; i++) duel = await playRoom();
  assert.ok(duel, 'se jugó pica-pica');
});
