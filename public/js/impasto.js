// Pintura con relieve (impasto, como acrílico cargado): pinceladas gruesas que siguen un campo de direcciones, cada una
// con su color, su borde iluminado y su sombra. Además del color se pinta la "altura" de la pintura (más alta en el
// lomo de cada pincelada) y de ahí sale un mapa de normales: con una luz de verdad, el relieve de cada pincelada brilla
// y hace sombra, como un cuadro al óleo mirado de costado. Lo usan la noche estrellada (fondo, paño y dorso).
// Todo se pinta en canvas: no se baja nada.
import * as THREE from 'three';
import { getAniso } from './draw3d.js';

export function seeded(seed) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
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
      // la sombra de un lado, el cuerpo, y el brillo del lado de la luz (pintura en relieve)
      c.globalAlpha = alpha * 0.55;
      c.strokeStyle = shade(col, -0.32);
      c.lineWidth = W;
      path(c, -lx * W * 0.22, -ly * W * 0.22);
      c.stroke();
      c.globalAlpha = alpha;
      c.strokeStyle = col;
      c.lineWidth = W * 0.92;
      path(c);
      c.stroke();
      // el brillo, cortado como un pincel seco (no un tubo liso)
      c.globalAlpha = alpha * 0.75;
      c.strokeStyle = shade(col, 0.3);
      c.lineWidth = W * 0.2;
      c.setLineDash([L * (0.15 + r() * 0.3), L * (0.05 + r() * 0.15)]);
      path(c, lx * W * 0.22, ly * W * 0.22);
      c.stroke();
      c.setLineDash([]);
      // estrías del pincel (los pelos dejan surcos a lo largo)
      c.globalAlpha = alpha * 0.25;
      c.lineWidth = Math.max(0.6, W * 0.08);
      for (let b = 0; b < 3; b++) {
        c.strokeStyle = shade(col, b % 2 ? 0.2 : -0.24);
        c.setLineDash([L * (0.2 + r() * 0.4), L * 0.08]);
        path(c, (r() - 0.5) * W * 0.7, (r() - 0.5) * W * 0.7);
        c.stroke();
      }
      c.setLineDash([]);
      c.globalAlpha = 1;
      // la altura: el lomo de la pincelada (ancho y bajo, angosto y alto)
      for (const [wk, v] of [[1, 90 + load * 50], [0.6, 120 + load * 80], [0.25, 150 + load * 105]]) {
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

const shade = (col, k) => {
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
  const at = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      d[i] = (-dx / l) * 127.5 + 127.5;
      d[i + 1] = (dy / l) * 127.5 + 127.5;
      d[i + 2] = (1 / l) * 127.5 + 127.5;
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
export function paintMaterial(S, { strength = 2.2, emissive = 0, roughness = 0.62, repeat = null, side = THREE.FrontSide, transparent = false, alphaTest = 0, fog = true } = {}) {
  const map = tex(S.color, { repeat });
  const normal = tex(normalMap(S.height, strength), { srgb: false, repeat });
  const m = new THREE.MeshStandardMaterial({ map, normalMap: normal, roughness, metalness: 0, side, transparent, alphaTest, fog });
  if (emissive) {
    m.emissive = new THREE.Color('#ffffff');
    m.emissiveMap = map;
    m.emissiveIntensity = emissive;
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
