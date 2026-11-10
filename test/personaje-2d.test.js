// El creador de personaje (profiles.look) y la mesa de cada turno (paño y mazo del que juega; el mapa, el de la sala o el tuyo).
import test from 'node:test';
import assert from 'node:assert/strict';
import { LOOK_OPTS, cleanLook, randomLook, AMBIENTES, pickAmbiente, COSMETICS, COSMETIC_SLOTS, cleanEquipped, mapaAmbiente, tableLook, tableOwner, CREATOR } from '../public/js/config.js';
import { AVATAR_COLORS, FLAG_LOOK } from '../public/js/theme.js';

test('creador: hay tantos colores como dice LOOK_OPTS (el servidor valida índices)', () => {
  assert.equal(AVATAR_COLORS.skins.length, LOOK_OPTS.counts.skin);
  assert.equal(AVATAR_COLORS.hairs.length, LOOK_OPTS.counts.hair);
  assert.equal(AVATAR_COLORS.clothes.length, LOOK_OPTS.counts.cloth);
  for (const f of LOOK_OPTS.flags) if (f.id !== 'none') assert.ok(FLAG_LOOK[f.id], `falta cómo se ve la bandera ${f.id}`);
});

test('creador: cleanLook deja solo lo que sirve', () => {
  assert.equal(cleanLook(null), null);
  assert.equal(cleanLook('hola'), null);
  assert.equal(cleanLook([1, 2]), null);
  const c = cleanLook({ skin: 99, hair: -1, style: '<script>', shirt: 'jacket', flag: 'zz', fw: 9999, jaw: 0.123456, glasses: 'si', extra: 'x' });
  assert.equal(c.skin, 3, 'un índice fuera de rango vuelve al de siempre');
  assert.equal(c.hair, 1);
  assert.equal(c.style, 'short');
  assert.equal(c.shirt, 'jacket');
  assert.equal(c.flag, 'none');
  assert.equal(c.fw, LOOK_OPTS.face.fw[1], 'los números se acotan');
  assert.equal(c.jaw, LOOK_OPTS.face.jaw[0]);
  assert.equal(c.glasses, false, 'solo true es true');
  assert.equal(c.extra, undefined);
  assert.ok(JSON.stringify(c).length < 400, 'entra en el adjunto del WebSocket');
});

test('creador: Aleatorio siempre arma uno válido', () => {
  let s = 7;
  const rng = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 300; i++) {
    const l = randomLook(rng);
    assert.deepEqual(cleanLook(l), l);
    if (l.soft) assert.equal(l.beard, 'none', 'con rasgos finos no hay barba');
  }
});

test('creador: la cámara tiene a dónde ir en cada parte', () => {
  for (const k of ['todo', 'cuerpo', 'cara', 'pelo', 'barba', 'ropa', 'bandera']) {
    const c = CREATOR.cam[k];
    assert.ok(c && Number.isFinite(c.x) && Number.isFinite(c.y) && c.zoom > 0, k);
  }
});

test('mapas: el Barrio Chino es de la tienda y no sale en el sorteo', () => {
  let s = 3;
  const rng = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const seen = new Set();
  let prev = null;
  for (let i = 0; i < 500; i++) {
    prev = pickAmbiente(rng, prev);
    seen.add(prev);
  }
  assert.ok(!seen.has('chinatown'));
  assert.equal(seen.size, AMBIENTES.filter((a) => !a.shop).length, 'salen todos los demás');
  assert.ok(COSMETIC_SLOTS.some((x) => x.key === 'mapa'));
  for (const it of COSMETICS.filter((c) => c.slot === 'mapa')) assert.ok(AMBIENTES.some((a) => a.id === it.ambiente), it.id);
  assert.equal(mapaAmbiente('mapa-chinatown'), 'chinatown');
  assert.equal(mapaAmbiente('pano-azul'), null);
  assert.deepEqual(cleanEquipped({ mapa: 'mapa-chinatown' }, ['mapa-chinatown']), { mapa: 'mapa-chinatown' });
  assert.deepEqual(cleanEquipped({ mapa: 'mapa-chinatown' }, []), {}, 'sin comprarlo no se puede poner');
  assert.deepEqual(cleanEquipped({ mapa: 'pano-azul' }), {}, 'cada cosa en su ranura');
});

