// Personajes 2D ilustrados que viven dentro de la escena 3D.
// Estilo: ilustración plana de tinta y sepia. Dos tonos por superficie con sombras de borde duro, pliegues
// como cuñas afiladas, proporciones adultas, ojos de párpado pesado y un grano de papel encima. Sin degradados.
// Se dibujan en un canvas según hacia dónde está girado el cuerpo y la cabeza respecto de quien mira,
// hacia dónde mira y qué cara pone (señas y hablar).
// No parpadean solos: los ojos cerrados son SOLO la seña "ciego", para que no se confunda.
import { INK, PALETTE, FACE, OUTFIT, COSMETIC_LOOK, mix, AVATAR_COLORS, AVATAR_GRAY, FLAG_LOOK } from './theme.js';
import { SENA_BITE_MS, cleanLook } from './config.js';

export const W = 512;
export const H = 1200;

// Seña del tres: el labio entra y sale de los dientes (0 = suelto, 1 = mordido), un ciclo cada SENA_BITE_MS.
export const biteAt = (ms) => Math.min(1, (0.5 - 0.5 * Math.cos(((ms % SENA_BITE_MS) / SENA_BITE_MS) * Math.PI * 2)) * 1.35);
const WAIST = 730; // cintura (el resto es cadera, piernas y zapatos, sentado)
const TOP = 352; // base del cuello
const SHOULDER = 172; // mitad del ancho de hombros, de frente
const HAND_Y = 640;

const STYLES = ['short', 'swept', 'wavy', 'wavy', 'long', 'bun', 'receding', 'curly', 'boina', 'cap', 'buzz', 'sombrero'];
const SHIRTS = ['button', 'vest', 'vest', 'gaucho', 'gaucho', 'sweater', 'tee', 'jacket', 'polo'];
const ROLLED = new Set(['button', 'vest', 'gaucho']); // camisas con las mangas arremangadas

