// Prepara como personaje un modelo hecho de piezas sueltas y sin esqueleto (cuerpo, brazos, patas, ojos): junta todo
// en una sola malla, une las texturas en una (con transparencia) y le arma un esqueleto con los nombres de Mixamo
// para que models.js lo pose igual que a los demás. Los brazos y las patas se reparten entre sus tres huesos según
// lo largo (así se doblan en vez de moverse como un palo); el cuerpo pasa de la cadera a la cabeza según la altura;
// lo demás (ojos, adornos) va pegado a la cabeza. Las señas de estos personajes son una carita encima de la cara
// (extras.face.emoji).
//   node tools/rig-rigid.mjs <archivo.glb> <id>        (las piezas de cada modelo, en PARTS)
import fs from 'node:fs';
import path from 'node:path';
import { readGlb, apply, applyDir } from './glb-read.mjs';
import { decodePng, encodePngRgb, shrinkTo } from './png.mjs';

// Qué es cada pieza (nombre del nodo con la malla) y cuánto mide el personaje en la mesa (metros).
const PARTS = {
  'gato-melon': {
    body: ['pPlane5_lambert10_0'],
    head: ['pPlane5_lambert13_0', 'pPlane5_lambert14_0', 'pPlane5_lambert15_0'],
    arms: ['polySurface32_lambert12_0', 'polySurface33_lambert12_0'],
    legs: ['pCylinder27_lambert12_0', 'pCylinder28_lambert12_0'],
    height: 1.1, // de las patas a la punta
    // a qué altura del cuerpo (0 abajo, 1 arriba) empieza la cabeza. El Gato Melón es todo cabeza: casi desde abajo
    // (si el melón se repartiera entre el pecho y la cabeza, al girarla el borde amarillo se metería en la cara)
    neck: 0.1,
    face: 'pPlane5_lambert13_0', // la pieza con la cara (ahí va la carita de las señas)
    clearFace: 0.95, // sacar lo del cuerpo que tapa la cara (hasta este tanto del óvalo de la cara)
    seatLift: 0.2, // sentado: cuánto más alto que una persona (es una bola: si no, la mesa le tapa la cara)
    handsForward: 0.3, // las manos más adelante (si no, quedan adentro de la bola)
    cardsOffset: [-0.35, -0.04, 0.55], // las cartas de la mano: más al medio, arriba y adelante (si no, la bola las tapa)
  },
};
const ATLAS = 1024;
const CELL = 512;

const [src, id] = process.argv.slice(2);
const cfg = PARTS[id];
if (!src || !cfg) throw new Error(`Uso: node tools/rig-rigid.mjs <archivo.glb> <id>  (ids: ${Object.keys(PARTS).join(', ')})`);
const g = readGlb(src);
const { J } = g;

// ---------------------------------------------------------------- las piezas, en el mundo
const pieces = [];
J.nodes.forEach((n, ni) => {
  if (n.mesh == null) return;
  const kind = Object.entries({ body: cfg.body, head: cfg.head, arm: cfg.arms, leg: cfg.legs }).find(([, names]) => names.includes(n.name))?.[0];
  if (!kind) return console.warn('pieza sin usar:', n.name);
  for (const p of J.meshes[n.mesh].primitives) {
    const P = g.read(p.attributes.POSITION);
    const N = g.read(p.attributes.NORMAL);
    const pos = [];
    const nrm = [];
    for (let k = 0; k < P.length; k += 3) {
      pos.push(apply(g.world[ni], P[k], P[k + 1], P[k + 2]));
      nrm.push(applyDir(g.world[ni], N[k], N[k + 1], N[k + 2]));
    }
    const mat = J.materials[p.material];
    pieces.push({ name: n.name, kind, pos, nrm, uv: g.read(p.attributes.TEXCOORD_0), idx: g.read(p.indices), tex: mat.pbrMetallicRoughness.baseColorTexture.index });
  }
});

