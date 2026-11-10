// Personajes 3D (los de la tienda, ranura "personaje"): cargan un GLB preparado con tools/build-skin.mjs (malla con
// esqueleto estilo Mixamo) y se posan por código: sentado, con las cartas en la mano izquierda, la derecha que tira,
// la cabeza que mira. Las señas son una carita tipo emoji que le tapa la cara (en el lugar que encontró la
// herramienta: extras.face). Sin librerías: el lector de GLB es propio y solo entiende ese formato.
import * as THREE from 'three';

// ------------------------------------------------------------------ lectura del GLB
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const COMP = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };

const cache = new Map(); // url -> Promise<template>

async function parse(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('No es un GLB');
  const jsonLen = dv.getUint32(12, true);
  const J = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
  const binStart = 20 + jsonLen + 8;
  const view = (bv) => {
    const v = J.bufferViews[bv];
    return buf.slice(binStart + (v.byteOffset || 0), binStart + (v.byteOffset || 0) + v.byteLength);
  };
  const acc = (i) => {
    const a = J.accessors[i];
    const T = COMP[a.componentType];
    return { data: new T(view(a.bufferView), a.byteOffset || 0, a.count * SIZE[a.type]), size: SIZE[a.type] };
  };
  const prim = J.meshes[0].primitives[0];
  const geo = new THREE.BufferGeometry();
  const attr = (name, key) => {
    const a = acc(prim.attributes[name]);
    geo.setAttribute(key, new THREE.BufferAttribute(a.data, a.size));
  };
  attr('POSITION', 'position');
  attr('NORMAL', 'normal');
  attr('TEXCOORD_0', 'uv');
  attr('JOINTS_0', 'skinIndex');
  attr('WEIGHTS_0', 'skinWeight');
  geo.setIndex(new THREE.BufferAttribute(acc(prim.indices).data, 1));
  geo.computeBoundingSphere();
  const img = J.images[0];
  const bitmap = await createImageBitmap(new Blob([view(img.bufferView)], { type: img.mimeType }));
  const map = new THREE.Texture(bitmap);
  map.flipY = false;
  map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;
  const ibm = acc(J.skins[0].inverseBindMatrices).data;
  return { J, geo, map, ibm, face: J.extras?.face || null, alpha: !!J.extras?.alpha };
}

/** Promesa del molde de un personaje (se baja una sola vez). */
export function loadModel(url) {
  if (!cache.has(url)) {
    const p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`No se pudo bajar ${url}`);
        return r.arrayBuffer();
      })
      .then(parse);
    p.catch(() => cache.delete(url)); // si falló, se vuelve a probar la próxima vez
    cache.set(url, p);
  }
  return cache.get(url);
}

// ------------------------------------------------------------------ un personaje armado
const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const q1 = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

// Gira `bone` (en el mundo) para que su hijo `child` quede en dirección a `target` (posición en el mundo).
function aim(bone, child, target) {
  bone.updateWorldMatrix(true, false);
  child.updateWorldMatrix(false, false);
  const bp = bone.getWorldPosition(v1);
  const cur = child.getWorldPosition(v2).sub(bp).normalize();
  const want = v3.copy(target).sub(bp);
  if (want.lengthSq() < 1e-8 || cur.lengthSq() < 1e-8) return;
  want.normalize();
  q1.setFromUnitVectors(cur, want);
  rotateWorldQ(bone, q1);
}

// Aplica una rotación (en el mundo) a un hueso.
function rotateWorldQ(bone, q) {
  bone.updateWorldMatrix(true, false);
  const wq = bone.getWorldQuaternion(q2);
  const parentQ = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.copy(parentQ.invert().multiply(q.clone().multiply(wq)));
  bone.updateMatrixWorld(true);
}

const rotateWorld = (bone, axis, angle) => rotateWorldQ(bone, new THREE.Quaternion().setFromAxisAngle(axis, angle));

