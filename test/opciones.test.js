// Opcionales de la sala: muestra, flor y "no permitir trampas".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rank, tanto, flor, piezaOf, validTanto } from '../public/js/cards.js';
import { newGame, act, actionsFor, waitingFor, viewFor, nextHand, closeShow } from '../public/js/engine.js';
import { botAction } from '../public/js/bot.js';

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

// Mano a mano con cartas fijas (el 0 es mano porque reparte el 1).
function fixed(cards, opts = {}) {
  const g = newGame({ mode: '1v1', dealer: 1, ...opts });
  g.h.cards = cards.map((c) => c.slice());
  g.h.inHand = cards.map((c) => c.slice());
  if ('muestra' in opts) g.h.muestra = opts.muestraCard ?? null;
  return g;
}

// ------------------------------------------------------------------ muestra

test('muestra: piezas por encima del ancho de espada, en orden 2 4 5 11 10', () => {
  const m = '7C'; // muestra: 7 de copa
  const order = ['2C', '4C', '5C', '11C', '10C', '1E', '1B', '7E', '7O', '3E'];
  for (let i = 1; i < order.length; i++) assert.ok(rank(order[i - 1], m) > rank(order[i], m), `${order[i - 1]} > ${order[i]}`);
  assert.equal(piezaOf('3C', m), null); // el 3 y el 6 de la muestra no son piezas
  assert.equal(piezaOf('12C', m), null); // el 12 solo cuenta si la muestra es pieza
  assert.equal(rank('2C'), rank('2E')); // sin muestra, un 2 es un 2
});

test('muestra: si la muestra es pieza, el 12 de ese palo toma su lugar', () => {
  const m = '4O';
  assert.equal(piezaOf('4O', m), null); // la muestra misma no está en juego
  assert.equal(piezaOf('12O', m), 4);
  assert.ok(rank('12O', m) > rank('5O', m) && rank('12O', m) < rank('2O', m));
});

test('muestra: envido con piezas', () => {
  const m = '7C';
  assert.equal(tanto(['4C', '3E', '6B'], m).value, 35); // 20 + 9 (4 de muestra) + 6
  assert.equal(tanto(['2C', '4C', '1E'], m).value, 39); // dos piezas: 20 + 10 + 9
  assert.equal(tanto(['10C', '12E', '11O'], m).value, 27); // pieza + figuras: 20 + 7
  assert.equal(tanto(['7E', '6E', '1B'], m).value, 33); // sin piezas, igual que siempre
  assert.ok(validTanto(39, m) && !validTanto(39) && !validTanto(34));
});

// ------------------------------------------------------------------ flor (valores)

test('flor: tres del mismo palo; con muestra, las piezas sirven de cualquier palo', () => {
  assert.equal(flor(['5E', '6E', '7E']).value, 38); // la mayor sin muestra
  assert.equal(flor(['10B', '11B', '12B']).value, 20); // la menor
  assert.equal(flor(['5E', '6E', '7O']), null);
  const m = '7C';
  assert.equal(flor(['2C', '6E', '7E'], m).value, 20 + 10 + 6 + 7); // pieza + dos del mismo palo
  assert.equal(flor(['2C', '4C', '3B'], m).value, 20 + 10 + 9 + 3); // dos piezas ya es flor
  assert.equal(flor(['2C', '6E', '7O'], m), null);
});

// ------------------------------------------------------------------ flor (cantos)

const F = { flor: true };

test('flor sin flor del otro lado: 3 puntos, y anula el envido', () => {
  const g = fixed([['5E', '6E', '7E'], ['4O', '5B', '12C']], F);
  // con flor no se puede tirar ni cantar envido: hay que cantarla
  const a = actionsFor(g, 0);
  assert.deepEqual(a.flor, ['flor']);
  assert.equal(a.play, false);
  assert.deepEqual(a.envido, []);
  assert.match(act(g, 0, { t: 'play', card: '5E' }).error, /flor/);
  ok(act(g, 0, { t: 'flor', kind: 'flor' }));
  assert.equal(g.h.flor.state, 'done');
  assert.equal(waitingFor(g).kind, 'play');
  assert.deepEqual(actionsFor(g, 1).envido, []); // con flor no hay envido
  ok(act(g, 0, { t: 'mazo' }));
  assert.deepEqual(g.score, [3, 1]); // 3 de flor; el truco (1) para el rival
});

