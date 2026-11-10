// Barrio Chino (Belgrano) de noche: la mesa en el medio de la calle peatonal, entre fachadas con ventanas prendidas,
// balcones y carteles de neón; el portal (paifang) de columnas rojas y techo de tejas verdes con las puntas para
// arriba; guirnaldas de faroles rojos que se mecen; cerezos en flor con pétalos que caen; piso de piedra mojada que
// refleja las luces; y la ciudad atrás, en capas, perdiéndose en la bruma. Todo pintado en canvas (nada que bajar).
import * as THREE from 'three';
import { canvasTex, noise, seeded, toon } from './draw3d.js';
import { sky, layer, paintCity, petals, tick, glowSprite, clouds } from './paisaje.js';

const hsl = (h, s, l) => `#${new THREE.Color().setHSL(h / 360, s, l).getHexString()}`;
const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
const box = (w, h, d, mat, shadow = true) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
};
const cyl = (r0, r1, h, mat, seg = 16) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat);
  m.castShadow = true;
  return m;
};

const C = {
  red: hsl(2, 0.78, 0.42),
  redDeep: hsl(355, 0.7, 0.26),
  gold: hsl(43, 0.8, 0.56),
  jade: hsl(165, 0.45, 0.32),
  jadeDark: hsl(168, 0.45, 0.18),
  night: hsl(258, 0.45, 0.07),
  fog: hsl(275, 0.35, 0.12),
  neon: [hsl(330, 1, 0.62), hsl(190, 1, 0.58), hsl(48, 1, 0.6), hsl(2, 1, 0.6), hsl(140, 0.9, 0.55)],
};
const SIGNS = ['茶館', '麵', '餃子', '中華料理', '福', '龍', '酒家', '飯店', '點心', '壽'];
const CJK = '"Noto Sans SC", "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", "Hiragino Sans", sans-serif';

// ------------------------------------------------------------------ fachadas

