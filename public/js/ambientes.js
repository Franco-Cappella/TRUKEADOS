// Ambientes de la partida (uno por partida, lo elige el servidor: AMBIENTES en config.js). Lugares argentinos
// dibujados en blanco y negro, cada uno con un tono apenas distinto: lo único con color fuerte en la mesa son las
// cartas y los personajes. Cada ambiente arma su grupo (paredes o cielo, piso, muebles de fondo y luces) alrededor
// de la mesa, que está en el centro (radio < 1.3 m, altura TABLE_Y). Todo se pinta en canvas (draw3d.js).
import * as THREE from 'three';
import { canvasTex, noise, seeded, toon } from './draw3d.js';
import { FONT } from './theme.js';

// Gris con un tono: l de 0 a 1, h (0-360) y s (0-1) chiquita.
const gray = (l, h = 30, s = 0.06) => `#${new THREE.Color().setHSL(h / 360, s, l).getHexString()}`;
const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });

const ROOM = 5;
const WALL_H = 4.2;

// ------------------------------------------------------------------ piezas comunes
function walls(g, tex, { size = ROOM, height = WALL_H } = {}) {
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size * 2, height), mat);
    m.position.set(Math.sin(a) * size, height / 2, Math.cos(a) * size);
    m.rotation.y = a + Math.PI;
    g.add(m);
  }
}

function floor(g, tex, size = ROOM) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size * 2, size * 2), toon(null, { map: tex }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

function ceiling(g, color, height = WALL_H) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ROOM * 2, ROOM * 2), basic(color));
  m.rotation.x = Math.PI / 2;
  m.position.y = height;
  g.add(m);
}

// Cuadro, cartel o ventana pegado a una pared: wall 0 = enfrente (-z), 1 = derecha (+x), 2 = atrás, 3 = izquierda.
function onWall(g, tex, w, h, { wall = 0, x = 0, y = 2, size = ROOM, mat = null } = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat || new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  const d = size - 0.03;
  const at = [[x, -d, 0], [d, -x, -Math.PI / 2], [-x, d, Math.PI], [-d, x, Math.PI / 2]][wall];
  m.position.set(at[0], y, at[1]);
  m.rotation.y = at[2];
  g.add(m);
  return m;
}

// Lámpara colgante con su luz (cono) sobre la mesa.
function pendant(g, { shade, bulb, light, intensity = 7.5, softness = 0.5, y = 2.62, kind = 'cone' }) {
  const lamp = new THREE.SpotLight(light, intensity, 7, Math.PI / 3.2, softness, 1.6);
  lamp.position.set(0, y - 0.07, 0);
  lamp.target.position.set(0, 0, 0);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(2048, 2048);
  lamp.shadow.bias = -0.0004;
  g.add(lamp, lamp.target);
  const geo = kind === 'globe' ? new THREE.SphereGeometry(0.2, 24, 16) : new THREE.ConeGeometry(0.34, 0.26, 32, 1, true);
  const s = new THREE.Mesh(geo, kind === 'globe' ? basic(bulb, { transparent: true, opacity: 0.92 }) : toon(shade, { side: THREE.DoubleSide }));
  s.position.set(0, y, 0);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), basic(bulb));
  b.position.set(0, y - 0.07, 0);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.6), basic('#0a0a0a'));
  cord.position.set(0, y + 0.8, 0);
  g.add(s, b, cord);
}

function hemi(g, sky, ground, k = 1.25) {
  g.add(new THREE.HemisphereLight(sky, ground, k));
}

// Sol (afuera): luz direccional con sombra sobre la mesa.
function sun(g, color, intensity, dir = [3, 6, 2]) {
  const l = new THREE.DirectionalLight(color, intensity);
  l.position.set(...dir);
  l.target.position.set(0, 0, 0);
  l.castShadow = true;
  l.shadow.mapSize.set(2048, 2048);
  l.shadow.bias = -0.0005;
  const c = l.shadow.camera;
  c.left = c.bottom = -3;
  c.right = c.top = 3;
  c.near = 0.5;
  c.far = 20;
  g.add(l, l.target);
}

// Cielo: una esfera grande con degradé (y estrellas, de noche).
function skyDome(g, stops, { stars = 0, seed = 3 } = {}) {
  const tex = canvasTex(64, 512, (ctx, w, h) => {
    const gr = ctx.createLinearGradient(0, 0, 0, h);
    stops.forEach(([at, c]) => gr.addColorStop(at, c));
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }));
  g.add(dome);
  if (stars) {
    const r = seeded(seed);
    const pts = [];
    for (let i = 0; i < stars; i++) {
      const a = r() * Math.PI * 2;
      const e = 0.15 + r() * 1.3;
      pts.push(Math.cos(a) * Math.cos(e) * 38, Math.sin(e) * 38, Math.sin(a) * Math.cos(e) * 38);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: '#f2f2f2', size: 0.12, fog: false })));
  }
}

const box = (w, h, d, mat) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const cyl = (r0, r1, h, mat, seg = 16) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat);
  m.castShadow = true;
  return m;
};

