import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, rank, tanto, handWinner, waitingFor, viewFor, nextHand, actionsFor, closeShow, isPie, playValue, BURNED_VALUE } from '../public/js/engine.js';
import { botAction } from '../public/js/bot.js';

// RNG con semilla para que los tests sean reproducibles.
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

// Arma una mano a mano con cartas fijas (asiento 0 = mano porque reparte el 1).
function fixed(cards, opts = {}) {
  const g = newGame({ mode: opts.mode || '1v1', dealer: opts.dealer ?? 1, target: opts.target || 30 });
  g.h.cards = cards.map((c) => c.slice());
  g.h.inHand = cards.map((c) => c.slice());
  if (opts.score) g.score = opts.score.slice();
  return g;
}
const ok = (r) => assert.ok(r.ok, r.error);

// Termina la mano yéndose al mazo todo un equipo (para probar lo que se anota al final).
const mazoAll = (g, t) => {
  for (let s = 0; s < g.n; s++) if (s % 2 === t && !g.h.mazo[s] && g.h.phase === 'play') ok(act(g, s, { t: 'mazo' }));
};

// El 0 (mano) tira su última carta para que le toque al 1, que canta envido en su turno.
const passToOne = (g) => ok(act(g, 0, { t: 'play', card: g.h.inHand[0][2] }));

// Envido querido: canta el 1 en su turno, el 0 quiere y canta los tantos, el 1 dice son buenas.
function envidoQuerido(g, value) {
  passToOne(g);
  ok(act(g, 1, { t: 'envido', kind: 'envido' }));
  ok(act(g, 0, { t: 'quiero' }));
  ok(act(g, 0, value === undefined ? { t: 'cantar' } : { t: 'cantar', value }));
  ok(act(g, 1, { t: 'buenas' }));
}

test('jerarquía de cartas', () => {
  const order = ['1E', '1B', '7E', '7O', '3C', '2O', '1C', '12B', '11E', '10O', '7C', '6E', '5B', '4O'];
  for (let i = 1; i < order.length; i++) assert.ok(rank(order[i - 1]) > rank(order[i]), order[i - 1] + ' > ' + order[i]);
  assert.equal(rank('1C'), rank('1O'));
  assert.equal(rank('7C'), rank('7B'));
});

test('tantos', () => {
  assert.equal(tanto(['7E', '6E', '1B']).value, 33);
  assert.equal(tanto(['12E', '11E', '4B']).value, 20);
  assert.equal(tanto(['7E', '6O', '5B']).value, 7);
  assert.equal(tanto(['12E', '11O', '10B']).value, 0);
  assert.equal(tanto(['7E', '6E', '5E']).value, 33);
  assert.equal(tanto(['1C', '12C', '4E']).value, 21);
});

test('quién gana la mano con pardas', () => {
  const R = (...xs) => xs.map((result) => ({ result }));
  assert.equal(handWinner(R(0, 0), 1), 0);
  assert.equal(handWinner(R(0, 1), 1), null);
  assert.equal(handWinner(R(0, 1, 1), 0), 1);
  assert.equal(handWinner(R('parda', 1), 0), 1);
  assert.equal(handWinner(R(1, 'parda'), 0), 1);
  assert.equal(handWinner(R('parda', 'parda'), 0), null);
  assert.equal(handWinner(R('parda', 'parda', 'parda'), 1), 1);
  assert.equal(handWinner(R(0, 1, 'parda'), 1), 0);
});

test('truco querido vale 2, no querido 1', () => {
  let g = fixed([['1E', '1B', '4C'], ['4O', '5O', '6B']]);
  ok(act(g, 0, { t: 'truco' }));
  assert.equal(waitingFor(g).kind, 'truco');
  ok(act(g, 1, { t: 'noquiero' }));
  assert.deepEqual(g.score, [1, 0]);

  g = fixed([['1E', '1B', '4C'], ['4O', '5O', '6B']]);
  ok(act(g, 0, { t: 'truco' }));
  ok(act(g, 1, { t: 'quiero' }));
  ok(act(g, 0, { t: 'play', card: '1E' }));
  ok(act(g, 1, { t: 'play', card: '4O' }));
  ok(act(g, 0, { t: 'play', card: '1B' }));
  ok(act(g, 1, { t: 'play', card: '5O' }));
  assert.deepEqual(g.score, [2, 0]);
  assert.equal(g.h.phase, 'ended');
});

