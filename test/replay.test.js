// Historial: grabar partidas (src/recorder.js), reproducirlas (replay.js), ELO (elo.js) y análisis (analysis.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, nextHand, waitingFor, closeShow } from '../public/js/engine.js';
import { botAction } from '../public/js/bot.js';
import { handFrames, describe } from '../public/js/replay.js';
import { eloDeltas } from '../public/js/elo.js';
import { analyzeHand, accuracy, gradeCounts, seeded } from '../public/js/analysis.js';
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
  assert.ok(a > 16 && a < 32 && b === -a);
  const [c] = eloDeltas([{ team: 0, elo: 1400, games: 20 }, { team: 1, elo: 1200, games: 20 }], 0);
  assert.ok(c > 0 && c < a);
  const team = eloDeltas([{ team: 0, elo: 1300, games: 20 }, { team: 1, elo: 1200, games: 20 }, { team: 0, elo: 1100, games: 20 }, { team: 1, elo: 1200, games: 20 }], 1);
  assert.equal(team[0], team[2]);
  assert.equal(team[1], team[3]);
  assert.equal(team[0], -16);
  // las primeras partidas mueven más
  const [fresh] = eloDeltas([{ team: 0, elo: 1200, games: 0 }, { team: 1, elo: 1200, games: 30 }], 0);
  assert.equal(fresh, 24);
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