// Dos huesos (brazo y antebrazo, o muslo y pierna): el codo (la rodilla) sale para el lado de `pole`.
function twoBone(a, b, end, target, pole) {
  a.updateWorldMatrix(true, true);
  const A = a.getWorldPosition(new THREE.Vector3());
  const B = b.getWorldPosition(new THREE.Vector3());
  const C = end.getWorldPosition(new THREE.Vector3());
  const l1 = A.distanceTo(B);
  const l2 = B.distanceTo(C);
  const dir = target.clone().sub(A);
  const d = THREE.MathUtils.clamp(dir.length(), Math.abs(l1 - l2) + 1e-4, (l1 + l2) * 0.999);
  dir.normalize();
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const p = pole.clone().sub(A);
  const perp = p.sub(dir.clone().multiplyScalar(p.dot(dir))).normalize();
  const elbow = A.clone().addScaledVector(dir, along).addScaledVector(perp, h);
  aim(a, b, elbow);
  aim(b, end, A.clone().addScaledVector(dir, d));
}

const ease = (t) => t * t * (3 - 2 * t);

/**
 * Un personaje armado a partir del molde. `root` va en la escena: mira hacia +z (la mesa) y se para en el piso.
 * pose({ headYaw, headDown, cards, reach, reachTo, leftTo }) lo acomoda; face.set(expr, talking, bite) hace las señas.
 */
export class Rig {
  constructor(tpl, { scale = 1 } = {}) {
    const { J } = tpl;
    const jointSet = new Set(J.skins[0].joints);
    const objs = J.nodes.map((n, i) => {
      const o = jointSet.has(i) ? new THREE.Bone() : new THREE.Object3D();
      o.name = n.name || '';
      if (n.translation) o.position.fromArray(n.translation);
      if (n.rotation) o.quaternion.fromArray(n.rotation);
      if (n.scale) o.scale.fromArray(n.scale);
      return o;
    });
    J.nodes.forEach((n, i) => (n.children || []).forEach((c) => objs[i].add(objs[c])));
    this.model = new THREE.Group();
    for (const i of J.scenes[0].nodes) this.model.add(objs[i]);
    const meshNode = J.nodes.findIndex((n) => n.mesh != null);
    // los armados con tools/rig-rigid.mjs tienen partes transparentes (ojos, bigotes): se recortan
    const material = new THREE.MeshLambertMaterial({ map: tpl.map, side: THREE.DoubleSide, alphaTest: tpl.alpha ? 0.5 : 0 });
    this.mesh = new THREE.SkinnedMesh(tpl.geo, material);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false; // los huesos lo mueven: la esfera de la malla quieta no sirve
    objs[meshNode].add(this.mesh);
    const bones = J.skins[0].joints.map((j) => objs[j]);
    const inv = bones.map((_, k) => new THREE.Matrix4().fromArray(tpl.ibm, k * 16));
    this.model.updateMatrixWorld(true); // se enlaza sin escala: la malla toma la escala de los huesos
    this.mesh.bind(new THREE.Skeleton(bones, inv), this.mesh.matrixWorld);
    this.b = Object.fromEntries(bones.map((b) => [b.name.replace('mixamorig:', ''), b]));
    this.rest = new Map(bones.map((b) => [b, b.quaternion.clone()]));
    this.root = new THREE.Group();
    this.root.add(this.model);
    this.model.scale.setScalar(scale);
    // las señas: una carita encima de la cara (dónde va: extras.face.emoji, o calculado de los ojos y la boca)
    const spot = emojiSpot(tpl.face);
    this.face = spot ? new EmojiFace(this, spot) : null;
    this.reachT = 0;
    // personajes con otro cuerpo (tools/rig-rigid.mjs): sentados más arriba y con las manos más adelante
    this.lift = (tpl.J.extras?.seatLift || 0) * scale;
    this.forward = (tpl.J.extras?.handsForward || 0) * scale;
    // dónde van las cartas de la mano respecto de la mano izquierda (espacio del personaje)
    this.cardsOffset = new THREE.Vector3(...(tpl.J.extras?.cardsOffset || [0, 0, 0])).multiplyScalar(scale);
  }

