// Prepara un personaje 3D para la mesa: lee un GLB con esqueleto (estilo Mixamo, exportado de Blender) y deja en
// public/models/<id>.glb uno liviano: solo la malla con su esqueleto, sin animaciones, con la textura de color
// achicada (TEXTURE px) y sin las de relieve y brillo. Además busca en la cara los ojos, la boca y el color de piel
// (extras.face) para dibujar las señas encima de la cara (ver public/js/models.js).
//   node tools/build-skin.mjs <archivo.glb> <id>
import fs from 'node:fs';
import path from 'node:path';
import { decodePng, encodePngRgb, shrinkTo } from './png.mjs';

const TEXTURE = 1024;
const [src, id] = process.argv.slice(2);
if (!src || !/^[a-z0-9-]+$/.test(id || '')) throw new Error('Uso: node tools/build-skin.mjs <archivo.glb> <id>');

const glb = fs.readFileSync(src);
const jsonLen = glb.readUInt32LE(12);
const J = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;
const BIN = glb.subarray(binStart, binStart + glb.readUInt32LE(20 + jsonLen));

const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
// Los datos de un accessor, compactos (sin intercalar).
function read(ai) {
  const a = J.accessors[ai];
  const bv = J.bufferViews[a.bufferView];
  const T = COMP[a.componentType];
  const n = SIZE[a.type];
  const stride = bv.byteStride || n * T.BYTES_PER_ELEMENT;
  const out = new T(a.count * n);
  const base = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const view = new DataView(BIN.buffer, BIN.byteOffset);
  const get = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[a.componentType];
  for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) out[i * n + k] = view[get](base + i * stride + k * T.BYTES_PER_ELEMENT, true);
  return { a, data: out };
}

const prim = J.meshes[0].primitives[0];
const attrs = Object.fromEntries(Object.entries(prim.attributes).map(([k, v]) => [k, read(v)]));
const indices = read(prim.indices);
const skin = J.skins[0];
const ibm = read(skin.inverseBindMatrices);
const mat = J.materials[prim.material ?? 0];
const colorImg = J.images[J.textures[mat.pbrMetallicRoughness.baseColorTexture.index].source];
const imgBv = J.bufferViews[colorImg.bufferView];
let tex = decodePng(BIN.subarray(imgBv.byteOffset || 0, (imgBv.byteOffset || 0) + imgBv.byteLength));
tex = shrinkTo(tex, TEXTURE);

