// Noche estrellada: jugás adentro del cuadro (La noche estrellada, Van Gogh, 1889; dominio público), pintado como él:
// pinceladas cortas y cargadas, todas del mismo tamaño, puestas una al lado de la otra siguiendo la forma de cada cosa,
// contornos oscuros, y los halos de las estrellas hechos con anillos de toques. Cada pincelada tiene relieve
// (impasto.js): la luz de la luna marca el lomo de la pintura.
// La composición es la del cuadro, alrededor de la mesa: estás en una loma de noche, mirando el valle. A la izquierda,
// un ciprés enorme y oscuro como una llama que se mece. Abajo, el pueblo con la iglesia de campanario alto y fino, las
// casitas con las ventanas prendidas y los árboles oscuros. Atrás, los cerros azules en olas. Y el cielo, que es casi
// todo: el gran remolino del medio que gira despacio, el viento que corre en bandas claras sobre los cerros, las
// estrellas con sus halos que titilan y la luna creciente arriba a la derecha, adentro de su halo naranja.
import * as THREE from 'three';
import { surface, strokes, halo, paintMaterial, clipTo, seeded } from './impasto.js';
import { tick, SKY_R } from './paisaje.js';
import { canvasTex } from './draw3d.js';
import { tableLight, box } from './amb-kit.js';

const TAU = Math.PI * 2;

// La paleta del cuadro.
const C = {
  prussian: ['#0f1e3c', '#13264a', '#0c1830'],
  ultra: ['#1d3b8a', '#22449a', '#2a4fa6', '#1a3478'],
  cobalt: ['#3a63b0', '#4472b8', '#5582c0', '#3d6cb5'],
  sky: ['#6f9ccc', '#7fabd4', '#8cb6d8', '#9cc2dc'],
  whiteblue: ['#c7dde6', '#d6e7e8', '#e6efe9', '#b9d3e0'],
  green: ['#a8c48e', '#b8cf8e', '#c6d69a', '#93b88a'], // el verde claro de los halos y del remolino
  yellow: ['#f2d23a', '#f6dd5a', '#ecc52a', '#fae77e'],
  lemon: ['#fbf0a0', '#fff6c6', '#f8ea86'],
  orange: ['#f0a82a', '#e8932a', '#f5b843'],
  cypress: ['#1e3a2a', '#26442e', '#2f4e32', '#3a5a34', '#4a5530', '#2a4a48', '#1a2c34', '#4f4a2a'],
  cypressLight: ['#6f8a48', '#839a52', '#97a460', '#6a8f74', '#a39050'],
  hill: ['#1f3270', '#2a3f82', '#33498c', '#3d5596', '#28386e'],
  hillLight: ['#6f8fc0', '#7d9ccc', '#88a8c8'],
  ground: ['#1d2a4a', '#24345a', '#2c3e5e', '#33455a', '#2a3a3e', '#3a4a42'],
  groundLight: ['#5a6a7a', '#6a7a6a', '#4a5e6e'],
  wall: ['#6a78a0', '#7a86ae', '#8a94b4', '#5a6a96', '#9aa0b0'],
  roof: ['#1c2850', '#243266', '#2c3a72'],
  window: ['#f6cf3a', '#f2b632', '#fae07a'],
  outline: '#0a1228',
};
const pick = (a, r) => a[Math.floor(r() * a.length)];

// ------------------------------------------------------------------ el cielo

// u: alrededor (0.75 = enfrente; mirando desde la mesa, más u es más a la izquierda); v: de arriba (0) al horizonte
// (0.5). Como en el cuadro: el remolino al medio, la luna arriba a la derecha y el ciprés (con Venus) a la izquierda.
const M = (u) => (1.5 - u) % 1; // de "a la derecha" a la u de la textura
const WHIRL = { u: M(0.735), v: 0.375, rx: 0.07, ry: 0.11 }; // el gran remolino del medio (lo hace girar un disco aparte)
const WHIRL2 = { u: M(0.79), v: 0.4, rx: 0.035, ry: 0.06 }; // el remolino chico enganchado al grande
const MOON = { u: M(0.885), v: 0.31, r: 0.03 };
// las estrellas (y Venus, la clara cerca del ciprés)
const STARS = [
  { u: 0.585, v: 0.4, r: 0.022, venus: true }, // (se dan vuelta abajo con M)
  { u: 0.63, v: 0.29, r: 0.026 },
  { u: 0.67, v: 0.36, r: 0.018 },
  { u: 0.7, v: 0.25, r: 0.021 },
  { u: 0.76, v: 0.27, r: 0.024 },
  { u: 0.82, v: 0.33, r: 0.02 },
  { u: 0.84, v: 0.42, r: 0.017 },
  { u: 0.93, v: 0.39, r: 0.019 },
  { u: 0.97, v: 0.28, r: 0.022 },
  { u: 0.53, v: 0.31, r: 0.02 },
  { u: 0.45, v: 0.37, r: 0.018 },
  { u: 0.06, v: 0.33, r: 0.02 },
  { u: 0.2, v: 0.3, r: 0.019 },
  { u: 0.33, v: 0.38, r: 0.018 },
].map((st) => ({ ...st, u: M(st.u) }));

