// La foto de cada personaje 3D en la tienda: un póster armado en el momento con el modelo de verdad. Fondo de color
// con rayos, el nombre gigante atrás, el personaje en pose (mano en la cintura, saludando, guiñando) iluminado con
// luces de contorno de dos colores, y brillitos adelante. Los colores salen de COSMETIC_LOOK[id].poster (theme.js).
// Se hace una vez por personaje (un solo contexto de WebGL que se suelta al terminar) y se guarda.
import * as THREE from 'three';
import { loadModel, Rig } from './models.js';
import { COSMETIC_LOOK } from './theme.js';

export const POSTER_W = 1280;
export const POSTER_H = 800;
const cache = new Map();
let queue = Promise.resolve(); // de a uno (un solo renderer a la vez)

/** Promesa de un canvas de POSTER_W x POSTER_H con el póster del personaje (null si no hay modelo). */
export function poster(id, name = id) {
  if (!cache.has(id)) {
    const p = (queue = queue.then(() => make(id, name)).catch(() => null));
    cache.set(id, p);
  }
  return cache.get(id);
}

async function make(id, name) {
  const look = COSMETIC_LOOK[id];
  if (!look?.model) return null;
  const pal = look.poster || { bg: ['#666', '#333', '#111'], rim: ['#fff', '#fff'], ink: '#fff' };
  const [tpl] = await Promise.all([loadModel(look.model.url), document.fonts?.load?.('800 200px "Hanken Grotesk"').catch(() => {})]);
  const out = document.createElement('canvas');
  out.width = POSTER_W;
  out.height = POSTER_H;
  const ctx = out.getContext('2d');
  background(ctx, pal, name);
  ctx.drawImage(render(tpl, pal), 0, 0, POSTER_W, POSTER_H);
  foreground(ctx, pal);
  return out;
}

// Fondo: degradé, rayos que salen de atrás del personaje y el nombre enorme, contorneado.
function background(ctx, pal, name) {
  const W = POSTER_W;
  const H = POSTER_H;
  const cx = W * 0.56;
  const cy = H * 0.42;
  const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, W * 0.75);
  g.addColorStop(0, pal.bg[0]);
  g.addColorStop(0.45, pal.bg[1]);
  g.addColorStop(1, pal.bg[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // rayos
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'overlay';
  const n = 22;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, W, a, a + (Math.PI * 2) / n);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // puntitos (trama) abajo a la izquierda
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  for (let y = H * 0.5; y < H; y += 18) {
    for (let x = 0; x < W * 0.45; x += 18) {
      const r = 4.2 * (1 - x / (W * 0.45)) * ((y - H * 0.5) / (H * 0.5));
      if (r > 0.4) {
        ctx.beginPath();
        ctx.arc(x + ((y / 18) % 2) * 9, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
  // el nombre, gigante y en diagonal, atrás del personaje
  const text = String(name).toUpperCase();
  ctx.save();
  ctx.translate(W * 0.5, H * 0.5);
  ctx.rotate(-0.08);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 300;
  ctx.font = `800 ${size}px "Hanken Grotesk", system-ui, sans-serif`;
  const w = ctx.measureText(text).width;
  if (w > W * 0.92) {
    size = Math.floor((size * W * 0.92) / w);
    ctx.font = `800 ${size}px "Hanken Grotesk", system-ui, sans-serif`;
  }
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 0, -size * 0.42);
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 5;
  ctx.strokeStyle = pal.ink;
  ctx.strokeText(text, 0, size * 0.5);
  ctx.restore();
}

// Brillitos y una luz abajo, por encima del personaje.
function foreground(ctx, pal) {
  const W = POSTER_W;
  const H = POSTER_H;
  const g = ctx.createLinearGradient(0, H * 0.78, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, H * 0.78, W, H * 0.22);
  const star = (x, y, r, c) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r * 0.35, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r * 0.35, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, y);
    ctx.quadraticCurveTo(x, y, x, y - r * 0.2);
    ctx.quadraticCurveTo(x, y, x + r * 0.7, y);
    ctx.quadraticCurveTo(x, y, x, y + r * 0.2);
    ctx.fill();
  };
  star(W * 0.3, H * 0.22, 34, pal.ink);
  star(W * 0.82, H * 0.3, 24, '#ffffff');
  star(W * 0.76, H * 0.7, 18, pal.ink);
  star(W * 0.36, H * 0.62, 14, '#ffffff');
}

// El personaje: tres cuartos de perfil, la cámara un poco abajo (se ve más grande), luz de frente y dos de contorno.
function render(tpl, pal) {
  const canvas = document.createElement('canvas');
  canvas.width = POSTER_W;
  canvas.height = POSTER_H;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', pal.bg[2], 0.9));
  const key = new THREE.DirectionalLight('#ffffff', 2.0);
  key.position.set(1.5, 2.6, 3.2);
  scene.add(key);
  for (const [c, x] of [[pal.rim[0], -2.6], [pal.rim[1], 2.6]]) {
    const l = new THREE.DirectionalLight(c, 3.2);
    l.position.set(x, 1.8, -2.4);
    scene.add(l);
  }
  const rig = new Rig(tpl, { scale: 1 });
  rig.root.rotation.y = -0.38; // tres cuartos, mirando un poco hacia la izquierda del póster
  rig.root.updateMatrixWorld(true);
  rig.hero();
  rig.face?.set('wink');
  scene.add(rig.root);
  // encuadre: de las rodillas para arriba, el personaje a la derecha del medio
  rig.root.updateMatrixWorld(true);
  const head = rig.at('Head');
  const top = head.y + 0.62; // con la mano de arriba
  const bottom = head.y * 0.36;
  const camera = new THREE.PerspectiveCamera(26, POSTER_W / POSTER_H, 0.1, 50);
  const halfH = Math.tan(THREE.MathUtils.degToRad(13));
  const span = (top - bottom) / 2;
  const d = span / halfH;
  const midY = (top + bottom) / 2;
  camera.position.set(-0.42, midY - 0.2, d);
  camera.lookAt(-0.42, midY, 0);
  renderer.render(scene, camera);
  const snap = document.createElement('canvas');
  snap.width = POSTER_W;
  snap.height = POSTER_H;
  snap.getContext('2d').drawImage(canvas, 0, 0);
  rig.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return snap;
}
