// Texturas y muebles de los ambientes (los usan los amb-*.js): baldosas, ladrillos, estantes con botellas,
// láminas enmarcadas, árboles de hojas pintadas, sillas, mesitas, tazas, copas y plantas.
import * as THREE from 'three';
import { canvasTex, noise, seeded, toon } from './draw3d.js';
import { hsl, basic, box, cyl } from './amb-kit.js';

/** Baldosas en damero (o en rombos con `diag`), con brillo de piso encerado. */
export function checkerTex(a, b, { n = 8, repeat = 5, diag = false, grout = null } = {}) {
  return canvasTex(512, 512, (ctx, w, h) => {
    const s = w / n;
    if (diag) {
      ctx.fillStyle = a;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = b;
      for (let y = -1; y <= n; y++) for (let x = -1; x <= n; x++) {
        if ((x + y) % 2) continue;
        ctx.beginPath();
        ctx.moveTo(x * s + s / 2, y * s);
        ctx.lineTo(x * s + s, y * s + s / 2);
        ctx.lineTo(x * s + s / 2, y * s + s);
        ctx.lineTo(x * s, y * s + s / 2);
        ctx.fill();
      }
    } else {
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        ctx.fillStyle = (x + y) % 2 ? a : b;
        ctx.fillRect(x * s, y * s, s, s);
      }
    }
    if (grout) {
      ctx.strokeStyle = grout;
      ctx.lineWidth = 2;
      for (let i = 0; i <= n; i++) {
        ctx.beginPath();
        ctx.moveTo(i * s, 0);
        ctx.lineTo(i * s, h);
        ctx.moveTo(0, i * s);
        ctx.lineTo(w, i * s);
        ctx.stroke();
      }
    }
    const gr = ctx.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0.3, 'rgba(255,255,255,0)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.06)');
    gr.addColorStop(0.7, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 6);
  }, [repeat, repeat]);
}