  /** Posición en el mundo de un hueso. */
  at(name, out = new THREE.Vector3()) {
    return this.b[name].getWorldPosition(out);
  }

  // Del espacio del personaje (x a su izquierda, y arriba, z hacia la mesa) al mundo.
  local(x, y, z) {
    return this.root.localToWorld(new THREE.Vector3(x, y, z));
  }

  /**
   * seat: altura del asiento (en el espacio del personaje). opts.left / opts.right: posiciones (mundo) para las
   * manos; si faltan, la izquierda sostiene las cartas frente al pecho y la derecha descansa en la mesa.
   * headYaw (radianes, positivo = a su izquierda) y headDown (0 a 1) giran la cabeza. hideHead: primera persona.
   */
  pose({ seatY = 0.47, tableY = 0.74, headYaw = 0, headDown = 0, left = null, right = null, hideHead = false, breathe = 0 } = {}) {
    for (const [b, q] of this.rest) b.quaternion.copy(q);
    this.root.updateMatrixWorld(true);
    const b = this.b;
    // la cadera sobre el asiento, un poco atrás
    const hips = b.Hips;
    hips.position.copy(this.hipsRest || (this.hipsRest = hips.position.clone()));
    this.root.updateMatrixWorld(true);
    const s = this.model.scale.x;
    const want = this.local(0, seatY + 0.09 + this.lift, -0.06);
    const now = this.at('Hips');
    const delta = want.sub(now);
    // delta está en el mundo: se pasa al espacio del padre de la cadera
    const parentInv = new THREE.Matrix4().copy(hips.parent.matrixWorld).invert();
    const target = this.at('Hips').add(delta).applyMatrix4(parentInv);
    hips.position.copy(target);
    this.root.updateMatrixWorld(true);
    // inclinado hacia la mesa (y respira)
    const toRight = new THREE.Vector3(-1, 0, 0).transformDirection(this.root.matrixWorld);
    rotateWorld(b.Spine, toRight, 0.12 + breathe * 0.01);
    // piernas: muslo hacia adelante, pierna hacia abajo
    for (const [side, sx] of [['Left', 1], ['Right', -1]]) {
      const foot = this.local(sx * 0.13, 0.09, 0.4 * s);
      const pole = this.local(sx * 0.14, seatY + 0.4, 1.2); // la rodilla sale para adelante y arriba
      twoBone(b[`${side}UpLeg`], b[`${side}Leg`], b[`${side}Foot`], foot, pole);
      if (b[`${side}ToeBase`]) aim(b[`${side}Foot`], b[`${side}ToeBase`], this.local(sx * 0.14, 0.03, 0.4 * s + 0.2));
    }
    // brazos
    const chestY = this.at('Spine2').y;
    const L = left || this.local(0.06, Math.max(tableY + 0.12, chestY - 0.18), 0.32 + this.forward);
    const R = right || this.local(-0.2, tableY + 0.03, 0.4 + this.forward);
    twoBone(b.LeftArm, b.LeftForeArm, b.LeftHand, L, this.local(0.6, chestY - 0.6, -0.2));
    twoBone(b.RightArm, b.RightForeArm, b.RightHand, R, this.local(-0.6, chestY - 0.6, -0.2));
    // la mano izquierda abierta hacia la cara (sostiene las cartas); la derecha apoyada
    this.curl('Left', 0.5);
    this.curl('Right', 0.25);
    // cabeza
    rotateWorld(b.Neck, UP, headYaw * 0.4);
    rotateWorld(b.Head, UP, headYaw * 0.6);
    // mirar para abajo: alrededor del eje izquierda-derecha del personaje (girado con la cabeza)
    const pitchAxis = new THREE.Vector3(1, 0, 0).transformDirection(this.root.matrixWorld).applyAxisAngle(UP, headYaw);
    rotateWorld(b.Neck, pitchAxis, 0.2 * headDown);
    rotateWorld(b.Head, pitchAxis, 0.35 * headDown);
    b.Head.scale.setScalar(hideHead ? 0.001 : 1);
    this.model.updateMatrixWorld(true);
  }