test('solo sube el que tiene el quiero', () => {
  const g = fixed([['1E', '1B', '4C'], ['4O', '5O', '6B']]);
  ok(act(g, 0, { t: 'truco' }));
  ok(act(g, 1, { t: 'quiero' }));
  assert.ok(act(g, 0, { t: 'truco' }).error); // el quiero lo tiene el 1
  assert.ok(act(g, 1, { t: 'truco' }).error); // el 1 tiene el quiero pero no es su turno
  assert.equal(actionsFor(g, 1).truco, null);
  ok(act(g, 0, { t: 'play', card: '4C' }));
  assert.equal(actionsFor(g, 1).truco, 'Retruco');
  ok(act(g, 1, { t: 'truco' })); // retruco, en su turno
  ok(act(g, 0, { t: 'truco' })); // vale cuatro, contestando
  ok(act(g, 1, { t: 'noquiero' }));
  assert.deepEqual(g.score, [3, 0]);
});

test('no se puede cantar fuera de turno (truco ni envido)', () => {
  const g = fixed([['7E', '6E', '4C'], ['5O', '4O', '12B']]);
  // le toca al 0: el 1 no tiene botones de cantar
  const a1 = actionsFor(g, 1);
  assert.equal(a1.truco, null);
  assert.deepEqual(a1.envido, []);
  assert.match(act(g, 1, { t: 'truco' }).error, /turno/);
  assert.match(act(g, 1, { t: 'envido', kind: 'envido' }).error, /turno/);
  // en su turno sí
  ok(act(g, 0, { t: 'play', card: '4C' }));
  assert.equal(actionsFor(g, 1).truco, 'Truco');
  ok(act(g, 1, { t: 'truco' }));
});

test('contestar dos veces no dice "no te toca"', () => {
  const g = fixed([['1E', '1B', '4C'], ['4O', '5O', '6B']]);
  ok(act(g, 0, { t: 'truco' }));
  ok(act(g, 1, { t: 'quiero' }));
  // doble clic en "Quiero": el canto ya se contestó
  assert.equal(act(g, 1, { t: 'quiero' }).error, 'Ya se contestó');
  // y al que le toca jugar no se le traba nada
  assert.deepEqual(waitingFor(g), { kind: 'play', seats: [0] });
  ok(act(g, 0, { t: 'play', card: '1E' }));
});

test('envido querido: se anota al final y hay que mostrar', () => {
  const g = fixed([['7E', '6E', '4C'], ['5O', '4O', '12B']]);
  envidoQuerido(g);
  assert.equal(g.h.envido.state, 'done');
  assert.deepEqual(g.score, [0, 0]); // todavía no se anota
  mazoAll(g, 1);
  assert.equal(g.h.phase, 'show');
  assert.ok(actionsFor(g, 0).mostrar);
  assert.ok(actionsFor(g, 1).reclamar);
  ok(act(g, 0, { t: 'mostrar' }));
  assert.equal(g.h.phase, 'ended');
  assert.deepEqual(g.score, [3, 0]); // 2 de envido + 1 del truco sin cantar
});

test('si no muestra y le reclaman, pierde solo el envido', () => {
  const g = fixed([['7E', '6E', '4C'], ['5O', '4O', '12B']]);
  envidoQuerido(g);
  mazoAll(g, 1);
  ok(act(g, 1, { t: 'reclamar' }));
  assert.equal(g.h.result.penalty, 'no-mostro');
  assert.deepEqual(g.score, [1, 2]); // el truco (1) sigue siendo suyo, el envido (2) pasa al rival
});

test('si nadie reclama, los tantos valen aunque no muestre', () => {
  const g = fixed([['7E', '6E', '4C'], ['5O', '4O', '12B']]);
  envidoQuerido(g);
  mazoAll(g, 1);
  closeShow(g);
  assert.deepEqual(g.score, [3, 0]);
});

