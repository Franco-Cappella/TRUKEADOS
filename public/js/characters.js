// Personajes 2D ilustrados que viven dentro de la escena 3D.
// Se dibujan en un canvas según hacia dónde está girado el cuerpo y la cabeza respecto de quien mira
// (de frente, de tres cuartos o casi de perfil), hacia dónde mira y qué cara pone (señas y hablar).
// No parpadean solos: los ojos cerrados son SOLO la seña "ciego", para que no se confunda.
import { INK, PALETTE, FACE, mix } from './theme.js';

export const W = 512;
export const H = 1200;
const WAIST = 730; // cintura (el resto es cadera, piernas y zapatos, sentado)

const STYLES = ['short', 'swept', 'long', 'bun', 'receding', 'curly', 'boina', 'cap', 'buzz'];
const SHIRTS = ['button', 'sweater', 'tee', 'jacket', 'polo'];

function hash(str) {
  let h = 2166136261;
  for (const ch of String(str)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function lookFor(name, seat) {
  const h = hash(String(name).replace(/\s*\(bot\)$/i, '') + '#' + seat);
  const pick = (arr, k) => arr[(h >>> k) % arr.length];
  const style = pick(STYLES, 11);
  const old = (h >>> 25) % 4 === 0 || style === 'receding';
  return {
    skin: pick(PALETTE.skins, 0),
    hair: old ? pick(PALETTE.grayHairs, 3) : pick(PALETTE.hairs, 3),
    cloth: pick(PALETTE.clothes, 7),
    cloth2: pick(PALETTE.clothes, 9),
    shirt: pick(SHIRTS, 13),
    style,
    beard: (h >>> 15) % 5 === 0,
    stubble: (h >>> 16) % 4 === 0,
    mustache: (h >>> 17) % 4 === 0,
    glasses: (h >>> 19) % 6 === 0,
    old,
    fw: 66 + ((h >>> 21) % 10),
    fh: 86 + ((h >>> 24) % 10),
    jaw: 0.5 + ((h >>> 27) % 4) * 0.06,
  };
}

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

function fillStroke(ctx, fill, stroke = INK, lw = 3) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

// state:
//  bodyYaw / headYaw: radianes, 0 = de frente a quien mira, >0 = girado hacia la derecha de la imagen
//  down: 0..1 cuánto mira hacia abajo (la mesa)
//  expr, talking, cards
export function drawCharacter(ctx, look, state) {
  const { expr = 'neutral', talking = false, cards = 0 } = state;
  const bodyYaw = clamp(state.bodyYaw || 0, -1.3, 1.3);
  const headYaw = clamp(state.headYaw ?? bodyYaw, -1.35, 1.35);
  const down = clamp(state.down || 0, 0, 1);
  ctx.clearRect(0, 0, W, H);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const bx = 256 + Math.sin(bodyYaw) * 8;
  const hx = bx + Math.sin(headYaw) * 6;
  const hy = 214 + down * 10;

  if (look.style === 'long') drawLongHairBack(ctx, look, hx, hy, headYaw);
  drawLegs(ctx, look, bx, bodyYaw);
  drawTorso(ctx, look, bx, bodyYaw);
  drawNeck(ctx, look, bx, hx, hy);
  drawHead(ctx, look, hx, hy, headYaw, down, expr, talking);
  drawArms(ctx, look, bx, bodyYaw, cards);
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ------------------------------------------------------------------ cuerpo
function drawTorso(ctx, look, bx, yaw) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const sw = 148 * (0.66 + 0.34 * c); // mitad del ancho de hombros
  const top = 352;
  const cloth = look.shirt === 'jacket' ? look.cloth2 : look.cloth;
  const shade = mix(cloth, 0.78);

  ctx.beginPath();
  ctx.moveTo(bx - 34, top - 4);
  ctx.bezierCurveTo(bx - 70, top + 4, bx - sw + 18, top + 8, bx - sw, top + 52);
  ctx.bezierCurveTo(bx - sw - 14, top + 120, bx - sw - 22, top + 260, bx - sw * 0.9, WAIST);
  ctx.quadraticCurveTo(bx, WAIST + 14, bx + sw * 0.9, WAIST);
  ctx.bezierCurveTo(bx + sw + 22, top + 260, bx + sw + 14, top + 120, bx + sw, top + 52);
  ctx.bezierCurveTo(bx + sw - 18, top + 8, bx + 70, top + 4, bx + 34, top - 4);
  ctx.closePath();
  const grd = ctx.createLinearGradient(bx - sw, 0, bx + sw, 0);
  grd.addColorStop(0, mix(cloth, 1.06));
  grd.addColorStop(0.55, cloth);
  grd.addColorStop(1, shade);
  fillStroke(ctx, grd, INK, 3.5);

  // sombra de la mesa / parte de abajo
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, 600, W, WAIST - 590);
  ctx.restore();

  const mid = bx + s * 34; // línea central del pecho (se corre al girar)
  ctx.strokeStyle = mix(cloth, 0.62);
  ctx.lineWidth = 2.5;
  switch (look.shirt) {
    case 'button':
    case 'polo': {
      // cuello de camisa
      ctx.fillStyle = mix(cloth, 1.12);
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(mid + side * 6, top + 34);
        ctx.lineTo(mid + side * 44 * (0.7 + 0.3 * c), top - 2);
        ctx.lineTo(mid + side * 30, top + 30);
        ctx.closePath();
        fillStroke(ctx, mix(cloth, 1.12), INK, 2.5);
      }
      ctx.beginPath();
      ctx.moveTo(mid, top + 34);
      ctx.lineTo(mid + s * 6, look.shirt === 'polo' ? top + 90 : WAIST);
      ctx.stroke();
      ctx.fillStyle = mix(cloth, 0.55);
      for (let y = top + 60; y < (look.shirt === 'polo' ? top + 90 : 620); y += 46) {
        ellipse(ctx, mid + 6 + s * 6 * ((y - top) / 400), y, 3.2, 3.2);
        ctx.fill();
      }
      break;
    }
    case 'jacket': {
      // camisa clara debajo y solapas
      ctx.beginPath();
      ctx.moveTo(mid - 30, top);
      ctx.lineTo(mid + 30, top);
      ctx.lineTo(mid + 4, top + 150);
      ctx.closePath();
      fillStroke(ctx, '#e9e4d8', INK, 2.5);
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(mid + side * 30, top - 2);
        ctx.lineTo(mid + side * 66 * (0.75 + 0.25 * c), top + 40);
        ctx.lineTo(mid + side * 34, top + 64);
        ctx.lineTo(mid + side * 4, top + 150);
        ctx.closePath();
        fillStroke(ctx, mix(cloth, 0.9), INK, 2.5);
      }
      break;
    }
    case 'sweater': {
      ctx.beginPath();
      ctx.ellipse(mid, top + 6, 40, 16, 0, 0.05 * Math.PI, 0.95 * Math.PI);
      ctx.lineWidth = 7;
      ctx.strokeStyle = mix(cloth, 0.7);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = mix(cloth, 0.85);
      for (let x = -sw + 30; x < sw - 20; x += 14) {
        ctx.beginPath();
        ctx.moveTo(bx + x * 0.9, WAIST - 50);
        ctx.lineTo(bx + x * 0.9, WAIST);
        ctx.stroke();
      }
      break;
    }
    default: {
      ctx.beginPath();
      ctx.ellipse(mid, top + 4, 36, 14, 0, 0.05 * Math.PI, 0.95 * Math.PI);
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
  }
  // pliegues
  ctx.strokeStyle = mix(cloth, 0.68);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(bx - sw + 30, top + 120);
  ctx.quadraticCurveTo(bx - sw + 50, top + 180, bx - sw + 34, top + 230);
  ctx.moveTo(bx + sw - 30, top + 120);
  ctx.quadraticCurveTo(bx + sw - 50, top + 180, bx + sw - 34, top + 230);
  ctx.stroke();
}