// Árbol de copa redonda (tilo, plátano): tronco y tres o cuatro bochas.
function tree(g, x, z, { h = 3.2, crown = 1.2, trunk, leaves, r }) {
  const t = cyl(0.09, 0.14, h * 0.55, toon(trunk));
  t.position.set(x, h * 0.275, z);
  g.add(t);
  const n = 3 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(crown * (0.6 + r() * 0.35), 1), toon(leaves, { flatShading: true }));
    s.position.set(x + (r() - 0.5) * crown, h * 0.62 + r() * crown * 0.7, z + (r() - 0.5) * crown);
    s.castShadow = true;
    g.add(s);
  }
}

// Silla de bar de fondo (las de los jugadores las pone la escena).
function chair(g, x, z, rot, mat) {
  const c = new THREE.Group();
  const seat = box(0.42, 0.04, 0.4, mat);
  seat.position.y = 0.46;
  const back = box(0.42, 0.5, 0.04, mat);
  back.position.set(0, 0.74, 0.18);
  c.add(seat, back);
  for (const [lx, lz] of [[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.17], [0.18, 0.17]]) {
    const l = box(0.035, 0.46, 0.035, mat);
    l.position.set(lx, 0.23, lz);
    c.add(l);
  }
  c.position.set(x, 0, z);
  c.rotation.y = rot;
  g.add(c);
  return c;
}

// Mesita redonda de fondo (café, parrilla).
function sideTable(g, x, z, top, base) {
  const t = cyl(0.36, 0.36, 0.035, top, 24);
  t.position.set(x, 0.74, z);
  const p = cyl(0.03, 0.03, 0.72, base);
  p.position.set(x, 0.37, z);
  const f = cyl(0.2, 0.22, 0.03, base);
  f.position.set(x, 0.015, z);
  g.add(t, p, f);
}