  /** De pie (la taquilla): brazos al costado, respira y gira la cabeza un poco. */
  stand({ breathe = 0, headYaw = 0 } = {}) {
    for (const [b, q] of this.rest) b.quaternion.copy(q);
    const b = this.b;
    this.hipsRest ||= b.Hips.position.clone();
    b.Hips.position.copy(this.hipsRest);
    b.Head.scale.setScalar(1);
    this.root.updateMatrixWorld(true);
    const hipY = this.root.worldToLocal(this.at('Hips')).y;
    const chestY = this.root.worldToLocal(this.at('Spine2')).y;
    const side = 0.2 + breathe * 0.004;
    twoBone(b.LeftArm, b.LeftForeArm, b.LeftHand, this.local(side, hipY - 0.04, 0.05), this.local(0.3, chestY - 0.25, -0.6));
    twoBone(b.RightArm, b.RightForeArm, b.RightHand, this.local(-side, hipY - 0.04, 0.05), this.local(-0.3, chestY - 0.25, -0.6));
    this.curl('Left', 0.35);
    this.curl('Right', 0.35);
    rotateWorld(b.Spine, new THREE.Vector3(1, 0, 0).transformDirection(this.root.matrixWorld), -0.02 + breathe * 0.012);
    rotateWorld(b.Head, UP, headYaw);
    this.model.updateMatrixWorld(true);
  }

  /** Pose de póster (la foto de la tienda): las dos manos en la cintura, como superhéroe, y la cabeza ladeada. */
  hero() {
    for (const [b, q] of this.rest) b.quaternion.copy(q);
    const b = this.b;
    this.hipsRest ||= b.Hips.position.clone();
    b.Hips.position.copy(this.hipsRest);
    b.Head.scale.setScalar(1);
    this.root.updateMatrixWorld(true);
    const hipY = this.root.worldToLocal(this.at('Hips')).y;
    const chestY = this.root.worldToLocal(this.at('Spine2')).y;
    const fwd = new THREE.Vector3(0, 0, 1).transformDirection(this.root.matrixWorld);
    // un poco de cadera y de pecho para el costado: menos duro
    rotateWorld(b.Spine, fwd, 0.05);
    this.root.updateMatrixWorld(true);
    // derecha: el puño en la cintura, el codo afuera
    twoBone(b.RightArm, b.RightForeArm, b.RightHand, this.local(-0.17, hipY + 0.07, 0.05), this.local(-0.7, chestY - 0.15, -0.1));
    // izquierda: igual (nada de brazos levantados: un brazo arriba y estirado parece otra cosa)
    twoBone(b.LeftArm, b.LeftForeArm, b.LeftHand, this.local(0.17, hipY + 0.07, 0.05), this.local(0.7, chestY - 0.15, -0.1));
    this.curl('Right', 0.9);
    this.curl('Left', 0.9);
    rotateWorld(b.Head, fwd, -0.12);
    rotateWorld(b.Head, UP, 0.2);
    this.model.updateMatrixWorld(true);
  }

  // Dobla un poco los dedos (0 = estirados).
  curl(side, k) {
    for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) {
      for (let j = 1; j <= 3; j++) {
        const bone = this.b[`${side}Hand${f}${j}`];
        if (bone) bone.rotateX(0.5 * k);
      }
    }
  }

  dispose() {
    this.mesh.material.dispose();
    this.face?.dispose();
  }
}

// ------------------------------------------------------------------ las señas: una carita
// La seña es una carita redonda, tipo emoji, que aparece tapándole toda la cara mientras dura. Sin seña no se ve nada.
const EMOJI_PX = 256;

