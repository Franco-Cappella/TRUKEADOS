// Lectura de un GLB cualquiera (para las herramientas): el JSON, los datos de cada accessor y la matriz de cada nodo
// en el mundo. Sin librerías.
import fs from 'node:fs';

const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const GET = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' };
export const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

export function readGlb(file) {
  const glb = fs.readFileSync(file);
  const jsonLen = glb.readUInt32LE(12);
  const J = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen + 8;
  const BIN = glb.subarray(binStart, binStart + glb.readUInt32LE(20 + jsonLen));
  // los datos de un accessor, compactos
  const read = (ai) => {
    const a = J.accessors[ai];
    const bv = J.bufferViews[a.bufferView];
    const T = COMP[a.componentType];
    const n = SIZE[a.type];
    const stride = bv.byteStride || n * T.BYTES_PER_ELEMENT;
    const out = new T(a.count * n);
    const base = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const view = new DataView(BIN.buffer, BIN.byteOffset);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) out[i * n + k] = view[GET[a.componentType]](base + i * stride + k * T.BYTES_PER_ELEMENT, true);
    return out;
  };
  const bytes = (bvi) => {
    const bv = J.bufferViews[bvi];
    return BIN.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
  };
  // matrices del mundo (columna por columna, como glTF)
  const local = (n) => {
    if (n.matrix) return n.matrix.slice();
    const [x, y, z, w] = n.rotation || [0, 0, 0, 1];
    const [sx, sy, sz] = n.scale || [1, 1, 1];
    const [tx, ty, tz] = n.translation || [0, 0, 0];
    return [
      (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
      2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
      2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
      tx, ty, tz, 1,
    ];
  };
  const world = new Array(J.nodes.length);
  const walk = (i, parent) => {
    world[i] = parent ? mul(parent, local(J.nodes[i])) : local(J.nodes[i]);
    for (const c of J.nodes[i].children || []) walk(c, world[i]);
  };
  for (const r of J.scenes[J.scene || 0].nodes) walk(r, null);
  return { J, BIN, read, bytes, world };
}

export function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
export const apply = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
export const applyDir = (m, x, y, z) => {
  const v = [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];
  const l = Math.hypot(...v) || 1;
  return v.map((c) => c / l);
};