test('mentir los tantos: si muestra, lo cazan', () => {
  const g = fixed([['7E', '4C', '12O'], ['5O', '4O', '12B']]);
  passToOne(g);
  ok(act(g, 1, { t: 'envido', kind: 'envido' }));
  ok(act(g, 0, { t: 'quiero' }));
  assert.ok(act(g, 0, { t: 'cantar', value: 8 }).error); // número que no existe
  ok(act(g, 0, { t: 'cantar', value: 33 })); // tiene 7
  assert.ok(act(g, 1, { t: 'cantar', value: 30 }).error); // tiene que superar 33
  ok(act(g, 1, { t: 'buenas' }));
  mazoAll(g, 1);
  ok(act(g, 0, { t: 'mostrar' }));
  assert.equal(g.h.result.penalty, 'mal-cantado');
  assert.deepEqual(g.score, [1, 2]);
});

test('aunque se vaya al mazo en el truco, el que ganó el envido puede mostrar', () => {
  const g = fixed([['7E', '6E', '4C'], ['5O', '4O', '12B']]);
  envidoQuerido(g);
  mazoAll(g, 0);
  assert.equal(g.h.phase, 'show');
  assert.ok(actionsFor(g, 0).mostrar);
  ok(act(g, 0, { t: 'mostrar' }));
  assert.deepEqual(g.score, [2, 1]); // envido 2 (mostró bien) + truco 1 para el rival (me fui al mazo)
});

test('irse al mazo sin mostrar: si le reclaman pierde el envido', () => {
  const g = fixed([['7E', '4C', '12O'], ['5O', '4O', '12B']]);
  passToOne(g);
  ok(act(g, 1, { t: 'envido', kind: 'envido' }));
  ok(act(g, 0, { t: 'quiero' }));
  ok(act(g, 0, { t: 'cantar', value: 33 })); // miente: tiene 7
  ok(act(g, 1, { t: 'buenas' }));
  mazoAll(g, 0);
  assert.ok(actionsFor(g, 0).nomostrar);
  ok(act(g, 0, { t: 'nomostrar' }));
  assert.equal(g.h.phase, 'show'); // los rivales todavía pueden reclamar
  assert.equal(actionsFor(g, 0).mostrar, false); // ya no puede mostrar
  assert.ok(act(g, 0, { t: 'mostrar' }).error);
  ok(act(g, 1, { t: 'reclamar' }));
  assert.equal(g.h.result.penalty, 'no-mostro');
  assert.deepEqual(g.score, [0, 3]); // envido 2 + truco 1 para el rival
});

test('irse al mazo sin mostrar: si nadie reclama, los tantos valen (aunque haya mentido)', () => {
  const g = fixed([['7E', '4C', '12O'], ['5O', '4O', '12B']]);
  passToOne(g);
  ok(act(g, 1, { t: 'envido', kind: 'envido' }));
  ok(act(g, 0, { t: 'quiero' }));
  ok(act(g, 0, { t: 'cantar', value: 33 }));
  ok(act(g, 1, { t: 'buenas' }));
  mazoAll(g, 1); // el rival se va al mazo en el truco
  ok(act(g, 0, { t: 'nomostrar' }));
  closeShow(g);
  assert.deepEqual(g.score, [3, 0]); // envido 2 + truco 1
});

test('mentir y mostrar: pierde el envido aunque tenga más que el rival', () => {
  const g = fixed([['7E', '6E', '4C'], ['5O', '4O', '12B']]); // tiene 33 de verdad
  passToOne(g);
  ok(act(g, 1, { t: 'envido', kind: 'envido' }));
  ok(act(g, 0, { t: 'quiero' }));
  ok(act(g, 0, { t: 'cantar', value: 31 })); // canta otro número (miente para abajo)
  ok(act(g, 1, { t: 'buenas' }));
  mazoAll(g, 1);
  ok(act(g, 0, { t: 'mostrar' }));
  assert.equal(g.h.result.penalty, 'mal-cantado');
  assert.deepEqual(g.score, [1, 2]); // el envido va para el rival; el truco (1) sigue siendo suyo
});