function drawNeck(ctx, look, bx, hx, hy) {
  const [skin, skinD] = look.skin;
  ctx.beginPath();
  ctx.moveTo(hx - 30, hy + 60);
  ctx.lineTo(bx - 34, 366);
  ctx.quadraticCurveTo(bx, 384, bx + 34, 366);
  ctx.lineTo(hx + 30, hy + 60);
  ctx.closePath();
  fillStroke(ctx, skinD, INK, 3);
  // sombra bajo la mandíbula
  ellipse(ctx, hx, hy + 84, 34, 14);
  ctx.fillStyle = 'rgba(60,30,20,0.25)';
  ctx.fill();
  void skin;
}

// Sentado: cadera, muslos que vienen hacia adelante (hacia la mesa), piernas y zapatos.
function drawLegs(ctx, look, bx, yaw) {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  const pants = PALETTE.pants[(look.fw + look.fh) % PALETTE.pants.length];
  const pantsD = mix(pants, 0.75);
  const shoe = '#1e1714';
  const hipW = 118 * (0.7 + 0.3 * c);
  const kneeY = 880;
  const ankleY = 1135;
  // cadera
  ctx.beginPath();
  ctx.moveTo(bx - hipW, WAIST - 12);
  ctx.lineTo(bx + hipW, WAIST - 12);
  ctx.quadraticCurveTo(bx + hipW + 10, 800, bx + hipW - 6, 830);
  ctx.lineTo(bx - hipW + 6, 830);
  ctx.quadraticCurveTo(bx - hipW - 10, 800, bx - hipW, WAIST - 12);
  fillStroke(ctx, pants, INK, 3);
  // cinturón
  ctx.fillStyle = '#2a1d16';
  ctx.fillRect(bx - hipW + 4, WAIST - 10, hipW * 2 - 8, 14);
  ctx.fillStyle = '#b9a272';
  ctx.fillRect(bx + s * 30 - 10, WAIST - 10, 20, 14);
  for (const side of [-1, 1]) {
    // muslo hacia adelante (las rodillas apuntan al centro de la mesa)
    const hx = bx + side * hipW * 0.5;
    const kx = bx + side * 62 * (0.6 + 0.4 * c) + s * 46;
    ctx.beginPath();
    ctx.moveTo(hx - 46, 800);
    ctx.quadraticCurveTo(kx - 56, 840, kx - 44, kneeY + 10);
    ctx.quadraticCurveTo(kx, kneeY + 34, kx + 44, kneeY + 10);
    ctx.quadraticCurveTo(kx + 56, 840, hx + 46, 800);
    ctx.closePath();
    fillStroke(ctx, side < 0 ? pants : pantsD, INK, 3);
    // pierna
    const ax = kx + s * 10 + side * 4;
    ctx.beginPath();
    ctx.moveTo(kx - 36, kneeY + 14);
    ctx.lineTo(ax - 28, ankleY);
    ctx.lineTo(ax + 28, ankleY);
    ctx.lineTo(kx + 36, kneeY + 14);
    ctx.closePath();
    fillStroke(ctx, side < 0 ? mix(pants, 0.9) : mix(pants, 0.7), INK, 3);
    // zapato
    ctx.beginPath();
    ctx.moveTo(ax - 32, ankleY - 4);
    ctx.quadraticCurveTo(ax - 40 + s * 30, ankleY + 50, ax + s * 34, ankleY + 54);
    ctx.quadraticCurveTo(ax + 44 + s * 30, ankleY + 50, ax + 32, ankleY - 4);
    ctx.closePath();
    fillStroke(ctx, shoe, INK, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ellipse(ctx, ax - 10 + s * 20, ankleY + 18, 10, 5);
    ctx.fill();
  }
  // sombra en el piso
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ellipse(ctx, bx + s * 40, ankleY + 56, 150, 12);
  ctx.fill();
}

// ------------------------------------------------------------------ cabeza
function drawHead(ctx, look, cx, cy, yaw, down, expr, talking) {
  const [skin, skinD] = look.skin;
  const fw = look.fw;
  const fh = look.fh;
  const s = Math.sin(yaw);
  // proyección de un punto de la cara que está a "phi" radianes del centro
  const px = (phi, r = 0.96) => cx + fw * r * Math.sin(phi + yaw);
  const vis = (phi) => Math.cos(phi + yaw);
  const puff = expr === 'puff';

  // orejas (detrás si están en el borde)
  const ears = [-1.85, 1.85].map((phi) => ({ phi, x: px(phi, 0.98), v: vis(phi) }));
  for (const e of ears) if (e.v <= 0.08 && e.v > -0.4) drawEar(ctx, e.x, cy + 6 - down * 4, look, e.phi * (e.v < 0 ? -1 : 1));

  // forma de la cabeza
  const chinX = cx + s * fw * 0.3;
  const jaw = look.jaw;
  const cheek = puff ? 1.12 : 1;
  ctx.beginPath();
  ctx.moveTo(cx - fw, cy - fh * 0.08);
  ctx.bezierCurveTo(cx - fw * 1.02, cy - fh * 1.08, cx + fw * 1.02, cy - fh * 1.08, cx + fw, cy - fh * 0.08);
  ctx.bezierCurveTo(cx + fw * cheek, cy + fh * 0.42, cx + fw * jaw + s * fw * 0.32, cy + fh * 0.88, chinX + fw * 0.2, cy + fh * 0.98);
  ctx.quadraticCurveTo(chinX, cy + fh * 1.07, chinX - fw * 0.2, cy + fh * 0.98);
  ctx.bezierCurveTo(cx - fw * jaw + s * fw * 0.32, cy + fh * 0.88, cx - fw * cheek, cy + fh * 0.42, cx - fw, cy - fh * 0.08);
  ctx.closePath();
  const g = ctx.createLinearGradient(cx - fw, cy, cx + fw, cy);
  // luz de arriba a la izquierda: el lado derecho de la imagen más oscuro
  g.addColorStop(0, skin);
  g.addColorStop(0.62, skin);
  g.addColorStop(1, skinD);
  fillStroke(ctx, g, INK, 3.5);

  // barba / sombra de barba
  if (look.beard || look.stubble) {
    ctx.save();
    ctx.clip();
    // la barba arranca en las patillas, baja por la mandíbula y deja libres los cachetes
    const mx = px(0, 0.95);
    ctx.beginPath();
    ctx.moveTo(cx - fw * 1.1, cy + fh * 0.05);
    ctx.lineTo(cx - fw * 0.88, cy + fh * 0.05);
    ctx.bezierCurveTo(cx - fw * 0.8, cy + fh * 0.5, mx - fw * 0.45, cy + fh * 0.45, mx, cy + fh * 0.44);
    ctx.bezierCurveTo(mx + fw * 0.45, cy + fh * 0.45, cx + fw * 0.8, cy + fh * 0.5, cx + fw * 0.88, cy + fh * 0.05);
    ctx.lineTo(cx + fw * 1.1, cy + fh * 0.05);
    ctx.lineTo(cx + fw * 1.1, cy + fh * 1.2);
    ctx.lineTo(cx - fw * 1.1, cy + fh * 1.2);
    ctx.closePath();
    ctx.fillStyle = look.beard ? look.hair : 'rgba(40,30,25,0.13)';
    ctx.globalAlpha = look.beard ? 0.9 : 1;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (look.beard) {
      // textura
      ctx.strokeStyle = mix(look.hair, 0.7);
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 26; i++) {
        const a = (i / 25) * Math.PI;
        const x = cx + Math.cos(a) * fw * 0.8;
        const y = cy + fh * 0.6 + Math.sin(a) * fh * 0.38;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 2, y + 7);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // orejas visibles sobre la cara (cabeza girada)
  for (const e of ears) if (e.v > 0.08) drawEar(ctx, e.x, cy + 6 - down * 4, look, e.phi);

  // rubor / cachetes
  const cheeks = [-0.62, 0.62];
  for (const phi of cheeks) {
    if (vis(phi) < 0.1) continue;
    ellipse(ctx, px(phi, 0.86), cy + fh * 0.32, (puff ? 22 : 15) * vis(phi), puff ? 18 : 9);
    ctx.fillStyle = puff ? 'rgba(214,110,100,0.45)' : 'rgba(205,120,105,0.16)';
    ctx.fill();
    if (puff) {
      ctx.strokeStyle = 'rgba(80,40,30,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px(phi, 0.86), cy + fh * 0.36, 20 * vis(phi), 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    }
  }

  // arrugas de la edad
  if (look.old) {
    ctx.strokeStyle = mix(skinD, 0.8);
    ctx.lineWidth = 2;
    for (const phi of [-0.32, 0.32]) {
      if (vis(phi) < 0.2) continue;
      ctx.beginPath();
      ctx.moveTo(px(phi * 0.9, 0.9), cy + fh * 0.22);
      ctx.quadraticCurveTo(px(phi * 1.25, 0.9), cy + fh * 0.4, px(phi * 1.15, 0.9), cy + fh * 0.55);
      ctx.stroke();
    }
  }

  const eyeY = cy - fh * 0.06 + down * 8;
  drawEyes(ctx, look, px, vis, eyeY, expr, down, yaw);
  drawBrows(ctx, look, px, vis, eyeY, expr, down);
  drawNose(ctx, look, px, cy, fh, yaw, expr);
  // el beso va por encima del bigote: si no, la seña del dos no se ve
  const mouth = () => drawMouth(ctx, look, px, vis, cy + fh * 0.6 + down * 4, yaw, expr, talking);
  if (expr !== 'kiss') mouth();
  if (look.mustache || look.beard) drawMustache(ctx, look, px, cy + fh * 0.48 + down * 4, yaw, expr);
  if (expr === 'kiss') mouth();
  if (look.glasses) drawGlasses(ctx, px, vis, eyeY);
  drawHair(ctx, look, cx, cy, fw, fh, yaw, px, vis);
}

function drawEar(ctx, x, y, look, phi) {
  const [skin, skinD] = look.skin;
  ellipse(ctx, x, y, 12, 21);
  fillStroke(ctx, skinD, INK, 3);
  ctx.strokeStyle = mix(skinD, 0.75);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + (phi < 0 ? 2 : -2), y, 7, -1.2, 1.2);
  ctx.stroke();
  void skin;
}

function drawEyes(ctx, look, px, vis, y, expr, down, yaw) {
  const sides = [
    { phi: -0.4, left: false }, // ojo derecho del personaje (izquierda de la imagen)
    { phi: 0.4, left: true },
  ];
  for (const e of sides) {
    const v = vis(e.phi);
    if (v < 0.12) continue;
    const x = px(e.phi, 0.92);
    const w = 16 * (0.35 + 0.65 * v);
    const closed = expr === 'eyesClosed' || (expr === 'wink' && e.left);
    const squint = expr === 'nose' || (expr === 'wink' && !e.left) || expr === 'puff';
    if (closed) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(x - w, y + 1);
      ctx.quadraticCurveTo(x, y + 8, x + w, y + 1);
      ctx.stroke();
      // pliegue del párpado
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = 'rgba(60,30,20,0.5)';
      ctx.beginPath();
      ctx.moveTo(x - w * 0.8, y - 5);
      ctx.quadraticCurveTo(x, y - 9, x + w * 0.8, y - 5);
      ctx.stroke();
      continue;
    }
    const open = squint ? 4.5 : 8.5 - down * 3;
    // forma almendrada
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w * 0.2, y - open * 1.5, x + w, y - 1);
    ctx.quadraticCurveTo(x + w * 0.1, y + open * 1.1, x - w, y);
    ctx.closePath();
    ctx.fillStyle = '#f6f2ea';
    ctx.fill();
    ctx.save();
    ctx.clip();
    // pupila: mira hacia adelante de la cabeza; hacia abajo si mira la mesa
    const ix = x + Math.sin(yaw) * 2.5 * v;
    const iy = y + down * 4 - 1;
    ellipse(ctx, ix, iy, 6.5 * (0.45 + 0.55 * v), 7);
    ctx.fillStyle = '#4a3423';
    ctx.fill();
    ellipse(ctx, ix, iy, 3.2 * (0.45 + 0.55 * v), 3.4);
    ctx.fillStyle = '#120c08';
    ctx.fill();
    ellipse(ctx, ix - 1.8, iy - 2.2, 1.5, 1.5);
    ctx.fillStyle = '#fff';
    ctx.fill();
    // párpado superior caído si mira para abajo
    if (down > 0.2) {
      ctx.fillStyle = mix(look.skin[0], 0.95);
      ctx.fillRect(x - w - 2, y - open * 2, w * 2 + 4, open * 1.1 * down + open * 0.6);
    }
    ctx.restore();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w * 0.2, y - open * 1.5, x + w, y - 1);
    ctx.stroke();
    if (squint) {
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = 'rgba(60,30,20,0.55)';
      ctx.beginPath();
      ctx.moveTo(x - w * 0.8, y + 7);
      ctx.quadraticCurveTo(x, y + 10, x + w * 0.8, y + 6);
      ctx.stroke();
    }
  }
}

