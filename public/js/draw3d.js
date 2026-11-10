// Ayudas de dibujo para la escena 3D (las usan scene.js y ambientes.js): texturas pintadas en canvas, ruido,
// azar con semilla y el material de sombreado por escalones.
import * as THREE from 'three';

let aniso = 4;
/** Lo llama la escena al crear el renderer: filtrado de las texturas pintadas. */
export const setAniso = (n) => (aniso = n);
export const getAniso = () => aniso;

export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

export function noise(ctx, w, h, amount, alpha) {
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
    img.data[i + 3] = alpha ?? img.data[i + 3];
  }
  ctx.putImageData(img, 0, 0);
}

// Azar con semilla: las texturas pintadas salen iguales en todas las máquinas.
export function seeded(seed) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

// Sombreado por escalones (el de una ilustración): tres tonos con borde duro en lugar de un degradé.
let toonRamp = null;
export function toon(color, extra = {}) {
  if (!toonRamp) {
    toonRamp = new THREE.DataTexture(new Uint8Array([120, 190, 255]), 3, 1, THREE.RedFormat);
    toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter;
    toonRamp.needsUpdate = true;
  }
  // flatShading no existe en el material por escalones (las caras ya se ven planas): se ignora sin avisar
  const { flatShading, ...rest } = extra;
  return new THREE.MeshToonMaterial({ ...(color ? { color } : {}), gradientMap: toonRamp, ...rest });
}
