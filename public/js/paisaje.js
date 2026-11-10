// Piezas de paisaje para los ambientes (ambientes.js): cielo pintado con resplandor del sol o la luna, nubes que se
// mueven, capas de distancia con bruma (cerros, arboledas, ciudad) para que haya profundidad, y cosas vivas (estrellas
// que titilan, pétalos que caen, luciérnagas, faroles que se mecen). Todo se pinta en canvas: no se baja nada.
// Lo que se anima se registra con tick(g, fn): la escena llama a update(now, dt) del ambiente en cada cuadro.
// Nada de lo que se mueve tira sombra (la sombra se recalcula solo cuando cambia la mesa: ver shadowDirty en scene.js).
import * as THREE from 'three';
import { canvasTex, seeded } from './draw3d.js';

/** Registra una animación del ambiente (now en ms, dt en s). g: el grupo raíz del ambiente. */
export function tick(g, fn) {
  (g.userData.ticks ||= []).push(fn);
}

/** El update de un ambiente: corre todas sus animaciones (si una falla, las demás siguen). */
export function updater(g) {
  const ticks = g.userData.ticks || [];
  if (!ticks.length) return null;
  return (now, dt) => {
    for (const f of ticks) {
      try {
        f(now, dt);
      } catch (err) {
        console.error('ambiente', err);
        ticks.splice(ticks.indexOf(f), 1);
      }
    }
  };
}