// Fachada de varios pisos, pintada con luz de noche: revoque, ventanas (prendidas, con cortinas o a oscuras),
// balcones con plantas, aires acondicionados, local abajo con toldo y un cartel vertical de neón.
function facadeTex(wm, hm, seed) {
  const W = 512;
  const H = Math.round((W * hm) / wm);
  return canvasTex(W, H, (ctx, w, h) => {
    const r = seeded(seed);
    const hue = [12, 28, 190, 350, 40, 160][Math.floor(r() * 6)];
    const wall = hsl(hue, 0.25 + r() * 0.2, 0.16 + r() * 0.08);
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, w, h);
    // manchas de humedad y revoque gastado
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.06})`;
      ctx.beginPath();
      ctx.ellipse(r() * w, r() * h, 10 + r() * 60, 20 + r() * 90, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const floorH = 150;
    const shopH = 190;
    const floors = Math.floor((h - shopH) / floorH);
    const cols = Math.max(2, Math.floor(w / 150));
    for (let f = 0; f < floors; f++) {
      const y0 = h - shopH - (f + 1) * floorH;
      // cornisa
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, y0 + floorH - 8, w, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(0, y0 + floorH - 10, w, 2);
      for (let c = 0; c < cols; c++) {
        const cw = w / cols;
        const x = c * cw + cw * 0.18;
        const ww = cw * 0.64;
        const wy = y0 + 26;
        const wh = floorH * 0.55;
        const lit = r();
        // marco
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x - 5, wy - 5, ww + 10, wh + 10);
        if (lit < 0.55) {
          const warm = r() < 0.75;
          const gr = ctx.createLinearGradient(0, wy, 0, wy + wh);
          gr.addColorStop(0, warm ? '#ffcf86' : '#b9e3ff');
          gr.addColorStop(1, warm ? '#e8833a' : '#5a8fd6');
          ctx.fillStyle = gr;
          ctx.fillRect(x, wy, ww, wh);
          // cortinas y siluetas
          ctx.fillStyle = `rgba(120,30,20,${0.35 + r() * 0.3})`;
          ctx.fillRect(x, wy, ww * 0.22, wh);
          ctx.fillRect(x + ww * 0.78, wy, ww * 0.22, wh);
          if (r() < 0.25) {
            ctx.fillStyle = 'rgba(40,10,10,0.55)';
            ctx.beginPath();
            ctx.arc(x + ww * 0.5, wy + wh * 0.45, wh * 0.13, 0, Math.PI * 2);
            ctx.fillRect(x + ww * 0.36, wy + wh * 0.58, ww * 0.28, wh * 0.42);
            ctx.fill();
          }
          // brillo de la ventana sobre la pared
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = warm ? 'rgba(255,170,80,0.08)' : 'rgba(120,180,255,0.07)';
          ctx.fillRect(x - 18, wy - 18, ww + 36, wh + 36);
          ctx.globalCompositeOperation = 'source-over';
        } else {
          ctx.fillStyle = hsl(230, 0.3, 0.08 + r() * 0.05);
          ctx.fillRect(x, wy, ww, wh);
          ctx.fillStyle = 'rgba(160,140,255,0.12)'; // el reflejo del cielo
          ctx.beginPath();
          ctx.moveTo(x, wy + wh);
          ctx.lineTo(x + ww * 0.6, wy);
          ctx.lineTo(x + ww, wy);
          ctx.lineTo(x + ww * 0.4, wy + wh);
          ctx.fill();
        }
        // travesaño
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(x + ww / 2 - 2, wy, 4, wh);
        // balcón con baranda y macetas
        if (r() < 0.45) {
          const by = wy + wh + 6;
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(x - 12, by, ww + 24, 6);
          for (let k = 0; k <= 10; k++) ctx.fillRect(x - 12 + ((ww + 24) * k) / 10, by - 26, 2.5, 26);
          ctx.fillRect(x - 12, by - 28, ww + 24, 4);
          for (let k = 0; k < 3; k++) {
            ctx.fillStyle = hsl(110 + r() * 40, 0.45, 0.22 + r() * 0.1);
            ctx.beginPath();
            ctx.arc(x + r() * ww, by - 30, 8 + r() * 6, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (r() < 0.3) {
          // aire acondicionado
          ctx.fillStyle = hsl(40, 0.05, 0.55);
          ctx.fillRect(x + ww * 0.55, wy + wh + 8, 38, 26);
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          for (let k = 0; k < 4; k++) ctx.fillRect(x + ww * 0.55 + 4, wy + wh + 12 + k * 5, 30, 2);
        }
      }
    }
    // local de abajo: vidriera que ilumina y toldo a rayas
    const sy = h - shopH;
    const shop = ctx.createLinearGradient(0, sy + 50, 0, h);
    shop.addColorStop(0, '#ffe2a8');
    shop.addColorStop(1, '#d9622b');
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, sy, w, shopH);
    ctx.fillStyle = shop;
    ctx.fillRect(w * 0.08, sy + 60, w * 0.84, shopH - 70);
    // cosas en la vidriera: patos laqueados colgados, cajas, gente
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = `rgba(90,30,10,${0.4 + r() * 0.3})`;
      const px = w * 0.12 + r() * w * 0.72;
      if (r() < 0.5) {
        ctx.beginPath();
        ctx.ellipse(px, sy + 95, 9, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(px - 1, sy + 62, 2, 14);
      } else {
        ctx.fillRect(px, h - 40 - r() * 40, 30 + r() * 30, 50);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    for (let k = 1; k < 4; k++) ctx.fillRect(w * 0.08 + (w * 0.84 * k) / 4 - 2, sy + 60, 4, shopH - 70);
    // toldo
    const stripeA = r() < 0.5 ? C.red : hsl(160, 0.5, 0.3);
    for (let x = 0, k = 0; x < w; x += 32, k++) {
      ctx.fillStyle = k % 2 ? stripeA : '#f3e9d6';
      ctx.beginPath();
      ctx.moveTo(x, sy + 4);
      ctx.lineTo(x + 32, sy + 4);
      ctx.lineTo(x + 32, sy + 46);
      ctx.arc(x + 16, sy + 46, 16, 0, Math.PI);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, sy + 4, w, 8);
    // cartel horizontal sobre el toldo
    const text = SIGNS[Math.floor(r() * SIGNS.length)];
    ctx.fillStyle = C.redDeep;
    ctx.fillRect(w * 0.15, sy - 58, w * 0.7, 52);
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 4;
    ctx.strokeRect(w * 0.15 + 4, sy - 54, w * 0.7 - 8, 44);
    ctx.fillStyle = C.gold;
    ctx.font = `700 34px ${CJK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, sy - 31);
    // cartel vertical de neón
    if (r() < 0.8) {
      const vt = SIGNS[Math.floor(r() * SIGNS.length)];
      const nc = C.neon[Math.floor(r() * C.neon.length)];
      const sx = r() < 0.5 ? w * 0.06 : w * 0.82;
      const sh = Math.min(h - shopH - 40, vt.length * 70 + 40);
      const sy0 = sy - 80 - sh;
      ctx.fillStyle = 'rgba(10,5,15,0.85)';
      ctx.fillRect(sx, sy0, 64, sh);
      ctx.shadowColor = nc;
      ctx.shadowBlur = 22;
      ctx.strokeStyle = nc;
      ctx.lineWidth = 3;
      ctx.strokeRect(sx + 5, sy0 + 5, 54, sh - 10);
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 44px ${CJK}`;
      [...vt].forEach((ch, i) => {
        ctx.fillStyle = nc;
        ctx.fillText(ch, sx + 32, sy0 + 44 + i * 70);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(ch, sx + 32, sy0 + 44 + i * 70);
      });
      ctx.shadowBlur = 0;
    }
    // banderines rojos colgando de la cornisa del primer piso
    if (r() < 0.5) {
      for (let k = 0; k < 2; k++) {
        const bx = w * (0.3 + k * 0.4);
        ctx.fillStyle = C.red;
        ctx.fillRect(bx - 16, sy - 160, 32, 90);
        ctx.fillStyle = C.gold;
        ctx.font = `700 24px ${CJK}`;
        ctx.fillText(k ? '春' : '福', bx, sy - 118);
      }
    }
    noise(ctx, w, h, 10);
  });
}

function facade(g, x, z, rot, wm, hm, seed) {
  const grp = new THREE.Group();
  const front = new THREE.Mesh(new THREE.PlaneGeometry(wm, hm), new THREE.MeshBasicMaterial({ map: facadeTex(wm, hm, seed) }));
  front.position.y = hm / 2;
  grp.add(front);
  // el edificio tiene cuerpo (se ve de costado al mirar en diagonal)
  const body = box(wm, hm, 3, basic(hsl(260, 0.25, 0.08)), false);
  body.position.set(0, hm / 2, -1.52);
  grp.add(body);
  // alero de tejas verdes con las puntas levantadas en algunos
  if (seed % 3 !== 0) {
    const eave = box(wm + 0.5, 0.14, 0.8, toon(C.jadeDark), false);
    eave.position.set(0, hm + 0.05, 0.2);
    eave.rotation.x = -0.18;
    grp.add(eave);
    for (const s of [-1, 1]) {
      const tip = box(0.5, 0.08, 0.3, toon(C.jade), false);
      tip.position.set(s * (wm / 2 + 0.2), hm + 0.22, 0.45);
      tip.rotation.z = s * 0.45;
      grp.add(tip);
    }
  }
  grp.position.set(x, 0, z);
  grp.rotation.y = rot;
  g.add(grp);
}

// ------------------------------------------------------------------ portal (paifang)

function paifang(g, z) {
  const grp = new THREE.Group();
  const red = toon(C.red);
  const gold = toon(C.gold);
  const jade = toon(C.jade);
  const stone = toon(hsl(30, 0.06, 0.5));
  const pillar = (x, h, r) => {
    const base = box(r * 3, 0.4, r * 3, stone);
    base.position.set(x, 0.2, 0);
    const p = cyl(r, r * 1.08, h, red, 20);
    p.position.set(x, h / 2 + 0.4, 0);
    const ring = cyl(r * 1.25, r * 1.25, 0.12, gold, 20);
    ring.position.set(x, h + 0.2, 0);
    grp.add(base, p, ring);
  };
  pillar(-2.3, 4.6, 0.2);
  pillar(2.3, 4.6, 0.2);
  pillar(-3.5, 3.2, 0.15);
  pillar(3.5, 3.2, 0.15);
  // vigas con dibujos pintados
  const beamTex = canvasTex(1024, 64, (ctx, w, h) => {
    ctx.fillStyle = C.jadeDark;
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) {
      ctx.fillStyle = C.gold;
      ctx.beginPath();
      ctx.arc(x + 32, h / 2, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.red;
      ctx.beginPath();
      ctx.arc(x + 32, h / 2, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hsl(195, 0.6, 0.55);
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 4, 6, 56, h - 12);
    }
  });
  const beamMat = toon(null, { map: beamTex });
  for (const [y, wb] of [[4.5, 5.6], [3.85, 5.2]]) {
    const b = box(wb, 0.32, 0.36, beamMat);
    b.position.y = y;
    grp.add(b);
  }
  const side = box(1.7, 0.24, 0.3, beamMat);
  side.position.set(-2.95, 3.05, 0);
  const side2 = side.clone();
  side2.position.x = 2.95;
  grp.add(side, side2);
  // cartel del medio
  const plaque = canvasTex(512, 200, (ctx, w, h) => {
    ctx.fillStyle = C.gold;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = C.redDeep;
    ctx.fillRect(12, 12, w - 24, h - 24);
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 24, w - 48, h - 48);
    ctx.fillStyle = C.gold;
    ctx.font = `800 104px ${CJK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('中華街', w / 2, h / 2 + 4);
  });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.66), new THREE.MeshBasicMaterial({ map: plaque }));
  p.position.set(0, 4.18, 0.19);
  grp.add(p);
  // techo con las puntas para arriba: un perfil curvo extruido
  const roof = (wr, y, depth, lift = 0.45, x = 0) => {
    const rg = new THREE.Group();
    const s = new THREE.Shape();
    s.moveTo(-wr / 2 - 0.35, lift);
    s.quadraticCurveTo(-wr / 2, 0, -wr / 2 + 0.6, 0.05);
    s.lineTo(wr / 2 - 0.6, 0.05);
    s.quadraticCurveTo(wr / 2, 0, wr / 2 + 0.35, lift);
    s.lineTo(wr / 2 - 0.4, 0.5);
    s.quadraticCurveTo(0, 0.95, -wr / 2 + 0.4, 0.5);
    s.closePath();
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 }), jade);
    m.position.set(0, y, -depth / 2);
    m.castShadow = true;
    rg.add(m);
    const ridge = box(wr * 0.55, 0.08, depth * 0.3, gold);
    ridge.position.set(0, y + 0.83, 0);
    rg.add(ridge);
    for (const sx of [-1, 1]) {
      const orn = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), gold);
      orn.position.set(sx * (wr / 2 + 0.3), y + lift + 0.06, 0);
      rg.add(orn);
    }
    rg.position.x = x;
    grp.add(rg);
  };
  roof(5.8, 4.66, 1.1);
  roof(1.9, 3.27, 0.8, 0.3, -2.95); // los techitos de los costados
  roof(1.9, 3.27, 0.8, 0.3, 2.95);
  // leones de piedra a los lados
  for (const sx of [-1, 1]) {
    const lion = new THREE.Group();
    const ped = box(0.6, 0.55, 0.6, stone);
    ped.position.y = 0.275;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), stone);
    body.scale.set(1, 1.15, 0.9);
    body.position.y = 0.8;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), stone);
    head.position.set(0, 1.12, 0.1);
    const mane = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.06, 8, 16), stone);
    mane.position.set(0, 1.1, 0.05);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), toon(C.gold));
    ball.position.set(sx * 0.12, 0.62, 0.22);
    lion.add(ped, body, head, mane, ball);
    lion.traverse((o) => (o.castShadow = true));
    lion.position.set(sx * 1.6, 0, 0.6);
    grp.add(lion);
  }
  grp.position.z = z;
  g.add(grp);
}

