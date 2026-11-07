// Escena 3D del truco: salón, mesa con paño, personajes 2D (recortes), cartas y cámara en primera persona.
import * as THREE from 'three';
import { drawCharacter, lookFor, biteAt, W as CW, H as CH } from './characters.js';
import { drawHoldBack, drawHoldThumb, drawReach } from './hands.js';
import { SENAS, SENA_MS, TIMING, ROUTES } from './config.js';
import { newDeck, cardName } from './engine.js';
import { SCENE, CARD, FONT, LIGHT } from './theme.js';

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

export class TableScene {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = LIGHT.exposure;
    maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    container.appendChild(this.renderer.domElement);

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
    // cartel con el nombre de la carta de la mesa que está bajo el mouse (de lejos no se distinguen)
    this.cardTip = document.createElement('div');
    this.cardTip.id = 'card-tip';
    this.cardTip.className = 'hidden';
    document.body.appendChild(this.cardTip);
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

  // ------------------------------------------------------------ salón
  buildRoom() {
    const s = this.scene;
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
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.34, 0.26, 32, 1, true),
      new THREE.MeshStandardMaterial({ color: SCENE.lampShade, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 })
    );
    shade.position.set(0, 2.62, 0);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: SCENE.bulb }));
    bulb.position.set(0, 2.55, 0);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.2), new THREE.MeshBasicMaterial({ color: SCENE.cord }));
    cord.position.set(0, 3.3, 0);
    s.add(shade, bulb, cord);

    // piso de madera
    const floorTex = canvasTex(512, 512, (ctx, w, h) => {
      for (let i = 0; i < 8; i++) {
        const tone = 70 + Math.random() * 30;
        ctx.fillStyle = `rgb(${tone + 40},${tone + 10},${tone - 20})`;
        ctx.fillRect(0, (i * h) / 8, w, h / 8);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, (i * h) / 8, w, 2);
        const off = Math.random() * w;
        ctx.fillRect(off, (i * h) / 8, 2, h / 8);
      }
      noise(ctx, w, h, 22);
    }, [6, 6]);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshLambertMaterial({ map: floorTex }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);

    // paredes con zócalo
    const wallTex = canvasTex(256, 512, (ctx, w, h) => {
      ctx.fillStyle = SCENE.wall;
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 32) {
        ctx.fillStyle = x % 64 ? 'rgba(255,220,180,0.05)' : 'rgba(0,0,0,0.05)';
        ctx.fillRect(x, 0, 32, h * 0.7);
      }
      ctx.fillStyle = SCENE.wallBase;
      ctx.fillRect(0, h * 0.7, w, h * 0.3);
      ctx.fillStyle = SCENE.wallTrim;
      ctx.fillRect(0, h * 0.7, w, 6);
      noise(ctx, w, h, 14);
    }, [10, 1]);
    const walls = new THREE.Mesh(
      new THREE.CylinderGeometry(6, 6, 4.2, 48, 1, true),
      new THREE.MeshLambertMaterial({ map: wallTex, side: THREE.BackSide })
    );
    walls.position.y = 2.1;
    s.add(walls);

    // cuadros en la pared
    SCENE.pictures.forEach(([text, bg, fg], i) => {
      const t = canvasTex(256, 192, (ctx, w, h) => {
        ctx.fillStyle = SCENE.frame;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = bg;
        ctx.fillRect(14, 14, w - 28, h - 28);
        ctx.fillStyle = fg;
        ctx.font = `700 28px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(text, w / 2, h / 2 + 10);
      });
      const a = Math.PI * 0.25 + i * (Math.PI / 2);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), new THREE.MeshLambertMaterial({ map: t }));
      m.position.set(Math.sin(a) * 5.9, 2.0, Math.cos(a) * 5.9);
      m.lookAt(0, 2.0, 0);
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
    const felt = canvasTex(1024, 1024, (ctx, w, h) => {
      const grd = ctx.createRadialGradient(w / 2, h / 2, 60, w / 2, h / 2, w / 2);
      grd.addColorStop(0, SCENE.felt[0]);
      grd.addColorStop(0.8, SCENE.felt[1]);
      grd.addColorStop(1, SCENE.felt[2]);
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = '#000';
      for (let y = 0; y < h; y += 3) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      noise(ctx, w, h, 14);
      ctx.strokeStyle = SCENE.feltInk;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w * 0.16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = SCENE.feltInk;
      ctx.font = `600 46px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(SCENE.feltName, w / 2, h / 2 + 14);
    });
    // madera con veta
    const woodTex = canvasTex(512, 128, (ctx, w, h) => {
      ctx.fillStyle = SCENE.wood;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 46; i++) {
        const y = Math.random() * h;
        ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(30,15,5,0.3)' : 'rgba(140,90,50,0.25)';
        ctx.lineWidth = 1 + Math.random() * 2.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= w; x += 32) ctx.lineTo(x, y + Math.sin(x / 50 + i) * 4);
        ctx.stroke();
      }
      noise(ctx, w, h, 10);
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
    const top = new THREE.Mesh(feltGeo, new THREE.MeshLambertMaterial({ map: felt }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = TABLE_Y;
    top.receiveShadow = true;
    const wood = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.38, metalness: 0.03 });
    const woodDark = new THREE.MeshStandardMaterial({ map: woodTex, color: SCENE.woodDark, roughness: 0.5 });
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
    const glassMat = new THREE.MeshStandardMaterial({ color: SCENE.glass, roughness: 0.05, transparent: true, opacity: 0.3 });
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.1, 20, 1, true), glassMat);
    const wine = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.025, 0.05, 20), new THREE.MeshStandardMaterial({ color: SCENE.wine, roughness: 0.2 }));
    glass.position.set(-R * 0.55, TABLE_Y + 0.05, R * 0.5);
    wine.position.set(-R * 0.55, TABLE_Y + 0.026, R * 0.5);
    const bottle = new THREE.Mesh(
      new THREE.LatheGeometry([[0, 0], [0.04, 0], [0.04, 0.2], [0.015, 0.26], [0.014, 0.32], [0, 0.32]].map(([x, y]) => new THREE.Vector2(x, y)), 20),
      new THREE.MeshStandardMaterial({ color: SCENE.bottle, roughness: 0.15, metalness: 0.1 })
    );
    bottle.position.set(-R * 0.66, TABLE_Y, -R * 0.5);
    bottle.castShadow = glass.castShadow = true;
    g.add(glass, wine, bottle);

    // mazo: dos mitades para poder animar el mezclado y el corte
    this.deck = new THREE.Group();
    this.muestraId = undefined; // el mazo es nuevo: hay que volver a poner la muestra
    this.muestraCard = null;
    const side = new THREE.MeshLambertMaterial({ color: SCENE.deckSide });
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
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 16, 0, Math.PI * 2, 0.35, Math.PI * 0.7), new THREE.MeshStandardMaterial({ color: SCENE.mate, roughness: 0.7 }));
    cup.position.y = 0.04;
    const yerba = new THREE.Mesh(new THREE.CircleGeometry(0.038, 20), new THREE.MeshLambertMaterial({ color: SCENE.yerba }));
    yerba.rotation.x = -Math.PI / 2;
    yerba.position.y = 0.083;
    const bomb = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.16), new THREE.MeshStandardMaterial({ color: SCENE.bombilla, metalness: 0.9, roughness: 0.2 }));
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
      new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide })
    );
    const d = this.seatDir(seat);
    const r = this.R + 0.3;
    mesh.position.set(d.x * r, CHAR_H / 2, d.z * r);
    this.scene.add(mesh);
    // silla
    const wood = new THREE.MeshStandardMaterial({ color: SCENE.chair, roughness: 0.6 });
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
    for (const [seat, c] of this.chars) {
      const p = seats[seat];
      const name = p?.name || '';
      if (name !== c.name) {
        c.name = name;
        c.look = lookFor(name, seat);
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

  showCardTip(card, ms = 0) {
    const tip = this.cardTip;
    clearTimeout(this.cardTipT);
    const id = card?.userData.id;
    if (!card || !this.pointerPx) return tip.classList.add('hidden');
    const known = id && id !== 'back' && id !== 'blank';
    const name = known ? cardName(id) : 'Carta tapada';
    tip.textContent = name[0].toUpperCase() + name.slice(1) + (known && card.userData.burned ? ' · quemada (vale un 4)' : '');
    tip.style.left = this.pointerPx.x + 'px';
    tip.style.top = this.pointerPx.y + 'px';
    tip.classList.remove('hidden');
    if (ms) this.cardTipT = setTimeout(() => tip.classList.add('hidden'), ms);
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
    const sleeve = look.shirt === 'jacket' ? look.cloth2 : look.cloth;
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
    const pivot = new THREE.Vector3(0.03, -0.32 - lowered * 0.1 + this.handLift, -HAND_DEPTH);
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
    const start = this.R * (this.n === 2 ? 0.55 : 0.62);
    const step = CARD_H * TABLE_CARD_SCALE * 0.36;
    const jitter = [0, 0.006, -0.005];
    const tilt = [0.02, -0.05, 0.04];
    const out = [];
    let radial = start;
    let side = 0;
    let rot = a;
    list.forEach((p, idx) => {
      if (idx > 0) {
        if (p.over) {
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
      const pos = d.clone().multiplyScalar(radial).addScaledVector(tangent, side);
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
  }
}
