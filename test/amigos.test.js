// Amigos conectados (presencia) y chat entre amigos, en el Lobby.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers/room-harness.mjs'; // registra el 'cloudflare:workers' de mentira
import { PRESENCE } from '../public/js/config.js';

const { Lobby } = await import('../src/lobby.js');

class Mem {
  constructor() {
    this.map = new Map();
  }
  async get(k) {
    if (Array.isArray(k)) return new Map(k.filter((x) => this.map.has(x)).map((x) => [x, structuredClone(this.map.get(x))]));
    return this.map.has(k) ? structuredClone(this.map.get(k)) : undefined;
  }
  async put(k, v) {
    this.map.set(k, structuredClone(v));
  }
}
const lobby = () => new Lobby({ storage: new Mem() }, {});

test('presencia: conectado mientras avisa, desconectado después de un rato sin aviso', async () => {
  const l = lobby();
  const t = 1_000_000;
  await l.ping('a', { where: 'room', code: '4821', status: 'playing', mode: '2v2', score: [12, 9] }, t);
  await l.ping('b', { where: 'menu' }, t);
  let p = await l.presenceOf(['a', 'b', 'c'], t + 1000);
  assert.deepEqual({ ...p.a, at: 0 }, { online: true, at: 0, where: 'room', code: '4821', mode: '2v2', status: 'playing', spectating: false, score: [12, 9] });
  assert.equal(p.b.where, 'menu');
  assert.equal(p.c.online, false);
  p = await l.presenceOf(['a'], t + PRESENCE.ttl + 1);
  assert.equal(p.a.online, false, 'sin aviso, desconectado');
  // lo que manda el navegador se limpia
  await l.ping('d', { where: 'room', code: 'xx', mode: 'nada', status: 'rara' }, t);
  p = await l.presenceOf(['d'], t);
  assert.equal(p.d.code, undefined);
  assert.equal(p.d.mode, undefined);
  assert.equal(p.d.status, 'lobby');
});

test('chat entre amigos: se guarda por pareja, se trae desde una fecha y queda el último de cada uno', async () => {
  const l = lobby();
  await l.dmSend('a', 'b', 'hola', 10);
  await l.dmSend('b', 'a', '¿jugamos?', 20);
  await l.dmSend('a', 'c', 'otra charla', 30);
  assert.equal(await l.dmSend('a', 'b', '   ', 40), null, 'vacío no se manda');
  assert.deepEqual((await l.dmGet('b', 'a')).map((m) => m.text), ['hola', '¿jugamos?']);
  assert.deepEqual((await l.dmGet('a', 'b', 10)).map((m) => m.text), ['¿jugamos?']);
  assert.deepEqual(await l.dmLast('a', ['b', 'c', 'z']), { b: { at: 20, from: 'b' }, c: { at: 30, from: 'a' } });
  for (let i = 0; i < PRESENCE.dmKeep + 10; i++) await l.dmSend('a', 'b', `m${i}`, 100 + i);
  assert.equal((await l.dmGet('a', 'b')).length, PRESENCE.dmKeep, 'quedan los últimos');
});
