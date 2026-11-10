// Partida rápida: la mesa se completa sola con rivales de ELO parecido, juega por ELO y nadie ve que son automáticos.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeRoom, restoreClock } from './helpers/room-harness.mjs';
import { rivalName, rivalElo, rivalSeat } from '../src/matchmaking.js';
import { AUTH, MATCH, ELO, TIMING, botSkill, SKILL_LEVELS, levelElo } from '../public/js/config.js';
import { botAction } from '../public/js/bot.js';
import { newGame, act } from '../public/js/engine.js';
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

test('después de tirar dos encimadas, si te cantan truco podés contestar', async () => {
  const h = await makeRoom({ mode: '1v1', options: { trampas: true } });
  const ws = await h.join('u0');
  await h.send(ws, { t: 'start', fillBots: true });
  const r = h.room.room;
  r.game = newGame({ mode: '1v1', target: 30, trampas: true, dealer: 1 }, seeded(2));
  r.dealUntil = h.now;
  const [bottom, top] = r.game.h.inHand[0];
  await h.send(ws, { t: 'act', a: { t: 'play2', bottom, top } });
  assert.equal(r.game.h.turn, 1);
  assert.ok(act(r.game, 1, { t: 'truco' }).ok);
  h.room.broadcastState();
  const actions = h.state(ws).game.actions;
  assert.ok(actions.quiero && actions.noquiero, 'no te deja contestar');
});

async function endedTable(humans = 2, disguised = false) {
  const h = await makeRoom({ mode: '1v1' });
  const a = await h.join('u0');
  const b = humans > 1 ? await h.join('u1') : null;
  if (disguised) h.room.room.seats[1] = rivalSeat(1200, seeded(1), new Set());
  await h.send(a, { t: 'start', fillBots: humans < 2 && !disguised });
  const r = h.room.room;
  r.dealUntil = h.now;
  await h.send(a, { t: 'act', a: { t: 'rendirse' } });
  return { h, a, b, r };
}

test('rendirse: tu equipo pierde la partida al momento y se graba', async () => {
  const { r } = await endedTable();
  assert.equal(r.status, 'ended');
  assert.equal(r.game.winner, 1);
  assert.equal(r.game.score[1], r.game.target);
});

test('revancha: arranca recién cuando quieren todos', async () => {
  const { h, a, b, r } = await endedTable();
  await h.send(a, { t: 'rematch' });
  assert.equal(r.status, 'ended', 'arrancó sin el otro');
  assert.deepEqual(h.state(b).room.rematch, [0]);
  await h.send(a, { t: 'rematch' }); // pedirla dos veces no cuenta doble
  assert.equal(r.status, 'ended');
  await h.send(b, { t: 'rematch' });
  assert.equal(r.status, 'playing');
  assert.deepEqual(h.state(a).room.rematch, []);
});

test('revancha: si el que faltaba se va de la mesa, no se lo espera', async () => {
  const { h, a, b, r } = await endedTable();
  await h.send(a, { t: 'rematch' });
  await h.send(b, { t: 'leave' });
  await h.disconnect(b);
  assert.equal(r.status, 'playing');
});

test('revancha: si al otro solo se le cortó, se lo espera hasta que acepte', async () => {
  const { h, a, b, r } = await endedTable();
  await h.send(a, { t: 'rematch' });
  await h.disconnect(b);
  assert.equal(r.status, 'ended', 'arrancó sin que el otro acepte');
});

test('revancha: si uno dice que no, se cancela el pedido', async () => {
  const { h, a, b, r } = await endedTable();
  await h.send(a, { t: 'rematch' });
  await h.send(b, { t: 'rematch-no' });
  assert.equal(r.status, 'ended');
  assert.deepEqual(h.state(a).room.rematch, []);
});