// ---------------------------------------------------------------- tamaño y lugar: parado en el piso, centrado, mirando a +z
const all = pieces.flatMap((p) => p.pos);
const minY = Math.min(...all.map((v) => v[1]));
const maxY = Math.max(...all.map((v) => v[1]));
const bodyV = pieces.filter((p) => p.kind === 'body').flatMap((p) => p.pos);
const cx = (Math.min(...bodyV.map((v) => v[0])) + Math.max(...bodyV.map((v) => v[0]))) / 2;
const cz = (Math.min(...bodyV.map((v) => v[2])) + Math.max(...bodyV.map((v) => v[2]))) / 2;
const S = cfg.height / (maxY - minY);
for (const p of pieces) p.pos = p.pos.map(([x, y, z]) => [(x - cx) * S, (y - minY) * S, (z - cz) * S]);
const bounds = (vs) => [0, 1, 2].map((c) => [Math.min(...vs.map((v) => v[c])), Math.max(...vs.map((v) => v[c]))]);
const body = bounds(pieces.filter((p) => p.kind === 'body').flatMap((p) => p.pos));
const [bx, by, bz] = body;
const bh = by[1] - by[0];

// ---------------------------------------------------------------- el esqueleto
const joints = []; // { name, parent, p (mundo) }
const J_ = (name, parent, p) => (joints.push({ name, parent, p }), joints.length - 1);
const at = (f) => by[0] + bh * f;
const hips = J_('Hips', -1, [0, at(0.12), 0]);
const spine = J_('Spine', hips, [0, at(0.22), 0]);
const spine1 = J_('Spine1', spine, [0, at(0.3), 0]);
const spine2 = J_('Spine2', spine1, [0, at(cfg.neck - 0.04), 0]);
const neck = J_('Neck', spine2, [0, at(cfg.neck), 0]);
const head = J_('Head', neck, [0, at(cfg.neck + 0.06), 0]);
J_('HeadTop_End', head, [0, by[1], 0]);
// brazos y patas: de la punta pegada al cuerpo a la otra
const limb = (piece, side, names, parent) => {
  const vs = piece.pos;
  const c = vs.reduce((a, v) => a.map((x, k) => x + v[k] / vs.length), [0, 0, 0]);
  // la raíz: lo más cerca del eje del cuerpo (brazos) o lo más alto (patas)
  const key = piece.kind === 'arm' ? (v) => Math.hypot(v[0], v[2] - c[2] * 0.5) : (v) => -v[1];
  const sorted = [...vs].sort((a, b) => key(a) - key(b));
  const near = sorted.slice(0, Math.max(3, sorted.length * 0.12 | 0));
  const root = near.reduce((a, v) => a.map((x, k) => x + v[k] / near.length), [0, 0, 0]);
  const tip = sorted.at(-1);
  const lerp = (t) => root.map((x, k) => x + (tip[k] - x) * t);
  const a = J_(`${side}${names[0]}`, parent, lerp(0.05));
  const b = J_(`${side}${names[1]}`, a, lerp(0.5));
  const e = J_(`${side}${names[2]}`, b, lerp(0.9));
  piece.chain = { a, b, e, root, tip };
};
const side = (piece) => (piece.pos.reduce((s, v) => s + v[0], 0) > 0 ? 'Left' : 'Right'); // su izquierda es +x
for (const p of pieces.filter((x) => x.kind === 'arm')) limb(p, side(p), ['Arm', 'ForeArm', 'Hand'], cfg.neck < 0.3 ? head : spine2); // si es todo cabeza, los brazos giran con ella
for (const p of pieces.filter((x) => x.kind === 'leg')) limb(p, side(p), ['UpLeg', 'Leg', 'Foot'], hips);
for (const s of ['Left', 'Right']) {
  for (const n of ['Arm', 'UpLeg']) if (!joints.some((j) => j.name === s + n)) throw new Error(`Falta ${s}${n}: revisá las piezas`);
}