// ---------------------------------------------------------------- la cara
const pos = attrs.POSITION.data;
const nrm = attrs.NORMAL.data;
const uv = attrs.TEXCOORD_0.data;
const jnt = attrs.JOINTS_0.data;
const wgt = attrs.WEIGHTS_0.data;
const headJoint = skin.joints.findIndex((j) => J.nodes[j].name === 'mixamorig:Head');
const count = pos.length / 3;
const color = (i) => {
  const x = Math.min(tex.width - 1, Math.max(0, Math.floor(uv[i * 2] * tex.width)));
  const y = Math.min(tex.height - 1, Math.max(0, Math.floor(uv[i * 2 + 1] * tex.height)));
  const o = (y * tex.width + x) * 4;
  return [tex.data[o], tex.data[o + 1], tex.data[o + 2]];
};
const headW = (i) => {
  let w = 0;
  for (let k = 0; k < 4; k++) if (jnt[i * 4 + k] === headJoint) w += wgt[i * 4 + k];
  return w;
};
// la cara: vértices de la cabeza que miran para adelante (+z)
const face = [];
for (let i = 0; i < count; i++) if (headW(i) > 0.6 && nrm[i * 3 + 2] > 0.35) face.push(i);
const P = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
const xs = face.map((i) => pos[i * 3]);
const ys = face.map((i) => pos[i * 3 + 1]);
const box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
const cx = (box.x0 + box.x1) / 2;
const lum = ([r, g, b]) => 0.3 * r + 0.59 * g + 0.11 * b;
// color de piel: el más común entre los vértices de la cara (por cajitas de color)
const bins = new Map();
for (const i of face) {
  const c = color(i);
  const k = c.map((v) => v >> 4).join(',');
  const e = bins.get(k) || { n: 0, sum: [0, 0, 0] };
  e.n++;
  c.forEach((v, j) => (e.sum[j] += v));
  bins.set(k, e);
}
const skinBin = [...bins.values()].filter((e) => { const m = e.sum.map((v) => v / e.n); return m[0] > m[2] && lum(m) > 90; }).sort((a, b) => b.n - a.n)[0];
const skinColor = skinBin.sum.map((v) => Math.round(v / skinBin.n));
const far = (c) => Math.hypot(c[0] - skinColor[0], c[1] - skinColor[1], c[2] - skinColor[2]);
// Solo la parte de la cara donde está la piel (no el pelo): la caja de los vértices color piel.
const skinV = face.filter((i) => far(color(i)) < 40);
const sy = skinV.map((i) => pos[i * 3 + 1]);
const sx = skinV.map((i) => pos[i * 3]);
const fb = { x0: Math.min(...sx), x1: Math.max(...sx), y0: Math.min(...sy), y1: Math.max(...sy) };
const fh = fb.y1 - fb.y0;
const centroid = (list) => {
  const s = [0, 0, 0];
  for (const i of list) P(i).forEach((v, k) => (s[k] += v));
  return s.map((v) => v / list.length);
};
const spread = (list, k) => {
  const v = list.map((i) => pos[i * 3 + k]);
  return Math.max(...v) - Math.min(...v);
};
// ojos: lo oscuro o lo blanco de la mitad de arriba de la piel, a cada lado
const eyeY0 = fb.y0 + fh * 0.4;
const eyeY1 = fb.y0 + fh * 0.85;
const isEye = (c) => lum(c) < 70 || (Math.min(...c) > 205 && Math.max(...c) - Math.min(...c) < 30);
const eyeV = face.filter((i) => { const y = pos[i * 3 + 1]; return y > eyeY0 && y < eyeY1 && isEye(color(i)) && pos[i * 3] > fb.x0 && pos[i * 3] < fb.x1; });
// lo blanco del ojo: solo hay blanco en los ojos (las cejas y las pestañas son oscuras)
const isWhite = (c) => Math.min(...c) > 195 && Math.max(...c) - Math.min(...c) < 35;
const eyes = [eyeV.filter((i) => pos[i * 3] < cx), eyeV.filter((i) => pos[i * 3] >= cx)].map((all) => {
  const white = all.filter((i) => isWhite(color(i)));
  // el iris: lo oscuro cerca de lo blanco (sin las cejas, que están más arriba)
  const wy = white.length ? white.reduce((t, i) => t + pos[i * 3 + 1], 0) / white.length : null;
  const near = wy == null ? all : all.filter((i) => Math.abs(pos[i * 3 + 1] - wy) < fh * 0.06);
  const list = white.length >= 2 ? [...white, ...near] : near;
  if (list.length < 2) return null;
  const c = centroid(list);
  return { p: c, w: Math.max(0.03, spread(list, 0)), h: Math.max(0.018, spread(list, 1)) };
});
// boca: lo oscuro o rojizo del tercio de abajo de la piel, cerca del centro
// los labios: lo rojizo (más rojo que la piel); si no hay, lo oscuro
const isLip = (c) => c[0] > c[1] + 55 && c[0] > 120 && c[0] - c[1] > (skinColor[0] - skinColor[1]) + 15;
const isMouth = (c) => isLip(c) || lum(c) < 80;
const mouthAll = face.filter((i) => { const y = pos[i * 3 + 1]; return y > fb.y0 + fh * 0.05 && y < fb.y0 + fh * 0.42 && Math.abs(pos[i * 3] - cx) < (fb.x1 - fb.x0) * 0.25 && isMouth(color(i)); });
const lips = mouthAll.filter((i) => isLip(color(i)));
const mouthV = lips.length >= 3 ? lips : mouthAll;
const front = Math.max(...face.map((i) => pos[i * 3 + 2]));
const headFrontZ = (y, x) => {
  // z de la superficie de la cara cerca de (x, y)
  let best = null;
  for (const i of face) {
    const d = Math.hypot(pos[i * 3] - x, pos[i * 3 + 1] - y);
    if (!best || d < best.d) best = { d, z: pos[i * 3 + 2] };
  }
  return best ? best.z : front;
};
const fallbackEye = (side) => {
  const x = cx + side * (fb.x1 - fb.x0) * 0.22;
  const y = fb.y0 + fh * 0.62;
  return { p: [x, y, headFrontZ(y, x)], w: (fb.x1 - fb.x0) * 0.2, h: fh * 0.1, guessed: true };
};
// z de la superficie (lo más adelante) alrededor de (x, y): ahí se apoya cada capa de las señas
const surfaceZ = (x, y, r) => {
  let z = -Infinity;
  for (const i of face) if (Math.hypot(pos[i * 3] - x, pos[i * 3 + 1] - y) < r) z = Math.max(z, pos[i * 3 + 2]);
  return z === -Infinity ? headFrontZ(y, x) : z;
};
const onSurface = (pt, r) => [pt[0], pt[1], surfaceZ(pt[0], pt[1], r)];
const faceInfo0 = {
  skin: skinColor,
  eyes: [eyes[0] || fallbackEye(-1), eyes[1] || fallbackEye(1)],
  mouth: mouthV.length >= 2
    ? { p: centroid(mouthV), w: Math.max(0.03, spread(mouthV, 0)) }
    : { p: [cx, fb.y0 + fh * 0.22, headFrontZ(fb.y0 + fh * 0.22, cx)], w: (fb.x1 - fb.x0) * 0.3, guessed: true },
  box: fb,
};
const fw = fb.x1 - fb.x0;
const faceInfo = {
  ...faceInfo0,
  eyes: faceInfo0.eyes.map((e) => ({ ...e, p: onSurface(e.p, Math.max(e.w, e.h) * 0.5) })),
  mouth: { ...faceInfo0.mouth, p: onSurface(faceInfo0.mouth.p, faceInfo0.mouth.w * 0.5) },
  cheeks: [-1, 1].map((sd) => onSurface([cx + sd * fw * 0.3, faceInfo0.mouth.p[1] + fh * 0.12], fw * 0.08)),
  nose: onSurface([cx, (faceInfo0.eyes[0].p[1] + faceInfo0.mouth.p[1]) / 2], fw * 0.06),
};
console.log(id, JSON.stringify(faceInfo, (k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)));

