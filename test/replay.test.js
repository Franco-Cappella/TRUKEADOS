// Historial: grabar partidas (src/recorder.js), reproducirlas (replay.js), ELO (elo.js) y análisis (analysis.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, nextHand, waitingFor, closeShow } from '../public/js/engine.js';
import { botAction } from '../public/js/bot.js';
import { handFrames, describe, actionLabel } from '../public/js/replay.js';
import { eloDeltas, milestoneCoins, rematchCount } from '../public/js/elo.js';
import { analyzeHand, accuracy, gradeCounts, seeded, classify, winSeries, explain } from '../public/js/analysis.js';
import { GRADES } from '../public/js/config.js';
import { MatchRecorder } from '../src/recorder.js';

// storage del Durable Object, en memoria
function memStorage() {
  const m = new Map();
  return {
    m,
    async get(k) {
      return Array.isArray(k) ? new Map(k.filter((x) => m.has(x)).map((x) => [x, structuredClone(m.get(x))])) : structuredClone(m.get(k));
    },
    async put(obj) {
      for (const [k, v] of Object.entries(obj)) m.set(k, structuredClone(v));
    },
    async delete(keys) {
      for (const k of keys) m.delete(k);
    },
  };
}

// Juega una partida entre bots grabándola como lo hace la sala.
async function recordedGame(mode, seed) {
  const rng = seeded(seed);
  const storage = memStorage();
  const rec = new MatchRecorder(storage);
  const seats = Array.from({ length: { '1v1': 2, '2v2': 4, '3v3': 6 }[mode] }, (_, i) => ({ pid: `u${i}`, name: `J${i}` }));
  const g = newGame({ mode, target: 15 }, rng);
  await rec.start({ code: '1234', cfg: { mode, target: 15 }, seats });
  rec.hand(g);
  let n = 0;
  while (g.status === 'playing' && n++ < 20000) {
    if (g.h.phase === 'ended') {
      nextHand(g, rng);
      rec.hand(g);
      await rec.flush();
      continue;
    }
    const w = waitingFor(g);
    const seat = w.seats[Math.floor(rng() * w.seats.length)];
    const a = botAction(g, seat, rng);
    if (!a) {
      assert.ok(closeShow(g));
      rec.step('close');
    } else {
      assert.ok(act(g, seat, { ...a, basura: 'x'.repeat(10) }).ok);
      rec.step(seat, { ...a, basura: 'x'.repeat(10) }, seat === 1 && n % 5 === 0);
    }
  }
  await rec.flush();
  return { g, rec, storage };
}

test('una partida grabada se reproduce igual hasta el final', async () => {
  for (const [mode, seed] of [['1v1', 1], ['2v2', 2], ['3v3', 3]]) {
    const { g, rec, storage } = await recordedGame(mode, seed);
    // se recupera del storage (como si el Durable Object se hubiera dormido)
    const again = new MatchRecorder(storage);
    await again.load();
    const log = again.log();
    assert.equal(log.hands.length, g.handNo);
    assert.deepEqual(log, rec.log());
    let last = null;
    for (const hand of log.hands) {
      const frames = handFrames(hand);
      assert.equal(frames.length, hand.steps.length + 1, 'todos los pasos se pueden aplicar');
      last = frames[frames.length - 1].g;
      const names = log.seats.map((s) => s.name);
      for (const f of frames.slice(1)) assert.ok(Array.isArray(describe(f, names)));
    }
    assert.deepEqual(last.score, g.score);
    assert.equal(last.status, 'ended');
    assert.equal(last.winner, g.winner);
    // lo que mandó el navegador de más no se guarda
    assert.ok(!JSON.stringify(log).includes('basura'));
  }
});

test('el registro marca las jugadas que hizo un bot por una persona', async () => {
  const { rec } = await recordedGame('1v1', 4);
  const steps = rec.log().hands.flatMap((h) => h.steps);
  assert.ok(steps.some((s) => s[2] === 1));
  assert.ok(steps.every((s) => s[2] !== 1 || s[0] === 1));
});