test('mesa de cada turno: paño y mazo del que juega; el mapa no cambia: el de la sala, o el tuyo si tenés uno', () => {
  const seats = [
    { cos: { mapa: 'mapa-chinatown', pano: 'pano-azul' } },
    { cos: { pano: 'pano-bordo', dorso: 'dorso-negro', mapa: 'mapa-campo' } },
    { cos: {} },
    null,
  ];
  // le toca al 1: su paño y su mazo los ve todo el mundo; su mapa, no (el 0 ve el suyo, el 2 el de la sala)
  assert.deepEqual(tableLook(seats, { owner: 1, me: 0, ambiente: 'bar' }), { pano: 'pano-bordo', dorso: 'dorso-negro', ambiente: 'chinatown' });
  assert.deepEqual(tableLook(seats, { owner: 1, me: 2, ambiente: 'bar' }), { pano: 'pano-bordo', dorso: 'dorso-negro', ambiente: 'bar' });
  assert.equal(tableLook(seats, { owner: 1, me: 1, ambiente: 'bar' }).ambiente, 'campo', 'el suyo lo ve él');
  // le toca al 2 (sin nada): paño y mazo de siempre; el mapa no cambia
  assert.deepEqual(tableLook(seats, { owner: 2, me: 0, ambiente: 'bar' }), { pano: null, dorso: null, ambiente: 'chinatown' });
  assert.deepEqual(tableLook(seats, { owner: 2, me: 2, ambiente: 'bar' }), { pano: null, dorso: null, ambiente: 'bar' });
  // el que mira (sin asiento) ve el de la sala
  assert.deepEqual(tableLook(seats, { owner: 2, me: null, ambiente: 'parque' }).ambiente, 'parque');
  // sin dueño (sala de espera o cargando): tu mapa y el paño del anfitrión
  assert.deepEqual(tableLook(seats, { me: 0, ambiente: 'bar', host: 1 }), { pano: 'pano-bordo', dorso: 'dorso-negro', ambiente: 'chinatown' });
  assert.deepEqual(tableLook(seats, { me: 2, ambiente: 'quincho' }), { pano: null, dorso: null, ambiente: 'quincho' });
  // de quién es la mesa: del que tiene el turno
  assert.equal(tableOwner(null), null);
  assert.equal(tableOwner({ h: { turn: 3 } }), 3);
});

test('bots y rivales automáticos: siempre con su paño y su mazo (se ven en su turno, también mirando)', async () => {
  const { BOT_NAMES, botCos } = await import('../public/js/config.js');
  for (const n of [...BOT_NAMES, 'Juancito', 'La Tana']) {
    const c = botCos(n);
    for (const slot of ['pano', 'dorso']) assert.ok(cleanEquipped({ [slot]: c[slot] })[slot], `${n}: ${slot}`);
    assert.deepEqual(botCos(n), c, 'siempre lo mismo para el mismo nombre');
  }
  // un rival automático con ropa de la partida rápida también trae su mesa (sin perder lo que tenía)
  const rival = botCos('Juancito', { gorro: 'boina' });
  assert.equal(rival.gorro, 'boina');
  assert.ok(rival.pano && rival.dorso);
  // la mesa cambia con cada turno: el paño y el mazo del bot que juega, para el que mira también; el fondo, el de la sala
  const seats = ['Tito', 'Coca', 'Pirulo', 'Beto'].map((n) => ({ name: n, cos: botCos(n) }));
  for (let s = 0; s < 4; s++) {
    const look = tableLook(seats, { owner: s, me: null, ambiente: 'bar' });
    assert.equal(look.pano, seats[s].cos.pano);
    assert.equal(look.dorso, seats[s].cos.dorso);
    assert.equal(look.ambiente, 'bar');
  }
});
