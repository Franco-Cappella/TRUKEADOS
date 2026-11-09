// Partida rápida: la mesa se completa sola con rivales de ELO parecido, juega por ELO y nadie ve que son automáticos.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeRoom, restoreClock } from './helpers/room-harness.mjs';
import { rivalName, rivalElo, rivalSeat } from '../src/matchmaking.js';
import { AUTH, MATCH, ELO, botSkill, SKILL_LEVELS, levelElo } from '../public/js/config.js';
import { botAction } from '../public/js/bot.js';
import { newGame } from '../public/js/engine.js';
import { seeded } from '../public/js/analysis.js';

after(restoreClock);

async function quickRoom(mode = '1v1', elo = 1300) {
  const h = await makeRoom({ mode });
  h.room.room.quick = { elo, startedAt: Date.now(), nextAt: Date.now() + MATCH.waitMin };
  h.room.room.cfg.isPublic = true;
  return h;
}

test('nivel inicial: cada nivel arranca en su ELO y un valor raro cae en intermedio', () => {
  assert.deepEqual(SKILL_LEVELS.map((l) => l.elo), [400, 800, 1200, 1600, 2000]);
  assert.equal(levelElo('experto'), 2000);
  assert.equal(levelElo('cualquiera'), 1200);
});

test('nombres de rivales: válidos para la mesa, sin repetir y sin la palabra bot', () => {
  const rng = seeded(3);
  const used = new Set();
  for (let i = 0; i < 400; i++) {
    const n = rivalName(rng, used);
    assert.ok(AUTH.usernameRe.test(n), n);
    assert.ok(!/bot/i.test(n), n);
    assert.ok(!used.has(n), n);
    used.add(n);
  }
});

test('ELO de los rivales: cerca del que busca y nunca bajo el piso', () => {
  const rng = seeded(4);
  for (let i = 0; i < 500; i++) {
    const e = rivalElo(1500, rng);
    assert.ok(Math.abs(e - 1500) <= MATCH.eloSpread * 1.6, String(e));
    assert.ok(rivalElo(100, rng) >= ELO.floor);
  }
});

test('fuerza según el ELO: más ELO, más manos imaginadas, menos ruido y menos macanas', () => {
  const low = botSkill(500);
  const high = botSkill(1900);
  assert.ok(high.samples > low.samples && high.temp < low.temp && high.slip < low.slip);
  // con cualquier fuerza devuelve una jugada
  const rng = seeded(8);
  const g = newGame({ mode: '1v1', target: 15 }, rng);
  const seat = g.h.turn;
  assert.ok(botAction(g, seat, rng, { skill: low }));
  assert.ok(botAction(g, seat, rng, { skill: high }));
});

test('sala: tarda en aparecer el rival, se llena sola, arranca y el navegador no ve que es automático', async () => {
  const h = await quickRoom('1v1');
  const ws = await h.join('u0');
  await h.send(ws, { t: 'join', token: 'u0' });
  assert.equal(h.state(ws).room.status, 'lobby');
  assert.ok(h.state(ws).room.quick);
  await h.tick(MATCH.waitMin - 500);
  assert.equal(h.state(ws).room.status, 'lobby', 'todavía no apareció nadie');
  await h.tick(1500);
  const st = h.state(ws);
  assert.equal(st.room.status, 'playing');
  const rival = st.room.seats.find((s) => s.name !== st.room.seats[st.you].name);
  assert.equal(rival.bot, false);
  assert.ok(rival.elo > 0);
  assert.equal(JSON.stringify(st).includes('disguised'), false);
  assert.ok(h.room.rec.meta.rated, 'cuenta para el ELO');
});

test('sala: si entra otra persona, juegan entre ellos', async () => {
  const h = await quickRoom('1v1');
  const a = await h.join('u0');
  await h.join('u1');
  const st = h.state(a);
  assert.equal(st.room.status, 'playing');
  assert.ok(st.room.seats.every((s) => !s.bot));
  assert.equal(h.room.room.seats.some((s) => s.disguised), false);
});

test('sala 2v2: los rivales se van sentando de a uno', async () => {
  const h = await quickRoom('2v2');
  const ws = await h.join('u0');
  await h.tick(MATCH.waitMin + 200);
  assert.equal(h.state(ws).room.seats.filter(Boolean).length, 2);
  await h.tick((MATCH.gapMin + MATCH.gapRand) * 2 + 500);
  assert.equal(h.state(ws).room.status, 'playing');
});

test('sala: si el que buscaba se va, no se sigue llenando', async () => {
  const h = await quickRoom('2v2');
  const ws = await h.join('u0');
  await h.disconnect(ws);
  await h.tick(MATCH.waitMin + MATCH.gapRand * 3);
  assert.ok(h.room.room.seats.every((s) => !s?.disguised));
});

test('mesa sin puntuar: no cuenta para el ELO aunque jueguen personas', async () => {
  const h = await makeRoom({ mode: '1v1' });
  h.room.room.cfg.rated = false;
  const a = await h.join('u0');
  await h.join('u1');
  await h.send(a, { t: 'start', fillBots: false });
  assert.equal(h.room.rec.meta.rated, false);
});

test('reglas antes de entrar: la sala las cuenta y el anfitrión puede cambiar la puntuación', async () => {
  const h = await makeRoom({ mode: '2v2', options: { flor: true } });
  const ws = await h.join('u0');
  const info = await h.room.info();
  assert.equal(info.cfg.flor, true);
  assert.equal(info.cfg.rated, true);
  assert.deepEqual(info.players.length, 1);
  await h.send(ws, { t: 'config', cfg: { rated: false } });
  assert.equal((await h.room.info()).cfg.rated, false);
});

test('los rivales automáticos no hacen trampa ni se pasan las cartas', async () => {
  const h = await makeRoom({ mode: '2v2' });
  const rng = seeded(9);
  h.room.room.seats = [{ pid: 'u0', name: 'Ana' }, rivalSeat(1200, rng, new Set()), rivalSeat(1200, rng, new Set()), rivalSeat(1200, rng, new Set())];
  h.room.room.game = newGame({ mode: '2v2', target: 15, trampas: true }, rng);
  for (let i = 0; i < 200; i++) h.room.botCheats();
  assert.deepEqual(h.room.room.botPeek, {});
  assert.deepEqual(h.room.botCtx(1).bots, []);
  assert.ok(h.room.botCtx(1).skill);
});