// ---------------------------------------------------------------- pesos
const smooth = (t) => t * t * (3 - 2 * t);
function weights(piece, v) {
  if (piece.kind === 'head') return [[head, 1]];
  if (piece.kind === 'body') {
    const f = (v[1] - by[0]) / bh;
    const band = 0.08;
    if (f >= cfg.neck + band) return [[head, 1]];
    if (f >= cfg.neck - band) {
      const t = smooth((f - (cfg.neck - band)) / (2 * band));
      return [[spine2, 1 - t], [head, t]];
    }
    if (f >= 0.3) return [[spine2, 1]];
    const t = smooth(Math.max(0, f / 0.3));
    return [[hips, 1 - t], [spine1, t]];
  }
  // brazo o pata: según lo largo
  const { a, b, e, root, tip } = piece.chain;
  const d = tip.map((x, k) => x - root[k]);
  const L2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
  const t = Math.min(1, Math.max(0, ((v[0] - root[0]) * d[0] + (v[1] - root[1]) * d[1] + (v[2] - root[2]) * d[2]) / L2));
  if (t < 0.35) return [[a, 1]];
  if (t < 0.6) {
    const k = smooth((t - 0.35) / 0.25);
    return [[a, 1 - k], [b, k]];
  }
  if (t < 0.78) return [[b, 1]];
  const k = smooth(Math.min(1, (t - 0.78) / 0.15));
  return [[b, 1 - k], [e, k]];
}

// ---------------------------------------------------------------- la textura: todas en una (2 x 2 celdas, los ojos a lo ancho)
const texIds = [...new Set(pieces.map((p) => p.tex))];
const atlas = { width: ATLAS, height: ATLAS, data: new Uint8Array(ATLAS * ATLAS * 4) };
const rects = {};
let slot = 0;
const free = [];
for (let y = 0; y < ATLAS; y += CELL) for (let x = 0; x < ATLAS; x += CELL) free.push([x, y]);
for (const t of texIds) {
  const img = J.images[J.textures[t].source];
  let im = decodePng(g.bytes(img.bufferView));
  im = shrinkTo(im, CELL);
  // las anchas (2:1) ocupan media celda: dos en una
  let x0;
  let y0;
  const half = im.height <= CELL / 2;
  const halfFree = free.find((f) => f.half);
  if (half && halfFree) {
    free.splice(free.indexOf(halfFree), 1);
    [x0, y0] = halfFree;
  } else {
    [x0, y0] = free.shift();
    if (half) free.unshift(Object.assign([x0, y0 + CELL / 2], { half: true }));
  }
  if (x0 == null) throw new Error('No entran las texturas');
  for (let y = 0; y < im.height; y++) atlas.data.set(im.data.subarray(y * im.width * 4, (y + 1) * im.width * 4), ((y0 + y) * ATLAS + x0) * 4);
  rects[t] = { x: x0, y: y0, w: im.width, h: im.height };
  slot++;
}

// solo lo que se ve de la pieza (la textura tiene partes transparentes)
const opaque = (p, i) => {
  const r = rects[p.tex];
  const x = Math.min(r.w - 1, Math.max(0, Math.floor(p.uv[i * 2] * r.w))) + r.x;
  const y = Math.min(r.h - 1, Math.max(0, Math.floor(p.uv[i * 2 + 1] * r.h))) + r.y;
  return atlas.data[(y * ATLAS + x) * 4 + 3] > 128;
};

