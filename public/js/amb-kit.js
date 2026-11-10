// Piezas para armar ambientes con vida (las usan los archivos amb-*.js, como barrio-chino.js): luces con su halo que
// titilan, fuego y brasas, humo y vapor, guirnaldas de lamparitas, ventanas que dan a la calle (con lo de afuera
// pintado en capas y autos que pasan), agua que brilla, pasto en matas que se mece, pájaros y ventiladores de techo.
// Nada se baja: todo se pinta en canvas o se arma con formas simples. Lo que se mueve se registra con tick() y no tira
// sombra (la sombra se recalcula solo cuando cambia la mesa).
import * as THREE from 'three';
import { canvasTex, noise, seeded, toon } from './draw3d.js';
import { tick, glowSprite } from './paisaje.js';

export const hsl = (h, s, l) => `#${new THREE.Color().setHSL(h / 360, s, l).getHexString()}`;
export const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
export const box = (w, h, d, mat, shadow = true) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
};
export const cyl = (r0, r1, h, mat, seg = 16, shadow = true) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
};
export const ball = (r, mat, seg = 16) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.7)), mat);
/** Pone algo en el grupo en (x, y, z) con giro ry; devuelve el objeto. */
export function put(g, o, x = 0, y = 0, z = 0, ry = 0) {
  o.position.set(x, y, z);
  o.rotation.y = ry;
  g.add(o);
  return o;
}

// ------------------------------------------------------------------ luces

/** La luz de la mesa (cono con sombra). Es la única que tira sombra. */
export function tableLight(g, { color = '#ffe3bf', intensity = 8, y = 2.55, angle = Math.PI / 3.1, softness = 0.55 } = {}) {
  const l = new THREE.SpotLight(color, intensity, 7, angle, softness, 1.6);
  l.position.set(0, y, 0);
  l.target.position.set(0, 0, 0);
  l.castShadow = true;
  l.shadow.mapSize.set(2048, 2048);
  l.shadow.bias = -0.0004;
  g.add(l, l.target);
  return l;
}

/** Sol (afuera): luz direccional con sombra sobre la mesa. */
export function sunLight(g, color, intensity, dir = [3, 6, 2]) {
  const l = new THREE.DirectionalLight(color, intensity);
  l.position.set(...dir);
  l.target.position.set(0, 0, 0);
  l.castShadow = true;
  l.shadow.mapSize.set(2048, 2048);
  l.shadow.bias = -0.0005;
  const c = l.shadow.camera;
  c.left = c.bottom = -3;
  c.right = c.top = 3;
  c.near = 0.5;
  c.far = 20;
  g.add(l, l.target);
  return l;
}

/** Una lamparita (o foco) que brilla: la bola, su halo y, si se pide, una luz de verdad. */
export function bulb(g, x, y, z, { color = '#fff1c9', size = 0.05, halo = 0.5, alpha = 0.55, light = 0, range = 4 } = {}) {
  const b = ball(size, basic(color), 10);
  b.position.set(x, y, z);
  g.add(b);
  const h = glowSprite(color, halo, alpha);
  h.position.set(x, y, z);
  g.add(h);
  if (light) {
    const l = new THREE.PointLight(color, light, range, 1.6);
    l.position.set(x, y, z);
    g.add(l);
  }
  return h;
}

/** Que algo titile (halos, neones, el televisor): cambia la opacidad (y la intensidad de una luz) cada tanto. */
export function flicker(g, items, { base = 0.6, amp = 0.25, speed = 1, glitch = 0 } = {}) {
  const ph = items.map((_, i) => i * 1.7);
  const keep = items.map((o) => (o.isLight ? o.intensity : o.material?.opacity ?? 1));
  tick(g, (now) => {
    const t = (now / 1000) * speed;
    items.forEach((o, i) => {
      let k = base + Math.sin(t * 2.3 + ph[i]) * amp * 0.6 + Math.sin(t * 7.1 + ph[i] * 2) * amp * 0.4;
      if (glitch && Math.sin(t * 0.9 + ph[i] * 3) > 1 - glitch && Math.sin(t * 31) > 0) k *= 0.25; // un parpadeo
      if (o.isLight) o.intensity = keep[i] * k;
      else if (o.material) o.material.opacity = Math.max(0, Math.min(1, keep[i] * k));
    });
  });
}