// ------------------------------------------------------------------ faroles

function lantern(color = C.red) {
  const l = new THREE.Group();
  const bodyMat = basic(color);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 12), bodyMat);
  b.scale.set(1, 0.82, 1);
  // costillas doradas
  for (let k = 0; k < 3; k++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.162, 0.006, 6, 24), basic(C.gold));
    rib.scale.set(1, 0.82, 1);
    rib.rotation.y = (k / 3) * Math.PI;
    l.add(rib);
  }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.05, 12), basic(hsl(40, 0.4, 0.15)));
  cap.position.y = 0.14;
  const bottom = cap.clone();
  bottom.position.y = -0.14;
  const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.025, 0.16, 6), basic(C.gold));
  tassel.position.y = -0.25;
  const halo = glowSprite('rgba(255,90,50,0.9)', 0.9, 0.45);
  l.add(b, cap, bottom, tassel, halo);
  return l;
}

// Guirnalda de faroles de lado a lado de la calle (catenaria), que se mece con el viento.
function lanternString(g, z, { from = -5.6, to = 5.6, y = 3.9, sag = 0.55, n = 9, phase = 0 } = {}) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    pts.push(new THREE.Vector3(from + (to - from) * t, y - Math.sin(t * Math.PI) * sag, z));
  }
  const wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#100808' }));
  g.add(wire);
  const ls = [];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const pivot = new THREE.Group();
    pivot.position.set(from + (to - from) * t, y - Math.sin(t * Math.PI) * sag, z);
    const l = lantern(i % 4 === 2 ? hsl(30, 0.95, 0.55) : C.red);
    l.position.y = -0.24;
    pivot.add(l);
    g.add(pivot);
    ls.push([pivot, i]);
  }
  tick(g, (now) => {
    const t = now / 1000;
    for (const [p, i] of ls) {
      p.rotation.z = Math.sin(t * 1.1 + i * 0.7 + phase) * 0.07;
      p.rotation.x = Math.sin(t * 0.8 + i + phase) * 0.04;
    }
  });
}

