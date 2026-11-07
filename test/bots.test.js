// Bots: lo que aprenden (brain.js), cómo deciden y sus trampas (bot.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, waitingFor, nextHand, closeShow, rank, tanto } from '../public/js/engine.js';
import { botAction, botShow, stackDeck, botClaims, imagine, BotMemo, fallbackActions, botAnswer, botAsks } from '../public/js/bot.js';
import { talkFor, talkHandEnd, talkEvent, BOT_TALK, ASK_TALK, talkAnswer } from '../public/js/talk.js';
import { BOT } from '../public/js/config.js';
import { newBrain, train, predict, observe, rate, X } from '../public/js/brain.js';

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

// Mano a mano con cartas fijas: el 0 es mano (reparte el 1).
function fixed(cards, opts = {}) {
  const g = newGame({ mode: '1v1', dealer: 1, target: 30, ...opts });
  g.h.cards = cards.map((c) => c.slice());
  g.h.inHand = cards.map((c) => c.slice());
  return g;
}
const ok = (r) => assert.ok(r.ok, r.error);

test('el cerebro aprende: alguien que canta truco con nada pasa a ser un mentiroso', () => {
  const b = newBrain();
  const weak = X.trucoCall(0.1, 1, 0);
  const before = predict(b, 'trucoCall', weak);
  train(b, Array.from({ length: 60 }, () => ({ key: 'trucoCall', x: weak, y: true })));
  assert.ok(predict(b, 'trucoCall', weak) > before + 0.4, 'no aprendió');
  // y la tasa de mentiras en el envido sube con las mentiras
  const lie = rate(b, 'lie');
  train(b, Array.from({ length: 20 }, () => ({ key: 'lie', y: true })));
  assert.ok(rate(b, 'lie') > lie + 0.3);
});

test('un cerebro nuevo arranca con lo que se sabe de todos (el global)', () => {
  const global = train(newBrain(), Array.from({ length: 80 }, () => ({ key: 'envidoCall', x: X.envidoCall(5), y: true })));
  const fresh = newBrain(global);
  assert.equal(predict(fresh, 'envidoCall', X.envidoCall(5)), predict(global, 'envidoCall', X.envidoCall(5)));
  assert.equal(fresh.m.envidoCall.n, 0);
});

test('observe etiqueta lo que hizo la persona con sus cartas reales', () => {
  const g = fixed([['4C', '5O', '6B'], ['1E', '1B', '7E']]);
  const ex = observe(g, 0, { t: 'truco' });
  const t = ex.find((e) => e.key === 'trucoCall');
  assert.equal(t.y, true);
  assert.ok(t.x[1] < 0.3, 'una mano mala tiene fuerza baja');
  // también cuenta que pudo cantar envido y no lo cantó
  assert.equal(ex.find((e) => e.key === 'envidoCall').y, false);
  ok(act(g, 0, { t: 'truco' }));
  assert.deepEqual(observe(g, 1, { t: 'quiero' }).map((e) => [e.key, e.y]), [['trucoAccept', true]]);
});

test('espiando, no quiere un truco perdido y sí uno ganado', () => {
  const rng = seeded(3);
  const lose = fixed([['1E', '1B', '7E'], ['4C', '5O', '6B']]);
  ok(act(lose, 0, { t: 'truco' }));
  assert.equal(botAction(lose, 1, rng, { peek: true }).t, 'noquiero');

  const win = fixed([['4C', '5O', '6B'], ['1E', '1B', '7E']]);
  ok(act(win, 0, { t: 'truco' }));
  assert.notEqual(botAction(win, 1, rng, { peek: true }).t, 'noquiero');
});