/** Guirnalda de lamparitas colgando entre dos puntos (catenaria). Titilan apenas. */
export function stringLights(g, from, to, { n = 14, sag = 0.4, color = '#ffe2a0', wire = '#1a120c', size = 0.04, halo = 0.42, alpha = 0.6 } = {}) {
  const [x0, y0, z0] = from;
  const [x1, y1, z1] = to;
  const at = (t) => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * sag, z0 + (z1 - z0) * t];
  const pts = [];
  for (let i = 0; i <= 24; i++) pts.push(new THREE.Vector3(...at(i / 24)));
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: wire })));
  const halos = [];
  for (let i = 1; i < n; i++) halos.push(bulb(g, ...at(i / n).map((v, k) => (k === 1 ? v - 0.05 : v)), { color, size, halo, alpha }));
  flicker(g, halos, { base: 1, amp: 0.18, speed: 0.7 });
  return halos;
}

// ------------------------------------------------------------------ fuego, brasas, humo

/** Brasas que laten (una caja de color con luz). w × d. */
export function embers(g, x, y, z, w, d, { light = 2.2 } = {}) {
  const tex = canvasTex(256, 128, (ctx, cw, ch) => {
    const r = seeded(91);
    ctx.fillStyle = '#2a0c04';
    ctx.fillRect(0, 0, cw, ch);
    for (let i = 0; i < 260; i++) {
      const hot = r();
      ctx.fillStyle = hot > 0.7 ? '#ffd27a' : hot > 0.35 ? '#ff7a2e' : '#a8300f';
      ctx.beginPath();
      ctx.arc(r() * cw, r() * ch, 3 + r() * 7, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), basic('#ffffff', { map: tex }));
  m.position.set(x, y, z);
  g.add(m);
  const l = new THREE.PointLight('#ff8a3a', light, 4.5, 1.6);
  l.position.set(x, y + 0.35, z);
  g.add(l);
  const h = glowSprite('rgba(255,120,40,0.9)', Math.max(w, d) * 1.6, 0.35);
  h.position.set(x, y + 0.15, z);
  g.add(h);
  flicker(g, [l, h], { base: 1, amp: 0.3, speed: 1.6 });
  return m;
}

/** Llamas (fogón, chimenea, salamandra): lenguas de fuego que bailan, con luz. */
export function fire(g, x, y, z, { size = 0.5, light = 3, n = 7 } = {}) {
  const tex = canvasTex(64, 128, (ctx, w, h) => {
    const gr = ctx.createRadialGradient(w / 2, h * 0.75, 2, w / 2, h * 0.6, h * 0.55);
    gr.addColorStop(0, 'rgba(255,250,200,1)');
    gr.addColorStop(0.3, 'rgba(255,190,60,0.95)');
    gr.addColorStop(0.65, 'rgba(255,90,20,0.7)');
    gr.addColorStop(1, 'rgba(255,40,0,0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.quadraticCurveTo(w, h * 0.6, w / 2, h);
    ctx.quadraticCurveTo(0, h * 0.6, w / 2, 0);
    ctx.fill();
  });
  const flames = [];
  const r = seeded(Math.round(x * 100 + z * 10) + 5);
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    const ox = (r() - 0.5) * size * 0.7;
    const oz = (r() - 0.5) * size * 0.7;
    s.position.set(x + ox, y, z + oz);
    g.add(s);
    flames.push([s, ox, oz, r() * 10, 0.6 + r() * 0.5]);
  }
  const l = new THREE.PointLight('#ff9040', light, 6, 1.6);
  l.position.set(x, y + size * 0.6, z);
  g.add(l);
  tick(g, (now) => {
    const t = now / 1000;
    for (const [s, ox, oz, p, k] of flames) {
      const f = 0.75 + Math.sin(t * 9 + p) * 0.15 + Math.sin(t * 23 + p * 2) * 0.1;
      s.scale.set(size * 0.45 * k, size * f * k, 1);
      s.position.set(x + ox + Math.sin(t * 3 + p) * 0.02, y + size * f * k * 0.45, z + oz);
    }
    l.intensity = light * (0.85 + Math.sin(t * 13) * 0.08 + Math.sin(t * 29) * 0.07);
  });
  return l;
}

/** Humo o vapor que sube y se abre (n bocanadas en loop). */
export function smoke(g, x, y, z, { n = 8, rise = 1.6, spread = 0.5, size = 0.5, color = 'rgba(220,220,220,0.5)', alpha = 0.3, period = 4200 } = {}) {
  const puffs = [];
  for (let i = 0; i < n; i++) {
    const s = glowSprite(color, size, alpha);
    s.material.blending = THREE.NormalBlending;
    g.add(s);
    puffs.push([s, i / n, (i * 0.37) % 1]);
  }
  tick(g, (now) => {
    for (const [s, off, side] of puffs) {
      const t = ((now / period) + off) % 1;
      s.position.set(x + Math.sin(t * 5 + side * 6) * spread * t, y + t * rise, z + Math.cos(t * 4 + side * 6) * spread * 0.5 * t);
      s.material.opacity = alpha * Math.sin(t * Math.PI);
      s.scale.setScalar(size * (0.4 + t * 1.4));
    }
  });
}

// ------------------------------------------------------------------ afuera, visto por la ventana

/**
 * La calle vista de adentro: una "caja" de afuera detrás de la pared (cielo, la vereda de enfrente con fachadas y
 * vidrieras, árboles, faroles) y autos que pasan con las luces prendidas. Se ve por los huecos de las ventanas.
 * side: hacia dónde (normal de la pared: [nx, nz]); d: a qué distancia del centro está la pared.
 */
export function streetOutside(g, { d = 6, side = [0, -1], night = true, seed = 3, w = 16 } = {}) {
  const grp = new THREE.Group();
  const sky = night ? [hsl(230, 0.5, 0.08), hsl(260, 0.4, 0.22)] : [hsl(205, 0.6, 0.62), hsl(200, 0.45, 0.85)];
  // fachadas de enfrente, pintadas
  const tex = canvasTex(2048, 512, (ctx, cw, ch) => {
    const r = seeded(seed);
    const gr = ctx.createLinearGradient(0, 0, 0, ch);
    gr.addColorStop(0, sky[0]);
    gr.addColorStop(0.6, sky[1]);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, cw, ch);
    let x = 0;
    while (x < cw) {
      const bw = 180 + r() * 220;
      const bh = ch * (0.55 + r() * 0.4);
      const hue = [20, 35, 200, 10, 45, 160][Math.floor(r() * 6)];
      ctx.fillStyle = night ? hsl(hue, 0.18, 0.1 + r() * 0.05) : hsl(hue, 0.22, 0.62 + r() * 0.15);
      ctx.fillRect(x, ch - bh, bw, bh);
      // cornisa
      ctx.fillStyle = night ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.35)';
      ctx.fillRect(x - 4, ch - bh, bw + 8, 10);
      // ventanas con balcón
      for (let wy = ch - bh + 34; wy < ch - 150; wy += 74) {
        for (let wx = x + 20; wx < x + bw - 40; wx += 56) {
          const lit = night ? r() < 0.45 : false;
          ctx.fillStyle = lit ? (r() < 0.5 ? '#ffd890' : '#ffe9c4') : night ? '#0d0f18' : hsl(205, 0.25, 0.32);
          ctx.fillRect(wx, wy, 30, 46);
          ctx.fillStyle = night ? 'rgba(0,0,0,0.6)' : 'rgba(40,30,20,0.7)';
          ctx.fillRect(wx - 4, wy + 46, 38, 4);
        }
      }
      // planta baja: vidriera con toldo
      ctx.fillStyle = night ? (r() < 0.6 ? '#f2c77a' : '#2a2018') : hsl(30, 0.2, 0.22);
      ctx.fillRect(x + 12, ch - 120, bw - 24, 92);
      ctx.fillStyle = hsl([2, 140, 210, 40][Math.floor(r() * 4)], 0.55, night ? 0.3 : 0.45);
      ctx.fillRect(x + 6, ch - 136, bw - 12, 18);
      x += bw + 4;
    }
    // vereda y cordón
    ctx.fillStyle = night ? '#25232a' : '#9c968c';
    ctx.fillRect(0, ch - 28, cw, 28);
    noise(ctx, cw, ch, 6);
  });
  const far = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.6, w * 0.4), basic('#ffffff', { map: tex, fog: false }));
  far.position.set(0, w * 0.2 - 0.6, -8.5);
  grp.add(far);
  // la calle (adoquines) y la vereda de este lado
  const street = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.6, 9), toon(night ? hsl(230, 0.08, 0.13) : hsl(30, 0.05, 0.42)));
  street.rotation.x = -Math.PI / 2;
  street.position.set(0, -0.02, -4.2);
  grp.add(street);
  // árboles de vereda (siluetas pintadas) y faroles con halo
  const treeTex = canvasTex(256, 256, (ctx, cw) => {
    const r = seeded(seed + 8);
    ctx.fillStyle = night ? '#0b120c' : hsl(110, 0.35, 0.3);
    for (let i = 0; i < 26; i++) {
      ctx.beginPath();
      ctx.arc(cw / 2 + (r() - 0.5) * cw * 0.6, cw * 0.4 + (r() - 0.5) * cw * 0.4, 30 + r() * 30, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillRect(cw / 2 - 6, cw * 0.55, 12, cw * 0.45);
  });
  for (let i = -3; i <= 3; i++) {
    const t = new THREE.Sprite(new THREE.SpriteMaterial({ map: treeTex, transparent: true, alphaTest: 0.4 }));
    t.scale.set(3, 3, 1);
    t.position.set(i * 3.6 + 1.2, 1.4, -1.6);
    grp.add(t);
    if (i % 2 === 0) {
      const post = cyl(0.04, 0.05, 3.4, toon('#141414'), 8, false);
      post.position.set(i * 3.6 - 0.6, 1.7, -1.2);
      grp.add(post);
      const h = glowSprite(night ? 'rgba(255,214,140,1)' : 'rgba(255,255,255,0.3)', night ? 1.6 : 0.3, night ? 0.7 : 0.2);
      h.position.set(i * 3.6 - 0.6, 3.4, -1.2);
      grp.add(h);
    }
  }
  // autos que pasan: un bloque con faros (de noche, luces) de un lado al otro
  const cars = [];
  const r = seeded(seed + 30);
  for (let k = 0; k < 3; k++) {
    const car = new THREE.Group();
    const col = hsl([0, 210, 45, 120, 0][k], k === 4 ? 0 : 0.5, night ? 0.25 : 0.45);
    const body = box(1.9, 0.5, 0.9, toon(col), false);
    body.position.y = 0.45;
    const top = box(1.1, 0.4, 0.82, toon(col), false);
    top.position.set(-0.1, 0.85, 0);
    car.add(body, top);
    if (night) {
      for (const s of [-1, 1]) {
        const head = glowSprite('rgba(255,250,220,1)', 0.7, 0.8);
        head.position.set(0.98, 0.5, s * 0.3);
        const tail = glowSprite('rgba(255,40,30,1)', 0.35, 0.7);
        tail.position.set(-0.98, 0.5, s * 0.3);
        car.add(head, tail);
      }
    }
    car.position.set(-50, 0, -3.4 - (k % 2) * 1.6);
    grp.add(car);
    cars.push([car, k % 2 ? -1 : 1, 7 + r() * 5, r() * 20]);
  }
  tick(g, (now) => {
    const t = now / 1000;
    for (const [car, dir, speed, off] of cars) {
      const span = w * 1.6;
      const x = (((t * speed + off * 10) % (span * 2.5)) - span / 2) * dir;
      car.position.x = x;
      car.rotation.y = dir > 0 ? 0 : Math.PI;
    }
  });
  // la caja se ubica detrás de la pared que mira para `side`
  const [nx, nz] = side;
  grp.rotation.y = Math.atan2(-nx, -nz);
  grp.position.set(nx * d, 0, nz * d);
  g.add(grp);
  return grp;
}

/**
 * Pared con huecos (ventanas o puertas) en un plano: la textura de la pared y las aberturas transparentes.
 * holes: [{ x, y, w, h, arch }] en metros, desde el centro de la pared (x) y desde el piso (y = borde de abajo).
 * Devuelve el mesh (MeshBasic: la pared se pinta con su luz).
 */
export function holedWall(tex, width, height, holes, { lit = false, color = null } = {}) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, height);
  shape.lineTo(-width / 2, height);
  shape.closePath();
  for (const h of holes) {
    const p = new THREE.Path();
    p.moveTo(h.x - h.w / 2, h.y);
    p.lineTo(h.x + h.w / 2, h.y);
    if (h.arch) {
      p.lineTo(h.x + h.w / 2, h.y + h.h - h.w / 2);
      p.absarc(h.x, h.y + h.h - h.w / 2, h.w / 2, 0, Math.PI, false);
    } else {
      p.lineTo(h.x + h.w / 2, h.y + h.h);
      p.lineTo(h.x - h.w / 2, h.y + h.h);
    }
    p.closePath();
    shape.holes.push(p);
  }
  const geo = new THREE.ShapeGeometry(shape, 12);
  // uv de 0 a 1 en todo el ancho y el alto (la textura de la pared entera)
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / width + 0.5;
    uv[i * 2 + 1] = pos.getY(i) / height;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const mat = lit ? toon(color, { map: tex, side: THREE.FrontSide }) : basic(color || '#ffffff', { map: tex });
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = lit;
  return m;
}

