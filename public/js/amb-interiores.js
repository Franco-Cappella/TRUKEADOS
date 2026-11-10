// Los ambientes de adentro, con el mismo cuidado que el Barrio Chino: el bar notable de noche, el café porteño a
// la mañana, la parrilla de barrio con el fuego prendido y el club de barrio a la tarde. Cada uno es un salón grande
// (más que la vista desde la mesa) con ventanas que dan a la calle (afuera pintado en capas y autos que pasan),
// muebles de verdad alrededor, varias luces con su halo y cosas que se mueven (ventiladores, humo, el reloj, la tele).
// Del lado de +z (atrás de tu silla) el centro queda libre y bajo: por ahí mira la cámara de la sala de espera.
import * as THREE from 'three';
import { FONT } from './theme.js';
import {
  hsl, basic, box, cyl, ball, put, canvasTex, noise, seeded, toon, tick, glowSprite,
  tableLight, bulb, flicker, stringLights, embers, fire, smoke, streetOutside, holedWall, windowFrame, glass,
  lightShaft, ceilingFan, label, plate,
} from './amb-kit.js';
import {
  plankTex, checkerTex, brickTex, tileTex, bottleShelfTex, pictureTex, chair, sideTable, cup, glassware, pottedPlant,
} from './amb-piezas.js';
import { dust } from './paisaje.js';

// ------------------------------------------------------------------ el salón

const X = 6; // medio ancho
const Z = 6; // medio fondo
const H = 4.4; // alto

/**
 * Las cuatro paredes, el piso y el techo. walls: { front, right, back, left } con { tex, holes } (front = -z, right =
 * +x, back = +z, left = -x). Los huecos dejan ver lo de afuera (streetOutside).
 */
// tint: cuánta luz tienen las paredes (se pintan con su luz: de noche, más oscuras).
function hall(g, { walls, floorTex, ceil, h = H, tint = '#ffffff' }) {
  const at = {
    front: [0, -Z, 0, X * 2],
    right: [X, 0, -Math.PI / 2, Z * 2],
    back: [0, Z, Math.PI, X * 2],
    left: [-X, 0, Math.PI / 2, Z * 2],
  };
  for (const [k, w] of Object.entries(walls)) {
    const [x, z, ry, width] = at[k];
    const m = holedWall(w.tex, width, h, w.holes || [], { color: tint });
    m.position.set(x, 0, z);
    m.rotation.y = ry;
    g.add(m);
    for (const hole of w.holes || []) {
      if (!w.frame) continue;
      const f = windowFrame(hole, w.frame, w.frameOpts);
      f.position.set(x, 0, z);
      f.rotation.y = ry;
      g.add(f);
      const gl = glass(hole.w, hole.h, { alpha: w.glass ?? 0.1 });
      const lx = hole.x;
      gl.position.set(lx, hole.y + hole.h / 2, 0.01);
      const holder = new THREE.Group();
      holder.add(gl);
      holder.position.set(x, 0, z);
      holder.rotation.y = ry;
      g.add(holder);
    }
  }
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(X * 2, Z * 2), toon(null, { map: floorTex }));
  fl.rotation.x = -Math.PI / 2;
  fl.receiveShadow = true;
  g.add(fl);
  const c = new THREE.Mesh(new THREE.PlaneGeometry(X * 2, Z * 2), basic(tint, { map: ceil }));
  c.rotation.x = Math.PI / 2;
  c.position.y = h;
  g.add(c);
}

/** Textura de pared por zonas: abajo (zócalo/boiserie) hasta `dado` m y arriba, con molduras. paint(ctx, w, h, yAt). */
function wallTex({ width = 12, h = H, px = 1024, top, bottom, dado = 1.2, trim, paint = null, shade = 0.35 }) {
  const ph = Math.round((px * h) / width) * 2;
  const yAt = (m) => (1 - m / h) * ph;
  return canvasTex(px * 2, ph, (ctx, w, hh) => {
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, w, hh);
    ctx.fillStyle = bottom;
    ctx.fillRect(0, yAt(dado), w, hh - yAt(dado));
    paint?.(ctx, w, hh, yAt);
    if (trim) {
      ctx.fillStyle = trim;
      ctx.fillRect(0, yAt(dado) - 8, w, 12);
      ctx.fillRect(0, yAt(h - 0.25), w, 14);
    }
    // penumbra arriba (la luz viene de la mesa) y un poco abajo
    const gr = ctx.createLinearGradient(0, 0, 0, hh);
    gr.addColorStop(0, `rgba(0,0,0,${shade})`);
    gr.addColorStop(0.35, 'rgba(0,0,0,0)');
    gr.addColorStop(0.9, 'rgba(0,0,0,0)');
    gr.addColorStop(1, `rgba(0,0,0,${shade * 0.5})`);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, hh);
    noise(ctx, w, hh, 6);
  });
}

// Paneles de boiserie (rectángulos con bisel) entre dos alturas.
function panels(ctx, w, yTop, yBot, { n = 12, fill, light, dark }) {
  const pw = w / n;
  for (let i = 0; i < n; i++) {
    const x = i * pw + 10;
    ctx.fillStyle = dark;
    ctx.fillRect(x, yTop + 10, pw - 20, yBot - yTop - 20);
    ctx.fillStyle = fill;
    ctx.fillRect(x + 6, yTop + 16, pw - 32, yBot - yTop - 32);
    ctx.fillStyle = light;
    ctx.fillRect(x + 6, yTop + 16, pw - 32, 3);
    ctx.fillRect(x + 6, yTop + 16, 3, yBot - yTop - 32);
  }
}

// Papel de pared con un dibujo que se repite (flor de lis, rombos).
function damask(ctx, w, y0, y1, { a, b, step = 64 }) {
  ctx.fillStyle = a;
  ctx.fillRect(0, y0, w, y1 - y0);
  ctx.fillStyle = b;
  for (let y = y0 + step / 2, row = 0; y < y1; y += step, row++) {
    for (let x = (row % 2) * (step / 2); x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, y - step * 0.32);
      ctx.quadraticCurveTo(x + step * 0.22, y - step * 0.05, x, y + step * 0.32);
      ctx.quadraticCurveTo(x - step * 0.22, y - step * 0.05, x, y - step * 0.32);
      ctx.fill();
      ctx.fillRect(x - step * 0.18, y - 2, step * 0.36, 4);
    }
  }
}

// Columna con base y capitel dorado.
function column(g, x, z, { h = H, r = 0.2, shaft, gold }) {
  put(g, cyl(r * 1.4, r * 1.5, 0.35, gold, 20), x, 0.175, z);
  put(g, cyl(r, r * 1.05, h - 0.8, shaft, 20), x, (h - 0.8) / 2 + 0.35, z);
  put(g, cyl(r * 1.6, r * 1.1, 0.45, gold, 20), x, h - 0.225, z);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.06, 0.025, 6, 24), gold);
  ring.rotation.x = Math.PI / 2;
  put(g, ring, x, 1.1, z);
}

// Lámpara colgante (globo de vidrio) con su halo.
function globeLamp(g, x, y, z, { color = '#fff1d6', size = 0.16, cord = 1.2, light = 0 } = {}) {
  put(g, cyl(0.005, 0.005, cord, basic('#141414'), 4, false), x, y + size + cord / 2, z);
  put(g, cyl(0.05, 0.07, 0.06, toon('#b8892e'), 12, false), x, y + size, z);
  const gl = ball(size, basic(color, { transparent: true, opacity: 0.95 }), 20);
  put(g, gl, x, y, z);
  const h = glowSprite(color, size * 6, 0.45);
  put(g, h, x, y, z);
  if (light) {
    const l = new THREE.PointLight(color, light, 6, 1.6);
    put(g, l, x, y - 0.1, z);
  }
  return h;
}