// Dónde va la carita: la del modelo (tools/rig-rigid.mjs) o, en los de build-skin.mjs, entre los ojos y la boca,
// apoyada en la nariz y del ancho de la cara.
function emojiSpot(face) {
  if (!face) return null;
  if (face.emoji) return face.emoji;
  if (!face.eyes || !face.mouth) return null;
  const [eL, eR] = face.eyes;
  const eyeY = (eL.p[1] + eR.p[1]) / 2;
  const front = Math.max(eL.p[2], eR.p[2], face.mouth.p[2], face.nose?.[2] ?? -Infinity);
  return { p: [(eL.p[0] + eR.p[0]) / 2, eyeY * 0.75 + face.mouth.p[1] * 0.25, front], r: Math.abs(eR.p[0] - eL.p[0]) * 1.5 };
}

class EmojiFace {
  constructor(rig, { p, r }) {
    this.key = '';
    const head = rig.b.Head;
    const sk = rig.mesh.skeleton;
    const toHead = sk.boneInverses[sk.bones.indexOf(head)].clone();
    const headQ = new THREE.Quaternion();
    toHead.decompose(new THREE.Vector3(), headQ, new THREE.Vector3());
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = EMOJI_PX;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    const size = r * 1.35;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, alphaTest: 0.05, depthWrite: false })
    );
    this.mesh.position.copy(new THREE.Vector3(p[0], p[1], p[2] + r * 0.12).applyMatrix4(toHead));
    this.mesh.quaternion.copy(headQ);
    this.mesh.renderOrder = 3;
    this.mesh.visible = false;
    head.add(this.mesh);
  }

  set(expr, talking = false, bite = 1) {
    const key = `${expr}|${expr === 'bite' ? Math.round(bite * 14) : ''}`;
    if (key === this.key) return;
    this.key = key;
    if (!EMOJI[expr]) {
      this.on = false;
      this.mesh.visible = false; // sin seña (o hablando): la cara de siempre
      return;
    }
    const c = this.ctx;
    const s = EMOJI_PX;
    c.clearRect(0, 0, s, s);
    c.save();
    c.translate(s / 2, s / 2);
    c.scale(s / 200, s / 200); // se dibuja en un círculo de radio 92 centrado en (0, 0)
    // la carita: amarilla, con borde y un brillo
    const g = c.createRadialGradient(-28, -34, 10, 0, 0, 96);
    g.addColorStop(0, '#fff3a6');
    g.addColorStop(0.55, '#ffd23f');
    g.addColorStop(1, '#f2a516');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, 92, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 6;
    c.strokeStyle = '#7a4a10';
    c.stroke();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = INK;
    c.fillStyle = INK;
    EMOJI[expr](c, bite);
    c.restore();
    this.tex.needsUpdate = true;
    this.on = true;
    this.mesh.visible = this.mesh.material.opacity > 0.02;
  }

  /** Cuánto se ve la carita (0 a 1): la mesa la apaga si no lo estás mirando. */
  fade(k) {
    this.mesh.material.opacity = k;
    this.mesh.visible = this.on && k > 0.02;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.tex.dispose();
  }
}

