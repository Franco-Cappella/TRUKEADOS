// Genera los logos de Trukeados con contornos reales de Archivo Expanded Black.
// Uso: node build-logos.mjs <carpeta de fuentes .ttf> <carpeta de salida>
import opentype from 'opentype.js';
import fs from 'node:fs';
import path from 'node:path';

const [fontDir = '.', outDir = './out'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const font = opentype.loadSync(path.join(fontDir, 'ArchivoExpanded-Black.ttf'));

const C = { ink: '#121212', paper: '#f5f5f5', espada: '#2f6fd6', oro: '#f2c12e' };
const r = (n) => +n.toFixed(2);

// ---------- marca: dos naipes cruzados; el de adelante es el ancho de espada reducido
// Medidas en una caja de 100. Naipe 40 x 60 (proporción de las cartas del juego, 512x788 ≈ 0,65).
const CARD = { w: 40, h: 61.5, rx: 5 };
const BACK = { cx: 36, cy: 53, rot: -14 };
const FRONT = { cx: 61, cy: 48, rot: 9 };
const GAP = 3.2; // separación entre naipes (se recorta del de atrás)
const rect = (c, grow = 0) =>
  `<rect x="${r(c.cx - CARD.w / 2 - grow)}" y="${r(c.cy - CARD.h / 2 - grow)}" width="${r(CARD.w + grow * 2)}" height="${r(CARD.h + grow * 2)}" rx="${r(CARD.rx + grow)}" transform="rotate(${c.rot} ${c.cx} ${c.cy})"/>`;
// la espada (ancho de espada): hoja con punta, guarda, empuñadura y pomo. Coordenadas locales del naipe.
const SW = { dy: -1.5 };
const swordLocal = (blue, gold) => [
  `<path fill="${blue}" d="M0 -25 L4 -18.5 L4 9.5 L-4 9.5 L-4 -18.5 Z"/>`,
  `<rect fill="${gold}" x="-11" y="9.5" width="22" height="5.2" rx="2.6"/>`,
  `<rect fill="${blue}" x="-2.4" y="14.2" width="4.8" height="7.6"/>`,
  `<circle fill="${gold}" cx="0" cy="24.2" r="3.9"/>`,
].join('');
const swordEl = (blue, gold) => `<g transform="translate(${FRONT.cx} ${FRONT.cy}) rotate(${FRONT.rot}) translate(0 ${SW.dy})">${swordLocal(blue, gold)}</g>`;

// límites reales de la marca (esquinas rotadas)
function cardCorners(c) {
  const a = (c.rot * Math.PI) / 180;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
    const x = (sx * CARD.w) / 2, y = (sy * CARD.h) / 2;
    return [c.cx + x * Math.cos(a) - y * Math.sin(a), c.cy + x * Math.sin(a) + y * Math.cos(a)];
  });
}
const pts = [...cardCorners(BACK), ...cardCorners(FRONT)];
const MB = { x0: Math.min(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), x1: Math.max(...pts.map((p) => p[0])), y1: Math.max(...pts.map((p) => p[1])) };
MB.w = MB.x1 - MB.x0; MB.h = MB.y1 - MB.y0;

let uid = 0;
// variant: 'color' (naipes claros + palos, para fondo oscuro), 'positivo' (naipes tinta + palos, fondo claro),
// 'mono' (un color, espada calada)
function mark(variant, { tx = 0, ty = 0, s = 1 } = {}) {
  const id = `m${uid++}`;
  const cardFill = variant === 'positivo' ? C.ink : variant === 'mono-negro' ? C.ink : C.paper;
  const g = `<g transform="translate(${r(tx)} ${r(ty)}) scale(${r(s * 1000) / 1000}) translate(${r(-MB.x0)} ${r(-MB.y0)})">`;
  // máscara: el de atrás pierde la franja que tapa el de adelante (+GAP)
  const maskBack = `<mask id="${id}b" maskUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="200"><rect x="-50" y="-50" width="200" height="200" fill="#fff"/><g fill="#000">${rect(FRONT, GAP)}</g></mask>`;
  if (variant.startsWith('mono')) {
    const maskFront = `<mask id="${id}f" maskUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="200"><rect x="-50" y="-50" width="200" height="200" fill="#fff"/>${swordEl('#000', '#000')}</mask>`;
    return `<defs>${maskBack}${maskFront}</defs>${g}<g fill="${cardFill}"><g mask="url(#${id}b)">${rect(BACK)}</g><g mask="url(#${id}f)">${rect(FRONT)}</g></g></g>`;
  }
  return `<defs>${maskBack}</defs>${g}<g fill="${cardFill}"><g mask="url(#${id}b)">${rect(BACK)}</g>${rect(FRONT)}</g>${swordEl(C.espada, C.oro)}</g>`;
}

