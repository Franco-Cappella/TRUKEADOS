import { APP_NAME } from './config.js';

// Colores que usa el JavaScript del cliente (escena 3D, personajes, manos, anotador).
// Los colores de la interfaz HTML están en public/css/truco.css (variables en :root).
// Si cambiás la paleta, tocá los dos lados para que todo combine.

// Tipografía para lo que se dibuja en canvas (la misma que --font en truco.css).
export const FONT = "'Hanken Grotesk', system-ui, sans-serif";

// Tinta de los contornos de personajes y manos.
export const INK = '#17100b';

// Escena 3D: la mesa y lo que hay arriba (paño verde y madera, como en un bar de verdad).
// Los lugares (bar, café, parque...) tienen sus colores en ambientes.js.
export const SCENE = {
  background: '#0c0806',
  fog: '#0c0806',
  felt: ['#27523e', '#204534', '#1a4529'], // centro -> borde del paño (franjas planas)
  feltInk: 'rgba(226,204,166,0.2)',
  feltName: APP_NAME, // lo que está escrito en el paño
  wood: '#452a17',
  woodStreak: ['#2c1a0e', '#5a3a22'],
  woodDark: '#8a6a55',
  chair: '#34200f',
  glass: '#d6d8cc',
  wine: '#3f0f15',
  bottle: '#1a3325',
  mate: '#5a3c22',
  yerba: '#6c7f3c',
  bombilla: '#b9b2a0',
  deckSide: '#dccbaa',
};

// Cartas en la mesa
export const CARD = {
  blank: '#fbfaf6', // la de abajo de un tiro doble, vista por un rival
  blankEdge: '#8d8a80',
  burnTint: '#6e5a4c', // la carta quemada se oscurece...
  burnChar: 'rgba(28,14,6,0.92)', // ...con bordes carbonizados
  burnEmber: 'rgba(214,96,28,0.55)',
};

// Anotador de palitos
export const SCORE = {
  stick: '#f5f5f5',
  stickOff: 'rgba(255,255,255,0.08)',
  rule: 'rgba(255,255,255,0.4)',
};

// Colores de la boca de los personajes (señas y hablar).
export const FACE = {
  mouthInside: '#2c120e',
  teeth: '#e0cfb2',
  tongue: '#a8504a',
  kissLip: '#a5322c', // labios del beso: más rojos para que la seña se note
  wrinkle: 'rgba(40,20,12,0.6)',
  sclera: '#dcc8a8',
  iris: '#23150d',
  glint: '#efe2c8',
};

// Lo que no depende de cada personaje (accesorios y objetos que llevan).
export const OUTFIT = {
  shoe: '#17100c',
  belt: '#241811',
  buckle: '#a8946f',
  buckleDark: '#5f5138',
  lens: 'rgba(214,196,160,0.14)',
  frame: '#2a1c12',
  beret: '#231b18',
  hat: '#241a15',
  hatBand: '#120c09',
  shirtUnder: '#d8c2a0',
  guarda: '#c9ae88',
  cardFace: '#dccbaa',
  cardEdge: '#3a2c20',
  cardBack: '#32283f',
  cardBackInk: 'rgba(220,200,165,0.28)',
};

// El creador de personaje (creator.js): los colores que se pueden elegir. Tienen que ser tantos como dice
// LOOK_OPTS.counts en config.js (el servidor valida índices; lo verifica test/personaje-2d.test.js).
export const AVATAR_COLORS = {
  // tonos de piel [luz, sombra], del más claro al más oscuro
  skins: [
    ['#f3dcc4', '#c9a184'], ['#ecceb0', '#c09a78'], ['#e6c7a3', '#bb9069'], ['#dfb68e', '#b07c56'], ['#d0a077', '#9d6c49'],
    ['#bd8a60', '#88593a'], ['#a1704b', '#70482e'], ['#8a5c3c', '#5c3a24'], ['#6e4630', '#47291a'], ['#4f3222', '#301c12'],
  ],
  hairs: [
    '#18110d', '#2b1c14', '#3b271a', '#523524', '#6e4c31', '#8a5a36', '#b07a45', '#c9a15a', '#e0c27e', '#9a3b1f',
    '#c05a2a', '#8d8375', '#bdb5a8', '#ece8e0', '#2f5fa8', '#6b3fa0', '#d0608f', '#3c8a5a',
  ],
  clothes: [
    '#c9ae8a', '#6b2a25', '#3a4a3b', '#2a2320', '#7b684d', '#303b48', '#85472b', '#4a3a30', '#a58f70', '#572c37',
    '#e8e2d6', '#2f6fa0', '#b8402f', '#d9a63a', '#3f7d5a', '#7a4f9a',
  ],
};
// Canas: estos índices de AVATAR_COLORS.hairs son grises o blancos (el personaje se ve más grande).
export const AVATAR_GRAY = [11, 12, 13];