test('flor contra flor: con flor quiero gana la mejor (3)', () => {
  const g = fixed([['10B', '11B', '12B'], ['5E', '6E', '7E']], F);
  ok(act(g, 0, { t: 'flor', kind: 'flor' }));
  assert.equal(waitingFor(g).kind, 'flor');
  assert.deepEqual(actionsFor(g, 1).flor, ['quiero', 'achico', 'contraflor', 'resto']);
  ok(act(g, 1, { t: 'flor', kind: 'quiero' }));
  assert.equal(g.h.flor.result.team, 1); // 38 > 20
  ok(act(g, 0, { t: 'mazo' }));
  assert.deepEqual(g.score, [0, 4]); // 3 de flor + 1 del truco
});

test('flor contra flor: me achico = 3 para el que cantó', () => {
  const g = fixed([['10B', '11B', '12B'], ['5E', '6E', '7E']], F);
  ok(act(g, 0, { t: 'flor', kind: 'flor' }));
  ok(act(g, 1, { t: 'flor', kind: 'achico' }));
  assert.equal(g.h.flor.result.team, 0);
  assert.equal(g.h.flor.result.pts, 3);
});

test('contraflor: quiero = 6 a la mejor; no quiero = 3 al que cantó contraflor', () => {
  let g = fixed([['10B', '11B', '12B'], ['5E', '6E', '7E']], F);
  ok(act(g, 0, { t: 'flor', kind: 'flor' }));
  ok(act(g, 1, { t: 'flor', kind: 'contraflor' }));
  assert.deepEqual(actionsFor(g, 0).flor, ['quiero', 'noquiero', 'resto']);
  ok(act(g, 0, { t: 'flor', kind: 'quiero' }));
  assert.deepEqual([g.h.flor.result.team, g.h.flor.result.pts], [1, 6]);

  g = fixed([['10B', '11B', '12B'], ['5E', '6E', '7E']], F);
  ok(act(g, 0, { t: 'flor', kind: 'flor' }));
  ok(act(g, 1, { t: 'flor', kind: 'contraflor' }));
  ok(act(g, 0, { t: 'flor', kind: 'noquiero' }));
  assert.deepEqual([g.h.flor.result.team, g.h.flor.result.pts], [1, 3]);
});

test('contraflor al resto: el que gana se lleva lo que le falta al que va ganando', () => {
  const g = fixed([['10B', '11B', '12B'], ['5E', '6E', '7E']], F);
  g.score = [12, 20];
  ok(act(g, 0, { t: 'flor', kind: 'flor' }));
  ok(act(g, 1, { t: 'flor', kind: 'resto' }));
  assert.deepEqual(actionsFor(g, 0).flor, ['quiero', 'noquiero']);
  ok(act(g, 0, { t: 'flor', kind: 'quiero' }));
  assert.deepEqual([g.h.flor.result.team, g.h.flor.result.pts], [1, 10]); // le faltaban 10 al que iba ganando
});

test('la flor está primero: contestando envido o truco se canta flor y el envido se anula', () => {
  let g = fixed([['4O', '5B', '12C'], ['5E', '6E', '7E']], F);
  ok(act(g, 0, { t: 'envido', kind: 'envido' }));
  assert.deepEqual(actionsFor(g, 1).flor, ['flor']);
  ok(act(g, 1, { t: 'flor', kind: 'flor' }));
  assert.equal(g.h.envido.state, 'cancelled');
  assert.equal(g.h.flor.state, 'done');

  g = fixed([['4O', '5B', '12C'], ['5E', '6E', '7E']], F);
  ok(act(g, 0, { t: 'truco' }));
  ok(act(g, 1, { t: 'flor', kind: 'flor' }));
  assert.equal(waitingFor(g).kind, 'truco'); // vuelve el truco pendiente
});

