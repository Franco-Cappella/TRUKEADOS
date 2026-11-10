// El escenario de la sala de espera (y de "buscando rivales"): una tarima por lugar, los dos equipos enfrentados a
// los costados, y en cada tarima el personaje de quien se sentó (el 3D si tiene, si no el dibujado), una silueta que
// late si se está buscando gente, o nada si el lugar está libre. La interfaz (room-client.js) pone abajo de cada
// tarima el cartel con el nombre y los botones: onFrame le dice dónde queda cada una en la pantalla.
import * as THREE from 'three';
import { loadModel, Rig } from './models.js';
import { COSMETIC_LOOK } from './theme.js';
import { drawCharacter, lookFor, dressed, W as CW, H as CH } from './characters.js';

const TEAM_COLOR = ['#5ec8ff', '#ff8a3d']; // los aros y las luces de cada equipo
const SPREAD = 1.4; // entre tarimas del mismo equipo
const GAP = 1.9; // entre los dos equipos (ahí va el "VS")
const FLAT_H = 1.75; // alto del personaje dibujado

// Silueta de "buscando…": la del avatar predeterminado, en grande.
let silhouetteTex = null;
function silhouette() {
  if (silhouetteTex) return silhouetteTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3a3a3a';
  ctx.beginPath();
  ctx.arc(128, 120, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(24, 512);
  ctx.quadraticCurveTo(24, 220, 128, 210);
  ctx.quadraticCurveTo(232, 220, 232, 512);
  ctx.fill();
  ctx.fillStyle = '#9a9a9a';
  ctx.font = '800 120px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 128, 124);
  silhouetteTex = new THREE.CanvasTexture(c);
  silhouetteTex.colorSpace = THREE.SRGBColorSpace;
  return silhouetteTex;
}

export class PartyStage {
  constructor(host) {
    this.host = host;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pl-gl';
    host.append(this.canvas);
    this.actors = new Map(); // seat -> { key, group, rig, flat, ring, pedestal, x }
    this.onFrame = null;
    this.started = false;
    this.layoutKey = '';
  }

  setup() {
    if (this.renderer) return;
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#ffffff', '#202020', 1.0));
    const key = new THREE.SpotLight('#ffffff', 40, 16, Math.PI / 5, 0.6, 1.3);
    key.position.set(0, 7, 6);
    key.target.position.set(0, 0.6, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    s.add(key, key.target);
    // luces de cada equipo, desde atrás
    this.teamLights = TEAM_COLOR.map((c, t) => {
      const l = new THREE.PointLight(c, 14, 9, 1.6);
      l.position.set(t ? 3 : -3, 2.6, -2.2);
      s.add(l);
      return l;
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshLambertMaterial({ color: '#141414' }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);
  }

  /**
   * slots: [{ seat, team, kind: 'player' | 'empty' | 'search', name, cos, me }], en el orden de los asientos.
   * Arma lo que cambió (cada actor se rehace solo si cambió quién está o lo que tiene puesto).
   */
  set(slots) {
    this.setup();
    this.loop();
    const order = [...slots.filter((s) => s.team === 0), ...slots.filter((s) => s.team === 1)];
    // el primero de cada equipo, al lado del "VS"; los demás, hacia afuera
    const inner = GAP / 2 + SPREAD / 2;
    const xOf = (s) => {
      const k = slots.filter((x) => x.team === s.team).indexOf(s);
      return (s.team === 0 ? -1 : 1) * (inner + k * SPREAD);
    };
    const seen = new Set();
    for (const s of order) {
      seen.add(s.seat);
      const x = xOf(s);
      const key = `${s.kind}|${s.name || ''}|${JSON.stringify(s.cos || {})}|${s.team}|${s.me ? 1 : 0}`;
      let a = this.actors.get(s.seat);
      if (a && a.key !== key) {
        this.drop(a);
        a = null;
      }
      if (!a) {
        a = this.build(s, key);
        this.actors.set(s.seat, a);
      }
      a.x = x;
      a.group.position.x = x;
      a.group.rotation.y = -x * 0.05; // un poco hacia el centro
    }
    for (const [seat, a] of this.actors) {
      if (!seen.has(seat)) {
        this.drop(a);
        this.actors.delete(seat);
      }
    }
    this.span = Math.max(...[...this.actors.values()].map((a) => Math.abs(a.x)), 1) + 1.15;
    this.resize(true);
  }

  build(s, key) {
    const g = new THREE.Group();
    const color = s.me ? '#ffffff' : TEAM_COLOR[s.team];
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.6, 0.12, 48), new THREE.MeshLambertMaterial({ color: '#1c1c1c' }));
    ped.position.y = 0.06;
    ped.receiveShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, s.me ? 0.022 : 0.014, 8, 80), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: s.kind === 'empty' ? 0.35 : 1 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.125;
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.58, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: s.kind === 'player' ? 0.12 : 0.05 }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.122;
    g.add(ped, ring, glow);
    const a = { key, group: g, ring, glow, rig: null, flat: null, kind: s.kind, phase: Math.random() * 10 };
    if (s.kind === 'player') {
      const spec = COSMETIC_LOOK[s.cos?.personaje]?.model;
      if (spec) {
        loadModel(spec.url).then((tpl) => {
          if (this.actors.get(s.seat) !== a) return;
          a.rig = new Rig(tpl, { scale: 1 });
          a.rig.root.position.y = 0.12;
          a.rig.root.traverse((o) => {
            if (o.isMesh) o.castShadow = true;
          });
          g.add(a.rig.root);
        });
      } else {
        const c = document.createElement('canvas');
        c.width = CW;
        c.height = CH;
        drawCharacter(c.getContext('2d'), dressed(lookFor(s.name, s.seat), s.cos), { expr: 'neutral', cards: 0 });
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        const w = FLAT_H * (CW / CH);
        a.flat = new THREE.Mesh(new THREE.PlaneGeometry(w, FLAT_H), new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }));
        a.flat.position.y = 0.12 + FLAT_H / 2;
        a.flat.castShadow = true;
        g.add(a.flat);
      }
    } else if (s.kind === 'search') {
      a.flat = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.7), new THREE.MeshBasicMaterial({ map: silhouette(), transparent: true }));
      a.flat.position.y = 0.12 + 0.85;
      g.add(a.flat);
    }
    this.scene.add(g);
    return a;
  }

  drop(a) {
    this.scene.remove(a.group);
    a.rig?.dispose();
    a.group.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material && o.material.map !== silhouetteTex) o.material.map?.dispose?.();
      o.material?.dispose?.();
    });
  }

  resize(force = false) {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    const pr = this.renderer.getPixelRatio();
    if (!force && this.canvas.width === Math.round(w * pr) && this.canvas.height === Math.round(h * pr)) return;
    this.renderer.setSize(w, h, false);
    const cam = this.camera;
    cam.aspect = w / h;
    // que entren todas las tarimas a lo ancho (y los personajes a lo alto)
    const halfH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const distW = (this.span || 2.5) / (halfH * cam.aspect);
    const distH = 1.35 / halfH;
    const d = Math.max(distW, distH, 4.5);
    cam.position.set(0, 1.55, d);
    cam.lookAt(0, 0.9, 0);
    cam.updateProjectionMatrix();
  }

  // Dónde queda en la pantalla un punto de la escena (px desde arriba a la izquierda del host).
  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.host.clientWidth, y: ((1 - v.y) / 2) * this.host.clientHeight };
  }

  loop() {
    if (this.started) return;
    this.started = true;
    const tick = (now) => {
      requestAnimationFrame(tick);
      if (!this.host.offsetParent) return; // la sala de espera no está a la vista
      this.resize();
      for (const a of this.actors.values()) {
        if (a.rig) {
          a.rig.root.updateMatrixWorld(true);
          a.rig.stand({ breathe: Math.sin(now / 900 + a.phase), headYaw: Math.sin(now / 2400 + a.phase) * 0.3 });
          a.rig.face?.set('neutral');
        }
        if (a.flat && a.kind === 'player') a.flat.position.y = 0.12 + FLAT_H / 2 + Math.sin(now / 900 + a.phase) * 0.006;
        if (a.kind === 'search') a.flat.material.opacity = 0.45 + 0.35 * Math.sin(now / 500 + a.phase);
        if (a.kind === 'empty') a.ring.material.opacity = 0.25 + 0.2 * Math.sin(now / 700 + a.phase);
      }
      this.renderer.render(this.scene, this.camera);
      // dónde va el cartel de cada uno (abajo de la tarima) y el "VS" (al medio)
      if (this.onFrame) {
        const pos = {};
        for (const [seat, a] of this.actors) pos[seat] = this.project(a.x, 0, 0.62);
        pos.vs = this.project(0, 1.0, 0);
        this.onFrame(pos);
      }
    };
    requestAnimationFrame(tick);
  }
}