test('miente en el envido solo si la mesa permite trampas, y entonces no muestra', () => {
  const declareLosing = (trampas) => {
    const g = fixed([['7O', '6O', '4C'], ['1E', '2B', '4O']], { trampas });
    ok(act(g, 0, { t: 'envido', kind: 'envido' }));
    ok(act(g, 1, { t: 'quiero' }));
    ok(act(g, 0, { t: 'cantar' })); // 33
    return g;
  };
  // sin trampas: siempre "son buenas"
  for (let i = 0; i < 30; i++) assert.equal(botAction(declareLosing(false), 1, seeded(i)).t, 'buenas');
  // con trampas: 33 es el máximo, no hay número para mentir
  assert.equal(botAction(declareLosing(true), 1, seeded(1)).t, 'buenas');

  // si le dicen 25 con 21, a veces dice 26... y después se va sin mostrar
  let lied = 0;
  for (let i = 0; i < 40; i++) {
    const g = fixed([['5C', '1E', '7B'], ['1O', '4E', '6C']], { trampas: true }); // 7 vs 6
    g.h.cards[0] = ['5C', '7B', '4E'];
    g.h.inHand[0] = g.h.cards[0].slice();
    g.h.cards[1] = ['1O', '6C', '2B'];
    g.h.inHand[1] = g.h.cards[1].slice();
    ok(act(g, 0, { t: 'envido', kind: 'envido' }));
    ok(act(g, 1, { t: 'quiero' }));
    ok(act(g, 0, { t: 'cantar', value: 25 })); // el humano también miente
    const a = botAction(g, 1, seeded(i));
    if (a.value != null) {
      lied++;
      assert.equal(a.value, 26);
      ok(act(g, 1, a));
      assert.equal(g.h.envido.state, 'done');
      ok(act(g, 0, { t: 'mazo' }));
      assert.equal(g.h.phase, 'show');
      assert.deepEqual(botShow(g, 1), { t: 'nomostrar' });
    }
  }
  assert.ok(lied > 0 && lied < 40, `mintió ${lied} de 40`);
});

test('espiando, le reclama seguro al que mintió en el envido', () => {
  const g = fixed([['5C', '7B', '4E'], ['1O', '6C', '2B']], { trampas: true });
  ok(act(g, 0, { t: 'envido', kind: 'envido' }));
  ok(act(g, 1, { t: 'quiero' }));
  ok(act(g, 0, { t: 'cantar', value: 30 }));
  ok(act(g, 1, { t: 'buenas' }));
  ok(act(g, 1, { t: 'mazo' }));
  assert.equal(g.h.phase, 'show');
  for (let i = 0; i < 20; i++) assert.equal(botClaims(g, 1, seeded(i), { peek: true }), true);
});

test('el que reparte se acomoda una carta buena sin romper el mazo (y no en mesas sin trampas)', () => {
  for (let i = 0; i < 50; i++) {
    const rng = seeded(i);
    const g = newGame({ mode: '2v2', trampas: true }, rng);
    const before = g.h.cards[g.dealer].slice();
    if (stackDeck(g, g.dealer, rng)) {
      const all = [...g.h.cards.flat(), g.h.muestra].filter(Boolean);
      assert.equal(new Set(all).size, all.length, 'carta repetida');
      assert.deepEqual(g.h.inHand[g.dealer], g.h.cards[g.dealer]);
      assert.ok(Math.max(...g.h.cards[g.dealer].map((c) => rank(c))) >= rank('7O'));
      assert.notDeepEqual(g.h.cards[g.dealer], before);
    }
  }
  const clean = newGame({ mode: '1v1', trampas: false });
  assert.equal(stackDeck(clean, clean.dealer), false);
});

test('los bots hablan con frases de la lista y a veces se hacen los guapos con nada', () => {
  const all = new Set(Object.values(BOT_TALK).flat());
  let proud = 0;
  for (let i = 0; i < 200; i++) {
    const t = talkFor({ t: 'truco' }, 'play', { p: 0.1 }, seeded(i), false, 'Retruco');
    if (!t) continue;
    assert.ok(t.call && t.text.includes('etruco'), 'la frase dice el canto de verdad: ' + t.text);
    assert.ok(!/truco/i.test(t.text.replace(/retruco/gi, '')), 'no dice truco en un retruco: ' + t.text);
    if (BOT_TALK.strongCall.some((x) => x.replace(/{C}/g, 'Retruco').replace(/{c}/g, 'retruco') === t.text)) proud++;
  }
  assert.ok(proud > 30, 'cuando farolea casi siempre se hace el guapo');
  assert.ok(BOT_TALK.partner.includes(talkFor({ t: 'quiero' }, 'truco', { p: 0.5 }, () => 0, true).text));
  const g = fixed([['1E', '1B', '7E'], ['4C', '5O', '6B']]);
  ok(act(g, 0, { t: 'truco' }));
  ok(act(g, 1, { t: 'noquiero' }));
  assert.ok(BOT_TALK.bluffWon.includes(talkHandEnd(g, 0, true, () => 0)));
});