function skyField(W, H) {
  // el viento: bandas que corren de izquierda a derecha con ondas, y se enroscan en los remolinos y las estrellas
  const centers = [WHIRL, WHIRL2, ...STARS.map((st) => ({ u: st.u, v: st.v, rx: st.r * 1.4, ry: st.r * 2.6 }))];
  return (x, y) => {
    const u = x / W;
    const v = y / H;
    let ax = 1;
    let ay = Math.sin(u * TAU * 4 + v * 14) * 0.35 + Math.sin(u * TAU * 9 + 1) * 0.15;
    for (const s of centers) {
      let du = u - s.u;
      if (du > 0.5) du -= 1;
      if (du < -0.5) du += 1;
      const dx = du / s.rx;
      const dy = (v - s.v) / s.ry;
      const d = Math.hypot(dx, dy);
      const wgt = Math.exp(-((d / 1.4) ** 2)) * 6;
      if (wgt < 0.02) continue;
      // tangente al círculo
      ax += (-dy / (d || 1)) * wgt * s.rx * 10;
      ay += (dx / (d || 1)) * wgt * s.ry * 10;
    }
    return Math.atan2(ay, ax);
  };
}

function skyPainting() {
  const W = 3072;
  const H = 1536;
  const S = surface(W, H, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0f2050');
    g.addColorStop(0.3, '#1d3b8a');
    g.addColorStop(0.45, '#3a63b0');
    g.addColorStop(0.5, '#7fabd4');
    g.addColorStop(0.505, '#2a3f82');
    g.addColorStop(1, '#1f3270');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  const field = skyField(W, H);
  const dist = (x, y, s) => {
    let du = x / W - s.u;
    if (du > 0.5) du -= 1;
    if (du < -0.5) du += 1;
    return Math.hypot(du / s.rx, (y / H - s.v) / s.ry);
  };
  // el color: más oscuro arriba, bandas claras de viento cerca del horizonte, el remolino en blanco y verde claro
  const color = (x, y, r) => {
    const v = y / H;
    if (v > 0.5) return null;
    const dw = Math.min(dist(x, y, WHIRL), dist(x, y, WHIRL2) * 1.3);
    if (dw < 1.15) {
      const band = Math.floor(dw * 6) % 3; // anillos alternados, como en el cuadro
      return pick(band === 0 ? C.whiteblue : band === 1 ? C.green : C.sky, r);
    }
    // las bandas de viento claras (una corriente que va de la izquierda al remolino)
    const wind = Math.sin((x / W) * TAU * 3 + v * 30) * 0.5 + 0.5;
    if (v > 0.36 && v < 0.47 && wind > 0.72 && r() < 0.7) return pick(r() < 0.5 ? C.whiteblue : C.sky, r);
    const q = r();
    if (v > 0.44) return pick(q < 0.4 ? C.sky : q < 0.72 ? C.cobalt : q < 0.9 ? C.whiteblue : C.ultra, r);
    if (v > 0.3) return pick(q < 0.36 ? C.cobalt : q < 0.6 ? C.sky : q < 0.86 ? C.ultra : C.whiteblue, r);
    return pick(q < 0.34 ? C.ultra : q < 0.64 ? C.cobalt : q < 0.82 ? C.prussian : C.sky, r);
  };
  const upper = (r) => [r() * W, r() * H * 0.505];
  // tres capas de pinceladas cortas (de las gruesas de fondo a las finas de arriba), todas del mismo tamaño en su capa
  strokes(S, { n: 18000, angle: field, paint: color, where: upper, len: 23, width: 10.5, seed: 3, wrap: true, load: 0.55 });
  strokes(S, { n: 24000, angle: field, paint: color, where: upper, len: 18, width: 7, seed: 5, wrap: true, load: 0.8 });
  strokes(S, { n: 16000, angle: field, paint: color, where: upper, len: 13, width: 4.2, seed: 9, wrap: true, load: 1 });
  // las estrellas: anillos de toques, de adentro hacia afuera blanco, amarillo, verde claro y un borde azul claro
  const sc = H; // los radios van en partes de la altura
  for (const st of STARS) {
    const R = st.r * sc;
    halo(S, st.u * W, st.v * H, [
      { r0: 0, r1: R * 0.25, colors: C.lemon },
      { r0: R * 0.25, r1: R * 0.5, colors: st.venus ? C.whiteblue : C.yellow },
      { r0: R * 0.5, r1: R * 0.8, colors: st.venus ? C.sky : C.green },
      { r0: R * 0.8, r1: R * 1.05, colors: C.whiteblue },
    ], { dab: 5.5, seed: Math.round(st.u * 997), wrap: true });
  }
  // la luna: la medialuna amarilla y naranja adentro de su halo grande
  const mx = MOON.u * W;
  const my = MOON.v * H;
  const mr = MOON.r * sc;
  halo(S, mx, my, [
    { r0: 0, r1: mr * 0.9, colors: C.yellow },
    { r0: mr * 0.9, r1: mr * 1.35, colors: C.orange },
    { r0: mr * 1.35, r1: mr * 1.8, colors: C.yellow },
    { r0: mr * 1.8, r1: mr * 2.3, colors: C.green },
    { r0: mr * 2.3, r1: mr * 2.7, colors: C.lemon },
  ], { dab: 6, seed: 71, wrap: true });
  // lo oscuro de la luna (la medialuna): un pedazo de cielo mordido adentro
  halo(S, mx + mr * 0.42, my - mr * 0.18, [{ r0: 0, r1: mr * 0.72, colors: [...C.ultra, ...C.cobalt] }], { dab: 5.5, seed: 73, wrap: true });
  return S;
}

// El gran remolino, pintado aparte en un disco: gira despacio delante del cielo (el cielo se mueve como en el cuadro).
function whirlPainting(seed = 31) {
  const N = 1024;
  const S = surface(N, N, 'rgba(0,0,0,0)');
  S.color.getContext('2d').clearRect(0, 0, N, N);
  const c = N / 2;
  const r = seeded(seed);
  // espiral: toques que se enroscan hacia el centro, alternando blanco, verde claro y azul claro
  strokes(S, {
    n: 7000,
    where: () => {
      const a = r() * TAU;
      const d = Math.sqrt(r()) * c * 0.95;
      return [c + Math.cos(a) * d, c + Math.sin(a) * d];
    },
    angle: (x, y) => {
      const d = Math.hypot(x - c, y - c);
      return Math.atan2(y - c, x - c) + Math.PI / 2 + Math.min(0.5, (d / c) * 0.35); // se abre hacia afuera
    },
    paint: (x, y, q) => {
      const d = Math.hypot(x - c, y - c) / c;
      if (d > 0.95) return null;
      const t = (d * 7 + Math.atan2(y - c, x - c) / TAU + 3) % 3; // la espiral: la banda depende del ángulo
      return pick(t < 1 ? C.whiteblue : t < 2 ? C.green : C.sky, q);
    },
    len: 22,
    width: 9,
    seed,
    load: 1,
  });
  clipTo(S, (ctx, w) => ctx.arc(w / 2, w / 2, w * 0.475, 0, TAU));
  // el borde, suavizado (se funde con el cielo)
  const ctx = S.color.getContext('2d');
  const g = ctx.createRadialGradient(c, c, c * 0.7, c, c, c * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, N, N);
  ctx.globalCompositeOperation = 'source-over';
  return S;
}

// Una dirección del cielo (u, v de la textura) → punto en la esfera (como SphereGeometry).
function dirOf(u, v) {
  const phi = u * TAU;
  const th = v * Math.PI;
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th));
}