test('ELO: ganarle a uno mejor suma más; en equipo todos suman lo mismo', () => {
  const [a, b] = eloDeltas([{ team: 0, elo: 1200, games: 20 }, { team: 1, elo: 1400, games: 20 }], 0);
  assert.ok(a > 10 && a < 22 && b === -a);
  const [c] = eloDeltas([{ team: 0, elo: 1400, games: 20 }, { team: 1, elo: 1200, games: 20 }], 0);
  assert.ok(c > 0 && c < a);
  const team = eloDeltas([{ team: 0, elo: 1300, games: 20 }, { team: 1, elo: 1200, games: 20 }, { team: 0, elo: 1100, games: 20 }, { team: 1, elo: 1200, games: 20 }], 1);
  assert.equal(team[0], team[2]);
  assert.equal(team[1], team[3]);
  assert.ok(team[0] < -8 && team[0] > -16);
  // las primeras partidas mueven mucho y, ya ubicado, poquito (como chess.com)
  const delta = (games) => eloDeltas([{ team: 0, elo: 1200, games }, { team: 1, elo: 1200, games: 30 }], 0)[0];
  assert.equal(delta(0), 80);
  assert.ok(delta(5) > 30 && delta(5) < delta(0));
  assert.ok(delta(20) < delta(5) && delta(20) <= 12);
  assert.ok(delta(60) >= 6 && delta(60) <= 8);
  // nadie baja del piso
  assert.equal(eloDeltas([{ team: 0, elo: 110, games: 0 }, { team: 1, elo: 110, games: 0 }], 1)[0], -10);
});

test('ELO: premio por escalones nuevos, una sola vez', () => {
  assert.equal(milestoneCoins(1190, 1210, 100, 75), 75);
  assert.equal(milestoneCoins(1190, 1420, 100, 75), 225);
  assert.equal(milestoneCoins(1450, 1420, 100, 75), 0);
  assert.equal(milestoneCoins(1210, 1290, 100, 75), 0);
});

test('anti-farmeo: cuenta las partidas por ELO entre las mismas personas, una vez por partida', () => {
  const seats = (...uids) => uids.map((uid) => (uid ? { uid } : { bot: true }));
  const rows = [
    // a contra b (asientos 0 y 1): cuenta
    { match_id: 'm1', user_id: 'a', team: 0, match: { seats: seats('a', 'b') } },
    // 2v2 con a y c juntos contra b: cuenta una sola vez aunque estén las dos filas
    { match_id: 'm2', user_id: 'a', team: 0, match: { seats: seats('a', 'b', 'c', 'x') } },
    { match_id: 'm2', user_id: 'c', team: 0, match: { seats: seats('a', 'b', 'c', 'x') } },
    // a y b del mismo lado (asientos 0 y 2): no cuenta
    { match_id: 'm3', user_id: 'a', team: 0, match: { seats: seats('a', 'x', 'b', null) } },
    // a contra bots: no cuenta
    { match_id: 'm4', user_id: 'a', team: 0, match: { seats: seats('a', null) } },
  ];
  assert.equal(rematchCount(rows, ['a', 'c'], ['b']), 2);
  assert.equal(rematchCount(rows, ['a'], ['z']), 0);
  assert.equal(rematchCount([], ['a'], ['b']), 0);
});