test('sin la opción de flor, tener tres del mismo palo no cambia nada', () => {
  const g = fixed([['5E', '6E', '7E'], ['4O', '5B', '12C']]);
  assert.deepEqual(actionsFor(g, 0).flor, []);
  assert.ok(actionsFor(g, 0).play);
  assert.ok(act(g, 0, { t: 'flor', kind: 'flor' }).error);
});

// ------------------------------------------------------------------ sin trampas

const NT = { trampas: false };

test('sin trampas: no se puede tirar dos encimadas ni pedir que muestre las dos', () => {
  const g = fixed([['1E', '4E', '5C'], ['3O', '6O', '12B']], NT);
  const a = actionsFor(g, 0);
  assert.equal(a.canDouble, false);
  assert.deepEqual(a.denunciar, []);
  assert.ok(act(g, 0, { t: 'play2', bottom: '4E', top: '1E' }).error);
});

test('sin trampas: no se puede mentir en el envido y no hace falta mostrar', () => {
  const g = fixed([['7E', '4C', '12O'], ['5O', '4O', '12B']], NT); // el 0 tiene 7
  ok(act(g, 0, { t: 'play', card: '12O' }));
  ok(act(g, 1, { t: 'envido', kind: 'envido' }));
  ok(act(g, 0, { t: 'quiero' }));
  const a = actionsFor(g, 0);
  assert.equal(a.lie, false);
  assert.match(act(g, 0, { t: 'cantar', value: 33 }).error, /mentir/);
  ok(act(g, 0, { t: 'cantar' })); // canta sus 7
  assert.equal(actionsFor(g, 1).cantar, true); // tiene 29: puede cantar
  ok(act(g, 1, { t: 'cantar' }));
  ok(act(g, 0, { t: 'mazo' }));
  assert.equal(g.h.phase, 'ended'); // sin fase de mostrar
  assert.deepEqual(g.score, [0, 3]);
});

test('sin trampas: se ve quién ganó cada ronda', () => {
  const g = fixed([['3E', '4E', '5C'], ['4O', '3O', '12B']], NT);
  ok(act(g, 0, { t: 'play', card: '3E' }));
  ok(act(g, 1, { t: 'play', card: '4O' }));
  assert.equal(viewFor(g, 1).h.rounds[0].result, 0);
  const g2 = fixed([['3E', '4E', '5C'], ['4O', '3O', '12B']]);
  ok(act(g2, 0, { t: 'play', card: '3E' }));
  ok(act(g2, 1, { t: 'play', card: '4O' }));
  assert.equal(viewFor(g2, 1).h.rounds[0].result, undefined); // con trampas permitidas, no
});

// ------------------------------------------------------------------ partidas completas

for (const mode of ['1v1', '2v2', '3v3']) {
  for (const opts of [{ flor: true, muestra: true }, { flor: true, muestra: false, trampas: false }, { muestra: true }]) {
    test(`partidas completas entre bots (${mode}, ${JSON.stringify(opts)})`, () => {
      for (let seed = 1; seed <= 25; seed++) {
        const rng = seeded(seed * 13 + mode.length);
        const g = newGame({ mode, target: 15, ...opts }, rng);
        let steps = 0;
        while (g.status === 'playing') {
          assert.ok(steps++ < 20000, 'la partida no termina');
          if (g.h.phase === 'ended') {
            nextHand(g, rng);
            if (opts.muestra) assert.ok(g.h.muestra, 'falta la muestra');
            continue;
          }
          const w = waitingFor(g);
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
          assert.ok(r.ok, `${mode} seed ${seed}: ${JSON.stringify(a)} -> ${r.error}`);
        }
        assert.equal(g.score[g.winner], g.target);
      }
    });
  }
}