function hash(str) {
  let h = 2166136261;
  for (const ch of String(str)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

// El personaje con lo que tiene puesto de la tienda (cos = { ropa, gorro, anteojos }). cos.look: el personaje que
// armó en el creador (va primero; la ropa de la tienda, encima).
export function dressed(look, cos) {
  const c = cos?.look && !look.custom ? cleanLook(cos.look) : null;
  const out = c ? applyLook(look, c) : { ...look };
  for (const id of [cos?.ropa, cos?.gorro, cos?.anteojos]) if (COSMETIC_LOOK[id]) Object.assign(out, COSMETIC_LOOK[id]);
  return out;
}

// De qué color es la manga (para las manos en primera persona).
export function sleeveOf(look) {
  if (ROLLED.has(look.shirt)) return look.under || OUTFIT.shirtUnder;
  return look.shirt === 'jacket' ? look.cloth2 : look.cloth;
}

// custom: el personaje que eligió la persona en el creador (profiles.look). Lo que no eligió sale de su nombre.
export function lookFor(name, seat, custom = null) {
  const base = randomFor(name, seat);
  const c = custom ? cleanLook(custom) : null;
  return c ? applyLook(base, c) : base;
}

/** El personaje elegido (cleanLook) aplicado sobre uno armado al azar. */
export function applyLook(base, c) {
  const soft = c.soft;
  return {
    ...base,
    skin: AVATAR_COLORS.skins[c.skin] || base.skin,
    hair: AVATAR_COLORS.hairs[c.hair] || base.hair,
    old: AVATAR_GRAY.includes(c.hair),
    style: c.style,
    shirt: c.shirt,
    cloth: AVATAR_COLORS.clothes[c.cloth] || base.cloth,
    cloth2: AVATAR_COLORS.clothes[c.cloth2] || base.cloth2,
    vest: mix(AVATAR_COLORS.clothes[c.cloth2] || base.vest, 0.6),
    poncho: mix(AVATAR_COLORS.clothes[c.cloth2] || base.poncho, 0.7),
    beard: !soft && c.beard === 'beard',
    stubble: !soft && c.beard === 'stubble',
    mustache: !soft && c.mustache,
    glasses: c.glasses,
    soft,
    flag: c.flag !== 'none' ? c.flag : null,
    fw: c.fw ?? base.fw,
    fh: c.fh ?? base.fh,
    jaw: c.jaw ?? base.jaw,
    scowl: c.scowl ?? base.scowl,
    custom: true,
  };
}

function randomFor(name, seat) {
  const h = hash(String(name).replace(/\s*\(bot\)$/i, '') + '#' + seat);
  const pick = (arr, k) => arr[(h >>> k) % arr.length];
  const style = pick(STYLES, 11);
  const old = (h >>> 25) % 4 === 0 || style === 'receding';
  const soft = style === 'long' || style === 'bun'; // pelo largo: rasgos más finos y sin barba
  return {
    skin: pick(PALETTE.skins, 0),
    hair: old ? pick(PALETTE.grayHairs, 3) : pick(PALETTE.hairs, 3),
    cloth: pick(PALETTE.clothes, 7),
    cloth2: pick(PALETTE.clothes, 9),
    vest: pick(PALETTE.vests, 5),
    poncho: pick(PALETTE.ponchos, 6),
    accent: pick(PALETTE.accents, 8),
    under: pick(PALETTE.unders, 10),
    shirt: pick(SHIRTS, 13),
    style,
    beard: !soft && (h >>> 15) % 5 === 0,
    stubble: !soft && (h >>> 16) % 4 === 0,
    mustache: !soft && (h >>> 17) % 4 === 0,
    glasses: (h >>> 19) % 6 === 0,
    old,
    soft,
    seed: h % 9973,
    scowl: 1 + ((h >>> 22) % 6), // cuánto baja la ceja hacia el centro: el gesto de cada uno
    fw: 57 + ((h >>> 21) % 7),
    fh: 80 + ((h >>> 24) % 8),
    jaw: (soft ? 0.56 : 0.66) + ((h >>> 27) % 4) * 0.045,
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Azar fijo por personaje: el mismo mechón siempre cae en el mismo lugar.
function rnd(look, k) {
  const x = Math.sin((look.seed ?? 7) * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// ------------------------------------------------------------------ pinceles
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

// Pinta una forma: relleno plano, sombras recortadas adentro y contorno por encima.
function paint(ctx, path, fill, shade, lw = 3) {
  path();
  ctx.fillStyle = fill;
  ctx.fill();
  if (shade) {
    ctx.save();
    path();
    ctx.clip();
    shade();
    ctx.restore();
  }
  if (lw) {
    path();
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

// Trazo afilado: ancho en la raíz y punta fina. Los pliegues y mechones salen de acá.
function wedge(ctx, x0, y0, cx, cy, x1, y1, w, color) {
  const dx = cx - x0;
  const dy = cy - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * w * 0.5;
  const ny = (dx / len) * w * 0.5;
  ctx.beginPath();
  ctx.moveTo(x0 + nx, y0 + ny);
  ctx.quadraticCurveTo(cx + nx * 0.6, cy + ny * 0.6, x1, y1);
  ctx.quadraticCurveTo(cx - nx * 0.6, cy - ny * 0.6, x0 - nx, y0 - ny);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function qPoints(p0, c, p1, n = 12) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
  }
  return out;
}

// Contorno de un tubo que se afina de w0 a w1 a lo largo de los puntos (brazos).
// round: arranca como una cúpula en vez de un corte recto (el hombro).
function tube(ctx, pts, w0, w1, round = false) {
  const left = [];
  const right = [];
  const dome = [0.2, 0.68, 0.9, 0.98];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const w = ((w0 + ((w1 - w0) * i) / (pts.length - 1)) / 2) * (round && i < dome.length ? dome[i] : 1);
    const nx = (-(b[1] - a[1]) / len) * w;
    const ny = ((b[0] - a[0]) / len) * w;
    left.push([p[0] + nx, p[1] + ny]);
    right.push([p[0] - nx, p[1] - ny]);
  });
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (const p of left) ctx.lineTo(p[0], p[1]);
  for (const p of right.reverse()) ctx.lineTo(p[0], p[1]);
  ctx.closePath();
}

// Grano de papel: una trama fija que se aplica solo sobre lo dibujado.
let grainCanvas = null;
function grainFor(ctx) {
  if (!grainCanvas) {
    const doc = ctx.canvas?.ownerDocument;
    if (!doc) return null;
    grainCanvas = doc.createElement('canvas');
    grainCanvas.width = grainCanvas.height = 160;
    const g = grainCanvas.getContext('2d');
    let seed = 91;
    const r = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 2600; i++) {
      const light = r() < 0.4;
      g.fillStyle = light ? `rgba(245,225,190,${0.015 + r() * 0.035})` : `rgba(18,9,4,${0.02 + r() * 0.05})`;
      g.fillRect(r() * 160, r() * 160, 1 + r() * 1.6, 1 + r() * 1.2);
    }
  }
  return ctx.createPattern(grainCanvas, 'repeat');
}

// state:
//  bodyYaw / headYaw: radianes, 0 = de frente a quien mira, >0 = girado hacia la derecha de la imagen
//  down: 0..1 cuánto mira hacia abajo (la mesa)
//  expr, talking, cards
//  bite: 0..1 para animar la seña del tres (por defecto, mordido del todo)
export function drawCharacter(ctx, look, state) {
  const { expr = 'neutral', talking = false, cards = 0, bite = 1 } = state;
  const bodyYaw = clamp(state.bodyYaw || 0, -1.3, 1.3);
  const headYaw = clamp(state.headYaw ?? bodyYaw, -1.35, 1.35);
  const down = clamp(state.down || 0, 0, 1);
  ctx.clearRect(0, 0, W, H);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const bx = 256 + Math.sin(bodyYaw) * 8;
  const hx = bx + Math.sin(headYaw) * 6;
  const hy = 214 + down * 10;

  if (look.style === 'long') drawLongHairBack(ctx, look, hx, hy);
  drawLegs(ctx, look, bx, bodyYaw);
  drawTorso(ctx, look, bx, bodyYaw);
  drawNeck(ctx, look, bx, hx, hy);
  drawCollarOver(ctx, look, bx, bodyYaw);
  if (look.flag) drawFlagPin(ctx, look.flag, bx, bodyYaw);
  drawHead(ctx, look, hx, hy, headYaw, down, expr, talking, bite);
  drawArms(ctx, look, bx, bodyYaw, cards);
  if (look.shirt === 'gaucho') drawPoncho(ctx, look, bx, bodyYaw);

  const grain = grainFor(ctx);
  if (grain) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// Pin con la bandera (la nacionalidad que eligió), del lado izquierdo del pecho.
export function drawFlag(ctx, id, x, y, w, h) {
  const f = FLAG_LOOK[id];
  if (!f) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (f.v) f.v.forEach((col, i) => ((ctx.fillStyle = col), ctx.fillRect(x + (w * i) / f.v.length, y, w / f.v.length + 0.5, h)));
  else f.h.forEach((col, i) => ((ctx.fillStyle = col), ctx.fillRect(x, y + (h * i) / f.h.length, w, h / f.h.length + 0.5)));
  if (f.canton) {
    ctx.fillStyle = f.canton[0];
    ctx.fillRect(x, y, w * f.canton[1], h * f.canton[2]);
  }
  if (f.diamond) {
    ctx.fillStyle = f.diamond;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + h * 0.12);
    ctx.lineTo(x + w * 0.9, y + h / 2);
    ctx.lineTo(x + w / 2, y + h * 0.88);
    ctx.lineTo(x + w * 0.1, y + h / 2);
    ctx.fill();
  }
  if (f.cross) {
    ctx.strokeStyle = f.cross[0];
    ctx.lineWidth = h * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y + h);
    ctx.moveTo(x + w, y);
    ctx.lineTo(x, y + h);
    ctx.stroke();
    ctx.fillStyle = f.cross[0];
    ctx.fillRect(x + w * 0.4, y, w * 0.2, h);
    ctx.fillRect(x, y + h * 0.35, w, h * 0.3);
    ctx.fillStyle = f.cross[1];
    ctx.fillRect(x + w * 0.45, y, w * 0.1, h);
    ctx.fillRect(x, y + h * 0.42, w, h * 0.16);
  }
  if (f.sun) {
    const cx = f.canton ? x + (w * f.canton[1]) / 2 : x + w / 2;
    const cy = f.canton ? y + (h * f.canton[2]) / 2 : y + h / 2;
    ctx.fillStyle = f.sun;
    ctx.beginPath();
    ctx.arc(cx, cy, h * (f.canton ? 0.16 : 0.2), 0, Math.PI * 2);
    ctx.fill();
  }
  if (f.star) {
    ctx.fillStyle = f.star;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? h * 0.1 : h * 0.24;
      ctx.lineTo(x + w * 0.22 + Math.cos(a) * rr, y + h * 0.3 + Math.sin(a) * rr);
    }
    ctx.fill();
  }
  ctx.restore();
}

function drawFlagPin(ctx, id, bx, yaw) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const w = 44 * Math.max(0.35, c);
  const h = 30;
  const x = bx + s * 34 - shoulderW(c) * 0.5 - w / 2;
  const y = TOP + 70;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(-0.06);
  ctx.translate(-(x + w / 2), -(y + h / 2));
  // sombrita del pin sobre la ropa
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + 3, y + 4, w, h);
  drawFlag(ctx, id, x, y, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  // brillo del esmalte
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(x + 3, y + 3, w - 6, 5);
  ctx.restore();
}

// ------------------------------------------------------------------ cuerpo
const shoulderW = (c) => SHOULDER * (0.66 + 0.34 * c);

function torsoPath(ctx, bx, sw) {
  ctx.beginPath();
  ctx.moveTo(bx - 32, TOP - 14);
  ctx.bezierCurveTo(bx - 62, TOP + 2, bx - sw + 34, TOP + 8, bx - sw + 6, TOP + 36);
  ctx.quadraticCurveTo(bx - sw + 2, TOP + 180, bx - sw * 0.68, WAIST);
  ctx.quadraticCurveTo(bx, WAIST + 14, bx + sw * 0.68, WAIST);
  ctx.quadraticCurveTo(bx + sw - 2, TOP + 180, bx + sw - 6, TOP + 36);
  ctx.bezierCurveTo(bx + sw - 34, TOP + 8, bx + 62, TOP + 2, bx + 32, TOP - 14);
  ctx.closePath();
}

// Sombra del lado derecho de la imagen y de la mesa, con borde duro.
function bodyShade(ctx, bx, sw, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(bx + sw * 0.34, TOP - 20);
  ctx.bezierCurveTo(bx + sw * 0.5, TOP + 130, bx + sw * 0.26, TOP + 250, bx + sw * 0.5, WAIST + 20);
  ctx.lineTo(bx + sw + 30, WAIST + 20);
  ctx.lineTo(bx + sw + 30, TOP - 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(bx - sw - 30, 662, sw * 2 + 60, WAIST - 640);
}

function folds(ctx, bx, sw, color) {
  wedge(ctx, bx - sw + 34, TOP + 96, bx - sw + 64, TOP + 150, bx - sw + 40, TOP + 214, 11, color);
  wedge(ctx, bx + sw - 40, TOP + 110, bx + sw - 66, TOP + 164, bx + sw - 44, TOP + 226, 10, color);
  wedge(ctx, bx - 74, TOP + 216, bx - 40, TOP + 234, bx - 12, TOP + 226, 8, color);
}

function collar(ctx, mid, c, color, shade) {
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(mid + side * 2, TOP + 26);
    ctx.lineTo(mid + side * 34, TOP - 22);
    ctx.lineTo(mid + side * 58 * (0.76 + 0.24 * c), TOP + 8);
    ctx.lineTo(mid + side * 28, TOP + 48);
    ctx.closePath();
    fillStroke(ctx, side > 0 ? shade : color, INK, 2.6);
  }
}

function drawTorso(ctx, look, bx, yaw) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const sw = shoulderW(c);
  const mid = bx + s * 34; // línea central del pecho (se corre al girar)
  const under = look.under || OUTFIT.shirtUnder;
  const base = ROLLED.has(look.shirt) ? under : look.shirt === 'jacket' ? look.cloth2 : look.cloth;
  const shade = mix(base, 0.74);
  const fold = mix(base, 0.56);

  paint(ctx, () => torsoPath(ctx, bx, sw), base, () => bodyShade(ctx, bx, sw, shade), 3.4);
  ctx.save();
  torsoPath(ctx, bx, sw);
  ctx.clip();
  folds(ctx, bx, sw, fold);
  ctx.restore();

  switch (look.shirt) {
    case 'vest': {
      const v = look.vest || OUTFIT.hat;
      const vShade = mix(v, 0.7);
      const vest = () => {
        ctx.beginPath();
        ctx.moveTo(mid - 44, TOP - 6);
        ctx.lineTo(bx - sw * 0.68, TOP + 30);
        ctx.quadraticCurveTo(bx - sw * 0.54, TOP + 100, bx - sw * 0.66, TOP + 190);
        ctx.lineTo(bx - sw * 0.69, WAIST);
        ctx.quadraticCurveTo(bx, WAIST + 14, bx + sw * 0.69, WAIST);
        ctx.lineTo(bx + sw * 0.66, TOP + 190);
        ctx.quadraticCurveTo(bx + sw * 0.54, TOP + 100, bx + sw * 0.68, TOP + 30);
        ctx.lineTo(mid + 44, TOP - 6);
        ctx.lineTo(mid + 2, TOP + 200);
        ctx.closePath();
      };
      // la corbata va debajo del chaleco
      paint(ctx, vest, v, () => {
        ctx.fillStyle = vShade;
        ctx.beginPath();
        ctx.moveTo(mid + 2, TOP + 200);
        ctx.lineTo(mid + 60, TOP - 6);
        ctx.lineTo(bx + sw, TOP);
        ctx.lineTo(bx + sw, WAIST + 20);
        ctx.lineTo(mid + 2, WAIST + 20);
        ctx.closePath();
        ctx.fill();
        wedge(ctx, bx - sw * 0.5, TOP + 120, mid - 40, TOP + 190, mid - 6, TOP + 214, 8, mix(v, 1.7));
      }, 3.2);
      ctx.fillStyle = mix(v, 1.9);
      for (let y = TOP + 232; y < 640; y += 44) {
        ellipse(ctx, mid + 2 + s * 4, y, 4.2, 4.2);
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      break;
    }
    case 'gaucho':
    case 'button':
    case 'polo': {
      const end = look.shirt === 'polo' ? TOP + 92 : 640;
      ctx.strokeStyle = mix(base, 0.5);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(mid - 8, TOP + 40);
      ctx.lineTo(mid - 8 + s * 6, end);
      ctx.moveTo(mid + 10, TOP + 40);
      ctx.lineTo(mid + 10 + s * 6, end);
      ctx.stroke();
      ctx.fillStyle = mix(base, 0.5);
      for (let y = TOP + 62; y < end; y += 46) {
        ellipse(ctx, mid + 1 + s * 5, y, 3.4, 3.4);
        ctx.fill();
      }
      break;
    }
    case 'jacket': {
      const shirt = look.cloth?.startsWith('#') ? look.cloth : OUTFIT.shirtUnder;
      const v = () => {
        ctx.beginPath();
        ctx.moveTo(mid - 36, TOP - 8);
        ctx.lineTo(mid + 36, TOP - 8);
        ctx.lineTo(mid + 4, TOP + 186);
        ctx.closePath();
      };
      paint(ctx, v, shirt, null, 2.6);
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(mid + side * 36, TOP - 12);
        ctx.lineTo(mid + side * 84 * (0.75 + 0.25 * c), TOP + 40);
        ctx.lineTo(mid + side * 44, TOP + 76);
        ctx.lineTo(mid + side * 4, TOP + 188);
        ctx.closePath();
        fillStroke(ctx, side > 0 ? mix(base, 0.62) : mix(base, 1.5), INK, 2.6);
      }
      break;
    }
    case 'sweater': {
      ctx.beginPath();
      ctx.ellipse(mid, TOP + 2, 46, 18, 0, 0.05 * Math.PI, 0.95 * Math.PI);
      ctx.lineWidth = 10;
      ctx.strokeStyle = mix(base, 0.64);
      ctx.stroke();
      ctx.strokeStyle = mix(base, 0.6);
      ctx.lineWidth = 2.4;
      for (let x = -sw * 0.7; x < sw * 0.7; x += 15) {
        ctx.beginPath();
        ctx.moveTo(bx + x, 590);
        ctx.lineTo(bx + x, WAIST);
        ctx.stroke();
      }
      break;
    }
    default: {
      ctx.beginPath();
      ctx.ellipse(mid, TOP + 2, 42, 16, 0, 0.05 * Math.PI, 0.95 * Math.PI);
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
  }

  if (look.shirt === 'gaucho') {
    // rastra: cinto oscuro con la hebilla labrada, a la altura de las manos
    const by = 618;
    const bw = sw * 0.86;
    ctx.fillStyle = OUTFIT.belt;
    ctx.fillRect(bx - bw, by - 12, bw * 2, 24);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.strokeRect(bx - bw, by - 12, bw * 2, 24);
    const bk = mid + 2;
    ellipse(ctx, bk, by, 42, 25);
    fillStroke(ctx, OUTFIT.buckle, INK, 3);
    ellipse(ctx, bk, by, 31, 16);
    fillStroke(ctx, OUTFIT.buckleDark, null);
    ellipse(ctx, bk, by, 14, 7);
    fillStroke(ctx, OUTFIT.buckle, null);
  }
}

// Lo que va entre el cuello y la cabeza: cuello de camisa, corbata y pañuelo.
function drawCollarOver(ctx, look, bx, yaw) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const mid = bx + s * 34;
  const under = look.under || OUTFIT.shirtUnder;
  if (look.shirt === 'vest') {
    const tie = look.accent || OUTFIT.hatBand;
    const dark = tie === '#1d1512' ? tie : mix(tie, 0.72);
    ctx.beginPath();
    ctx.moveTo(mid - 13, TOP + 22);
    ctx.lineTo(mid - 25, TOP + 150);
    ctx.lineTo(mid + 1, TOP + 196);
    ctx.lineTo(mid + 27, TOP + 150);
    ctx.lineTo(mid + 13, TOP + 22);
    ctx.closePath();
    fillStroke(ctx, tie, INK, 2.6);
    wedge(ctx, mid + 10, TOP + 46, mid + 20, TOP + 112, mid + 3, TOP + 188, 16, dark);
    ctx.beginPath();
    ctx.moveTo(mid - 19, TOP - 2);
    ctx.lineTo(mid + 19, TOP - 2);
    ctx.lineTo(mid + 13, TOP + 26);
    ctx.lineTo(mid - 13, TOP + 26);
    ctx.closePath();
    fillStroke(ctx, tie, INK, 2.6);
    collar(ctx, mid, c, under, mix(under, 0.76));
  } else if (look.shirt === 'button' || look.shirt === 'polo') {
    const col = look.shirt === 'polo' ? mix(look.cloth, 1.2) : under;
    collar(ctx, mid, c, col, look.shirt === 'polo' ? mix(look.cloth, 0.8) : mix(under, 0.76));
  } else if (look.shirt === 'gaucho') {
    drawKerchief(ctx, look, mid);
  }
}