// ------------------------------------------------------------------ cerezos

// Racimos de flores de cerezo pintados (cinco pétalos, centro más oscuro, algunos pimpollos): se comparten.
let BLOSSOM = [];
function blossomMats() {
  if (BLOSSOM.length) return;
  BLOSSOM = [0, 1, 2].map((k) => {
    const tex = canvasTex(256, 256, (ctx, w) => {
      const r = seeded(40 + k);
      const tones = [hsl(340, 0.8, 0.86), hsl(345, 0.75, 0.78), hsl(335, 0.6, 0.93), hsl(352, 0.7, 0.7), '#fff6fa'];
      for (let i = 0; i < 70; i++) {
        // más flores al centro que en el borde: un racimo redondo
        const a = r() * Math.PI * 2;
        const d = Math.sqrt(r()) * w * 0.4;
        const x = w / 2 + Math.cos(a) * d;
        const y = w / 2 + Math.sin(a) * d * 0.85;
        const pr = 7 + r() * 7;
        ctx.fillStyle = tones[Math.floor(r() * tones.length)];
        for (let p = 0; p < 5; p++) {
          const pa = (p / 5) * Math.PI * 2 + r();
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(pa) * pr * 0.6, y + Math.sin(pa) * pr * 0.6, pr * 0.55, pr * 0.38, pa, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = hsl(340, 0.6, 0.45);
        ctx.beginPath();
        ctx.arc(x, y, pr * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    return new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.25 });
  });
}

function sakura(g, x, z, r, scale = 1) {
  blossomMats();
  const t = new THREE.Group();
  const bark = toon(hsl(15, 0.25, 0.14));
  const planter = box(1.3, 0.45, 1.3, toon(hsl(25, 0.08, 0.38)));
  planter.position.y = 0.225;
  t.add(planter);
  const soil = box(1.15, 0.02, 1.15, toon(hsl(20, 0.3, 0.12)), false);
  soil.position.y = 0.46;
  t.add(soil);
  const trunk = cyl(0.07, 0.12, 1.5, bark, 8);
  trunk.position.y = 1.2;
  trunk.rotation.z = (r() - 0.5) * 0.2;
  t.add(trunk);
  // ramas abiertas
  const tips = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + r() * 0.5;
    const len = 0.7 + r() * 0.5;
    const br = cyl(0.025, 0.05, len, bark, 6);
    const tilt = 0.7 + r() * 0.35;
    br.position.set(Math.cos(a) * Math.sin(tilt) * len * 0.5, 1.9 + Math.cos(tilt) * len * 0.5, Math.sin(a) * Math.sin(tilt) * len * 0.5);
    br.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
    t.add(br);
    tips.push([Math.cos(a) * Math.sin(tilt) * len, 1.9 + Math.cos(tilt) * len, Math.sin(a) * Math.sin(tilt) * len]);
  }
  // racimos de flores: un núcleo oscuro que da volumen (y sombra) y encima flores pintadas de a una
  const pinks = [hsl(340, 0.75, 0.82), hsl(345, 0.7, 0.74), hsl(335, 0.6, 0.9), hsl(350, 0.65, 0.68)];
  const core = toon(hsl(340, 0.55, 0.72), { flatShading: true });
  for (const [tx, ty, tz] of [...tips, [0, 2.45, 0]]) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18 + r() * 0.08, 0), core);
    s.position.set(tx, ty, tz);
    s.castShadow = true;
    t.add(s);
    for (let k = 0; k < 6; k++) {
      const sp = new THREE.Sprite(BLOSSOM[Math.floor(r() * BLOSSOM.length)]);
      const sz = 0.55 + r() * 0.4;
      sp.scale.set(sz, sz, 1);
      sp.position.set(tx + (r() - 0.5) * 0.55, ty + (r() - 0.35) * 0.4, tz + (r() - 0.5) * 0.55);
      t.add(sp);
    }
  }
  // pétalos caídos en la tierra del cantero
  const fallen = canvasTex(128, 128, (ctx, w) => {
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = pinks[i % pinks.length];
      ctx.beginPath();
      ctx.ellipse(r() * w, r() * w, 3, 1.8, r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), new THREE.MeshBasicMaterial({ map: fallen, transparent: true }));
  fl.rotation.x = -Math.PI / 2;
  fl.position.y = 0.475;
  t.add(fl);
  t.scale.setScalar(scale);
  t.position.set(x, 0, z);
  t.rotation.y = r() * Math.PI;
  g.add(t);
}

