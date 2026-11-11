// Pintura con relieve (impasto, como acrílico cargado): pinceladas gruesas que siguen un campo de direcciones, cada una
// con su color, su borde iluminado y su sombra. Además del color se pinta la "altura" de la pintura (más alta en el
// lomo de cada pincelada) y de ahí sale un mapa de normales: con una luz de verdad, el relieve de cada pincelada brilla
// y hace sombra, como un cuadro al óleo mirado de costado. Lo usan la noche estrellada (fondo, paño y dorso).
// Todo se pinta en canvas: no se baja nada.
import * as THREE from 'three';
import { getAniso } from './draw3d.js';

// Azar con semilla (mulberry32): con enteros de 32 bits de verdad. El de draw3d.js multiplica números que no entran
// en un double y se repite enseguida: para decenas de miles de pinceladas las amontonaba en los mismos lugares.
export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });

/**
 * Una superficie pintada: { color, height } (dos canvas del mismo tamaño). El color arranca con `base` (un color o
 * una función que pinta el fondo) y la altura en gris medio.
 */
export function surface(w, h, base) {
  const color = canvas(w, h);
  const height = canvas(w, h);
  const c = color.getContext('2d');
  if (typeof base === 'function') base(c, w, h);
  else {
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);
  }
  const hc = height.getContext('2d');
  hc.fillStyle = 'rgb(60,60,60)';
  hc.fillRect(0, 0, w, h);
  return { color, height, w, h };
}

/**
 * Pinceladas: `n` trazos que siguen el campo `angle(x, y)` (radianes), de largo `len` y ancho `width` (en píxeles, o
 * funciones (x, y, r) para que cambien según el lugar). `paint(x, y, r)` da el color (o null para saltear ese lugar);
 * `where(r)` elige dónde arranca cada una (por defecto, en cualquier lado). `wrap`: si se repite de izquierda a derecha
 * (para el cielo, que da la vuelta). `load`: cuánta pintura (alto del lomo, 0 a 1).
 */
export function strokes(S, { n, angle, paint, len = 30, width = 6, where = null, seed = 1, wrap = false, load = 0.8, curl = 0, light = [-0.6, -0.8], alpha = 1 }) {
  const r = seeded(seed);
  const c = S.color.getContext('2d');
  const hc = S.height.getContext('2d');
  c.lineCap = hc.lineCap = 'round';
  c.lineJoin = hc.lineJoin = 'round';
  const [lx, ly] = light;
  for (let i = 0; i < n; i++) {
    let [x, y] = where ? where(r) : [r() * S.w, r() * S.h];
    const col = paint(x, y, r);
    if (!col) continue;
    const L = typeof len === 'function' ? len(x, y, r) : len * (0.6 + r() * 0.8);
    const W = typeof width === 'function' ? width(x, y, r) : width * (0.7 + r() * 0.6);
    // el camino: pasitos siguiendo el campo
    const pts = [[x, y]];
    const steps = Math.max(3, Math.round(L / 4));
    let a = angle(x, y);
    for (let k = 0; k < steps; k++) {
      a = angle(x, y) + curl * (k / steps - 0.5);
      x += Math.cos(a) * (L / steps);
      y += Math.sin(a) * (L / steps);
      pts.push([x, y]);
    }
    const draws = wrap ? [0, -S.w, S.w] : [0];
    for (const dx of draws) {
      if (wrap && dx && pts.every(([px]) => px + dx < -W || px + dx > S.w + W)) continue;
      const path = (ctx, ox = 0, oy = 0) => {
        ctx.beginPath();
        pts.forEach(([px, py], k) => (k ? ctx.lineTo(px + dx + ox, py + oy) : ctx.moveTo(px + dx + ox, py + oy)));
      };
      // la pincelada como en un óleo: apenas la sombra del lado contrario a la luz, el cuerpo, un brillo fino y
      // continuo del lado de la luz (la pintura levanta un lomo) y las marcas de los pelos del pincel a lo largo
      c.globalAlpha = alpha * 0.48;
      c.strokeStyle = shade(col, -0.42);
      c.lineWidth = W;
      path(c, -lx * W * 0.12, -ly * W * 0.12);
      c.stroke();
      c.globalAlpha = alpha;
      c.strokeStyle = col;
      c.lineWidth = W * 0.9;
      path(c);
      c.stroke();
      c.globalAlpha = alpha * 0.55;
      c.strokeStyle = shade(col, 0.36);
      c.lineWidth = W * 0.22;
      path(c, lx * W * 0.2, ly * W * 0.2);
      c.stroke();
      c.globalAlpha = alpha * 0.2;
      c.lineWidth = Math.max(0.5, W * 0.08);
      c.strokeStyle = shade(col, -0.3);
      path(c, (r() - 0.5) * W * 0.6, (r() - 0.5) * W * 0.6);
      c.stroke();
      c.globalAlpha = 1;
      // la altura: el lomo de la pincelada (ancho y bajo, angosto y alto)
      for (const [wk, v] of [[1, 95 + load * 60], [0.4, 140 + load * 100]]) {
        hc.strokeStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
        hc.lineWidth = W * wk;
        path(hc);
        hc.stroke();
      }
    }
  }
}

