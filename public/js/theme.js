import { APP_NAME } from './config.js';

// Colores que usa el JavaScript del cliente (escena 3D, personajes, manos, anotador).
// Los colores de la interfaz HTML están en public/css/truco.css (variables en :root).
// Si cambiás la paleta, tocá los dos lados para que todo combine.

// Tipografía para lo que se dibuja en canvas (la misma que --font en truco.css).
export const FONT = "'Archivo', system-ui, sans-serif";

// Los cuatro palos: los colores básicos de la paleta (iguales a --blue/--green/--yellow/--red).
const SUIT_COLORS = { E: '#2f6fd6', B: '#2e9e57', O: '#f2c12e', C: '#d93b30' };

// Tinta de los contornos de personajes y manos.
export const INK = '#2b2320';

// Escena 3D (el bar)
export const SCENE = {
  background: '#1a120c',
  fog: '#1a120c',
  hemiSky: '#ffe2b8',
  hemiGround: '#3a2a1c',
  lamp: '#ffd9a0',
  fill: '#ffb070',
  lampShade: '#2f4f3a',
  bulb: '#fff3d0',
  cord: '#111111',
  wall: '#6b3b2a',
  wallBase: '#3b2416',
  wallTrim: '#c9a36b',
  frame: '#5a3a1a',
  // cuadros de la pared: [texto, fondo, letra]
  pictures: [
    ['Boca vs. River', SUIT_COLORS.E, SUIT_COLORS.O],
    ['Gardel', '#1c1c1c', '#f5f5f5'],
    ['Mate & Truco', SUIT_COLORS.B, '#f5f5f5'],
    ['Mar del Plata', SUIT_COLORS.C, '#f5f5f5'],
  ],
  felt: ['#2e7344', '#225a35', '#1a4529'], // centro -> borde del paño
  feltInk: 'rgba(255,255,255,0.12)',
  feltName: APP_NAME, // lo que está escrito en el paño
  wood: '#5b3418',
  woodDark: '#8a6a55',
  chair: '#4a2a14',
  glass: '#dfe8ec',
  wine: '#4a0d18',
  bottle: '#173a22',
  mate: '#6b4a2a',
  yerba: '#6f8f3a',
  bombilla: '#d9d9d9',
  deckSide: '#efece4',
};

// Luces del bar. Más bajas = cartas más legibles (con mucha luz el paño y las caras se queman).
export const LIGHT = {
  exposure: 0.92,
  ambient: 0.75, // luz pareja de todo el salón
  lamp: 20, // lámpara colgante sobre la mesa
  lampSoftness: 0.75, // borde del cono de luz (0 duro, 1 muy suave)
  fill: 5,
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
  mouthInside: '#4a1f1b',
  teeth: '#efe9de',
  tongue: '#d46a72',
  kissLip: '#c24f58', // labios del beso: más rojos para que la seña se note
  wrinkle: 'rgba(70,35,25,0.5)',
};

// Paletas de los personajes (tonos de piel, pelo y ropa reales). Cada piel: [luz, sombra].
export const PALETTE = {
  skins: [
    ['#f0cfb4', '#d9ad8f'],
    ['#e3b48f', '#c7936f'],
    ['#c99470', '#a8754f'],
    ['#a7714d', '#875636'],
    ['#7d5136', '#613c25'],
    ['#efd9c4', '#d6b89c'],
  ],
  hairs: ['#1f1814', '#3a271b', '#5b3a22', '#7b5530', '#a88457', '#8c8c8a', '#c9c6c0', '#2a2522'],
  grayHairs: ['#8c8c8a', '#b5b2ad', '#6d6a66'],
  clothes: ['#3d4f63', '#6b3a32', '#4a5a3e', '#544863', '#2f3033', '#8a7350', '#6f7378', '#38526a', '#6e2f3a', '#7a6a4f'],
  pants: ['#2b2d33', '#3b3a36', '#2f3a4a', '#4a3f33', '#2a2a2a'],
  fallbackCloth: '#4a4a4a',
};

// Cómo se ve cada cosa de la tienda (COSMETICS en config.js, misma clave).
export const COSMETIC_LOOK = {
  'remera-celeste': { shirt: 'tee', cloth: '#6fa3d6' },
  'chomba-verde': { shirt: 'polo', cloth: '#2f6b47' },
  'pulover-bordo': { shirt: 'sweater', cloth: '#6e2f3a' },
  'saco-negro': { shirt: 'jacket', cloth: '#d8d4cc', cloth2: '#1f1f22' },
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