// ------------------------------------------------------------------ cerros en olas

// Un anillo de cerros pintado (los cerros azules con las crestas claras), abierto solo enfrente (arc radianes).
function hillsRing(g, { r, h, y, seed, base, amp, waves, arc = TAU, emissive = 0.4 }) {
  const W = 3072;
  const H = 384;
  const S = surface(W, H, C.hill[0]);
  const q = seeded(seed);
  const ph = [q() * 6, q() * 6];
  const top = (x) => H * (base - (Math.sin((x / W) * TAU * waves + ph[0]) * 0.6 + Math.sin((x / W) * TAU * waves * 2.3 + ph[1]) * 0.4) * amp * 0.5);
  // pinceladas que siguen la pendiente del cerro (en olas)
  const slope = (x) => Math.atan2(top(x + 6) - top(x - 6), 12);
  strokes(S, {
    n: 9000,
    angle: (x, yy) => slope(x) * Math.max(0, 1 - (yy - top(x)) / (H * 0.6)),
    paint: (x, yy, rr) => {
      const t = top(x);
      if (yy < t - 4) return null;
      if (yy < t + 12) return pick(C.hillLight, rr); // la cresta clara
      return pick(C.hill, rr);
    },
    len: 30,
    width: 9,
    seed,
    load: 0.8,
  });
  // el contorno oscuro de la cresta
  strokes(S, { n: 1400, where: (rr) => { const x = rr() * W; return [x, top(x) + 2]; }, angle: (x) => slope(x), paint: () => C.outline, len: 26, width: 5, seed: seed + 1, load: 1 });
  clipTo(S, (ctx, w, hh) => {
    ctx.moveTo(0, hh);
    for (let x = 0; x <= w; x += 6) ctx.lineTo(x, top(x) - 3);
    ctx.lineTo(w, hh);
    ctx.closePath();
  });
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, h, 128, 1, true, Math.PI - arc / 2, arc),
    paintMaterial(S, { strength: 2.4, emissive, side: THREE.BackSide, transparent: true, alphaTest: 0.4, fog: false })
  );
  m.position.y = y;
  m.renderOrder = -6;
  g.add(m);
  return m;
}