/** Marco de ventana (o puerta) con travesaños, en 3D, para un hueco de holedWall. */
export function windowFrame(h, mat, { bars = 1, rails = 1, depth = 0.12, t = 0.06 } = {}) {
  const f = new THREE.Group();
  const add = (w, hh, x, y) => {
    const b = box(w, hh, depth, mat, false);
    b.position.set(x, y, 0);
    f.add(b);
  };
  const top = h.arch ? h.y + h.h - h.w / 2 : h.y + h.h;
  add(t, top - h.y, h.x - h.w / 2, (h.y + top) / 2);
  add(t, top - h.y, h.x + h.w / 2, (h.y + top) / 2);
  add(h.w + t, t * 1.6, h.x, h.y);
  if (!h.arch) add(h.w + t, t, h.x, top);
  else {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(h.w / 2, t / 2, 6, 24, Math.PI), mat);
    arc.position.set(h.x, top, 0);
    f.add(arc);
  }
  for (let i = 1; i <= bars; i++) add(t * 0.6, (h.arch ? h.h : top - h.y), h.x - h.w / 2 + (h.w * i) / (bars + 1), h.y + (h.arch ? h.h : top - h.y) / 2);
  for (let i = 1; i <= rails; i++) add(h.w, t * 0.6, h.x, h.y + ((top - h.y) * i) / (rails + 1));
  return f;
}