// ------------------------------------------------------------------ piso

// Adoquines de piedra mojada: piedras irregulares con juntas, charcos y el reflejo de los neones y faroles.
function wetStone() {
  return canvasTex(1024, 1024, (ctx, w, h) => {
    const r = seeded(17);
    ctx.fillStyle = hsl(250, 0.15, 0.07);
    ctx.fillRect(0, 0, w, h);
    const row = 48;
    for (let y = 0, k = 0; y < h; y += row, k++) {
      let x = k % 2 ? -40 : 0;
      while (x < w) {
        const sw = 60 + r() * 50;
        const l = 0.13 + r() * 0.08;
        ctx.fillStyle = hsl(240 + r() * 30, 0.12, l);
        ctx.beginPath();
        ctx.roundRect(x + 3, y + 3, sw - 6, row - 6, 8);
        ctx.fill();
        // brillo de agua arriba de cada piedra
        ctx.fillStyle = `rgba(200,190,255,${0.04 + r() * 0.06})`;
        ctx.fillRect(x + 8, y + 6, sw * 0.5, 3);
        x += sw;
      }
    }
    // reflejos alargados (rojos de los faroles, neones)
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 36; i++) {
      const c = i % 3 ? 'rgba(255,60,40,0.10)' : ['rgba(255,60,190,0.10)', 'rgba(40,220,255,0.09)', 'rgba(255,210,80,0.09)'][i % 3];
      const x = r() * w;
      const gr = ctx.createLinearGradient(x, 0, x + 30, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(0.5, c);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(x - 20, r() * h, 70, 160 + r() * 260);
    }
    // charcos
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = 'rgba(150,120,255,0.07)';
      ctx.beginPath();
      ctx.ellipse(r() * w, r() * h, 40 + r() * 90, 18 + r() * 40, r(), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    noise(ctx, w, h, 12);
  }, [6, 6]);
}

// ------------------------------------------------------------------ el barrio

export function chinatown(g) {
  BLOSSOM = []; // materiales propios de este armado (la escena libera los ambientes de a uno)
  // cielo de noche con el resplandor rosado de la ciudad sobre el horizonte y la luna
  sky(g, [[0, hsl(250, 0.55, 0.05)], [0.3, hsl(262, 0.5, 0.12)], [0.46, hsl(300, 0.45, 0.26)], [0.5, hsl(330, 0.55, 0.36)], [0.52, C.night], [1, C.night]], {
    stars: 220,
    glow: { u: 0.25, v: 0.5, color: 'rgba(255,90,150,0.9)', size: 0.35, alpha: 0.4 },
    moon: { dir: [0.35, 0.5, -0.8], size: 3.4 },
    haze: 'rgba(255,120,170,0.45)',
  });
  clouds(g, { color: hsl(300, 0.35, 0.42), shade: hsl(270, 0.4, 0.22), r: 32, y: 13, h: 7, n: 10, alpha: 0.3, speed: 0.003 });
  // la ciudad en capas: torres lejanas violetas, más cerca con ventanas, todo perdiéndose en la bruma
  layer(g, paintCity(hsl(262, 0.35, 0.11), { lit: 0.06, light: '#ff9fd6', min: 0.35, max: 0.95, antenna: 0.35 }), { r: 30, h: 15, y: 7.1, haze: hsl(290, 0.45, 0.2), t: 0.4, seed: 3 });
  layer(g, paintCity(hsl(255, 0.35, 0.06), { lit: 0.16, light: '#ffcf80', min: 0.25, max: 0.75 }), { r: 22, h: 11, y: 5.2, haze: hsl(280, 0.4, 0.14), t: 0.15, seed: 8 });

  // luz: noche fría y la calidez de los faroles
  g.add(new THREE.HemisphereLight(hsl(255, 0.5, 0.45), hsl(10, 0.5, 0.12), 0.85));
  const lamp = new THREE.SpotLight('#ffcf9a', 8, 7, Math.PI / 3.1, 0.55, 1.6);
  lamp.position.set(0, 2.55, 0);
  lamp.target.position.set(0, 0, 0);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(2048, 2048);
  lamp.shadow.bias = -0.0004;
  g.add(lamp, lamp.target);
  // el farol grande sobre la mesa
  const big = lantern(hsl(0, 0.85, 0.38));
  big.children.filter((o) => o.isSprite || o.geometry?.type === 'CylinderGeometry' && o.position.y < -0.2).forEach((o) => (o.visible = false));
  big.scale.setScalar(1.7);
  big.position.y = 3.05;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.6), basic('#0a0a0a'));
  cord.position.y = 4.1;
  g.add(big, cord);
  tick(g, (now) => (big.rotation.y = now / 9000));
  for (const [x, z, c] of [[-4.5, -3.5, '#ff6a48'], [4.5, 3, '#ff4fa8'], [5.5, -8, '#4fd8ff']]) {
    const pl = new THREE.PointLight(c, 3, 9, 1.6);
    pl.position.set(x, 2.8, z);
    g.add(pl);
  }

  // piso
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), toon(null, { map: wetStone() }));
  fl.material.map.repeat.set(30, 30);
  fl.rotation.x = -Math.PI / 2;
  fl.receiveShadow = true;
  g.add(fl);
  // cordones de vereda
  for (const sx of [-1, 1]) {
    const curb = box(0.25, 0.14, 30, toon(hsl(30, 0.05, 0.42)));
    curb.position.set(sx * 5.25, 0.07, 0);
    g.add(curb);
    const walk = box(1.4, 0.12, 30, toon(hsl(250, 0.1, 0.2)), false);
    walk.position.set(sx * 6.05, 0.06, 0);
    g.add(walk);
  }

  // fachadas a los dos lados de la calle (y algunas en el fondo, de atrás)
  let seed = 11;
  for (const sx of [-1, 1]) {
    let z = -14;
    while (z < 14) {
      const wm = 3.2 + ((seed * 7) % 5) * 0.4;
      const hm = 6 + ((seed * 13) % 7) * 0.7;
      facade(g, sx * 6.8, z + wm / 2, -sx * Math.PI / 2, wm, hm, seed++);
      z += wm + 0.05;
    }
  }
  for (const x of [-4.2, 0, 4.2]) facade(g, x, 15, Math.PI, 4.1, 7 + ((seed * 3) % 4), seed++);

  // el portal adelante y otro chiquito lejos
  paifang(g, -6.2);

  // faroles colgando de lado a lado
  [-4.6, -2.4, 2.2, 4.4, 7.5, 10.5].forEach((z, i) => lanternString(g, z, { phase: i, y: 4 + (i % 2) * 0.3, n: 10 }));

  // cerezos en canteros
  const r = seeded(23);
  for (const [x, z, s] of [[-3.9, -3.4, 1], [3.9, -3.2, 1.08], [-4, 3.4, 1.05], [4, 3.6, 0.95], [-3.9, 8.5, 1], [3.9, 9, 1.1]]) sakura(g, x, z, r, s);
  petals(g, { n: 320, area: 6, top: 4.6 });

  // un puesto de comida con vapor (al fondo a la derecha) y unas macetas de bambú
  const cart = new THREE.Group();
  const cartBody = box(1.4, 0.9, 0.7, toon(C.redDeep));
  cartBody.position.y = 0.6;
  const roofTex = canvasTex(256, 64, (ctx, w, h) => {
    for (let x = 0, k = 0; x < w; x += 32, k++) {
      ctx.fillStyle = k % 2 ? C.red : '#f4ead8';
      ctx.fillRect(x, 0, 32, h);
    }
  });
  const awn = box(1.7, 0.06, 1.1, toon(null, { map: roofTex }));
  awn.position.y = 1.95;
  awn.rotation.x = 0.12;
  for (const px of [-0.65, 0.65]) {
    const pole = cyl(0.025, 0.025, 1.4, toon('#1a1010'));
    pole.position.set(px, 1.3, 0.3);
    cart.add(pole);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshBasicMaterial({ map: canvasTex(256, 64, (ctx, w, h) => {
    ctx.fillStyle = C.gold;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = C.redDeep;
    ctx.font = `800 44px ${CJK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('包子 · 餃子', w / 2, h / 2 + 2);
  }) }));
  sign.position.set(0, 1.2, 0.36);
  for (let k = 0; k < 3; k++) {
    const steamer = cyl(0.17, 0.17, 0.12, toon(hsl(35, 0.4, 0.55)), 16);
    steamer.position.set(-0.4 + k * 0.4, 1.1 + (k % 2) * 0.12, 0);
    cart.add(steamer);
  }
  cart.add(cartBody, awn, sign);
  cart.position.set(3.2, 0, -5);
  cart.rotation.y = -0.5;
  g.add(cart);
  const steam = glowSprite('rgba(255,255,255,0.5)', 0.8, 0.25);
  steam.position.set(3.2, 1.6, -5);
  g.add(steam);
  tick(g, (now) => {
    const t = (now / 2200) % 1;
    steam.position.y = 1.4 + t * 0.9;
    steam.material.opacity = 0.3 * (1 - t);
    steam.scale.setScalar(0.5 + t * 0.8);
  });
  const bamboo = toon(hsl(95, 0.45, 0.35));
  for (const [x, z] of [[-2.6, -5.3], [2.4, 6], [-2.8, 6.4]]) {
    const pot = cyl(0.24, 0.18, 0.4, toon(hsl(200, 0.4, 0.3)));
    pot.position.set(x, 0.2, z);
    g.add(pot);
    for (let k = 0; k < 5; k++) {
      const stalk = cyl(0.018, 0.022, 1.6 + r() * 0.8, bamboo, 6);
      stalk.position.set(x + (r() - 0.5) * 0.25, 1.1, z + (r() - 0.5) * 0.25);
      stalk.rotation.set((r() - 0.5) * 0.15, 0, (r() - 0.5) * 0.15);
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 6), toon(hsl(110, 0.45, 0.3), { flatShading: true }));
      tuft.position.set(stalk.position.x, 2 + r() * 0.5, stalk.position.z);
      g.add(stalk, tuft);
    }
  }
  return { background: C.night, fog: [C.fog, 11, 34] };
}