function drawKerchief(ctx, look, mid) {
  const k = look.accent === '#1d1512' ? '#74231f' : look.accent || '#74231f';
  const dark = mix(k, 0.64);
  // la vuelta alrededor del cuello
  const wrap = () => {
    ctx.beginPath();
    ctx.moveTo(mid - 74, TOP - 4);
    ctx.quadraticCurveTo(mid - 44, TOP - 26, mid - 28, TOP - 32);
    ctx.quadraticCurveTo(mid, TOP - 16, mid + 28, TOP - 32);
    ctx.quadraticCurveTo(mid + 44, TOP - 26, mid + 74, TOP - 4);
    ctx.quadraticCurveTo(mid + 32, TOP + 30, mid, TOP + 56);
    ctx.quadraticCurveTo(mid - 32, TOP + 30, mid - 74, TOP - 4);
    ctx.closePath();
  };
  paint(ctx, wrap, k, () => {
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(mid + 4, TOP - 40);
    ctx.lineTo(mid + 90, TOP - 40);
    ctx.lineTo(mid + 90, TOP + 70);
    ctx.lineTo(mid + 2, TOP + 70);
    ctx.closePath();
    ctx.fill();
  }, 3);
  // las dos puntas
  const tail = (d, len) => () => {
    ctx.beginPath();
    ctx.moveTo(mid + d * 8, TOP + 56);
    ctx.lineTo(mid + d * 62, TOP + len - 34);
    ctx.lineTo(mid + d * 44, TOP + len);
    ctx.lineTo(mid + d * 4, TOP + 68);
    ctx.closePath();
  };
  paint(ctx, tail(-1, 158), k, () => wedge(ctx, mid - 12, TOP + 66, mid - 34, TOP + 110, mid - 44, TOP + 150, 11, dark), 3);
  paint(ctx, tail(1, 146), dark, null, 3);
  // el nudo
  ellipse(ctx, mid, TOP + 56, 19, 15);
  fillStroke(ctx, dark, INK, 3);
  wedge(ctx, mid - 12, TOP + 52, mid, TOP + 46, mid + 10, TOP + 54, 5, k);
}

// El poncho cruzado sobre un hombro, con la guarda pampa. Va encima del brazo de ese lado.
function drawPoncho(ctx, look, bx, yaw) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const sw = shoulderW(c);
  const col = look.poncho || OUTFIT.hat;
  const mid = bx + s * 34;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(mid + 34, TOP - 2);
    ctx.quadraticCurveTo(mid + 120, TOP - 8, bx + sw + 16, TOP + 46);
    ctx.quadraticCurveTo(bx + sw + 40, TOP + 150, bx + sw + 34, 604);
    ctx.quadraticCurveTo(bx + sw * 0.6, 618, mid + 44, 590);
    ctx.quadraticCurveTo(mid + 18, TOP + 130, mid + 34, TOP - 2);
    ctx.closePath();
  };
  paint(ctx, path, col, () => {
    // guarda: dos líneas y la escalera, paralelas al borde de adentro
    ctx.save();
    ctx.translate(mid + 44, TOP - 8);
    ctx.rotate(Math.atan2(600 - TOP, 14) - Math.PI / 2);
    ctx.fillStyle = OUTFIT.guarda;
    ctx.fillRect(36, -30, 7, 460);
    ctx.fillRect(112, -30, 6, 460);
    const step = 15;
    for (let i = -2; i < 34; i++) {
      const k = ((i % 8) + 8) % 8;
      const off = k < 4 ? k : 8 - k;
      ctx.fillRect(58 + off * step * 0.62, i * step, 28, step + 0.5);
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(8,4,2,0.34)';
    ctx.beginPath();
    ctx.moveTo(bx + sw + 60, TOP);
    ctx.quadraticCurveTo(bx + sw * 0.62, TOP + 150, bx + sw * 0.86, 680);
    ctx.lineTo(bx + sw + 60, 680);
    ctx.closePath();
    ctx.fill();
  }, 3.4);
}