// Aplique de pared (tulipa) con halo.
function sconce(g, x, y, z, ry, { color = '#ffdba0', metal } = {}) {
  const grp = new THREE.Group();
  put(grp, box(0.06, 0.22, 0.04, metal, false), 0, 0, 0);
  const arm = box(0.03, 0.03, 0.18, metal, false);
  put(grp, arm, 0, 0.06, 0.09);
  const tul = cyl(0.04, 0.09, 0.14, basic(color, { transparent: true, opacity: 0.9 }), 12, false);
  put(grp, tul, 0, 0.14, 0.18);
  const h = glowSprite(color, 0.9, 0.5);
  put(grp, h, 0, 0.16, 0.2);
  grp.position.set(x, y, z);
  grp.rotation.y = ry;
  g.add(grp);
  return h;
}

// Reloj de pared con las agujas que andan (la hora de verdad).
function wallClock(g, x, y, z, ry, { size = 0.7, face = '#f7f3e8', ink = '#1a1410', rim = '#6b4a22' } = {}) {
  const grp = new THREE.Group();
  const tex = canvasTex(256, 256, (ctx, w) => {
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(w / 2, w / 2, w / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(w / 2, w / 2, w / 2 - 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.font = `700 26px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ['XII', 'III', 'VI', 'IX'].forEach((t, i) => {
      const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
      ctx.fillText(t, w / 2 + Math.cos(a) * 88, w / 2 + Math.sin(a) * 88);
    });
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      ctx.fillRect(w / 2 + Math.cos(a) * 104 - 1, w / 2 + Math.sin(a) * 104 - 1, i % 5 ? 2 : 4, i % 5 ? 2 : 4);
    }
  });
  grp.add(plate(tex, size, size, { transparent: true }));
  const hand = (len, wdt) => {
    const p = new THREE.Group();
    const m = box(wdt, len, 0.005, basic(ink), false);
    m.position.y = len / 2 - 0.02;
    p.add(m);
    p.position.z = 0.01;
    grp.add(p);
    return p;
  };
  const hh = hand(size * 0.24, 0.025);
  const mm = hand(size * 0.36, 0.016);
  const ss = hand(size * 0.38, 0.006);
  ss.children[0].material = basic('#b02a1a');
  grp.position.set(x, y, z);
  grp.rotation.y = ry;
  g.add(grp);
  tick(g, () => {
    const d = new Date();
    const s = d.getSeconds() + d.getMilliseconds() / 1000;
    const m = d.getMinutes() + s / 60;
    const hr = (d.getHours() % 12) + m / 60;
    ss.rotation.z = -(s / 60) * Math.PI * 2;
    mm.rotation.z = -(m / 60) * Math.PI * 2;
    hh.rotation.z = -(hr / 12) * Math.PI * 2;
  });
}

// Algo pegado a una pared: wall 'front' | 'right' | 'back' | 'left', x a lo largo (de izquierda a derecha mirando la
// pared) e y la altura del centro.
function onWall(g, obj, wall, x, y, off = 0.03) {
  const at = {
    front: [x, -Z + off, 0],
    right: [X - off, x, -Math.PI / 2],
    back: [-x, Z - off, Math.PI],
    left: [-X + off, -x, Math.PI / 2],
  }[wall];
  obj.position.set(at[0], y, at[1]);
  obj.rotation.y = at[2];
  g.add(obj);
  return obj;
}

// ------------------------------------------------------------------ bar notable

// Bar notable porteño de noche: boiserie de roble, papel de pared con flores de lis, columnas con capitel dorado,
// el vitral iluminado en el techo, la barra larga con el espejo y las botellas, la cafetera de bronce que larga vapor,
// apliques y globos de luz, ventanales en arco a la calle (faroles, autos que pasan) y los cuadros de tango.
export function bar(g) {
  const C = {
    oak: hsl(22, 0.5, 0.2), oakLight: hsl(26, 0.5, 0.3), oakDark: hsl(18, 0.55, 0.1),
    paper: hsl(30, 0.42, 0.26), paperInk: hsl(34, 0.5, 0.34), brass: hsl(42, 0.65, 0.5), marble: hsl(35, 0.15, 0.85),
    wine: hsl(352, 0.55, 0.25),
  };
  const gold = toon(C.brass);
  const oak = toon(C.oak);
  const wall = (holes = []) => ({
    tex: wallTex({ top: C.paper, bottom: C.oakDark, dado: 1.45, trim: C.brass, shade: 0.45, paint: (ctx, w, hh, yAt) => {
      damask(ctx, w, yAt(H - 0.25), yAt(1.45), { a: C.paper, b: C.paperInk, step: 72 });
      panels(ctx, w, yAt(1.4), yAt(0.12), { n: 14, fill: C.oak, light: C.oakLight, dark: C.oakDark });
      // friso de madera arriba
      ctx.fillStyle = C.oakDark;
      ctx.fillRect(0, yAt(H), w, yAt(H - 0.5));
    } }),
    holes,
    frame: toon(C.oakDark),
    glass: 0.12,
  });
  const win = [-3.4, 0, 3.4].map((x) => ({ x, y: 0.95, w: 1.5, h: 2.85, arch: true }));
  hall(g, {
    walls: { front: { ...wall(), holes: [] }, right: wall(win), back: wall([{ x: 0, y: 0, w: 1.6, h: 2.7 }]), left: wall() },
    floorTex: checkerTex(C.marble, hsl(352, 0.4, 0.22), { n: 8, repeat: 6, diag: true }),
    tint: '#b8a898',
    ceil: canvasTex(1024, 1024, (ctx, w, h) => {
      // artesonado de madera con el vitral en el medio
      ctx.fillStyle = C.oakDark;
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 128) for (let x = 0; x < w; x += 128) {
        ctx.fillStyle = C.oak;
        ctx.fillRect(x + 12, y + 12, 104, 104);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x + 22, y + 22, 84, 84);
      }
    }),
  });
  streetOutside(g, { d: X, side: [1, 0], night: true, seed: 4 });
  streetOutside(g, { d: Z, side: [0, 1], night: true, seed: 9, w: 10 });

  // el vitral del techo, iluminado desde arriba
  const vit = canvasTex(512, 512, (ctx, w) => {
    const r = seeded(12);
    const cols = [hsl(40, 0.85, 0.6), hsl(200, 0.7, 0.5), hsl(350, 0.7, 0.45), hsl(120, 0.5, 0.4), hsl(45, 0.9, 0.75)];
    ctx.fillStyle = '#1a1208';
    ctx.fillRect(0, 0, w, w);
    const c = w / 2;
    for (let ring = 6; ring > 0; ring--) {
      const n = ring * 8;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        ctx.fillStyle = cols[(i + ring) % cols.length];
        ctx.globalAlpha = 0.7 + r() * 0.3;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a0) * ring * 38, c + Math.sin(a0) * ring * 38);
        ctx.arc(c, c, ring * 38, a0, a1);
        ctx.lineTo(c + Math.cos(a1) * (ring - 1) * 38, c + Math.sin(a1) * (ring - 1) * 38);
        ctx.arc(c, c, (ring - 1) * 38, a1, a0, true);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#1a1208';
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    }
    ctx.strokeStyle = C.brass;
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, w - 14, w - 14);
  });
  const vitral = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), basic('#ffffff', { map: vit }));
  vitral.rotation.x = Math.PI / 2;
  vitral.position.set(0, H - 0.01, -1.2);
  g.add(vitral);
  const vglow = glowSprite('rgba(255,210,140,1)', 4, 0.18);
  put(g, vglow, 0, H - 0.3, -1.2);

  // luces: la de la mesa, la del salón (cálida) y los apliques
  g.add(new THREE.HemisphereLight(hsl(35, 0.6, 0.7), hsl(15, 0.4, 0.12), 0.9));
  tableLight(g, { color: '#ffe0b0', intensity: 8.5 });
  put(g, cyl(0.005, 0.005, 1.6, basic('#0a0a0a'), 4, false), 0, 3.4, 0);
  put(g, new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.28, 32, 1, true), toon(hsl(150, 0.4, 0.2), { side: THREE.DoubleSide })), 0, 2.64, 0);
  bulb(g, 0, 2.56, 0, { color: '#fff3d8', size: 0.07, halo: 0.6, alpha: 0.5 });
  for (const [x, z] of [[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6]]) globeLamp(g, x, 3.2, z, { light: x < 0 && z < 0 ? 1.4 : 0 });
  const warm = new THREE.PointLight('#ffc98a', 1.6, 10, 1.4);
  warm.position.set(3, 2.6, 2);
  g.add(warm);
  const halos = [];
  for (const x of [-4, -1.3, 1.3, 4]) halos.push(sconce(g, x, 2.3, -Z + 0.05, 0, { metal: gold }));
  for (const z of [-3.6, 0, 3.6]) {
    const s = sconce(g, 0, 2.4, 0, 0, { metal: gold });
    halos.push(s);
    onWall(g, s.parent, 'left', z, 2.4, 0.05);
  }
  flicker(g, halos, { base: 1, amp: 0.12, speed: 0.4 });

  // la barra: espejo con estantes de botellas, el mostrador con zócalo de bronce, banquetas y la cafetera
  const shelf = plate(bottleShelfTex({ mirror: true, wood: C.oakDark, back: '#0c0805' }), 8.4, 2.6, { transparent: false });
  onWall(g, shelf, 'front', 0, 2.45, 0.02);
  const arch = canvasTex(1024, 160, (ctx, w, h) => {
    ctx.fillStyle = C.oakDark;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = C.brass;
    ctx.font = `800 92px Georgia, "Times New Roman", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '18px';
    ctx.fillText('BAR NOTABLE', w / 2, h / 2 + 6);
    ctx.fillRect(40, 18, w - 80, 4);
    ctx.fillRect(40, h - 22, w - 80, 4);
  });
  onWall(g, plate(arch, 4.2, 0.66, { transparent: false }), 'front', 0, 4.0, 0.03);
  const counter = box(8, 1.08, 0.7, oak);
  put(g, counter, 0, 0.54, -Z + 1.05);
  put(g, box(8.2, 0.06, 0.82, toon(C.marble)), 0, 1.1, -Z + 1.05);
  const rail = cyl(0.025, 0.025, 8, gold, 8, false);
  rail.rotation.z = Math.PI / 2;
  put(g, rail, 0, 0.22, -Z + 1.48);
  for (let i = -3; i <= 3; i++) {
    put(g, cyl(0.19, 0.19, 0.08, toon(C.wine), 16), i * 1.1, 0.78, -Z + 1.75);
    put(g, cyl(0.03, 0.05, 0.74, gold, 8), i * 1.1, 0.37, -Z + 1.75);
    const fr = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 6, 16), gold);
    fr.rotation.x = Math.PI / 2;
    put(g, fr, i * 1.1, 0.3, -Z + 1.75);
  }
  // la cafetera de bronce con el águila arriba y el vapor
  const maq = new THREE.Group();
  put(maq, cyl(0.24, 0.26, 0.62, gold, 24), 0, 0.31, 0);
  put(maq, ball(0.24, gold, 20), 0, 0.64, 0);
  put(maq, ball(0.07, gold, 12), 0, 0.92, 0);
  for (const sx of [-1, 1]) put(maq, box(0.08, 0.05, 0.2, toon('#1a1a1a')), sx * 0.12, 0.3, 0.26);
  put(g, maq, 2.6, 1.13, -Z + 0.95);
  smoke(g, 2.6, 2.1, -Z + 0.95, { n: 6, rise: 1.0, size: 0.4, alpha: 0.18, spread: 0.25 });
  // caja registradora y tirador de cerveza
  const caja = new THREE.Group();
  put(caja, box(0.5, 0.3, 0.4, toon(hsl(40, 0.4, 0.35))), 0, 0.15, 0);
  put(caja, box(0.4, 0.18, 0.1, toon(hsl(40, 0.4, 0.45))), 0, 0.38, -0.12);
  put(g, caja, -2.8, 1.13, -Z + 1.0);
  for (const x of [-0.6, -0.3, 0]) {
    put(g, cyl(0.02, 0.02, 0.36, gold, 8), x, 1.31, -Z + 0.9);
    put(g, cyl(0.025, 0.02, 0.14, toon('#111'), 8), x, 1.55, -Z + 0.9);
  }
  for (let i = 0; i < 6; i++) glassware(g, -1.8 + i * 0.35, 1.13, -Z + 1.25, { kind: i % 2 ? 'vaso' : 'copa', wine: i % 2 ? '#d89a2a' : C.wine });

  // columnas
  const marbleDark = toon(hsl(20, 0.25, 0.18));
  for (const [x, z] of [[-4.6, -2.2], [4.6, -2.2], [-4.6, 2.6], [4.6, 2.6]]) column(g, x, z, { shaft: marbleDark, gold });

  // cuadros (tango, sol, bandoneón, espada) y el reloj
  const frame = hsl(40, 0.55, 0.35);
  [['tango', -3.8], ['sol', -1.2], ['bandoneon', 1.2], ['espada', 3.8]].forEach(([k, x], i) => {
    const pal = [[hsl(40, 0.45, 0.78), hsl(10, 0.4, 0.12)], [hsl(35, 0.6, 0.65), hsl(15, 0.6, 0.2)], [hsl(38, 0.3, 0.82), hsl(20, 0.3, 0.15)], [hsl(5, 0.5, 0.32), hsl(40, 0.4, 0.82)]][i];
    onWall(g, plate(pictureTex(k, pal[0], pal[1], frame), 0.85, 1.12, { transparent: false }), 'left', x * 1.2 - 0.2, 2.15, 0.04);
  });
  wallClock(g, 0, 3.25, 0, 0, { size: 0.75 });
  onWall(g, g.children.at(-1), 'back', 2.5, 3.1, 0.04);

  // mesitas de mármol con sillas de Viena, café y copas
  const iron = toon(hsl(30, 0.2, 0.12));
  const viena = toon(hsl(20, 0.55, 0.18));
  const r = seeded(31);
  for (const [x, z] of [[-3.6, -1.4], [3.4, -1.0], [-3.8, 1.6], [-5, 4.6], [5, 4.6], [3.6, 1.8]]) {
    sideTable(g, x, z, toon(C.marble), iron, { items: (tx, ty, tz) => {
      if (r() < 0.6) cup(g, tx + 0.1, ty, tz);
      if (r() < 0.6) glassware(g, tx - 0.12, ty, tz + 0.05, { wine: C.wine });
    } });
    chair(g, x + 0.55, z + 0.1, -Math.PI / 2, viena, { kind: 'viena' });
    chair(g, x - 0.55, z - 0.1, Math.PI / 2, viena, { kind: 'viena' });
  }
  ceilingFan(g, -2.8, 3.95, 2.4, { mat: toon(C.oakDark), speed: 1.4 });
  ceilingFan(g, 2.8, 3.95, 2.4, { mat: toon(C.oakDark), speed: 1.6 });
  pottedPlant(g, -5.3, -5.2, { kind: 'palm', h: 1.4, leaves: hsl(130, 0.4, 0.25), pot: hsl(30, 0.5, 0.3), r });
  pottedPlant(g, 5.3, -5.2, { kind: 'palm', h: 1.4, leaves: hsl(130, 0.4, 0.25), pot: hsl(30, 0.5, 0.3), r });
  dust(g, { color: '#ffe4bf', radius: 1.3 });
  return { background: hsl(20, 0.4, 0.04), fog: [hsl(20, 0.35, 0.06), 9, 22] };
}