// Banderas para el pin del pecho (LOOK_OPTS.flags en config.js). h: franjas horizontales, v: verticales; sun: un
// círculo en el medio; canton: un rectángulo arriba a la izquierda [color, ancho, alto] (en partes de la bandera);
// diamond: un rombo en el medio; cross: cruz [blanca, roja].
export const FLAG_LOOK = {
  ar: { h: ['#74acdf', '#ffffff', '#74acdf'], sun: '#f6b40e' },
  uy: { h: ['#ffffff', '#0038a8', '#ffffff', '#0038a8', '#ffffff'], canton: ['#ffffff', 0.38, 0.6], sun: '#fcd116' },
  cl: { h: ['#ffffff', '#d52b1e'], canton: ['#0039a6', 0.34, 0.5] },
  py: { h: ['#d52b1e', '#ffffff', '#0038a8'], sun: '#2e7d32' },
  bo: { h: ['#d52b1e', '#f9e300', '#007934'] },
  pe: { v: ['#d91023', '#ffffff', '#d91023'] },
  br: { h: ['#009c3b'], diamond: '#ffdf00', sun: '#002776' },
  co: { h: ['#fcd116', '#fcd116', '#003893', '#ce1126'] },
  ve: { h: ['#ffcc00', '#00247d', '#cf142b'] },
  mx: { v: ['#006847', '#ffffff', '#ce1126'], sun: '#8c5a2b' },
  es: { h: ['#aa151b', '#f1bf00', '#f1bf00', '#aa151b'] },
  it: { v: ['#009246', '#ffffff', '#ce2b37'] },
  fr: { v: ['#0055a4', '#ffffff', '#ef4135'] },
  de: { h: ['#000000', '#dd0000', '#ffce00'] },
  us: { h: ['#b22234', '#ffffff', '#b22234', '#ffffff', '#b22234', '#ffffff', '#b22234'], canton: ['#3c3b6e', 0.42, 0.55] },
  uk: { h: ['#012169'], cross: ['#ffffff', '#c8102e'] },
  cn: { h: ['#de2910'], star: '#ffde00' },
  jp: { h: ['#ffffff'], sun: '#bc002d' },
};

// Paletas de los personajes: sepia y tierras, pocos colores saturados. Cada piel: [luz, sombra].
export const PALETTE = {
  skins: [
    ['#dfb68e', '#b07c56'],
    ['#d0a077', '#9d6c49'],
    ['#bd8a60', '#88593a'],
    ['#a1704b', '#70482e'],
    ['#7f5438', '#543320'],
    ['#e6c7a3', '#bb9069'],
  ],
  hairs: ['#1b130e', '#2b1c14', '#3b271a', '#523524', '#6e4c31', '#241915', '#33221a', '#18110d'],
  grayHairs: ['#8d8375', '#a89d8d', '#6c6357'],
  clothes: ['#c9ae8a', '#6b2a25', '#3a4a3b', '#2a2320', '#7b684d', '#303b48', '#85472b', '#4a3a30', '#a58f70', '#572c37'],
  vests: ['#231b18', '#2b2a2c', '#3a2a22', '#2c3430', '#3c2024'],
  ponchos: ['#241a16', '#3c1f1b', '#2d2a26', '#26302c'],
  accents: ['#74231f', '#74231f', '#8d6a25', '#2f4152', '#2f4a39', '#1d1512'],
  unders: ['#d8c2a0', '#cdb491', '#e0cdb0', '#bfae94'],
  pants: ['#211b18', '#2e2822', '#26303a', '#3a3026', '#1e1a18'],
  fallbackCloth: '#4a4038',
};