// ---------- palabra: TRUKEADOS en Archivo Expanded Black, tracking -0,01 em
function wordPath(text, size, tracking = -0.01) {
  const glyphs = font.stringToGlyphs(text);
  const scale = size / font.unitsPerEm;
  let x = 0;
  const parts = [];
  glyphs.forEach((gl, i) => {
    parts.push(gl.getPath(x, 0, size).toPathData(2));
    x += gl.advanceWidth * scale + tracking * size;
    if (i < glyphs.length - 1) x += font.getKerningValue(gl, glyphs[i + 1]) * scale;
  });
  const bb = font.getPath(text, 0, 0, size).getBoundingBox();
  const width = x - tracking * size;
  return { d: parts.join(''), width, cap: (font.tables.os2.sCapHeight || 0.7 * font.unitsPerEm) * scale, bb };
}

const svg = (w, h, body, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r(w)} ${r(h)}" width="${r(w)}" height="${r(h)}" role="img" aria-label="Trukeados">${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ''}${body}</svg>\n`;
const write = (name, content) => fs.writeFileSync(path.join(outDir, name), content);

const SIZE = 100; // cuerpo de la palabra
const W = wordPath('TRUKEADOS', SIZE);
const capTop = -W.cap; // la línea de base es y=0

// Horizontal: la marca mide 1,5 altos de mayúscula y se centra con las mayúsculas
const pad = 0;
function horizontal(variant, wordFill) {
  const mh = W.cap * 1.9;
  const s = mh / MB.h;
  const mw = MB.w * s;
  const gap = W.cap * 0.42;
  const top = (W.cap - mh) / 2; // relativo al tope de las mayúsculas
  const w = mw + gap + W.width;
  const h = mh;
  const body = mark(variant, { tx: 0, ty: 0, s }) + `<path fill="${wordFill}" transform="translate(${r(mw + gap)} ${r(-top + W.cap)})" d="${W.d}"/>`;
  return svg(w + pad * 2, h + pad * 2, body);
}
function stacked(variant, wordFill) {
  const mh = W.cap * 3.1;
  const s = mh / MB.h;
  const mw = MB.w * s;
  const gap = W.cap * 0.55;
  const w = Math.max(mw, W.width);
  const h = mh + gap + W.cap;
  const body = mark(variant, { tx: (w - mw) / 2, ty: 0, s }) + `<path fill="${wordFill}" transform="translate(${r((w - W.width) / 2)} ${r(mh + gap + W.cap)})" d="${W.d}"/>`;
  return svg(w, h, body);
}
function markOnly(variant, size = 256) {
  const s = size / Math.max(MB.w, MB.h);
  return svg(MB.w * s, MB.h * s, mark(variant, { s }));
}
function wordOnly(fill) {
  return svg(W.width, W.cap, `<path fill="${fill}" transform="translate(0 ${r(W.cap)})" d="${W.d}"/>`);
}
function appIcon(size = 512) {
  const inner = size * 0.64;
  const s = inner / Math.max(MB.w, MB.h);
  const tx = (size - MB.w * s) / 2, ty = (size - MB.h * s) / 2;
  return svg(size, size, `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${C.ink}"/>` + mark('color', { tx, ty, s }));
}

write('logo-horizontal.svg', horizontal('color', C.paper));
write('logo-horizontal-claro.svg', horizontal('positivo', C.ink));
write('logo-horizontal-mono-blanco.svg', horizontal('mono', C.paper));
write('logo-horizontal-mono-negro.svg', horizontal('mono-negro', C.ink));
write('logo-apilado.svg', stacked('color', C.paper));
write('logo-apilado-claro.svg', stacked('positivo', C.ink));
write('marca.svg', markOnly('color'));
write('marca-claro.svg', markOnly('positivo'));
write('marca-mono-blanco.svg', markOnly('mono'));
write('marca-mono-negro.svg', markOnly('mono-negro'));
write('palabra.svg', wordOnly(C.paper));
write('palabra-negro.svg', wordOnly(C.ink));
write('icono-app.svg', appIcon());
// datos para componentes (React u otros)
const data = { word: { d: W.d, width: r(W.width), cap: r(W.cap) }, markBox: { x: r(MB.x0), y: r(MB.y0), w: r(MB.w), h: r(MB.h) } };
write('logo-data.json', JSON.stringify(data));
console.log('marca', MB, 'palabra', r(W.width), r(W.cap));