test('envido envido real envido no querido = 4', () => {
  const g = fixed([['7E', '6E', '4C'], ['5O', '4O', '12B']]);
  ok(act(g, 0, { t: 'envido', kind: 'envido' }));
  ok(act(g, 1, { t: 'envido', kind: 'envido' }));
  ok(act(g, 0, { t: 'envido', kind: 'real' }));
  ok(act(g, 1, { t: 'noquiero' }));
  mazoAll(g, 1);
  assert.equal(g.h.phase, 'ended'); // no querido: no hay que mostrar
  assert.deepEqual(g.score, [5, 0]);
});

test('falta envido gana el partido si lo gana el que va ganando', () => {
  const g = fixed([['7E', '6E', '4C'], ['5O', '4O', '12B']], { score: [20, 10] });
  passToOne(g);
  ok(act(g, 1, { t: 'envido', kind: 'falta' }));
  ok(act(g, 0, { t: 'quiero' }));
  ok(act(g, 0, { t: 'cantar' }));
  ok(act(g, 1, { t: 'buenas' }));
  mazoAll(g, 1);
  ok(act(g, 0, { t: 'mostrar' }));
  assert.equal(g.status, 'ended');
  assert.equal(g.winner, 0);
});

test('el envido está primero', () => {
  const g = fixed([['7E', '6E', '4C'], ['5O', '4O', '12B']]);
  ok(act(g, 0, { t: 'truco' }));
  ok(act(g, 1, { t: 'envido', kind: 'envido' }));
  assert.equal(waitingFor(g).kind, 'envido');
  ok(act(g, 0, { t: 'quiero' }));
  ok(act(g, 0, { t: 'cantar' }));
  ok(act(g, 1, { t: 'buenas' }));
  assert.equal(waitingFor(g).kind, 'truco'); // vuelve el truco pendiente
  ok(act(g, 1, { t: 'quiero' }));
  assert.equal(g.h.truco.level, 2);
});

test('no se puede cantar envido después de jugar', () => {
  const g = fixed([['7E', '6E', '4C'], ['5O', '4O', '12B']]);
  ok(act(g, 0, { t: 'play', card: '4C' }));
  assert.ok(act(g, 0, { t: 'envido', kind: 'envido' }).error);
  ok(act(g, 1, { t: 'envido', kind: 'envido' }));
});

test('en 2 vs 2 el envido lo canta y lo contesta el pie', () => {
  // reparte el 1: mano 2, pies = 1 (el que reparte) y 0 (el que corta)
  const g = newGame({ mode: '2v2', dealer: 1 });
  assert.equal(g.h.mano, 2);
  assert.ok(isPie(g, 1) && isPie(g, 0) && !isPie(g, 2) && !isPie(g, 3));
  assert.match(act(g, 2, { t: 'envido', kind: 'envido' }).error, /pie/);
  assert.deepEqual(actionsFor(g, 2).envido, []);
  // el pie 0 canta en su turno (juega tercero: 2, 3, 0, 1)
  assert.match(act(g, 0, { t: 'envido', kind: 'envido' }).error, /turno/);
  ok(act(g, 2, { t: 'play', card: g.h.inHand[2][0] }));
  ok(act(g, 3, { t: 'play', card: g.h.inHand[3][0] }));
  ok(act(g, 0, { t: 'envido', kind: 'envido' }));
  assert.deepEqual(waitingFor(g).seats, [1]); // contesta el pie del otro equipo
  assert.ok(act(g, 3, { t: 'quiero' }).error);
  ok(act(g, 1, { t: 'quiero' }));
});

test('en 3 vs 3 los pies son el que reparte y el que corta', () => {
  const g = newGame({ mode: '3v3', dealer: 4 });
  assert.equal(g.h.mano, 5);
  assert.deepEqual([0, 1, 2, 3, 4, 5].filter((s) => isPie(g, s)), [3, 4]);
});

test('regla de la mesa: en equipos el truco se canta desde segunda', () => {
  const g = newGame({ mode: '2v2', dealer: 1, trucoDesdeSegunda: true });
  assert.equal(actionsFor(g, 2).truco, null);
  assert.ok(act(g, 2, { t: 'truco' }).error);
  const h = g.h;
  for (let k = 0; k < 4; k++) ok(act(g, h.turn, { t: 'play', card: h.inHand[h.turn][0] }));
  if (g.h.phase === 'play') assert.ok(actionsFor(g, g.h.turn).truco);
});