// ------------------------------------------------------------------ café porteño

// Café porteño a media mañana: el sol entra por los ventanales en arco (con los haces de luz y el polvo), afuera la
// vereda con los plátanos y los autos; damero blanco y negro, boiserie clara, el mostrador con la vitrina de
// medialunas y la cafetera humeando, el pizarrón, la araña de globos, los ventiladores y el reloj que anda.
export function cafe(g) {
  const C = {
    cream: hsl(40, 0.5, 0.8), creamDark: hsl(38, 0.35, 0.66), wood: hsl(25, 0.45, 0.24), woodLight: hsl(28, 0.45, 0.34),
    green: hsl(150, 0.35, 0.24), brass: hsl(42, 0.6, 0.52), marble: hsl(40, 0.1, 0.92),
  };
  const gold = toon(C.brass);
  const wall = (holes = []) => ({
    tex: wallTex({ top: C.cream, bottom: C.wood, dado: 1.25, trim: C.brass, shade: 0.12, paint: (ctx, w, hh, yAt) => {
      panels(ctx, w, yAt(1.2), yAt(0.1), { n: 16, fill: C.wood, light: C.woodLight, dark: hsl(25, 0.45, 0.16) });
      // molduras en la parte de arriba (paños)
      for (let x = 30; x < w; x += 256) {
        ctx.strokeStyle = C.creamDark;
        ctx.lineWidth = 6;
        ctx.strokeRect(x, yAt(H - 0.5), 200, yAt(1.6) - yAt(H - 0.5));
      }
    } }),
    holes,
    frame: toon(C.green),
    frameOpts: { bars: 1, rails: 2 },
    glass: 0.08,
  });
  const front = [-3.6, 0, 3.6].map((x) => ({ x, y: 0.6, w: 2.0, h: 3.3, arch: true }));
  const left = [-2.4, 2.4].map((x) => ({ x, y: 0.9, w: 1.6, h: 2.8, arch: true }));
  hall(g, {
    walls: { front: wall(front), right: wall(), back: wall([{ x: 0, y: 0, w: 1.8, h: 2.9, arch: true }]), left: wall(left) },
    floorTex: checkerTex(hsl(0, 0, 0.1), hsl(40, 0.1, 0.9), { n: 8, repeat: 7, grout: 'rgba(0,0,0,0.25)' }),
    tint: '#ece4d8',
    ceil: canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = C.cream;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = C.creamDark;
      ctx.lineWidth = 10;
      for (let i = 0; i < 4; i++) ctx.strokeRect(30 + i * 50, 30 + i * 50, w - 60 - i * 100, h - 60 - i * 100);
    }),
  });
  streetOutside(g, { d: Z, side: [0, -1], night: false, seed: 6 });
  streetOutside(g, { d: X, side: [-1, 0], night: false, seed: 13 });

  // luz de día: cielo claro, el sol que entra por los ventanales (haces), la araña sobre la mesa
  g.add(new THREE.HemisphereLight('#fffaf0', hsl(35, 0.3, 0.45), 1.5));
  tableLight(g, { color: '#fff4e0', intensity: 5.5 });
  const sunIn = new THREE.DirectionalLight('#fff0d0', 0.9);
  sunIn.position.set(-2, 6, -8);
  g.add(sunIn);
  for (const x of [-3.6, 0, 3.6]) lightShaft(g, [x - 0.4, 3.2, -Z], [x + 0.8, 0, -Z + 3.6], { w: 1.6, alpha: 0.09 });
  for (const z of [-2.4, 2.4]) lightShaft(g, [-X, 3, z], [-X + 3, 0, z + 0.6], { w: 1.3, alpha: 0.07 });
  // araña de globos sobre la mesa
  put(g, cyl(0.006, 0.006, 1.4, basic('#141414'), 4, false), 0, 3.7, 0);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.02, 8, 40), gold);
  ring.rotation.x = Math.PI / 2;
  put(g, ring, 0, 3.0, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    bulb(g, Math.cos(a) * 0.5, 3.08, Math.sin(a) * 0.5, { color: '#fff7e6', size: 0.08, halo: 0.6, alpha: 0.35 });
  }
  for (const [x, z] of [[-3.5, 3.2], [3.5, 3.2], [-3.5, -3.2], [3.5, -3.2]]) globeLamp(g, x, 3.1, z, { size: 0.15, cord: 1.1 });
  ceilingFan(g, -2.6, 4.05, 0.8, { mat: toon(C.wood), speed: 1.2 });
  ceilingFan(g, 2.6, 4.05, 0.8, { mat: toon(C.wood), speed: 1.5 });

  // el mostrador (a la derecha) con la vitrina de medialunas, la cafetera y el pizarrón
  const counter = new THREE.Group();
  put(counter, box(0.7, 1.05, 5, toon(C.wood)), 0, 0.525, 0);
  put(counter, box(0.82, 0.06, 5.1, toon(C.marble)), 0, 1.08, 0);
  // vitrina de vidrio con medialunas y facturas
  const vit = new THREE.MeshBasicMaterial({ color: '#e8f4f8', transparent: true, opacity: 0.25, depthWrite: false });
  put(counter, box(0.6, 0.45, 1.6, vit, false), 0, 1.33, -1.2);
  const med = toon(hsl(35, 0.75, 0.55));
  const r = seeded(17);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.025, 6, 10, Math.PI * 1.3), med);
    m.rotation.set(Math.PI / 2, 0, r() * 6);
    put(counter, m, (r() - 0.5) * 0.4, 1.16 + (i % 2) * 0.18, -1.9 + (i % 7) * 0.22);
  }
  const maq = new THREE.Group();
  put(maq, box(0.55, 0.5, 0.9, toon(hsl(0, 0, 0.75))), 0, 0.25, 0);
  put(maq, box(0.5, 0.06, 0.85, gold), 0, 0.53, 0);
  for (const dz of [-0.25, 0.25]) put(maq, box(0.08, 0.06, 0.12, toon('#111')), -0.3, 0.2, dz);
  put(counter, maq, 0.05, 1.11, 1.1);
  for (let i = 0; i < 5; i++) cup(counter, -0.2, 1.11, 1.9 + i * 0.1);
  counter.position.set(X - 1.0, 0, -0.4);
  g.add(counter);
  smoke(g, X - 1.0, 1.9, 0.7, { n: 7, rise: 1.3, size: 0.45, alpha: 0.2, spread: 0.3 });
  const board = canvasTex(512, 640, (ctx, w, h) => {
    ctx.fillStyle = C.wood;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = hsl(150, 0.15, 0.13);
    ctx.fillRect(20, 20, w - 40, h - 40);
    ctx.fillStyle = '#f4f1e8';
    ctx.textAlign = 'center';
    ctx.font = `800 64px ${FONT}`;
    ctx.fillText('CAFÉ', w / 2, 100);
    ctx.font = `500 38px ${FONT}`;
    ['Cortado ........ $', 'Lágrima ........ $', 'Submarino ...... $', 'Medialunas x3 . $', 'Tostado J y Q . $', 'Exprimido ....... $'].forEach((t, i) => ctx.fillText(t, w / 2, 180 + i * 72));
    noise(ctx, w, h, 12);
  });
  onWall(g, plate(board, 1.2, 1.5, { transparent: false }), 'right', -0.4, 2.5, 0.04);
  onWall(g, plate(label('CAFÉ · CONFITERÍA', { w: 1024, h: 128, fg: C.wood, size: 70, font: 'Georgia, serif' }), 4.8, 0.6), 'front', 0, 4.1, 0.04);
  wallClock(g, 0, 0, 0, 0, { size: 0.8, rim: C.wood });
  onWall(g, g.children.at(-1), 'right', 2.4, 2.7, 0.04);
  onWall(g, plate(pictureTex('bandoneon', hsl(40, 0.3, 0.88), hsl(25, 0.4, 0.2), C.wood), 0.85, 1.12, { transparent: false }), 'back', -3.4, 2.3, 0.04);
  onWall(g, plate(pictureTex('tango', hsl(10, 0.5, 0.5), hsl(20, 0.4, 0.12), C.wood), 0.85, 1.12, { transparent: false }), 'back', 3.4, 2.3, 0.04);

  // mesitas de mármol con sillas de Viena, café y el diario
  const iron = toon(hsl(0, 0, 0.12));
  const viena = toon(hsl(22, 0.5, 0.2));
  const paper = canvasTex(128, 160, (ctx, w, h) => {
    ctx.fillStyle = '#ece8dc';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#222';
    ctx.fillRect(10, 10, w - 20, 16);
    for (let y = 36; y < h - 8; y += 8) ctx.fillRect(10 + (y % 3) * 2, y, w - 24 - (y % 5) * 6, 3);
  });
  for (const [x, z] of [[-3.6, -3.2], [0, -3.8], [3.4, -3.4], [-4.2, 0.2], [-4.4, 3.4], [4.4, 4.4]]) {
    sideTable(g, x, z, toon(C.marble), iron, { r: 0.34, items: (tx, ty, tz) => {
      cup(g, tx + 0.08, ty, tz + 0.05);
      if (r() < 0.6) cup(g, tx - 0.12, ty, tz - 0.06);
      if (r() < 0.4) {
        const p = plate(paper, 0.22, 0.28, { transparent: false });
        p.rotation.set(-Math.PI / 2, 0, r());
        p.position.set(tx - 0.05, ty + 0.002, tz + 0.12);
        g.add(p);
      }
    } });
    chair(g, x + 0.52, z, -Math.PI / 2, viena, { kind: 'viena' });
    chair(g, x - 0.52, z, Math.PI / 2, viena, { kind: 'viena' });
  }
  for (const [x, z] of [[-5.3, -5.3], [-5.3, 5.3], [5.3, 5.3]]) pottedPlant(g, x, z, { kind: 'palm', h: 1.5, leaves: hsl(120, 0.4, 0.3), pot: hsl(15, 0.45, 0.45), r });
  dust(g, { color: '#fffaf0', radius: 2.4, y0: 0.6, y1: 3 });
  return { background: hsl(40, 0.3, 0.85), fog: [hsl(40, 0.3, 0.86), 10, 24] };
}

