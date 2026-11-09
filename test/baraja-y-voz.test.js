// La baraja de la tienda y la voz que elige cada jugador.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeRoom } from './helpers/room-harness.mjs';
import { COSMETIC_SLOTS, cosmeticById, cleanEquipped } from '../public/js/config.js';
import { newDeck } from '../public/js/engine.js';
import { manVoice } from '../public/js/voices.js';
import { rivalSeat } from '../src/matchmaking.js';

test('baraja pixel: cuesta 300, tiene su ranura, sus créditos y todas sus cartas', () => {
  const it = cosmeticById('baraja-pixel');
  assert.equal(it.price, 300);
  assert.match(it.credit.text, /jcanabal/);
  assert.ok(COSMETIC_SLOTS.some((s) => s.key === it.slot));
  assert.deepEqual(cleanEquipped({ baraja: it.id }), { baraja: it.id });
  for (const id of ['back', ...newDeck()]) assert.ok(fs.existsSync(`public/cards/baraja-pixel/${id}.png`), id);
});

test('baraja pixel: los bots no la tienen, es de quien la compra', () => {
  for (let i = 0; i < 20; i++) assert.equal(rivalSeat(1000, () => 0, new Set()).cos.baraja, undefined);
});

test('sala: cada jugador habla con la voz que eligió', async () => {
  const h = await makeRoom({ mode: '2v2', host: 'u0' });
  const a = await h.join('u0', { voice: 'f' });
  await h.join('u1', { voice: 'cualquiera' });
  const seats = h.state(a).room.seats;
  assert.equal(seats[0].voice, 'f');
  assert.equal(seats.find((s, i) => s && i > 0).voice, null);
  const b = await h.join('u0', { voice: 'm' });
  assert.equal(h.state(b).room.seats[0].voice, 'm');
});

test('voces: elige una voz de hombre del dispositivo solo si existe', () => {
  const v = (name, lang = 'es-ES') => ({ name, lang });
  assert.equal(manVoice([v('Microsoft Helena'), v('Microsoft Pablo')]).name, 'Microsoft Pablo');
  assert.equal(manVoice([v('Microsoft Helena')]), null);
  assert.equal(manVoice([v('Google male', 'en-US')]), null);
});