function drawBrows(ctx, look, px, vis, eyeY, expr, down) {
  const col = look.style === 'receding' || look.old ? mix(look.hair, 0.75) : mix(look.hair, 0.9);
  ctx.strokeStyle = col;
  ctx.lineWidth = 6;
  for (const phi of [-0.42, 0.42]) {
    const v = vis(phi);
    if (v < 0.12) continue;
    const x = px(phi, 0.92);
    const w = 19 * (0.35 + 0.65 * v);
    const inner = phi < 0 ? 1 : -1; // hacia el centro de la cara
    let y = eyeY - 20 + down * 2;
    let innerDy = 0;
    let arch = -5;
    if (expr === 'brows') {
      y -= 15;
      arch = -9;
    } else if (expr === 'nose' || expr === 'frown') {
      innerDy = 7;
      y += 3;
    } else if (expr === 'wink' && phi > 0) {
      y += 5;
    }
    ctx.beginPath();
    ctx.moveTo(x - inner * w, y + 2);
    ctx.quadraticCurveTo(x, y + arch, x + inner * w, y + innerDy);
    ctx.stroke();
  }
  if (expr === 'brows') {
    ctx.strokeStyle = 'rgba(80,45,30,0.4)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(px(-0.35, 0.9), eyeY - 46 - i * 8);
      ctx.quadraticCurveTo(px(0, 0.95), eyeY - 50 - i * 8, px(0.35, 0.9), eyeY - 46 - i * 8);
      ctx.stroke();
    }
  }
}

