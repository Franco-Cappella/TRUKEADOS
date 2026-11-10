// La tarima de la Taquilla: tu personaje de cuerpo entero, con luz de arriba. Si tenés un personaje 3D se ve en
// 3D (respira, mira para los costados y se gira arrastrando); si no, el dibujado, grande. Solo dibuja mientras la
// Taquilla está a la vista.
import * as THREE from 'three';
import { loadModel, Rig } from './models.js';
import { COSMETIC_LOOK } from './theme.js';
import { drawCharacter, W as CW, H as CH } from './characters.js';

const SPIN = 0.25; // vuelta sola (radianes por segundo) cuando nadie lo toca
const IDLE_MS = 2500; // después de soltarlo, cuánto espera para volver a girar solo

export class LockerStage {
  constructor(host) {
    this.host = host;
    this.gl = document.createElement('canvas');
    this.gl.className = 'lk-gl';
    this.flat = document.createElement('canvas');
    this.flat.className = 'lk-flat';
    this.flat.width = CW;
    this.flat.height = CH;
    host.append(this.gl, this.flat);
    this.id = null;
    this.rig = null;
    this.yaw = 0.35;
    this.vel = 0;
    this.touchedAt = 0;
    this.started = false;
  }

  // Arma lo de Three.js recién cuando hace falta (si no hay personaje 3D no se crea el contexto de WebGL).
  setup() {
    if (this.renderer) return;
    const r = new THREE.WebGLRenderer({ canvas: this.gl, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;
    const s = new THREE.Scene();
    this.scene = s;
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 30);
    // el personaje queda arriba del cartel de abajo (nombre y rareza)
    this.camera.position.set(0, 1.1, 5.1);
    this.camera.lookAt(0, 0.74, 0);
    s.add(new THREE.HemisphereLight('#ffffff', '#3a3a3a', 1.1));
    const key = new THREE.SpotLight('#ffffff', 26, 9, Math.PI / 7, 0.55, 1.4);
    key.position.set(0.6, 4.4, 1.6);
    key.target.position.set(0, 0.8, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    s.add(key, key.target);
    const rim = new THREE.DirectionalLight('#ffffff', 1.4);
    rim.position.set(-2, 2.4, -3);
    s.add(rim);
    // tarima: un disco negro con el borde blanco
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.82, 0.12, 64), new THREE.MeshLambertMaterial({ color: '#141414' }));
    top.position.y = -0.06;
    top.receiveShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.008, 8, 96), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.001;
    s.add(top, ring);
    // girarlo arrastrando (con inercia)
    let last = null;
    this.gl.addEventListener('pointerdown', (e) => {
      last = e.clientX;
      this.gl.setPointerCapture(e.pointerId);
      this.touchedAt = performance.now();
    });
    this.gl.addEventListener('pointermove', (e) => {
      if (last == null) return;
      const dx = e.clientX - last;
      last = e.clientX;
      this.yaw += dx * 0.012;
      this.vel = dx * 0.6;
      this.touchedAt = performance.now();
    });
    const up = () => (last = null);
    this.gl.addEventListener('pointerup', up);
    this.gl.addEventListener('pointercancel', up);
  }

  /** personaje: id del personaje 3D (o null); look: el dibujado (para cuando no hay 3D). */
  show({ personaje = null, look }) {
    const spec = personaje && COSMETIC_LOOK[personaje]?.model;
    this.host.classList.toggle('is3d', !!spec);
    if (!spec) {
      this.id = null;
      this.dropRig();
      drawCharacter(this.flat.getContext('2d'), look, { expr: 'neutral', cards: 0 });
      return;
    }
    this.setup();
    this.loop();
    if (this.id === personaje) return;
    this.id = personaje;
    this.dropRig();
    loadModel(spec.url).then((tpl) => {
      if (this.id !== personaje) return;
      this.rig = new Rig(tpl, { scale: 1 });
      this.rig.root.traverse((o) => {
        if (o.isMesh) o.castShadow = true;
      });
      this.scene.add(this.rig.root);
    });
  }

  dropRig() {
    if (!this.rig) return;
    this.scene.remove(this.rig.root);
    this.rig.dispose();
    this.rig = null;
  }

  loop() {
    if (this.started) return;
    this.started = true;
    let prev = performance.now();
    const tick = (now) => {
      requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      // solo mientras se ve
      if (!this.rig || !this.host.offsetParent) return;
      const w = this.host.clientWidth;
      const h = this.host.clientHeight;
      if (w && h && (this.gl.width !== Math.round(w * this.renderer.getPixelRatio()) || this.gl.height !== Math.round(h * this.renderer.getPixelRatio()))) {
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
      }
      if (now - this.touchedAt > IDLE_MS) this.yaw += SPIN * dt;
      else if (Math.abs(this.vel) > 0.01) {
        this.yaw += this.vel * dt * 0.02;
        this.vel *= 0.9;
      }
      this.rig.root.rotation.y = this.yaw;
      this.rig.root.updateMatrixWorld(true);
      this.rig.stand({ breathe: Math.sin(now / 900), headYaw: Math.sin(now / 2600) * 0.35 });
      this.rig.face?.set(Math.floor(now / 4200) % 5 === 4 ? 'brows' : 'neutral');
      this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(tick);
  }
}