// ------------------------------------------------------------------ parrilla de barrio

// Parrilla de barrio de noche: la parrilla grande de ladrillo con la campana tiznada, las brasas que laten, el fuego
// del brasero, el humo y las achuras chisporroteando; azulejos blancos, banderines, la tele con el partido, la
// heladera con bebidas iluminada, manteles a cuadros con el vino y el sifón, y la ventana a la vereda.
export function parrilla(g) {
  const C = {
    tile: hsl(40, 0.2, 0.9), grout: hsl(30, 0.1, 0.7), wall: hsl(36, 0.5, 0.62), lower: hsl(5, 0.5, 0.32),
    floor: [hsl(12, 0.5, 0.36), hsl(14, 0.5, 0.4)], iron: hsl(0, 0, 0.1), wood: hsl(25, 0.45, 0.25),
  };
  const wall = (holes = []) => ({
    tex: wallTex({ top: C.wall, bottom: C.lower, dado: 1.5, trim: hsl(0, 0, 0.15), shade: 0.3, paint: (ctx, w, hh, yAt) => {
      // azulejos blancos hasta 1.5 m y una guarda de color
      const s = 48;
      for (let y = yAt(1.5); y < hh; y += s) for (let x = 0; x < w; x += s) {
        ctx.fillStyle = C.tile;
        ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
      }
      ctx.fillStyle = hsl(210, 0.6, 0.4);
      for (let x = 0; x < w; x += s) ctx.fillRect(x + 2, yAt(1.5) + 2, s - 4, s - 4);
      // fotos viejas y un almanaque
      const r = seeded(33);
      for (let x = 120; x < w - 100; x += 300 + r() * 200) {
        const y = yAt(2.6 + r() * 0.5);
        ctx.fillStyle = hsl(30, 0.3, 0.2);
        ctx.fillRect(x - 6, y - 6, 92, 122);
        ctx.fillStyle = hsl(35, 0.25, 0.6 + r() * 0.15);
        ctx.fillRect(x, y, 80, 110);
        ctx.fillStyle = 'rgba(60,40,20,0.35)';
        ctx.beginPath();
        ctx.arc(x + 40, y + 45, 20, 0, Math.PI * 2);
        ctx.fillRect(x + 18, y + 64, 44, 46);
        ctx.fill();
      }
    } }),
    holes,
    frame: toon(hsl(0, 0, 0.15)),
  });
  hall(g, {
    walls: { front: wall(), right: wall([{ x: -1.8, y: 0.9, w: 2.4, h: 1.8 }, { x: 2.4, y: 0, w: 1.4, h: 2.6 }]), back: wall(), left: wall() },
    floorTex: checkerTex(C.floor[0], C.floor[1], { n: 10, repeat: 8, grout: 'rgba(40,10,0,0.35)' }),
    ceil: canvasTex(256, 256, (ctx, w, h) => {
      // machimbre de madera
      ctx.fillStyle = hsl(28, 0.45, 0.3);
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 16) {
        ctx.fillStyle = x % 32 ? hsl(28, 0.45, 0.34) : hsl(26, 0.45, 0.26);
        ctx.fillRect(x, 0, 14, h);
      }
    }),
    tint: '#c8b8a4',
  });
  streetOutside(g, { d: X, side: [1, 0], night: true, seed: 21 });

  g.add(new THREE.HemisphereLight(hsl(40, 0.4, 0.85), hsl(10, 0.4, 0.2), 1.0));
  tableLight(g, { color: '#fff0d8', intensity: 7 });
  put(g, new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.26, 32, 1, true), toon(hsl(0, 0, 0.9), { side: THREE.DoubleSide })), 0, 2.62, 0);
  bulb(g, 0, 2.55, 0, { color: '#fffaf0', size: 0.07 });
  put(g, cyl(0.005, 0.005, 1.7, basic('#0a0a0a'), 4, false), 0, 3.5, 0);
  stringLights(g, [-X + 0.2, 3.9, -2], [X - 0.2, 3.9, -2], { n: 18, sag: 0.35 });
  stringLights(g, [-X + 0.2, 3.9, 2.5], [X - 0.2, 3.9, 2.5], { n: 18, sag: 0.35 });

  // la parrilla: base, fogonero con fuego, la reja con achuras, la campana tiznada y la chimenea
  const bm = toon(null, { map: brickTex({ soot: 0.0 }) });
  const sooty = toon(null, { map: brickTex({ soot: 0.75, seed: 8 }) });
  const zb = -Z + 0.7;
  put(g, box(4.6, 0.9, 1.2, bm), 0, 0.45, zb);
  put(g, box(4.8, 0.1, 1.3, toon(hsl(20, 0.2, 0.3))), 0, 0.95, zb);
  for (const x of [-2.2, 2.2]) put(g, box(0.35, 1.5, 1.2, bm), x, 1.75, zb);
  put(g, box(4.8, 1.3, 1.4, sooty), 0, 3.15, zb + 0.05);
  put(g, box(1.2, 1.2, 0.9, sooty), 0, 4.0, zb - 0.1);
  // el fondo del hogar, tiznado y con el resplandor de las brasas
  const hearth = plate(canvasTex(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#140804';
    ctx.fillRect(0, 0, w, h);
    const gr = ctx.createRadialGradient(w / 2, h, 4, w / 2, h, w * 0.6);
    gr.addColorStop(0, 'rgba(255,140,40,0.95)');
    gr.addColorStop(0.5, 'rgba(160,50,10,0.6)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
  }), 4.1, 1.6, { transparent: false });
  put(g, hearth, 0, 1.8, zb - 0.55);
  embers(g, 0.3, 1.0, zb + 0.05, 3.2, 0.9, { light: 3 });
  // el brasero de la izquierda, con fuego vivo
  const brasero = box(0.7, 0.4, 0.7, toon(C.iron));
  put(g, brasero, -1.5, 1.2, zb);
  fire(g, -1.5, 1.42, zb, { size: 0.55, light: 2.2 });
  // la reja y lo que se está asando
  const grill = new THREE.Group();
  for (let i = 0; i < 26; i++) put(grill, box(0.012, 0.012, 0.95, toon('#2a2a2a'), false), -1.4 + i * 0.12, 0, 0);
  put(grill, box(3.2, 0.03, 0.03, toon('#2a2a2a'), false), 0.1, 0, -0.47);
  put(grill, box(3.2, 0.03, 0.03, toon('#2a2a2a'), false), 0.1, 0, 0.47);
  put(g, grill, 0.4, 1.28, zb);
  const meat = toon(hsl(12, 0.55, 0.28));
  const chori = toon(hsl(8, 0.55, 0.35));
  const morci = toon(hsl(350, 0.35, 0.12));
  for (let i = 0; i < 4; i++) put(g, box(0.5, 0.05, 0.22, meat), -0.6 + i * 0.55, 1.32, zb - 0.2 + (i % 2) * 0.1);
  for (let i = 0; i < 6; i++) {
    const c = cyl(0.035, 0.035, 0.24, i % 3 === 2 ? morci : chori, 10);
    c.rotation.x = Math.PI / 2;
    put(g, c, -0.5 + i * 0.3, 1.33, zb + 0.28);
  }
  smoke(g, 0.4, 1.5, zb, { n: 10, rise: 1.7, size: 0.7, alpha: 0.22, spread: 0.7, color: 'rgba(200,200,200,0.6)', period: 3600 });
  // herramientas colgando y la tabla de achuras
  for (let i = 0; i < 4; i++) {
    put(g, cyl(0.01, 0.01, 0.6, toon('#555'), 6, false), 2.0 + i * 0.12, 2.0, zb - 0.55);
    put(g, box(0.06, 0.12, 0.01, toon('#444'), false), 2.0 + i * 0.12, 1.7, zb - 0.55);
  }
  // la tele en la esquina con el partido (la cancha y los jugadores que se mueven)
  const tv = canvasTex(320, 180, (ctx, w, h) => {
    ctx.fillStyle = hsl(110, 0.55, 0.32);
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 40) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x, 0, 20, h);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.beginPath();
    ctx.moveTo(w / 2, 10);
    ctx.lineTo(w / 2, h - 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 28, 0, Math.PI * 2);
    ctx.stroke();
  });
  const tvg = new THREE.Group();
  put(tvg, box(1.3, 0.78, 0.1, toon('#111')), 0, 0, -0.05);
  const screen = plate(tv, 1.2, 0.68, { transparent: false });
  put(tvg, screen, 0, 0, 0.005);
  const players = [];
  for (let i = 0; i < 10; i++) {
    const p = ball(0.018, basic(i < 5 ? '#d8f0ff' : '#ff3b2f'), 6);
    put(tvg, p, 0, 0, 0.02);
    players.push([p, i * 1.3]);
  }
  const pelota = ball(0.012, basic('#ffffff'), 6);
  put(tvg, pelota, 0, 0, 0.022);
  tvg.position.set(-X + 0.9, 3.0, -Z + 0.9);
  tvg.rotation.y = Math.PI / 4;
  g.add(tvg);
  const tvLight = new THREE.PointLight('#9fd0ff', 0.8, 4, 1.6);
  tvLight.position.set(-X + 1.4, 2.9, -Z + 1.4);
  g.add(tvLight);
  tick(g, (now) => {
    const t = now / 1000;
    const bx = Math.sin(t * 0.7) * 0.45;
    const by = Math.sin(t * 1.1) * 0.2;
    pelota.position.set(bx, by, 0.022);
    for (const [p, ph] of players) p.position.set(bx * 0.6 + Math.sin(t * 0.5 + ph) * 0.35, by * 0.5 + Math.cos(t * 0.6 + ph * 1.7) * 0.22, 0.02);
    tvLight.intensity = 0.7 + Math.sin(t * 5) * 0.12;
  });
  // banderines de colores (de ningún club en especial)
  const pennants = canvasTex(2048, 128, (ctx, w) => {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(w, 10);
    ctx.stroke();
    for (let x = 0, i = 0; x < w; x += 70, i++) {
      ctx.fillStyle = [hsl(210, 0.7, 0.45), '#f5f5f5', hsl(48, 0.95, 0.55), hsl(2, 0.7, 0.5), hsl(140, 0.5, 0.4)][i % 5];
      ctx.beginPath();
      ctx.moveTo(x + 4, 10);
      ctx.lineTo(x + 66, 10);
      ctx.lineTo(x + 35, 118);
      ctx.closePath();
      ctx.fill();
    }
  });
  for (const w of ['left', 'back']) onWall(g, plate(pennants, 11.5, 0.6), w, 0, 3.75, 0.05);
  // el menú y la heladera de bebidas iluminada
  const menu = canvasTex(640, 820, (ctx, w, h) => {
    ctx.fillStyle = C.wood;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = hsl(150, 0.12, 0.12);
    ctx.fillRect(22, 22, w - 44, h - 44);
    ctx.fillStyle = '#f2efe6';
    ctx.textAlign = 'center';
    ctx.font = `800 70px ${FONT}`;
    ctx.fillText('PARRILLA', w / 2, 110);
    ctx.font = `500 42px ${FONT}`;
    ['Vacío', 'Asado de tira', 'Entraña', 'Chori al pan', 'Morcilla', 'Mollejas', 'Provoleta', 'Papas fritas', 'Flan mixto'].forEach((t, i) => ctx.fillText(t, w / 2, 190 + i * 66));
    noise(ctx, w, h, 12);
  });
  onWall(g, plate(menu, 1.4, 1.8, { transparent: false }), 'left', -2.2, 2.4, 0.04);
  const fridge = new THREE.Group();
  put(fridge, box(1.0, 2.0, 0.7, toon(hsl(0, 0, 0.85))), 0, 1.0, 0);
  const inside = canvasTex(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#eaf6ff';
    ctx.fillRect(0, 0, w, h);
    const rr = seeded(4);
    for (const y of [130, 260, 390, 500]) {
      ctx.fillStyle = '#9fb7c4';
      ctx.fillRect(0, y, w, 8);
      for (let x = 12; x < w - 20; x += 30) {
        ctx.fillStyle = [hsl(0, 0.85, 0.42), hsl(120, 0.6, 0.35), hsl(40, 0.9, 0.5), hsl(210, 0.7, 0.4), '#2a1a10'][Math.floor(rr() * 5)];
        ctx.fillRect(x, y - 90, 22, 90);
      }
    }
  });
  put(fridge, plate(inside, 0.86, 1.8, { transparent: false }), 0, 1.0, 0.36);
  put(fridge, glowSprite('rgba(200,235,255,1)', 1.8, 0.25), 0, 1.0, 0.5);
  onWall(g, fridge, 'back', -4.6, 0, 0.4);
  // mesas con mantel a cuadros, vino, sifón y la panera
  const cloth = toon(null, { map: checkerTex(hsl(2, 0.7, 0.45), '#f4f1ea', { n: 8, repeat: 1 }) });
  const r = seeded(9);
  for (const [x, z] of [[-3.8, -1.6], [3.4, -2.2], [-3.8, 2.0], [-5.0, 4.8], [4.8, 4.8], [3.6, 1.6]]) {
    const t = box(1.0, 0.04, 0.8, cloth);
    put(g, t, x, 0.76, z);
    for (const [lx, lz] of [[-0.42, -0.32], [0.42, -0.32], [-0.42, 0.32], [0.42, 0.32]]) put(g, box(0.04, 0.74, 0.04, toon(C.wood)), x + lx, 0.37, z + lz);
    chair(g, x, z + 0.6, 0, toon(C.wood));
    chair(g, x, z - 0.6, Math.PI, toon(C.wood));
    put(g, cyl(0.04, 0.045, 0.3, toon(hsl(140, 0.4, 0.15)), 10), x - 0.2, 0.93, z);
    const sif = cyl(0.05, 0.05, 0.28, new THREE.MeshBasicMaterial({ color: '#bfe0ea', transparent: true, opacity: 0.6 }), 12, false);
    put(g, sif, x + 0.22, 0.92, z - 0.1);
    put(g, cyl(0.025, 0.035, 0.08, toon('#9aa'), 8, false), x + 0.22, 1.1, z - 0.1);
    glassware(g, x + 0.05, 0.78, z + 0.2, { wine: '#5a0c16', kind: 'vaso' });
    if (r() < 0.5) glassware(g, x - 0.1, 0.78, z - 0.25, { wine: '#5a0c16', kind: 'vaso' });
  }
  ceilingFan(g, 3, 4.05, 0, { mat: toon('#333'), speed: 2 });
  dust(g, { color: '#fff1dc', radius: 1.4 });
  return { background: hsl(30, 0.3, 0.1), fog: [hsl(25, 0.25, 0.14), 9, 22] };
}