// ---------------------------------------------------------------- el GLB nuevo
const chunks = [];
let off = 0;
const views = [];
const accessors = [];
function addView(bytes, target) {
  const pad = (4 - (off % 4)) % 4;
  if (pad) chunks.push(Buffer.alloc(pad)), (off += pad);
  views.push({ buffer: 0, byteOffset: off, byteLength: bytes.length, ...(target ? { target } : {}) });
  chunks.push(bytes);
  off += bytes.length;
  return views.length - 1;
}
function addAccessor({ a, data }, target) {
  const bv = addView(Buffer.from(data.buffer, data.byteOffset, data.byteLength), target);
  const out = { bufferView: bv, componentType: a.componentType, count: a.count, type: a.type };
  if (a.normalized) out.normalized = true;
  if (a.min) out.min = a.min;
  if (a.max) out.max = a.max;
  accessors.push(out);
  return accessors.length - 1;
}
const newAttrs = {};
for (const k of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']) newAttrs[k] = addAccessor(attrs[k], 34962);
const newIdx = addAccessor(indices, 34963);
const newIbm = addAccessor(ibm);
const png = encodePngRgb(tex);
const imgView = addView(png);
const out = {
  asset: { version: '2.0', generator: 'Trukeados tools/build-skin.mjs' },
  extras: { face: faceInfo },
  scene: 0,
  scenes: J.scenes,
  nodes: J.nodes,
  meshes: [{ name: J.meshes[0].name, primitives: [{ attributes: newAttrs, indices: newIdx, material: 0 }] }],
  skins: [{ joints: skin.joints, inverseBindMatrices: newIbm, ...(skin.skeleton != null ? { skeleton: skin.skeleton } : {}) }],
  materials: [{ name: 'skin', doubleSided: true, pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 } }],
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
const head = Buffer.alloc(12);
head.write('glTF', 0, 'latin1');
head.writeUInt32LE(2, 4);
head.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
const ch = (len, kind) => {
  const b = Buffer.alloc(8);
  b.writeUInt32LE(len, 0);
  b.write(kind, 4, 'latin1');
  return b;
};
const dest = path.resolve('public/models', `${id}.glb`);
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, Buffer.concat([head, ch(json.length, 'JSON'), json, ch(bin.length, 'BIN\0'), bin]));
console.log(`${dest}: ${(fs.statSync(dest).size / 1e6).toFixed(2)} MB`);
