// Noche estrellada: jugás adentro de un cuadro pintado en acrílico cargado, con relieve (impasto.js). Estás en un muelle
// de madera a la orilla del mar, de noche. Arriba, el cielo en remolinos de azul cobalto y ultramar, con estrellas que
// son soles de pinceladas en anillos (titilan y giran) y una luna creciente naranja con su halo. Enfrente, el mar: olas
// que se mueven, pinceladas horizontales y los reflejos dorados de los faroles y las ventanas, largos y temblorosos. Del
// otro lado del agua, el pueblo con sus ventanas prendidas, el campanario y los cerros en capas. A la derecha, un ciprés
// enorme como una llama que se mece con la brisa; a la izquierda, botes amarrados que se balancean y la costanera con
// faroles de gas. Atrás, la terraza de un café con su toldo amarillo. Todo pintado a pinceladas que siguen la forma de
// las cosas, como en el cuadro, y todo con relieve: la luz de la luna y de los faroles marca el lomo de cada pincelada.
// La brisa: el ciprés, el pasto y las flores se mecen, pasan pinceladas de viento por el aire y las olas no paran.
import * as THREE from 'three';
import { surface, strokes, swirlDot, paintMaterial, clipTo, seeded } from './impasto.js';
import { tick, glowSprite, SKY_R } from './paisaje.js';
import { canvasTex, toon } from './draw3d.js';
import { tableLight, box, cyl, put, basic } from './amb-kit.js';