// La cámara de la mesa dibuja hasta 40 m (scene.js): el cielo y lo que va pegado a él tienen que entrar.
export const SKY_R = 37;
const mix = (a, b, t) => `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;

// ------------------------------------------------------------------ cielo

/**
 * Cielo pintado: degradé de arriba (0) al horizonte (0.5) y abajo (1), con un resplandor (sol o luna) en `glow`:
 * { u: 0..1 alrededor, v: 0..0.5 altura (0.5 = horizonte), color, size }. stars: cuántas (titilan). moon: dibuja la luna.
 */
export function sky(g, stops, { glow = null, stars = 0, moon = null, seed = 3, haze = null } = {}) {
  const tex = canvasTex(1024, 512, (ctx, w, h) => {
    const gr = ctx.createLinearGradient(0, 0, 0, h);
    stops.forEach(([at, c]) => gr.addColorStop(at, c));
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
    // bruma fina sobre el horizonte
    if (haze) {
      const hz = ctx.createLinearGradient(0, h * 0.36, 0, h * 0.52);
      hz.addColorStop(0, 'rgba(0,0,0,0)');
      hz.addColorStop(1, haze);
      ctx.fillStyle = hz;
      ctx.fillRect(0, h * 0.36, w, h * 0.16);
    }
    if (glow) {
      // el resplandor se repite a los dos lados del borde para que no se corte donde se cierra la esfera
      for (const dx of [0, -w, w]) {
        const x = glow.u * w + dx;
        const y = glow.v * h;
        const r = (glow.size ?? 0.25) * w;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, glow.color);
        rg.addColorStop(0.18, glow.color);
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = glow.alpha ?? 0.55;
        ctx.fillStyle = rg;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 48, 24), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.renderOrder = -10;
  g.add(dome);
  if (stars) starField(g, stars, seed);
  if (moon) moonDisc(g, moon);
  return dome;
}

// Estrellas en dos capas que titilan a destiempo.
function starField(g, n, seed) {
  const r = seeded(seed);
  const layers = [0, 1].map((k) => {
    const pts = [];
    const cols = [];
    for (let i = 0; i < n / 2; i++) {
      const a = r() * Math.PI * 2;
      const e = 0.12 + Math.pow(r(), 0.7) * 1.35;
      const d = SKY_R - 2;
      pts.push(Math.cos(a) * Math.cos(e) * d, Math.sin(e) * d, Math.sin(a) * Math.cos(e) * d);
      const c = new THREE.Color().setHSL(r() < 0.2 ? 0.08 : 0.6, 0.5, 0.8 + r() * 0.2);
      cols.push(c.r, c.g, c.b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const mat = new THREE.PointsMaterial({ size: k ? 0.16 : 0.1, vertexColors: true, transparent: true, fog: false, depthWrite: false });
    const p = new THREE.Points(geo, mat);
    p.renderOrder = -9;
    g.add(p);
    return mat;
  });
  tick(g, (now) => {
    layers[0].opacity = 0.75 + Math.sin(now / 900) * 0.25;
    layers[1].opacity = 0.7 + Math.sin(now / 1300 + 2) * 0.3;
  });
}

// Luna con su halo, mirando a la mesa. { dir: [x, y, z], size, color }
function moonDisc(g, { dir = [-0.5, 0.45, -0.75], size = 3, color = '#f4efe0' } = {}) {
  const tex = canvasTex(256, 256, (ctx, w) => {
    const c = w / 2;
    const halo = ctx.createRadialGradient(c, c, w * 0.12, c, c, c);
    halo.addColorStop(0, 'rgba(255,248,225,0.55)');
    halo.addColorStop(1, 'rgba(255,248,225,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, w);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(c, c, w * 0.17, 0, Math.PI * 2);
    ctx.fill();
    // mares de la luna
    const r = seeded(4);
    ctx.fillStyle = 'rgba(150,140,120,0.28)';
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.arc(c + (r() - 0.5) * w * 0.2, c + (r() - 0.5) * w * 0.2, w * (0.02 + r() * 0.04), 0, Math.PI * 2);
      ctx.fill();
    }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false, depthWrite: false }));
  const v = new THREE.Vector3(...dir).normalize().multiplyScalar(SKY_R - 4);
  m.position.copy(v);
  m.lookAt(0, 0, 0);
  m.renderOrder = -8;
  g.add(m);
}

// ------------------------------------------------------------------ nubes y capas de distancia

/** Nubes pintadas en un anillo que gira despacito. { color, shade, r, y, h, n, speed, seed, alpha } */
export function clouds(g, { color = '#ffffff', shade = '#d8dde6', r = 31, y = 9, h = 9, n = 26, speed = 0.004, seed = 7, alpha = 0.9 } = {}) {
  const tex = canvasTex(2048, 256, (ctx, w, hh) => {
    const rr = seeded(seed);
    for (let i = 0; i < n; i++) {
      const cx = rr() * w;
      const cy = hh * (0.3 + rr() * 0.45);
      const cw = 70 + rr() * 260;
      // cada nube: bochas suaves, más claras arriba y con la panza a la sombra
      const puffs = 5 + Math.floor(rr() * 8);
      for (let k = 0; k < puffs; k++) {
        for (const dx of [0, -w, w]) {
          const bx = cx + dx + (rr() - 0.5) * cw;
          const by = cy + (rr() - 0.5) * 30 - Math.abs(bx - cx - dx) * 0.08;
          const br = 22 + rr() * 38;
          const gr = ctx.createRadialGradient(bx, by - br * 0.3, br * 0.1, bx, by, br);
          gr.addColorStop(0, color);
          gr.addColorStop(0.65, mix(color, shade, 0.5));
          gr.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = gr;
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  });
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, h, 64, 1, true),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: alpha, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  ring.position.y = y;
  ring.renderOrder = -7;
  g.add(ring);
  tick(g, (now, dt) => (ring.rotation.y += speed * dt));
  return ring;
}

/**
 * Una capa de distancia: un anillo alrededor de la mesa con algo pintado (cerros, arboleda, ciudad), cada capa más
 * lejos más tapada por la bruma del color `haze` (t: 0 nada, 1 todo). draw(ctx, w, h, rng).
 */
export function layer(g, draw, { r = 20, h = 4, y = h / 2 - 0.05, haze = null, t = 0, seed = 1, w = 2048, ph = 256 } = {}) {
  const tex = canvasTex(w, ph, (ctx, cw, chh) => {
    draw(ctx, cw, chh, seeded(seed));
    if (haze && t > 0) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = t;
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, cw, chh);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  });
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 72, 1, true), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  ring.position.y = y;
  ring.renderOrder = -6 + Math.round(10 / r);
  g.add(ring);
  return ring;
}

/** Cerros suaves (para layer). */
export const paintHills = (color, { base = 0.55, amp = 0.35, waves = 5 } = {}) => (ctx, w, h, r) => {
  const ph = [r() * 6, r() * 6, r() * 6];
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 8) {
    const t = (x / w) * Math.PI * 2;
    const y = Math.sin(t * waves + ph[0]) * 0.5 + Math.sin(t * waves * 2.3 + ph[1]) * 0.3 + Math.sin(t * waves * 5.1 + ph[2]) * 0.12;
    ctx.lineTo(x, h * (base - y * amp * 0.5));
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
};

/** Arboleda: copas redondas en fila, con algún álamo alto (para layer). */
export const paintTreeline = (color, light, { top = 0.25, poplar = 0.15 } = {}) => (ctx, w, h, r) => {
  let x = -20;
  while (x < w + 20) {
    const tall = r() < poplar;
    const cw = tall ? 14 + r() * 10 : 26 + r() * 40;
    const ch = tall ? h * (0.55 + r() * 0.2) : h * (top + r() * 0.3);
    ctx.fillStyle = color;
    ctx.beginPath();
    if (tall) ctx.ellipse(x, h - ch / 2, cw / 2, ch / 2, 0, 0, Math.PI * 2);
    else for (let k = 0; k < 4; k++) ctx.arc(x + (r() - 0.5) * cw * 0.6, h - ch + cw * 0.4 + r() * 10, cw * (0.35 + r() * 0.2), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - cw / 2, h - ch * 0.55, cw, ch * 0.55);
    // luz de costado en las copas
    ctx.fillStyle = light;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(x - cw * 0.2, h - ch + cw * 0.35, cw * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    x += cw * (0.55 + r() * 0.35);
  }
};

/** Ciudad a lo lejos, con ventanas prendidas de noche (lit: chance de cada ventana) (para layer). */
export const paintCity = (color, { lit = 0, light = '#ffd890', min = 0.2, max = 0.85, antenna = 0.15 } = {}) => (ctx, w, h, r) => {
  let x = 0;
  while (x < w) {
    const bw = 24 + r() * 70;
    const bh = h * (min + r() * (max - min));
    ctx.fillStyle = color;
    ctx.fillRect(x, h - bh, bw, bh);
    if (r() < antenna) ctx.fillRect(x + bw / 2 - 1, h - bh - 18, 2, 18);
    if (lit) {
      ctx.fillStyle = light;
      for (let wy = h - bh + 6; wy < h - 6; wy += 9) for (let wx = x + 4; wx < x + bw - 5; wx += 7) if (r() < lit) ctx.fillRect(wx, wy, 3, 4);
    }
    x += bw + 1 + r() * 6;
  }
};

// ------------------------------------------------------------------ cosas vivas

/** Pétalos (o hojas) que caen girando sobre la mesa y alrededor. { n, colors, area, top, speed, size } */
export function petals(g, { n = 260, colors = ['#ffd3e2', '#ffb8cf', '#fff0f5'], area = 7, top = 5, speed = 0.35, size = 0.07, seed = 5 } = {}) {
  const r = seeded(seed);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const ph = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (r() - 0.5) * area * 2;
    pos[i * 3 + 1] = r() * top;
    pos[i * 3 + 2] = (r() - 0.5) * area * 2;
    const c = new THREE.Color(colors[Math.floor(r() * colors.length)]);
    col.set([c.r, c.g, c.b], i * 3);
    ph[i] = r() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const tex = canvasTex(32, 32, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(16, 16, 14, 8, 0.5, 0, Math.PI * 2);
    ctx.fill();
  });
  const mat = new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, alphaTest: 0.3, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  g.add(pts);
  tick(g, (now, dt) => {
    const t = now / 1000;
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      pos[k + 1] -= speed * dt * (0.6 + ((i * 7) % 5) * 0.1);
      pos[k] += Math.sin(t * 1.3 + ph[i]) * 0.25 * dt + 0.08 * dt;
      pos[k + 2] += Math.cos(t * 0.9 + ph[i]) * 0.2 * dt;
      if (pos[k + 1] < 0.02) {
        pos[k + 1] = top;
        pos[k] = (r() - 0.5) * area * 2;
        pos[k + 2] = (r() - 0.5) * area * 2;
      }
    }
    geo.attributes.position.needsUpdate = true;
  });
  return pts;
}

/** Luciérnagas o chispitas que flotan y prenden y apagan. { n, color, area, low, high } */
export function fireflies(g, { n = 40, color = '#fff2a6', area = 6, low = 0.4, high = 2.4, seed = 12 } = {}) {
  const r = seeded(seed);
  const base = [];
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let x;
    let z;
    do {
      x = (r() - 0.5) * area * 2;
      z = (r() - 0.5) * area * 2;
    } while (Math.hypot(x, z) < 2); // lejos de la mesa
    base.push([x, low + r() * (high - low), z, r() * 10]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size: 0.06, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  g.add(pts);
  tick(g, (now) => {
    const t = now / 1000;
    base.forEach(([x, y, z, p], i) => pos.set([x + Math.sin(t * 0.4 + p) * 0.4, y + Math.sin(t * 0.7 + p * 2) * 0.25, z + Math.cos(t * 0.5 + p) * 0.4], i * 3));
    mat.opacity = 0.65 + Math.sin(t * 2.2) * 0.25;
    geo.attributes.position.needsUpdate = true;
  });
  return pts;
}

/** Motas de polvo que flotan en la luz de la lámpara (interiores). */
export function dust(g, { n = 70, color = '#fff3dc', radius = 1.1, y0 = 0.9, y1 = 2.5, seed = 8 } = {}) {
  const r = seeded(seed);
  const base = Array.from({ length: n }, () => [(r() - 0.5) * 2 * radius, y0 + r() * (y1 - y0), (r() - 0.5) * 2 * radius, r() * 10]);
  const pos = new Float32Array(n * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size: 0.018, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  g.add(pts);
  tick(g, (now) => {
    const t = now / 1000;
    base.forEach(([x, y, z, p], i) => pos.set([x + Math.sin(t * 0.13 + p) * 0.15, y + Math.sin(t * 0.09 + p * 3) * 0.2, z + Math.cos(t * 0.11 + p) * 0.15], i * 3));
    geo.attributes.position.needsUpdate = true;
  });
  return pts;
}

/** Un halo pintado (brillo suave) para luces: neones, faroles, ventanas. */
export function glowSprite(color, size = 1, alpha = 0.6) {
  const tex = canvasTex(64, 64, (ctx, w) => {
    const gr = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, color);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, w);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: alpha, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.set(size, size, 1);
  return s;
}
