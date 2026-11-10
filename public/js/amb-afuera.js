// Los ambientes de afuera, con el mismo cuidado que el Barrio Chino: los Bosques de Palermo en primavera (el lago
// con patos y botes, el puente blanco, los jacarandás en flor y el rosedal), el quincho en una noche de verano (la
// pileta iluminada, la parrilla con fuego, la pérgola con enredadera y lamparitas) y la estancia al atardecer (el
// casco con galería, el molino que gira, los caballos, la paja brava que se mece y los pájaros volviendo).
// Del lado de +z (atrás de tu silla) el centro queda libre y bajo: por ahí mira la cámara de la sala de espera.
import * as THREE from 'three';
import {
  hsl, basic, box, cyl, ball, put, canvasTex, noise, seeded, toon, tick, glowSprite,
  sunLight, tableLight, bulb, flicker, stringLights, embers, fire, smoke, water, grassTufts, birds, butterflies, label, plate,
} from './amb-kit.js';
import { tree, chair, sideTable, glassware, pottedPlant, brickTex, checkerTex, plankTex } from './amb-piezas.js';
import { sky, clouds, layer, paintHills, paintTreeline, paintCity, petals, fireflies } from './paisaje.js';

// Pasto pintado (con matas, tréboles y flores) para un piso grande.
function grassTex({ base, dark = '20,60,10', light = '200,230,120', flowers = ['#fbfbf2', '#f2d64b'], seed = 9, repeat = 16 }) {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const r = seeded(seed);
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(${r() < 0.5 ? dark : light},0.09)`;
      ctx.beginPath();
      ctx.ellipse(r() * w, r() * h, 20 + r() * 50, 12 + r() * 30, r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const c = new THREE.Color(base);
    const hs = {};
    c.getHSL(hs);
    // unos pocos tonos y muchas briznas (cada una, un trazo inclinado)
    const tones = Array.from({ length: 8 }, (_, k) => `#${new THREE.Color().setHSL(hs.h + ((k % 3) - 1) * 0.02, hs.s, hs.l * (0.75 + (k / 7) * 0.5)).getHexString()}`);
    ctx.lineWidth = 1.6;
    for (const tone of tones) {
      ctx.strokeStyle = tone;
      ctx.beginPath();
      for (let i = 0; i < 750; i++) {
        const x = r() * w;
        const y = r() * h;
        const len = 4 + r() * 4;
        const a = (r() - 0.5) * 0.8;
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.sin(a) * len, y + Math.cos(a) * len);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = flowers[Math.floor(r() * flowers.length)];
      ctx.beginPath();
      ctx.arc(r() * w, r() * h, 1.6 + r() * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [repeat, repeat]);
}

function ground(g, tex, size = 80) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), toon(null, { map: tex }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

// Un camino (o un patio) de baldosas/tierra en círculo debajo de la mesa.
function patch(g, r, tex, y = 0.006) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), toon(null, { map: tex }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

// Farol de plaza (columna de hierro con el globo) con halo.
function streetLamp(g, x, z, { lit = false, color = '#fff6dc', iron } = {}) {
  put(g, cyl(0.1, 0.13, 0.4, iron, 10), x, 0.2, z);
  put(g, cyl(0.04, 0.06, 3.0, iron, 8), x, 1.9, z);
  put(g, cyl(0.12, 0.05, 0.12, iron, 10, false), x, 3.42, z);
  put(g, ball(0.17, basic(lit ? color : '#f4f4f0', { transparent: true, opacity: 0.95 }), 16), x, 3.6, z);
  put(g, cyl(0.05, 0.12, 0.06, iron, 10, false), x, 3.79, z);
  if (lit) {
    const h = glowSprite(color, 1.6, 0.6);
    put(g, h, x, 3.6, z);
    return h;
  }
  return null;
}

// Banco de plaza: listones verdes y patas de hierro.
function bench(g, x, z, rot, { slat, iron }) {
  const b = new THREE.Group();
  for (let k = 0; k < 3; k++) put(b, box(1.5, 0.04, 0.1, slat), 0, 0.45, -0.12 + k * 0.12);
  for (let k = 0; k < 2; k++) put(b, box(1.5, 0.08, 0.04, slat), 0, 0.62 + k * 0.14, 0.2);
  for (const lx of [-0.65, 0.65]) put(b, box(0.05, 0.85, 0.42, iron), lx, 0.42, 0.04);
  b.position.set(x, 0, z);
  b.rotation.y = rot;
  g.add(b);
}

// Pato (o cisne) que nada en el lago: cuerpo, cuello, cabeza y pico.
function duck(white = false) {
  const d = new THREE.Group();
  const body = toon(white ? '#f7f7f2' : hsl(30, 0.35, 0.4));
  const b = ball(0.16, body, 12);
  b.scale.set(1.4, 0.75, 1);
  put(d, b, 0, 0.06, 0);
  const neck = cyl(0.035, 0.045, white ? 0.32 : 0.16, white ? body : toon(hsl(150, 0.6, 0.28)), 8);
  neck.rotation.z = white ? 0.15 : 0.3;
  put(d, neck, 0.16, white ? 0.24 : 0.16, 0);
  put(d, ball(0.06, white ? body : toon(hsl(150, 0.6, 0.28)), 10), white ? 0.2 : 0.2, white ? 0.4 : 0.25, 0);
  put(d, box(0.08, 0.025, 0.03, toon(hsl(30, 0.9, 0.5)), false), white ? 0.27 : 0.27, white ? 0.39 : 0.24, 0);
  return d;
}

// ------------------------------------------------------------------ Bosques de Palermo

// Los Bosques de Palermo una mañana de primavera: el lago con patos, cisnes y botes a pedal; el puente blanco; los
// jacarandás violetas y los palos borrachos; canteros de rosas; faroles y bancos de plaza; el pasto alto que se mece;
// mariposas, pájaros y la ciudad asomando entre la bruma.
export function parque(g) {
  sky(g, [[0, hsl(208, 0.65, 0.5)], [0.32, hsl(204, 0.6, 0.68)], [0.47, hsl(198, 0.45, 0.86)], [0.5, hsl(55, 0.35, 0.9)], [0.52, hsl(100, 0.3, 0.42)], [1, hsl(100, 0.3, 0.3)]], {
    glow: { u: 0.62, v: 0.2, color: 'rgba(255,250,220,1)', size: 0.22, alpha: 0.75 },
    haze: 'rgba(240,248,255,0.6)',
  });
  clouds(g, { r: 32, y: 11.5, h: 9, n: 22, seed: 4, speed: 0.006 });
  clouds(g, { r: 28, y: 8, h: 5, n: 14, seed: 9, speed: 0.01, alpha: 0.75, shade: '#c7d3e3' });
  layer(g, paintCity(hsl(215, 0.2, 0.62), { min: 0.15, max: 0.7, antenna: 0.25 }), { r: 31, h: 6, y: 2.9, seed: 5, haze: hsl(205, 0.45, 0.86), t: 0.6 });
  layer(g, paintTreeline(hsl(130, 0.35, 0.32), hsl(80, 0.5, 0.6), { top: 0.3 }), { r: 22, h: 4.8, y: 2.35, haze: hsl(200, 0.3, 0.82), t: 0.35, seed: 6 });
  layer(g, paintTreeline(hsl(120, 0.4, 0.24), hsl(80, 0.55, 0.55), { top: 0.35, poplar: 0.25 }), { r: 17, h: 4.4, y: 2.15, haze: hsl(200, 0.3, 0.8), t: 0.12, seed: 13 });

  g.add(new THREE.HemisphereLight('#ffffff', hsl(100, 0.25, 0.35), 1.25));
  sunLight(g, '#fff8e8', 1.7, [4, 7, 3]);
  ground(g, grassTex({ base: hsl(100, 0.5, 0.42) }));
  // el claro de tierra apisonada bajo la mesa, con un borde de ladrillo
  patch(g, 2.4, canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = hsl(32, 0.35, 0.62);
    ctx.fillRect(0, 0, w, h);
    const r = seeded(3);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(${r() < 0.5 ? '90,60,30' : '255,240,210'},0.18)`;
      ctx.fillRect(r() * w, r() * h, 2, 2);
    }
  }, [3, 3]));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.05, 6, 64), toon(hsl(10, 0.5, 0.42)));
  ring.rotation.x = Math.PI / 2;
  put(g, ring, 0, 0.02, 0);
  // el camino de lajas hacia el lago
  const path = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 9), toon(null, { map: checkerTex(hsl(30, 0.12, 0.7), hsl(30, 0.12, 0.62), { n: 4, repeat: 1, grout: 'rgba(60,80,40,0.6)' }) }));
  path.material.map.repeat.set(1, 6);
  path.rotation.x = -Math.PI / 2;
  path.rotation.z = 0.5;
  path.position.set(-3.2, 0.008, -6);
  path.receiveShadow = true;
  g.add(path);

  // el lago: agua que brilla, patos, cisnes y botes a pedal
  water(g, { x: -6, z: -12, w: 18, d: 9, color: hsl(195, 0.5, 0.52), deep: hsl(200, 0.55, 0.36) });
  const shore = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.53, 64), toon(hsl(35, 0.3, 0.55)));
  shore.rotation.x = -Math.PI / 2;
  shore.scale.set(18, 9, 1);
  put(g, shore, -6, 0.015, -12);
  const swimmers = [];
  [[false, 0], [false, 1.4], [false, 2.6], [true, 4], [true, 5.1]].forEach(([white, ph]) => {
    const d = duck(white);
    g.add(d);
    swimmers.push([d, ph, white ? 3.6 : 2.4]);
  });
  // botes a pedal (de colores) con techito
  const boats = [];
  [hsl(0, 0.7, 0.55), hsl(200, 0.7, 0.5), hsl(48, 0.9, 0.55)].forEach((c, i) => {
    const b = new THREE.Group();
    put(b, box(1.2, 0.25, 0.7, toon(c)), 0, 0.12, 0);
    put(b, box(1.0, 0.04, 0.75, toon('#f4f4f0')), 0, 0.85, 0);
    for (const [px, pz] of [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]]) put(b, cyl(0.015, 0.015, 0.6, toon('#ddd'), 6, false), px, 0.55, pz);
    g.add(b);
    boats.push([b, i * 2.1]);
  });
  tick(g, (now) => {
    const t = now / 1000;
    for (const [d, ph, rr] of swimmers) {
      const a = t * 0.05 + ph;
      d.position.set(-6 + Math.cos(a) * rr * 1.6, 0.02 + Math.sin(t * 2 + ph) * 0.01, -12 + Math.sin(a) * rr * 0.8);
      d.rotation.y = -a - Math.PI / 2;
    }
    for (const [b, ph] of boats) {
      const a = -t * 0.03 + ph;
      b.position.set(-6 + Math.cos(a) * 5.5, 0.02 + Math.sin(t * 1.3 + ph) * 0.02, -12 + Math.sin(a) * 2.6);
      b.rotation.y = -a;
    }
  });
  // el puente blanco sobre el lago (un arco con barandas)
  const bridge = new THREE.Group();
  const white = toon('#f6f4ee');
  const arc = new THREE.Shape();
  arc.moveTo(-3, 0);
  arc.quadraticCurveTo(0, 1.6, 3, 0);
  arc.lineTo(3, 0.25);
  arc.quadraticCurveTo(0, 1.85, -3, 0.25);
  arc.closePath();
  const deck = new THREE.Mesh(new THREE.ExtrudeGeometry(arc, { depth: 1.6, bevelEnabled: false, curveSegments: 20 }), white);
  deck.position.z = -0.8;
  deck.castShadow = true;
  bridge.add(deck);
  for (const sz of [-0.8, 0.75]) {
    for (let i = -6; i <= 6; i++) {
      const x = (i / 6) * 2.8;
      const y = 0.25 + (1 - (x / 3) ** 2) * 0.8;
      put(bridge, box(0.06, 0.55, 0.06, white), x, y + 0.27, sz);
    }
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const x = -2.9 + (i / 20) * 5.8;
      pts.push(new THREE.Vector3(x, 0.25 + (1 - (x / 3) ** 2) * 0.8 + 0.55, sz));
    }
    bridge.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.04, 6), white));
  }
  bridge.position.set(-11, 0, -9);
  bridge.rotation.y = 0.9;
  g.add(bridge);

  // árboles: jacarandás en flor, tipas y algún palo borracho, en ronda (lejos de la vista de la sala de espera)
  const r = seeded(21);
  const lilac = [hsl(270, 0.55, 0.62), hsl(265, 0.6, 0.7), hsl(275, 0.45, 0.55)];
  const pink = [hsl(330, 0.7, 0.7), hsl(335, 0.65, 0.78)];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + r() * 0.2;
    const d = 6.5 + r() * 9;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (z > 2 && Math.abs(x) < 5) continue; // la vista de la sala de espera
    if (Math.hypot(x + 6, (z + 12) * 2) < 18) continue; // el lago
    const kind = r();
    if (kind < 0.35) tree(g, x, z, { h: 3.4 + r() * 1.6, crown: 1.3 + r() * 0.6, trunk: hsl(25, 0.25, 0.25), leaves: hsl(270, 0.45, 0.55), flowers: lilac, r });
    else if (kind < 0.45) tree(g, x, z, { h: 3 + r(), crown: 1.1 + r() * 0.4, trunk: hsl(80, 0.25, 0.35), leaves: hsl(330, 0.55, 0.6), flowers: pink, r });
    else tree(g, x, z, { h: 3.2 + r() * 2.4, crown: 1.1 + r() * 0.8, trunk: hsl(25, 0.25, 0.22), leaves: hsl(105 + r() * 20, 0.45, 0.32 + r() * 0.1), r });
  }
  // pétalos de jacarandá que caen
  petals(g, { n: 120, colors: lilac, area: 8, top: 4.5, speed: 0.22, size: 0.06, seed: 3 });
  // el rosedal: canteros redondos con rosales florecidos
  const roses = [hsl(350, 0.8, 0.5), hsl(340, 0.7, 0.72), hsl(45, 0.95, 0.6), '#fdf6ee', hsl(15, 0.85, 0.58)];
  for (const [cx, cz] of [[5.2, -4.2], [6.6, -1.2], [-4.8, 4.6]]) {
    put(g, cyl(1.05, 1.1, 0.2, toon(hsl(10, 0.45, 0.42)), 24), cx, 0.1, cz);
    put(g, cyl(0.98, 0.98, 0.02, toon(hsl(20, 0.4, 0.2)), 24, false), cx, 0.21, cz);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const bx = cx + Math.cos(a) * 0.6;
      const bz = cz + Math.sin(a) * 0.6;
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), toon(hsl(120, 0.45, 0.26), { flatShading: true }));
      put(g, bush, bx, 0.45, bz);
      bush.castShadow = true;
      const col = roses[(i + Math.round(cx)) % roses.length];
      for (let k = 0; k < 6; k++) put(g, ball(0.045, toon(col), 8), bx + (r() - 0.5) * 0.45, 0.5 + r() * 0.25, bz + (r() - 0.5) * 0.45);
    }
  }
  butterflies(g, [[5.2, 0.9, -4.2], [6.6, 1.0, -1.2], [-4.8, 0.9, 4.6], [3, 1.2, -6], [-2, 1.1, -4]]);
  birds(g, { n: 9, r: 18, y: 10, color: '#2a3036' });
  grassTufts(g, { n: 650, inner: 2.6, outer: 16, color: hsl(100, 0.5, 0.3), tip: hsl(80, 0.55, 0.55), h: 0.32, avoid: (x, z) => Math.hypot(x + 6, (z + 12) * 2) < 18 || (z > 1.5 && Math.abs(x) < 4.5) });
  // bancos, faroles, un bebedero y un carrito de helados
  const iron = toon(hsl(150, 0.25, 0.14));
  const slat = toon(hsl(140, 0.35, 0.32));
  for (const [x, z, rot] of [[3.4, -2.6, -0.7], [-3.6, -2.4, 0.8], [-5.4, 2.0, 2.0], [5.4, 2.2, -2.0]]) bench(g, x, z, rot, { slat, iron });
  for (const [x, z] of [[2.8, -3.6], [-2.9, -3.4], [5, 4.6], [-5.2, 0]]) streetLamp(g, x, z, { iron });
  const cart = new THREE.Group();
  put(cart, box(1.1, 0.7, 0.6, toon('#f7f2e6')), 0, 0.65, 0);
  put(cart, box(1.12, 0.12, 0.62, toon(hsl(200, 0.7, 0.55))), 0, 0.95, 0);
  for (const sx of [-1, 1]) {
    const wh = cyl(0.22, 0.22, 0.05, toon('#222'), 16);
    wh.rotation.x = Math.PI / 2;
    put(cart, wh, sx * 0.4, 0.22, 0.32);
  }
  put(cart, cyl(0.02, 0.02, 1.5, toon('#ddd'), 6, false), 0, 1.7, 0);
  const umb = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.35, 12, 1, true), toon(null, { map: canvasTex(256, 32, (ctx, w, h) => {
    for (let x = 0, k = 0; x < w; x += 32, k++) {
      ctx.fillStyle = k % 2 ? '#ffffff' : hsl(350, 0.75, 0.55);
      ctx.fillRect(x, 0, 32, h);
    }
  }), side: THREE.DoubleSide }));
  put(cart, umb, 0, 2.45, 0);
  put(cart, plate(label('HELADOS', { w: 512, h: 128, fg: hsl(200, 0.7, 0.4), size: 90 }), 0.9, 0.22), 0, 0.72, 0.31);
  put(g, cart, 6.2, 0, -6.4, -0.6);
  return { background: hsl(205, 0.4, 0.85), fog: [hsl(200, 0.3, 0.86), 14, 36] };
}

// ------------------------------------------------------------------ quincho

// Quincho en una noche de verano: la pérgola con la enredadera y las guirnaldas de lamparitas, la parrilla de ladrillo
// con el fuego y el humo, la pileta iluminada que tiembla, reposeras, el jardín con canteros, luciérnagas, la luna y
// las estrellas, y las luces del pueblo a lo lejos.
export function quincho(g) {
  sky(g, [[0, hsl(232, 0.55, 0.04)], [0.35, hsl(228, 0.5, 0.09)], [0.48, hsl(235, 0.35, 0.2)], [0.5, hsl(25, 0.45, 0.28)], [0.52, hsl(230, 0.3, 0.05)], [1, hsl(230, 0.3, 0.04)]], {
    stars: 460,
    moon: { dir: [-0.6, 0.5, -0.65], size: 3.2 },
    glow: { u: 0.8, v: 0.5, color: 'rgba(255,170,90,0.9)', size: 0.25, alpha: 0.35 },
  });
  clouds(g, { color: hsl(230, 0.2, 0.3), shade: hsl(230, 0.3, 0.12), r: 32, y: 13, h: 6, n: 8, alpha: 0.35, speed: 0.003 });
  layer(g, paintCity(hsl(230, 0.25, 0.08), { lit: 0.14, light: '#ffcf7a', min: 0.08, max: 0.3, antenna: 0.05 }), { r: 28, h: 4, y: 1.95, seed: 7 });
  layer(g, paintTreeline(hsl(230, 0.3, 0.06), hsl(230, 0.3, 0.12), { top: 0.3, poplar: 0.3 }), { r: 19, h: 5, y: 2.45, seed: 4 });
  fireflies(g, { n: 60, area: 9 });

  g.add(new THREE.HemisphereLight(hsl(225, 0.35, 0.55), hsl(30, 0.3, 0.12), 0.75));
  tableLight(g, { color: '#ffe3b8', intensity: 8 });
  put(g, cyl(0.005, 0.005, 0.5, basic('#0a0a0a'), 4, false), 0, 2.9, 0);
  put(g, new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.26, 32, 1, true), toon(hsl(30, 0.3, 0.15), { side: THREE.DoubleSide })), 0, 2.62, 0);
  bulb(g, 0, 2.55, 0, { color: '#fff2d6', size: 0.07 });
  ground(g, grassTex({ base: hsl(110, 0.3, 0.2), flowers: [hsl(110, 0.25, 0.25)], seed: 12 }));
  // el piso del quincho: baldosas de terracota bajo la pérgola
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 8.4), toon(null, { map: checkerTex(hsl(14, 0.5, 0.36), hsl(16, 0.5, 0.4), { n: 8, repeat: 4, grout: 'rgba(30,10,0,0.4)' }) }));
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, 0.006, -0.6);
  deck.receiveShadow = true;
  g.add(deck);
  // pérgola de madera con enredadera
  const wood = toon(hsl(25, 0.4, 0.22));
  for (const x of [-4, 4]) for (const z of [-4.4, 3.4]) put(g, box(0.16, 3.1, 0.16, wood), x, 1.55, z);
  for (const z of [-4.4, 3.4]) put(g, box(8.4, 0.18, 0.14, wood), 0, 3.15, z);
  for (let i = -6; i <= 6; i++) put(g, box(0.1, 0.12, 8.2, wood), i * 0.66, 3.3, -0.5);
  const vine = leafMatsVine();
  const r = seeded(14);
  for (let i = 0; i < 38; i++) {
    const s = new THREE.Sprite(vine[i % 2]);
    const sz = 0.9 + r() * 0.8;
    s.scale.set(sz, sz * 0.6, 1);
    s.position.set((r() - 0.5) * 8.4, 3.42 + r() * 0.15, -0.5 + (r() - 0.5) * 8.2);
    g.add(s);
  }
  for (const x of [-4, 4]) for (const z of [-4.4, 3.4]) for (let k = 0; k < 3; k++) {
    const s = new THREE.Sprite(vine[k % 2]);
    s.scale.set(0.5, 0.9, 1);
    s.position.set(x + (r() - 0.5) * 0.2, 0.6 + k * 0.9, z + (r() - 0.5) * 0.2);
    g.add(s);
  }
  // guirnaldas de lamparitas en zigzag
  stringLights(g, [-4, 3.05, -4.4], [4, 3.05, -1.6], { n: 16, sag: 0.35 });
  stringLights(g, [4, 3.05, -1.6], [-4, 3.05, 1.0], { n: 16, sag: 0.35 });
  stringLights(g, [-4, 3.05, 1.0], [4, 3.05, 3.4], { n: 16, sag: 0.35 });

  // la parrilla de ladrillo al fondo, con fuego, brasas y humo
  const bm = toon(null, { map: brickTex({ seed: 6 }) });
  const zb = -5.3;
  put(g, box(3.6, 0.95, 1.0, bm), 0.6, 0.475, zb);
  for (const x of [-1.1, 2.3]) put(g, box(0.3, 1.4, 1.0, bm), x, 1.65, zb);
  put(g, box(3.8, 0.9, 1.2, toon(null, { map: brickTex({ seed: 7, soot: 0.6 }) })), 0.6, 2.75, zb);
  put(g, box(0.9, 1.6, 0.7, bm), 0.6, 3.9, zb - 0.1);
  embers(g, 0.9, 1.0, zb, 2.4, 0.7, { light: 2 });
  fire(g, -0.5, 1.02, zb, { size: 0.5, light: 2 });
  smoke(g, 0.6, 4.7, zb - 0.1, { n: 8, rise: 2.5, size: 0.9, alpha: 0.18, spread: 0.6, color: 'rgba(160,165,180,0.5)', period: 5200 });
  for (let i = 0; i < 4; i++) put(g, box(0.5, 0.05, 0.22, toon(hsl(12, 0.55, 0.28))), 0.2 + i * 0.5, 1.12, zb);
  // mesada con el vino, el pan y el termo
  put(g, box(1.6, 0.9, 0.6, bm), 3.4, 0.45, zb + 0.2);
  put(g, box(1.7, 0.06, 0.7, toon(hsl(30, 0.1, 0.6))), 3.4, 0.93, zb + 0.2);
  for (let i = 0; i < 3; i++) put(g, cyl(0.04, 0.045, 0.3, toon(hsl(140, 0.4, 0.15)), 10), 3.0 + i * 0.15, 1.11, zb + 0.15);
  glassware(g, 3.7, 0.96, zb + 0.3, { wine: '#5a0c16' });
  glassware(g, 3.85, 0.96, zb + 0.2, { wine: '#5a0c16' });

  // la pileta iluminada, a la derecha, con sus reposeras
  const pool = new THREE.Group();
  put(pool, box(4.6, 0.12, 0.35, toon(hsl(30, 0.1, 0.8))), 0, 0.06, -1.6);
  put(pool, box(4.6, 0.12, 0.35, toon(hsl(30, 0.1, 0.8))), 0, 0.06, 1.6);
  put(pool, box(0.35, 0.12, 3.55, toon(hsl(30, 0.1, 0.8))), -2.3, 0.06, 0);
  put(pool, box(0.35, 0.12, 3.55, toon(hsl(30, 0.1, 0.8))), 2.3, 0.06, 0);
  pool.position.set(8.2, 0, -1.4);
  pool.rotation.y = Math.PI / 2;
  g.add(pool);
  water(g, { x: 8.2, z: -1.4, w: 2.9, d: 4.3, shape: 'rect', color: hsl(185, 0.85, 0.5), deep: hsl(190, 0.9, 0.38), y: 0.05, night: true });
  const pl = new THREE.PointLight('#5ff2ff', 3, 6, 1.6);
  pl.position.set(8.2, 0.6, -1.4);
  g.add(pl);
  const poolGlow = glowSprite('rgba(80,240,255,1)', 5, 0.18);
  put(g, poolGlow, 8.2, 0.4, -1.4);
  flicker(g, [pl, poolGlow], { base: 1, amp: 0.15, speed: 0.8 });
  for (const z of [-3.2, -1.4, 0.4]) {
    const lounger = new THREE.Group();
    put(lounger, box(0.6, 0.08, 1.4, toon('#f2f2ee')), 0, 0.3, 0);
    const back = box(0.6, 0.08, 0.6, toon('#f2f2ee'));
    back.rotation.x = -0.9;
    put(lounger, back, 0, 0.5, -0.8);
    for (const [lx, lz] of [[-0.25, -0.6], [0.25, -0.6], [-0.25, 0.6], [0.25, 0.6]]) put(lounger, box(0.04, 0.28, 0.04, toon('#bbb')), lx, 0.14, lz);
    put(g, lounger, 5.7, 0, z, -Math.PI / 2 + 0.2);
  }
  // jardín: canteros con plantas, macetas, arbustos recortados y árboles
  for (const [x, z] of [[-4.6, -4.8], [-4.8, 2.6], [4.8, 3.6], [-6, -1]]) pottedPlant(g, x, z, { kind: r() < 0.5 ? 'palm' : 'bush', h: 1.3, leaves: hsl(130, 0.35, 0.2), pot: hsl(15, 0.45, 0.3), r });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const d = 9 + r() * 5;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (z > 2 && Math.abs(x) < 5) continue;
    tree(g, x, z, { h: 3.2 + r() * 2, crown: 1.2 + r() * 0.6, trunk: hsl(25, 0.2, 0.12), leaves: hsl(140, 0.35, 0.14 + r() * 0.05), r });
  }
  // mesa ratona con el mate y la radio, y dos sillones de jardín
  const iron = toon(hsl(0, 0, 0.1));
  sideTable(g, -2.6, -2.8, toon(hsl(30, 0.2, 0.6)), iron, { items: (tx, ty, tz) => {
    put(g, cyl(0.04, 0.035, 0.08, toon(hsl(30, 0.5, 0.3)), 10), tx, ty + 0.04, tz);
    put(g, cyl(0.05, 0.05, 0.3, toon(hsl(0, 0.0, 0.85)), 12), tx + 0.15, ty + 0.15, tz);
    put(g, box(0.25, 0.14, 0.1, toon(hsl(5, 0.5, 0.35))), tx - 0.12, ty + 0.07, tz + 0.1);
  } });
  for (const [x, z, rr] of [[-3.2, -2.3, 1.2], [-2.0, -3.4, 0.1]]) chair(g, x, z, rr, toon(hsl(30, 0.3, 0.3)));
  grassTufts(g, { n: 260, inner: 4.6, outer: 14, color: hsl(115, 0.3, 0.12), tip: hsl(100, 0.3, 0.25), h: 0.32, avoid: (x, z) => (x > 5.4 && x < 11 && z > -4.2 && z < 1.4) || (z > 1.5 && Math.abs(x) < 4.5) });
  return { background: hsl(230, 0.3, 0.04), fog: [hsl(230, 0.3, 0.05), 11, 30] };
}

// Hojas de enredadera (para la pérgola), oscuras de noche, con algún jazmín.
function leafMatsVine() {
  return [0, 1].map((k) => {
    const tex = canvasTex(256, 160, (ctx, w, h) => {
      const r = seeded(50 + k);
      for (let i = 0; i < 220; i++) {
        const x = r() * w;
        const y = h * 0.5 + (r() - 0.5) * h * 0.8 * Math.sin((x / w) * Math.PI);
        ctx.fillStyle = r() < 0.08 ? '#f6f2e6' : hsl(120 + r() * 20, 0.4, 0.1 + r() * 0.12);
        ctx.beginPath();
        ctx.ellipse(x, y, 7 + r() * 5, 4 + r() * 3, r() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    return new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.3 });
  });
}

// ------------------------------------------------------------------ estancia

// Caballo (o vaca) de formas simples, de perfil, pastando.
function horse(g, x, z, rot, { coat, mane, cow = false }) {
  const h = new THREE.Group();
  const m = toon(coat);
  const body = box(cow ? 1.3 : 1.25, cow ? 0.6 : 0.5, cow ? 0.6 : 0.42, m);
  put(h, body, 0, cow ? 0.85 : 0.95, 0);
  for (const [lx, lz] of [[-0.45, -0.14], [0.45, -0.14], [-0.45, 0.14], [0.45, 0.14]]) put(h, box(0.1, cow ? 0.6 : 0.72, 0.1, m), lx, cow ? 0.3 : 0.36, lz);
  const neck = box(0.25, 0.7, 0.24, m);
  neck.rotation.z = -1.0; // pastando: el cuello para abajo
  put(h, neck, 0.75, 0.75, 0);
  put(h, box(0.45, 0.2, 0.2, m), 1.05, 0.38, 0);
  if (!cow) {
    const crin = box(0.08, 0.6, 0.06, toon(mane));
    crin.rotation.z = -1.0;
    put(h, crin, 0.72, 0.86, 0);
    const tail = box(0.08, 0.6, 0.08, toon(mane));
    tail.rotation.z = 0.3;
    put(h, tail, -0.68, 0.75, 0);
  } else {
    put(h, box(0.5, 0.3, 0.62, toon('#f4f0e8')), -0.2, 0.95, 0); // manchas
  }
  h.position.set(x, 0, z);
  h.rotation.y = rot;
  g.add(h);
  return h;
}

// La estancia al atardecer: el casco blanco con galería de arcos y techo de tejas, el molino que gira con el tanque
// australiano, el galpón, la tranquera y el alambrado, caballos y vacas pastando, el ombú enorme, una hilera de
// eucaliptos, la paja brava que se mece, el fogón prendido, el humo de la chimenea y los pájaros volviendo.
export function campo(g) {
  sky(g, [[0, hsl(215, 0.5, 0.45)], [0.26, hsl(225, 0.4, 0.62)], [0.4, hsl(330, 0.4, 0.72)], [0.46, hsl(28, 0.85, 0.72)], [0.5, hsl(40, 0.95, 0.82)], [0.52, hsl(60, 0.25, 0.35)], [1, hsl(60, 0.25, 0.28)]], {
    glow: { u: 0.375, v: 0.46, color: 'rgba(255,190,110,1)', size: 0.32, alpha: 0.9 },
    haze: 'rgba(255,200,150,0.7)',
  });
  clouds(g, { color: hsl(35, 0.95, 0.82), shade: hsl(330, 0.35, 0.55), r: 32, y: 10.5, h: 10, n: 9, seed: 12, alpha: 0.9, speed: 0.004 });
  clouds(g, { color: hsl(20, 0.8, 0.75), shade: hsl(300, 0.3, 0.45), r: 29, y: 7.5, h: 4, n: 8, seed: 3, alpha: 0.6, speed: 0.007 });
  layer(g, paintHills(hsl(25, 0.25, 0.55), { base: 0.75, amp: 0.15, waves: 2 }), { r: 31, h: 3, y: 1.45, seed: 5 });
  layer(g, paintTreeline(hsl(80, 0.25, 0.2), hsl(40, 0.8, 0.6), { top: 0.25, poplar: 0.45 }), { r: 24, h: 4.4, y: 2.15, haze: hsl(30, 0.6, 0.72), t: 0.35, seed: 19 });
  birds(g, { n: 11, r: 15, y: 8.5, color: '#2a1c1a', speed: 0.04 });

  g.add(new THREE.HemisphereLight(hsl(30, 0.6, 0.85), hsl(60, 0.2, 0.25), 1.05));
  sunLight(g, hsl(32, 0.85, 0.72), 1.9, [-6, 3, -5]);
  ground(g, grassTex({ base: hsl(62, 0.38, 0.42), flowers: [hsl(50, 0.8, 0.6), '#f4efe0'], dark: '60,50,10', light: '240,220,140', seed: 13, repeat: 20 }));
  // la galería de ladrillo bajo la mesa
  patch(g, 2.5, brickTex({ repeat: [3, 3], tones: [hsl(12, 0.45, 0.42), hsl(14, 0.45, 0.48), hsl(10, 0.4, 0.38)], base: hsl(20, 0.2, 0.55) }));

  // el casco: casa blanca con galería de arcos y techo de tejas, a la izquierda atrás
  const casa = new THREE.Group();
  const cal = toon(hsl(40, 0.25, 0.9));
  const teja = toon(null, { map: canvasTex(256, 128, (ctx, w, h) => {
    ctx.fillStyle = hsl(12, 0.55, 0.35);
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < w; x += 16) {
      ctx.fillStyle = hsl(12 + (x % 5), 0.55, 0.42);
      ctx.beginPath();
      ctx.arc(x + 8, y + 12, 8, Math.PI, 0);
      ctx.fill();
    }
  }, [4, 2]) });
  put(casa, box(8, 3, 4, cal), 0, 1.5, -1);
  // galería de arcos adelante
  const arcade = new THREE.Shape();
  arcade.moveTo(-4, 0);
  arcade.lineTo(4, 0);
  arcade.lineTo(4, 2.8);
  arcade.lineTo(-4, 2.8);
  arcade.closePath();
  for (let i = 0; i < 5; i++) {
    const cx = -3.2 + i * 1.6;
    const p = new THREE.Path();
    p.moveTo(cx - 0.6, 0);
    p.lineTo(cx + 0.6, 0);
    p.lineTo(cx + 0.6, 1.7);
    p.absarc(cx, 1.7, 0.6, 0, Math.PI, false);
    p.closePath();
    arcade.holes.push(p);
  }
  const ar = new THREE.Mesh(new THREE.ExtrudeGeometry(arcade, { depth: 0.3, bevelEnabled: false }), cal);
  ar.castShadow = true;
  put(casa, ar, 0, 0, 1.6);
  put(casa, box(8.4, 0.12, 2.6, toon(hsl(25, 0.3, 0.3))), 0, 2.86, 0.6);
  const roofShape = new THREE.Shape([new THREE.Vector2(-2.6, 0), new THREE.Vector2(2.6, 0), new THREE.Vector2(0, 1.4)]);
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: 8.6, bevelEnabled: false }), teja);
  roof.rotation.y = Math.PI / 2;
  roof.position.set(-4.3, 2.95, 0.2);
  roof.castShadow = true;
  casa.add(roof);
  // ventanas con luz y la chimenea con humo
  for (const x of [-2.4, 0, 2.4]) {
    put(casa, box(0.8, 1.1, 0.05, basic('#ffd890')), x, 1.4, 1.02);
    put(casa, glowSprite('rgba(255,200,120,1)', 1.4, 0.3), x, 1.4, 1.2);
  }
  put(casa, box(0.5, 1.4, 0.5, cal), 2.6, 4.2, -0.6);
  casa.position.set(-9, 0, -9);
  casa.rotation.y = 0.45;
  g.add(casa);
  const chim = new THREE.Vector3(2.6, 4.9, -0.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.45).add(new THREE.Vector3(-9, 0, -9));
  smoke(g, chim.x, chim.y, chim.z, { n: 9, rise: 3.2, size: 1.0, alpha: 0.22, spread: 0.9, color: 'rgba(230,220,215,0.6)', period: 6500 });

  // el molino que gira y el tanque australiano
  const dark = toon(hsl(30, 0.1, 0.16));
  const mill = new THREE.Group();
  for (const [x, zz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
    const leg = cyl(0.04, 0.04, 7, dark, 6);
    leg.position.set(x * 0.6, 3.5, zz * 0.6);
    leg.rotation.set(-zz * 0.08, 0, x * 0.08);
    mill.add(leg);
  }
  for (let k = 1; k < 6; k++) put(mill, box(0.9 - k * 0.1, 0.04, 0.04, dark), 0, k * 1.2, 0.36 - k * 0.04);
  const wheel = new THREE.Group();
  for (let i = 0; i < 18; i++) {
    const blade = box(0.12, 1.3, 0.02, toon(hsl(30, 0.05, 0.75)), false);
    blade.position.y = 0.75;
    blade.rotation.y = 0.3;
    const arm = new THREE.Group();
    arm.add(blade);
    arm.rotation.z = (i / 18) * Math.PI * 2;
    wheel.add(arm);
  }
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.03, 6, 36), dark);
  wheel.add(rim);
  wheel.position.set(0, 7.2, 0.3);
  const tail = box(0.05, 0.7, 1.6, toon(hsl(5, 0.6, 0.45)));
  tail.position.set(0, 7.2, -0.8);
  mill.add(wheel, tail);
  mill.scale.setScalar(0.72);
  mill.position.set(7, 0, -11);
  mill.rotation.y = -0.4;
  g.add(mill);
  tick(g, (now, dt) => (wheel.rotation.z += dt * 0.9));
  const tank = cyl(2.2, 2.2, 1.0, toon(hsl(200, 0.08, 0.6)), 32);
  put(g, tank, 10.5, 0.5, -9.5);
  water(g, { x: 10.5, z: -9.5, w: 4.2, d: 4.2, y: 1.01, color: hsl(30, 0.5, 0.6), deep: hsl(200, 0.4, 0.4) });

  // el galpón de chapa a la derecha
  const shed = new THREE.Group();
  put(shed, box(5, 2.6, 3.2, toon(hsl(5, 0.45, 0.42))), 0, 1.3, 0);
  const gable = new THREE.Shape([new THREE.Vector2(-1.8, 0), new THREE.Vector2(1.8, 0), new THREE.Vector2(0, 1.1)]);
  const sroof = new THREE.Mesh(new THREE.ExtrudeGeometry(gable, { depth: 5.4, bevelEnabled: false }), toon(hsl(210, 0.06, 0.62)));
  sroof.rotation.y = Math.PI / 2;
  sroof.position.set(-2.7, 2.6, 0);
  sroof.castShadow = true;
  shed.add(sroof);
  put(shed, box(1.8, 2.0, 0.05, toon(hsl(5, 0.3, 0.2))), 0, 1.0, 1.62);
  shed.position.set(12, 0, -1);
  shed.rotation.y = -Math.PI / 2 + 0.3;
  g.add(shed);

  // tranquera y alambrado (atrás, cruzando)
  const fence = toon(hsl(30, 0.3, 0.25));
  for (let i = -8; i <= 8; i++) {
    if (Math.abs(i) <= 1) continue;
    put(g, box(0.1, 1.2, 0.1, fence), i * 1.6, 0.6, -6.6);
  }
  for (const y of [0.45, 0.8, 1.1]) {
    put(g, box(10.6, 0.012, 0.012, dark, false), -8.1, y, -6.6);
    put(g, box(10.6, 0.012, 0.012, dark, false), 8.1, y, -6.6);
  }
  const gate = new THREE.Group();
  for (const y of [0.3, 0.6, 0.9, 1.2]) put(gate, box(3, 0.08, 0.06, fence), 1.5, y, 0);
  const diag = box(3.2, 0.08, 0.06, fence);
  diag.rotation.z = 0.32;
  put(gate, diag, 1.5, 0.75, 0);
  gate.position.set(-1.6, 0, -6.6);
  gate.rotation.y = -0.5; // la tranquera abierta
  g.add(gate);
  for (const x of [-1.7, 1.7]) put(g, box(0.18, 1.6, 0.18, fence), x, 0.8, -6.6);

  // caballos y vacas pastando
  horse(g, 4, -9, 0.4, { coat: hsl(20, 0.55, 0.28), mane: hsl(20, 0.3, 0.1) });
  horse(g, 5.8, -8.2, 2.5, { coat: hsl(30, 0.15, 0.85), mane: hsl(30, 0.1, 0.6) });
  horse(g, -4.5, -10.5, 1.2, { coat: hsl(25, 0.35, 0.15), mane: '#111' });
  horse(g, 9, -14, 0.2, { coat: '#1a1410', cow: true });
  horse(g, 11, -12.5, 2.9, { coat: hsl(20, 0.6, 0.35), cow: true });
  // el ombú grande y la hilera de eucaliptos
  const r = seeded(31);
  tree(g, 8.5, 6.5, { h: 5.4, crown: 2.6, trunk: hsl(25, 0.2, 0.25), leaves: hsl(95, 0.35, 0.3), r });
  for (let i = 0; i < 9; i++) tree(g, -14 + i * 1.6, -16 - r() * 1.5, { h: 6 + r() * 2.5, crown: 0.9 + r() * 0.3, trunk: hsl(30, 0.1, 0.72), leaves: hsl(110, 0.2, 0.36), r });
  for (let i = 0; i < 6; i++) tree(g, -12 - r() * 3, 4 + i * 1.8, { h: 4 + r() * 2, crown: 1.2, trunk: hsl(25, 0.2, 0.25), leaves: hsl(90, 0.3, 0.3), r });
  // la paja brava, dorada por el sol bajo
  grassTufts(g, { n: 900, inner: 2.6, outer: 18, color: hsl(55, 0.4, 0.33), tip: hsl(42, 0.8, 0.72), h: 0.6, seed: 8, near: 1.3, avoid: (x, z) => z > 1.5 && Math.abs(x) < 4.5 });
  // el fogón con el fuego y unos troncos para sentarse, y el sulky
  const fz = 4.2;
  const fx = -5.2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    put(g, ball(0.12, toon(hsl(30, 0.05, 0.45)), 8), fx + Math.cos(a) * 0.45, 0.08, fz + Math.sin(a) * 0.45);
  }
  fire(g, fx, 0.05, fz, { size: 0.6, light: 2.5 });
  smoke(g, fx, 0.9, fz, { n: 6, rise: 2, size: 0.6, alpha: 0.15, spread: 0.4 });
  for (const a of [0.5, 2.2, 3.9]) {
    const log = cyl(0.16, 0.16, 1.1, toon(hsl(25, 0.4, 0.25)), 10);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = a;
    put(g, log, fx + Math.cos(a) * 1.3, 0.16, fz + Math.sin(a) * 1.3);
  }
  fireflies(g, { n: 24, area: 9, color: '#ffe9a0' });
  return { background: hsl(32, 0.5, 0.78), fog: [hsl(30, 0.5, 0.74), 16, 36] };
}