// ------------------------------------------------------------------ la loma (el piso)

// La loma donde está la mesa, y el valle donde está el pueblo: la altura del terreno en cada lugar.
const groundY = (x, z) => {
  const d = Math.hypot(x, z);
  if (z > -4 || d < 3.5) return Math.sin(x * 0.3) * 0.15 * Math.max(0, Math.min(1, (d - 3.5) / 6)); // casi plana cerca de la mesa
  const down = Math.min(1, (-z - 4) / 14); // baja hacia el valle
  return -4.5 * (down * down * (3 - 2 * down)) + Math.sin(x * 0.25 + z * 0.1) * 0.4;
};

function groundPainting() {
  const N = 2048;
  const S = surface(N, N, C.ground[0]);
  // pinceladas que siguen las curvas de nivel (de costado, en olas)
  strokes(S, {
    n: 16000,
    angle: (x, y) => Math.sin(x / 160 + y / 90) * 0.45 + Math.sin(y / 37) * 0.15,
    paint: (x, y, r) => pick(r() < 0.18 ? C.groundLight : C.ground, r),
    len: 34,
    width: 12,
    seed: 15,
    load: 0.8,
  });
  // matas de pasto: toques verticales cortos, verde azulado y algún ocre
  strokes(S, { n: 5000, angle: () => -Math.PI / 2, paint: (x, y, r) => pick(['#3a5a4a', '#4a6a4a', '#5a6a3a', '#2c4a4a', '#6a7a4a'], r), len: 16, width: 5, seed: 16, load: 1 });
  return S;
}

// ------------------------------------------------------------------ el pueblo

function houseMaterial(seed, { tall = false } = {}) {
  const W = 256;
  const H = tall ? 512 : 256;
  const S = surface(W, H, C.wall[0]);
  const glow = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const gc = glow.getContext('2d');
  gc.fillStyle = '#000';
  gc.fillRect(0, 0, W, H);
  strokes(S, { n: tall ? 1400 : 800, angle: (x) => (Math.floor(x / 24) % 2 ? Math.PI / 2 : 0), paint: (x, y, r) => pick(C.wall, r), len: 22, width: 8, seed, load: 0.7 });
  // ventanas prendidas: toques amarillos, con su brillo en el mapa de lo que brilla solo
  const r = seeded(seed + 9);
  for (let y = 40; y < H - 30; y += 70) {
    for (let x = 30; x < W - 30; x += 70) {
      if (r() < 0.3) continue;
      strokes(S, { n: 6, where: () => [x + r() * 18, y + r() * 6], angle: () => Math.PI / 2, paint: (a, b, q) => pick(C.window, q), len: 22, width: 9, seed: seed + x * y, load: 1 });
      gc.fillStyle = '#f6c33a';
      gc.fillRect(x - 4, y - 4, 30, 34);
    }
  }
  // contorno oscuro
  const c = S.color.getContext('2d');
  c.strokeStyle = C.outline;
  c.lineWidth = 10;
  c.strokeRect(5, 5, W - 10, H - 10);
  return paintMaterial(S, { strength: 2.4, roughness: 0.75, glow, glowIntensity: 1.1 });
}