test('al mazo en primera sin envido: 1 + 1', () => {
  const g = fixed([['7E', '6E', '4C'], ['5O', '4O', '12B']]);
  ok(act(g, 0, { t: 'mazo' }));
  assert.deepEqual(g.score, [0, 2]);
});

test('dos encimadas: la de abajo juega; la de arriba es la jugada de la ronda siguiente, quemada', () => {
  const g = fixed([['1E', '4E', '5C'], ['3O', '6O', '12B']]);
  // el 0 tapa su 4 con el ancho: en primera parece que tiró el ancho
  ok(act(g, 0, { t: 'play2', bottom: '4E', top: '1E' }));
  let v = viewFor(g, 1);
  assert.equal(v.h.table[0][0].c, null); // la de abajo no se ve
  assert.equal(v.h.table[0][1].c, '1E');
  assert.equal(v.h.table[0][1].burned, false); // durante primera no se nota que está quemada
  assert.equal(viewFor(g, 0).h.table[0][1].burned, false); // tampoco para el que la tiró: se quema al pasar de ronda
  assert.deepEqual(g.h.inHand[0], ['5C']);
  ok(act(g, 1, { t: 'play', card: '3O' })); // primera: 3 > 4, gana el 1
  assert.equal(g.h.rounds[0].result, 1);
  v = viewFor(g, 1);
  assert.equal(v.h.table[0][1].burned, true); // terminó primera: ahora se ve quemada
  // segunda: empieza el 1 (ganó primera); al 0 se le juega solo el ancho quemado, que vale un 4
  ok(act(g, 1, { t: 'play', card: '12B' }));
  assert.deepEqual(g.h.rounds[1].plays.find((p) => p.seat === 0), { seat: 0, c: '1E', burned: true });
  assert.equal(g.h.phase, 'ended'); // el 1 ganó primera y segunda
  assert.deepEqual(g.score, [0, 1]);
});

test('la carta quemada vale como un 4 (empata con un 4, pierde con un 5)', () => {
  assert.equal(BURNED_VALUE, rank('4C'));
  assert.equal(playValue({ c: '1E', burned: true }), rank('4O'));
  assert.ok(playValue({ c: '1E', burned: true }) < rank('5C'));
  // tapada en segunda contra un 4: parda (y como el 0 ganó primera, gana la mano)
  const g = fixed([['3E', '4E', '1B'], ['4O', '3O', '4B']]);
  ok(act(g, 0, { t: 'play', card: '3E' }));
  ok(act(g, 1, { t: 'play', card: '4O' }));
  ok(act(g, 0, { t: 'play', card: '1B', mode: 'down' }));
  ok(act(g, 1, { t: 'play', card: '4B' }));
  assert.equal(g.h.rounds[1].result, 'parda');
  assert.deepEqual(g.score, [1, 0]);
});

test('tirar fuera de turno: la carta se quema y es tu jugada de esa ronda', () => {
  const g = fixed([['7O', '4E', '5C'], ['3O', '6O', '12B']]);
  assert.equal(actionsFor(g, 1).throwOut, true);
  ok(act(g, 1, { t: 'play', card: '3O' })); // le tocaba al 0
  assert.equal(g.h.turn, 0); // el turno sigue siendo del 0
  assert.equal(viewFor(g, 0).h.table[1][0].burned, true); // se ve quemada para todos
  assert.equal(actionsFor(g, 1).throwOut, false); // ya jugó en esta ronda
  ok(act(g, 0, { t: 'play', card: '5C' })); // 5 le gana al 3 quemado (vale un 4)
  assert.equal(g.h.rounds[0].result, 0);
  assert.equal(g.h.r, 1);
  assert.equal(g.h.turn, 0); // el que ganó primera empieza segunda
});

