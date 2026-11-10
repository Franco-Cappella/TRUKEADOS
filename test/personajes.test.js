// Personajes 3D (Volcho y Olcho): en la tienda, en los bots que se llaman así, y los modelos preparados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { COSMETICS, COSMETIC_SLOTS, cosmeticById, cleanEquipped, botCos, BOT_NAMES } from '../public/js/config.js';
import { COSMETIC_LOOK } from '../public/js/theme.js';
import { makeRoom } from './helpers/room-harness.mjs';

test('personajes: Volcho y Olcho están en la tienda, caros, en la ranura "personaje"', () => {
  assert.ok(COSMETIC_SLOTS.some((s) => s.key === 'personaje'));
  const max = Math.max(...COSMETICS.filter((c) => c.slot !== 'personaje').map((c) => c.price));
  for (const id of ['volcho', 'olcho']) {
    const it = cosmeticById(id);
    assert.equal(it.slot, 'personaje');
    assert.ok(it.price > max * 5, 'tienen que ser bastante caros');
    assert.ok(COSMETIC_LOOK[id]?.model?.url, 'falta el modelo');
  }
  assert.deepEqual(cleanEquipped({ personaje: 'volcho' }, ['volcho']), { personaje: 'volcho' });
  assert.deepEqual(cleanEquipped({ personaje: 'volcho' }, []), {}, 'sin comprarlo no se puede poner');
});

test('personajes: los bots Volcho y Olcho los usan', () => {
  assert.ok(BOT_NAMES.includes('Volcho') && BOT_NAMES.includes('Olcho'));
  assert.equal(botCos('Volcho').personaje, 'volcho');
  assert.equal(botCos('Olcho', { gorro: 'boina' }).personaje, 'olcho');
  // los demás: algo de la tienda según su nombre (siempre lo mismo), y entre todos usan los personajes 3D
  assert.deepEqual(botCos('Tito'), botCos('Tito'));
  const ids = new Set(COSMETICS.map((c) => c.id));
  for (const n of BOT_NAMES) for (const id of Object.values(botCos(n))) assert.ok(ids.has(id), `${n}: ${id}`);
  const used = new Set(Array.from({ length: 300 }, (_, i) => botCos('bot' + i).personaje).filter(Boolean));
  for (const c of COSMETICS.filter((x) => x.slot === 'personaje')) assert.ok(used.has(c.id), `ningún bot usa ${c.id}`);
});

test('personajes: la sala manda el personaje de los bots que se llaman así', async () => {
  const h = await makeRoom({ mode: '2v2' });
  const ws = await h.join('u0');
  const r = h.room.room;
  r.seats[1] = { bot: true, name: 'Volcho' };
  r.seats[2] = { bot: true, name: 'Olcho' };
  r.seats[3] = { bot: true, name: 'Tito' };
  h.room.broadcastState();
  const seats = h.state(ws).room.seats;
  assert.equal(seats[1].cos.personaje, 'volcho');
  assert.equal(seats[2].cos.personaje, 'olcho');
  assert.deepEqual(seats[3].cos, botCos('Tito'));
});

test('personajes: los modelos están preparados (GLB liviano con esqueleto y la cara encontrada)', () => {
  for (const id of ['volcho', 'olcho']) {
    const buf = fs.readFileSync(new URL(`../public/models/${id}.glb`, import.meta.url));
    assert.equal(buf.toString('latin1', 0, 4), 'glTF');
    assert.ok(buf.length < 4e6, `${id}.glb pesa demasiado`);
    const J = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
    assert.equal(J.skins.length, 1);
    assert.ok(!J.animations, 'las animaciones no se usan: no van');
    const names = new Set(J.nodes.map((n) => n.name));
    for (const b of ['Hips', 'Spine2', 'Neck', 'Head', 'HeadTop_End', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot']) {
      assert.ok(names.has(`mixamorig:${b}`), `falta el hueso ${b}`);
    }
    const f = J.extras.face;
    assert.equal(f.eyes.length, 2);
    assert.ok(f.eyes[0].p[0] < f.eyes[1].p[0], 'ojos izquierdo y derecho');
    assert.ok(f.mouth.p[1] < f.eyes[0].p[1], 'la boca abajo de los ojos');
    assert.ok(fs.existsSync(new URL(`../public/models/${id}.webp`, import.meta.url)), 'falta la foto para la tienda');
  }
});

test('personajes: el Gato Melón (armado de piezas sueltas) tiene esqueleto, pesos y la carita de las señas', () => {
  const buf = fs.readFileSync(new URL('../public/models/gato-melon.glb', import.meta.url));
  assert.equal(buf.toString('latin1', 0, 4), 'glTF');
  assert.ok(buf.length < 2e6, 'gato-melon.glb pesa demasiado');
  const J = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
  assert.equal(J.skins.length, 1);
  assert.equal(J.meshes.length, 1, 'una sola malla');
  assert.equal(J.images.length, 1, 'una sola textura');
  const names = new Set(J.nodes.map((n) => n.name));
  for (const b of ['Hips', 'Spine', 'Spine2', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg']) {
    assert.ok(names.has(`mixamorig:${b}`), `falta el hueso ${b}`);
  }
  const left = J.nodes.find((n) => n.name === 'mixamorig:LeftArm');
  assert.ok(left.translation[0] > 0, 'el brazo izquierdo del personaje va en +x');
  const f = J.extras.face.emoji;
  assert.ok(f && f.r > 0 && f.p.length === 3, 'la carita de las señas tiene lugar y tamaño');
  assert.ok(J.extras.alpha, 'tiene partes transparentes');
  // los créditos de la licencia (Sketchfab Standard: hay que nombrar al autor)
  const item = COSMETICS.find((c) => c.id === 'gato-melon');
  assert.equal(item.name, 'Gato Melón');
  assert.match(item.credit.url, /sketchfab\.com/);
  assert.match(fs.readFileSync(new URL('../public/legal/licencias.html', import.meta.url), 'utf8'), /Kasugay/);
});