// ---------------------------------------------------------------- la cara despejada
// Los pedazos del cuerpo que quedan adelante de la cara (el borde amarillo del melón, en punta) se la tapan o se
// cruzan con ella según de dónde se mire: se sacan los triángulos del cuerpo que caen adentro del óvalo de la cara.
if (cfg.face && cfg.clearFace) {
  const fv = pieces.filter((x) => x.name === cfg.face).flatMap((x) => x.pos.filter((_, i) => opaque(x, i)));
  const lo = [0, 1, 2].map((c) => Math.min(...fv.map((v) => v[c])));
  const hi = [0, 1, 2].map((c) => Math.max(...fv.map((v) => v[c])));
  const cx = (lo[0] + hi[0]) / 2;
  const cy = (lo[1] + hi[1]) / 2;
  const rx = ((hi[0] - lo[0]) / 2) * cfg.clearFace;
  const ry = ((hi[1] - lo[1]) / 2) * cfg.clearFace;
  let dropped = 0;
  for (const piece of pieces.filter((x) => x.kind === 'body')) {
    const keep = [];
    for (let t = 0; t < piece.idx.length; t += 3) {
      const v = [0, 1, 2].map((k) => piece.pos[piece.idx[t + k]]);
      const c = [0, 1, 2].map((k) => (v[0][k] + v[1][k] + v[2][k]) / 3);
      const inside = ((c[0] - cx) / rx) ** 2 + ((c[1] - cy) / ry) ** 2 < 1 && c[2] > lo[2] - (hi[2] - lo[2]) - 0.02;
      if (inside) dropped++;
      else keep.push(piece.idx[t], piece.idx[t + 1], piece.idx[t + 2]);
    }
    piece.idx = keep;
  }
  console.log('cara despejada:', dropped, 'triángulos del cuerpo fuera');
}

// ---------------------------------------------------------------- la malla
const P = [];
const N = [];
const UV = [];
const JN = [];
const WT = [];
const IDX = [];
for (const p of pieces) {
  const base = P.length / 3;
  const r = rects[p.tex];
  p.pos.forEach((v, i) => {
    P.push(...v);
    N.push(...p.nrm[i]);
    const cl = (x, n) => Math.min(1 - 0.5 / n, Math.max(0.5 / n, x)); // sin tocar el borde (la celda de al lado)
    UV.push((r.x + cl(p.uv[i * 2], r.w) * r.w) / ATLAS, (r.y + cl(p.uv[i * 2 + 1], r.h) * r.h) / ATLAS);
    const w = weights(p, v).slice(0, 4);
    const sum = w.reduce((s, [, x]) => s + x, 0);
    for (let k = 0; k < 4; k++) {
      JN.push(w[k] ? w[k][0] : 0);
      WT.push(w[k] ? w[k][1] / sum : 0);
    }
  });
  for (const i of p.idx) IDX.push(base + i);
}

// ---------------------------------------------------------------- la cara (para la carita de las señas)
const eyes = pieces.filter((p) => p.name === cfg.face).flatMap((p) => p.pos.filter((_, i) => opaque(p, i)));
const faceV = eyes.length ? eyes : pieces.filter((p) => p.kind === 'body').flatMap((p) => p.pos).filter((v) => v[2] > bz[1] - (bz[1] - bz[0]) * 0.15);
const fc = faceV.reduce((a, v) => a.map((x, k) => x + v[k] / faceV.length), [0, 0, 0]);
// la superficie de la cara: lo más adelante del cuerpo cerca del centro de la cara (los ojos pueden ser planos sueltos)
const near = faceV.filter((v) => Math.abs(v[0] - fc[0]) < (bx[1] - bx[0]) * 0.12 && Math.abs(v[1] - fc[1]) < bh * 0.12);
const faceZ = near.length ? Math.max(...near.map((v) => v[2])) : fc[2];
const face = { emoji: { p: [fc[0], fc[1], faceZ + 0.01], r: (bx[1] - bx[0]) * 0.36 } };
console.log(id, 'cara', JSON.stringify(face), 'cuerpo', JSON.stringify(body.map((b) => b.map((x) => +x.toFixed(3)))));
console.log('huesos', joints.map((j) => `${j.name}@${j.p.map((x) => x.toFixed(2)).join(',')}`).join('  '));