// Cómo se ve cada cosa de la tienda (COSMETICS en config.js, misma clave).
export const COSMETIC_LOOK = {
  // personajes 3D (public/models, armados con tools/build-skin.mjs). scale: tamaño en la mesa
  // poster: los colores de su foto en la tienda (poster.js): fondo, luces de contorno y el nombre de atrás
  volcho: { model: { url: '/models/volcho.glb', scale: 1.04 }, thumb: '/models/volcho.webp', poster: { bg: ['#ff4fa3', '#8a1f9e', '#1c0629'], rim: ['#ff9ad6', '#5fdcff'], ink: '#ffe14d' } },
  // el Gato Melón (tools/rig-rigid.mjs): las señas son una carita encima de la cara
  'gato-melon': { model: { url: '/models/gato-melon.glb', scale: 0.62 }, poster: { bg: ['#6fd8ff', '#2b5fe0', '#0a1340'], rim: ['#fff07a', '#ff5ad1'], ink: '#ffe14d' } },
  olcho: { model: { url: '/models/olcho.glb', scale: 1.1 }, thumb: '/models/olcho.webp', poster: { bg: ['#ffb02e', '#e0480f', '#2b0a3d'], rim: ['#ffd86e', '#b67dff'], ink: '#7dffa8' } },
  'remera-celeste': { shirt: 'tee', cloth: '#7b9cb5' },
  'chomba-verde': { shirt: 'polo', cloth: '#35594a' },
  'pulover-bordo': { shirt: 'sweater', cloth: '#5f2a31' },
  'saco-negro': { shirt: 'jacket', cloth: '#d8c2a0', cloth2: '#1e1a1a' },
  boina: { style: 'boina' },
  gorra: { style: 'cap' },
  lentes: { glasses: true },
  mate: { colors: ['#6b4a2a', '#6f8f3a', '#d9d9d9'] },
  cafe: { colors: ['#f2efe8', '#3b2416', '#f2efe8'] },
  porron: { colors: ['#5a3a12', '#c9a36b', '#e8e2d0'] },
  fernet: { colors: ['#dfe8ec', '#2a1410', '#dfe8ec'] },
  'pano-azul': { felt: ['#2f5f8f', '#244b73', '#1a3857'] },
  'pano-bordo': { felt: ['#7a2e38', '#62242d', '#4a1a22'] },
  'pano-negro': { felt: ['#333536', '#26282a', '#1a1b1c'] },
  // paños pintados a mano (panos.js): draw es el pintor; felt, los colores de la vista chica; thread, la costura
  'pano-alfombra': { felt: ['#8a1f1c', '#5e1412', '#2a1418'], draw: 'alfombra', thread: '#ecdcb6' },
  'pano-almendro': { felt: ['#5fa8a8', '#22585e', '#163a3e'], draw: 'almendro', thread: '#f4ede0' },
  'pano-fileteado': { felt: ['#1a1a1d', '#0d0d0f', '#000000'], draw: 'fileteado', thread: '#e8c547' },
  'pano-poncho': { felt: ['#a3141a', '#7a0f14', '#121010'], draw: 'poncho', thread: '#f1ead8' },
  'pano-casino': { felt: ['#1f7a4c', '#145a37', '#0b3520'], draw: 'casino', thread: '#d9b44a' },
  'pano-calcareo': { felt: ['#ece2cc', '#9a3b2c', '#4a6478'], draw: 'calcareo', thread: '#2a2a2e' },
  'pano-noche': { felt: ['#1d2d5a', '#0f1a3a', '#070b1d'], draw: 'noche', thread: '#f6efd6' },
  'pano-madera': { felt: ['#7a5233', '#5e3d25', '#3a2416'], draw: 'madera', thread: '#e8c58a' },
  'pano-estrellada': { felt: ['#2b5aa8', '#132c6e', '#0b1a4a'], draw: 'estrellada', thread: '#f6d54a' },
  'dorso-azul': { back: ['#2f6fd6', '#f5f5f5'] },
  // dorso pintado (panos.js: paintBack): back es el color de la vista chica
  'dorso-estrellada': { back: ['#132c6e', '#f6d54a'], backDraw: 'estrellada' },
  'dorso-verde': { back: ['#2e7344', '#f5f5f5'] },
  'dorso-negro': { back: ['#1c1c1c', '#f2c12e'] },
};

// Oscurece (k < 1) o aclara (k > 1) un color #rrggbb. Devuelve rgb().
export function mix(hex, k) {
  if (!hex?.startsWith('#')) hex = PALETTE.fallbackCloth;
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