function drawNeck(ctx, look, bx, hx, hy) {
  const [skin, skinD] = look.skin;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(hx - 27, hy + 48);
    ctx.lineTo(bx - 32, TOP + 6);
    ctx.quadraticCurveTo(bx, TOP + 26, bx + 32, TOP + 6);
    ctx.lineTo(hx + 27, hy + 48);
    ctx.closePath();
  };
  paint(ctx, path, skin, () => {
    // la mandíbula proyecta una sombra dura y oscura sobre el cuello
    ctx.fillStyle = mix(skinD, 0.66);
    ctx.beginPath();
    ctx.moveTo(hx - 40, hy + 40);
    ctx.lineTo(hx + 40, hy + 40);
    ctx.lineTo(hx + 40, hy + 112);
    ctx.quadraticCurveTo(hx + 6, hy + 112, hx - 26, hy + 92);
    ctx.closePath();
    ctx.fill();
  }, 3);
}

// Sentado: cadera, muslos que vienen hacia adelante (hacia la mesa), piernas y zapatos.
function drawLegs(ctx, look, bx, yaw) {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  const pants = PALETTE.pants[(look.fw + look.fh) % PALETTE.pants.length];
  const pantsD = mix(pants, 0.72);
  const hipW = 118 * (0.7 + 0.3 * c);
  const kneeY = 880;
  const ankleY = 1135;
  ctx.beginPath();
  ctx.moveTo(bx - hipW, WAIST - 12);
  ctx.lineTo(bx + hipW, WAIST - 12);
  ctx.quadraticCurveTo(bx + hipW + 10, 800, bx + hipW - 6, 830);
  ctx.lineTo(bx - hipW + 6, 830);
  ctx.quadraticCurveTo(bx - hipW - 10, 800, bx - hipW, WAIST - 12);
  fillStroke(ctx, pants, INK, 3);
  for (const side of [-1, 1]) {
    const hx = bx + side * hipW * 0.5;
    const kx = bx + side * 62 * (0.6 + 0.4 * c) + s * 46;
    ctx.beginPath();
    ctx.moveTo(hx - 46, 800);
    ctx.quadraticCurveTo(kx - 56, 840, kx - 44, kneeY + 10);
    ctx.quadraticCurveTo(kx, kneeY + 34, kx + 44, kneeY + 10);
    ctx.quadraticCurveTo(kx + 56, 840, hx + 46, 800);
    ctx.closePath();
    fillStroke(ctx, side < 0 ? pants : pantsD, INK, 3);
    const ax = kx + s * 10 + side * 4;
    ctx.beginPath();
    ctx.moveTo(kx - 36, kneeY + 14);
    ctx.lineTo(ax - 28, ankleY);
    ctx.lineTo(ax + 28, ankleY);
    ctx.lineTo(kx + 36, kneeY + 14);
    ctx.closePath();
    fillStroke(ctx, side < 0 ? mix(pants, 0.88) : mix(pants, 0.66), INK, 3);
    ctx.beginPath();
    ctx.moveTo(ax - 32, ankleY - 4);
    ctx.quadraticCurveTo(ax - 40 + s * 30, ankleY + 50, ax + s * 34, ankleY + 54);
    ctx.quadraticCurveTo(ax + 44 + s * 30, ankleY + 50, ax + 32, ankleY - 4);
    ctx.closePath();
    fillStroke(ctx, OUTFIT.shoe, INK, 3);
  }
}