/** Ladrillos a la vista (soot: hollín arriba, para la parrilla). */
export function brickTex({ base = '#3a1d14', tones = ['#8a3e26', '#9b4a2c', '#7a3420', '#a35634'], repeat = [2, 2], seed = 5, soot = 0 } = {}) {
  return canvasTex(512, 512, (ctx, w, h) => {
    const r = seeded(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let y = 0, row = 0; y < h; y += 32, row++) {
      for (let x = row % 2 ? -32 : 0; x < w; x += 64) {
        ctx.fillStyle = tones[Math.floor(r() * tones.length)];
        ctx.fillRect(x + 3, y + 3, 58, 26);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(x + 3, y + 3, 58, 4);
      }
    }
    if (soot) {
      const gr = ctx.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, `rgba(0,0,0,${soot})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, w, h);
    }
    noise(ctx, w, h, 12);
  }, repeat);
}

/** Una botella plana: cuerpo, hombros, cuello, sombra dura de un lado y, a veces, etiqueta. */
export function drawBottle(ctx, x, base, w, h, color, label, labelColor) {
  const neck = w * 0.3;
  const shoulder = base - h * 0.62;
  const top = base - h;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, shoulder);
    ctx.quadraticCurveTo(x, shoulder - h * 0.12, x + w / 2 - neck / 2, shoulder - h * 0.16);
    ctx.lineTo(x + w / 2 - neck / 2, top);
    ctx.lineTo(x + w / 2 + neck / 2, top);
    ctx.lineTo(x + w / 2 + neck / 2, shoulder - h * 0.16);
    ctx.quadraticCurveTo(x + w, shoulder - h * 0.12, x + w, shoulder);
    ctx.lineTo(x + w, base);
    ctx.closePath();
  };
  path();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.fillRect(x + w * 0.62, top, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(x + w * 0.14, shoulder - h * 0.04, w * 0.1, h * 0.46);
  ctx.restore();
  if (label) {
    ctx.fillStyle = labelColor;
    ctx.fillRect(x + 2, base - h * 0.42, w - 4, h * 0.22);
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.fillRect(x + w * 0.62, base - h * 0.42, w * 0.38 - 2, h * 0.22);
  }
}

/** Estantes con botellas (la estantería del bar), con espejo atrás si se pide. */
export function bottleShelfTex({ w = 1536, h = 600, seed = 37, back = '#120c08', wood = '#3a2416', mirror = false } = {}) {
  return canvasTex(w, h, (ctx) => {
    const r = seeded(seed);
    ctx.fillStyle = back;
    ctx.fillRect(0, 0, w, h);
    if (mirror) {
      const gr = ctx.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, 'rgba(255,220,170,0.10)');
      gr.addColorStop(0.5, 'rgba(255,240,210,0.24)');
      gr.addColorStop(1, 'rgba(255,220,170,0.08)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 12; i++) {
        const gx = r() * w;
        const g2 = ctx.createRadialGradient(gx, h * 0.3, 2, gx, h * 0.3, 40);
        g2.addColorStop(0, 'rgba(255,230,180,0.5)');
        g2.addColorStop(1, 'rgba(255,230,180,0)');
        ctx.fillStyle = g2;
        ctx.fillRect(gx - 40, h * 0.3 - 40, 80, 80);
      }
    }
    for (const base of [190, 390, 584]) {
      let x = 24 + r() * 30;
      while (x < w - 60) {
        const bw = 30 + r() * 18;
        const bh = 118 + r() * 46;
        drawBottle(ctx, x, base, bw, bh, hsl([140, 35, 0, 50, 200, 25, 90][Math.floor(r() * 7)], 0.55 + r() * 0.3, 0.16 + r() * 0.24), r() < 0.7, hsl(45, 0.45, 0.78));
        x += bw + 10 + r() * (r() < 0.2 ? 90 : 22);
      }
      ctx.fillStyle = wood;
      ctx.fillRect(0, base, w, 16);
      ctx.fillStyle = 'rgba(255,220,160,0.35)';
      ctx.fillRect(0, base, w, 2.5);
    }
    ctx.lineWidth = 18;
    ctx.strokeStyle = wood;
    ctx.strokeRect(9, 9, w - 18, h - 18);
    noise(ctx, w, h, 6);
  });
}

/** Láminas de dos tintas con marco y vidrio (sol, guarda, espada, bandoneón, tango, pampa). */
export function pictureTex(kind, bg, fg, frame) {
  return canvasTex(384, 512, (ctx, w, h) => {
    ctx.fillStyle = frame;
    ctx.fillRect(0, 0, w, h);
    const m = 22;
    ctx.fillStyle = bg;
    ctx.fillRect(m, m, w - m * 2, h - m * 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(m, m, w - m * 2, h - m * 2);
    ctx.clip();
    ctx.fillStyle = fg;
    ctx.strokeStyle = fg;
    const cx = w / 2;
    const cy = h / 2;
    if (kind === 'sol') {
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        const long = i % 2 ? 150 : 112;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a - 0.07) * 58, cy + Math.sin(a - 0.07) * 58);
        ctx.lineTo(cx + Math.cos(a) * long, cy + Math.sin(a) * long);
        ctx.lineTo(cx + Math.cos(a + 0.07) * 58, cy + Math.sin(a + 0.07) * 58);
        ctx.closePath();
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, 50, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'guarda') {
      const period = [0, 1, 2, 3, 4, 3, 2, 1];
      for (const lx of [m + 26, w - m - 86]) for (let i = 0; i < 30; i++) ctx.fillRect(lx + period[i % 8] * 12, m + i * 16, 22, 16.5);
      ctx.fillRect(cx - 3, m, 6, h - m * 2);
    } else if (kind === 'espada') {
      ctx.beginPath();
      ctx.moveTo(cx, m + 34);
      ctx.lineTo(cx + 19, cy + 70);
      ctx.lineTo(cx - 19, cy + 70);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(cx - 62, cy + 70, 124, 12);
      ctx.fillRect(cx - 7, cy + 82, 14, 58);
      ctx.beginPath();
      ctx.arc(cx, cy + 152, 14, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'bandoneon') {
      ctx.fillRect(cx - 120, cy - 60, 60, 120);
      ctx.fillRect(cx + 60, cy - 60, 60, 120);
      ctx.lineWidth = 6;
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - 60 + i * 20, cy - 54);
        ctx.lineTo(cx - 50 + i * 20, cy);
        ctx.lineTo(cx - 60 + i * 20, cy + 54);
        ctx.stroke();
      }
    } else if (kind === 'tango') {
      ctx.beginPath();
      ctx.arc(cx - 26, cy - 120, 20, 0, Math.PI * 2);
      ctx.arc(cx + 26, cy - 112, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 50, cy - 96);
      ctx.lineTo(cx - 6, cy - 96);
      ctx.lineTo(cx - 10, cy + 10);
      ctx.lineTo(cx - 40, cy + 150);
      ctx.lineTo(cx - 60, cy + 150);
      ctx.lineTo(cx - 44, cy + 10);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + 8, cy - 92);
      ctx.lineTo(cx + 44, cy - 92);
      ctx.lineTo(cx + 40, cy);
      ctx.quadraticCurveTo(cx + 80, cy + 80, cx + 110, cy + 150);
      ctx.lineTo(cx + 10, cy + 150);
      ctx.quadraticCurveTo(cx + 20, cy + 60, cx + 12, cy);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(w * 0.68, h * 0.3, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillRect(0, h * 0.68, w, h);
      ctx.fillRect(w * 0.31, h * 0.48, 22, h * 0.22);
      for (const [dx, dy, rr] of [[0, -56, 60], [-56, -24, 46], [62, -22, 48], [-8, -14, 52]]) {
        ctx.beginPath();
        ctx.arc(w * 0.335 + dx, h * 0.48 + dy, rr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    const gr = ctx.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0.3, 'rgba(255,255,255,0)');
    gr.addColorStop(0.42, 'rgba(255,255,255,0.12)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(m, m, w - m * 2, h - m * 2);
  });
}

// Follaje pintado: racimos de hojas con luz arriba y sombra abajo, en sprites que siempre miran a la cámara.
let leafCache = new Map();
/** Lo llama cada ambiente al empezar: materiales propios (la escena libera los ambientes de a uno). */
export const resetLeaves = () => (leafCache = new Map());
export function leafMats(color, { flowers = null } = {}) {
  const key = color + (flowers || '');
  if (leafCache.has(key)) return leafCache.get(key);
  const base = new THREE.Color(color);
  const tone = (dl, dh = 0) => {
    const c = {};
    base.getHSL(c);
    return `#${new THREE.Color().setHSL(c.h + dh, Math.min(1, c.s * 1.1), Math.max(0, Math.min(1, c.l + dl))).getHexString()}`;
  };
  const mats = [0, 1].map((k) => {
    const tex = canvasTex(256, 256, (ctx, w) => {
      const r = seeded(70 + k);
      for (let i = 0; i < 260; i++) {
        const a = r() * Math.PI * 2;
        const d = Math.sqrt(r()) * w * 0.42;
        const x = w / 2 + Math.cos(a) * d;
        const y = w / 2 + Math.sin(a) * d * 0.9;
        const up = 1 - y / w;
        ctx.fillStyle = r() < 0.12 ? tone(0.18, 0.02) : tone(-0.12 + up * 0.22 + (r() - 0.5) * 0.06);
        if (flowers && r() < 0.4) ctx.fillStyle = flowers[Math.floor(r() * flowers.length)];
        ctx.beginPath();
        ctx.ellipse(x, y, 6 + r() * 6, 3 + r() * 3, r() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    return new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.3 });
  });
  leafCache.set(key, mats);
  return mats;
}

/** Árbol de copa redonda: tronco y bochas de hojas pintadas. flowers: colores de flores (jacarandá, ceibo). */
export function tree(g, x, z, { h = 3.2, crown = 1.2, trunk, leaves, r, flowers = null, lean = 0 }) {
  const k = h / 3.2;
  const t = cyl(0.09 * k, 0.15 * k, h * 0.6, toon(trunk), 8);
  t.position.set(x, h * 0.3, z);
  t.rotation.z = lean;
  g.add(t);
  const n = 3 + Math.floor(r() * 3);
  const mats = leafMats(leaves, { flowers });
  const core = toon(flowers ? flowers[0] : leaves, { flatShading: true });
  for (let i = 0; i < n; i++) {
    const rad = crown * (0.6 + r() * 0.35);
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(rad * 0.82, 1), core);
    s.position.set(x + (r() - 0.5) * crown - lean * h * 0.5, h * 0.62 + r() * crown * 0.7, z + (r() - 0.5) * crown);
    s.castShadow = true;
    g.add(s);
    for (let j = 0; j < 4; j++) {
      const sp = new THREE.Sprite(mats[j % 2]);
      const sz = rad * (1.1 + r() * 0.5);
      sp.scale.set(sz, sz, 1);
      sp.position.set(s.position.x + (r() - 0.5) * rad, s.position.y + (r() - 0.4) * rad * 0.8, s.position.z + (r() - 0.5) * rad);
      g.add(sp);
    }
  }
}

/** Silla de fondo (las de los jugadores las pone la escena). kind: 'viena' (curvada) o 'bar'. */
export function chair(g, x, z, rot, mat, { kind = 'bar' } = {}) {
  const c = new THREE.Group();
  const seat = kind === 'viena' ? cyl(0.21, 0.21, 0.035, mat, 20) : box(0.42, 0.04, 0.4, mat);
  seat.position.y = 0.46;
  c.add(seat);
  if (kind === 'viena') {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.016, 6, 20, Math.PI), mat);
    loop.position.set(0, 0.72, 0.2);
    c.add(loop);
    for (const sx of [-1, 1]) {
      const post = cyl(0.016, 0.016, 0.3, mat, 6);
      post.position.set(sx * 0.17, 0.6, 0.2);
      c.add(post);
    }
  } else {
    const back = box(0.42, 0.5, 0.04, mat);
    back.position.set(0, 0.74, 0.18);
    c.add(back);
  }
  for (const [lx, lz] of [[-0.16, -0.15], [0.16, -0.15], [-0.16, 0.15], [0.16, 0.15]]) {
    const l = cyl(0.016, 0.02, 0.46, mat, 6);
    l.position.set(lx, 0.23, lz);
    c.add(l);
  }
  c.position.set(x, 0, z);
  c.rotation.y = rot;
  g.add(c);
  return c;
}

/** Mesita redonda de fondo; items(x, y, z) pone lo de arriba (tazas, copas). */
export function sideTable(g, x, z, top, base, { r = 0.36, items = null } = {}) {
  const t = cyl(r, r, 0.035, top, 24);
  t.position.set(x, 0.74, z);
  const p = cyl(0.03, 0.03, 0.72, base, 8);
  p.position.set(x, 0.37, z);
  const f = cyl(0.2, 0.22, 0.03, base, 16);
  f.position.set(x, 0.015, z);
  g.add(t, p, f);
  if (items) items(x, 0.76, z);
}

/** Una taza de café con plato. */
export function cup(g, x, y, z, { color = '#f6f3ec' } = {}) {
  const m = toon(color);
  const plato = cyl(0.06, 0.05, 0.01, m, 16, false);
  plato.position.set(x, y + 0.005, z);
  const taza = cyl(0.035, 0.028, 0.05, m, 16, false);
  taza.position.set(x, y + 0.035, z);
  const cafe = cyl(0.031, 0.031, 0.002, basic('#3a2010'), 16, false);
  cafe.position.set(x, y + 0.06, z);
  g.add(plato, taza, cafe);
}

/** Una copa (de vino) o un vaso. */
export function glassware(g, x, y, z, { wine = '#6a0f1a', kind = 'copa' } = {}) {
  const gl = new THREE.MeshBasicMaterial({ color: '#e8f0f4', transparent: true, opacity: 0.35, depthWrite: false });
  if (kind === 'copa') {
    const foot = cyl(0.03, 0.03, 0.005, gl, 12, false);
    foot.position.set(x, y, z);
    const stem = cyl(0.005, 0.005, 0.07, gl, 6, false);
    stem.position.set(x, y + 0.035, z);
    const bowl = cyl(0.035, 0.02, 0.07, gl, 12, false);
    bowl.position.set(x, y + 0.1, z);
    const v = cyl(0.03, 0.02, 0.035, basic(wine), 12, false);
    v.position.set(x, y + 0.085, z);
    g.add(foot, stem, bowl, v);
  } else {
    const v = cyl(0.035, 0.03, 0.1, gl, 12, false);
    v.position.set(x, y + 0.05, z);
    const d = cyl(0.03, 0.027, 0.06, basic(wine), 12, false);
    d.position.set(x, y + 0.03, z);
    g.add(v, d);
  }
}

/** Planta en maceta (bocha o palmerita). */
export function pottedPlant(g, x, z, { pot = '#8a4a2a', leaves = hsl(120, 0.4, 0.3), h = 1, kind = 'bush', r = Math.random } = {}) {
  const p = cyl(0.22, 0.16, 0.42, toon(pot), 16);
  p.position.set(x, 0.21, z);
  g.add(p);
  const lm = toon(leaves, { flatShading: true, side: THREE.DoubleSide });
  if (kind === 'palm') {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.9 * h, 4), lm);
      f.position.set(x + Math.cos(a) * 0.25 * h, 0.42 + 0.45 * h, z + Math.sin(a) * 0.25 * h);
      f.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
      f.castShadow = true;
      g.add(f);
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22 * h + r() * 0.08, 1), lm);
      b.position.set(x + (r() - 0.5) * 0.3, 0.5 + 0.25 * h + r() * 0.35 * h, z + (r() - 0.5) * 0.3);
      b.castShadow = true;
      g.add(b);
    }
  }
}