/** Un manchón redondo con pinceladas en círculo (estrellas, la luna, un farol): anillos de pintura alrededor. */
export function swirlDot(S, cx, cy, R, colors, { rings = 5, seed = 3, width = 5, load = 1 } = {}) {
  const r = seeded(seed);
  // el centro, macizo (si no, se ve el fondo por el agujero de los anillos)
  const c = S.color.getContext('2d');
  c.fillStyle = colors[colors.length - 1];
  c.beginPath();
  c.arc(cx, cy, Math.max(1.5, R / rings) * 1.1, 0, Math.PI * 2);
  c.fill();
  const hc = S.height.getContext('2d');
  hc.fillStyle = 'rgb(220,220,220)';
  hc.beginPath();
  hc.arc(cx, cy, Math.max(1.5, R / rings) * 0.9, 0, Math.PI * 2);
  hc.fill();
  for (let k = rings; k >= 1; k--) {
    const rr = (R * k) / rings;
    const n = Math.round(6 + rr * 0.9);
    strokes(S, {
      n,
      seed: seed + k * 31,
      where: () => {
        const a = r() * Math.PI * 2;
        return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
      },
      angle: (x, y) => Math.atan2(y - cy, x - cx) + Math.PI / 2,
      paint: () => colors[Math.min(colors.length - 1, Math.floor(((rings - k) / rings) * colors.length + r() * 1.2))],
      len: Math.max(8, rr * 0.9),
      width: width * (0.7 + k / rings),
      load,
    });
  }
}

/**
 * Halo de anillos como en el cuadro: bandas concéntricas de toques cortos tangentes al círculo. bands: [{ r0, r1,
 * colors }] (radios en px, de adentro hacia afuera); dab: el ancho de cada toque.
 */
export function halo(S, cx, cy, bands, { dab = 5, seed = 5, load = 0.9, wrap = false } = {}) {
  const r = seeded(seed);
  for (const band of bands) {
    const rings = Math.max(1, Math.round((band.r1 - band.r0) / (dab * 0.9)));
    for (let k = 0; k < rings; k++) {
      const rr = band.r0 + ((k + 0.5) / rings) * (band.r1 - band.r0);
      const n = Math.max(6, Math.round((Math.PI * 2 * rr) / (dab * 2.2)));
      const off = r() * Math.PI * 2;
      let i = 0;
      strokes(S, {
        n,
        seed: seed + k * 17 + Math.round(rr),
        where: () => {
          const ang = off + (i++ / n) * Math.PI * 2 + (r() - 0.5) * 0.12;
          return [cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr];
        },
        angle: (x, y) => Math.atan2(y - cy, x - cx) + Math.PI / 2,
        paint: (x, y, q) => band.colors[Math.floor(q() * band.colors.length)],
        len: dab * 2.4,
        width: dab,
        load,
        wrap,
      });
    }
  }
}

// (con memoria: se llama varias veces por pincelada y los colores son pocos)
const shadeMemo = new Map();
const shade = (col, k) => {
  const key = col + k;
  let out = shadeMemo.get(key);
  if (!out) shadeMemo.set(key, (out = shadeNow(col, k)));
  return out;
};
const shadeNow = (col, k) => {
  const c = new THREE.Color(col);
  const hsl = {};
  c.getHSL(hsl);
  return `#${new THREE.Color().setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + k * (k > 0 ? 1 - hsl.l : hsl.l)))).getHexString()}`;
};

/** Mapa de normales a partir de la altura (para que la luz marque el relieve). strength: cuánto se nota. */
export function normalMap(height, strength = 2.2) {
  const { width: w, height: h } = height;
  const src = height.getContext('2d').getImageData(0, 0, w, h).data;
  const out = canvas(w, h);
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  // rápido: sin llamadas por píxel (los vecinos dan la vuelta en los bordes, para las texturas que se repiten)
  const k = strength / 255;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const up = ((y + h - 1) % h) * w;
    const down = ((y + 1) % h) * w;
    for (let x = 0; x < w; x++) {
      const left = x ? x - 1 : w - 1;
      const right = x === w - 1 ? 0 : x + 1;
      const dx = (src[(row + right) << 2] - src[(row + left) << 2]) * k;
      const dy = (src[(down + x) << 2] - src[(up + x) << 2]) * k;
      const il = 127.5 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (row + x) << 2;
      d[i] = 127.5 - dx * il;
      d[i + 1] = 127.5 + dy * il;
      d[i + 2] = 127.5 + il;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

const tex = (c, { srgb = true, repeat = null } = {}) => {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = getAniso();
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
};

/**
 * Material de pintura con relieve: el color, las normales del relieve y apenas brillo (acrílico). emissive: cuánto
 * brilla sola (el cielo de noche no necesita luz para verse). basic: sin luces (para lo muy lejano).
 */
export function paintMaterial(S, { strength = 2.2, emissive = 0, roughness = 0.62, repeat = null, side = THREE.FrontSide, transparent = false, alphaTest = 0, fog = true, glow = null, glowIntensity = 1 } = {}) {
  const map = tex(S.color, { repeat });
  const normal = tex(normalMap(S.height, strength), { srgb: false, repeat });
  const m = new THREE.MeshStandardMaterial({ map, normalMap: normal, roughness, metalness: 0, side, transparent, alphaTest, fog });
  if (emissive) {
    m.emissive = new THREE.Color('#ffffff');
    m.emissiveMap = map;
    m.emissiveIntensity = emissive;
  }
  // glow: un canvas con solo lo que brilla solo (las ventanas prendidas), negro el resto
  if (glow) {
    m.emissive = new THREE.Color('#ffffff');
    m.emissiveMap = tex(glow, { repeat });
    m.emissiveIntensity = glowIntensity;
  }
  return m;
}

/** Recorta la superficie con una forma (lo de afuera queda transparente): para siluetas pintadas (casas, cerros). */
export function clipTo(S, shape) {
  for (const cv of [S.color, S.height]) {
    const ctx = cv.getContext('2d');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = '#000'; // opaco: con destination-in, lo que queda es lo de adentro de la forma
    ctx.beginPath();
    shape(ctx, S.w, S.h);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
}