/** Vidrio con un brillo (reflejo) encima de un hueco: casi transparente. */
export function glass(w, h, { tint = '#cfe6ff', alpha = 0.12 } = {}) {
  const tex = canvasTex(128, 256, (ctx, cw, ch) => {
    ctx.fillStyle = tint;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(0, 0, cw, ch);
    ctx.globalAlpha = 1;
    const gr = ctx.createLinearGradient(0, 0, cw, ch);
    gr.addColorStop(0.2, 'rgba(255,255,255,0)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.42, 'rgba(255,255,255,0)');
    gr.addColorStop(0.55, 'rgba(255,255,255,0.5)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, cw, ch);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic('#ffffff', { map: tex, transparent: true, opacity: alpha, depthWrite: false }));
}

/** Haz de luz que entra por una ventana (un prisma de luz aditiva, muy suave). */
export function lightShaft(g, from, to, { w = 1, color = 'rgba(255,240,200,1)', alpha = 0.08 } = {}) {
  const tex = canvasTex(64, 256, (ctx, cw, ch) => {
    const gr = ctx.createLinearGradient(0, 0, 0, ch);
    gr.addColorStop(0, color);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, cw, ch);
    // bordes suaves
    const side = ctx.createLinearGradient(0, 0, cw, 0);
    side.addColorStop(0, 'rgba(0,0,0,1)');
    side.addColorStop(0.25, 'rgba(0,0,0,0)');
    side.addColorStop(0.75, 'rgba(0,0,0,0)');
    side.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = side;
    ctx.fillRect(0, 0, cw, ch);
  });
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const len = a.distanceTo(b);
  const mat = basic('#ffffff', { map: tex, transparent: true, opacity: alpha, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const grp = new THREE.Group();
  for (let k = 0; k < 2; k++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, len), mat);
    p.rotation.y = k * Math.PI / 2;
    p.position.y = -len / 2;
    grp.add(p);
  }
  grp.position.copy(a);
  grp.lookAt(b);
  grp.rotateX(-Math.PI / 2);
  g.add(grp);
  tick(g, (now) => (mat.opacity = alpha * (0.85 + Math.sin(now / 2600) * 0.15)));
  return grp;
}

// ------------------------------------------------------------------ agua, pasto, animales

/** Agua que brilla: un plano con ondas pintadas que se corren despacio y destellos. shape: 'circle' | 'rect'. */
export function water(g, { x = 0, z = 0, w = 6, d = 4, shape = 'circle', color = hsl(200, 0.55, 0.45), deep = hsl(205, 0.6, 0.28), sparkle = '#ffffff', y = 0.02, night = false } = {}) {
  const tex = canvasTex(512, 512, (ctx, cw, ch) => {
    const gr = ctx.createRadialGradient(cw / 2, ch / 2, 10, cw / 2, ch / 2, cw / 2);
    gr.addColorStop(0, deep);
    gr.addColorStop(1, color);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, cw, ch);
    const r = seeded(77);
    ctx.strokeStyle = night ? 'rgba(120,200,255,0.25)' : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 90; i++) {
      const px = r() * cw;
      const py = r() * ch;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + 10, py - 4, px + 20 + r() * 20, py);
      ctx.stroke();
    }
  }, [2, 2]);
  const geo = shape === 'circle' ? new THREE.CircleGeometry(0.5, 48) : new THREE.PlaneGeometry(1, 1);
  const m = new THREE.Mesh(geo, toon(null, { map: tex, transparent: true, opacity: 0.95 }));
  m.rotation.x = -Math.PI / 2;
  m.scale.set(w, d, 1);
  m.position.set(x, y, z);
  m.receiveShadow = true;
  g.add(m);
  // destellos del sol (o de la luna) que aparecen y se van
  const pts = [];
  const r = seeded(19);
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2;
    const rr = Math.sqrt(r()) * 0.45;
    pts.push(x + Math.cos(a) * rr * w, y + 0.01, z + Math.sin(a) * rr * d);
  }
  const geoP = new THREE.BufferGeometry();
  geoP.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const mp = new THREE.PointsMaterial({ color: sparkle, size: 0.07, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  g.add(new THREE.Points(geoP, mp));
  tick(g, (now) => {
    tex.offset.x = (now / 60000) % 1;
    tex.offset.y = (now / 90000) % 1;
    mp.opacity = 0.35 + Math.sin(now / 300) * 0.25 + Math.sin(now / 130) * 0.15;
  });
  return m;
}

/** Matas de pasto alto (o paja brava) que se mecen con el viento. Instanciado: barato aunque sean muchas. */
// near: cuánto se juntan cerca de la mesa (0.5 = parejo; 1 o más, más matas cerca).
export function grassTufts(g, { n = 400, inner = 2.6, outer = 14, color = hsl(95, 0.45, 0.35), tip = hsl(70, 0.55, 0.6), h = 0.35, seed = 4, avoid = null, near = 0.5 } = {}) {
  const tex = canvasTex(128, 128, (ctx, w, hh) => {
    const r = seeded(seed);
    const gr = ctx.createLinearGradient(0, hh, 0, 0);
    gr.addColorStop(0, color);
    gr.addColorStop(1, tip);
    ctx.strokeStyle = gr;
    for (let i = 0; i < 34; i++) {
      ctx.lineWidth = 2.5 + r() * 2.5;
      const bx = w / 2 + (r() - 0.5) * 50;
      ctx.beginPath();
      ctx.moveTo(bx, hh);
      ctx.quadraticCurveTo(bx + (r() - 0.5) * 30, hh * 0.5, bx + (r() - 0.5) * 100, hh * (0.04 + r() * 0.35));
      ctx.stroke();
    }
  });
  const geo = new THREE.PlaneGeometry(0.9, 1);
  geo.translate(0, 0.5, 0);
  const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geo, mat, n * 2);
  const r = seeded(seed + 1);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sway = [];
  let k = 0;
  for (let i = 0; i < n; i++) {
    let x;
    let z;
    let tries = 0;
    do {
      const a = r() * Math.PI * 2;
      const d = inner + Math.pow(r(), near) * (outer - inner);
      x = Math.cos(a) * d;
      z = Math.sin(a) * d;
    } while (avoid && avoid(x, z) && ++tries < 8);
    const s = h * (0.6 + r() * 0.8);
    const rot = r() * Math.PI;
    for (let c = 0; c < 2; c++) {
      q.setFromEuler(new THREE.Euler(0, rot + c * Math.PI / 2, 0));
      m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s, s));
      mesh.setMatrixAt(k++, m);
    }
    sway.push([x, z, s, rot, r() * 6]);
  }
  mesh.frustumCulled = false;
  g.add(mesh);
  // el viento: una ola que pasa (se inclinan un poco en x)
  const e = new THREE.Euler();
  let frame = 0;
  tick(g, (now) => {
    if (++frame % 2) return; // cada dos cuadros alcanza
    const t = now / 1000;
    k = 0;
    for (const [x, z, s, rot, p] of sway) {
      const lean = Math.sin(t * 1.4 + x * 0.35 + p * 0.2) * 0.12 + Math.sin(t * 3.1 + p) * 0.03;
      for (let c = 0; c < 2; c++) {
        e.set(lean, rot + c * Math.PI / 2, lean * 0.5, 'YXZ');
        q.setFromEuler(e);
        m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s, s));
        mesh.setMatrixAt(k++, m);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return mesh;
}

/** Bandada de pájaros (siluetas que aletean) dando vueltas lejos. */
export function birds(g, { n = 7, r = 16, y = 9, color = '#1c1c22', speed = 0.05, seed = 2 } = {}) {
  const tex = canvasTex(64, 32, (ctx, w, h) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(4, 10);
    ctx.quadraticCurveTo(18, 2, 32, 16);
    ctx.quadraticCurveTo(46, 2, 60, 10);
    ctx.stroke();
  });
  const rr = seeded(seed);
  const flock = [];
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    s.scale.set(0.5, 0.25, 1);
    g.add(s);
    flock.push([s, (rr() - 0.5) * 0.25, (rr() - 0.5) * 1.2, rr() * 6]);
  }
  tick(g, (now) => {
    const t = now / 1000;
    for (const [s, da, dy, p] of flock) {
      const a = t * speed + da;
      s.position.set(Math.cos(a) * (r + dy), y + dy + Math.sin(t * 0.7 + p) * 0.3, Math.sin(a) * (r + dy));
      s.scale.y = 0.25 * (0.55 + Math.abs(Math.sin(t * 7 + p)) * 0.6); // aletean
    }
  });
}

