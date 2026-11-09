// Escena 3D del truco: salón, mesa con paño, personajes 2D (recortes), cartas y cámara en primera persona.
import * as THREE from 'three';
import { drawCharacter, lookFor, dressed, sleeveOf, biteAt, W as CW, H as CH } from './characters.js';
import { drawHoldBack, drawHoldThumb, drawReach } from './hands.js';
import { SENAS, SENA_MS, TIMING, ROUTES } from './config.js';
import { newDeck, cardName } from './engine.js';
import { SCENE, CARD, FONT, LIGHT, COSMETIC_LOOK } from './theme.js';

const CARD_W = 0.1;
const CARD_H = CARD_W * (788 / 512);
const TABLE_CARD_SCALE = 1.3; // en la mesa, un poco más grandes que en la vida real: se leen desde lejos
const TABLE_Y = 0.74;
const EYE_Y = 1.46; // a la altura de los ojos de los demás personajes (cabeza en y = 214 de 1200 en el canvas)
const CHAR_H = 1.8; // canvas de 512x1200: del piso (abajo) a la cabeza (arriba)
const CHAR_W = CHAR_H * (CW / CH);

const texLoader = new THREE.TextureLoader();
const texCache = new Map();
let maxAniso = 4;

function cardTex(id) {
  const key = id || 'back';
  if (key === 'blank' && !texCache.has(key)) {
    // carta de la que no se ve la cara (la de abajo de un tiro doble): blanca con el borde
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 197;
    const ctx = c.getContext('2d');
    ctx.fillStyle = CARD.blank;
    ctx.strokeStyle = CARD.blankEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(1, 1, 126, 195, 8);
    ctx.fill();
    ctx.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(key, t);
  }
  if (!texCache.has(key)) {
    const t = texLoader.load(ROUTES.card(key));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    texCache.set(key, t);
  }
  return texCache.get(key);
}

export function preloadCards() {
  ['back', ...newDeck()].forEach(cardTex);
}

// Bordes carbonizados y manchas de quemado (transparente al centro) para la carta quemada.
let burnTexCache = null;
function burnTex() {
  if (burnTexCache) return burnTexCache;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 197;
  const ctx = c.getContext('2d');
  const edge = ctx.createRadialGradient(64, 98, 30, 64, 98, 112);
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(0.55, CARD.burnEmber);
  edge.addColorStop(0.75, CARD.burnChar);
  edge.addColorStop(1, CARD.burnChar);
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, 128, 197);
  // manchas fijas (no al azar: todos ven la misma carta quemada)
  for (const [x, y, rad] of [[20, 30, 22], [110, 60, 18], [96, 170, 26], [30, 150, 16], [70, 12, 14]]) {
    const g = ctx.createRadialGradient(x, y, 2, x, y, rad);
    g.addColorStop(0, CARD.burnChar);
    g.addColorStop(0.7, CARD.burnEmber);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  burnTexCache = new THREE.CanvasTexture(c);
  burnTexCache.colorSpace = THREE.SRGBColorSpace;
  return burnTexCache;
}

// Marca una carta de la mesa como quemada: se oscurece y le aparecen bordes carbonizados.
function burnCard(card) {
  if (card.userData.burned) return;
  card.userData.burned = true;
  card.userData.front.material.color.set(CARD.burnTint);
  card.userData.back.material.color.set(CARD.burnTint);
  const mat = new THREE.MeshLambertMaterial({ map: burnTex(), transparent: true, depthWrite: false });
  for (const side of [1, -1]) {
    const scorch = new THREE.Mesh(cardGeo, mat);
    scorch.position.z = 0.0006 * side;
    if (side < 0) scorch.rotation.y = Math.PI;
    card.add(scorch);
  }
}

const cardGeo = new THREE.PlaneGeometry(CARD_W, CARD_H);

// Carta con frente y dorso. El frente mira hacia +Z local.
function makeCard(id, lit = true) {
  const g = new THREE.Group();
  const Mat = lit ? THREE.MeshLambertMaterial : THREE.MeshBasicMaterial;
  const front = new THREE.Mesh(cardGeo, new Mat({ map: cardTex(id), alphaTest: 0.5 }));
  const back = new THREE.Mesh(cardGeo, new Mat({ map: cardTex('back'), alphaTest: 0.5 }));
  back.rotation.y = Math.PI;
  front.position.z = 0.0003;
  back.position.z = -0.0003;
  back.castShadow = lit; // solo una cara proyecta sombra (si no, la carta se sombrea a sí misma)
  g.add(front, back);
  g.userData = { id, front, back };
  return g;
}

function setCardFace(card, id) {
  if (card.userData.id === id) return;
  card.userData.id = id;
  card.userData.front.material.map = cardTex(id);
  card.userData.front.material.needsUpdate = true;
}

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

function noise(ctx, w, h, amount, alpha) {
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
    img.data[i + 3] = alpha ?? img.data[i + 3];
  }
  ctx.putImageData(img, 0, 0);
}

// Azar con semilla: las texturas pintadas salen iguales en todas las máquinas.
function seeded(seed) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

// Sombreado por escalones (el de una ilustración): tres tonos con borde duro en lugar de un degradé.
let toonRamp = null;
function toon(color, extra = {}) {
  if (!toonRamp) {
    toonRamp = new THREE.DataTexture(new Uint8Array([120, 190, 255]), 3, 1, THREE.RedFormat);
    toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter;
    toonRamp.needsUpdate = true;
  }
  return new THREE.MeshToonMaterial({ ...(color ? { color } : {}), gradientMap: toonRamp, ...extra });
}