// ------------------------------------------------------------------ cabeza
function drawHead(ctx, look, cx, cy, yaw, down, expr, talking, bite) {
  const [skin, skinD] = look.skin;
  const fw = look.fw;
  const fh = look.fh;
  const s = Math.sin(yaw);
  // proyección de un punto de la cara que está a "phi" radianes del centro
  const px = (phi, r = 0.96) => cx + fw * r * Math.sin(phi + yaw);
  const vis = (phi) => Math.cos(phi + yaw);
  const puff = expr === 'puff';
  const chinX = cx + s * fw * 0.3;
  const jaw = look.jaw;
  const cheek = puff ? 1.14 : 1;
  const sh = s * fw * 0.24;

  const ears = [-1.85, 1.85].map((phi) => ({ phi, x: px(phi, 0.98), v: vis(phi) }));
  for (const e of ears) if (e.v <= 0.08 && e.v > -0.4) drawEar(ctx, e.x, cy + 4 - down * 4, look, e.phi * (e.v < 0 ? -1 : 1));

  // cara angulosa: frente ancha, pómulo, ángulo de la mandíbula y mentón
  const face = () => {
    ctx.beginPath();
    ctx.moveTo(cx - fw, cy - fh * 0.34);
    ctx.bezierCurveTo(cx - fw * 0.98, cy - fh * 1.14, cx + fw * 0.98, cy - fh * 1.14, cx + fw, cy - fh * 0.34);
    ctx.lineTo(cx + fw * cheek * 0.97, cy + fh * 0.2);
    ctx.quadraticCurveTo(cx + fw * cheek * 0.92, cy + fh * 0.5, cx + fw * jaw + sh, cy + fh * 0.77);
    ctx.lineTo(chinX + fw * 0.24, cy + fh * 1.0);
    ctx.quadraticCurveTo(chinX, cy + fh * 1.07, chinX - fw * 0.24, cy + fh * 1.0);
    ctx.lineTo(cx - fw * jaw + sh, cy + fh * 0.77);
    ctx.quadraticCurveTo(cx - fw * cheek * 0.92, cy + fh * 0.5, cx - fw * cheek * 0.97, cy + fh * 0.2);
    ctx.closePath();
  };

  paint(ctx, face, skin, () => {
    // lado en sombra, con borde duro que acompaña el pómulo
    const edge = cx + fw * 0.62 + s * fw * 0.3;
    ctx.fillStyle = skinD;
    ctx.beginPath();
    ctx.moveTo(edge + 12, cy - fh * 1.2);
    ctx.quadraticCurveTo(edge - 8, cy - fh * 0.2, edge + 2, cy + fh * 0.16);
    ctx.quadraticCurveTo(edge - 10, cy + fh * 0.6, chinX + fw * 0.05, cy + fh * 1.12);
    ctx.lineTo(cx + fw * 1.4, cy + fh * 1.12);
    ctx.lineTo(cx + fw * 1.4, cy - fh * 1.2);
    ctx.closePath();
    ctx.fill();
    // el pelo proyecta sombra sobre la frente
    if (look.style !== 'receding') {
      ctx.fillStyle = skinD;
      ctx.beginPath();
      ctx.moveTo(cx - fw * 1.1, cy - fh * 0.34);
      for (let i = 0; i <= 8; i++) {
        const phi = -1.4 + (i / 8) * 2.8;
        ctx.lineTo(px(phi, 1.0), cy - fh * (0.34 - (0.24 * phi * phi) / 1.9) + (i % 2 ? 14 : 3));
      }
      ctx.lineTo(cx + fw * 1.1, cy - fh * 1.2);
      ctx.lineTo(cx - fw * 1.1, cy - fh * 1.2);
      ctx.closePath();
      ctx.fill();
    }
    if (look.beard || look.stubble) drawBeard(ctx, look, cx, cy, fw, fh, px);
    if (look.old) {
      for (const phi of [-0.34, 0.34]) {
        if (vis(phi) < 0.2) continue;
        wedge(ctx, px(phi * 0.9, 0.9), cy + fh * 0.26, px(phi * 1.3, 0.9), cy + fh * 0.44, px(phi * 1.2, 0.9), cy + fh * 0.66, 4, mix(skinD, 0.72));
      }
      wedge(ctx, px(-0.34, 0.9), cy - fh * 0.42, px(0, 0.94), cy - fh * 0.47, px(0.36, 0.9), cy - fh * 0.42, 3, mix(skinD, 0.82));
    }
    if (puff) {
      for (const phi of [-0.66, 0.66]) {
        if (vis(phi) < 0.1) continue;
        ellipse(ctx, px(phi, 0.92), cy + fh * 0.34, 25 * vis(phi), 22);
        ctx.fillStyle = mix(skin, 1.04);
        ctx.fill();
        ctx.strokeStyle = mix(skinD, 0.62);
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
  }, 3.4);

  for (const e of ears) if (e.v > 0.08) drawEar(ctx, e.x, cy + 4 - down * 4, look, e.phi);

  const eyeY = cy - fh * 0.04 + down * 8;
  drawEyes(ctx, look, px, vis, eyeY, expr, down, yaw);
  drawNose(ctx, look, px, cy, fh, yaw, expr);
  // el beso va por encima del bigote: si no, la seña del dos no se ve
  const mouth = () => drawMouth(ctx, look, px, vis, cy + fh * 0.63 + down * 4, yaw, expr, talking, bite);
  if (expr !== 'kiss') mouth();
  if (look.mustache || look.beard) drawMustache(ctx, look, px, cy + fh * 0.5 + down * 4, yaw, expr);
  if (expr === 'kiss') mouth();
  if (look.glasses) drawGlasses(ctx, px, vis, eyeY);
  drawHair(ctx, look, cx, cy, fw, fh, yaw, px, vis, skinD);
  // las cejas van encima del pelo: levantarlas es una seña y el flequillo no puede taparla
  drawBrows(ctx, look, px, vis, eyeY, expr, down);
}

function drawBeard(ctx, look, cx, cy, fw, fh, px) {
  const mx = px(0, 0.95);
  ctx.beginPath();
  ctx.moveTo(cx - fw * 1.1, cy + fh * 0.02);
  ctx.lineTo(cx - fw * 0.84, cy + fh * 0.02);
  ctx.lineTo(cx - fw * 0.66, cy + fh * 0.4);
  ctx.quadraticCurveTo(mx - fw * 0.4, cy + fh * 0.52, mx, cy + fh * 0.46);
  ctx.quadraticCurveTo(mx + fw * 0.4, cy + fh * 0.52, cx + fw * 0.66, cy + fh * 0.4);
  ctx.lineTo(cx + fw * 0.84, cy + fh * 0.02);
  ctx.lineTo(cx + fw * 1.1, cy + fh * 0.02);
  ctx.lineTo(cx + fw * 1.1, cy + fh * 1.2);
  ctx.lineTo(cx - fw * 1.1, cy + fh * 1.2);
  ctx.closePath();
  if (look.beard) {
    ctx.fillStyle = look.hair;
    ctx.fill();
    for (let i = 0; i < 7; i++) {
      const a = 0.18 + (i / 6) * 0.64;
      const x = cx - fw * 0.7 + a * fw * 1.4;
      wedge(ctx, x, cy + fh * 0.72, x + 2, cy + fh * 0.88, x - 1, cy + fh * 1.02, 5, mix(look.hair, 1.5));
    }
  } else {
    ctx.fillStyle = mix(look.skin[1], 0.82);
    ctx.globalAlpha = 0.62;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawEar(ctx, x, y, look, phi) {
  const [skin, skinD] = look.skin;
  ellipse(ctx, x, y, 10, 19);
  fillStroke(ctx, skin, INK, 3);
  ctx.strokeStyle = skinD;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x + (phi < 0 ? 2 : -2), y, 5.5, -1.2, 1.2);
  ctx.stroke();
}

function drawEyes(ctx, look, px, vis, y, expr, down, yaw) {
  const sides = [
    { phi: -0.42, left: false }, // ojo derecho del personaje (izquierda de la imagen)
    { phi: 0.42, left: true },
  ];
  for (const e of sides) {
    const v = vis(e.phi);
    if (v < 0.12) continue;
    const x = px(e.phi, 0.92);
    const w = 15 * (0.35 + 0.65 * v);
    const inner = e.phi < 0 ? 1 : -1;
    const closed = expr === 'eyesClosed' || (expr === 'wink' && e.left);
    const squint = expr === 'nose' || (expr === 'wink' && !e.left) || expr === 'puff';
    if (closed) {
      // bien marcado: es una seña y no puede confundirse con mirar la mesa
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.moveTo(x - w * 1.08, y);
      ctx.quadraticCurveTo(x, y + 9, x + w * 1.08, y);
      ctx.stroke();
      ctx.lineWidth = 2.4;
      for (const k of [-0.7, 0, 0.7]) {
        ctx.beginPath();
        ctx.moveTo(x + k * w, y + 5.5 - Math.abs(k) * 3);
        ctx.lineTo(x + k * w * 1.2, y + 11 - Math.abs(k) * 3);
        ctx.stroke();
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = mix(look.skin[1], 0.66);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.8, y - 7);
      ctx.quadraticCurveTo(x, y - 11, x + w * 0.8, y - 7);
      ctx.stroke();
      continue;
    }
    const open = squint ? 3.2 : 6.4 - down * 2.2;
    const shape = () => {
      ctx.beginPath();
      ctx.moveTo(x - inner * w * 1.05, y - 1.5);
      ctx.quadraticCurveTo(x - inner * w * 0.1, y - open * 1.5, x + inner * w, y + 2);
      ctx.quadraticCurveTo(x, y + open * 1.05, x - inner * w * 1.05, y - 1.5);
      ctx.closePath();
    };
    shape();
    ctx.fillStyle = FACE.sclera;
    ctx.fill();
    ctx.save();
    shape();
    ctx.clip();
    const ix = x + Math.sin(yaw) * 2.5 * v;
    const iy = y + down * 3.5 - 1.5;
    ellipse(ctx, ix, iy, 7 * (0.45 + 0.55 * v), 7.6);
    ctx.fillStyle = FACE.iris;
    ctx.fill();
    ellipse(ctx, ix - 2, iy - 2.6, 1.7, 1.7);
    ctx.fillStyle = FACE.glint;
    ctx.fill();
    ctx.restore();
    // párpado pesado: la línea de arriba es gruesa y termina en punta
    ctx.beginPath();
    ctx.moveTo(x - inner * w * 1.22, y + 1);
    ctx.quadraticCurveTo(x - inner * w * 0.1, y - open * 1.72, x + inner * w * 1.04, y + 2.5);
    ctx.quadraticCurveTo(x - inner * w * 0.1, y - open * 1.02, x - inner * w * 1.22, y + 1);
    ctx.closePath();
    ctx.fillStyle = INK;
    ctx.fill();
    // pliegue del párpado
    ctx.strokeStyle = mix(look.skin[1], 0.66);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x - inner * w * 0.9, y - open * 1.5 - 1);
    ctx.quadraticCurveTo(x, y - open * 2.1 - 1.5, x + inner * w * 0.82, y - open * 0.9 - 2);
    ctx.stroke();
    if (squint) {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.8, y + 7);
      ctx.quadraticCurveTo(x, y + 10, x + w * 0.8, y + 6);
      ctx.stroke();
    }
  }
}

function drawBrows(ctx, look, px, vis, eyeY, expr, down) {
  const col = look.old ? mix(look.hair, 0.72) : INK === look.hair ? INK : mix(look.hair, 0.86);
  const scowl = look.scowl ?? 3;
  for (const phi of [-0.44, 0.44]) {
    const v = vis(phi);
    if (v < 0.12) continue;
    const x = px(phi, 0.92);
    const w = 20 * (0.35 + 0.65 * v);
    const inner = phi < 0 ? 1 : -1; // hacia el centro de la cara
    let y = eyeY - 19 + down * 2;
    let innerDy = scowl;
    let arch = -4;
    let thick = look.soft ? 4.5 : 7;
    if (expr === 'brows') {
      y -= 17;
      innerDy = -3;
      arch = -9;
    } else if (expr === 'nose' || expr === 'frown') {
      innerDy = 9;
      y += 3;
    } else if (expr === 'wink' && phi > 0) {
      y += 6;
    }
    ctx.beginPath();
    ctx.moveTo(x - inner * w * 1.1, y + 4); // punta de afuera
    ctx.quadraticCurveTo(x - inner * w * 0.2, y + arch - thick * 0.4, x + inner * w, y + innerDy - thick * 0.5);
    ctx.lineTo(x + inner * w * 0.98, y + innerDy + thick * 0.5);
    ctx.quadraticCurveTo(x - inner * w * 0.2, y + arch + thick * 0.7, x - inner * w * 1.1, y + 4);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  if (expr === 'brows') {
    const c = mix(look.skin[1], 0.66);
    for (let i = 0; i < 3; i++) {
      wedge(ctx, px(-0.42, 0.9), eyeY - 50 - i * 9, px(0, 0.95), eyeY - 54 - i * 9, px(0.42, 0.9), eyeY - 50 - i * 9, 3, c);
    }
  }
}

function drawNose(ctx, look, px, cy, fh, yaw, expr) {
  const s = Math.sin(yaw);
  const x = px(0, 0.97);
  const top = cy - fh * 0.05;
  const tip = cy + fh * 0.36;
  const out = s * 14; // la punta sobresale hacia donde gira
  const skinD = look.skin[1];
  const dir = s >= 0 ? 1 : -1;
  // sombra plana en un costado del tabique y línea de la base
  ctx.beginPath();
  ctx.moveTo(x + dir * 2, top);
  ctx.quadraticCurveTo(x + out * 0.6 + dir * 9, tip - 18, x + out + dir * 13, tip + 2);
  ctx.lineTo(x + out + dir * 1, tip + 6);
  ctx.quadraticCurveTo(x + out * 0.4 + dir * 2, tip - 18, x + dir * 2, top);
  ctx.closePath();
  ctx.fillStyle = skinD;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(x + out - 11 * (1 - Math.abs(s) * 0.5), tip + 3);
  ctx.quadraticCurveTo(x + out, tip + 10, x + out + 11 * (1 - Math.abs(s) * 0.5), tip + 3);
  ctx.stroke();
  if (expr === 'nose') {
    const c = mix(skinD, 0.62);
    for (let i = 0; i < 3; i++) wedge(ctx, x - 11, top + 8 + i * 7, x, top + 4 + i * 7, x + 11, top + 8 + i * 7, 3.4, c);
    wedge(ctx, x + out - 19, tip + 2, x + out - 25, tip + 14, x + out - 17, tip + 26, 4, c);
    wedge(ctx, x + out + 19, tip + 2, x + out + 25, tip + 14, x + out + 17, tip + 26, 4, c);
  }
}

function drawMouth(ctx, look, px, vis, y, yaw, expr, talking, bite = 1) {
  const s = Math.sin(yaw);
  const x = px(0, 0.95) + s * 5;
  const w = 20 * (0.5 + 0.5 * Math.cos(yaw));
  const shadeC = mix(look.skin[1], 0.7);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  switch (expr) {
    case 'mouthRight':
    case 'mouthLeft': {
      // a la derecha DEL PERSONAJE = izquierda de la imagen (si está de frente)
      const d = expr === 'mouthRight' ? -1 : 1;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x - d * w * 0.7, y + 3);
      ctx.quadraticCurveTo(x + d * w * 0.4, y + 5, x + d * w * 1.5, y - 11);
      ctx.stroke();
      wedge(ctx, x + d * w * 1.7, y - 18, x + d * w * 2.05, y - 7, x + d * w * 1.65, y + 5, 4.4, shadeC);
      return;
    }
    case 'bite': {
      // morderse el labio: los dientes de arriba bajan sobre el labio de abajo, que se mete para adentro.
      // `bite` va de 0 (labio suelto, carnoso) a 1 (mordido); animado se ve el gesto entero.
      const b = clamp(bite, 0, 1);
      const lw = w * (0.86 + b * 0.15);
      const lipTop = y + 4 - b * 4;
      const lipH = 13 - b * 3;
      ctx.beginPath();
      ctx.moveTo(x - lw, lipTop);
      ctx.quadraticCurveTo(x, lipTop - 3, x + lw, lipTop);
      ctx.quadraticCurveTo(x + lw * 0.6, lipTop + lipH, x, lipTop + lipH + 1);
      ctx.quadraticCurveTo(x - lw * 0.6, lipTop + lipH, x - lw, lipTop);
      fillStroke(ctx, FACE.kissLip, INK, 2.4);
      // solo los dientes de adelante: si se ven todos parece una sonrisa
      const tb = lipTop + 1 + b * (lipH * 0.5);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.46, y - 4);
      ctx.lineTo(x + w * 0.46, y - 4);
      ctx.lineTo(x + w * 0.42, tb);
      ctx.quadraticCurveTo(x, tb + 2, x - w * 0.42, tb);
      ctx.closePath();
      fillStroke(ctx, FACE.teeth, INK, 2.2);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      for (const dx of [-0.22, 0, 0.22]) {
        ctx.beginPath();
        ctx.moveTo(x + dx * w, y - 3);
        ctx.lineTo(x + dx * w, tb);
        ctx.stroke();
      }
      // labio de arriba con media sonrisa pícara
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(x - w * 1.08, y - 2 + b * 2);
      ctx.quadraticCurveTo(x - w * 0.3, y - 7, x, y - 5);
      ctx.quadraticCurveTo(x + w * 0.4, y - 7, x + w * 1.14, y - 6 - b * 4);
      ctx.stroke();
      return;
    }
    case 'kiss': {
      // beso evidente: labios grandes, rojos y para adelante (corridos hacia donde mira), con arrugas
      ctx.save();
      const kx = x + s * 10;
      const ky = y + 4;
      ctx.translate(kx, ky);
      ctx.scale(1.4, 1.4); // grande: la seña tiene que verse desde la otra punta de la mesa
      ctx.translate(-kx, -ky);
      ctx.strokeStyle = FACE.wrinkle;
      ctx.lineWidth = 2;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(kx + Math.cos(a) * 16, ky + Math.sin(a) * 14);
        ctx.lineTo(kx + Math.cos(a) * 21, ky + Math.sin(a) * 18);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(kx - 13, ky);
      ctx.bezierCurveTo(kx - 12, ky - 13, kx - 3, ky - 13, kx, ky - 7);
      ctx.bezierCurveTo(kx + 3, ky - 13, kx + 12, ky - 13, kx + 13, ky);
      ctx.bezierCurveTo(kx + 12, ky + 14, kx - 12, ky + 14, kx - 13, ky);
      ctx.closePath();
      fillStroke(ctx, FACE.kissLip, INK, 2.8);
      ellipse(ctx, kx, ky + 1, 3.6, 3);
      ctx.fillStyle = FACE.mouthInside;
      ctx.fill();
      ctx.restore();
      return;
    }
    case 'open': {
      ctx.beginPath();
      ctx.ellipse(x, y + 9, w * 0.78, 17, 0, 0, Math.PI * 2);
      fillStroke(ctx, FACE.mouthInside, INK, 3);
      ctx.save();
      ctx.clip();
      ctx.fillStyle = FACE.teeth;
      ctx.fillRect(x - w, y - 9, w * 2, 8);
      ctx.fillStyle = FACE.tongue;
      ctx.beginPath();
      ctx.ellipse(x, y + 24, w * 0.54, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    case 'puff': {
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.42, y);
      ctx.quadraticCurveTo(x, y + 3, x + w * 0.42, y);
      ctx.stroke();
      return;
    }
    case 'frown': {
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x - w, y + 9);
      ctx.quadraticCurveTo(x, y - 8, x + w, y + 9);
      ctx.stroke();
      wedge(ctx, x - w - 3, y + 10, x - w - 7, y + 16, x - w - 8, y + 24, 3.6, shadeC);
      wedge(ctx, x + w + 3, y + 10, x + w + 7, y + 16, x + w + 8, y + 24, 3.6, shadeC);
      return;
    }
  }
  if (talking) {
    ctx.beginPath();
    ctx.moveTo(x - w * 0.8, y - 1);
    ctx.quadraticCurveTo(x, y - 5, x + w * 0.8, y - 1);
    ctx.quadraticCurveTo(x, y + 19, x - w * 0.8, y - 1);
    fillStroke(ctx, FACE.mouthInside, INK, 2.6);
    ctx.fillStyle = FACE.teeth;
    ctx.fillRect(x - w * 0.5, y - 3, w, 4);
    return;
  }
  // neutral: una línea seca, apenas caída en las puntas, y la sombra del labio de abajo
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(x - w, y + 2);
  ctx.quadraticCurveTo(x - w * 0.3, y - 2, x, y);
  ctx.quadraticCurveTo(x + w * 0.3, y - 2, x + w, y + 2);
  ctx.stroke();
  wedge(ctx, x - w * 0.5, y + 10, x, y + 14, x + w * 0.5, y + 10, 4.2, shadeC);
}

