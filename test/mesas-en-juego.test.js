// Mesas en juego del lobby, ruleta de frases y 1v1 sin tirar antes de tiempo.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeRoom, restoreClock } from './helpers/room-harness.mjs';
import { newShowTable, scoreAt, isOver, wantedTables, showSummary, uniquePlayers } from '../src/show-tables.js';
import { SHOW_TABLES, AUTH, MODES, AVATAR, MATCH } from '../public/js/config.js';
import { parseGif, mergeRanking } from '../src/social.js';
import { rosterAt } from '../src/roster.js';
import { seeded } from '../public/js/analysis.js';
import { PHRASE_WHEEL, ASK_TALK } from '../public/js/talk.js';
import { newGame, act, actionsFor, viewFor } from '../public/js/engine.js';
import { voiceKey, voiceText, voiceFor, womanVoice, VOICES } from '../public/js/voices.js';

after(restoreClock);

test('mesas en juego: entre SHOW_TABLES.min y max, con usuarios creíbles y códigos propios', () => {
  for (let i = 0; i < 300; i++) {
    const n = wantedTables(i * SHOW_TABLES.refreshMs);
    assert.ok(n >= SHOW_TABLES.min && n <= SHOW_TABLES.max, String(n));
  }
  assert.ok(SHOW_TABLES.min >= 12, 'hay muchas mesas para mirar');
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

test('mesas en juego: nadie juega en dos mesas a la vez', () => {
  const rng = seeded(9);
  const taken = new Set();
  const busy = new Set();
  const tables = [];
  // el máximo de mesas, todas de 3 vs 3 si salen: igual no se repite nadie
  for (let i = 0; i < SHOW_TABLES.max; i++) {
    const t = newShowTable(rng, 1000, taken, busy);
    taken.add(t.code);
    t.seats.forEach((s) => busy.add(s.name));
    tables.push(t);
  }
  const names = tables.flatMap((t) => t.seats.map((s) => s.name));
  assert.equal(new Set(names).size, names.length, 'un jugador en dos mesas');
  // y si en lo guardado había alguien repetido (de antes del arreglo), esa mesa se saca
  const dup = { ...tables[1], seats: [tables[0].seats[0], ...tables[1].seats.slice(1)] };
  assert.equal(uniquePlayers([tables[0], dup, tables[2]]).length, 2);
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

test('ruleta: ninguna frase canta nada sin querer y hay de todo', () => {
  assert.ok(PHRASE_WHEEL.length >= 5);
  for (const c of PHRASE_WHEEL) {
    assert.ok(c.phrases.length >= 4, c.label);
    assert.equal(new Set(c.phrases).size, c.phrases.length, c.label);
    for (const p of c.phrases) assert.ok(!/truco|envido|retruco|vale cuatro/i.test(p), p);
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

test('voces: se alternan la grabada y la de mujer del dispositivo', () => {
  assert.equal(voiceFor(0), 'davefx');
  assert.equal(voiceFor(1), null);
  assert.equal(voiceFor(2), 'davefx');
  assert.ok(VOICES.includes(voiceFor(null)));
  const v = (name, lang = 'es-ES') => ({ name, lang });
  assert.equal(womanVoice([v('Microsoft Pablo'), v('Microsoft Helena'), v('Microsoft Laura')]).name, 'Microsoft Helena');
  assert.equal(womanVoice([v('Microsoft Pablo'), v('Google español')]).name, 'Google español');
  assert.equal(womanVoice([v('Microsoft Zira', 'en-US')]), null);
});

test('ranking: los usuarios automáticos están, sin repetirse, y las mesas los usan', () => {
  const list = rosterAt(Date.UTC(2026, 10, 12));
  assert.equal(new Set(list.map((p) => p.username)).size, list.length);
  assert.ok(list.every((p) => AUTH.usernameRe.test(p.username) && p.elo_1v1 > 0 && p.games_1v1 > 0));
  const real = [{ id: 'yo', username: 'Theo', avatar: null, elo_1v1: 5000, games_1v1: 3 }];
  const top = mergeRanking(real, '1v1', Date.UTC(2026, 10, 12));
  assert.equal(top[0].id, 'yo');
  assert.ok(top.length <= 50 && top.every((p, i) => !i || top[i - 1].elo_1v1 >= p.elo_1v1));
  const names = new Set(rosterAt().map((p) => p.username));
  const t = newShowTable(seeded(7), Date.now(), new Set());
  assert.ok(t.seats.every((s) => names.has(s.name)));
  // cambia de a poco, día a día
  const a = rosterAt(Date.UTC(2026, 10, 12))[0].elo_1v1;
  const b = rosterAt(Date.UTC(2026, 10, 13))[0].elo_1v1;
  assert.ok(Math.abs(a - b) <= 25);
});

test('espectadores: se cuentan y tienen su chat, que a los jugadores no les llega', async () => {
  const h = await makeRoom({ mode: '1v1' });
  const a = await h.join('u0');
  const b = await h.join('u1');
  await h.send(a, { t: 'start', fillBots: false });
  const v = await h.join('mira', { spectate: true });
  const w = await h.join('mira2', { spectate: true });
  assert.equal(h.state(a).room.spectators, 2);
  assert.ok(v.last('spec-history'));
  a.got.length = 0;
  await h.send(v, { t: 'chat', text: 'qué partido' });
  assert.equal(w.last('spec-chat').msg.text, 'qué partido');
  assert.equal(a.last('spec-chat'), null);
  assert.equal(a.last('chat'), null);
  assert.equal(b.last('spec-chat'), null);
  // el jugador sigue hablando en la mesa
  await h.send(a, { t: 'chat', text: 'truco no' });
  assert.equal(v.last('chat').msg.text, 'truco no');
});

async function quickTeam(mode = '2v2') {
  const h = await makeRoom({ mode });
  h.room.room.quick = { elo: 1300, startedAt: Date.now(), nextAt: Date.now() + MATCH.waitMin };
  h.room.room.cfg.isPublic = true;
  const ws = await h.join('u0');
  return { h, ws, r: h.room.room };
}

test('invitar a tu equipo: el invitado se sienta con vos y los rivales no te ocupan el lugar', async () => {
  const { h, ws, r } = await quickTeam();
  await h.send(ws, { t: 'invite-team' });
  assert.equal(h.state(ws).room.quick.holding, 1);
  await h.tick(MATCH.waitMin + MATCH.gapMin + MATCH.gapRand + 2000, 200);
  assert.equal(r.seats[2], null, 'un bot ocupó el lugar de tu compañero');
  assert.equal(r.seats.filter(Boolean).length, 3);
  assert.equal(r.status, 'lobby');
  await h.join('amigo', { invited: true });
  assert.equal(r.seats[2]?.pid, 'amigo');
  assert.equal(r.status, 'playing');
});

test('invitar a tu equipo: si desistís o se acaba el tiempo, se completa la mesa', async () => {
  const a = await quickTeam();
  await a.h.send(a.ws, { t: 'invite-team' });
  await a.h.send(a.ws, { t: 'invite-cancel' });
  await a.h.tick(MATCH.waitMin + (MATCH.gapMin + MATCH.gapRand) * 4, 200);
  assert.equal(a.r.status, 'playing');
  const b = await quickTeam();
  await b.h.send(b.ws, { t: 'invite-team' });
  await b.h.tick(MATCH.inviteHold + (MATCH.gapMin + MATCH.gapRand) * 4, 200);
  assert.equal(b.r.status, 'playing');
});

test('invitar a tu equipo: un desconocido no entra a los lugares guardados', async () => {
  const { h, ws, r } = await quickTeam();
  await h.send(ws, { t: 'invite-team' });
  await h.join('x');
  await h.join('y');
  await h.join('z');
  assert.equal(r.seats[2], null);
  assert.equal(r.seats.filter((s) => s && !s.bot).length, 3);
});

test('las consultas al compañero van en singular', () => {
  for (const list of [ASK_TALK.tantos.ask, ASK_TALK.truco.ask, ASK_TALK.truco.askRe, ASK_TALK.truco.askCuatro]) {
    assert.ok(list.every((t) => !/tienen|compañeros|andan/i.test(t)), list.join());
  }
  assert.ok(ASK_TALK.tantos.ask.includes('¿Tenés tantos, compañero?'));
});