// ---------------------------------------------------------------- el GLB
const chunks = [];
let off = 0;
const views = [];
const accessors = [];
function addView(arr, target) {
  const bytes = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  const pad = (4 - (off % 4)) % 4;
  if (pad) chunks.push(Buffer.alloc(pad)), (off += pad);
  views.push({ buffer: 0, byteOffset: off, byteLength: bytes.length, ...(target ? { target } : {}) });
  chunks.push(bytes);
  off += bytes.length;
  return views.length - 1;
}
function addAccessor(arr, componentType, type, target, minmax = false) {
  const bv = addView(arr, target);
  const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[type];
  const out = { bufferView: bv, componentType, count: arr.length / n, type };
  if (minmax) {
    out.min = [0, 1, 2].map((c) => Math.min(...Array.from({ length: out.count }, (_, i) => arr[i * 3 + c])));
    out.max = [0, 1, 2].map((c) => Math.max(...Array.from({ length: out.count }, (_, i) => arr[i * 3 + c])));
  }
  accessors.push(out);
  return accessors.length - 1;
}
const attrs = {
  POSITION: addAccessor(new Float32Array(P), 5126, 'VEC3', 34962, true),
  NORMAL: addAccessor(new Float32Array(N), 5126, 'VEC3', 34962),
  TEXCOORD_0: addAccessor(new Float32Array(UV), 5126, 'VEC2', 34962),
  JOINTS_0: addAccessor(new Uint16Array(JN), 5123, 'VEC4', 34962),
  WEIGHTS_0: addAccessor(new Float32Array(WT), 5126, 'VEC4', 34962),
};
const indices = addAccessor(new Uint32Array(IDX), 5125, 'SCALAR', 34963);
// huesos: sin rotación, cada uno corrido de su padre; la inversa de enlace es correrlo de vuelta
const ibm = new Float32Array(joints.length * 16);
joints.forEach((j, i) => ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -j.p[0], -j.p[1], -j.p[2], 1], i * 16));
const ibmAcc = addAccessor(ibm, 5126, 'MAT4');
const imgView = addView(encodePngRgb(atlas, true));
const nodes = [
  { name: id, children: [1, 2] },
  { name: `${id}-malla`, mesh: 0, skin: 0 },
  ...joints.map((j) => {
    const par = j.parent >= 0 ? joints[j.parent].p : [0, 0, 0];
    return { name: `mixamorig:${j.name}`, translation: j.p.map((x, k) => x - par[k]) };
  }),
];
joints.forEach((j, i) => {
  if (j.parent >= 0) (nodes[j.parent + 2].children ||= []).push(i + 2);
});
nodes[0].children = [1, 2]; // la malla y la cadera
const out = {
  asset: { version: '2.0', generator: 'Trukeados tools/rig-rigid.mjs', extras: J.asset.extras },
  extras: { face, alpha: true, seatLift: cfg.seatLift || 0, handsForward: cfg.handsForward || 0, cardsOffset: cfg.cardsOffset || [0, 0, 0] },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes,
  meshes: [{ name: id, primitives: [{ attributes: attrs, indices, material: 0 }] }],
  skins: [{ joints: joints.map((_, i) => i + 2), inverseBindMatrices: ibmAcc }],
  materials: [{ name: 'piel', doubleSided: true, alphaMode: 'MASK', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 } }],
  textures: [{ sampler: 0, source: 0 }],
  samplers: [{ magFilter: 9729, minFilter: 9987 }],
  images: [{ bufferView: imgView, mimeType: 'image/png' }],
  accessors,
  bufferViews: views,
  buffers: [{ byteLength: off }],
};
let json = Buffer.from(JSON.stringify(out));
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
let bin = Buffer.concat(chunks);
bin = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
const headB = Buffer.alloc(12);
headB.write('glTF', 0, 'latin1');
headB.writeUInt32LE(2, 4);
headB.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
const ch = (len, kind) => {
  const b = Buffer.alloc(8);
  b.writeUInt32LE(len, 0);
  b.write(kind, 4, 'latin1');
  return b;
};
const dest = path.resolve('public/models', `${id}.glb`);
fs.writeFileSync(dest, Buffer.concat([headB, ch(json.length, 'JSON'), json, ch(bin.length, 'BIN\0'), bin]));
console.log(`${dest}: ${(fs.statSync(dest).size / 1e6).toFixed(2)} MB`);