test('revancha: los rivales automáticos aceptan un ratito después', async () => {
  const { h, a, r } = await endedTable(1, true);
  await h.send(a, { t: 'rematch' });
  assert.equal(r.status, 'ended');
  await h.tick(MATCH.rematchMin + MATCH.rematchRand + 500);
  assert.equal(r.status, 'playing');
});

test('el análisis da lo mismo para todos los que lo abren', async () => {
  const { newGame: ng, act: go, waitingFor: wf } = await import('../public/js/engine.js');
  const { snapshot } = await import('../public/js/replay.js');
  const { analyzeHand } = await import('../public/js/analysis.js');
  const rng = seeded(11);
  const g = ng({ mode: '1v1', target: 15 }, rng);
  const hand = { start: snapshot(g), steps: [] };
  for (let i = 0; i < 12 && g.h.phase === 'play'; i++) {
    const s = wf(g).seats[0];
    const a = botAction(g, s, rng, {});
    if (!a || !go(g, s, a, rng).ok) break;
    hand.steps.push([s, a]);
  }
  const of = () => analyzeHand(JSON.parse(JSON.stringify(hand)), [0, 1], 1).map((r) => [r.frame, r.grade, r.loss]);
  assert.deepEqual(of(), of());
});

async function playingTable(mode = '1v1', humans = ['u0', 'u1']) {
  const h = await makeRoom({ mode });
  const ws = [];
  for (const pid of humans) ws.push(await h.join(pid));
  await h.send(ws[0], { t: 'start', fillBots: true });
  return { h, ws, r: h.room.room };
}

test('te vas y no volvés en 40 s: gana el otro', async () => {
  const { h, ws, r } = await playingTable();
  await h.disconnect(ws[1]);
  assert.match(h.chat().at(-1), /pierde la partida/);
  await h.tick(TIMING.afk - 1000, 200);
  assert.equal(r.status, 'playing');
  await h.tick(1500, 200);
  assert.equal(r.status, 'ended');
  assert.equal(r.game.winner, 0);
});

test('si volvés antes de los 40 s, la partida sigue', async () => {
  const { h, ws, r } = await playingTable();
  await h.disconnect(ws[1]);
  await h.tick(TIMING.afk - 5000, 200);
  await h.join('u1');
  await h.tick(10_000, 200);
  assert.equal(r.status, 'playing');
});

test('jugando solo contra bots, irte también te hace perder aunque no quede nadie en la sala', async () => {
  const { h, ws, r } = await playingTable('1v1', ['u0']);
  await h.disconnect(ws[0]);
  assert.ok(h.storage.alarm, 'no quedó la alarma');
  await h.tick(TIMING.afk + 1000, 200);
  assert.equal(r.status, 'ended');
  assert.equal(r.game.winner, 1);
});

test('el cartel de reconectar sabe si seguís en la partida y cuánto te queda', async () => {
  const { h, ws, r } = await playingTable();
  await h.disconnect(ws[1]);
  await h.tick(10_000, 200);
  const m = await h.room.mine('u1');
  assert.equal(m.playing, true);
  assert.equal(m.forfeit, true);
  assert.ok(m.left > 25_000 && m.left <= 30_000);
  assert.equal((await h.room.mine('otro')).playing, false);
  await h.tick(TIMING.afk, 200);
  assert.equal(r.status, 'ended');
  assert.equal((await h.room.mine('u1')).playing, false);
});

test('en equipo, si te queda un compañero conectado, juega un bot por vos y no se pierde', async () => {
  const h = await makeRoom({ mode: '2v2' });
  const a = await h.join('u0');
  const b = await h.join('u1');
  await h.send(a, { t: 'move', from: h.room.seatOf('u1'), to: 2 }); // u0 y u1 compañeros
  await h.send(a, { t: 'start', fillBots: true });
  const r = h.room.room;
  await h.disconnect(b);
  assert.match(h.chat().at(-1), /juega un bot en su lugar/);
  await h.tick(TIMING.afk + 1000, 200);
  assert.equal(r.status, 'playing');
  assert.equal(r.afkBot?.[2], true);
});