function drawMustache(ctx, look, px, y, yaw, expr) {
  const s = Math.sin(yaw);
  const x = px(0, 0.96) + s * 6;
  const tilt = expr === 'mouthRight' ? -8 : expr === 'mouthLeft' ? 8 : 0;
  const w = 30 * (0.55 + 0.45 * Math.cos(yaw));
  ctx.beginPath();
  ctx.moveTo(x - w + tilt, y + 13);
  ctx.quadraticCurveTo(x - w * 0.5 + tilt, y - 5, x + tilt, y + 1);
  ctx.quadraticCurveTo(x + w * 0.5 + tilt, y - 5, x + w + tilt, y + 13);
  ctx.quadraticCurveTo(x + tilt, y + 7, x - w + tilt, y + 13);
  fillStroke(ctx, look.hair, INK, 2);
}

function drawGlasses(ctx, px, vis, y) {
  ctx.strokeStyle = OUTFIT.frame;
  ctx.lineWidth = 2.6;
  const pts = [];
  for (const phi of [-0.42, 0.42]) {
    const v = vis(phi);
    if (v < 0.15) continue;
    const x = px(phi, 0.93);
    const w = 23 * (0.4 + 0.6 * v);
    ctx.beginPath();
    ctx.roundRect(x - w, y - 12, w * 2, 23, 4);
    ctx.fillStyle = OUTFIT.lens;
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
const hairlineY = (cy, fh, phi) => cy - fh * (0.58 - (0.3 * phi * phi) / 1.9);

// Masa de pelo con mechones en punta: arriba el contorno, abajo el flequillo.
function hairMass(ctx, look, g, { puff = 8, tufts = 9, amp = 9, drop = 0.14, lean = 0.5, locks = 7, side = 0.02 } = {}) {
  const { cx, cy, fw, fh, px } = g;
  const baseY = cy - fh * 0.3;
  const rx = fw + puff;
  const ry = fh * 0.82 + puff;
  ctx.beginPath();
  ctx.moveTo(cx - fw - puff * 0.3, cy + fh * side);
  ctx.lineTo(cx - rx, baseY);
  for (let i = 0; i < tufts; i++) {
    const a0 = Math.PI + (Math.PI * i) / tufts;
    const a1 = Math.PI + (Math.PI * (i + 1)) / tufts;
    const bump = amp * (0.5 + rnd(look, i + 40));
    const tipA = a1 + (lean * Math.PI) / tufts;
    const tipX = cx + Math.cos(tipA) * (rx + bump);
    const tipY = baseY + Math.sin(tipA) * (ry + bump);
    const am = (a0 + a1) / 2;
    ctx.quadraticCurveTo(cx + Math.cos(am) * (rx + bump * 1.15), baseY + Math.sin(am) * (ry + bump * 1.15), tipX, tipY);
    // de la punta se vuelve curvando: mechón ondulado, no serrucho
    ctx.quadraticCurveTo(cx + Math.cos(a1) * (rx + bump * 0.2), baseY + Math.sin(a1) * (ry + bump * 0.2), cx + Math.cos(a1) * rx, baseY + Math.sin(a1) * ry);
  }
  ctx.lineTo(cx + fw + puff * 0.3, cy + fh * side);
  // flequillo, de derecha a izquierda de la imagen
  const from = 1.42;
  const to = -1.42;
  ctx.lineTo(px(from, 1.0), hairlineY(cy, fh, from));
  for (let i = 0; i < locks; i++) {
    const t0 = i / locks;
    const t1 = (i + 1) / locks;
    const p0 = from + (to - from) * t0;
    const p1 = from + (to - from) * t1;
    const pm = p0 + (p1 - p0) * (0.3 + lean * 0.6);
    const d = fh * drop * (0.55 + rnd(look, i + 80) * 0.9);
    ctx.quadraticCurveTo(px(p0, 1.0), hairlineY(cy, fh, pm) + d * 0.55, px(pm, 1.0), hairlineY(cy, fh, pm) + d);
    ctx.quadraticCurveTo(px(p1, 1.0), hairlineY(cy, fh, p1) + d * 0.3, px(p1, 1.0), hairlineY(cy, fh, p1));
  }
  ctx.closePath();
}

function drawHair(ctx, look, cx, cy, fw, fh, yaw, px, vis, skinD) {
  const hair = look.hair;
  const light = mix(hair, 1.75);
  const dark = mix(hair, 0.62);
  const top = cy - fh * 1.06;
  const s = Math.sin(yaw);
  const g = { cx, cy, fw, fh, px };
  const strands = (n, spread) => {
    ctx.save();
    ctx.clip();
    for (let i = 0; i < n; i++) {
      const x = cx + (i - (n - 1) / 2) * spread + s * 8;
      wedge(ctx, x * 0.6 + cx * 0.4, top + 4, x + 8, top + 34, x + 18 * (i % 2 ? 1 : -0.4), cy - fh * 0.55, 6, i % 3 === 1 ? light : dark);
    }
    ctx.restore();
  };
  const hatShadow = (y) => {
    // sombra plana del ala o la visera sobre la cara: se recorta a una franja
    ctx.fillStyle = skinD;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(cx - fw * 0.98, y);
    ctx.quadraticCurveTo(cx, y + 22, cx + fw * 0.98, y);
    ctx.lineTo(cx + fw * 0.98, y - 40);
    ctx.lineTo(cx - fw * 0.98, y - 40);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  switch (look.style) {
    case 'receding': {
      for (const side of [-1, 1]) {
        if (vis(side * 1.4) < -0.5) continue;
        ctx.beginPath();
        const x = px(side * 1.32, 1.0);
        ctx.moveTo(x + side * 2, cy - fh * 0.62);
        ctx.quadraticCurveTo(x + side * 14, cy - fh * 0.3, x + side * 3, cy + fh * 0.1);
        ctx.quadraticCurveTo(x - side * 15, cy - fh * 0.18, x + side * 2, cy - fh * 0.62);
        fillStroke(ctx, hair, INK, 2.6);
      }
      wedge(ctx, cx - fw * 0.5 + s * 10, top + 34, cx - 8 + s * 10, top + 18, cx + fw * 0.3 + s * 10, top + 30, 7, mix(look.skin[0], 1.12));
      return;
    }
    case 'buzz': {
      hairMass(ctx, look, g, { puff: 1, tufts: 8, amp: 0, lean: 0, drop: 0.015, locks: 5 });
      fillStroke(ctx, hair, INK, 3);
      return;
    }
    case 'curly': {
      hairMass(ctx, look, g, { puff: 10, tufts: 6, amp: 4, drop: 0.2, locks: 6, lean: 0.2 });
      fillStroke(ctx, hair, INK, 3);
      for (let i = 0; i < 13; i++) {
        const a = Math.PI * (1.03 + (i / 12) * 0.94);
        const x = cx + Math.cos(a) * (fw + 4);
        const y = cy - fh * 0.3 + Math.sin(a) * fh * 0.84;
        ellipse(ctx, x, y, 17, 15, a);
        fillStroke(ctx, hair, INK, 2.4);
        wedge(ctx, x - 8, y + 2, x, y - 9, x + 9, y + 1, 4, i % 2 ? light : dark);
      }
      return;
    }
    case 'boina': {
      hairMass(ctx, look, g, { puff: 2, tufts: 8, amp: 0, lean: 0, drop: 0.06, locks: 6 });
      fillStroke(ctx, hair, INK, 3);
      const by = top + 32;
      const shape = () => {
        ctx.beginPath();
        ctx.moveTo(cx - fw - 8 + s * 6, by + 16);
        ctx.bezierCurveTo(cx - fw - 40 + s * 12, by - 36, cx + fw + 20 + s * 12, by - 54, cx + fw + 30 + s * 12, by - 2);
        ctx.quadraticCurveTo(cx + fw + 20 + s * 6, by + 22, cx + fw + 6 + s * 6, by + 18);
        ctx.quadraticCurveTo(cx + s * 6, by + 6, cx - fw - 8 + s * 6, by + 16);
        ctx.closePath();
      };
      paint(ctx, shape, OUTFIT.beret, () => {
        ctx.fillStyle = mix(OUTFIT.beret, 0.55);
        ctx.fillRect(cx - fw - 50, by + 2, fw * 2 + 110, 30);
      }, 3.2);
      wedge(ctx, cx - 28 + s * 10, by - 25, cx + 4 + s * 12, by - 34, cx + 40 + s * 14, by - 24, 6, mix(OUTFIT.beret, 2.2));
      ctx.beginPath();
      ctx.moveTo(cx - 3 + s * 12, by - 33);
      ctx.lineTo(cx + s * 12, by - 48);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.stroke();
      return;
    }
    case 'cap': {
      hairMass(ctx, look, g, { puff: 2, tufts: 8, amp: 0, lean: 0, drop: 0.05, locks: 6 });
      fillStroke(ctx, hair, INK, 3);
      const col = mix(look.cloth2, 1.0);
      const y = cy - fh * 0.46;
      const shape = () => {
        ctx.beginPath();
        ctx.moveTo(cx - fw - 5, y);
        ctx.bezierCurveTo(cx - fw - 8, top - 34, cx + fw + 8, top - 34, cx + fw + 5, y);
        ctx.closePath();
      };
      paint(ctx, shape, col, () => {
        ctx.fillStyle = mix(look.cloth2, 0.7);
        ctx.fillRect(cx + fw * 0.36 + s * 20, top - 60, fw, fh);
      }, 3.2);
      const vx = px(0, 1.0);
      ctx.beginPath();
      ctx.moveTo(vx - fw * (0.62 + 0.38 * Math.cos(yaw)) + s * 18, y);
      ctx.quadraticCurveTo(vx + s * 22, y + 26, vx + fw * (0.62 + 0.38 * Math.cos(yaw)) + s * 18, y);
      ctx.quadraticCurveTo(vx + s * 18, y + 6, vx - fw * (0.62 + 0.38 * Math.cos(yaw)) + s * 18, y);
      ctx.closePath();
      fillStroke(ctx, mix(look.cloth2, 0.62), INK, 3);
      return;
    }
    case 'sombrero': {
      // pelo que asoma abajo del ala
      hairMass(ctx, look, g, { puff: 6, tufts: 5, amp: 5, drop: 0.16, locks: 6, side: 0.2 });
      fillStroke(ctx, hair, INK, 3);
      for (const d of [-1, 1]) {
        if (vis(d * 1.3) < -0.3) continue;
        const x = cx + d * (fw + 2);
        ctx.beginPath();
        ctx.moveTo(x - d * 10, cy - fh * 0.3);
        ctx.quadraticCurveTo(x + d * 12, cy - fh * 0.05, x + d * 7, cy + fh * 0.32);
        ctx.quadraticCurveTo(x - d * 3, cy + fh * 0.18, x - d * 6, cy + fh * 0.2);
        ctx.closePath();
        fillStroke(ctx, hair, INK, 2.6);
      }
      const by = cy - fh * 0.6;
      const c = Math.cos(yaw);
      const rx = fw * (1.62 + 0.42 * c);
      const shift = s * 8;
      hatShadow(by + 20);
      const crown = () => {
        ctx.beginPath();
        ctx.moveTo(cx - fw * 0.92 + shift, by + 2);
        ctx.lineTo(cx - fw * 0.76 + shift, by - 58);
        ctx.quadraticCurveTo(cx + shift, by - 68, cx + fw * 0.76 + shift, by - 58);
        ctx.lineTo(cx + fw * 0.92 + shift, by + 2);
        ctx.closePath();
      };
      paint(ctx, crown, OUTFIT.hat, () => {
        ctx.fillStyle = OUTFIT.hatBand;
        ctx.fillRect(cx - fw * 1.1 + shift, by - 16, fw * 2.2, 18);
        ctx.fillRect(cx + fw * 0.34 + shift, by - 80, fw, 80);
      }, 3.2);
      const brim = () => {
        ctx.beginPath();
        ctx.moveTo(cx - rx + shift, by);
        ctx.quadraticCurveTo(cx + shift, by - 22, cx + rx + shift, by);
        ctx.quadraticCurveTo(cx + shift, by + 34, cx - rx + shift, by);
        ctx.closePath();
      };
      paint(ctx, brim, OUTFIT.hat, () => {
        ctx.fillStyle = OUTFIT.hatBand;
        ctx.fillRect(cx + rx * 0.3 + shift, by - 30, rx, 70);
        wedge(ctx, cx - rx * 0.86 + shift, by - 1, cx - rx * 0.3 + shift, by - 10, cx + rx * 0.2 + shift, by - 9, 3.4, mix(OUTFIT.hat, 2.6));
      }, 3.2);
      return;
    }
    case 'wavy': {
      const opt = { puff: 12, tufts: 8, amp: 9, drop: 0.16, locks: 6, lean: 0.8, side: 0.06 };
      hairMass(ctx, look, g, opt);
      fillStroke(ctx, hair, INK, 3);
      hairMass(ctx, look, g, opt);
      strands(6, fw * 0.32);
      // mechones sueltos sobre las sienes
      for (const d of [-1, 1]) {
        if (vis(d * 1.25) < -0.2) continue;
        const x = cx + d * (fw + 8);
        ctx.beginPath();
        ctx.moveTo(x - d * 14, cy - fh * 0.48);
        ctx.quadraticCurveTo(x + d * 18, cy - fh * 0.24, x + d * 7, cy + fh * 0.1);
        ctx.quadraticCurveTo(x - d * 4, cy - fh * 0.14, x - d * 13, cy - fh * 0.08);
        ctx.closePath();
        fillStroke(ctx, hair, INK, 2.6);
      }
      return;
    }
    default: {
      const swept = look.style === 'swept';
      const opt = swept ? { puff: 10, tufts: 8, amp: 11, drop: 0.2, locks: 5, lean: 0.95 } : { puff: 7, tufts: 8, amp: 8, drop: 0.13, locks: 7, lean: 0.5 };
      hairMass(ctx, look, g, opt);
      fillStroke(ctx, hair, INK, 3);
      hairMass(ctx, look, g, opt);
      strands(5, fw * 0.36);
      if (look.style === 'bun') {
        ellipse(ctx, cx - s * 40, top - 12, 25, 21);
        fillStroke(ctx, hair, INK, 3);
        wedge(ctx, cx - s * 40 - 14, top - 14, cx - s * 40, top - 26, cx - s * 40 + 14, top - 12, 5, light);
      }
      if (look.style === 'long') {
        for (const side of [-1, 1]) {
          if (vis(side * 1.2) < -0.2) continue;
          const x = px(side * 1.15, 1.02);
          ctx.beginPath();
          ctx.moveTo(x - side * 8, cy - fh * 0.4);
          ctx.quadraticCurveTo(x + side * 8, cy + fh * 0.4, x + side * 3, cy + fh * 1.05);
          ctx.lineTo(x + side * 20, cy + fh * 0.86);
          ctx.quadraticCurveTo(x + side * 26, cy, x + side * 14, cy - fh * 0.5);
          ctx.closePath();
          fillStroke(ctx, hair, INK, 2.6);
        }
      }
    }
  }
}

function drawLongHairBack(ctx, look, cx, cy) {
  const fw = look.fw;
  const fh = look.fh;
  ctx.beginPath();
  ctx.moveTo(cx - fw - 12, cy - fh * 0.3);
  ctx.bezierCurveTo(cx - fw - 28, cy + fh * 0.8, cx - fw - 18, cy + fh * 1.5, cx - fw + 8, cy + fh * 1.7);
  ctx.lineTo(cx - fw * 0.1, cy + fh * 1.5);
  ctx.lineTo(cx + fw * 0.1, cy + fh * 1.72);
  ctx.lineTo(cx + fw - 8, cy + fh * 1.7);
  ctx.bezierCurveTo(cx + fw + 18, cy + fh * 1.5, cx + fw + 28, cy + fh * 0.8, cx + fw + 12, cy - fh * 0.3);
  ctx.closePath();
  fillStroke(ctx, mix(look.hair, 0.72), INK, 3);
}

// ------------------------------------------------------------------ brazos, manos y cartas
function fist(ctx, x, y, side, skin, skinD) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.28, 1.28);
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(side * 24, -15);
    ctx.quadraticCurveTo(0, -24, -side * 22, -13);
    ctx.quadraticCurveTo(-side * 29, 1, -side * 24, 15);
    ctx.quadraticCurveTo(-side * 17, 24, -side * 10, 19);
    ctx.quadraticCurveTo(-side * 4, 25, side * 3, 19);
    ctx.quadraticCurveTo(side * 10, 24, side * 15, 18);
    ctx.quadraticCurveTo(side * 24, 20, side * 26, 8);
    ctx.closePath();
  };
  paint(ctx, path, skin, () => {
    ctx.fillStyle = skinD;
    ctx.beginPath();
    ctx.moveTo(-34, 7);
    ctx.quadraticCurveTo(0, 12, 34, 4);
    ctx.lineTo(34, 30);
    ctx.lineTo(-34, 30);
    ctx.closePath();
    ctx.fill();
  }, 2.6);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  for (const k of [-9, 2.5]) {
    ctx.beginPath();
    ctx.moveTo(side * k, 3);
    ctx.lineTo(side * k, 20);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-side * 15, 4);
  ctx.lineTo(-side * 16, 18);
  ctx.stroke();
  ctx.restore();
}