function roofMaterial(seed) {
  const S = surface(256, 128, C.roof[0]);
  strokes(S, { n: 500, angle: () => 0.1, paint: (x, y, r) => pick(C.roof, r), len: 26, width: 9, seed, load: 0.8 });
  return paintMaterial(S, { strength: 2.4, roughness: 0.8 });
}

function house(g, x, z, { w, h, d, wall, roof, ry }) {
  const y = groundY(x, z);
  const grp = new THREE.Group();
  const body = box(w, h, d, wall);
  body.position.y = h / 2;
  grp.add(body);
  const shape = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.15, 0), new THREE.Vector2(w / 2 + 0.15, 0), new THREE.Vector2(0, h * 0.45)]);
  const r = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: d + 0.3, bevelEnabled: false }), roof);
  r.position.set(0, h, -d / 2 - 0.15);
  grp.add(r);
  grp.position.set(x, y - 0.3, z);
  grp.rotation.y = ry;
  g.add(grp);
}

// Un árbol del pueblo: una bocha oscura de pinceladas (como las manchas redondeadas del cuadro).
function treeMat(seed) {
  const N = 256;
  const S = surface(N, N, 'rgba(0,0,0,0)');
  S.color.getContext('2d').clearRect(0, 0, N, N);
  const r = seeded(seed);
  strokes(S, {
    n: 700,
    where: () => {
      const a = r() * TAU;
      const d = Math.sqrt(r()) * N * 0.42;
      return [N / 2 + Math.cos(a) * d, N * 0.55 + Math.sin(a) * d * 0.8];
    },
    angle: (x, y) => Math.atan2(y - N * 0.55, x - N / 2) + Math.PI / 2,
    paint: (x, y, q) => pick(['#13222a', '#1a2c32', '#22383a', '#2c4440', '#1c2e48', '#33504a'], q),
    len: 18,
    width: 8,
    seed,
    load: 0.9,
  });
  clipTo(S, (ctx, w, h) => ctx.ellipse(w / 2, h * 0.55, w * 0.44, h * 0.38, 0, 0, TAU));
  return paintMaterial(S, { strength: 2.4, side: THREE.DoubleSide, transparent: true, alphaTest: 0.4, roughness: 0.85 });
}

// ------------------------------------------------------------------ el ciprés

// Una lengua del ciprés: pinceladas largas que suben ondulando, oscuras, con toques claros.
function flameTex(seed, light) {
  const W = 192;
  const H = 768;
  const S = surface(W, H, 'rgba(0,0,0,0)');
  S.color.getContext('2d').clearRect(0, 0, W, H);
  const r = seeded(seed);
  const cxAt = (y) => W / 2 + Math.sin((y / H) * Math.PI * 3 + seed) * 18;
  const wAt = (y) => W * 0.42 * Math.sin((y / H) * Math.PI) ** 0.6;
  strokes(S, {
    n: 1800,
    where: () => {
      const y = r() * H;
      return [cxAt(y) + (r() - 0.5) * wAt(y) * 1.9, y];
    },
    angle: (x, y) => -Math.PI / 2 + Math.sin(y / 70 + seed + x / 40) * 0.5,
    paint: (x, y, q) => pick(q() < light ? C.cypressLight : C.cypress, q),
    len: 34,
    width: 9,
    seed,
    load: 1,
  });
  clipTo(S, (ctx) => {
    ctx.moveTo(cxAt(0), 0);
    for (let y = 0; y <= H; y += 8) ctx.lineTo(cxAt(y) + wAt(y), y);
    for (let y = H; y >= 0; y -= 8) ctx.lineTo(cxAt(y) - wAt(y), y);
    ctx.closePath();
  });
  return S;
}