const TAU = Math.PI * 2;
const hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`;

// Paleta del cuadro: ultramar, cobalto, turquesa, amarillo cromo, naranja, blanco cremoso.
const P = {
  deep: ['#0b1a4a', '#10245e', '#132c6e', '#0e1f55'],
  cobalt: ['#1d3f8f', '#244c9c', '#2b5aa8', '#1f4a95', '#3463b0'],
  turq: ['#3f7fb0', '#4f93b8', '#5aa3bf', '#6fb3c4', '#3b74a8'],
  pale: ['#8fc0cf', '#a9d1d6', '#c6e0d8', '#7fb0c8'],
  gold: ['#f6d54a', '#f9e27a', '#f2c230', '#fff1a8', '#e8b42a'],
  orange: ['#f3a43a', '#f7b84f', '#e88a2a', '#ffd27a'],
  cream: ['#fdf6d8', '#fff9e6', '#f6ecc0'],
  green: ['#1f3a2a', '#2a4a30', '#1a2f28', '#33553a', '#24403a'],
  black: ['#0d1420', '#141c2a', '#1b2433'],
  wood: ['#5a3a22', '#6b4528', '#7a5230', '#4a2e1a', '#86603a'],
};
const pick = (arr, r) => arr[Math.floor(r() * arr.length)];

// ------------------------------------------------------------------ el cielo

// Los remolinos (u, v en la textura del cielo: u da la vuelta, v de arriba a abajo; 0.5 = horizonte) y las estrellas.
const SWIRLS = [
  { u: 0.69, v: 0.27, r: 0.09, k: 1 },
  { u: 0.8, v: 0.22, r: 0.07, k: -1 },
  { u: 0.55, v: 0.3, r: 0.06, k: 1 },
  { u: 0.9, v: 0.33, r: 0.05, k: 1 },
  { u: 0.2, v: 0.25, r: 0.08, k: -1 },
  { u: 0.35, v: 0.3, r: 0.06, k: 1 },
  { u: 0.05, v: 0.2, r: 0.05, k: 1 },
];
const MOON = { u: 0.62, v: 0.16, r: 0.05 };
const STARS = (() => {
  const r = seeded(77);
  const out = [];
  for (let i = 0; i < 34; i++) out.push({ u: r(), v: 0.05 + r() * 0.36, r: 0.006 + r() * 0.012 });
  // algunas grandes, cerca de lo que se ve de frente
  out.push({ u: 0.74, v: 0.12, r: 0.02 }, { u: 0.86, v: 0.15, r: 0.017 }, { u: 0.5, v: 0.11, r: 0.018 }, { u: 0.95, v: 0.08, r: 0.016 }, { u: 0.66, v: 0.36, r: 0.012 });
  return out;
})();

function skyPainting() {
  const W = 3072;
  const H = 1536;
  const S = surface(W, H, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#081640');
    g.addColorStop(0.3, '#123072');
    g.addColorStop(0.47, '#2a5aa6');
    g.addColorStop(0.5, '#4d86b8');
    g.addColorStop(0.53, '#0a1636');
    g.addColorStop(1, '#050b1c');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  // el campo de direcciones: viento horizontal que ondula, y los remolinos que lo tuercen
  const field = (x, y) => {
    const u = x / W;
    const v = y / H;
    let a = Math.sin(u * TAU * 3 + v * 9) * 0.35 + Math.sin(u * TAU * 7) * 0.12;
    let wsum = 1;
    let ax = Math.cos(a);
    let ay = Math.sin(a);
    for (const s of SWIRLS) {
      let du = u - s.u;
      if (du > 0.5) du -= 1;
      if (du < -0.5) du += 1;
      const dx = du * 2; // la textura es el doble de ancha que alta
      const dy = v - s.v;
      const d = Math.hypot(dx, dy);
      const wgt = Math.exp(-((d / (s.r * 1.6)) ** 2)) * 4;
      if (wgt < 0.01) continue;
      const t = Math.atan2(dy, dx) + (s.k * Math.PI) / 2 + s.k * 0.25;
      ax += Math.cos(t) * wgt;
      ay += Math.sin(t) * wgt;
      wsum += wgt;
    }
    return Math.atan2(ay / wsum, ax / wsum);
  };
  // el color según la altura y cerca de los remolinos (más claro, turquesa y blanco en el ojo)
  const near = (x, y, list, f = 1) => {
    let best = 9;
    for (const s of list) {
      let du = x / W - s.u;
      if (du > 0.5) du -= 1;
      if (du < -0.5) du += 1;
      best = Math.min(best, Math.hypot(du * 2, y / H - s.v) / (s.r * f));
    }
    return best;
  };
  const skyColor = (x, y, r) => {
    const v = y / H;
    if (v > 0.5) return null; // abajo del horizonte no (ahí va el mar y el pueblo)
    const sw = near(x, y, SWIRLS, 1.4);
    if (sw < 0.35 && r() < 0.6) return pick(P.cream, r);
    if (sw < 0.8) return pick(r() < 0.5 ? P.pale : P.turq, r);
    if (sw < 1.4 && r() < 0.6) return pick(P.turq, r);
    if (v > 0.4) return pick(r() < 0.5 ? P.turq : P.cobalt, r);
    return pick(r() < 0.65 ? P.cobalt : P.deep, r);
  };
  // tres pasadas: fondo grueso, medio y detalles finos encima
  // solo en el cielo (la mitad de arriba de la textura)
  const upper = (r) => [r() * W, r() * H * 0.51];
  strokes(S, { n: 9000, angle: field, paint: skyColor, where: upper, len: 70, width: 24, seed: 3, wrap: true, load: 0.5 });
  strokes(S, { n: 14000, angle: field, paint: skyColor, where: upper, len: 48, width: 11, seed: 5, wrap: true, load: 0.75 });
  strokes(S, { n: 16000, angle: field, paint: skyColor, where: upper, len: 30, width: 5, seed: 9, wrap: true, load: 1 });
  // los remolinos marcados: espirales de pinceladas claras
  for (const s of SWIRLS) {
    const cx = s.u * W;
    const cy = s.v * H;
    const R = s.r * H;
    const r = seeded(Math.round(cx));
    strokes(S, {
      n: 420,
      seed: Math.round(cx + cy),
      where: () => {
        const t = r() * TAU * 2.2;
        const rr = R * (0.15 + (t / (TAU * 2.2)) * 0.95);
        return [cx + Math.cos(t) * rr * 2, cy + Math.sin(t) * rr];
      },
      angle: (x, y) => Math.atan2((y - cy) * 2, x - cx) + (s.k * Math.PI) / 2,
      paint: (x, y, rr) => pick(Math.hypot((x - cx) / 2, y - cy) < R * 0.5 ? P.cream : rr() < 0.5 ? P.pale : P.turq, rr),
      len: 34,
      width: 6,
      wrap: true,
      load: 1,
    });
  }
  // las estrellas: soles de anillos (blanco al centro, amarillo, después un halo turquesa)
  for (const st of STARS) {
    swirlDot(S, st.u * W, st.v * H, st.r * H * 1.25, [...P.pale, ...P.turq, ...P.pale, ...P.gold, ...P.gold, ...P.cream, ...P.cream], { rings: 6, seed: Math.round(st.u * 999), width: 5 });
  }
  // la luna creciente: naranja y amarillo en anillos, con la parte oscura mordida
  swirlDot(S, MOON.u * W, MOON.v * H, MOON.r * H * 1.9, [...P.turq, ...P.pale, ...P.gold, ...P.orange, ...P.gold, ...P.cream], { rings: 8, seed: 41, width: 6 });
  swirlDot(S, MOON.u * W, MOON.v * H, MOON.r * H, [...P.orange, ...P.gold, ...P.orange, ...P.cream], { rings: 5, seed: 43, width: 7 });
  swirlDot(S, MOON.u * W + MOON.r * H * 0.45, MOON.v * H - MOON.r * H * 0.2, MOON.r * H * 0.72, [...P.cobalt, ...P.turq], { rings: 3, seed: 45, width: 8 });
  return S;
}

// ------------------------------------------------------------------ capas de distancia (cerros, pueblo)

// Un anillo pintado alrededor (como layer de paisaje.js pero con relieve): solo entre los ángulos `from`..`to`
// (u de la textura), el resto transparente.
function ring(g, S, { r, h, y, strength = 2, emissive = 0.35, arc = TAU }) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 96, 1, true, Math.PI - arc / 2, arc), paintMaterial(S, { strength, emissive, side: THREE.BackSide, transparent: true, alphaTest: 0.35, fog: false }));
  m.position.y = y;
  m.renderOrder = -6 + Math.round(10 / r);
  g.add(m);
  return m;
}

function hillsPainting(seed, colors, { base = 0.55, amp = 0.3, waves = 5 } = {}) {
  const W = 2048;
  const H = 256;
  const S = surface(W, H, colors[0]);
  const r = seeded(seed);
  const ph = [r() * 6, r() * 6];
  const top = (x) => H * (base - (Math.sin((x / W) * TAU * waves + ph[0]) * 0.6 + Math.sin((x / W) * TAU * waves * 2.7 + ph[1]) * 0.4) * amp * 0.5);
  strokes(S, { n: 2600, angle: (x, y) => Math.sin(x / 90 + y / 40) * 0.5, paint: (x, y, rr) => (y > top(x) - 4 ? pick(colors, rr) : null), len: 30, width: 8, seed, wrap: true, load: 0.7 });
  clipTo(S, (ctx, w, h) => {
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, top(x));
    ctx.lineTo(w, h);
    ctx.closePath();
  });
  return S;
}

// El pueblo del otro lado del agua: casas y un campanario, con las ventanas prendidas en amarillo.
function villagePainting() {
  const W = 2048;
  const H = 512;
  const S = surface(W, H, '#1b2440');
  const r = seeded(19);
  const houses = [];
  let x = 0;
  while (x < W) {
    const bw = 40 + r() * 70;
    const bh = H * (0.25 + r() * 0.35);
    houses.push({ x, w: bw, h: bh, roof: r() < 0.7 });
    x += bw + r() * 6;
  }
  // el campanario, enfrente
  const spireX = W * 0.74;
  const inShape = (px, py) => {
    if (Math.abs(px - spireX) < 18 && py > H * 0.08) return true;
    for (const b of houses) if (px >= b.x && px <= b.x + b.w && py >= H - b.h - (b.roof ? b.w * 0.35 * (1 - Math.abs((px - b.x) / b.w - 0.5) * 2) : 0)) return true;
    return false;
  };
  strokes(S, {
    n: 9000,
    angle: (px) => (Math.floor(px / 6) % 2 ? Math.PI / 2 : 0.1),
    paint: (px, py, rr) => (inShape(px, py) ? pick(rr() < 0.35 ? ['#2a3550', '#33405c', '#1f2a48'] : ['#6a6a8a', '#7a6a5a', '#8a7a5a', '#5a6a8a', '#9a8460', '#4a5a7a'], rr) : null),
    len: 12,
    width: 4.5,
    seed: 21,
    wrap: true,
  });
  // ventanas prendidas: puntos gruesos de amarillo
  for (const b of houses) {
    for (let wy = H - b.h + 14; wy < H - 10; wy += 16) for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 14) {
      if (r() < 0.4) swirlDot(S, wx, wy, 2.2, [...P.orange, ...P.gold], { rings: 1, seed: Math.round(wx * wy), width: 3.2 });
    }
  }
  swirlDot(S, spireX, H * 0.3, 6, P.gold, { rings: 2, seed: 7, width: 5 }); // la ventanita del campanario
  clipTo(S, (ctx, w, h) => {
    ctx.moveTo(0, h);
    for (const b of houses) {
      ctx.lineTo(b.x, h);
      ctx.lineTo(b.x, h - b.h);
      if (b.roof) ctx.lineTo(b.x + b.w / 2, h - b.h - b.w * 0.35);
      ctx.lineTo(b.x + b.w, h - b.h);
      ctx.lineTo(b.x + b.w, h);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    // el campanario
    ctx.moveTo(spireX - 18, h);
    ctx.lineTo(spireX - 18, h * 0.35);
    ctx.lineTo(spireX, h * 0.02);
    ctx.lineTo(spireX + 18, h * 0.35);
    ctx.lineTo(spireX + 18, h);
    ctx.closePath();
  });
  return { S, houses };
}

// ------------------------------------------------------------------ el mar

function seaPainting() {
  const W = 1024;
  const H = 1024;
  const S = surface(W, H, '#0b1a40');
  // pinceladas horizontales de olas, más claras arriba (lejos, donde refleja el cielo)
  strokes(S, {
    n: 7000,
    angle: (x, y) => Math.sin(x / 70 + y / 23) * 0.18,
    paint: (x, y, r) => {
      const far = 1 - y / H;
      if (r() < 0.08) return pick(P.pale, r);
      return pick(far > 0.6 ? (r() < 0.5 ? P.cobalt : P.turq) : r() < 0.6 ? P.deep : P.cobalt, r);
    },
    len: 34,
    width: 7,
    seed: 4,
    load: 0.7,
  });
  // crestas de espuma
  strokes(S, { n: 700, angle: () => 0, paint: (x, y, r) => pick(P.pale, r), len: 18, width: 3, seed: 8, load: 1 });
  return S;
}

// Un reflejo: una columna de pinceladas doradas cortas, una debajo de la otra, que se abre hacia abajo.
function reflectionTex(seed, colors = P.gold) {
  return canvasTex(64, 512, (ctx, w, h) => {
    const r = seeded(seed);
    ctx.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const y = (i / 70) * h;
      const spread = 6 + (y / h) * 18;
      const x = w / 2 + (r() - 0.5) * spread * 2;
      const len = 8 + r() * 16 * (1 - y / h * 0.4);
      ctx.strokeStyle = pick(colors, r);
      ctx.globalAlpha = 0.95 * (1 - (y / h) * 0.7);
      ctx.lineWidth = 5 + r() * 4;
      ctx.beginPath();
      ctx.moveTo(x - len / 2, y);
      ctx.lineTo(x + len / 2, y + (r() - 0.5) * 2);
      ctx.stroke();
    }
  });
}

// ------------------------------------------------------------------ el ciprés, el pasto y la brisa

// Una lengua de pinceladas (para el ciprés): una forma de llama larga y curvada.
function flameTex(seed, colors) {
  const S = surface(128, 512, 'rgba(0,0,0,0)');
  S.color.getContext('2d').clearRect(0, 0, 128, 512);
  const r = seeded(seed);
  const cxAt = (y) => 64 + Math.sin((y / 512) * Math.PI * 2 + seed) * 14;
  const wAt = (y) => 46 * Math.sin((y / 512) * Math.PI) ** 0.7;
  strokes(S, {
    n: 340,
    where: () => {
      const y = r() * 512;
      return [cxAt(y) + (r() - 0.5) * wAt(y) * 1.6, y];
    },
    angle: (x, y) => -Math.PI / 2 + Math.sin(y / 60 + seed) * 0.35 + (x - cxAt(y)) * 0.01,
    paint: (x, y, rr) => pick(colors, rr),
    len: 40,
    width: 9,
    seed,
    load: 1,
  });
  clipTo(S, (ctx) => {
    ctx.moveTo(cxAt(0), 0);
    for (let y = 0; y <= 512; y += 8) ctx.lineTo(cxAt(y) + wAt(y), y);
    for (let y = 512; y >= 0; y -= 8) ctx.lineTo(cxAt(y) - wAt(y), y);
    ctx.closePath();
  });
  return S;
}

function cypress(g, x, z, { h = 7.5, seed = 5 } = {}) {
  const grp = new THREE.Group();
  const mats = [0, 1, 2].map((k) => paintMaterial(flameTex(seed + k * 13, k === 1 ? [...P.green, '#2a5a6a', '#3d6a48', '#1d2c3a'] : [...P.green, '#3d6a48', '#4f7a4a', '#5e8a5a', '#2a5a6a', '#6a9a6a', '#7aa070']), { strength: 3, side: THREE.DoubleSide, transparent: true, alphaTest: 0.4, roughness: 0.7 }));
  const r = seeded(seed);
  const flames = [];
  for (let i = 0; i < 26; i++) {
    const a = r() * TAU;
    const ring = r() * 0.5;
    const fh = h * (0.55 + r() * 0.45);
    const fw = fh * 0.22;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), mats[i % 3]);
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(a) * ring, 0, Math.sin(a) * ring);
    pivot.rotation.y = r() * Math.PI;
    m.position.y = fh / 2;
    m.castShadow = true;
    pivot.add(m);
    grp.add(pivot);
    flames.push([pivot, r() * TAU, 0.6 + r() * 0.6]);
  }
  grp.position.set(x, 0, z);
  g.add(grp);
  // la brisa: cada lengua se mece a su ritmo y todo el árbol se inclina un poco
  tick(g, (now) => {
    const t = now / 1000;
    const gust = Math.sin(t * 0.5) * 0.5 + Math.sin(t * 1.3) * 0.25;
    grp.rotation.z = gust * 0.025;
    for (const [p, ph, sp] of flames) {
      p.rotation.z = Math.sin(t * sp + ph) * 0.05 + gust * 0.03;
      p.rotation.x = Math.cos(t * sp * 0.8 + ph) * 0.03;
    }
  });
}

// Matas de pasto y flores pintadas a pinceladas, que se mecen con la brisa.
function meadow(g, spots, seed) {
  const r = seeded(seed);
  const tuft = (k) => {
    const S = surface(128, 128, 'rgba(0,0,0,0)');
    S.color.getContext('2d').clearRect(0, 0, 128, 128);
    const rr = seeded(seed + k);
    strokes(S, {
      n: 46,
      where: () => [64 + (rr() - 0.5) * 70, 120 - rr() * 8],
      angle: (x) => -Math.PI / 2 + (x - 64) * 0.012,
      paint: (x, y, q) => pick(k % 2 ? [...P.green, '#5a7a3a', '#7a8a3a', '#c9b24a'] : [...P.green, '#3a6a4a', '#4f7a3a'], q),
      len: 70,
      width: 5,
      seed: seed + k,
      load: 0.9,
    });
    // florcitas amarillas y blancas en las puntas
    for (let i = 0; i < 6; i++) swirlDot(S, 30 + rr() * 68, 20 + rr() * 40, 4, k % 2 ? P.gold : P.cream, { rings: 1, seed: seed + i, width: 4 });
    return paintMaterial(S, { strength: 2, side: THREE.DoubleSide, transparent: true, alphaTest: 0.4 });
  };
  const mats = [0, 1, 2].map(tuft);
  const all = [];
  for (const [x, z, n, rad] of spots) {
    for (let i = 0; i < n; i++) {
      const s = 0.5 + r() * 0.5;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7 * s, 0.7 * s), mats[i % 3]);
      const p = new THREE.Group();
      const a = r() * TAU;
      const d = Math.sqrt(r()) * rad;
      p.position.set(x + Math.cos(a) * d, 0, z + Math.sin(a) * d);
      p.rotation.y = r() * Math.PI;
      m.position.y = 0.33 * s;
      p.add(m);
      g.add(p);
      all.push([p, r() * TAU]);
    }
  }
  tick(g, (now) => {
    const t = now / 1000;
    for (const [p, ph] of all) p.rotation.z = Math.sin(t * 1.6 + ph + p.position.x * 0.4) * 0.12;
  });
}

// Pinceladas de viento que pasan por el aire (la brisa que se ve, como en el cuadro).
function windStrokes(g, n = 14) {
  const r = seeded(31);
  const tex = canvasTex(256, 32, (ctx, w, h) => {
    const gr = ctx.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, 'rgba(200,225,235,0)');
    gr.addColorStop(0.5, 'rgba(220,235,240,0.85)');
    gr.addColorStop(1, 'rgba(200,225,235,0)');
    ctx.strokeStyle = gr;
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      ctx.lineWidth = 5 - k;
      ctx.beginPath();
      ctx.moveTo(8, h / 2 + k * 4);
      ctx.bezierCurveTo(w * 0.3, h * 0.1 + k * 3, w * 0.6, h * 0.9, w - 8, h / 2 + k * 3);
      ctx.stroke();
    }
  });
  const items = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.28), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    g.add(m);
    items.push([m, r() * 20, 2.2 + r() * 5, -14 + r() * 26, 0.5 + r() * 0.6]);
  }
  tick(g, (now) => {
    const t = now / 1000;
    for (const [m, ph, y, z, sp] of items) {
      const k = ((t * sp * 0.08 + ph) % 1 + 1) % 1; // de un lado al otro
      m.position.set(-16 + k * 32, y + Math.sin(t * 0.7 + ph) * 0.3, z + Math.sin(t * 0.3 + ph) * 1.5);
      m.rotation.set(0, Math.sin(ph) * 0.4, Math.sin(t * 0.9 + ph) * 0.15);
      m.material.opacity = Math.sin(k * Math.PI) * 0.45;
    }
  });
}

// ------------------------------------------------------------------ el lugar

export function noche(g) {
  // ---- el cielo pintado (cúpula con relieve) que gira despacito
  const sky = skyPainting();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 64, 32), paintMaterial(sky, { strength: 2.6, emissive: 0.95, side: THREE.BackSide, fog: false, roughness: 0.8 }));
  dome.renderOrder = -10;
  g.add(dome);
  tick(g, (now, dt) => (dome.rotation.y += dt * 0.004));
  // las estrellas y la luna brillan de verdad: halos que titilan y giran encima de las pintadas
  const dirOf = (u, v) => {
    const phi = u * TAU;
    const th = v * Math.PI;
    return new THREE.Vector3(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th));
  };
  const halos = [];
  const haloTex = canvasTex(128, 128, (ctx, w) => {
    const gr = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,250,210,1)');
    gr.addColorStop(0.25, 'rgba(255,230,140,0.7)');
    gr.addColorStop(0.6, 'rgba(160,210,230,0.18)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, w);
    // rayitos de pinceladas en anillo
    ctx.strokeStyle = 'rgba(255,240,180,0.5)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      ctx.beginPath();
      ctx.arc(w / 2, w / 2, w * 0.32, a, a + 0.22);
      ctx.stroke();
    }
  });
  for (const st of [...STARS, { ...MOON, r: MOON.r * 2.4 }]) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    s.position.copy(dirOf(st.u, st.v).multiplyScalar(SKY_R - 2.5));
    const size = st.r * 30;
    s.scale.set(size, size, 1);
    dome.add(s);
    halos.push([s, size, Math.random() * TAU]);
  }
  tick(g, (now) => {
    const t = now / 1000;
    for (const [s, size, ph] of halos) {
      const k = 1 + Math.sin(t * 1.3 + ph) * 0.12 + Math.sin(t * 3.1 + ph * 2) * 0.05;
      s.scale.set(size * k, size * k, 1);
      s.material.rotation = t * 0.15 + ph;
      s.material.opacity = 0.75 + Math.sin(t * 2 + ph) * 0.2;
    }
  });

  // ---- los cerros y el pueblo del otro lado del agua (anillos pintados con relieve)
  ring(g, hillsPainting(3, ['#1d2c55', '#22346a', '#2b3f78', '#1a2a50'], { base: 0.6, amp: 0.5, waves: 3 }), { r: 30, h: 6, y: 2.4, emissive: 0.55 });
  ring(g, hillsPainting(7, ['#14223a', '#1c2e48', '#22385a', '#2a3f56'], { base: 0.7, amp: 0.4, waves: 6 }), { r: 26, h: 4.2, y: 1.6, emissive: 0.45 });
  const village = villagePainting();
  // el pueblo: un arco de 110° enfrente, del otro lado del agua (el campanario a la derecha del centro)
  ring(g, village.S, { r: 22, h: 4.6, y: 1.9, emissive: 0.6, arc: 1.9 });

  // ---- luces: la noche azul, la luna que entra de costado (marca el relieve), los faroles cálidos
  g.add(new THREE.HemisphereLight('#4a6ab0', '#1a1408', 0.85));
  const moon = new THREE.DirectionalLight('#c9dcff', 1.25);
  moon.position.copy(dirOf(MOON.u, MOON.v).multiplyScalar(20));
  g.add(moon);
  tableLight(g, { color: '#ffd89a', intensity: 8.5 });
  put(g, cyl(0.005, 0.005, 1.6, basic('#0a0a0a'), 4, false), 0, 3.4, 0);
  put(g, new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.26, 32, 1, true), toon('#2a3a2a', { side: THREE.DoubleSide })), 0, 2.64, 0);
  put(g, glowSprite('rgba(255,220,140,1)', 0.8, 0.6), 0, 2.56, 0);

  // ---- el mar: un plano con olas que se mueven, pintado a pinceladas, con el relieve que agarra la luz de la luna
  const seaS = seaPainting();
  const seaMat = paintMaterial(seaS, { strength: 2.4, emissive: 0.35, roughness: 0.35, repeat: [3, 3] });
  const seaGeo = new THREE.PlaneGeometry(70, 40, 90, 50);
  seaGeo.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.position.set(0, -0.25, -22.5);
  sea.receiveShadow = true;
  g.add(sea);
  const base = seaGeo.attributes.position.array.slice();
  tick(g, (now) => {
    const t = now / 1000;
    const p = seaGeo.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      const x = base[i];
      const z = base[i + 2];
      p[i + 1] = Math.sin(x * 0.45 + t * 1.1) * 0.06 + Math.sin(z * 0.7 - t * 1.6) * 0.08 + Math.sin((x + z) * 1.3 + t * 2.3) * 0.025;
    }
    seaGeo.attributes.position.needsUpdate = true;
    seaGeo.computeVertexNormals();
    seaMat.map.offset.set((t * 0.004) % 1, (t * 0.006) % 1);
    seaMat.normalMap.offset.copy(seaMat.map.offset);
  });
  // los reflejos dorados: de cada farol de la costanera y de las luces del pueblo (columnas que tiemblan)
  const refl = [];
  // Un reflejo es una columna que baja desde la línea del agua hacia uno: se ve de frente (parado, mirando a la mesa)
  // y se dibuja encima del agua (sin profundidad), así no lo tapan las olas. Arriba, pegado a la luz que refleja.
  const addReflection = (x, z, w, h, colors, seed) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: reflectionTex(seed, colors), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false }));
    m.position.set(x, -0.1 - h / 2, z);
    m.lookAt(0, m.position.y, 0);
    m.renderOrder = 2;
    g.add(m);
    refl.push([m, seed, w]);
  };
  // las luces del pueblo (sobre el arco de enfrente) y la luna
  for (let i = 0; i < 13; i++) {
    const a = Math.PI + (i / 12 - 0.5) * 1.7;
    addReflection(Math.sin(a) * 20.5, Math.cos(a) * 20.5, 0.9, 1.5 + (i % 3) * 0.35, P.gold, 100 + i);
  }
  // la luna: su reflejo va debajo de ella (el cielo gira despacito: el reflejo la acompaña)
  addReflection(0, -20, 2, 2.6, [...P.orange, ...P.gold, ...P.cream], 300);
  const moonRefl = refl.at(-1)[0];
  tick(g, () => {
    const d = dirOf(MOON.u, MOON.v).applyAxisAngle(new THREE.Vector3(0, 1, 0), dome.rotation.y);
    const k = 19 / Math.hypot(d.x, d.z);
    moonRefl.position.set(d.x * k, moonRefl.position.y, Math.min(-4, d.z * k));
    moonRefl.lookAt(0, moonRefl.position.y, 0);
  });
  tick(g, (now) => {
    const t = now / 1000;
    for (const [m, s, w] of refl) {
      m.material.opacity = 0.65 + Math.sin(t * 2.4 + s) * 0.2 + Math.sin(t * 6.1 + s * 3) * 0.08;
      m.scale.x = 1 + Math.sin(t * 1.7 + s) * 0.18;
    }
  });

  // ---- el muelle de madera donde está la mesa (tablones pintados con relieve) y la orilla
  const deckS = surface(1024, 1024, '#4a2e1a');
  strokes(deckS, { n: 5200, angle: (x) => Math.PI / 2 + Math.sin(x / 50) * 0.04, paint: (x, y, r) => (x % 128 < 4 ? '#1d1209' : pick(P.wood, r)), len: 60, width: 9, seed: 12, load: 0.8 });
  strokes(deckS, { n: 900, angle: () => Math.PI / 2, paint: (x, y, r) => pick(['#c99050', '#e0aa60', '#a87038'], r), len: 30, width: 3, seed: 13, load: 1 }); // la luz del farol en la madera
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), paintMaterial(deckS, { strength: 2.8, repeat: [2, 2] }));
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, 0, 0.5);
  deck.receiveShadow = true;
  g.add(deck);
  // pilotes y baranda del muelle (hacia el mar)
  const wood = paintMaterial(deckS, { strength: 2.4 });
  for (let i = -4; i <= 4; i++) {
    put(g, box(0.16, 1.4, 0.16, wood), i * 1.1, -0.2, -4.05);
    put(g, cyl(0.07, 0.08, 0.42, wood, 10), i * 1.1, 0.21, -3.95); // bolardos bajos: el mar se ve entero
  }
  put(g, box(9, 0.06, 0.08, wood), 0, 0.36, -3.95);
  // la orilla a los costados: pasto y tierra pintados
  const shoreS = surface(1024, 1024, '#1d2a22');
  strokes(shoreS, { n: 6000, angle: (x, y) => Math.sin(x / 60) * 0.8 + Math.cos(y / 70), paint: (x, y, r) => pick(r() < 0.1 ? P.gold : r() < 0.5 ? P.green : ['#2a3a5a', '#33405a', '#3a4a3a'], r), len: 28, width: 8, seed: 15, load: 0.8 });
  const shore = new THREE.Mesh(new THREE.PlaneGeometry(60, 26), paintMaterial(shoreS, { strength: 2.4, repeat: [6, 3] }));
  shore.rotation.x = -Math.PI / 2;
  shore.position.set(0, -0.02, 9.5);
  shore.receiveShadow = true;
  g.add(shore);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), shore.material);
    side.rotation.x = -Math.PI / 2;
    side.position.set(sx * 11.5, -0.02, -1.5);
    g.add(side);
  }

  // ---- el ciprés enorme a la derecha (y uno chico lejos a la izquierda)
  cypress(g, 5.4, -2.2, { h: 8.5, seed: 5 });
  cypress(g, -9, -1, { h: 5, seed: 11 });
  // pasto y flores que se mecen alrededor
  meadow(g, [[5.2, -1.4, 18, 1.6], [-5.8, 1.5, 22, 2.2], [6, 3, 16, 2], [-4.5, -2.8, 10, 1.2], [9, 0, 12, 2]], 51);

  // ---- la costanera: faroles de gas con su luz (y su reflejo en el agua, arriba)
  const iron = new THREE.MeshStandardMaterial({ color: '#141820', roughness: 0.5 });
  const lampHalos = [];
  for (const [x, z] of [[-4.6, -3.6], [4.2, -3.8], [-8, -3.2]]) {
    put(g, cyl(0.05, 0.08, 3, iron, 8), x, 1.5, z);
    put(g, box(0.3, 0.38, 0.3, new THREE.MeshBasicMaterial({ color: '#ffd77a' })), x, 3.15, z);
    put(g, cyl(0.22, 0.05, 0.12, iron, 8), x, 3.38, z);
    const h = glowSprite('rgba(255,215,120,1)', 2.4, 0.7);
    put(g, h, x, 3.15, z);
    lampHalos.push(h);
    const l = new THREE.PointLight('#ffcf80', 2.2, 7, 1.6);
    put(g, l, x, 3.0, z);
  }
  tick(g, (now) => {
    const t = now / 1000;
    lampHalos.forEach((h, i) => (h.material.opacity = 0.62 + Math.sin(t * 7 + i * 2) * 0.05 + Math.sin(t * 2.3 + i) * 0.06));
  });

  // ---- botes amarrados que se balancean (a la izquierda, en el agua)
  const boats = [];
  for (const [x, z, hue, ry] of [[-6.5, -7, 8, 0.4], [-9.5, -9.5, 200, -0.3], [-4, -11, 45, 0.9]]) {
    const b = new THREE.Group();
    const S = surface(256, 128, hsl(hue, 70, 45));
    strokes(S, { n: 260, angle: () => 0.05, paint: (x2, y2, r) => (y2 < 30 ? pick(P.cream, r) : pick([hsl(hue, 75, 40), hsl(hue, 70, 50), hsl(hue, 60, 35)], r)), len: 30, width: 8, seed: hue, load: 0.9 });
    const mat = paintMaterial(S, { strength: 2.4 });
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.3, 2.6, 12, 1, false, 0, Math.PI), mat);
    hull.rotation.set(0, 0, Math.PI / 2);
    hull.rotation.x = Math.PI;
    hull.position.y = 0.2;
    b.add(hull);
    put(b, cyl(0.025, 0.03, 2.2, iron, 6), 0, 1.25, 0);
    b.position.set(x, -0.15, z);
    b.rotation.y = ry;
    g.add(b);
    boats.push([b, x * 0.7]);
  }
  tick(g, (now) => {
    const t = now / 1000;
    for (const [b, ph] of boats) {
      b.rotation.z = Math.sin(t * 0.9 + ph) * 0.07;
      b.rotation.x = Math.sin(t * 0.7 + ph * 2) * 0.04;
      b.position.y = -0.15 + Math.sin(t * 1.1 + ph) * 0.05;
    }
  });

  // ---- atrás: la terraza del café con el toldo amarillo y la luz cálida (no tapa la vista de la sala de espera)
  const cafe = new THREE.Group();
  const wallS = surface(512, 512, '#3a3048');
  strokes(wallS, { n: 1600, angle: () => Math.PI / 2, paint: (x, y, r) => pick(['#3a3048', '#2f2a44', '#4a3a50', '#5a4a40'], r), len: 30, width: 9, seed: 61 });
  for (let i = 0; i < 6; i++) swirlDot(wallS, 60 + (i % 3) * 190, 120 + Math.floor(i / 3) * 200, 34, [...P.gold, ...P.orange, ...P.gold], { rings: 3, seed: 70 + i, width: 9 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), paintMaterial(wallS, { strength: 2.6, emissive: 0.25 }));
  wall.position.set(0, 3, 0);
  cafe.add(wall);
  const awnS = surface(512, 128, '#f2c230');
  strokes(awnS, { n: 900, angle: () => Math.PI / 2, paint: (x, y, r) => pick(Math.floor(x / 64) % 2 ? P.gold : P.orange, r), len: 26, width: 9, seed: 66 });
  const awn = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.6), paintMaterial(awnS, { strength: 2.6, emissive: 0.45, side: THREE.DoubleSide }));
  awn.position.set(0, 3.2, 0.7);
  awn.rotation.x = -0.6;
  cafe.add(awn);
  cafe.position.set(0, 0, 13);
  cafe.rotation.y = Math.PI;
  g.add(cafe);
  const cafeLight = new THREE.PointLight('#ffc860', 3, 12, 1.4);
  cafeLight.position.set(0, 3, 11.5);
  g.add(cafeLight);

  // ---- la brisa que se ve, y luciérnagas de pintura
  windStrokes(g, 16);
  const ff = [];
  const r = seeded(91);
  for (let i = 0; i < 40; i++) {
    const s = glowSprite('rgba(255,230,120,1)', 0.14, 0.9);
    s.position.set((r() - 0.5) * 18, 0.4 + r() * 2.2, -6 + r() * 14);
    g.add(s);
    ff.push([s, s.position.clone(), r() * TAU]);
  }
  tick(g, (now) => {
    const t = now / 1000;
    for (const [s, p0, ph] of ff) {
      s.position.set(p0.x + Math.sin(t * 0.4 + ph) * 0.5, p0.y + Math.sin(t * 0.7 + ph) * 0.3, p0.z + Math.cos(t * 0.5 + ph) * 0.5);
      s.material.opacity = 0.5 + Math.sin(t * 2.5 + ph * 3) * 0.45;
    }
  });
  return { background: '#081640', fog: ['#0d1c48', 16, 40] };
}