test('fuera de turno en 2 vs 2: al llegar su turno se lo saltea y no recupera la carta', () => {
  const g = newGame({ mode: '2v2', dealer: 3 }, seeded(9)); // mano 0, orden 0 1 2 3
  const h = g.h;
  const c = h.inHand[2][0];
  ok(act(g, 2, { t: 'play', card: c })); // el 2 tira fuera de turno (le toca al 0)
  assert.equal(h.inHand[2].length, 2);
  ok(act(g, 0, { t: 'play', card: h.inHand[0][0] }));
  ok(act(g, 1, { t: 'play', card: h.inHand[1][0] }));
  assert.equal(h.turn, 3); // el 2 ya jugó: pasa directo al 3
  assert.equal(actionsFor(g, 2).play, false);
  assert.equal(h.inHand[2].length, 2); // la carta quemada no vuelve a la mano
  ok(act(g, 3, { t: 'play', card: h.inHand[3][0] }));
  assert.equal(h.r, 1); // terminó primera con las 4 jugadas
  assert.equal(h.rounds[0].plays.length, 4);
  assert.deepEqual(h.rounds[0].plays.find((p) => p.seat === 2), { seat: 2, c, burned: true });
});

test('no se puede tirar fuera de turno con un canto sin contestar', () => {
  const g = fixed([['7O', '4E', '5C'], ['3O', '6O', '12B']]);
  ok(act(g, 0, { t: 'truco' }));
  assert.ok(act(g, 1, { t: 'play', card: '3O' }).error);
});

test('en 2 vs 2 y 3 vs 3 la ronda siguiente la empieza el que ganó la anterior (parda: la mano)', () => {
  for (const mode of ['2v2', '3v3']) {
    for (let seed = 1; seed <= 25; seed++) {
      const g = newGame({ mode }, seeded(seed));
      const h = g.h;
      while (h.phase === 'play') {
        for (let k = 0; k < g.n && h.phase === 'play'; k++) {
          const s = h.turn;
          const card = h.inHand[s].slice().sort((x, y) => rank(y) - rank(x))[0];
          ok(act(g, s, { t: 'play', card }));
        }
        if (h.phase !== 'play') break;
        const R = h.rounds[h.r - 1];
        assert.equal(h.turn, R.result === 'parda' ? h.mano : R.winnerSeat, `${mode} seed ${seed} ronda ${h.r + 1}`);
      }
    }
  }
});

test('ganar primera y perder segunda no termina la mano: se juega tercera', () => {
  const g = fixed([['3E', '4E', '1B'], ['4O', '3O', '12B']]);
  ok(act(g, 0, { t: 'play', card: '3E' }));
  ok(act(g, 1, { t: 'play', card: '4O' })); // primera para el 0
  ok(act(g, 0, { t: 'play', card: '4E' }));
  ok(act(g, 1, { t: 'play', card: '3O' })); // segunda para el 1
  assert.equal(g.h.phase, 'play');
  assert.equal(g.h.r, 2);
  assert.equal(g.h.turn, 1); // tercera la empieza el que ganó segunda
});

test('dos encimadas: si la de abajo mata, la de arriba no se quema (arrancás vos la ronda siguiente)', () => {
  const g = fixed([['3E', '1E', '5C'], ['4O', '6O', '12B']], { dealer: 0 }); // el 1 es mano: el 0 juega último
  ok(act(g, 1, { t: 'play', card: '4O' }));
  ok(act(g, 0, { t: 'play2', bottom: '3E', top: '1E' })); // mata con el 3 y deja el ancho arriba
  assert.equal(g.h.rounds[0].result, 0);
  // segunda la arranca el 0: su ancho juega solo y vale como ancho, no quemado
  assert.deepEqual(g.h.rounds[1].plays[0], { seat: 0, c: '1E' });
  assert.equal(viewFor(g, 1).h.table[0][1].burned, false);
  assert.equal(g.h.turn, 1);
  ok(act(g, 1, { t: 'play', card: '12B' }));
  assert.equal(g.h.phase, 'ended');
  assert.equal(g.h.result.winner, 0);
});

test('dos encimadas: en parda la de arriba se quema aunque seas mano', () => {
  const g = fixed([['3E', '1E', '5C'], ['3O', '6O', '12B']]); // el 0 es mano
  ok(act(g, 0, { t: 'play2', bottom: '3E', top: '1E' }));
  ok(act(g, 1, { t: 'play', card: '3O' })); // parda
  assert.equal(g.h.rounds[0].result, 'parda');
  assert.deepEqual(g.h.rounds[1].plays[0], { seat: 0, c: '1E', burned: true });
  assert.equal(viewFor(g, 1).h.table[0][1].burned, true);
});