let cypressMats = null; // las lenguas pintadas: las comparten los dos cipreses
function cypress(g, x, z, { h = 12, seed = 5 } = {}) {
  const grp = new THREE.Group();
  const mats = (cypressMats ||= [0, 1, 2, 3].map((k) => paintMaterial(flameTex(seed + k * 13, k % 2 ? 0.3 : 0.18), { strength: 3, side: THREE.DoubleSide, transparent: true, alphaTest: 0.45, roughness: 0.8, emissive: 0.28 })));
  const r = seeded(seed);
  const flames = [];
  // lenguas que suben desde el tronco, cada vez más angostas: la silueta de una llama
  for (let i = 0; i < 34; i++) {
    const k = r();
    const a = r() * TAU;
    const ring = (1 - k) * 0.9;
    const fh = h * (0.4 + k * 0.6);
    const fw = fh * 0.24;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), mats[i % 4]);
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(a) * ring, 0, Math.sin(a) * ring);
    pivot.rotation.y = r() * Math.PI;
    m.position.y = fh / 2;
    m.castShadow = true;
    pivot.add(m);
    grp.add(pivot);
    flames.push([pivot, r() * TAU, 0.5 + r() * 0.5]);
  }
  grp.position.set(x, groundY(x, z) - 0.2, z);
  g.add(grp);
  // la brisa: cada lengua se mece a su ritmo y el árbol entero se inclina apenas, como una llama
  tick(g, (now) => {
    const t = now / 1000;
    const gust = Math.sin(t * 0.45) * 0.6 + Math.sin(t * 1.2) * 0.3;
    grp.rotation.z = gust * 0.02;
    for (const [p, ph, sp] of flames) {
      p.rotation.z = Math.sin(t * sp + ph) * 0.045 + gust * 0.02;
      p.rotation.x = Math.cos(t * sp * 0.8 + ph) * 0.025;
    }
  });
}

// ------------------------------------------------------------------ el lugar

