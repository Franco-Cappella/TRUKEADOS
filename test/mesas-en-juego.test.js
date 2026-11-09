// Mesas en juego del lobby, ruleta de frases y 1v1 sin tirar antes de tiempo.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeRoom, restoreClock } from './helpers/room-harness.mjs';
import { newShowTable, scoreAt, isOver, wantedTables, showSummary } from '../src/show-tables.js';
import { SHOW_TABLES, AUTH, MODES } from '../public/js/config.js';
import { seeded } from '../public/js/analysis.js';
import { PHRASE_WHEEL, BOT_TALK } from '../public/js/talk.js';
import { newGame, act, actionsFor } from '../public/js/engine.js';
import { voiceKey, voiceText } from '../public/js/voices.js';

after(restoreClock);

test('mesas en juego: entre 7 y 10, con usuarios creíbles y códigos propios', () => {
  for (let i = 0; i < 300; i++) {
    const n = wantedTables(i * SHOW_TABLES.refreshMs);
    assert.ok(n >= 7 && n <= 10, String(n));
  }
  const rng = seeded(2);
  const taken = new Set();
  for (let i = 0; i < 200; i++) {
    const t = newShowTable(rng, 1000, taken);
    taken.add(t.code);
    assert.ok(/^9\d{3}$/.test(t.code));
    assert.equal(t.seats.length, MODES[t.mode]);
    assert.ok(t.seats.every((s) => s.disguised && AUTH.usernameRe.test(s.name)));
    assert.equal(new Set(t.seats.map((s) => s.name)).size, t.seats.length);
  }
  assert.equal(taken.size, 200);
});

test('mesas en juego: el tanteador avanza con el tiempo, igual para todos, y la mesa termina', () => {
  const t = newShowTable(seeded(3), 0, new Set());
  assert.deepEqual(scoreAt(t, 0), t.score);
  const later = scoreAt(t, t.pace * 4);
  assert.ok(later[0] + later[1] > t.score[0] + t.score[1]);
  assert.deepEqual(later, scoreAt(t, t.pace * 4));
  assert.equal(isOver(t, 0), false);
  assert.equal(isOver(t, t.pace * 500), true);
  assert.deepEqual(showSummary(t, 0).players, t.seats.map((s) => s.name));
});

test('sala: la mesa en juego se arma con el tanteador y se puede mirar sin ver que son automáticos', async () => {
  const h = await makeRoom({ mode: '1v1' });
  h.room.room = null;
  const t = newShowTable(seeded(5), h.now, new Set());
  const score = [3, 7];
  await h.room.showUp({ code: t.code, mode: t.mode, target: t.target, seats: t.seats, score });
  const r = h.room.room;
  assert.equal(r.status, 'playing');
  assert.deepEqual(r.game.score, score);
  const ws = await h.join('mira');
  const st = h.state(ws);
  assert.equal(st.you, null);
  assert.ok(st.room.seats.every((s) => s.bot === false));
  assert.equal(JSON.stringify(st).includes('disguised'), false);
  // mientras la miran se juega en serio
  const before = r.game.evId;
  await h.tick(30_000, 200);
  assert.ok(r.game.evId > before, 'no se jugó nada');
});

test('1v1: no se puede tirar antes que el rival', () => {
  const g = newGame({ mode: '1v1', target: 15 }, seeded(4));
  const other = g.h.turn === 0 ? 1 : 0;
  assert.equal(actionsFor(g, other).throwOut, false);
  assert.ok(act(g, other, { t: 'play', card: g.h.inHand[other][0] }).error);
});

test('ruleta: son frases de los bots y ninguna canta nada sin querer', () => {
  const all = new Set(Object.values(BOT_TALK).flat(3).filter((x) => typeof x === 'string'));
  for (const c of PHRASE_WHEEL) {
    assert.equal(c.phrases.length, 8, c.label);
    for (const p of c.phrases) {
      assert.ok(!/truco|envido|retruco|vale cuatro/i.test(p), p);
      if (c.label !== 'Equipo') assert.ok(all.has(p), p);
    }
  }
});

test('voces: la misma frase con otros signos usa el mismo audio', () => {
  assert.equal(voiceKey('¡Truco!'), voiceKey('truco'));
  assert.equal(voiceText('¿Pongo o voy?'), 'pongo o voy');
  assert.notEqual(voiceKey('Quiero'), voiceKey('No quiero'));
});