// Texto grande pintado (carteles, letreros).
function sign(text, { w = 1024, h = 256, bg = null, fg = '#f2f2f2', size = 120, weight = 800, border = 0, spacing = 6 } = {}) {
  return canvasTex(w, h, (ctx) => {
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }
    if (border) {
      ctx.strokeStyle = fg;
      ctx.lineWidth = border;
      ctx.strokeRect(border, border, w - border * 2, h - border * 2);
    }
    ctx.fillStyle = fg;
    ctx.font = `${weight} ${size}px ${FONT}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = text.split('\n');
    lines.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.15));
  });
}

// Una botella plana: cuerpo, hombros, cuello, sombra dura de un lado y, a veces, etiqueta.
function drawBottle(ctx, x, base, w, h, color, label, labelColor) {
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
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x + w * 0.14, shoulder - h * 0.04, w * 0.1, h * 0.46);
  ctx.restore();
  if (label) {
    ctx.fillStyle = labelColor;
    ctx.fillRect(x + 2, base - h * 0.42, w - 4, h * 0.22);
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.fillRect(x + w * 0.62, base - h * 0.42, w * 0.38 - 2, h * 0.22);
  }
}

// Láminas de dos tintas con marco fino (sol de mayo, guarda, ancho de espada, pampa con ombú, bandoneón).
function drawPicture(ctx, w, h, kind, bg, fg, frame) {
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
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - 60 + i * 20, cy - 54);
      ctx.lineTo(cx - 50 + i * 20, cy);
      ctx.lineTo(cx - 60 + i * 20, cy + 54);
      ctx.lineWidth = 6;
      ctx.stroke();
    }
  } else {
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(w * 0.68, h * 0.3, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillRect(0, h * 0.68, w, h);
    ctx.fillRect(w * 0.31, h * 0.48, 22, h * 0.22);
    for (const [dx, dy, r] of [[0, -56, 60], [-56, -24, 46], [62, -22, 48], [-8, -14, 52]]) {
      ctx.beginPath();
      ctx.arc(w * 0.335 + dx, h * 0.48 + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

const picture = (kind, bg, fg, frame) => canvasTex(384, 512, (ctx, w, h) => drawPicture(ctx, w, h, kind, bg, fg, frame));

// Tablones de madera (piso) en pocos tonos.
function plankTex(tones, seam, seed = 11) {
  return canvasTex(1024, 1024, (ctx, w, h) => {
    const r = seeded(seed);
    const rows = 10;
    for (let i = 0; i < rows; i++) {
      const y = (i * h) / rows;
      let x = -r() * 200;
      while (x < w) {
        const len = 260 + r() * 320;
        ctx.fillStyle = tones[Math.floor(r() * tones.length)];
        ctx.fillRect(x, y, len, h / rows);
        ctx.fillStyle = seam;
        ctx.fillRect(x, y, 3, h / rows);
        x += len;
      }
      ctx.fillStyle = seam;
      ctx.fillRect(0, y, w, 3);
    }
    noise(ctx, w, h, 7);
  }, [4, 4]);
}

// Baldosas en damero (café, cocina).
function checkerTex(a, b, n = 8, repeat = 5) {
  return canvasTex(512, 512, (ctx, w, h) => {
    const s = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      ctx.fillStyle = (x + y) % 2 ? a : b;
      ctx.fillRect(x * s, y * s, s, s);
    }
    noise(ctx, w, h, 6);
  }, [repeat, repeat]);
}

// Pared con zócalo y friso: base hasta `dado` metros, molduras y penumbra arriba.
function wallTex({ top, bottom, trim, seam, dado = 1.0, panels = 128, shade = 0.4, extra }) {
  const yAt = (m) => (1 - m / WALL_H) * 1024;
  return canvasTex(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, w, h);
    if (panels) {
      for (let x = 0; x < w; x += panels) {
        ctx.fillStyle = seam;
        ctx.fillRect(x, yAt(dado), 3, h);
      }
    }
    ctx.fillStyle = bottom;
    ctx.fillRect(0, yAt(dado), w, h - yAt(dado));
    ctx.fillStyle = trim;
    ctx.fillRect(0, yAt(dado) - 10, w, 12);
    ctx.fillRect(0, yAt(2.95), w, 8);
    extra?.(ctx, w, h, yAt);
    for (const [from, to, a] of [[0, 180, shade], [180, 300, shade * 0.45]]) {
      ctx.fillStyle = `rgba(0,0,0,${a})`;
      ctx.fillRect(0, from, w, to - from);
    }
    noise(ctx, w, h, 6);
  }, [3, 1]);
}

// ------------------------------------------------------------------ los ambientes
// Cada uno: build(g) arma el grupo y devuelve { background, fog: [color, cerca, lejos] }.
const BUILD = {
  // Bar notable porteño: boiserie oscura, estantería de botellas, láminas y lámpara colgante.
  bar(g) {
    const P = { wall: gray(0.1), wallAlt: gray(0.115), seam: gray(0.05), trim: gray(0.22), floor: [gray(0.17), gray(0.2), gray(0.15)] };
    hemi(g, gray(0.95, 35, 0.3), gray(0.25), 1.2);
    pendant(g, { shade: gray(0.12), bulb: '#fff6e6', light: '#ffeacc' });
    const fill = new THREE.PointLight(gray(0.7, 30, 0.2), 1.2, 9, 1.4);
    fill.position.set(-2.5, 2.2, -2);
    g.add(fill);
    floor(g, plankTex(P.floor, gray(0.06)));
    ceiling(g, gray(0.04));
    walls(g, wallTex({ top: P.wall, bottom: gray(0.07), trim: P.trim, seam: P.seam, dado: 0.92, extra: (ctx, w, h, yAt) => {
      for (let x = 0; x < w; x += 128) {
        ctx.fillStyle = (x / 128) % 2 ? P.wallAlt : P.wall;
        ctx.fillRect(x + 3, 0, 125, yAt(0.92) - 10);
      }
      ctx.fillStyle = P.trim;
      ctx.fillRect(0, yAt(1.72), w, 10);
    } }));
    // estantería
    const shelfTex = canvasTex(1536, 600, (ctx, w, h) => {
      const r = seeded(37);
      ctx.fillStyle = gray(0.05);
      ctx.fillRect(0, 0, w, h);
      for (const base of [190, 390, 584]) {
        let x = 24 + r() * 30;
        while (x < w - 60) {
          const bw = 30 + r() * 18;
          const bh = 118 + r() * 46;
          drawBottle(ctx, x, base, bw, bh, gray(0.12 + r() * 0.22, 30, 0.08), r() < 0.7, gray(0.75));
          x += bw + 12 + r() * (r() < 0.2 ? 90 : 26);
        }
        ctx.fillStyle = gray(0.16);
        ctx.fillRect(0, base, w, 16);
        ctx.fillStyle = gray(0.32);
        ctx.fillRect(0, base, w, 2.5);
      }
      ctx.lineWidth = 16;
      ctx.strokeStyle = gray(0.16);
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 6);
    });
    onWall(g, shelfTex, 6.4, 2.5, { wall: 0, y: 2.25 });
    // la barra (mostrador) adelante de la estantería
    const counter = box(6, 1.05, 0.6, toon(gray(0.14)));
    counter.position.set(0, 0.525, -ROOM + 0.6);
    const counterTop = box(6.1, 0.05, 0.7, toon(gray(0.32)));
    counterTop.position.set(0, 1.07, -ROOM + 0.6);
    g.add(counter, counterTop);
    for (let i = -2; i <= 2; i++) {
      const stool = cyl(0.17, 0.17, 0.05, toon(gray(0.2)));
      stool.position.set(i * 1.15, 0.75, -ROOM + 1.25);
      const leg = cyl(0.025, 0.025, 0.75, toon(gray(0.1)));
      leg.position.set(i * 1.15, 0.375, -ROOM + 1.25);
      g.add(stool, leg);
    }
    [['sol', 1, -1.9], ['guarda', 1, 1.9], ['espada', 3, -1.9], ['pampa', 3, 1.9]].forEach(([k, wall, x]) => {
      onWall(g, picture(k, gray(0.78, 35, 0.12), gray(0.1), gray(0.05)), 0.9, 1.2, { wall, x, y: 2.3 });
    });
    return { background: gray(0.03), fog: [gray(0.03), 7, 16] };
  },

  // Café porteño: damero blanco y negro, ventanales en arco, boiserie, mesitas de mármol, reloj y letrero.
  cafe(g) {
    hemi(g, '#ffffff', gray(0.3, 40, 0.05), 1.5);
    pendant(g, { bulb: '#fdfaf2', light: '#fff4e0', kind: 'globe', intensity: 6 });
    floor(g, checkerTex(gray(0.12), gray(0.86, 40, 0.06), 8, 6));
    ceiling(g, gray(0.82, 40, 0.06));
    walls(g, wallTex({ top: gray(0.8, 40, 0.08), bottom: gray(0.15, 25, 0.12), trim: gray(0.1), seam: gray(0.1), dado: 1.2, panels: 170, shade: 0.12 }));
    // ventanales en arco
    const win = canvasTex(256, 512, (ctx, w, h) => {
      ctx.fillStyle = gray(0.1);
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, w / 2);
      ctx.arc(w / 2, w / 2, w / 2, Math.PI, 0);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      const gr = ctx.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(1, gray(0.82, 210, 0.06));
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(14, h - 14);
      ctx.lineTo(14, w / 2);
      ctx.arc(w / 2, w / 2, w / 2 - 14, Math.PI, 0);
      ctx.lineTo(w - 14, h - 14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = gray(0.1);
      ctx.fillRect(w / 2 - 4, 20, 8, h);
      for (const y of [h * 0.45, h * 0.72]) ctx.fillRect(0, y, w, 7);
    });
    for (const wall of [1, 3]) for (const x of [-2.6, 0, 2.6]) onWall(g, win, 1.15, 2.3, { wall, x, y: 2.15 });
    // letrero y reloj en la pared de enfrente
    onWall(g, sign('CAFÉ', { fg: gray(0.08), size: 150, weight: 800, spacing: 30 }), 3, 0.75, { wall: 0, y: 3.3 });
    const clock = canvasTex(256, 256, (ctx, w) => {
      ctx.fillStyle = gray(0.08);
      ctx.beginPath();
      ctx.arc(w / 2, w / 2, w / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f7f5ef';
      ctx.beginPath();
      ctx.arc(w / 2, w / 2, w / 2 - 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = gray(0.08);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.lineWidth = i % 3 ? 3 : 7;
        ctx.beginPath();
        ctx.moveTo(w / 2 + Math.cos(a) * 92, w / 2 + Math.sin(a) * 92);
        ctx.lineTo(w / 2 + Math.cos(a) * 108, w / 2 + Math.sin(a) * 108);
        ctx.stroke();
      }
      ctx.lineCap = 'round';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(w / 2, w / 2);
      ctx.lineTo(w / 2 + 50, w / 2 - 28);
      ctx.moveTo(w / 2, w / 2);
      ctx.lineTo(w / 2 - 10, w / 2 - 82);
      ctx.stroke();
    });
    onWall(g, clock, 0.8, 0.8, { wall: 0, x: 2.4, y: 2.2 });
    onWall(g, picture('bandoneon', gray(0.9, 40, 0.06), gray(0.1), gray(0.1)), 0.9, 1.2, { wall: 0, x: -2.4, y: 2.2 });
    // mesitas de mármol con sillas de Viena
    const marble = toon(gray(0.92, 40, 0.04));
    const iron = toon(gray(0.1));
    const wood = toon(gray(0.16, 25, 0.15));
    for (const [x, z] of [[-3.2, -3], [3.2, -3], [-3.4, 2.8], [3.4, 2.8], [0, -3.6]]) {
      sideTable(g, x, z, marble, iron);
      chair(g, x + 0.55, z, -Math.PI / 2, wood);
      chair(g, x - 0.55, z, Math.PI / 2, wood);
    }
    return { background: gray(0.82, 40, 0.06), fog: [gray(0.85, 40, 0.06), 8, 18] };
  },

  // Parrilla de barrio: azulejos blancos, parrilla de ladrillo con brasas, pizarrón del menú, sifones.
  parrilla(g) {
    hemi(g, gray(0.98, 30, 0.2), gray(0.3), 1.4);
    pendant(g, { shade: gray(0.9), bulb: '#fffaf0', light: '#fff0dc', intensity: 6.5 });
    floor(g, checkerTex(gray(0.55, 15, 0.1), gray(0.62, 15, 0.1), 10, 8));
    ceiling(g, gray(0.7));
    walls(g, wallTex({ top: gray(0.9, 30, 0.04), bottom: gray(0.26, 15, 0.08), trim: gray(0.15), seam: gray(0.15), dado: 1.1, panels: 0, shade: 0.18, extra: (ctx, w, h, yAt) => {
      // azulejos
      ctx.strokeStyle = gray(0.72);
      ctx.lineWidth = 2;
      for (let x = 0; x < w; x += 42) {
        ctx.beginPath();
        ctx.moveTo(x, yAt(2.95));
        ctx.lineTo(x, yAt(1.1));
        ctx.stroke();
      }
      for (let y = yAt(2.95); y < yAt(1.1); y += 42) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    } }));
    // parrilla de ladrillo con campana
    const brick = canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = gray(0.2, 10, 0.12);
      ctx.fillRect(0, 0, w, h);
      for (let y = 0, row = 0; y < h; y += 32, row++) {
        for (let x = row % 2 ? -32 : 0; x < w; x += 64) {
          ctx.fillStyle = gray(0.3 + ((x * 7 + y * 3) % 5) * 0.025, 12, 0.14);
          ctx.fillRect(x + 3, y + 3, 58, 26);
        }
      }
      noise(ctx, w, h, 10);
    }, [2, 2]);
    const bm = toon(null, { map: brick });
    const base = box(2.4, 0.9, 0.9, bm);
    base.position.set(0, 0.45, -ROOM + 0.45);
    const hood = box(2.6, 1.3, 1.0, bm);
    hood.position.set(0, 2.6, -ROOM + 0.5);
    for (const x of [-1.15, 1.15]) {
      const col = box(0.22, 1.1, 0.8, bm);
      col.position.set(x, 1.45, -ROOM + 0.45);
      g.add(col);
    }
    const chimney = box(0.8, 1.4, 0.6, bm);
    chimney.position.set(0, 3.6, -ROOM + 0.3);
    const grill = box(2.0, 0.03, 0.7, toon(gray(0.1)));
    grill.position.set(0, 1.05, -ROOM + 0.5);
    const coals = box(1.9, 0.04, 0.6, basic('#ff7a2e'));
    coals.position.set(0, 0.92, -ROOM + 0.5);
    g.add(base, hood, chimney, grill, coals);
    const glow = new THREE.PointLight('#ff9a50', 2.2, 4, 1.6);
    glow.position.set(0, 1.2, -ROOM + 1.0);
    g.add(glow);
    for (let i = 0; i < 5; i++) {
      const meat = box(0.28, 0.04, 0.16, toon(gray(0.24, 10, 0.25)));
      meat.position.set(-0.8 + i * 0.4, 1.08, -ROOM + 0.45 + (i % 2) * 0.12);
      g.add(meat);
    }
    // pizarrón
    const board = canvasTex(768, 1024, (ctx, w, h) => {
      ctx.fillStyle = gray(0.35, 30, 0.12);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gray(0.14);
      ctx.fillRect(22, 22, w - 44, h - 44);
      ctx.fillStyle = '#f2f2f2';
      ctx.textAlign = 'center';
      ctx.font = `800 84px ${FONT}`;
      ctx.fillText('MENÚ', w / 2, 140);
      ctx.font = `500 54px ${FONT}`;
      ['Vacío', 'Chori al pan', 'Mollejas', 'Provoleta', 'Ensalada mixta', 'Flan con dulce'].forEach((t, i) => ctx.fillText(t, w / 2, 260 + i * 105));
      noise(ctx, w, h, 10);
    });
    onWall(g, board, 1.2, 1.6, { wall: 1, x: -1.4, y: 2.0 });
    onWall(g, picture('sol', gray(0.92), gray(0.15), gray(0.15)), 0.8, 1.06, { wall: 3, x: 1.6, y: 2.2 });
    // sifones en un estante
    const shelf = box(1.6, 0.05, 0.3, toon(gray(0.2)));
    shelf.position.set(-ROOM + 0.18, 1.7, -1.4);
    shelf.rotation.y = Math.PI / 2;
    g.add(shelf);
    for (let i = 0; i < 5; i++) {
      const sif = cyl(0.06, 0.06, 0.3, toon(gray(0.6, 200, 0.08), { transparent: true, opacity: 0.85 }));
      sif.position.set(-ROOM + 0.18, 1.88, -2.0 + i * 0.3);
      const head = cyl(0.03, 0.04, 0.08, toon(gray(0.75)));
      head.position.set(-ROOM + 0.18, 2.07, -2.0 + i * 0.3);
      g.add(sif, head);
    }
    const cloth = toon('#f4f4f2');
    for (const [x, z] of [[-3.3, 2.8], [3.3, 2.8], [3.3, -2.6]]) {
      sideTable(g, x, z, cloth, toon(gray(0.12)));
      chair(g, x, z + 0.55, 0, toon(gray(0.2)));
    }
    return { background: gray(0.6), fog: [gray(0.65), 8, 18] };
  },

  // Bosques de Palermo: cielo claro, pasto, árboles, bancos, faroles, el lago y la ciudad a lo lejos.
  parque(g) {
    skyDome(g, [[0, gray(0.96, 210, 0.12)], [0.45, gray(0.86, 210, 0.08)], [0.5, gray(0.78, 120, 0.04)], [1, gray(0.6, 120, 0.05)]]);
    hemi(g, '#ffffff', gray(0.4, 100, 0.1), 1.3);
    sun(g, '#fffaf0', 1.6, [4, 7, 3]);
    const grass = canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = gray(0.58, 100, 0.08);
      ctx.fillRect(0, 0, w, h);
      const r = seeded(9);
      for (let i = 0; i < 4000; i++) {
        ctx.fillStyle = gray(0.5 + r() * 0.15, 100, 0.08);
        ctx.fillRect(r() * w, r() * h, 2, 5);
      }
    }, [16, 16]);
    floor(g, grass, 40);
    // senderito de tierra debajo de la mesa
    const path = new THREE.Mesh(new THREE.CircleGeometry(2.2, 40), toon(gray(0.72, 35, 0.08)));
    path.rotation.x = -Math.PI / 2;
    path.position.y = 0.005;
    path.receiveShadow = true;
    g.add(path);
    const r = seeded(21);
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + r() * 0.2;
      const d = 6 + r() * 9;
      tree(g, Math.cos(a) * d, Math.sin(a) * d, { h: 3 + r() * 2.5, crown: 1 + r() * 0.8, trunk: gray(0.22), leaves: gray(0.36 + r() * 0.12, 110, 0.1), r });
    }
    // lago
    const lake = new THREE.Mesh(new THREE.CircleGeometry(4, 40), toon(gray(0.78, 205, 0.15)));
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(-7, 0.01, -9);
    lake.scale.set(1.6, 1, 1);
    g.add(lake);
    // bancos y faroles
    const iron = toon(gray(0.12));
    const slat = toon(gray(0.42, 30, 0.12));
    for (const [x, z, rot] of [[3.2, -2.4, -0.6], [-3.4, 2.2, 2.4], [-3.0, -3.0, 0.8]]) {
      const b = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const s = box(1.5, 0.04, 0.1, slat);
        s.position.set(0, 0.45, -0.12 + k * 0.12);
        b.add(s);
      }
      for (let k = 0; k < 2; k++) {
        const s = box(1.5, 0.08, 0.04, slat);
        s.position.set(0, 0.62 + k * 0.14, 0.2);
        b.add(s);
      }
      for (const lx of [-0.65, 0.65]) {
        const l = box(0.05, 0.85, 0.42, iron);
        l.position.set(lx, 0.42, 0.04);
        b.add(l);
      }
      b.position.set(x, 0, z);
      b.rotation.y = rot;
      g.add(b);
    }
    for (const [x, z] of [[2.6, 2.8], [-2.8, -1.2], [4.4, -4.4]]) {
      const post = cyl(0.04, 0.06, 3.2, iron);
      post.position.set(x, 1.6, z);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), basic('#ffffff'));
      head.position.set(x, 3.3, z);
      g.add(post, head);
    }
    // la ciudad a lo lejos
    const city = canvasTex(2048, 256, (ctx, w, h) => {
      const rr = seeded(5);
      let x = 0;
      while (x < w) {
        const bw = 30 + rr() * 90;
        const bh = 40 + rr() * 170;
        ctx.fillStyle = gray(0.62 + rr() * 0.08, 210, 0.06);
        ctx.fillRect(x, h - bh, bw, bh);
        x += bw + rr() * 10;
      }
    });
    const skyline = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 3, 48, 1, true), new THREE.MeshBasicMaterial({ map: city, transparent: true, side: THREE.BackSide, fog: false }));
    skyline.position.y = 1.4;
    g.add(skyline);
    return { background: gray(0.9, 210, 0.08), fog: [gray(0.88, 210, 0.08), 12, 30] };
  },

  // Quincho de noche: pared de ladrillo con parrilla, pérgola de madera, guirnalda de lamparitas y estrellas.
  quincho(g) {
    skyDome(g, [[0, gray(0.02, 230, 0.2)], [0.5, gray(0.08, 230, 0.15)], [1, gray(0.05)]], { stars: 260 });
    hemi(g, gray(0.6, 230, 0.15), gray(0.15), 0.8);
    pendant(g, { shade: gray(0.1), bulb: '#fff2d6', light: '#ffe3b8', intensity: 8 });
    floor(g, checkerTex(gray(0.3, 15, 0.12), gray(0.34, 15, 0.12), 6, 10), 12);
    const brick = canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = gray(0.12);
      ctx.fillRect(0, 0, w, h);
      for (let y = 0, row = 0; y < h; y += 32, row++) for (let x = row % 2 ? -32 : 0; x < w; x += 64) {
        ctx.fillStyle = gray(0.24 + ((x * 3 + y) % 7) * 0.015, 12, 0.12);
        ctx.fillRect(x + 3, y + 3, 58, 26);
      }
      noise(ctx, w, h, 10);
    }, [4, 2]);
    const wall = box(9, 3.2, 0.3, toon(null, { map: brick }));
    wall.position.set(0, 1.6, -4.6);
    g.add(wall);
    const grill = box(2, 0.9, 0.7, toon(gray(0.18)));
    grill.position.set(2.2, 0.45, -4.1);
    const coals = box(1.7, 0.04, 0.5, basic('#ff7a2e'));
    coals.position.set(2.2, 0.92, -4.1);
    g.add(grill, coals);
    const glow = new THREE.PointLight('#ff9a50', 1.8, 4, 1.6);
    glow.position.set(2.2, 1.2, -3.6);
    g.add(glow);
    // pérgola
    const wood = toon(gray(0.2, 25, 0.15));
    for (const x of [-3.5, 3.5]) for (const z of [-3.6, 3.4]) {
      const p = box(0.14, 3, 0.14, wood);
      p.position.set(x, 1.5, z);
      g.add(p);
    }
    for (let i = -3; i <= 3; i++) {
      const beam = box(7.4, 0.1, 0.12, wood);
      beam.position.set(0, 3.05, i * 1.1);
      g.add(beam);
    }
    // guirnalda de lamparitas
    const bulbMat = basic('#fff1c9');
    for (const z of [-2.2, 0, 2.2]) {
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const x = -3.4 + t * 6.8;
        const y = 2.9 - Math.sin(t * Math.PI) * 0.45;
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), bulbMat);
        b.position.set(x, y, z);
        g.add(b);
      }
    }
    // plantas en macetas
    const pot = toon(gray(0.3, 15, 0.15));
    const leaf = toon(gray(0.25, 120, 0.1), { flatShading: true });
    for (const [x, z] of [[-3.4, -3.2], [3.4, 3.0], [-3.6, 2.4]]) {
      const p = cyl(0.25, 0.18, 0.45, pot);
      p.position.set(x, 0.225, z);
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), leaf);
      bush.position.set(x, 0.8, z);
      bush.castShadow = true;
      g.add(p, bush);
    }
    return { background: gray(0.03, 230, 0.2), fog: [gray(0.03, 230, 0.2), 9, 22] };
  },

  // Club de barrio: piso de cancha con líneas, pared en dos tonos con el escudo, banderines y trofeos.
  club(g) {
    hemi(g, '#ffffff', gray(0.35), 1.5);
    pendant(g, { shade: gray(0.85), bulb: '#ffffff', light: '#f4f8ff', intensity: 6.5 });
    const court = canvasTex(1024, 1024, (ctx, w, h) => {
      const r = seeded(4);
      for (let y = 0; y < h; y += 32) {
        ctx.fillStyle = gray(0.55 + r() * 0.06, 35, 0.15);
        ctx.fillRect(0, y, w, 32);
        ctx.fillStyle = gray(0.4, 35, 0.15);
        ctx.fillRect(0, y, w, 2);
      }
      ctx.strokeStyle = '#f5f5f5';
      ctx.lineWidth = 10;
      ctx.strokeRect(60, 60, w - 120, h - 120);
      ctx.beginPath();
      ctx.moveTo(60, h / 2);
      ctx.lineTo(w - 60, h / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 130, 0, Math.PI * 2);
      ctx.stroke();
      noise(ctx, w, h, 6);
    });
    floor(g, court);
    ceiling(g, gray(0.3));
    walls(g, wallTex({ top: gray(0.82), bottom: gray(0.18, 220, 0.1), trim: gray(0.1), seam: gray(0.1), dado: 1.4, panels: 0, shade: 0.15 }));
    // escudo y nombre
    const crest = canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = gray(0.12);
      ctx.beginPath();
      ctx.moveTo(w * 0.15, h * 0.08);
      ctx.lineTo(w * 0.85, h * 0.08);
      ctx.lineTo(w * 0.85, h * 0.55);
      ctx.quadraticCurveTo(w * 0.85, h * 0.85, w / 2, h * 0.95);
      ctx.quadraticCurveTo(w * 0.15, h * 0.85, w * 0.15, h * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(w * 0.15, h * 0.32, w * 0.7, h * 0.12);
      ctx.font = `800 120px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('T', w / 2, h * 0.66);
    });
    onWall(g, crest, 1.2, 1.2, { wall: 0, y: 2.6 });
    onWall(g, sign('CLUB SOCIAL Y DEPORTIVO TRUKEADOS', { fg: gray(0.1), size: 54, spacing: 8, w: 2048, h: 128 }), 6, 0.38, { wall: 0, y: 3.55 });
    // banderines
    const flags = canvasTex(2048, 128, (ctx, w, h) => {
      ctx.strokeStyle = gray(0.1);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.lineTo(w, 10);
      ctx.stroke();
      for (let x = 0, i = 0; x < w; x += 64, i++) {
        ctx.fillStyle = i % 2 ? gray(0.12) : '#f5f5f5';
        ctx.beginPath();
        ctx.moveTo(x + 4, 10);
        ctx.lineTo(x + 60, 10);
        ctx.lineTo(x + 32, 110);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    });
    for (const wall of [1, 3]) onWall(g, flags, 9.5, 0.6, { wall, y: 3.2 });
    // vitrina de trofeos
    const shelfMat = toon(gray(0.2));
    const cup = toon(gray(0.82, 45, 0.25));
    for (const y of [1.2, 1.7]) {
      const s = box(1.8, 0.05, 0.3, shelfMat);
      s.position.set(-ROOM + 0.2, y, 1.6);
      s.rotation.y = Math.PI / 2;
      g.add(s);
      for (let i = 0; i < 4; i++) {
        const t = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.06, 0], [0.02, 0.05], [0.02, 0.12], [0.08, 0.2], [0.09, 0.3], [0, 0.3]].map(([x, yy]) => new THREE.Vector2(x, yy)), 16), cup);
        t.position.set(-ROOM + 0.2, y + 0.03, 0.9 + i * 0.45);
        g.add(t);
      }
    }
    // sillas de plástico apiladas
    const plastic = toon(gray(0.88));
    for (let i = 0; i < 6; i++) chair(g, 3.8, -3.6, Math.PI, plastic).position.y = i * 0.07;
    for (const [x, z] of [[3.6, 2.6], [-3.6, -3]]) {
      sideTable(g, x, z, toon(gray(0.9)), toon(gray(0.2)));
    }
    return { background: gray(0.55), fog: [gray(0.6), 8, 18] };
  },

  // Estancia al atardecer: la pampa, un molino, el galpón, la tranquera y un ombú.
  campo(g) {
    skyDome(g, [[0, gray(0.55, 220, 0.12)], [0.38, gray(0.82, 30, 0.2)], [0.5, gray(0.92, 35, 0.3)], [0.52, gray(0.4, 60, 0.1)], [1, gray(0.3, 60, 0.1)]]);
    hemi(g, gray(0.95, 35, 0.35), gray(0.3, 60, 0.1), 1.15);
    sun(g, gray(0.92, 32, 0.6), 1.7, [-6, 3, -5]);
    const ground = canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = gray(0.48, 60, 0.12);
      ctx.fillRect(0, 0, w, h);
      const r = seeded(13);
      for (let i = 0; i < 5000; i++) {
        ctx.fillStyle = gray(0.38 + r() * 0.2, 55, 0.12);
        ctx.fillRect(r() * w, r() * h, 2, 6);
      }
    }, [20, 20]);
    floor(g, ground, 40);
    // piso de ladrillo debajo de la mesa (la galería del casco)
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), toon(gray(0.42, 15, 0.15)));
    deck.rotation.x = -Math.PI / 2;
    deck.position.y = 0.006;
    deck.receiveShadow = true;
    g.add(deck);
    const dark = toon(gray(0.12));
    // molino
    const mill = new THREE.Group();
    for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
      const leg = cyl(0.04, 0.04, 7, dark, 6);
      leg.position.set(x * 0.6, 3.5, z * 0.6);
      leg.rotation.set(-z * 0.08, 0, x * 0.08);
      mill.add(leg);
    }
    const wheel = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const blade = box(0.08, 1.2, 0.02, dark);
      blade.position.y = 0.7;
      const arm = new THREE.Group();
      arm.add(blade);
      arm.rotation.z = (i / 18) * Math.PI * 2;
      wheel.add(arm);
    }
    wheel.position.set(0, 7.2, 0.3);
    const tail = box(0.05, 0.6, 1.4, dark);
    tail.position.set(0, 7.2, -0.6);
    mill.add(wheel, tail);
    mill.scale.setScalar(0.62);
    mill.position.set(6, 0, -10);
    g.add(mill);
    // galpón
    const shed = box(5, 2.6, 3, toon(gray(0.62, 25, 0.06)));
    shed.position.set(-9, 1.3, -8);
    // techo a dos aguas: un triángulo extruido a lo largo del galpón
    const gable = new THREE.Shape([new THREE.Vector2(-1.7, 0), new THREE.Vector2(1.7, 0), new THREE.Vector2(0, 1.2)]);
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(gable, { depth: 5.3, bevelEnabled: false }), toon(gray(0.35)));
    roof.rotation.y = Math.PI / 2;
    roof.position.set(-11.65, 2.6, -8);
    roof.castShadow = true;
    g.add(shed, roof);
    // tranquera y alambrado
    const fence = toon(gray(0.24, 30, 0.12));
    for (let i = -6; i <= 6; i++) {
      const post = box(0.1, 1.2, 0.1, fence);
      post.position.set(i * 1.6, 0.6, 5.5);
      g.add(post);
    }
    for (const y of [0.45, 0.8, 1.1]) {
      const wire = box(19.2, 0.012, 0.012, dark);
      wire.position.set(0, y, 5.5);
      g.add(wire);
    }
    // ombú
    const r = seeded(31);
    tree(g, 5, 4, { h: 4.5, crown: 2.2, trunk: gray(0.18), leaves: gray(0.3, 90, 0.1), r });
    tree(g, -6, 6, { h: 3.6, crown: 1.6, trunk: gray(0.18), leaves: gray(0.34, 90, 0.1), r });
    return { background: gray(0.82, 30, 0.2), fog: [gray(0.78, 32, 0.22), 14, 34] };
  },
};

/** Ids de los ambientes (el orden no importa: el servidor elige uno al azar). */
export const AMBIENTE_IDS = Object.keys(BUILD);

/** Arma el ambiente `id` (o el bar si no existe). Devuelve { group, background, fog }. */
export function buildAmbiente(id) {
  const g = new THREE.Group();
  g.name = `ambiente:${id}`;
  const out = (BUILD[id] || BUILD.bar)(g);
  return { group: g, ...out };
}

/** Libera la memoria de un ambiente que ya no se usa. */
export function disposeAmbiente(group) {
  group.traverse((o) => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      m.map?.dispose?.();
      m.dispose?.();
    }
    o.shadow?.map?.dispose?.();
  });
}