function drawNose(ctx, look, px, cy, fh, yaw, expr) {
  const s = Math.sin(yaw);
  const x = px(0, 0.97);
  const top = cy - fh * 0.02;
  const tip = cy + fh * 0.34;
  const out = s * 15; // la punta sobresale hacia donde gira
  ctx.strokeStyle = mix(look.skin[1], 0.62);
  ctx.lineWidth = 3;
  ctx.beginPath();
  // línea del tabique del lado en sombra
  ctx.moveTo(x + (s >= 0 ? 4 : -4), top);
  ctx.quadraticCurveTo(x + out * 0.6 + (s >= 0 ? 6 : -6), tip - 14, x + out + (s >= 0 ? 4 : -4), tip);
  ctx.stroke();
  // base y fosas
  ctx.beginPath();
  ctx.moveTo(x + out - 12 * (1 - Math.abs(s) * 0.5), tip + 2);
  ctx.quadraticCurveTo(x + out, tip + 9, x + out + 12 * (1 - Math.abs(s) * 0.5), tip + 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(70,35,25,0.35)';
  ellipse(ctx, x + out - 6, tip + 3, 3, 2);
  ctx.fill();
  ellipse(ctx, x + out + 6, tip + 3, 3, 2);
  ctx.fill();
  if (expr === 'nose') {
    ctx.strokeStyle = 'rgba(70,35,25,0.6)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x - 8, top + 10 + i * 6);
      ctx.quadraticCurveTo(x, top + 7 + i * 6, x + 8, top + 10 + i * 6);
      ctx.stroke();
    }
    // la nariz fruncida levanta el labio
    ctx.beginPath();
    ctx.moveTo(x + out - 18, tip + 4);
    ctx.quadraticCurveTo(x + out - 22, tip + 14, x + out - 16, tip + 22);
    ctx.moveTo(x + out + 18, tip + 4);
    ctx.quadraticCurveTo(x + out + 22, tip + 14, x + out + 16, tip + 22);
    ctx.stroke();
  }
}