test('los bots reaccionan a lo que hacen los demás, no a lo suyo', () => {
  const g = fixed([['1E', '1B', '7E'], ['4C', '5O', '6B']]);
  const call = { type: 'call', seat: 0, kind: 'truco', text: 'Truco' };
  assert.ok(BOT_TALK.rivalTruco.includes(talkEvent(g, 1, call, [0], () => 0)));
  assert.equal(talkEvent(g, 0, call, [0], () => 0), null);
  assert.ok(BOT_TALK.myBigCard['1E'].includes(talkEvent(g, 0, { type: 'play', seat: 0, c: '1E' }, [], () => 0)));
  assert.ok(BOT_TALK.rivalMazo.includes(talkEvent(g, 1, { type: 'mazo', seat: 0 }, [0], () => 0)));
  assert.ok(BOT_TALK.gameWon.includes(talkEvent(g, 1, { type: 'game-end', team: 1 }, [0], () => 0)));
});

test('jugando último, mata y deja encimada la carta de la ronda siguiente (que no se quema)', () => {
  const saved = BOT.doubleKill;
  BOT.doubleKill = 1;
  try {
    const g = fixed([['3E', '1E', '5C'], ['4O', '6O', '12B']], { dealer: 0 });
    ok(act(g, 1, { t: 'play', card: '4O' }));
    g.h.envido.state = 'done'; // que no cante: solo importa qué tira
    g.h.truco.holder = 1;
    const a = botAction(g, 0, seeded(1), { peek: true });
    assert.equal(a.t, 'play2');
    ok(act(g, 0, a));
    assert.equal(g.h.rounds[0].result, 0);
    assert.equal(g.h.rounds[1].plays[0].burned, undefined);
  } finally {
    BOT.doubleKill = saved;
  }
});

// Partidas completas con todo prendido: espían, se acomodan cartas, aprenden de un rival.
for (const mode of ['1v1', '2v2']) {
  test(`partidas completas entre bots tramposos que aprenden (${mode})`, () => {
    const brain = newBrain();
    for (let seed = 1; seed <= 12; seed++) {
      const rng = seeded(seed * 13);
      const g = newGame({ mode, target: 15, flor: seed % 3 === 0, muestra: seed % 4 === 0 }, rng);
      const ctx = { bots: [0, 1, 2, 3].slice(0, g.n), brainOf: () => brain, peek: false };
      let hand = null;
      let steps = 0;
      while (g.status === 'playing') {
        assert.ok(steps++ < 20000, 'la partida no termina');
        if (g.h.phase === 'ended') {
          nextHand(g, rng);
          continue;
        }
        if (hand !== g.h) {
          hand = g.h;
          ctx.peek = rng() < 0.3;
          if (rng() < 0.3) stackDeck(g, g.dealer, rng);
        }
        const w = waitingFor(g);
        const seat = w.seats[0];
        const a = botAction(g, seat, rng, ctx);
        if (!a) {
          assert.equal(w.kind, 'show');
          closeShow(g);
          continue;
        }
        train(brain, observe(g, seat, a));
        const r = act(g, seat, a);
        assert.ok(r.ok, `${mode} seed ${seed}: ${JSON.stringify(a)} -> ${r.error}`);
      }
      assert.equal(g.score[g.winner], g.target);
    }
    assert.ok(brain.m.trucoAccept.n > 0 && brain.m.envidoCall.n > 0, 'no aprendió nada');
  });
}

test('señas: el bot imagina que su compañero tiene la carta que le marcó', () => {
  const g = newGame({ mode: '2v2', dealer: 3 });
  const cards = [['4C', '5O', '6B'], ['4O', '5C', '6E'], ['1E', '3O', '12C'], ['4B', '5B', '6O']];
  g.h.cards = cards.map((c) => c.slice());
  g.h.inHand = cards.map((c) => c.slice());
  const rng = seeded(7);
  const share = (ctx, f) => {
    const ws = imagine(g, 0, ctx, rng);
    return ws.filter((x) => f(x.world.full)).length / ws.length;
  };
  // sin seña: el ancho de espada lo tiene el 2 en pocas manos imaginadas
  assert.ok(share({}, (f) => f[2].includes('1E')) < 0.3);
  // con la seña del compañero (el 2), casi siempre
  assert.ok(share({ senas: [{ seat: 2, sena: 'ancho_espada' }] }, (f) => f[2].includes('1E')) > 0.8);
  // seña de un tres: imagina un tres
  assert.ok(share({ senas: [{ seat: 2, sena: 'tres' }] }, (f) => f[2].some((c) => parseInt(c, 10) === 3)) > 0.8);
});

test('señas de tantos: pesa más las manos que cuadran con "30 o más"', () => {
  const g = newGame({ mode: '2v2', dealer: 3 });
  const ws = imagine(g, 0, { senas: [{ seat: 2, sena: 'treinta' }] }, seeded(3));
  const t30 = (x) => tanto(x.world.full[2]).value >= 30;
  assert.ok(ws.some((x) => !t30(x))); // hay manos imaginadas que no cuadran...
  for (const x of ws) assert.ok(t30(x) ? x.w >= 0.5 : x.w < 0.5); // ...y pesan mucho menos
});

