// Personajes 3D (los de la tienda, ranura "personaje"): cargan un GLB preparado con tools/build-skin.mjs (malla con
// esqueleto estilo Mixamo) y se posan por código: sentado, con las cartas en la mano izquierda, la derecha que tira,
// la cabeza que mira. Las señas se dibujan en capas pegadas a la cara (ojos, boca, cachetes, nariz), en el lugar que
// encontró la herramienta (extras.face). Sin librerías: el lector de GLB es propio y solo entiende ese formato.
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
  return { J, geo, map, ibm, face: J.extras?.face || null };
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
    const material = new THREE.MeshLambertMaterial({ map: tpl.map, side: THREE.DoubleSide });
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
    this.face = tpl.face ? new FaceLayer(this, tpl.face) : null;
    this.reachT = 0;
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
    const want = this.local(0, seatY + 0.09, -0.06);
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
    const L = left || this.local(0.06, Math.max(tableY + 0.12, chestY - 0.18), 0.32);
    const R = right || this.local(-0.2, tableY + 0.03, 0.4);
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

  /** Pose de póster (la foto de la tienda): una mano en la cintura, la otra arriba saludando, la cabeza ladeada. */
  hero() {
    for (const [b, q] of this.rest) b.quaternion.copy(q);
    const b = this.b;
    this.hipsRest ||= b.Hips.position.clone();
    b.Hips.position.copy(this.hipsRest);
    b.Head.scale.setScalar(1);
    this.root.updateMatrixWorld(true);
    const hipY = this.root.worldToLocal(this.at('Hips')).y;
    const chestY = this.root.worldToLocal(this.at('Spine2')).y;
    const headY = this.root.worldToLocal(this.at('Head')).y;
    const fwd = new THREE.Vector3(0, 0, 1).transformDirection(this.root.matrixWorld);
    // un poco de cadera y de pecho para el costado: menos duro
    rotateWorld(b.Spine, fwd, 0.05);
    this.root.updateMatrixWorld(true);
    // derecha: el puño en la cintura, el codo afuera
    twoBone(b.RightArm, b.RightForeArm, b.RightHand, this.local(-0.17, hipY + 0.07, 0.05), this.local(-0.7, chestY - 0.15, -0.1));
    // izquierda: arriba, saludando
    twoBone(b.LeftArm, b.LeftForeArm, b.LeftHand, this.local(0.34, headY + 0.2, 0.14), this.local(0.8, chestY - 0.1, -0.1));
    this.curl('Right', 0.9);
    this.curl('Left', 0.05);
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

// ------------------------------------------------------------------ las señas en la cara
// Capas planas pegadas a la cabeza (en el lugar de cada ojo, la boca, los cachetes y la nariz). Normalmente no se
// ven; con una seña se dibuja encima lo que cambia: párpados cerrados, cejas levantadas, boca torcida, lengua...
const PX = 128;

class FaceLayer {
  constructor(rig, face) {
    this.rig = rig;
    this.face = face;
    this.skin = `rgb(${face.skin.join(',')})`;
    this.skinDark = `rgb(${face.skin.map((v) => Math.round(v * 0.72)).join(',')})`;
    this.ink = '#2a1a14';
    this.hair = '#3b2618';
    this.key = '';
    const head = rig.b.Head;
    // posiciones de la malla -> espacio del hueso de la cabeza: con su matriz de enlace (la pose de reposo de los
    // huesos no siempre es la de la malla)
    const sk = rig.mesh.skeleton;
    const toHead = sk.boneInverses[sk.bones.indexOf(head)].clone();
    const headQ = new THREE.Quaternion();
    toHead.decompose(new THREE.Vector3(), headQ, new THREE.Vector3());
    const box = face.box;
    const fw = box.x1 - box.x0;
    const fh = box.y1 - box.y0;
    const [eL, eR] = face.eyes;
    const ew = Math.min(fw * 0.32, Math.max(eL.w, eR.w) * 0.9);
    const eh = Math.min(fh * 0.24, Math.max(eL.h, eR.h) * 0.75);
    const mouth = face.mouth;
    const mz = mouth.p[2];
    const parts = {
      eyeL: { at: eL.p, w: ew * 1.5, h: eh * 3.2, dy: eh * 0.5 },
      eyeR: { at: eR.p, w: ew * 1.5, h: eh * 3.2, dy: eh * 0.5 },
      browL: { at: eL.p, w: ew * 1.6, h: eh * 3.4, dy: eh * 2.5 },
      browR: { at: eR.p, w: ew * 1.6, h: eh * 3.4, dy: eh * 2.5 },
      mouth: { at: mouth.p, w: Math.max(mouth.w, fw * 0.4) * 1.1, h: fh * 0.24 },
      cheekL: { at: face.cheeks?.[0] || [box.x0 + fw * 0.2, mouth.p[1] + fh * 0.12, mz], w: fw * 0.3, h: fh * 0.24 },
      cheekR: { at: face.cheeks?.[1] || [box.x1 - fw * 0.2, mouth.p[1] + fh * 0.12, mz], w: fw * 0.3, h: fh * 0.24 },
      nose: { at: face.nose || [(eL.p[0] + eR.p[0]) / 2, (eL.p[1] + mouth.p[1]) / 2, mz], w: fw * 0.3, h: fh * 0.2 },
    };
    this.parts = {};
    for (const [k, p] of Object.entries(parts)) {
      const canvas = document.createElement('canvas');
      canvas.width = PX;
      canvas.height = Math.round((PX * p.h) / p.w);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(p.w, p.h),
        new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.04, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })
      );
      const pos = new THREE.Vector3(p.at[0], p.at[1] + (p.dy || 0), p.at[2] + 0.012).applyMatrix4(toHead);
      mesh.position.copy(pos);
      mesh.quaternion.copy(headQ);
      mesh.visible = false;
      mesh.renderOrder = 2;
      head.add(mesh);
      this.parts[k] = { mesh, canvas, ctx: canvas.getContext('2d'), tex, w: canvas.width, h: canvas.height };
    }
  }

  // expr: la de SENAS (config.js) o 'neutral'; talking: boca abierta al hablar; bite: 0..1 (morderse el labio)
  set(expr, talking = false, bite = 1) {
    const key = `${expr}|${talking}|${expr === 'bite' ? Math.round(bite * 6) : ''}`;
    if (key === this.key) return;
    this.key = key;
    const used = new Set();
    const draw = (name, fn) => {
      const p = this.parts[name];
      p.ctx.clearRect(0, 0, p.w, p.h);
      fn(p.ctx, p.w, p.h);
      p.tex.needsUpdate = true;
      used.add(name);
    };
    const S = this.skin;
    const ink = this.ink;
    const lid = (c, w, h) => {
      // párpado cerrado: tapa el ojo con piel y deja la línea de las pestañas
      c.fillStyle = S;
      c.beginPath();
      c.ellipse(w / 2, h * 0.68, w * 0.5, h * 0.27, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = ink;
      c.lineWidth = h * 0.05;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(w * 0.1, h * 0.64);
      c.quadraticCurveTo(w / 2, h * 0.8, w * 0.9, h * 0.64);
      c.stroke();
    };
    // cejas levantadas: un arco más arriba de las de siempre y dos arrugas en la frente
    const brow = (c, w, h, tilt = 0) => {
      c.strokeStyle = this.hair;
      c.lineWidth = h * 0.085;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(w * 0.1, h * (0.58 + tilt));
      c.quadraticCurveTo(w / 2, h * 0.3, w * 0.9, h * (0.58 - tilt));
      c.stroke();
      c.strokeStyle = 'rgba(120,60,45,0.45)';
      c.lineWidth = h * 0.035;
      for (const y of [0.12, 0.22]) {
        c.beginPath();
        c.moveTo(w * 0.2, h * y + h * 0.03);
        c.quadraticCurveTo(w / 2, h * y - h * 0.03, w * 0.8, h * y + h * 0.03);
        c.stroke();
      }
    };
    const coverMouth = (c, w, h) => {
      c.fillStyle = S;
      c.beginPath();
      c.ellipse(w / 2, h / 2, w * 0.42, h * 0.32, 0, 0, Math.PI * 2);
      c.fill();
    };
    const line = (c, pts, lw) => {
      c.strokeStyle = ink;
      c.lineWidth = lw;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(pts[0], pts[1]);
      c.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
      c.stroke();
    };
    const openMouth = (c, w, h, k = 1) => {
      c.fillStyle = '#4a1418';
      c.beginPath();
      c.ellipse(w / 2, h / 2, w * 0.17 * (0.7 + 0.3 * k), h * 0.24 * k, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#d9606a';
      c.beginPath();
      c.ellipse(w / 2, h / 2 + h * 0.12 * k, w * 0.1, h * 0.08 * k, 0, 0, Math.PI * 2);
      c.fill();
    };
    switch (expr) {
      case 'eyesClosed':
        draw('eyeL', lid);
        draw('eyeR', lid);
        break;
      case 'wink':
        draw('eyeR', lid); // a la izquierda de quien lo mira
        break;
      case 'brows':
        draw('browL', (c, w, h) => brow(c, w, h, 0.06));
        draw('browR', (c, w, h) => brow(c, w, h, -0.06));
        break;
      case 'mouthLeft':
      case 'mouthRight': {
        const sgn = expr === 'mouthRight' ? -1 : 1; // la derecha del personaje es la izquierda de la imagen
        draw('mouth', (c, w, h) => {
          coverMouth(c, w, h);
          line(c, [w * 0.3, h * 0.5, w * (0.5 + 0.08 * sgn), h * (0.5 + 0.06), w * 0.7, h * (0.5 - 0.16 * sgn)], h * 0.08);
        });
        break;
      }
      case 'bite':
        draw('mouth', (c, w, h) => {
          coverMouth(c, w, h);
          line(c, [w * 0.3, h * 0.45, w / 2, h * 0.55, w * 0.7, h * 0.45], h * 0.07);
          c.fillStyle = '#fff';
          c.fillRect(w * 0.42, h * (0.5 - 0.02 * bite), w * 0.16, h * 0.08 * (0.6 + 0.4 * bite));
          c.fillStyle = '#c4505a';
          c.beginPath();
          c.ellipse(w / 2, h * 0.6, w * 0.13, h * 0.06, 0, 0, Math.PI * 2);
          c.fill();
        });
        break;
      case 'kiss':
        draw('mouth', (c, w, h) => {
          coverMouth(c, w, h);
          c.fillStyle = '#d9606a';
          c.strokeStyle = '#8d2e36';
          c.lineWidth = h * 0.05;
          c.beginPath();
          c.ellipse(w / 2, h / 2, w * 0.09, h * 0.15, 0, 0, Math.PI * 2);
          c.fill();
          c.stroke();
          c.fillStyle = '#4a1418';
          c.beginPath();
          c.ellipse(w / 2, h / 2, w * 0.03, h * 0.05, 0, 0, Math.PI * 2);
          c.fill();
        });
        break;
      case 'open':
        draw('mouth', (c, w, h) => {
          coverMouth(c, w, h);
          openMouth(c, w, h, 1.4);
        });
        break;
      case 'frown':
        draw('mouth', (c, w, h) => {
          coverMouth(c, w, h);
          line(c, [w * 0.3, h * 0.62, w / 2, h * 0.3, w * 0.7, h * 0.62], h * 0.08);
        });
        break;
      case 'puff':
        for (const k of ['cheekL', 'cheekR']) {
          draw(k, (c, w, h) => {
            const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w * 0.48);
            g.addColorStop(0, 'rgba(235,120,120,0.85)');
            g.addColorStop(0.7, 'rgba(235,120,120,0.35)');
            g.addColorStop(1, 'rgba(235,120,120,0)');
            c.fillStyle = g;
            c.beginPath();
            c.arc(w / 2, h / 2, w * 0.48, 0, Math.PI * 2);
            c.fill();
          });
        }
        draw('mouth', (c, w, h) => {
          coverMouth(c, w, h);
          line(c, [w * 0.42, h * 0.5, w / 2, h * 0.47, w * 0.58, h * 0.5], h * 0.07);
        });
        break;
      case 'nose':
        draw('nose', (c, w, h) => {
          c.strokeStyle = 'rgba(90,40,30,0.75)';
          c.lineWidth = h * 0.08;
          c.lineCap = 'round';
          for (const dx of [-1, 1]) {
            c.beginPath();
            c.moveTo(w / 2 + dx * w * 0.06, h * 0.2);
            c.lineTo(w / 2 + dx * w * 0.16, h * 0.45);
            c.stroke();
          }
          line(c, [w * 0.35, h * 0.62, w / 2, h * 0.52, w * 0.65, h * 0.62], h * 0.05);
        });
        break;
      default:
        if (talking) draw('mouth', (c, w, h) => openMouth(c, w, h, 0.8));
    }
    for (const [k, p] of Object.entries(this.parts)) p.mesh.visible = used.has(k);
  }

  dispose() {
    for (const p of Object.values(this.parts)) {
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      p.tex.dispose();
    }
  }
}