function drawMouth(ctx, look, px, vis, y, yaw, expr, talking) {
  const s = Math.sin(yaw);
  const x = px(0, 0.95) + s * 5;
  const w = 22 * (0.5 + 0.5 * Math.cos(yaw));
  const lip = mix(look.skin[1], 0.82);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  switch (expr) {
    case 'mouthRight':
    case 'mouthLeft': {
      // a la derecha DEL PERSONAJE = izquierda de la imagen (si está de frente)
      const d = expr === 'mouthRight' ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(x - d * w * 0.6, y + 3);
      ctx.quadraticCurveTo(x + d * w * 0.4, y + 4, x + d * w * 1.35, y - 9);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(70,35,25,0.5)';
      ctx.beginPath();
      ctx.arc(x + d * w * 1.45, y - 6, 7, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    case 'bite': {
      // dientes de arriba mordiendo el labio de abajo
      ctx.beginPath();
      ctx.moveTo(x - w, y - 2);
      ctx.quadraticCurveTo(x, y - 8, x + w, y - 2);
      ctx.lineTo(x + w * 0.8, y + 4);
      ctx.lineTo(x - w * 0.8, y + 4);
      ctx.closePath();
      fillStroke(ctx, FACE.teeth, INK, 2.5);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1.2;
      for (const dx of [-0.4, 0, 0.4]) {
        ctx.beginPath();
        ctx.moveTo(x + dx * w, y - 6);
        ctx.lineTo(x + dx * w, y + 4);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(x - w * 0.85, y + 5);
      ctx.quadraticCurveTo(x, y + 14, x + w * 0.85, y + 5);
      ctx.quadraticCurveTo(x, y + 8, x - w * 0.85, y + 5);
      fillStroke(ctx, lip, INK, 2);
      return;
    }
    case 'kiss': {
      // beso evidente: labios grandes, rojos y para adelante (corridos hacia donde mira), con arrugas
      ctx.save();
      const kx = x + s * 10;
      const ky = y + 4;
      ctx.translate(kx, ky);
      ctx.scale(1.35, 1.35); // grande: la seña tiene que verse desde la otra punta de la mesa
      ctx.translate(-kx, -ky);
      ctx.strokeStyle = FACE.wrinkle;
      ctx.lineWidth = 1.8;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(kx + Math.cos(a) * 16, ky + Math.sin(a) * 14);
        ctx.lineTo(kx + Math.cos(a) * 21, ky + Math.sin(a) * 18);
        ctx.stroke();
      }
      // labio de arriba (con la forma de corazón) y de abajo
      ctx.beginPath();
      ctx.moveTo(kx - 13, ky);
      ctx.bezierCurveTo(kx - 12, ky - 13, kx - 3, ky - 13, kx, ky - 7);
      ctx.bezierCurveTo(kx + 3, ky - 13, kx + 12, ky - 13, kx + 13, ky);
      ctx.bezierCurveTo(kx + 12, ky + 14, kx - 12, ky + 14, kx - 13, ky);
      ctx.closePath();
      fillStroke(ctx, FACE.kissLip, INK, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; // brillo del labio
      ellipse(ctx, kx - 4, ky + 6, 4, 2);
      ctx.fill();
      ellipse(ctx, kx, ky + 1, 3.5, 3);
      ctx.fillStyle = FACE.mouthInside;
      ctx.fill();
      ctx.restore();
      return;
    }
    case 'open': {
      // boca abierta: óvalo oscuro con los dientes de arriba y la lengua abajo
      ctx.beginPath();
      ctx.ellipse(x, y + 9, w * 0.72, 16, 0, 0, Math.PI * 2);
      fillStroke(ctx, FACE.mouthInside, INK, 3);
      ctx.save();
      ctx.clip();
      ctx.fillStyle = FACE.teeth;
      ctx.fillRect(x - w, y - 8, w * 2, 8);
      ctx.fillStyle = FACE.tongue;
      ctx.beginPath();
      ctx.ellipse(x, y + 23, w * 0.5, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    case 'puff': {
      ctx.beginPath();
      ctx.moveTo(x - w * 0.45, y);
      ctx.quadraticCurveTo(x, y + 3, x + w * 0.45, y);
      ctx.lineWidth = 3.5;
      ctx.stroke();
      return;
    }
    case 'frown': {
      ctx.beginPath();
      ctx.moveTo(x - w, y + 8);
      ctx.quadraticCurveTo(x, y - 6, x + w, y + 8);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(70,35,25,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - w - 4, y + 12);
      ctx.lineTo(x - w - 8, y + 20);
      ctx.moveTo(x + w + 4, y + 12);
      ctx.lineTo(x + w + 8, y + 20);
      ctx.stroke();
      return;
    }
  }
  if (talking) {
    ctx.beginPath();
    ctx.moveTo(x - w * 0.8, y - 1);
    ctx.quadraticCurveTo(x, y - 5, x + w * 0.8, y - 1);
    ctx.quadraticCurveTo(x, y + 18, x - w * 0.8, y - 1);
    fillStroke(ctx, FACE.mouthInside, INK, 2.5);
    ctx.fillStyle = FACE.teeth;
    ctx.fillRect(x - w * 0.5, y - 3, w, 4);
    return;
  }
  // neutral: labio superior fino, boca cerrada
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x - w * 0.3, y - 3, x, y - 1);
  ctx.quadraticCurveTo(x + w * 0.3, y - 3, x + w, y);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(80,40,30,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y + 8);
  ctx.quadraticCurveTo(x, y + 11, x + w * 0.5, y + 8);
  ctx.stroke();
}

function drawMustache(ctx, look, px, y, yaw, expr) {
  const s = Math.sin(yaw);
  const x = px(0, 0.96) + s * 6;
  const tilt = expr === 'mouthRight' ? -8 : expr === 'mouthLeft' ? 8 : 0;
  const w = 28 * (0.55 + 0.45 * Math.cos(yaw));
  ctx.beginPath();
  ctx.moveTo(x - w + tilt, y + 10);
  ctx.quadraticCurveTo(x - w * 0.5 + tilt, y - 4, x + tilt, y + 1);
  ctx.quadraticCurveTo(x + w * 0.5 + tilt, y - 4, x + w + tilt, y + 10);
  ctx.quadraticCurveTo(x + tilt, y + 6, x - w + tilt, y + 10);
  fillStroke(ctx, look.hair, INK, 2);
}

function drawGlasses(ctx, px, vis, y) {
  ctx.strokeStyle = '#1d1a18';
  ctx.lineWidth = 3;
  const pts = [];
  for (const phi of [-0.4, 0.4]) {
    const v = vis(phi);
    if (v < 0.15) continue;
    const x = px(phi, 0.93);
    const w = 22 * (0.4 + 0.6 * v);
    ctx.beginPath();
    ctx.roundRect(x - w, y - 14, w * 2, 26, 8);
    ctx.fillStyle = 'rgba(200,220,235,0.12)';
    ctx.fill();
    ctx.stroke();
    pts.push([x, w]);
  }
  if (pts.length === 2) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0] + pts[0][1], y - 4);
    ctx.quadraticCurveTo((pts[0][0] + pts[1][0]) / 2, y - 9, pts[1][0] - pts[1][1], y - 4);
    ctx.stroke();
  }
}

// ------------------------------------------------------------------ pelo
function hairline(px, cy, fh, from, to, n = 10) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const phi = from + ((to - from) * i) / n;
    pts.push([px(phi, 1.0), cy - fh * (0.5 - (0.36 * phi * phi) / 1.7)]);
  }
  return pts;
}