// Paño: franjas planas del color dado, costura, guarda escalonada y el nombre al centro.
// Sigue la forma de la mesa (la textura cubre el polígono entero: ver las UV en setLayout).
function feltTex(colors, sides = 4) {
  return canvasTex(1024, 1024, (ctx, w, h) => {
    const poly = (scale) => {
      const pts = [];
      for (let k = 0; k < sides; k++) {
        const a = (k * Math.PI * 2) / sides + Math.PI / sides;
        pts.push([w * (0.5 + 0.5 * scale * Math.sin(a)), h * (0.5 + 0.5 * scale * Math.cos(a))]);
      }
      return pts;
    };
    const fillPoly = (scale, color) => {
      ctx.beginPath();
      poly(scale).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    ctx.fillStyle = colors[2];
    ctx.fillRect(0, 0, w, h);
    fillPoly(0.9, colors[1]);
    fillPoly(0.62, colors[0]);
    // trama del paño
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#000';
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
    ctx.globalAlpha = 1;
    noise(ctx, w, h, 7);
    ctx.strokeStyle = SCENE.feltInk;
    ctx.fillStyle = SCENE.feltInk;
    // costura
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 9]);
    ctx.beginPath();
    poly(0.965).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    // guarda escalonada en el centro de cada lado
    const pts = poly(0.8);
    const period = [0, 1, 2, 3, 4, 3, 2, 1];
    const unit = 9;
    ctx.lineWidth = 5;
    ctx.lineJoin = 'miter';
    pts.forEach(([x0, y0], k) => {
      const [x1, y1] = pts[(k + 1) % sides];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const ux = (x1 - x0) / len;
      const uy = (y1 - y0) / len;
      const nx = (w / 2 - (x0 + x1) / 2) / Math.hypot(w / 2 - (x0 + x1) / 2, h / 2 - (y0 + y1) / 2);
      const ny = (h / 2 - (y0 + y1) / 2) / Math.hypot(w / 2 - (x0 + x1) / 2, h / 2 - (y0 + y1) / 2);
      const margin = len * 0.24;
      const steps = Math.floor((len - margin * 2) / unit);
      const at = (t, o) => [x0 + ux * (margin + t * unit) + nx * o * unit, y0 + uy * (margin + t * unit) + ny * o * unit];
      ctx.beginPath();
      let prev = period[0];
      ctx.moveTo(...at(0, prev));
      for (let t = 1; t <= steps; t++) {
        const cur = period[t % period.length];
        ctx.lineTo(...at(t, prev));
        ctx.lineTo(...at(t, cur));
        prev = cur;
      }
      ctx.stroke();
    });
    // rombo con el nombre
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w / 2, h / 2 - 120);
    ctx.lineTo(w / 2 + 196, h / 2);
    ctx.lineTo(w / 2, h / 2 + 120);
    ctx.lineTo(w / 2 - 196, h / 2);
    ctx.closePath();
    ctx.stroke();
    ctx.font = `800 40px ${FONT}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '5px';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(SCENE.feltName.toUpperCase(), w / 2, h / 2 + 2);
  });
}

// Una botella plana: cuerpo, hombros, cuello, sombra dura de un lado y, a veces, etiqueta.
function drawBottle(ctx, x, base, w, h, color, label) {
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
  ctx.fillStyle = 'rgba(240,220,180,0.22)';
  ctx.fillRect(x + w * 0.14, shoulder - h * 0.04, w * 0.1, h * 0.46);
  ctx.restore();
  if (label) {
    ctx.fillStyle = SCENE.bottleLabel;
    ctx.fillRect(x + 2, base - h * 0.42, w - 4, h * 0.22);
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.fillRect(x + w * 0.62, base - h * 0.42, w * 0.38 - 2, h * 0.22);
  }
}

// Los cuadros: láminas de dos tintas con marco de madera.
function drawPicture(ctx, w, h, kind, bg, fg) {
  ctx.fillStyle = SCENE.frame;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = SCENE.frameLight;
  ctx.fillRect(0, 0, w, 6);
  ctx.fillRect(0, 0, 6, h);
  const m = 34;
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
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const long = i % 2 ? 150 : 112;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - 0.14) * 58, cy + Math.sin(a - 0.14) * 58);
      ctx.lineTo(cx + Math.cos(a) * long, cy + Math.sin(a) * long);
      ctx.lineTo(cx + Math.cos(a + 0.14) * 58, cy + Math.sin(a + 0.14) * 58);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 50, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'guarda') {
    const period = [0, 1, 2, 3, 4, 3, 2, 1];
    for (const lx of [m + 26, w - m - 86]) {
      for (let i = 0; i < 28; i++) ctx.fillRect(lx + period[i % 8] * 12, m + i * 16, 22, 16.5);
    }
    ctx.fillRect(cx - 5, m, 10, h - m * 2);
  } else if (kind === 'espada') {
    ctx.beginPath();
    ctx.moveTo(cx, m + 34);
    ctx.lineTo(cx + 19, cy + 70);
    ctx.lineTo(cx - 19, cy + 70);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(cx - 62, cy + 70, 124, 15);
    ctx.fillRect(cx - 9, cy + 85, 18, 58);
    ctx.beginPath();
    ctx.arc(cx, cy + 156, 16, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // pampa: luna, horizonte y un ombú
    ctx.beginPath();
    ctx.arc(w * 0.68, h * 0.3, 40, 0, Math.PI * 2);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = SCENE.feltInk.replace(/[\d.]+\)$/, '0.75)');
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = fg;
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

// Dorso de las cartas de la tienda: fondo, borde y rombos del color de la tinta, con el nombre al medio.
function backCanvas([bg, ink]) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 394;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fbfaf6';
  ctx.beginPath();
  ctx.roundRect(0, 0, 256, 394, 16);
  ctx.fill();
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(12, 12, 232, 370, 10);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 2;
  for (let k = -400; k < 400; k += 22) {
    ctx.beginPath();
    ctx.moveTo(k, 0);
    ctx.lineTo(k + 394, 394);
    ctx.moveTo(k + 394, 0);
    ctx.lineTo(k, 394);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, 208, 346);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.ellipse(128, 197, 62, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.font = `700 46px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('T', 128, 199);
  return c;
}

// Lo que cada uno tiene delante en la mesa (tienda, ranura "objeto"). colors: los de COSMETIC_LOOK.
function tableObject(id) {
  const col = COSMETIC_LOOK[id]?.colors;
  if (!col) return null;
  const g = new THREE.Group();
  const std = (color, { transparent, opacity } = {}) => toon(color, transparent ? { transparent, opacity } : {});
  if (id === 'mate') {
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 16, 0, Math.PI * 2, 0.35, Math.PI * 0.7), std(col[0], { roughness: 0.7 }));
    cup.position.y = 0.04;
    const yerba = new THREE.Mesh(new THREE.CircleGeometry(0.038, 20), new THREE.MeshLambertMaterial({ color: col[1] }));
    yerba.rotation.x = -Math.PI / 2;
    yerba.position.y = 0.083;
    const bomb = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.16), std(col[2], { metalness: 0.9, roughness: 0.2 }));
    bomb.position.set(0.012, 0.11, 0);
    bomb.rotation.z = -0.25;
    g.add(cup, yerba, bomb);
  } else if (id === 'cafe') {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.008, 24), std(col[0], { roughness: 0.3 }));
    plate.position.y = 0.004;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.026, 0.055, 20), std(col[2], { roughness: 0.3 }));
    cup.position.y = 0.035;
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.029, 20), new THREE.MeshLambertMaterial({ color: col[1] }));
    coffee.rotation.x = -Math.PI / 2;
    coffee.position.y = 0.0625;
    g.add(plate, cup, coffee);
  } else if (id === 'porron') {
    const bottle = new THREE.Mesh(
      new THREE.LatheGeometry([[0, 0], [0.032, 0], [0.032, 0.15], [0.012, 0.21], [0.011, 0.25], [0, 0.25]].map(([x, y]) => new THREE.Vector2(x, y)), 20),
      std(col[0], { roughness: 0.15, metalness: 0.1 }),
    );
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.0325, 0.0325, 0.06, 20, 1, true), std(col[1]));
    label.position.y = 0.08;
    g.add(bottle, label);
  } else {
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.03, 0.13, 20, 1, true), std(col[0], { roughness: 0.05, transparent: true, opacity: 0.3 }));
    glass.position.y = 0.065;
    const drink = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.029, 0.09, 20), std(col[1], { roughness: 0.2 }));
    drink.position.y = 0.047;
    const foam = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.033, 0.018, 20), std(col[2], { roughness: 0.9 }));
    foam.position.y = 0.1;
    g.add(glass, drink, foam);
  }
  g.traverse((o) => (o.castShadow = true));
  return g;
}

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
// Acerca `cur` a `target` de forma suave e independiente de los FPS (rate: cuán rápido, en 1/s).
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const CAM_RATE = 14; // suavizado de la cámara
const HEAD_RATE = 9; // suavizado del giro de cabeza de los personajes
const THROW_MS = 360; // carta de la mano a la mesa
// Campo de visión (grados, vertical). Más amplio = ves más mesa y a los costados.
const FOV = { landscape: 70, portrait: 84, zoom: 0.38 };
// La mano se diseñó con estos FOV: al abrir el campo se acerca a la cámara para verse del mismo tamaño.
const HAND_DESIGN_FOV = { landscape: 62, portrait: 78 };
const HAND_DEPTH = 0.62; // distancia de la mano a los ojos (antes de compensar el FOV)
const tanHalf = (deg) => Math.tan(THREE.MathUtils.degToRad(deg / 2));
const FLY_MS = 260; // carta del mazo a cada jugador
const FOLD_MS = 420; // irse al mazo: cada carta vuela hasta el mazo
const FOLD_GAP = 90;

// dónde quedan tus cartas en la mesa (fracción del radio desde el centro) y la mano en pantalla
const MY_TABLE_START = 0.42;
const MY_TABLE_SIDE = -0.12; // y corridas a la izquierda (la mano está abajo al centro)
const HAND_X = 0.05;

