import { APP_NAME } from './config.js';

// Colores que usa el JavaScript del cliente (escena 3D, personajes, manos, anotador).
// Los colores de la interfaz HTML están en public/css/truco.css (variables en :root).
// Si cambiás la paleta, tocá los dos lados para que todo combine.

// Tipografía para lo que se dibuja en canvas (la misma que --font en truco.css).
export const FONT = "'Archivo', system-ui, sans-serif";

// Tinta de los contornos de personajes y manos.
export const INK = '#17100b';

// Escena 3D (el bar)
export const SCENE = {
  background: '#0c0806',
  fog: '#0c0806',
  hemiSky: '#ffe6c4',
  hemiGround: '#4a3626',
  lamp: '#ffdcaa',
  fill: '#c98a58',
  lampShade: '#27352b',
  bulb: '#fff3d0',
  cord: '#0c0806',
  wall: '#1b120d',
  wallAlt: '#20150f',
  wallSeam: '#0e0906',
  wallBase: '#120b08',
  wallTrim: '#4a2f1c',
  wallTrimLight: '#6e4a2c',
  ceiling: '#0a0705',
  floor: ['#2e1e14', '#35241a', '#281a11'],
  floorSeam: '#120b07',
  shelf: '#2c1b11',
  shelfBack: '#100a07',
  barDim: 'rgba(8,4,2,0.56)',
  bottles: ['#3a2c17', '#26382a', '#4a1f1b', '#51401f', '#2c2a33'],
  bottleLabel: '#a8946f',
  frame: '#2c1b11',
  frameLight: '#5c3d24',
  // cuadros de la pared: [dibujo, fondo, tinta]
  pictures: [
    ['sol', '#c9a267', '#3a2413'],
    ['guarda', '#241a15', '#c9ae88'],
    ['espada', '#5e2520', '#dcc8a8'],
    ['pampa', '#a8794a', '#21150d'],
  ],
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

// Luces del bar: sin mapeo de tonos, para que la paleta quede tal cual se eligió.
export const LIGHT = {
  ambient: 1.25, // luz pareja de todo el salón
  lamp: 7.5, // lámpara colgante sobre la mesa
  lampSoftness: 0.5, // borde del cono de luz (0 duro, 1 muy suave)
  fill: 1.4,
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
  'dorso-azul': { back: ['#2f6fd6', '#f5f5f5'] },
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