const INK = '#3b2208';
// Piezas de las caritas (x a la derecha de la imagen = la izquierda del personaje).
const dot = (c, x, y, r = 11) => {
  c.fillStyle = INK;
  c.beginPath();
  c.ellipse(x, y, r * 0.85, r * 1.15, 0, 0, Math.PI * 2);
  c.fill();
};
// up > 0: panza para arriba; up < 0: para abajo
const arc = (c, x, y, w, up, lw = 7) => {
  c.strokeStyle = INK;
  c.lineWidth = lw;
  c.beginPath();
  c.moveTo(x - w, y);
  c.quadraticCurveTo(x, y - up, x + w, y);
  c.stroke();
};
const line = (c, x0, y0, x1, y1, lw = 7) => {
  c.strokeStyle = INK;
  c.lineWidth = lw;
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
};
const curve = (c, pts, lw = 7) => {
  c.strokeStyle = INK;
  c.lineWidth = lw;
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  c.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
  c.stroke();
};
export const EMOJI = { // las caritas de las señas (exportadas para mirarlas en tools/)
  // cejas bien arriba, ojos grandes
  brows: (c) => {
    arc(c, -34, -54, 20, 16);
    arc(c, 34, -54, 20, 16);
    dot(c, -34, -16, 13);
    dot(c, 34, -16, 13);
    arc(c, 0, 40, 22, -10);
  },
  // un ojo cerrado (el izquierdo del personaje, a la derecha de la imagen) y sonrisa de costado
  wink: (c) => {
    dot(c, -34, -18, 12);
    arc(c, 34, -14, 18, 14);
    curve(c, [-34, 30, 4, 62, 40, 24]);
  },
  // boca torcida a la derecha del personaje (la izquierda de la imagen)
  mouthRight: (c) => {
    dot(c, -32, -18);
    dot(c, 32, -18);
    curve(c, [12, 42, -24, 46, -50, 24]);
  },
  mouthLeft: (c) => {
    dot(c, -32, -18);
    dot(c, 32, -18);
    curve(c, [-12, 42, 24, 46, 50, 24]);
  },
  // Se muerde el labio (la seña del tres), con la boca cerrada: la línea del labio de arriba, el labio de abajo
  // carnoso y los dos dientes de adelante apoyados encima. Con bite de 0 a 1 los dientes se hunden en el labio, que se
  // aplasta, se pone más oscuro y se le marca el pozo; la ceja sube, los ojos se entrecierran y los cachetes se ponen
  // colorados. Animado (SENA_BITE_MS) se ve el mordisco ir y venir.
  bite: (c, bite = 1) => {
    const b = Math.max(0, Math.min(1, bite));
    // cachetes
    c.fillStyle = 'rgba(255, 80, 80, ' + (0.15 + b * 0.35) + ')';
    for (const x of [-58, 58]) {
      c.beginPath();
      c.ellipse(x, 24, 16, 10, 0, 0, Math.PI * 2);
      c.fill();
    }
    // cejas: una sube (pícara), la otra baja un poco
    arc(c, -36, -50 - b * 8, 20, 10 + b * 8, 7);
    line(c, 18, -44 + b * 3, 52, -42, 7);
    // ojos entrecerrados: la pupila recortada por el párpado (una línea que baja con el mordisco)
    for (const x of [-34, 34]) {
      const lid = -24 + b * 9;
      c.save();
      c.beginPath();
      c.rect(x - 20, lid, 40, 40);
      c.clip();
      dot(c, x, -14, 12);
      c.restore();
      arc(c, x, lid, 17, -3, 6);
    }
    // labio de abajo: una medialuna carnosa debajo de la línea de la boca (la boca, grande: es lo que hay que leer)
    const top = 30 - b * 2; // donde se juntan los labios
    c.save();
    c.translate(0, top);
    c.scale(1.35, 1.35);
    c.translate(0, -top);
    const lw = 28 + b * 5;
    const lh = 17 - b * 4; // mordido, más chato
    const tl = 5 + b * 9; // cuánto se ven los dientes (se hunden en el labio)
    const lip = () => {
      c.beginPath();
      c.moveTo(-lw, top);
      c.quadraticCurveTo(-lw * 0.5, top + 2, 0, top + 4 * b); // el medio se hunde donde muerden
      c.quadraticCurveTo(lw * 0.5, top + 2, lw, top);
      c.bezierCurveTo(lw * 0.8, top + lh * 1.5, -lw * 0.8, top + lh * 1.5, -lw, top);
      c.closePath();
    };
    lip();
    c.fillStyle = b > 0.5 ? '#c93a4a' : '#e0505a';
    c.fill();
    c.save();
    lip();
    c.clip();
    // brillo abajo y la marca oscura donde se clavan los dientes
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.beginPath();
    c.ellipse(-8, top + lh * 0.75, lw * 0.4, lh * 0.18, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(110, 5, 20, ' + b * 0.75 + ')';
    c.beginPath();
    c.ellipse(0, top + tl + 1, 18, 3 + b * 5, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
    lip();
    c.strokeStyle = INK;
    c.lineWidth = 5;
    c.stroke();
    // los dos dientes de adelante, desde la línea de la boca: bajan y se hunden en el labio
    for (const x of [-10, 10]) {
      c.beginPath();
      c.roundRect(x - 8, top - 4, 16, tl + 4, [1, 1, 5, 5]);
      c.fillStyle = '#ffffff';
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 4;
      c.stroke();
    }
    // la línea del labio de arriba (tapa el arranque de los dientes) con las comisuras para abajo
    curve(c, [-lw - 4, top + 3, 0, top - 4, lw + 4, top + 3], 5);
    // tensión en las comisuras al apretar
    if (b > 0.4) {
      c.globalAlpha = (b - 0.4) / 0.6;
      curve(c, [-lw - 10, top - 6, -lw - 16, top + 4, -lw - 10, top + 14], 4);
      curve(c, [lw + 10, top - 6, lw + 16, top + 4, lw + 10, top + 14], 4);
      c.globalAlpha = 1;
    }
    c.restore();
  },
  // trompita y un corazón
  kiss: (c) => {
    arc(c, -34, -16, 16, 10);
    arc(c, 34, -16, 16, 10);
    c.strokeStyle = INK;
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(-4, 22);
    c.quadraticCurveTo(18, 30, -2, 38);
    c.quadraticCurveTo(18, 46, -4, 54);
    c.stroke();
    c.fillStyle = 'rgba(255, 90, 90, 0.5)';
    for (const x of [-54, 54]) {
      c.beginPath();
      c.ellipse(x, 20, 16, 10, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#ff3b6b';
    c.beginPath();
    c.moveTo(62, 46);
    c.bezierCurveTo(62, 36, 46, 34, 46, 46);
    c.bezierCurveTo(46, 56, 62, 62, 62, 68);
    c.bezierCurveTo(62, 62, 78, 56, 78, 46);
    c.bezierCurveTo(78, 34, 62, 36, 62, 46);
    c.fill();
  },
  // boca bien abierta
  open: (c) => {
    dot(c, -34, -24, 14);
    dot(c, 34, -24, 14);
    c.fillStyle = '#5a1a0c';
    c.beginPath();
    c.ellipse(0, 38, 22, 28, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e8566b';
    c.beginPath();
    c.ellipse(0, 54, 13, 8, 0, 0, Math.PI * 2);
    c.fill();
  },
  // ojos cerrados, boca chata
  eyesClosed: (c) => {
    arc(c, -34, -14, 18, -10);
    arc(c, 34, -14, 18, -10);
    line(c, -18, 40, 18, 40);
  },
  // cachetes inflados
  puff: (c) => {
    c.fillStyle = 'rgba(255, 120, 80, 0.55)';
    for (const x of [-48, 48]) {
      c.beginPath();
      c.arc(x, 24, 26, 0, Math.PI * 2);
      c.fill();
    }
    dot(c, -32, -26, 10);
    dot(c, 32, -26, 10);
    c.fillStyle = INK;
    c.beginPath();
    c.arc(0, 36, 7, 0, Math.PI * 2);
    c.fill();
  },
  // nariz fruncida: ojos apretados y arruguitas
  nose: (c) => {
    line(c, -48, -26, -22, -16);
    line(c, -48, -6, -22, -16);
    line(c, 48, -26, 22, -16);
    line(c, 48, -6, 22, -16);
    for (const x of [-12, 0, 12]) line(c, x - 4, 4, x + 4, 12, 4);
    arc(c, 0, 44, 20, 8);
  },
  // boca para abajo y cejas tristes
  frown: (c) => {
    line(c, -48, -42, -20, -34, 6);
    line(c, 48, -42, 20, -34, 6);
    dot(c, -32, -14);
    dot(c, 32, -14);
    arc(c, 0, 50, 26, 18);
  },
};