// ------------------------------------------------------------------ club de barrio

// Club de barrio a la tarde: el gimnasio con el piso de parqué y las líneas de la cancha, el aro de básquet, las
// gradas de madera, el tablero, los ventanales altos con el sol que entra, los tubos que titilan, el metegol, la mesa
// de ping-pong, la cantina, los trofeos y los banderines del club.
export function club(g) {
  const C = {
    sky: hsl(200, 0.55, 0.78), blue: hsl(215, 0.6, 0.32), yellow: hsl(48, 0.95, 0.55), floor: [hsl(32, 0.55, 0.52), hsl(30, 0.55, 0.47), hsl(34, 0.5, 0.56)],
    steel: hsl(210, 0.08, 0.35), wood: hsl(28, 0.5, 0.35),
  };
  const HH = 5.6; // el gimnasio es más alto
  const wall = (holes = []) => ({
    tex: wallTex({ h: HH, top: C.sky, bottom: C.blue, dado: 1.6, trim: C.yellow, shade: 0.1, paint: (ctx, w, hh, yAt) => {
      // franja del club
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, yAt(2.1), w, yAt(1.8) - yAt(2.1));
      ctx.fillStyle = C.blue;
      ctx.fillRect(0, yAt(2.0), w, 6);
    } }),
    holes,
    frame: toon(hsl(0, 0, 0.9)),
    frameOpts: { bars: 3, rails: 1 },
    glass: 0.08,
  });
  const high = [-4, -1.35, 1.35, 4].map((x) => ({ x, y: 3.2, w: 2.2, h: 1.6 }));
  // las paredes (más altas que el salón común)
  const at = { front: [0, -Z, 0, X * 2], right: [X, 0, -Math.PI / 2, Z * 2], back: [0, Z, Math.PI, X * 2], left: [-X, 0, Math.PI / 2, Z * 2] };
  const walls = { front: wall(), right: wall(high), back: wall([{ x: 0, y: 0, w: 2.2, h: 2.6 }]), left: wall(high) };
  for (const [k, w] of Object.entries(walls)) {
    const [x, z, ry, width] = at[k];
    const m = holedWall(w.tex, width, HH, w.holes);
    m.position.set(x, 0, z);
    m.rotation.y = ry;
    g.add(m);
    for (const hole of w.holes) {
      const f = windowFrame(hole, w.frame, w.frameOpts);
      f.position.set(x, 0, z);
      f.rotation.y = ry;
      g.add(f);
    }
  }
  const court = canvasTex(1024, 1024, (ctx, w, h) => {
    const r = seeded(4);
    // parqué en tiras
    for (let y = 0; y < h; y += 24) {
      let x = -r() * 120;
      while (x < w) {
        const len = 120 + r() * 160;
        ctx.fillStyle = C.floor[Math.floor(r() * 3)];
        ctx.fillRect(x, y, len, 24);
        ctx.fillStyle = 'rgba(60,30,10,0.35)';
        ctx.fillRect(x, y, 2, 24);
        x += len;
      }
      ctx.fillStyle = 'rgba(60,30,10,0.35)';
      ctx.fillRect(0, y, w, 2);
    }
    // líneas de la cancha
    ctx.strokeStyle = '#f7f7f7';
    ctx.lineWidth = 9;
    ctx.strokeRect(70, 70, w - 140, h - 140);
    ctx.beginPath();
    ctx.moveTo(70, h / 2);
    ctx.lineTo(w - 70, h / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 120, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(30,60,140,0.35)';
    ctx.fillRect(w / 2 - 120, 70, 240, 260);
    ctx.fillRect(w / 2 - 120, h - 330, 240, 260);
    ctx.strokeRect(w / 2 - 120, 70, 240, 260);
    ctx.strokeRect(w / 2 - 120, h - 330, 240, 260);
    ctx.beginPath();
    ctx.arc(w / 2, 70, 330, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h - 70, 330, Math.PI, 0);
    ctx.stroke();
    const gl = ctx.createLinearGradient(0, 0, w, h);
    gl.addColorStop(0.35, 'rgba(255,255,255,0)');
    gl.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    gl.addColorStop(0.65, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 6);
  });
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(X * 2, Z * 2), toon(null, { map: court }));
  fl.rotation.x = -Math.PI / 2;
  fl.receiveShadow = true;
  g.add(fl);
  // techo de chapa con cabriadas de hierro
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(X * 2, Z * 2), basic('#ffffff', { map: canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = hsl(210, 0.08, 0.55);
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      ctx.fillStyle = x % 32 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
      ctx.fillRect(x, 0, 8, h);
    }
  }) }));
  roof.rotation.x = Math.PI / 2;
  roof.position.y = HH;
  g.add(roof);
  const steel = toon(C.steel);
  for (const z of [-4, -1.3, 1.4, 4.1]) {
    put(g, box(X * 2, 0.12, 0.1, steel, false), 0, HH - 0.6, z);
    put(g, box(X * 2, 0.08, 0.08, steel, false), 0, HH - 0.08, z);
    for (let i = -5; i <= 5; i++) {
      const d = box(0.05, 0.75, 0.05, steel, false);
      d.rotation.z = i % 2 ? 0.6 : -0.6;
      put(g, d, i * 1.1, HH - 0.33, z);
    }
  }
  // tubos fluorescentes que titilan, y el sol por las ventanas
  g.add(new THREE.HemisphereLight('#ffffff', hsl(30, 0.3, 0.4), 1.35));
  tableLight(g, { color: '#f4f8ff', intensity: 6, y: 2.6 });
  put(g, new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.26, 32, 1, true), toon(hsl(0, 0, 0.85), { side: THREE.DoubleSide })), 0, 2.67, 0);
  bulb(g, 0, 2.6, 0, { color: '#ffffff', size: 0.07 });
  put(g, cyl(0.005, 0.005, HH - 2.6, basic('#0a0a0a'), 4, false), 0, (HH + 2.67) / 2, 0);
  const tubes = [];
  for (const x of [-3.2, 3.2]) for (const z of [-3.2, 0, 3.2]) {
    put(g, box(1.3, 0.05, 0.14, toon('#ddd'), false), x, HH - 0.75, z);
    const tube = box(1.2, 0.04, 0.05, basic('#f4fbff', { transparent: true }), false);
    put(g, tube, x, HH - 0.79, z);
    const h = glowSprite('rgba(230,245,255,1)', 1.6, 0.35);
    put(g, h, x, HH - 0.82, z);
    tubes.push(h);
  }
  flicker(g, tubes, { base: 1, amp: 0.05, speed: 0.6, glitch: 0.03 });
  const sunIn = new THREE.DirectionalLight('#fff0d0', 0.8);
  sunIn.position.set(8, 7, -2);
  g.add(sunIn);
  for (const z of [-4, -1.35, 1.35, 4]) lightShaft(g, [X, 4.4, z], [X - 4, 0, z - 0.6], { w: 1.8, alpha: 0.07 });
  // afuera por las ventanas: cielo de la tarde y copas de árboles (se ven arriba)
  for (const sx of [-1, 1]) {
    const out = plate(canvasTex(1024, 256, (ctx, w, h) => {
      const gr = ctx.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, hsl(205, 0.6, 0.62));
      gr.addColorStop(1, hsl(40, 0.6, 0.85));
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, w, h);
      const r = seeded(sx + 5);
      ctx.fillStyle = hsl(110, 0.35, 0.32);
      for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        ctx.arc(r() * w, h * 0.85 + r() * 40, 30 + r() * 40, 0, Math.PI * 2);
        ctx.fill();
      }
    }), Z * 2 + 4, 3, { transparent: false });
    out.position.set(sx * (X + 1.5), 4, 0);
    out.rotation.y = -sx * Math.PI / 2;
    out.material.fog = false;
    g.add(out);
  }

  // el aro de básquet en la pared de enfrente, con el tablero de puntos
  const hoop = new THREE.Group();
  put(hoop, box(1.8, 1.05, 0.05, toon('#f7f7f7')), 0, 3.4, 0.6);
  const boardTex = canvasTex(360, 210, (ctx, w, h) => {
    ctx.fillStyle = '#fbfbfb';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d23a2a';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.strokeRect(w / 2 - 60, h - 110, 120, 90);
  });
  put(hoop, plate(boardTex, 1.76, 1.02, { transparent: false }), 0, 3.4, 0.63);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.015, 8, 24), toon(hsl(15, 0.9, 0.5)));
  ring.rotation.x = Math.PI / 2;
  put(hoop, ring, 0, 3.05, 0.9);
  const net = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.14, 0.4, 12, 3, true), new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.6 }));
  put(hoop, net, 0, 2.85, 0.9);
  put(hoop, box(0.15, 0.15, 0.6, steel), 0, 3.4, 0.3);
  hoop.position.z = -Z;
  g.add(hoop);
  const score = canvasTex(512, 200, (ctx, w, h) => {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ff3b2f';
    ctx.font = `800 96px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('15', w * 0.22, h * 0.55);
    ctx.fillText('29', w * 0.78, h * 0.55);
    ctx.fillStyle = '#ffd23a';
    ctx.font = `700 40px ${FONT}`;
    ctx.fillText('LOCAL   VISITA', w / 2, 30);
    ctx.fillText('4°', w / 2, h * 0.6);
  });
  onWall(g, plate(score, 1.6, 0.62, { transparent: false }), 'front', 3.4, 4.6, 0.05);
  // escudo y nombre del club
  const crest = canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = C.blue;
    ctx.beginPath();
    ctx.moveTo(w * 0.15, h * 0.08);
    ctx.lineTo(w * 0.85, h * 0.08);
    ctx.lineTo(w * 0.85, h * 0.55);
    ctx.quadraticCurveTo(w * 0.85, h * 0.85, w / 2, h * 0.95);
    ctx.quadraticCurveTo(w * 0.15, h * 0.85, w * 0.15, h * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C.yellow;
    ctx.fillRect(w * 0.15, h * 0.32, w * 0.7, h * 0.12);
    ctx.font = `800 150px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('T', w / 2, h * 0.68);
  });
  onWall(g, plate(crest, 1.3, 1.3), 'front', -3.4, 4.4, 0.05);
  onWall(g, plate(label('CLUB SOCIAL Y DEPORTIVO TRUKEADOS', { w: 2048, h: 128, fg: C.blue, size: 62 }), 7, 0.44), 'back', 0, 3.2, 0.05);
  // gradas de madera a la izquierda (contra la pared)
  const plank = toon(C.wood);
  for (let s = 0; s < 4; s++) {
    put(g, box(0.5, 0.06, 7, plank), -X + 0.4 + s * 0.5, 0.35 + s * 0.42, -1);
    put(g, box(0.5, 0.05, 7, toon(C.wood)), -X + 0.4 + s * 0.5, 0.06 + s * 0.42, -1); // el escalón de abajo
    for (let k = -3; k <= 3; k++) put(g, box(0.05, 0.35 + s * 0.42, 0.05, toon(C.steel), false), -X + 0.18 + s * 0.5, (0.35 + s * 0.42) / 2, -1 + k * 1.15);
  }
  // metegol y ping-pong (del lado de atrás, contra las esquinas) y la cantina
  const mete = new THREE.Group();
  put(mete, box(1.3, 0.25, 0.75, toon(hsl(140, 0.5, 0.3))), 0, 0.85, 0);
  for (let i = 0; i < 4; i++) {
    const rod = cyl(0.01, 0.01, 1.1, toon('#ccc'), 6, false);
    rod.rotation.x = Math.PI / 2;
    put(mete, rod, -0.45 + i * 0.3, 0.98, 0);
    for (let k = 0; k < 3; k++) put(mete, box(0.04, 0.12, 0.04, toon(i % 2 ? hsl(0, 0.8, 0.5) : hsl(210, 0.8, 0.5)), false), -0.45 + i * 0.3, 0.95, -0.22 + k * 0.22);
  }
  for (const [lx, lz] of [[-0.55, -0.3], [0.55, -0.3], [-0.55, 0.3], [0.55, 0.3]]) put(mete, box(0.06, 0.75, 0.06, toon('#222')), lx, 0.37, lz);
  put(g, mete, 4.6, 0, 4.4, 0.3);
  const ping = new THREE.Group();
  put(ping, box(1.5, 0.04, 2.7, toon(hsl(150, 0.55, 0.25))), 0, 0.76, 0);
  put(ping, box(1.6, 0.15, 0.02, new THREE.MeshBasicMaterial({ color: '#eee', transparent: true, opacity: 0.6 }), false), 0, 0.85, 0);
  for (const [lx, lz] of [[-0.6, -1.1], [0.6, -1.1], [-0.6, 1.1], [0.6, 1.1]]) put(ping, box(0.05, 0.74, 0.05, toon('#222')), lx, 0.37, lz);
  put(g, ping, 4.4, 0, -2.2);
  const pelotita = ball(0.02, basic('#ffffff'), 8);
  g.add(pelotita);
  tick(g, (now) => {
    const t = (now / 900) % 2;
    const k = t < 1 ? t : 2 - t;
    pelotita.position.set(4.4 + Math.sin(now / 1300) * 0.3, 0.8 + Math.abs(Math.sin(k * Math.PI * 2)) * 0.3, -2.2 - 1.2 + k * 2.4);
  });
  // cantina con su cartel y las sillas de plástico apiladas
  const cant = new THREE.Group();
  put(cant, box(2.6, 1.0, 0.6, toon(hsl(0, 0, 0.92))), 0, 0.5, 0);
  put(cant, box(2.7, 0.05, 0.7, toon(C.wood)), 0, 1.02, 0);
  put(cant, plate(label('CANTINA', { w: 512, h: 128, bg: C.yellow, fg: C.blue, size: 84 }), 1.6, 0.4, { transparent: false }), 0, 2.4, -0.28);
  for (let i = 0; i < 5; i++) glassware(cant, -0.9 + i * 0.4, 1.05, 0, { kind: 'vaso', wine: i % 2 ? '#2a1a0a' : '#f0a020' });
  onWall(g, cant, 'right', 4.2, 0, 0.35);
  const plastic = toon(hsl(0, 0, 0.92));
  for (let i = 0; i < 6; i++) chair(g, -4.9, 4.9, 0.5, plastic).position.y = i * 0.07;
  // trofeos en una vitrina
  const cupMat = toon(hsl(45, 0.75, 0.55));
  for (const y of [1.3, 1.85]) {
    put(g, box(1.6, 0.05, 0.35, toon(C.wood)), -2.6, y, Z - 0.25);
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.06, 0], [0.02, 0.05], [0.02, 0.12], [0.08, 0.2], [0.09, 0.3], [0, 0.3]].map(([x, yy]) => new THREE.Vector2(x, yy)), 16), cupMat);
      put(g, t, -3.2 + i * 0.4, y + 0.03, Z - 0.25);
    }
  }
  // pelota de básquet en el piso, banderines cruzados
  put(g, ball(0.12, toon(hsl(20, 0.8, 0.45)), 16), -4.6, 0.12, -4.4);
  const flags = canvasTex(2048, 128, (ctx, w) => {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(w, 10);
    ctx.stroke();
    for (let x = 0, i = 0; x < w; x += 64, i++) {
      ctx.fillStyle = [C.blue, '#f5f5f5', C.yellow][i % 3];
      ctx.beginPath();
      ctx.moveTo(x + 4, 10);
      ctx.lineTo(x + 60, 10);
      ctx.lineTo(x + 32, 110);
      ctx.closePath();
      ctx.fill();
    }
  });
  for (const z of [-2.6, 2.6]) {
    const f = plate(flags, X * 2, 0.6);
    f.material.side = THREE.DoubleSide;
    put(g, f, 0, 4.3, z);
  }
  dust(g, { color: '#fff8e8', radius: 2.2, y0: 1, y1: 4 });
  return { background: hsl(205, 0.4, 0.7), fog: [hsl(205, 0.25, 0.75), 11, 26] };
}