// Sombra de un miembro: tono oscuro y encima el mismo contorno, corrido hacia la luz, en el tono claro.
function limbShade(ctx, path, light, dark, dx = -11, dy = -6) {
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(dx, dy);
  path();
  ctx.fillStyle = light;
  ctx.fill();
  ctx.restore();
}

function drawArms(ctx, look, bx, yaw, cards) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const sw = shoulderW(c);
  const rolled = ROLLED.has(look.shirt);
  const cloth = rolled ? look.under || OUTFIT.shirtUnder : look.shirt === 'jacket' ? look.cloth2 : look.cloth;
  const [skin, skinD] = look.skin;
  const hcx = bx + s * 40; // las manos van hacia adelante del cuerpo
  const hands = cards > 0 ? [hcx - 42, hcx + 40] : [hcx - 62, hcx + 62];

  [-1, 1].forEach((side, i) => {
    const hx = hands[i];
    const sh = [bx + side * (sw - 30), TOP + 4];
    const el = [bx + side * (sw + 16) + s * 20, 560];
    const wr = [hx + side * 26, HAND_Y - 2];
    const pts = [...qPoints(sh, [el[0] + side * 12, el[1] - 130], el, 12), ...qPoints(el, [el[0] - side * 8, HAND_Y - 12], wr, 8).slice(1)];
    const shade = mix(cloth, 0.72);
    const fold = mix(cloth, 0.54);
    const clothPts = rolled ? pts.slice(0, 15) : pts;
    const sleeve = () => tube(ctx, clothPts, 60, rolled ? 48 : 40, true);
    paint(ctx, sleeve, cloth, () => {
      limbShade(ctx, sleeve, cloth, shade);
      wedge(ctx, sh[0] + side * 12, TOP + 96, el[0] - side * 2, 490, el[0] - side * 24, 544, 10, fold);
      wedge(ctx, el[0] + side * 28, 524, el[0] - side * 4, 552, el[0] - side * 30, 560, 9, fold);
    }, 3.2);
    // el hombro sigue de corrido con el torso: se borra el principio del contorno de adentro
    ctx.beginPath();
    ctx.ellipse(sh[0] - side * 18, TOP + 66, 15, 58, side * -0.1, 0, Math.PI * 2);
    ctx.fillStyle = side > 0 ? shade : cloth;
    ctx.fill();
    if (rolled) {
      const armPts = pts.slice(14);
      const arm = () => tube(ctx, armPts, 52, 36);
      paint(ctx, arm, skin, () => limbShade(ctx, arm, skin, skinD, -7, -9), 3);
      // la vuelta de la manga arremangada
      const cuff = armPts[0];
      paint(ctx, () => {
        ctx.beginPath();
        ctx.ellipse(cuff[0], cuff[1], 34, 15, side * 0.5, 0, Math.PI * 2);
      }, mix(cloth, 1.04), () => {
        ctx.fillStyle = mix(cloth, 0.68);
        ctx.fillRect(cuff[0] - 40, cuff[1] + 3, 80, 18);
      }, 3);
    } else {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(wr[0] + side * 9, wr[1] - 21);
      ctx.lineTo(wr[0] + side * 5, wr[1] + 20);
      ctx.stroke();
    }
  });

  if (cards > 0) {
    const n = Math.min(3, cards);
    const cw = 60 * (0.6 + 0.4 * c);
    for (let i = 0; i < n; i++) {
      const ang = (i - (n - 1) / 2) * 0.22 + s * 0.15;
      ctx.save();
      ctx.translate(hcx, HAND_Y + 8);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.roundRect(-30, -106, cw, 96, 4);
      fillStroke(ctx, OUTFIT.cardFace, OUTFIT.cardEdge, 2.4);
      ctx.beginPath();
      ctx.roundRect(-25, -101, cw - 10, 86, 2);
      ctx.fillStyle = OUTFIT.cardBack;
      ctx.fill();
      ctx.strokeStyle = OUTFIT.cardBackInk;
      ctx.lineWidth = 1.4;
      for (let k = -96; k < -16; k += 8) {
        ctx.beginPath();
        ctx.moveTo(-24, k);
        ctx.lineTo(cw - 36, k + 8);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  hands.forEach((hx, i) => fist(ctx, hx, HAND_Y + 4, i === 0 ? -1 : 1, skin, skinD));
}