test('calificaciones, como en chess.com: por chance de ganar perdida', () => {
  const play = { t: 'play', card: '4E' };
  const truco = { t: 'truco' };
  const base = { a: play, best: play, gap: 0, strength: 0.5, folded: false };
  assert.equal(classify({ ...base, loss: 0 }), 'mejor');
  assert.equal(classify({ ...base, loss: 0.008 }), 'excelente');
  assert.equal(classify({ ...base, loss: 0.02 }), 'buena');
  assert.equal(classify({ ...base, loss: 0.04 }), 'imprecision');
  assert.equal(classify({ ...base, loss: 0.08 }), 'error');
  assert.equal(classify({ ...base, loss: 0.3 }), 'insensata');
  // la única buena
  assert.equal(classify({ ...base, loss: 0, gap: 0.1 }), 'genial');
  // cantar sin cartas y que convenga es una mentira brillante
  assert.equal(classify({ ...base, a: truco, best: truco, loss: 0, strength: 0.1 }), 'brillante');
  // costando un poco, si se la creyeron también
  assert.equal(classify({ ...base, a: truco, best: play, loss: 0.02, strength: 0.1, folded: true }), 'brillante');
  assert.equal(classify({ ...base, a: truco, best: play, loss: 0.04, strength: 0.1 }), 'arriesgada');
  // farolear carísimo es insensato, no arriesgado... salvo que salga
  assert.equal(classify({ ...base, a: truco, best: play, loss: 0.3, strength: 0.1 }), 'insensata');
  // una falta envido de farol que no quisieron es brillante, aunque arriesgara mucho
  const falta = { t: 'envido', kind: 'falta' };
  assert.equal(classify({ ...base, a: falta, best: play, loss: 0.3, strength: 0.08, folded: true }), 'brillante');
  // con cartas, si no la quisieron, al menos buena
  assert.equal(classify({ ...base, a: falta, best: play, loss: 0.2, strength: 0.6, folded: true }), 'buena');
  // tenía para cantar y no cantó
  assert.equal(classify({ ...base, best: truco, loss: 0.05, strength: 0.9 }), 'perdida');
  assert.equal(new Set(GRADES.map((g) => g.key)).size, GRADES.length);
  assert.ok(GRADES.every((g) => g.label && g.glyph));
});

test('análisis: compara todas las opciones y explica la jugada', async () => {
  const { rec } = await recordedGame('1v1', 5);
  const results = rec.log().hands.flatMap((h, i) => analyzeHand(h, [0, 1], i + 1));
  assert.ok(results.length > 5);
  for (const r of results) {
    assert.equal(r.ranked[0].cost, 0);
    assert.ok(r.ranked.every((o, i, l) => !i || l[i - 1].cost <= o.cost));
    assert.equal(r.ranked.filter((o) => o.mine).length, 1);
    assert.equal(typeof explain(r), 'string');
  }
  assert.equal(actionLabel({ t: 'envido', kind: 'envido' }, { calls: ['envido'] }), 'cantar envido envido');
  assert.equal(actionLabel({ t: 'envido', kind: 'envido' }, { calls: [] }), 'cantar envido');
  assert.equal(actionLabel({ t: 'truco' }, { trucoNext: 'Retruco' }), 'cantar retruco');
  const r = { a: { t: 'envido', kind: 'falta' }, kind: 'envido', tanto: 27, envidoWin: 0.58, handWin: 0.5, falta: 30 };
  assert.match(explain(r), /27 de tantos/);
  assert.match(explain(r), /58%/);
  assert.match(explain(r), /30 puntos/);
});

test('gráfico: la chance de ganar arranca pareja y termina en 0 o 1', async () => {
  const { rec, g } = await recordedGame('1v1', 7);
  const frames = rec.log().hands.map(handFrames);
  const series = winSeries(frames);
  assert.equal(series.length, frames.reduce((n, f) => n + f.length, 0));
  assert.ok(series.every((x) => x.p >= 0 && x.p <= 1));
  assert.ok(Math.abs(series[0].p - 0.5) < 0.1, String(series[0].p));
  assert.equal(series[series.length - 1].p, g.winner === 0 ? 1 : 0);
});

test('análisis: califica las decisiones de un jugador y da la precisión', async () => {
  const { rec } = await recordedGame('1v1', 5);
  const results = rec.log().hands.slice(0, 4).flatMap((h, i) => analyzeHand(h, [0], i + 1));
  assert.ok(results.length > 3);
  for (const r of results) {
    assert.equal(r.seat, 0);
    assert.ok(r.loss >= 0 && r.best.ev >= r.chosen.ev);
  }
  const acc = accuracy(results);
  assert.ok(acc >= 0 && acc <= 100);
  const counts = gradeCounts(results);
  assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), results.length);
  // siempre da lo mismo
  assert.deepEqual(analyzeHand(rec.log().hands[0], [0], 1).map((r) => r.loss), analyzeHand(rec.log().hands[0], [0], 1).map((r) => r.loss));
});