function drawHair(ctx, look, cx, cy, fw, fh, yaw, px, vis) {
  const hair = look.hair;
  const dark = mix(hair, 0.72);
  const top = cy - fh * 1.06;
  const s = Math.sin(yaw);
  const cap = (extra = 6, hlFrom = -1.3, hlTo = 1.3) => {
    ctx.beginPath();
    ctx.moveTo(cx - fw - extra, cy - fh * 0.05);
    ctx.bezierCurveTo(cx - fw - extra * 1.6, top - extra * 2.2, cx + fw + extra * 1.6, top - extra * 2.2, cx + fw + extra, cy - fh * 0.05);
    const pts = hairline(px, cy, fh, hlTo, hlFrom);
    for (const [x, y] of pts) ctx.lineTo(Math.max(cx - fw - extra, Math.min(cx + fw + extra, x)), y);
    ctx.closePath();
  };
  switch (look.style) {
    case 'receding': {
      // pelada con pelo a los costados
      for (const side of [-1, 1]) {
        if (vis(side * 1.4) < -0.5) continue;
        ctx.beginPath();
        const x = px(side * 1.35, 1.0);
        ctx.moveTo(x, cy - fh * 0.45);
        ctx.quadraticCurveTo(x - side * 14, cy - fh * 0.1, x - side * 2, cy + fh * 0.12);
        ctx.quadraticCurveTo(x + side * 10, cy - fh * 0.15, x, cy - fh * 0.45);
        fillStroke(ctx, hair, INK, 2.5);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ellipse(ctx, cx - 18 + s * 10, top + 26, 22, 10, -0.2);
      ctx.fill();
      return;
    }
    case 'buzz': {
      cap(2, -1.35, 1.35);
      ctx.globalAlpha = 0.85;
      fillStroke(ctx, hair, INK, 3);
      ctx.globalAlpha = 1;
      return;
    }
    case 'curly': {
      cap(10);
      fillStroke(ctx, hair, null);
      for (let i = 0; i < 16; i++) {
        const a = Math.PI * (1.02 + (i / 15) * 0.96);
        ellipse(ctx, cx + Math.cos(a) * (fw + 4), cy - fh * 0.22 + Math.sin(a) * fh * 0.86, 17, 15);
        fillStroke(ctx, hair, dark, 2);
      }
      return;
    }
    case 'boina': {
      cap(4, -1.35, 1.35);
      fillStroke(ctx, hair, INK, 3);
      ctx.beginPath();
      ctx.ellipse(cx + s * 12, top + 22, fw + 22, 30, -0.06, 0, Math.PI * 2);
      fillStroke(ctx, '#2b2f3a', INK, 3);
      ctx.beginPath();
      ctx.ellipse(cx + s * 12, top + 34, fw + 16, 10, -0.06, 0, Math.PI);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 3;
      ctx.stroke();
      return;
    }
    case 'cap': {
      cap(4, -1.35, 1.35);
      fillStroke(ctx, hair, INK, 3);
      const col = mix(look.cloth2, 1.05);
      ctx.beginPath();
      ctx.moveTo(cx - fw - 6, cy - fh * 0.42);
      ctx.bezierCurveTo(cx - fw - 6, top - 26, cx + fw + 6, top - 26, cx + fw + 6, cy - fh * 0.42);
      ctx.closePath();
      fillStroke(ctx, col, INK, 3);
      // visera hacia adelante de la cabeza
      const vx = px(0, 1.0);
      ctx.beginPath();
      ctx.ellipse(vx + s * 18, cy - fh * 0.42, fw * (0.55 + 0.45 * Math.cos(yaw)) + 6, 13, 0, 0, Math.PI);
      fillStroke(ctx, mix(look.cloth2, 0.8), INK, 3);
      return;
    }
    case 'long':
    case 'bun':
    case 'swept':
    case 'short':
    default: {
      cap(look.style === 'swept' ? 9 : 6);
      fillStroke(ctx, hair, INK, 3);
      // mechones
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2.5;
      const part = px(look.style === 'swept' ? -0.5 : -0.25, 1.0);
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(part + (i - 2) * 4, top + 6);
        ctx.quadraticCurveTo(part + (i - 1) * 14, top + 30, part + (i - 1) * 22 + s * 10, cy - fh * 0.48);
        ctx.stroke();
      }
      if (look.style === 'bun') {
        ellipse(ctx, cx - s * 40, top - 8, 26, 22);
        fillStroke(ctx, hair, INK, 3);
      }
      if (look.style === 'long') {
        // mechones que caen al costado de la cara
        for (const side of [-1, 1]) {
          if (vis(side * 1.2) < -0.2) continue;
          const x = px(side * 1.15, 1.02);
          ctx.beginPath();
          ctx.moveTo(x - side * 4, cy - fh * 0.3);
          ctx.quadraticCurveTo(x + side * 10, cy + fh * 0.4, x + side * 4, cy + fh * 0.95);
          ctx.lineTo(x + side * 18, cy + fh * 0.9);
          ctx.quadraticCurveTo(x + side * 22, cy, x + side * 12, cy - fh * 0.4);
          ctx.closePath();
          fillStroke(ctx, hair, INK, 2.5);
        }
      }
    }
  }
}