test('frases que nombran la ronda o la carta: solo cuando corresponde', () => {
  const g = newGame({ mode: '2v2', dealer: 3 });
  const rng = seeded(11);
  const said = (e) => {
    const out = new Set();
    for (let i = 0; i < 3000; i++) {
      const t = talkEvent(g, 0, e, [], rng);
      if (t) out.add(t);
    }
    return [...out];
  };
  // ganó segunda (perdió primera): nunca dice "primera"
  const r2 = said({ type: 'round', round: 1, result: 0, seat: 0 });
  assert.ok(r2.length > 0);
  assert.ok(r2.every((t) => !/primera|tercera/i.test(t)), r2.join(' | '));
  assert.ok(r2.some((t) => /segunda/i.test(t)));
  // parda en tercera: no dice "esto se pone bueno" (ya terminó)
  assert.deepEqual(said({ type: 'round', round: 2, result: 'parda', seat: null }), []);
  // un rival tira el 7 de espada: nunca habla de un ancho
  const s7 = said({ type: 'play', seat: 1, c: '7E', round: 0 });
  assert.ok(s7.length > 0);
  assert.ok(s7.every((t) => !/ancho|macho|basto|oro/i.test(t)), s7.join(' | '));
  const s1 = said({ type: 'play', seat: 1, c: '1B', round: 0 });
  assert.ok(s1.every((t) => !/siete|espada|macho/i.test(t)), s1.join(' | '));
});

test('memoria: la misma situación se piensa hasta juntar BOT.memoSamples y después sale de memoria', () => {
  const memo = new BotMemo();
  const g = newGame({ mode: '1v1', dealer: 1 });
  const cards = [['3E', '4C', '12O'], ['5O', '6O', '11B']];
  g.h.cards = cards.map((c) => c.slice());
  g.h.inHand = cards.map((c) => c.slice());
  g.h.envido.state = 'done'; // el envido ya pasó: decide truco y carta (lo que usa la memoria)
  const rng = seeded(5);
  const visits = BOT.memoSamples / BOT.samples;
  for (let i = 0; i < visits; i++) botAction(g, 0, rng, { memo });
  const misses = memo.misses;
  assert.ok(misses > 0);
  assert.equal(memo.hits, 0);
  // ya maduró: no vuelve a simular
  for (let i = 0; i < 5; i++) botAction(g, 0, rng, { memo });
  assert.equal(memo.misses, misses);
  assert.ok(memo.hits > 0);
  assert.ok(memo.takeRipe().length > 0); // lo maduro queda listo para guardarse en el Lobby
  // los mismos valores con otros palos (4 de oro en vez de 4 de copa) son la misma situación
  const g2 = newGame({ mode: '1v1', dealer: 1 });
  const c2 = [['3E', '4O', '12C'], ['5O', '6O', '11B']];
  g2.h.cards = c2.map((c) => c.slice());
  g2.h.inHand = c2.map((c) => c.slice());
  g2.h.envido.state = 'done';
  const h0 = memo.hits;
  botAction(g2, 0, rng, { memo });
  assert.ok(memo.hits > h0);
});

test('memoria: el bot con memoria juega igual de bien que sin ella', () => {
  const rng = seeded(21);
  const memo = new BotMemo();
  let wins = 0;
  const G = 60;
  for (let gi = 0; gi < G; gi++) {
    const g = newGame({ mode: '1v1', target: 15, trampas: false }, rng);
    const mt = gi % 2;
    for (let i = 0; i < 3000 && g.status === 'playing'; i++) {
      if (g.h.phase === 'ended') { nextHand(g, rng); continue; }
      if (g.h.phase === 'show') { closeShow(g); continue; }
      const s = waitingFor(g).seats[0];
      const a = botAction(g, s, rng, s % 2 === mt ? { memo } : {});
      if (!a || !act(g, s, a).ok) break;
    }
    if (g.winner === mt) wins++;
  }
  assert.ok(wins / G > 0.35, 'gana ' + wins + ' de ' + G);
});