test('pedir que muestre las dos: se ve la de abajo y no hay puntos', () => {
  const g = fixed([['1E', '4E', '5C'], ['3O', '6O', '12B']]);
  ok(act(g, 0, { t: 'play2', bottom: '4E', top: '1E' }));
  assert.equal(viewFor(g, 1).h.table[0][0].c, null);
  ok(act(g, 1, { t: 'denuncia', target: 0 }));
  assert.equal(viewFor(g, 1).h.table[0][0].c, '4E');
  assert.equal(g.h.phase, 'play');
  assert.deepEqual(g.score, [0, 0]);
});

test('pedir que muestre a quien no tiró dos no cambia nada', () => {
  const g = fixed([['3E', '4E', '5C'], ['4O', '3O', '12B']]);
  ok(act(g, 1, { t: 'denuncia', target: 0 }));
  assert.equal(g.h.phase, 'play');
  assert.deepEqual(g.score, [0, 0]);
});

test('en equipo, irse al mazo es por todo el equipo', () => {
  const g = newGame({ mode: '2v2', dealer: 1 });
  ok(act(g, 2, { t: 'mazo' }));
  assert.equal(g.h.phase, 'ended');
  assert.deepEqual(g.h.mazo, [true, false, true, false]);
});

test('carta tapada: no vale en primera; desde segunda se quema (vale un 4)', () => {
  const g = fixed([['3E', '4E', '5C'], ['4O', '3O', '12B']]);
  assert.ok(act(g, 0, { t: 'play', card: '3E', mode: 'down' }).error);
  ok(act(g, 0, { t: 'play', card: '3E' }));
  ok(act(g, 1, { t: 'play', card: '4O' }));
  ok(act(g, 0, { t: 'play', card: '5C', mode: 'down' }));
  assert.equal(viewFor(g, 1).h.table[0][1].burned, true);
  ok(act(g, 1, { t: 'play', card: '12B' }));
  assert.equal(g.h.rounds[1].result, 1);
  assert.equal(g.h.rounds[1].plays[0].burned, true);
  // el rival no ve la carta tapada
  assert.equal(viewFor(g, 1).h.table[0][1].c, null);
  assert.equal(viewFor(g, 0).h.table[0][1].c, '5C');
});

test('la vista no filtra cartas ajenas', () => {
  const g = newGame({ mode: '2v2' }, seeded(3));
  const v = viewFor(g, 2);
  assert.equal(v.h.myCards.length, 3);
  assert.equal(JSON.stringify(v).includes(JSON.stringify(g.h.inHand[1])), false);
});

for (const mode of ['1v1', '2v2', '3v3']) {
  test(`partidas completas entre bots (${mode})`, () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rng = seeded(seed * 7 + mode.length);
      const g = newGame({ mode, target: seed % 2 ? 15 : 30 }, rng);
      let steps = 0;
      while (g.status === 'playing') {
        assert.ok(steps++ < 20000, 'la partida no termina');
        if (g.h.phase === 'ended') {
          nextHand(g, rng);
          continue;
        }
        const w = waitingFor(g);
        if (w.kind === 'show') {
          const a = botAction(g, w.seats[0], rng);
          if (!a) closeShow(g);
          else if (rng() < 0.1) ok(act(g, (w.seats[0] + 1) % g.n, { t: 'reclamar' }));
          else ok(act(g, w.seats[0], a));
          continue;
        }
        const seat = w.seats[Math.floor(rng() * w.seats.length)];
        const a = botAction(g, seat, rng);
        assert.ok(a, `bot sin acción en ${w.kind}`);
        const r = act(g, seat, a, rng);
        assert.ok(r.ok, `${mode} seed ${seed}: ${JSON.stringify(a)} -> ${r.error}`);
        // invariantes
        const inPlay = g.h.inHand.flat().length + g.h.table.flat().length;
        assert.ok(inPlay <= g.n * 3);
        assert.ok(g.score[0] >= 0 && g.score[1] >= 0);
      }
      assert.ok(g.score[g.winner] === g.target);
    }
  });
}