function drawLongHairBack(ctx, look, cx, cy, yaw) {
  const fw = look.fw;
  const fh = look.fh;
  ctx.beginPath();
  ctx.moveTo(cx - fw - 14, cy - fh * 0.3);
  ctx.bezierCurveTo(cx - fw - 30, cy + fh * 0.8, cx - fw - 20, cy + fh * 1.5, cx - fw + 10, cy + fh * 1.65);
  ctx.lineTo(cx + fw - 10, cy + fh * 1.65);
  ctx.bezierCurveTo(cx + fw + 20, cy + fh * 1.5, cx + fw + 30, cy + fh * 0.8, cx + fw + 14, cy - fh * 0.3);
  ctx.closePath();
  fillStroke(ctx, mix(look.hair, 0.85), INK, 3);
  void yaw;
}

// ------------------------------------------------------------------ brazos, manos y cartas
function drawArms(ctx, look, bx, yaw, cards) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const sw = 148 * (0.66 + 0.34 * c);
  const cloth = look.shirt === 'jacket' ? look.cloth2 : look.cloth;
  const [skin] = look.skin;
  const handY = 640;
  const hcx = bx + s * 40; // las manos van hacia adelante del cuerpo
  const hands = cards > 0 ? [hcx - 34, hcx + 30] : [hcx - 40, hcx + 40];

  // mangas: del hombro al codo y del codo a la mano
  [-1, 1].forEach((side, i) => {
    const shX = bx + side * (sw - 8);
    const elX = bx + side * (sw + 6) + s * 20;
    const elY = 560;
    const hx = hands[i];
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(shX, 410);
    ctx.quadraticCurveTo(elX, elY - 40, elX, elY);
    ctx.quadraticCurveTo(elX - side * 10, handY + 4, hx + side * 14, handY);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 56;
    ctx.stroke();
    ctx.strokeStyle = side < 0 ? mix(cloth, 1.02) : mix(cloth, 0.84);
    ctx.lineWidth = 50;
    ctx.stroke();
    // puño
    ctx.beginPath();
    ctx.moveTo(hx + side * 30, handY - 18);
    ctx.lineTo(hx + side * 24, handY + 22);
    ctx.strokeStyle = mix(cloth, 0.65);
    ctx.lineWidth = 4;
    ctx.stroke();
  });

  if (cards > 0) {
    // abanico de cartas (dorso) sostenido con las dos manos
    const n = Math.min(3, cards);
    for (let i = 0; i < n; i++) {
      const ang = (i - (n - 1) / 2) * 0.22 + s * 0.15;
      ctx.save();
      ctx.translate(hcx, handY + 8);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.roundRect(-30, -104, 60 * (0.6 + 0.4 * c), 94, 6);
      fillStroke(ctx, '#f7f5ef', '#5a5650', 2);
      ctx.beginPath();
      ctx.roundRect(-25, -99, 60 * (0.6 + 0.4 * c) - 10, 84, 4);
      ctx.fillStyle = '#273064';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      for (let k = -96; k < -16; k += 7) {
        ctx.beginPath();
        ctx.moveTo(-24, k);
        ctx.lineTo(60 * (0.6 + 0.4 * c) - 36, k + 7);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  // manos
  hands.forEach((hx, i) => {
    const side = i === 0 ? -1 : 1;
    ctx.beginPath();
    ctx.ellipse(hx, handY + 4, 22, 18, side * 0.4, 0, Math.PI * 2);
    fillStroke(ctx, skin, INK, 3);
    // dedos
    ctx.strokeStyle = 'rgba(70,40,30,0.45)';
    ctx.lineWidth = 1.6;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(hx - side * 6 + k * 7, handY - 6);
      ctx.lineTo(hx - side * 10 + k * 7, handY + 10);
      ctx.stroke();
    }
  });
}