test('respaldo: si el bot elige algo que no vale, alguna jugada de respaldo entra', () => {
  const rng = seeded(9);
  for (let k = 0; k < 30; k++) {
    const g = newGame({ mode: '2v2', target: 15 }, rng);
    for (let i = 0; i < 40 && g.status === 'playing' && g.h.phase === 'play'; i++) {
      const s = waitingFor(g).seats[0];
      assert.ok(fallbackActions(g, s).some((f) => act(structuredClone(g), s, f).ok), 'sin respaldo en ' + waitingFor(g).kind);
      const a = botAction(g, s, rng, {});
      if (!a || !act(g, s, a).ok) break;
    }
  }
});

const hand2v2 = (cards, dealer = 3) => {
  const g = newGame({ mode: '2v2', dealer });
  g.h.cards = cards.map((c) => c.slice());
  g.h.inHand = cards.map((c) => c.slice());
  return g;
};

test('consulta: el bot contesta Cantá, Callado o No tengo nada según lo que tiene', () => {
  const rng = seeded(4);
  const g = hand2v2([['7E', '6E', '4C'], ['4O', '5C', '12B'], ['10O', '11C', '12E'], ['1C', '2O', '3B']]);
  const many = (s, k) => new Set(Array.from({ length: 200 }, () => botAnswer(g, s, k, rng)));
  const zero = many(2, 'tantos'); // 0 de envido: casi siempre "no tengo nada", a veces callado
  assert.ok(zero.has('nada') && !zero.has('si'));
  const big = many(0, 'tantos'); // 33: casi siempre "cantá", a veces callado (a la pesca)
  assert.ok(big.has('si') && big.has('callado') && !big.has('nada'));
  assert.ok(!many(2, 'truco').has('si')); // nada para el truco
  assert.ok(many(3, 'truco').has('si')); // tiene un 3 y un 2
});

test('consulta: si el compañero dice "no tengo nada" y el bot tiene, igual canta', () => {
  const rng = seeded(8);
  const mk = () => {
    const g = hand2v2([['4O', '5C', '12B'], ['10O', '11C', '12C'], ['4B', '5O', '6C'], ['7E', '6E', '1E']], 3);
    for (const s of [0, 1, 2]) act(g, s, { t: 'play', card: g.h.inHand[s][0] });
    return g;
  };
  let sings = 0;
  for (let i = 0; i < 30; i++) if (botAction(mk(), 3, rng, { senas: [{ seat: 1, sena: 'nada_envido' }] })?.t === 'envido') sings++;
  assert.ok(sings > 10, 'cantó ' + sings);
});

test('consulta: "callado" no es "no tengo" (es que lo canten los otros)', () => {
  for (const k of ['tantos', 'truco']) for (const t of ASK_TALK[k].callado) assert.ok(/callado/i.test(t) && !/no tengo|nada/i.test(t), t);
  assert.ok(ASK_TALK.tantos.si.includes(talkAnswer('tantos', 'si')) && ASK_TALK.tantos.si.every((t) => !/callado|nada/i.test(t)));
  assert.ok(ASK_TALK.tantos.nada.every((t) => !/callado/i.test(t)));
});

test('consulta: si el compañero dijo callado, el bot no canta eso (pero sigue jugando)', () => {
  const rng = seeded(8);
  // el 3 (pie) con 33: casi siempre cantaría envido
  const mk = () => {
    const g = hand2v2([['4O', '5C', '12B'], ['10O', '11C', '12C'], ['4B', '5O', '6C'], ['7E', '6E', '1E']], 3);
    for (const s of [0, 1, 2]) act(g, s, { t: 'play', card: g.h.inHand[s][0] });
    return g;
  };
  let sings = 0;
  for (let i = 0; i < 30; i++) {
    const a = botAction(mk(), 3, rng, {});
    if (a?.t === 'envido') sings++;
  }
  assert.ok(sings > 10);
  for (let i = 0; i < 30; i++) {
    const a = botAction(mk(), 3, rng, { hush: { tantos: true, truco: true } });
    assert.ok(a && a.t !== 'envido' && a.t !== 'truco', JSON.stringify(a));
  }
});

test('consulta: el bot pie a veces pregunta por los tantos antes de cantar (más a una persona)', () => {
  const rng = seeded(12);
  const g = hand2v2([['4O', '5C', '12B'], ['10O', '11C', '12C'], ['4B', '5O', '6C'], ['7E', '6E', '1E']], 3);
  for (const s of [0, 1, 2]) act(g, s, { t: 'play', card: g.h.inHand[s][0] });
  const human = Array.from({ length: 200 }, () => botAsks(g, 3, rng, true)).filter((k) => k === 'tantos').length;
  const bot = Array.from({ length: 200 }, () => botAsks(g, 3, rng, false)).filter((k) => k === 'tantos').length;
  assert.ok(human > bot && bot > 0);
});
