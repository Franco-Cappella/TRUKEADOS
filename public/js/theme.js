// Colores que usa el JavaScript del cliente (escena 3D, personajes, manos, anotador).
// Los colores de la interfaz HTML están en public/css/truco.css (variables en :root).
// Si cambiás la paleta, tocá los dos lados para que todo combine.

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
    ['Boca vs. River', '#1d3b6e', '#f2c230'],
    ['Gardel', '#2a2a2a', '#e8e0cf'],
    ['Mate & Truco', '#2f5d3a', '#e8d29b'],
    ['Mar del Plata', '#3e7fae', '#f4e6c4'],
  ],
  felt: ['#2e7344', '#225a35', '#1a4529'], // centro -> borde del paño
  feltInk: 'rgba(230,214,170,0.13)',
  feltName: 'Truco 3D',
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
  stick: '#ece6d8',
  stickOff: 'rgba(236,230,216,0.08)',
  rule: 'rgba(236,230,216,0.45)',
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

// Oscurece (k < 1) o aclara (k > 1) un color #rrggbb. Devuelve rgb().
export function mix(hex, k) {
  if (!hex?.startsWith('#')) hex = PALETTE.fallbackCloth;
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
