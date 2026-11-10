// La mesa: el ambiente de cada partida y el cartel de cada jugador (foto, ELO y últimas partidas).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AMBIENTES, pickAmbiente } from '../public/js/config.js';
import { recentRow } from '../src/matches.js';
import { fakeRecent } from '../src/matchmaking.js';
import { makeRoom } from './helpers/room-harness.mjs';

test('ambientes: hay varios, todos dibujados, y se elige otro distinto del anterior', () => {
  assert.ok(AMBIENTES.length >= 6);
  const src = fs.readFileSync(new URL('../public/js/ambientes.js', import.meta.url), 'utf8');
  for (const a of AMBIENTES) assert.match(src, new RegExp(`\\n  ${a.id}\\(g\\) \\{`), `falta dibujar ${a.id}`);
  for (let i = 0; i < 50; i++) {
    const prev = AMBIENTES[i % AMBIENTES.length].id;
    const next = pickAmbiente(Math.random, prev);
    assert.notEqual(next, prev);
    assert.ok(AMBIENTES.some((a) => a.id === next));
  }
});

test('ambientes: la sala elige uno al empezar, lo manda a todos y cambia en la revancha', async () => {
  const h = await makeRoom({ mode: '1v1' });
  const a = await h.join('u0');
  const b = await h.join('u1');
  await h.send(a, { t: 'start', fillBots: false });
  const r = h.room.room;
  assert.equal(r.status, 'playing');
  const first = h.state(a).room.ambiente;
  assert.ok(AMBIENTES.some((x) => x.id === first));
  assert.equal(h.state(b).room.ambiente, first, 'todos ven el mismo lugar');
  r.dealUntil = h.now;
  await h.send(a, { t: 'act', a: { t: 'rendirse' } });
  await h.send(a, { t: 'rematch' });
  await h.send(b, { t: 'rematch' });
  assert.equal(r.status, 'playing');
  assert.notEqual(h.state(a).room.ambiente, first, 'en la revancha, otro lugar');
});

test('cartel: las últimas partidas se leen desde la vista de cada jugador', () => {
  const row = recentRow({ team: 1, won: true, elo_before: 1200, elo_after: 1214, ended_at: '2026-11-10T10:00:00Z', match: { mode: '2v2', rated: true, score: [18, 30] } });
  assert.deepEqual(row, { won: true, mode: '2v2', score: [30, 18], delta: 14, at: '2026-11-10T10:00:00Z' });
  assert.equal(recentRow({ team: 0, won: false, elo_before: 1200, elo_after: 1200, match: { mode: '1v1', rated: false, score: [10, 15] } }).delta, null, 'sin puntuar no hay ELO');
});

test('cartel: los rivales automáticos tienen un historial creíble (como una persona)', () => {
  let seed = 7;
  const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const rec = fakeRecent(rng, '1v1');
  assert.equal(rec.length, 3);
  for (const r of rec) {
    assert.equal(r.mode, '1v1');
    assert.ok([15, 30].includes(Math.max(...r.score)));
    assert.equal(r.won, r.score[0] > r.score[1]);
    assert.equal(r.delta > 0, r.won);
  }
});

test('cartel: la sala manda foto y últimas partidas de las personas; los bots elegidos no tienen', async () => {
  const h = await makeRoom({ mode: '2v2' });
  const ws = await h.join('u0');
  const r = h.room.room;
  r.seats[0].avatar = 'data:image/webp;base64,AAAA';
  r.seats[0].recent = [{ won: true, mode: '2v2', score: [30, 12], delta: 9, at: null }];
  r.seats[1] = { bot: true, name: 'Tito' };
  h.room.broadcastState();
  const seats = h.state(ws).room.seats;
  assert.equal(seats[0].avatar, 'data:image/webp;base64,AAAA');
  assert.equal(seats[0].recent.length, 1);
  assert.equal(seats[1].recent, null);
});
