// Mesas en juego del lobby, ruleta de frases y 1v1 sin tirar antes de tiempo.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeRoom, restoreClock } from './helpers/room-harness.mjs';
import { newShowTable, scoreAt, isOver, wantedTables, showSummary } from '../src/show-tables.js';
import { SHOW_TABLES, AUTH, MODES, AVATAR } from '../public/js/config.js';
import { parseGif } from '../src/social.js';
import { seeded } from '../public/js/analysis.js';
import { PHRASE_WHEEL, BOT_TALK } from '../public/js/talk.js';
import { newGame, act, actionsFor, viewFor } from '../public/js/engine.js';
import { voiceKey, voiceText, voiceFor, VOICES } from '../public/js/voices.js';

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

test('encimadas: la de arriba no se quema si la de abajo mató, y si la mano termina antes tampoco se ve quemada', () => {
  const setup = (cards) => {
    const g = newGame({ mode: '1v1', target: 30, trampas: true, dealer: 1 }, seeded(1));
    g.h.cards = cards.map((c) => c.slice());
    g.h.inHand = cards.map((c) => c.slice());
    g.h.muestra = null;
    return g;
  };
  const top = (g) => viewFor(g, 0).h.table[0].find((p) => p.over);
  let g = setup([['1E', '4C', '5O'], ['4B', '6O', '7C']]);
  assert.ok(act(g, 0, { t: 'play2', bottom: '1E', top: '4C' }).ok);
  assert.equal(top(g).burned, false);
  assert.ok(act(g, 1, { t: 'play', card: '4B', mode: 'normal' }).ok);
  assert.equal(top(g).burned, false, 'mató y se quemó');
  // el rival se va antes de contestar: la ronda no se cerró
  g = setup([['1E', '4C', '5O'], ['4B', '6O', '7C']]);
  assert.ok(act(g, 0, { t: 'play2', bottom: '1E', top: '4C' }).ok);
  assert.ok(act(g, 1, { t: 'mazo' }).ok);
  assert.equal(top(g).burned, false);
  // si no mató, se quema al cerrar la ronda
  g = setup([['4B', '4C', '5O'], ['1E', '6O', '7C']]);
  assert.ok(act(g, 0, { t: 'play2', bottom: '4B', top: '4C' }).ok);
  assert.ok(act(g, 1, { t: 'play', card: '1E', mode: 'normal' }).ok);
  assert.equal(top(g).burned, true);
});

test('GIF de perfil: acepta GIF de verdad y rechaza lo demás o lo que pesa mucho', () => {
  const gif = (bytes) => 'data:image/gif;base64,' + Buffer.from(bytes).toString('base64');
  assert.ok(parseGif(gif('GIF89a' + 'x'.repeat(50))));
  assert.equal(parseGif(gif('<script>alert(1)</script>')), null);
  assert.equal(parseGif(gif('GIF89a' + 'x'.repeat(AVATAR.gifMaxBytes))), null);
  assert.equal(parseGif('data:image/png;base64,AAAA'), null);
  assert.equal(parseGif('no'), null);
});

test('voces: se alternan entre las dos por asiento', () => {
  assert.notEqual(voiceFor(0), voiceFor(1));
  assert.equal(voiceFor(0), voiceFor(2));
  assert.ok(VOICES.includes(voiceFor(null)));
});