/** Mariposas (o polillas) que revolotean cerca de las plantas. */
export function butterflies(g, spots, { colors = ['#ffd84a', '#ffffff', '#ff9a3c', '#9ad0ff'], seed = 6 } = {}) {
  const r = seeded(seed);
  const tex = colors.map((c) => canvasTex(32, 32, (ctx) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(10, 14, 8, 10, -0.4, 0, Math.PI * 2);
    ctx.ellipse(22, 14, 8, 10, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(15, 6, 2, 18);
  }));
  const bs = spots.map(([x, y, z], i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex[i % tex.length], transparent: true, alphaTest: 0.3 }));
    s.scale.set(0.09, 0.09, 1);
    g.add(s);
    return [s, x, y, z, r() * 10];
  });
  tick(g, (now) => {
    const t = now / 1000;
    for (const [s, x, y, z, p] of bs) {
      s.position.set(x + Math.sin(t * 0.7 + p) * 0.6, y + Math.sin(t * 1.9 + p) * 0.25, z + Math.cos(t * 0.5 + p) * 0.6);
      s.scale.x = 0.09 * (0.3 + Math.abs(Math.sin(t * 14 + p)) * 0.7);
    }
  });
}

/** Ventilador de techo que gira. */
export function ceilingFan(g, x, y, z, { mat, speed = 2.2, blades = 4 } = {}) {
  const rod = cyl(0.015, 0.015, 0.5, mat, 8, false);
  rod.position.set(x, y + 0.25, z);
  const hub = cyl(0.09, 0.07, 0.12, mat, 16, false);
  hub.position.set(x, y, z);
  const rot = new THREE.Group();
  rot.position.set(x, y - 0.02, z);
  for (let i = 0; i < blades; i++) {
    const b = box(0.55, 0.012, 0.12, mat, false);
    b.position.x = 0.33;
    const arm = new THREE.Group();
    arm.rotation.y = (i / blades) * Math.PI * 2;
    b.rotation.x = 0.12;
    arm.add(b);
    rot.add(arm);
  }
  g.add(rod, hub, rot);
  tick(g, (now, dt) => (rot.rotation.y += speed * dt));
  return rot;
}

/** Texto pintado (carteles). */
export function label(text, { w = 512, h = 128, bg = null, fg = '#ffffff', font = 'system-ui, sans-serif', size = 72, weight = 800, glow = null, stroke = null } = {}) {
  return canvasTex(w, h, (ctx) => {
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = size * 0.4;
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = size * 0.12;
      ctx.strokeText(text, w / 2, h / 2 + size * 0.04);
    }
    ctx.fillStyle = fg;
    const lines = text.split('\n');
    lines.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.1));
  });
}

/** Un plano con una textura (cartel, cuadro), de frente a +z. */
export function plate(tex, w, h, { transparent = true, lit = false } = {}) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), lit ? toon(null, { map: tex, transparent }) : basic('#ffffff', { map: tex, transparent }));
}

export { canvasTex, noise, seeded, toon, tick, glowSprite };