export function noche(g) {
  cypressMats = null; // materiales propios de este armado (la escena libera los lugares de a uno)
  // ---- el cielo pintado con relieve (cúpula) y el gran remolino que gira encima
  const sky = skyPainting();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 96, 48), paintMaterial(sky, { strength: 2.4, emissive: 0.92, side: THREE.BackSide, fog: false, roughness: 0.85 }));
  dome.renderOrder = -10;
  g.add(dome);
  const whirlS = whirlPainting();
  const whirlMat = paintMaterial(whirlS, { strength: 2.6, emissive: 0.95, transparent: true, fog: false, roughness: 0.85 });
  whirlMat.depthWrite = false;
  const dist = SKY_R - 1.2;
  const size = WHIRL.ry * Math.PI * dist * 1.9;
  const whirl = new THREE.Mesh(new THREE.CircleGeometry(size / 2, 64), whirlMat);
  whirl.position.copy(dirOf(WHIRL.u, WHIRL.v).multiplyScalar(dist));
  whirl.lookAt(0, 0, 0);
  whirl.renderOrder = -9;
  g.add(whirl);
  tick(g, (now, dt) => whirl.rotateZ(-dt * 0.035));
  // las estrellas y la luna brillan: un resplandor suave que late encima de cada una
  const glowTex = canvasTex(128, 128, (ctx, w) => {
    const gr = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,248,200,0.9)');
    gr.addColorStop(0.3, 'rgba(250,230,140,0.35)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, w);
  });
  const glows = [];
  for (const st of [...STARS, { ...MOON, r: MOON.r * 2.2 }]) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.5 }));
    s.position.copy(dirOf(st.u, st.v).multiplyScalar(SKY_R - 2));
    const k = st.r * Math.PI * SKY_R * 1.6;
    s.scale.set(k, k, 1);
    g.add(s);
    glows.push([s, k, st.u * 50]);
  }
  tick(g, (now) => {
    const t = now / 1000;
    for (const [s, k, ph] of glows) {
      const p = 1 + Math.sin(t * 1.1 + ph) * 0.08 + Math.sin(t * 2.9 + ph * 2) * 0.04;
      s.scale.set(k * p, k * p, 1);
      s.material.opacity = 0.4 + Math.sin(t * 1.7 + ph) * 0.12;
    }
  });

  // ---- los cerros azules en olas, detrás del pueblo
  hillsRing(g, { r: 35, h: 14, y: 0.5, seed: 3, base: 0.5, amp: 0.5, waves: 3, emissive: 0.55 });
  hillsRing(g, { r: 31, h: 10, y: -1.8, seed: 7, base: 0.55, amp: 0.45, waves: 5, arc: 3.6, emissive: 0.45 });

  // ---- luz: la noche azul, la luna (marca el relieve de las pinceladas) y una luz tibia sobre la mesa (sin lámpara a
  // la vista: en el cuadro no hay)
  g.add(new THREE.HemisphereLight('#5a7ac8', '#141c30', 0.95));
  const moon = new THREE.DirectionalLight('#dce6ff', 1.35);
  moon.position.copy(dirOf(MOON.u, MOON.v).multiplyScalar(20));
  g.add(moon);
  tableLight(g, { color: '#ffe2a8', intensity: 7.5, y: 3.2 });

  // ---- la loma y el valle (una malla con la forma del terreno, pintada siguiendo las curvas de nivel)
  const geo = new THREE.PlaneGeometry(80, 80, 120, 120);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, groundY(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, paintMaterial(groundPainting(), { strength: 2.6, repeat: [6, 6], roughness: 0.85, emissive: 0.12 }));
  ground.receiveShadow = true;
  g.add(ground);

  // ---- el pueblo en el valle: casitas con ventanas prendidas y la iglesia de campanario alto
  const walls = [0, 1, 2].map((k) => houseMaterial(100 + k));
  const roofs = [0, 1].map((k) => roofMaterial(200 + k));
  const r = seeded(41);
  for (let i = 0; i < 46; i++) {
    const x = -20 + r() * 40;
    const z = -17 - r() * 12;
    if (Math.abs(x - 2.5) < 2.5 && z > -24 && z < -19) continue; // el lugar de la iglesia
    const w = 2.2 + r() * 2;
    house(g, x, z, { w, h: 2 + r() * 1.8, d: 2 + r() * 1.4, wall: walls[i % 3], roof: roofs[i % 2], ry: (r() - 0.5) * 0.6 });
  }
  // la iglesia: la nave, la torre y el campanario fino que sube hasta los cerros
  const church = new THREE.Group();
  const darkWall = houseMaterial(300, { tall: true });
  const nave = box(3, 2.6, 5, darkWall);
  nave.position.y = 1.3;
  church.add(nave);
  const shape = new THREE.Shape([new THREE.Vector2(-1.7, 0), new THREE.Vector2(1.7, 0), new THREE.Vector2(0, 1.4)]);
  const nroof = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 5.2, bevelEnabled: false }), roofs[0]);
  nroof.position.set(0, 2.6, -2.6);
  church.add(nroof);
  const tower = box(1.2, 3.6, 1.2, darkWall);
  tower.position.set(0, 4.2, 2.4);
  church.add(tower);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.7, 6.5, 4), roofs[1]);
  spire.position.set(0, 9.25, 2.4);
  spire.rotation.y = Math.PI / 4;
  church.add(spire);
  church.position.set(2.5, groundY(2.5, -21.5) - 0.3, -21.5);
  church.rotation.y = 0.15;
  g.add(church);
  // árboles oscuros entre las casas (las manchas redondeadas del cuadro)
  const treeMats = [0, 1, 2].map((k) => treeMat(400 + k));
  for (let i = 0; i < 40; i++) {
    const x = -22 + r() * 44;
    const z = -14 - r() * 16;
    const s = 2 + r() * 2.2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s * 1.2, s), treeMats[i % 3]);
    m.position.set(x, groundY(x, z) + s * 0.42, z);
    m.lookAt(0, m.position.y, 0);
    g.add(m);
  }

  // ---- el ciprés enorme a la izquierda, delante de todo (y otro lejos, más chico)
  cypress(g, -5.2, -4.6, { h: 13, seed: 5 });
  cypress(g, 9, -9, { h: 6, seed: 11 });

  // ---- las ventanas del pueblo titilan apenas (las velas)
  const wallMats = [...walls, darkWall];
  tick(g, (now) => {
    const t = now / 1000;
    wallMats.forEach((m, i) => (m.emissiveIntensity = 1.05 + Math.sin(t * 2.3 + i * 1.7) * 0.08 + Math.sin(t * 7.1 + i) * 0.04));
  });
  return { background: '#0f2050', fog: ['#1a2c5e', 22, 42] };
}