export class TableScene {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    container.appendChild(this.renderer.domElement);
    this.pendingLabels = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SCENE.background);
    this.scene.fog = new THREE.Fog(SCENE.fog, 7, 16);
    this.camera = new THREE.PerspectiveCamera(FOV.landscape, 1, 0.02, 40);
    this.scene.add(this.camera);

    this.yaw = this.tYaw = 0; // actual y objetivo: la cámara se acerca al objetivo suavemente
    this.pitch = this.tPitch = -0.32;
    this.n = 2;
    this.me = 0;
    this.spectator = false;
    this.R = 0.9;
    this.chars = new Map(); // seat -> { mesh, canvas, ctx, tex, look, state }
    this.tableCards = new Map(); // "seat:idx" -> card
    // cartelito con el nombre de cada carta de la mesa (de lejos no se distinguen): al pasar el mouse se va y se ve la carta
    this.cardLabels = document.createElement('div');
    this.cardLabels.className = 'card-labels';
    this.cardLabelEls = new Map(); // "seat:idx" -> elemento
    this.tipCard = null;
    this.handCards = [];
    this.selected = null;
    this.hover = null;
    this.tweens = [];
    this.lookTarget = undefined;
    this.onLook = null;
    this.onCardClick = null;
    this.onCardDouble = null;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.handGroup = new THREE.Group();
    this.camera.add(this.handGroup);

    this.buildRoom();
    this.tableGroup = new THREE.Group();
    this.scene.add(this.tableGroup);
    this.bindControls();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // Se frena el dibujo cuando la escena no está a la vista (hay una para jugar y otra para las revisiones).
  pause() {
    this.renderer.setAnimationLoop(null);
  }

  resume() {
    this.clock.getDelta();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ------------------------------------------------------------ salón
  buildRoom() {
    const s = this.scene;
    const ROOM = 5; // media pared: una habitación de verdad, con las molduras rectas
    const WALL_H = 4.2;
    s.add(new THREE.HemisphereLight(SCENE.hemiSky, SCENE.hemiGround, LIGHT.ambient));
    const lamp = new THREE.SpotLight(SCENE.lamp, LIGHT.lamp, 7, Math.PI / 3.2, LIGHT.lampSoftness, 1.6);
    lamp.position.set(0, 2.55, 0);
    lamp.target.position.set(0, 0, 0);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(2048, 2048);
    lamp.shadow.bias = -0.0004;
    s.add(lamp, lamp.target);
    const fill = new THREE.PointLight(SCENE.fill, LIGHT.fill, 9, 1.4);
    fill.position.set(-2.5, 2.2, -2);
    s.add(fill);

    // lámpara colgante
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.26, 32, 1, true), toon(SCENE.lampShade, { side: THREE.DoubleSide }));
    shade.position.set(0, 2.62, 0);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: SCENE.bulb }));
    bulb.position.set(0, 2.55, 0);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.2), new THREE.MeshBasicMaterial({ color: SCENE.cord }));
    cord.position.set(0, 3.3, 0);
    s.add(shade, bulb, cord);

    // piso de tablones, en pocos tonos
    const floorTex = canvasTex(1024, 1024, (ctx, w, h) => {
      const r = seeded(11);
      const rows = 10;
      for (let i = 0; i < rows; i++) {
        const y = (i * h) / rows;
        let x = -r() * 200;
        while (x < w) {
          const len = 260 + r() * 320;
          ctx.fillStyle = SCENE.floor[Math.floor(r() * SCENE.floor.length)];
          ctx.fillRect(x, y, len, h / rows);
          ctx.fillStyle = SCENE.floorSeam;
          ctx.fillRect(x, y, 4, h / rows);
          x += len;
        }
        ctx.fillStyle = SCENE.floorSeam;
        ctx.fillRect(0, y, w, 4);
      }
      noise(ctx, w, h, 8);
    }, [4, 4]);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM * 2, ROOM * 2), toon(null, { map: floorTex }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM * 2, ROOM * 2), new THREE.MeshBasicMaterial({ color: SCENE.ceiling }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = WALL_H;
    s.add(ceiling);

    // boiserie oscura: paneles, dos molduras y zócalo. Sin luces: viene pintada.
    const yAt = (m) => (1 - m / WALL_H) * 1024; // altura en metros -> píxel de la textura
    const wallTex = canvasTex(1024, 1024, (ctx, w, h) => {
      for (let x = 0; x < w; x += 128) {
        ctx.fillStyle = (x / 128) % 2 ? SCENE.wallAlt : SCENE.wall;
        ctx.fillRect(x, 0, 128, h);
        ctx.fillStyle = SCENE.wallSeam;
        ctx.fillRect(x, 0, 5, h);
      }
      ctx.fillStyle = SCENE.wallBase;
      ctx.fillRect(0, yAt(0.92), w, h - yAt(0.92));
      const rail = (m, thick) => {
        const y = yAt(m);
        ctx.fillStyle = SCENE.wallTrim;
        ctx.fillRect(0, y, w, thick);
        ctx.fillStyle = SCENE.wallTrimLight;
        ctx.fillRect(0, y, w, 3);
        ctx.fillStyle = SCENE.wallSeam;
        ctx.fillRect(0, y + thick, w, thick * 0.9);
      };
      rail(2.96, 12);
      rail(1.72, 14);
      rail(0.92, 16);
      // penumbra pintada arriba
      for (const [from, to, a] of [[0, 180, 0.42], [180, 300, 0.2]]) {
        ctx.fillStyle = `rgba(6,3,2,${a})`;
        ctx.fillRect(0, from, w, to - from);
      }
      noise(ctx, w, h, 6);
    }, [3, 1]);
    const wallMat = new THREE.MeshBasicMaterial({ map: wallTex });
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(ROOM * 2, WALL_H), wallMat);
      m.position.set(Math.sin(a) * ROOM, WALL_H / 2, Math.cos(a) * ROOM);
      m.rotation.y = a + Math.PI;
      s.add(m);
    }

    // estantería de botellas en la pared de enfrente
    const BAR_W = 6.4;
    const BAR_H = 2.5;
    const barTex = canvasTex(1536, 600, (ctx, w, h) => {
      const r = seeded(37);
      ctx.fillStyle = SCENE.shelfBack;
      ctx.fillRect(0, 0, w, h);
      const shelves = [190, 390, 584];
      for (const base of shelves) {
        let x = 24 + r() * 30;
        while (x < w - 60) {
          const bw = 30 + r() * 18;
          const bh = 118 + r() * 46;
          drawBottle(ctx, x, base, bw, bh, SCENE.bottles[Math.floor(r() * SCENE.bottles.length)], r() < 0.7);
          x += bw + 12 + r() * (r() < 0.2 ? 90 : 26);
        }
        ctx.fillStyle = SCENE.shelf;
        ctx.fillRect(0, base, w, 16);
        ctx.fillStyle = SCENE.wallTrimLight;
        ctx.fillRect(0, base, w, 2.5);
      }
      ctx.lineWidth = 16;
      ctx.strokeStyle = SCENE.shelf;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      for (const x of [w / 3, (2 * w) / 3]) {
        ctx.fillStyle = SCENE.shelf;
        ctx.fillRect(x - 8, 0, 16, h);
      }
      ctx.fillStyle = SCENE.barDim; // que no le gane a los personajes
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 6);
    });
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(BAR_W, BAR_H), new THREE.MeshBasicMaterial({ map: barTex }));
    bar.position.set(0, 1.0 + BAR_H / 2, -ROOM + 0.04);
    s.add(bar);

    // cuadros ilustrados en las paredes de los costados
    SCENE.pictures.forEach(([kind, bg, fg], i) => {
      const t = canvasTex(384, 512, (ctx, w, h) => drawPicture(ctx, w, h, kind, bg, fg));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.2), new THREE.MeshBasicMaterial({ map: t }));
      const side = i < 2 ? -1 : 1;
      m.position.set(side * (ROOM - 0.04), 2.3, i % 2 ? 1.9 : -1.9);
      m.rotation.y = -side * (Math.PI / 2);
      s.add(m);
    });
  }

  // ------------------------------------------------------------ mesa según cantidad de jugadores
  setLayout({ n, me, spectator }) {
    if (this.n === n && this.me === me && this.spectator === spectator && this.tableBuilt) return;
    this.n = n;
    this.me = me ?? 0;
    this.spectator = !!spectator;
    this.R = n === 2 ? 0.78 : n === 4 ? 0.95 : 1.18;
    this.tableBuilt = true;
    const g = this.tableGroup;
    while (g.children.length) g.remove(g.children[0]);
    for (const c of this.chars.values()) this.scene.remove(c.mesh, c.chair);
    this.chars.clear();
    for (const c of this.tableCards.values()) this.scene.remove(c);
    this.tableCards.clear();

    const R = this.R;
    // paño: verde con trama, costura alrededor y el nombre al centro
    const felt = feltTex(this.feltColors || SCENE.felt, n === 6 ? 6 : 4);
    // madera con veta
    const woodTex = canvasTex(512, 128, (ctx, w, h) => {
      const r = seeded(5);
      ctx.fillStyle = SCENE.wood;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 14; i++) {
        const y = r() * h;
        const x = r() * w;
        const len = 120 + r() * 260;
        ctx.fillStyle = SCENE.woodStreak[i % 2];
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + len / 2, y + 2.5, x + len, y);
        ctx.quadraticCurveTo(x + len / 2, y - 2.5, x, y);
        ctx.fill();
      }
      noise(ctx, w, h, 5);
    }, [6, 1]);
    // Mesa de bar: cuadrada para 2 y 4 (cada uno en un lado), hexagonal para 6.
    // Marco de madera con canto redondeado y paño adentro.
    const sides = n === 6 ? 6 : 4;
    const frameW = 0.09;
    const polyShape = (apothem, round) => {
      const shape = new THREE.Shape();
      const rv = apothem / Math.cos(Math.PI / sides);
      const pts = [];
      for (let k = 0; k < sides; k++) {
        // los lados quedan de frente a cada asiento (asiento k en el ángulo k * 2pi/n, yo en +z)
        const a = (k * Math.PI * 2) / sides + Math.PI / sides;
        pts.push(new THREE.Vector2(Math.sin(a) * rv, -Math.cos(a) * rv));
      }
      for (let k = 0; k < sides; k++) {
        const p0 = pts[(k + sides - 1) % sides];
        const p1 = pts[k];
        const p2 = pts[(k + 1) % sides];
        const a = p1.clone().lerp(p0, round);
        const b = p1.clone().lerp(p2, round);
        if (k === 0) shape.moveTo(a.x, a.y);
        else shape.lineTo(a.x, a.y);
        shape.quadraticCurveTo(p1.x, p1.y, b.x, b.y);
      }
      shape.closePath();
      return shape;
    };
    const feltShape = polyShape(R, 0.16);
    const feltGeo = new THREE.ShapeGeometry(feltShape, 24);
    // UV del paño según la posición (para que la textura no se deforme)
    const pos = feltGeo.attributes.position;
    const uv = feltGeo.attributes.uv;
    const span = (R / Math.cos(Math.PI / sides)) * 2;
    for (let k = 0; k < pos.count; k++) uv.setXY(k, pos.getX(k) / span + 0.5, pos.getY(k) / span + 0.5);
    const top = new THREE.Mesh(feltGeo, toon(null, { map: felt }));
    this.feltMesh = top;
    this.seatObjs = new Map(); // la mesa es nueva: los objetos de cada uno se vuelven a poner
    top.rotation.x = -Math.PI / 2;
    top.position.y = TABLE_Y;
    top.receiveShadow = true;
    const wood = toon(null, { map: woodTex });
    const woodDark = toon(SCENE.woodDark, { map: woodTex });
    // marco: forma de afuera con el agujero del paño, extruido con bisel
    const outer = polyShape(R + frameW, 0.18);
    outer.holes.push(polyShape(R - 0.002, 0.16));
    const frameGeo = new THREE.ExtrudeGeometry(outer, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.016, bevelSegments: 4, curveSegments: 24 });
    const frame = new THREE.Mesh(frameGeo, wood);
    frame.rotation.x = -Math.PI / 2;
    frame.position.y = TABLE_Y - 0.03;
    frame.castShadow = frame.receiveShadow = true;
    // faldón debajo del tablero
    const skirtShape = polyShape(R - 0.02, 0.18);
    const skirt = new THREE.Mesh(new THREE.ExtrudeGeometry(skirtShape, { depth: 0.09, bevelEnabled: false, curveSegments: 16 }), woodDark);
    skirt.rotation.x = -Math.PI / 2;
    skirt.position.y = TABLE_Y - 0.13;
    skirt.castShadow = true;
    g.add(top, frame, skirt);
    // patas torneadas en las esquinas
    const legGeo = new THREE.LatheGeometry(
      [[0, 0], [0.032, 0], [0.034, 0.03], [0.026, 0.08], [0.03, 0.3], [0.04, 0.36], [0.03, 0.42], [0.034, TABLE_Y - 0.14], [0.038, TABLE_Y - 0.13], [0, TABLE_Y - 0.13]].map(([x, y]) => new THREE.Vector2(x, y)),
      16
    );
    const legR = (R - 0.07) / Math.cos(Math.PI / sides);
    const legCount = sides === 6 ? 6 : 4;
    for (let k = 0; k < legCount; k++) {
      const a = (k * Math.PI * 2) / sides + Math.PI / sides;
      const leg = new THREE.Mesh(legGeo, woodDark);
      leg.position.set(Math.sin(a) * legR * 0.92, 0, Math.cos(a) * legR * 0.92);
      leg.castShadow = true;
      g.add(leg);
    }

    // vaso de vino y botella para ambientar
    const glassMat = toon(SCENE.glass, { transparent: true, opacity: 0.3 });
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.1, 20, 1, true), glassMat);
    const wine = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.025, 0.05, 20), toon(SCENE.wine));
    glass.position.set(-R * 0.55, TABLE_Y + 0.05, R * 0.5);
    wine.position.set(-R * 0.55, TABLE_Y + 0.026, R * 0.5);
    const bottle = new THREE.Mesh(
      new THREE.LatheGeometry([[0, 0], [0.04, 0], [0.04, 0.2], [0.015, 0.26], [0.014, 0.32], [0, 0.32]].map(([x, y]) => new THREE.Vector2(x, y)), 20),
      toon(SCENE.bottle)
    );
    bottle.position.set(-R * 0.66, TABLE_Y, -R * 0.5);
    bottle.castShadow = glass.castShadow = true;
    g.add(glass, wine, bottle);

    // mazo: dos mitades para poder animar el mezclado y el corte
    this.deck = new THREE.Group();
    this.muestraId = undefined; // el mazo es nuevo: hay que volver a poner la muestra
    this.muestraCard = null;
    const side = toon(SCENE.deckSide);
    const half = () => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(CARD_W, 0.01, CARD_H), [side, side, new THREE.MeshLambertMaterial({ map: cardTex('back') }), side, side, side]);
      m.castShadow = true;
      return m;
    };
    this.deckLow = half();
    this.deckHigh = half();
    this.deckLow.position.y = 0.005;
    this.deckHigh.position.y = 0.015;
    this.deck.add(this.deckLow, this.deckHigh);
    g.add(this.deck);

    // mate de decoración
    const mate = new THREE.Group();
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 16, 0, Math.PI * 2, 0.35, Math.PI * 0.7), toon(SCENE.mate));
    cup.position.y = 0.04;
    const yerba = new THREE.Mesh(new THREE.CircleGeometry(0.038, 20), new THREE.MeshLambertMaterial({ color: SCENE.yerba }));
    yerba.rotation.x = -Math.PI / 2;
    yerba.position.y = 0.083;
    const bomb = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.16), toon(SCENE.bombilla));
    bomb.position.set(0.012, 0.11, 0);
    bomb.rotation.z = -0.25;
    mate.add(cup, yerba, bomb);
    mate.position.set(R * 0.62, TABLE_Y, -R * 0.42);
    mate.traverse((o) => (o.castShadow = true));
    g.add(mate);

    // personajes (todos menos yo, salvo que sea espectador)
    for (let s = 0; s < n; s++) {
      if (!this.spectator && s === this.me) continue;
      this.addCharacter(s);
    }
    this.placeCamera();
  }

  seatAngle(seat) {
    const k = (seat - this.me + this.n) % this.n;
    return (k * Math.PI * 2) / this.n + (this.spectator ? Math.PI / this.n : 0);
  }

  seatDir(seat) {
    const a = this.seatAngle(seat);
    return new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
  }

  addCharacter(seat) {
    const canvas = document.createElement('canvas');
    canvas.width = CW;
    canvas.height = CH;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(CHAR_W, CHAR_H),
      new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide })
    );
    const d = this.seatDir(seat);
    const r = this.R + 0.3;
    mesh.position.set(d.x * r, CHAR_H / 2, d.z * r);
    this.scene.add(mesh);
    // silla
    const wood = toon(SCENE.chair);
    const chair = new THREE.Group();
    const seatM = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.44), wood);
    seatM.position.y = 0.46;
    const backM = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.04), wood);
    backM.position.set(0, 0.8, 0.22);
    chair.add(seatM, backM);
    for (const [x, z] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.46, 0.04), wood);
      l.position.set(x, 0.23, z);
      chair.add(l);
    }
    chair.traverse((o) => (o.castShadow = true));
    const cr = this.R + 0.5;
    chair.position.set(d.x * cr, 0, d.z * cr);
    chair.rotation.y = this.seatAngle(seat);
    this.scene.add(chair);
    const c = { seat, mesh, chair, canvas, ctx, tex, look: lookFor('?', seat), name: '?', state: { expr: 'neutral', talking: false, cards: 0 }, gaze: 'table', exprUntil: 0, talkUntil: 0, dirty: true };
    this.chars.set(seat, c);
  }

  setPlayers(seats, handCounts) {
    seats.forEach((p, seat) => this.setSeatObject(seat, p?.cos?.objeto));
    for (const [seat, c] of this.chars) {
      const p = seats[seat];
      const name = p?.name || '';
      const key = name + JSON.stringify(p?.cos || {});
      if (key !== c.key) {
        c.key = key;
        c.name = name;
        c.look = dressed(lookFor(name, seat), p?.cos);
        c.dirty = true;
      }
      c.mesh.visible = !!p;
      const cards = handCounts ? handCounts[seat] ?? 0 : 0;
      if (cards !== c.state.cards) {
        c.state.cards = cards;
        c.dirty = true;
      }
    }
  }

  // Lo que tiene delante cada uno (tienda): a la derecha de su lugar, sobre el paño.
  setSeatObject(seat, id) {
    const cur = this.seatObjs?.get(seat);
    if ((cur?.id || null) === (id || null) || !this.seatObjs) return;
    if (cur) this.tableGroup.remove(cur.obj);
    this.seatObjs.delete(seat);
    const obj = id && tableObject(id);
    if (!obj) return;
    const d = this.seatDir(seat);
    const side = new THREE.Vector3(-d.z, 0, d.x); // a la derecha de quien está sentado ahí
    const p = d.clone().multiplyScalar(this.R * 0.72).add(side.multiplyScalar(this.R * 0.42));
    obj.position.set(p.x, TABLE_Y, p.z);
    this.tableGroup.add(obj);
    this.seatObjs.set(seat, { id, obj });
  }

  // El paño y el dorso del mazo del anfitrión (tienda). null = los de siempre.
  setTable({ pano = null, dorso = null } = {}) {
    const felt = COSMETIC_LOOK[pano]?.felt || SCENE.felt;
    if (this.feltColors !== felt) {
      this.feltColors = felt;
      if (this.feltMesh) {
        this.feltMesh.material.map?.dispose();
        this.feltMesh.material.map = feltTex(felt, this.n === 6 ? 6 : 4);
        this.feltMesh.material.needsUpdate = true;
      }
    }
    const back = COSMETIC_LOOK[dorso]?.back || null;
    if (this.backKey === (dorso || null)) return;
    const t = cardTex('back');
    // el dorso de siempre es una imagen que puede no haber llegado todavía: se espera
    if (!t.userData.orig) {
      if (!t.image?.complete) return setTimeout(() => this.setTable({ pano, dorso }), 300);
      t.userData.orig = t.image;
    }
    this.backKey = dorso || null;
    t.image = back ? backCanvas(back) : t.userData.orig;
    t.needsUpdate = true;
  }

  setGaze(seat, target) {
    const c = this.chars.get(seat);
    if (!c) return;
    c.gaze = target;
    c.dirty = true;
  }

  showSena(seat, sena, ms = SENA_MS) {
    const c = this.chars.get(seat);
    const s = SENAS[sena];
    if (!c || !s) return;
    c.state.expr = s.expr;
    c.exprUntil = performance.now() + ms;
    c.dirty = true;
  }

  speak(seat, ms = 1400) {
    const c = this.chars.get(seat);
    if (!c) return;
    c.talkUntil = performance.now() + ms;
  }

  // Ángulo (visto desde la cámara) de una dirección horizontal en la que apunta el personaje:
  // 0 = hacia la cámara, positivo = hacia la derecha de la imagen.
  viewYaw(c, dir) {
    const toCam = this.camera.position.clone().sub(c.mesh.position);
    toCam.y = 0;
    toCam.normalize();
    const right = new THREE.Vector3(toCam.z, 0, -toCam.x);
    return Math.atan2(dir.dot(right), dir.dot(toCam));
  }

  // Cuerpo mirando al centro de la mesa (como en el truco real: todos enfrentados) y
  // cabeza girada hacia quien está mirando.
  poseFor(c) {
    const center = new THREE.Vector3(0, c.mesh.position.y, 0);
    const bodyDir = center.sub(c.mesh.position).setY(0).normalize();
    const bodyYaw = this.viewYaw(c, bodyDir);
    const t = c.gaze;
    let target = null;
    let down = 0;
    if (t === 'table' || t === null || t === undefined) {
      down = 1;
    } else if (!this.spectator && t === this.me) {
      target = this.camera.position.clone();
    } else if (this.chars.get(t)) {
      target = this.chars.get(t).mesh.position.clone();
    }
    let headYaw = bodyYaw;
    if (target) {
      const dir = target.sub(c.mesh.position).setY(0).normalize();
      headYaw = this.viewYaw(c, dir);
    } else {
      headYaw = bodyYaw * 0.9;
    }
    return { bodyYaw, headYaw, down };
  }

  updateCharacter(c, now, dt = 1 / 60) {
    const expr = now < c.exprUntil ? c.state.expr : 'neutral';
    const talking = now < c.talkUntil && Math.floor(now / 130) % 2 === 0;
    const pose = this.poseFor(c);
    const st = c.state;
    st.bodyYaw = pose.bodyYaw;
    const near = (a, b) => Math.abs(a - b) < 0.015;
    const settled = near(st.headYaw ?? 99, pose.headYaw) && near(st.down ?? 99, pose.down);
    const bite = expr === 'bite' ? biteAt(now) : 1;
    if (!c.dirty && settled && bite === c.drawnBite && expr === c.drawnExpr && talking === c.drawnTalk && near(c.drawnBody ?? 99, pose.bodyYaw)) return;
    // la cabeza gira suave
    st.headYaw = st.headYaw === undefined ? pose.headYaw : damp(st.headYaw, pose.headYaw, HEAD_RATE, dt);
    st.down = st.down === undefined ? pose.down : damp(st.down, pose.down, HEAD_RATE, dt);
    if (near(st.headYaw, pose.headYaw)) st.headYaw = pose.headYaw;
    if (near(st.down, pose.down)) st.down = pose.down;
    drawCharacter(c.ctx, c.look, { ...st, expr, talking, bite });
    c.tex.needsUpdate = true;
    c.drawnBite = bite;
    c.drawnExpr = expr;
    c.drawnTalk = talking;
    c.drawnBody = pose.bodyYaw;
    c.dirty = false;
  }

  // ------------------------------------------------------------ cámara
  placeCamera() {
    if (this.spectator) {
      this.camera.position.set(0, 2.3, this.R + 1.6);
      this.yaw = this.tYaw = 0;
      this.pitch = this.tPitch = -0.55;
    } else {
      this.camera.position.set(0, EYE_Y, this.R + 0.24);
      this.yaw = this.tYaw = 0;
      this.pitch = this.tPitch = -0.3; // más alto: se mira un poco más para abajo para ver la mesa
    }
    this.applyCamera();
  }

  applyCamera() {
    if (this.spectator) {
      // el espectador gira alrededor de la mesa
      const r = this.R + 1.7;
      this.camera.position.set(Math.sin(this.yaw) * r, 2.2, Math.cos(this.yaw) * r);
      this.camera.lookAt(0, TABLE_Y + this.pitch * 0.6 + 0.3, 0);
      return;
    }
    this.clampView();
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    // al mirar para abajo te inclinás sobre la mesa, como en la vida real
    const lean = THREE.MathUtils.smoothstep(-this.pitch, 0.3, 1.0);
    this.camera.position.set(-Math.sin(this.yaw) * 0.12 * lean, EYE_Y + 0.2 * lean, this.R + 0.24 - 0.42 * lean);
  }

  // Límites de hacia dónde se puede mirar (sentado no se da vuelta del todo).
  clampView() {
    if (this.spectator) return;
    const { clamp } = THREE.MathUtils;
    this.tYaw = clamp(this.tYaw, -2.0, 2.0);
    this.tPitch = clamp(this.tPitch, -1.25, 0.35);
    this.yaw = clamp(this.yaw, -2.0, 2.0);
    this.pitch = clamp(this.pitch, -1.25, 0.35);
  }

  lookAtSeat(seat) {
    if (this.spectator) return;
    if (seat === 'table') {
      this.animateView(this.tYaw * 0.3, -0.78);
      return;
    }
    const c = this.chars.get(seat);
    if (!c) return;
    const p = c.mesh.position.clone().sub(this.camera.position);
    const yaw = Math.atan2(-p.x, -p.z);
    this.animateView(yaw, -0.12);
  }

  // Gira la cabeza hacia (yaw, pitch); el frame la lleva hasta ahí con suavidad.
  animateView(yaw, pitch) {
    this.tYaw = yaw;
    this.tPitch = pitch;
    this.clampView();
  }

  computeLookTarget() {
    if (this.spectator) return null;
    if (this.pitch < -0.55) return 'table';
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    fwd.y = 0;
    fwd.normalize();
    let best = null;
    let bestA = 0.34;
    for (const [seat, c] of this.chars) {
      if (!c.mesh.visible) continue;
      const d = c.mesh.position.clone().sub(this.camera.position);
      d.y = 0;
      d.normalize();
      const a = Math.acos(THREE.MathUtils.clamp(fwd.dot(d), -1, 1));
      if (a < bestA) {
        bestA = a;
        best = seat;
      }
    }
    return best;
  }

  bindControls() {
    const el = this.renderer.domElement;
    let down = null;
    let moved = 0;
    el.addEventListener('pointerdown', (e) => {
      this.setPointer(e);
      const card = this.pickHand();
      down = { x: e.clientX, y: e.clientY, yaw: this.tYaw, pitch: this.tPitch, card };
      moved = 0;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      this.setPointer(e);
      if (!down) return this.updateHover();
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
      if (moved <= 6) return;
      if (down.card) {
        // arrastrando una carta de la mano: se reordena según dónde esté el mouse
        this.dragging = down.card;
        this.reorderTo(down.card, this.pointer.x);
        el.style.cursor = 'grabbing';
        return;
      }
      const k = 2.6 / el.clientWidth;
      this.tYaw = down.yaw - dx * k * (this.spectator ? 1.4 : 1);
      this.tPitch = down.pitch - dy * k;
      this.clampView();
    });
    const up = (e) => {
      if (down && moved <= 6) this.click(e);
      this.dragging = null;
      down = null;
      this.updateHover();
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', () => {
      down = null;
      this.dragging = null;
    });
    el.addEventListener('pointerleave', () => this.showCardTip(null));
    el.addEventListener('dblclick', (e) => {
      this.setPointer(e);
      const card = this.pickHand();
      if (card && this.onCardDouble) this.onCardDouble(card.userData.id);
    });
    el.addEventListener('wheel', (e) => {
      this.tPitch -= e.deltaY * 0.0015;
      this.clampView();
    }, { passive: true });
    this.keys = new Set();
    window.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, select')) return;
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  // Mueve la carta arrastrada al lugar que le corresponde según la x del mouse (-1..1).
  reorderTo(card, ndcX) {
    const n = this.handCards.length;
    if (n < 2) return;
    // la mano ocupa más o menos el centro de la pantalla: repartimos el ancho entre las cartas
    const span = 0.32;
    const t = (ndcX + span) / (span * 2);
    const idx = Math.max(0, Math.min(n - 1, Math.round(t * (n - 1))));
    const cur = this.handCards.indexOf(card);
    if (idx === cur) return;
    this.handCards.splice(cur, 1);
    this.handCards.splice(idx, 0, card);
  }

  setPointer(e) {
    this.pointerPx = { x: e.clientX, y: e.clientY };
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  pickHand() {
    if (!this.handCards.length) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.handCards, true);
    if (!hits.length) return null;
    // se dibujan sin profundidad: gana la que está más arriba en el abanico (la última)
    let best = null;
    for (const h of hits) {
      let o = h.object;
      while (o && !this.handCards.includes(o)) o = o.parent;
      if (o && (!best || this.handCards.indexOf(o) > this.handCards.indexOf(best))) best = o;
    }
    return best;
  }

  updateHover() {
    const card = this.pickHand();
    this.hover = card;
    this.renderer.domElement.style.cursor = card ? 'grab' : 'default';
    this.showCardTip(card ? null : this.pickTable());
  }

  // Carta de la mesa bajo el puntero (la más cercana a la cámara, o sea la de arriba).
  pickTable() {
    if (!this.tableCards.size) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects([...this.tableCards.values()], true)[0];
    let o = hit?.object;
    while (o && !o.userData.front) o = o.parent;
    return o || null;
  }

  // La carta que se está mirando pierde su cartelito para que se vea entera. ms: en el celular, por un rato.
  showCardTip(card, ms = 0) {
    clearTimeout(this.cardTipT);
    this.tipCard = card || null;
    if (card && ms) this.cardTipT = setTimeout(() => (this.tipCard = null), ms);
  }

  // Cartelitos de las cartas de la mesa: quedan sobre la parte de la carta que no tapa la siguiente.
  updateCardLabels() {
    if (this.pendingLabels) {
      this.pendingLabels = false;
      this.container.appendChild(this.cardLabels);
    }
    const r = this.renderer.domElement.getBoundingClientRect();
    const p = new THREE.Vector3();
    for (const [key, el] of this.cardLabelEls) {
      if (this.tableCards.has(key)) continue;
      el.remove();
      this.cardLabelEls.delete(key);
    }
    for (const [key, card] of this.tableCards) {
      const { id, faceDown, burned } = card.userData;
      let el = this.cardLabelEls.get(key);
      const [seat, idx] = key.split(':').map(Number);
      // dos encimadas: la de abajo no se ve, no lleva cartel
      const top = this.tableCards.get(`${seat}:${idx + 1}`);
      const covered = top && top.position.distanceTo(card.position) < CARD_H * 0.2;
      if (!id || id === 'back' || id === 'blank' || faceDown || covered) {
        if (el) el.style.display = 'none';
        continue;
      }
      if (!el) {
        el = document.createElement('div');
        el.className = 'card-label';
        this.cardLabels.appendChild(el);
        this.cardLabelEls.set(key, el);
      }
      const name = cardName(id);
      const text = name[0].toUpperCase() + name.slice(1) + (burned ? ' · quemada' : '');
      if (el.textContent !== text) el.textContent = text;
      p.copy(card.position).addScaledVector(this.seatDir(seat), CARD_H * TABLE_CARD_SCALE * 0.28).project(this.camera);
      const visible = p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && this.tipCard !== card;
      el.style.display = visible ? '' : 'none';
      if (visible) el.style.transform = `translate(calc(${((p.x + 1) / 2) * r.width}px - 50%), calc(${((1 - p.y) / 2) * r.height}px - 50%))`;
    }
  }

  // Irse al mazo: las cartas que le quedaban a cada uno vuelan boca abajo hasta el mazo.
  // list: [{ seat, cards }] (cuántas tenía); para las tuyas, salen desde donde estaban en tu mano.
  foldCards(list) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !this.deck) return;
    const deck = this.deck.getWorldPosition(new THREE.Vector3()).setY(TABLE_Y + 0.03);
    const mine = Object.values(this.lastHandPos || {});
    list.forEach(({ seat, cards }) => {
      for (let i = 0; i < cards; i++) {
        const start = !this.spectator && seat === this.me && mine[i] ? mine[i].clone() : this.handOrigin(seat);
        setTimeout(() => {
          const card = makeCard('back', true);
          card.rotation.set(Math.PI / 2, 0, this.seatAngle(seat));
          card.position.copy(start);
          this.scene.add(card);
          this.tween(FOLD_MS, (t) => {
            const e = easeOut(t);
            card.position.lerpVectors(start, deck, e);
            card.position.y += Math.sin(Math.PI * e) * 0.14;
            card.rotation.z = this.seatAngle(seat) + e * 1.4;
          }, () => this.scene.remove(card));
        }, i * FOLD_GAP);
      }
    });
  }

  click(e) {
    this.setPointer(e);
    const card = this.pickHand();
    if (card && this.onCardClick) this.onCardClick(card.userData.id);
    // en el celular no hay hover: tocar una carta de la mesa muestra su nombre un momento
    if (!card && e.pointerType !== 'mouse') this.showCardTip(this.pickTable(), 1800);
  }

  // ------------------------------------------------------------ mis cartas (en la mano, pegadas a la cámara)
  // Colores de tu propia mano y manga (los de tu personaje).
  setMyLook(look) {
    const sleeve = sleeveOf(look);
    const key = look.skin[0] + sleeve;
    if (this.handKey === key) return;
    this.handKey = key;
    const mk = (canvas, w, h, order) => {
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false, alphaTest: 0.05 }));
      m.renderOrder = order;
      return m;
    };
    if (this.palm) this.handGroup.remove(this.palm, this.thumb);
    this.palm = mk(drawHoldBack(look.skin[0], sleeve), 0.36, 0.36, 9);
    this.thumb = mk(drawHoldThumb(look.skin[0]), 0.1, 0.1, 40);
    this.handGroup.add(this.palm, this.thumb);
    this.reachTex?.dispose();
    this.reachTex = new THREE.CanvasTexture(drawReach(look.skin[0], sleeve));
    this.reachTex.colorSpace = THREE.SRGBColorSpace;
  }

  setMyCards(cards, selected) {
    const ids = cards.join(',');
    if (ids !== this.handIds) {
      this.handIds = ids;
      // guardo dónde estaba cada carta para que la mano la lleve desde ahí hasta la mesa
      this.lastHandPos = {};
      for (const c of this.handCards) {
        this.lastHandPos[c.userData.id] = c.getWorldPosition(new THREE.Vector3());
        this.handGroup.remove(c);
      }
      const order = this.handOrder || [];
      const sorted = cards.slice().sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
      this.handCards = sorted.map((id) => {
        const c = makeCard(id, false);
        c.scale.setScalar(1.1);
        c.traverse((o) => {
          if (o.material) {
            o.material.depthTest = false;
            o.material.transparent = true;
          }
        });
        this.handGroup.add(c);
        return c;
      });
    }
    this.selected = selected;
  }

  // Píxeles de abajo de la pantalla tapados por la interfaz (en celular el panel va a todo el ancho).
  setBottomInset(px) {
    this.bottomInset = Math.max(0, px || 0);
  }

  layoutHand(dt) {
    const n = this.handCards.length;
    if (this.handCards.length) this.handOrder = this.handCards.map((c) => c.userData.id);
    // cuanto más mirás para abajo, más se baja la mano (para ver la mesa)
    const lowered = THREE.MathUtils.clamp((-this.pitch - 0.35) / 0.45, 0, 1);
    // si la interfaz tapa la parte de abajo, la mano sube lo justo (suave)
    const h = this.renderer.domElement.clientHeight || 1;
    const depth = HAND_DEPTH * this.handGroup.scale.z; // profundidad real después de compensar el FOV
    const lift = ((this.bottomInset || 0) / h) * 2 * tanHalf(this.camera.fov) * depth;
    this.handLift = damp(this.handLift || 0, lift, 10, dt);
    // la mano va un poco a la derecha: así no tapa las cartas que tiraste (quedan adelante tuyo, al centro)
    const pivot = new THREE.Vector3(HAND_X, -0.32 - lowered * 0.1 + this.handLift, -HAND_DEPTH);
    const mid = (n - 1) / 2;
    this.handCards.forEach((c, i) => {
      const a = (mid - i) * 0.3;
      const isSel = this.selected === c.userData.id;
      const isHover = this.hover === c || this.dragging === c;
      const len = 0.1 + (isSel ? 0.05 : isHover ? 0.02 : 0);
      const target = new THREE.Vector3(pivot.x - Math.sin(a) * len, pivot.y + Math.cos(a) * len, pivot.z + i * 0.002);
      c.position.lerp(target, Math.min(1, dt * 14));
      c.rotation.set(-0.15, 0, a);
      c.traverse((o) => (o.renderOrder = 10 + i));
    });
    if (this.palm) {
      this.palm.visible = this.thumb.visible = n > 0;
      this.palm.position.set(pivot.x - 0.035, pivot.y - 0.035, pivot.z - 0.01);
      this.thumb.position.set(pivot.x - 0.05, pivot.y + 0.0, pivot.z + 0.01);
      this.thumb.rotation.z = 0.1;
    }
  }

  // Mano derecha que acompaña a la carta hasta la mesa y después se retira.
  reachWith(card, ms) {
    if (!this.reachTex) return;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: this.reachTex, transparent: true, alphaTest: 0.05, depthTest: false }));
    m.renderOrder = 50;
    this.scene.add(m);
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const place = (extra = 0) => {
      right.setFromMatrixColumn(this.camera.matrixWorld, 0);
      up.setFromMatrixColumn(this.camera.matrixWorld, 1);
      m.quaternion.copy(this.camera.quaternion);
      m.position.copy(card.position).addScaledVector(right, 0.097 + extra).addScaledVector(up, -0.024 - extra);
    };
    const remove = () => {
      if (!m.parent) return;
      this.scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    };
    this.tween(ms, () => place(0), () => {
      this.tween(320, (t) => {
        place(t * 0.35);
        m.material.opacity = 1 - t;
      }, remove);
    });
    // por las dudas: nunca queda pegada en la mesa
    setTimeout(remove, ms + 1500);
  }

  // ------------------------------------------------------------ cartas en la mesa
  // table: por asiento, lista de { c, faceDown, under, burned } (ver engine.viewFor).
  syncTable(table, { animate = true } = {}) {
    const seen = new Set();
    table.forEach((list, seat) => {
      const poses = this.tablePoses(seat, list);
      list.forEach((p, idx) => {
        const key = `${seat}:${idx}`;
        seen.add(key);
        let card = this.tableCards.get(key);
        const face = p.c || (p.faceDown ? 'back' : 'blank');
        const pose = poses[idx];
        if (!card) {
          card = makeCard(face, true);
          card.scale.setScalar(TABLE_CARD_SCALE);
          card.userData.faceDown = p.faceDown;
          this.scene.add(card);
          this.tableCards.set(key, card);
          const flip = p.faceDown ? Math.PI : 0;
          const endQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.rot));
          if (flip) endQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
          if (animate) {
            const mine = !this.spectator && seat === this.me;
            const start = (mine && this.lastHandPos?.[p.c]) || this.handOrigin(seat);
            if (mine) this.reachWith(card, THROW_MS);
            const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.4, this.seatAngle(seat), 0));
            card.position.copy(start);
            card.quaternion.copy(q0);
            this.tween(THROW_MS, (t) => {
              const e = easeOut(t);
              card.position.lerpVectors(start, pose.pos, e);
              card.position.y += Math.sin(Math.PI * e) * 0.08;
              card.quaternion.slerpQuaternions(q0, endQ, e);
            });
          } else {
            card.position.copy(pose.pos);
            card.quaternion.copy(endQ);
          }
        } else {
          setCardFace(card, face);
          if (card.userData.faceDown && !p.faceDown) {
            // se dio vuelta (mostró los tantos): queda boca arriba
            card.userData.faceDown = false;
            const q0 = card.quaternion.clone();
            const q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.rot));
            const y0 = card.position.y;
            this.tween(500, (t) => {
              card.quaternion.slerpQuaternions(q0, q1, t);
              card.position.y = y0 + Math.sin(Math.PI * t) * 0.06;
            });
          }
        }
        if (p.burned) burnCard(card);
      });
    });
    for (const [key, card] of this.tableCards) {
      if (!seen.has(key)) {
        this.scene.remove(card);
        this.tableCards.delete(key);
      }
    }
  }

  // Como en la mesa de verdad: cada carta nueva va encima de la anterior, corrida hacia el centro,
  // así se ve un pedazo de la de primera y de segunda. Dos encimadas: la de arriba casi alineada.
  tablePoses(seat, list) {
    const d = this.seatDir(seat);
    const a = this.seatAngle(seat);
    const tangent = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    // las tuyas, más hacia el centro: si no, la mano (que se dibuja encima de todo) las tapa
    const mine = !this.spectator && seat === this.me;
    const start = this.R * (mine ? MY_TABLE_START : this.n === 2 ? 0.55 : 0.62);
    const step = CARD_H * TABLE_CARD_SCALE * 0.36;
    const jitter = [0, 0.006, -0.005];
    const tilt = [0.02, -0.05, 0.04];
    const out = [];
    let radial = start;
    let side = 0;
    let rot = a;
    list.forEach((p, idx) => {
      if (idx > 0) {
        if (p.over && !this.spectator && seat === this.me) {
          // tus dos encimadas, en tu pantalla: la de arriba corrida para que veas que abajo hay otra
          // (los demás las siguen viendo casi alineadas)
          radial -= step * 0.45;
          side += 0.035;
          rot += 0.14;
        } else if (p.over) {
          // dos encimadas: la de arriba queda casi alineada con la de abajo (apenas se nota)
          radial -= 0.003;
          side += 0.002;
          rot += 0.02;
        } else {
          radial -= step;
          side = jitter[idx % 3];
          rot = a + tilt[idx % 3];
        }
      } else {
        rot = a + tilt[0];
      }
      const pos = d.clone().multiplyScalar(radial).addScaledVector(tangent, side + (mine ? MY_TABLE_SIDE : 0));
      pos.y = TABLE_Y + 0.002 + idx * 0.0018;
      out.push({ pos, rot });
    });
    return out;
  }

  handOrigin(seat) {
    if (!this.spectator && seat === this.me) {
      return new THREE.Vector3(0, 1.0, this.R + 0.25);
    }
    const d = this.seatDir(seat);
    return d.multiplyScalar(this.R + 0.15).setY(0.95);
  }

  deckSpot(seat) {
    const d = this.seatDir(seat);
    const a = this.seatAngle(seat);
    const tangent = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    const p = d.multiplyScalar(this.R * 0.74).addScaledVector(tangent, 0.24);
    return { pos: new THREE.Vector3(p.x, TABLE_Y, p.z), rot: a + 0.3 };
  }

  setDealer(seat) {
    if (!this.deck || seat == null || this.dealingAnim) return;
    const { pos, rot } = this.deckSpot(seat);
    this.deck.position.copy(pos);
    this.deck.rotation.y = rot;
    this.deck.visible = true;
    this.resetDeck();
  }

  // Las dos mitades del mazo, una arriba de la otra, sin desplazamientos: el mazo entero.
  // La muestra: boca arriba debajo del mazo, cruzada, asomando la mitad (se mueve con el mazo).
  setMuestra(id) {
    if (!this.deck || this.muestraId === id) return;
    this.muestraId = id;
    if (this.muestraCard) {
      this.deck.remove(this.muestraCard);
      this.muestraCard = null;
    }
    if (!id) return;
    const card = makeCard(id, true);
    card.rotation.set(-Math.PI / 2, 0, Math.PI / 2); // acostada y cruzada respecto del mazo
    card.position.set(CARD_H * 0.32, 0.0004, 0);
    this.muestraCard = card;
    this.deck.add(card);
  }

  resetDeck() {
    this.deckLow.position.set(0, 0.005, 0);
    this.deckHigh.position.set(0, 0.015, 0);
    this.deckLow.rotation.set(0, 0, 0);
    this.deckHigh.rotation.set(0, 0, 0);
  }

  // Animación de una mano nueva (dura lo mismo que la pausa del servidor):
  // el mazo pasa al que reparte, se mezcla, corta el de la izquierda y se reparte de a una
  // hacia la derecha empezando por la mano. onCard(asiento) se llama cuando llega cada carta.
  dealAnim({ dealer, cutter, mano, n, onCard, onDone }) {
    if (!this.deck) return;
    this.dealingAnim = true;
    const d = this.deck;
    const lo = this.deckLow;
    const hi = this.deckHigh;
    const from = d.position.clone();
    const fromRot = d.rotation.y;
    const D = this.deckSpot(dealer);
    const C = this.deckSpot(cutter);
    this.resetDeck();
    d.visible = true;
    // 1) el mazo llega al que reparte y se mezcla (dos mitades que se separan y se intercalan)
    this.tween(TIMING.shuffle, (t) => {
      const k = Math.min(1, t * 4);
      d.position.lerpVectors(from, D.pos, ease(k));
      d.rotation.y = fromRot + (D.rot - fromRot) * ease(k);
      if (t > 0.25) {
        const ph = ((t - 0.25) / 0.75) * 3;
        const f = Math.sin((ph % 1) * Math.PI);
        lo.position.x = -f * 0.07;
        hi.position.x = f * 0.07;
        hi.position.y = 0.015 + f * 0.03;
        hi.rotation.z = f * 0.25;
        lo.rotation.z = -f * 0.25;
      }
    }, () => {
      this.resetDeck();
      // 2) corta el de la izquierda: el mazo va hasta él, levanta la mitad de arriba y la pone abajo
      this.tween(TIMING.cut, (t) => {
        if (t < 0.3) d.position.lerpVectors(D.pos, C.pos, ease(t / 0.3));
        else if (t < 0.55) {
          const k = (t - 0.3) / 0.25;
          hi.position.set(0.13 * ease(k), 0.015 + Math.sin(k * Math.PI) * 0.05, 0);
        } else if (t < 0.75) {
          const k = (t - 0.55) / 0.2;
          lo.position.set(0, 0.005 + 0.01 * ease(k) + Math.sin(k * Math.PI) * 0.05, 0);
          hi.position.set(0.13 * (1 - ease(k)), 0.015 - 0.01 * ease(k), 0);
        } else d.position.lerpVectors(C.pos, D.pos, ease((t - 0.75) / 0.25));
      }, () => {
        // la mitad que se levantó quedó abajo: se intercambian los nombres y el mazo queda entero
        [this.deckLow, this.deckHigh] = [hi, lo];
        d.position.copy(D.pos);
        this.resetDeck();
        // 3) reparte de a una, hacia la derecha, empezando por la mano
        const total = n * 3;
        for (let k = 0; k < total; k++) {
          const seat = (mano + (k % n)) % n;
          setTimeout(() => this.flyCard(D.pos, seat, () => onCard?.(seat)), k * TIMING.dealStep);
        }
        setTimeout(() => {
          this.dealingAnim = false;
          onDone?.();
        }, total * TIMING.dealStep + TIMING.dealTail);
      });
    });
  }

  flyCard(fromPos, seat, done) {
    const card = makeCard('back', true);
    card.rotation.set(-Math.PI / 2, 0, 0);
    card.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI));
    const start = fromPos.clone().setY(TABLE_Y + 0.03);
    const end = this.handOrigin(seat);
    card.position.copy(start);
    this.scene.add(card);
    this.tween(FLY_MS, (t) => {
      card.position.lerpVectors(start, end, easeOut(t));
      card.position.y += Math.sin(Math.PI * t) * 0.06;
    }, () => {
      this.scene.remove(card);
      done?.();
    });
  }

  // ------------------------------------------------------------ utilidades
  tween(ms, fn, done) {
    this.tweens.push({ t0: performance.now(), ms, fn, done });
  }

  // Posición en pantalla de la cabeza de un asiento (para nombres y globos de diálogo).
  screenPos(seat) {
    if (!this.spectator && seat === this.me) return null;
    const c = this.chars.get(seat);
    if (!c) return null;
    const p = c.mesh.position.clone();
    p.y = 1.66; // un poco arriba de la cabeza
    p.project(this.camera);
    const behind = p.z > 1;
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: ((p.x + 1) / 2) * r.width, y: ((1 - p.y) / 2) * r.height, behind, visible: !behind && Math.abs(p.x) < 1.15 && Math.abs(p.y) < 1.2 };
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const now = performance.now();
    // teclado: A/D o flechas para girar, W/S para mirar arriba/abajo
    const k = this.keys;
    if (k && k.size) {
      const sp = 1.8 * dt;
      if (k.has('a') || k.has('arrowleft')) this.tYaw += sp;
      if (k.has('d') || k.has('arrowright')) this.tYaw -= sp;
      if (k.has('w') || k.has('arrowup')) this.tPitch += sp * 0.8;
      if (k.has('s') || k.has('arrowdown')) this.tPitch -= sp * 0.8;
      this.clampView();
    }
    // la cámara sigue al objetivo con suavidad (sin saltos al arrastrar ni al elegir a quién mirar)
    if (Math.abs(this.tYaw - this.yaw) > 1e-4 || Math.abs(this.tPitch - this.pitch) > 1e-4) {
      this.yaw = damp(this.yaw, this.tYaw, CAM_RATE, dt);
      this.pitch = damp(this.pitch, this.tPitch, CAM_RATE, dt);
      this.applyCamera();
    }
    // las animaciones que se encadenan (en done) se agregan a la lista nueva, no se pierden
    const running = this.tweens;
    this.tweens = [];
    const keep = running.filter((tw) => {
      const t = Math.min(1, (now - tw.t0) / tw.ms);
      tw.fn(t);
      if (t >= 1) {
        tw.done?.();
        return false;
      }
      return true;
    });
    this.tweens = keep.concat(this.tweens);
    // zoom temporal manteniendo Z (o el botón de zoom)
    const orient = this.camera.aspect < 1 ? 'portrait' : 'landscape';
    const baseFov = FOV[orient];
    const wantFov = (k && k.has('z')) || this.zoomHeld ? baseFov * FOV.zoom : baseFov;
    // acercar la mano solo en profundidad: con el FOV más amplio se sigue viendo del mismo tamaño
    this.handGroup.scale.z = tanHalf(HAND_DESIGN_FOV[orient]) / tanHalf(baseFov);
    if (Math.abs(this.camera.fov - wantFov) > 0.05) {
      this.camera.fov += (wantFov - this.camera.fov) * Math.min(1, dt * 12);
      this.camera.updateProjectionMatrix();
    }
    this.handGroup.visible = this.camera.fov > baseFov * 0.7;
    this.layoutHand(dt);
    for (const c of this.chars.values()) {
      // billboard: el recorte siempre mira a la cámara (solo gira en Y)
      c.mesh.rotation.y = Math.atan2(this.camera.position.x - c.mesh.position.x, this.camera.position.z - c.mesh.position.z);
      // respira un poquito
      c.mesh.position.y = CHAR_H / 2 + Math.sin(now / 900 + c.seat) * 0.003;
      this.updateCharacter(c, now, dt);
    }
    const target = this.computeLookTarget();
    if (target !== this.lookTarget) {
      this.lookTarget = target;
      this.onLook?.(target);
    }
    this.onFrame?.();
    this.renderer.render(this.scene, this.camera);
    this.updateCardLabels();
  }
}
