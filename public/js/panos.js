// Los paños de la tienda pintados a mano en canvas (nada de imágenes): la alfombra persa, el almendro en flor, el
// fileteado porteño, el poncho salteño, el casino, la baldosa calcárea, la noche de campo y la mesa de bodegón.
// Cada uno es un pintor paint(ctx, w, h, sides) que llena el cuadrado entero (la mesa lo recorta en su forma); el
// centro queda más tranquilo para que las cartas se lean. Después drawnFelt le pone la trama de la tela, la sombra de
// los bordes y la costura. COSMETIC_LOOK[id].draw (theme.js) dice qué pintor usa cada paño.
import { surface, strokes, swirlDot } from './impasto.js';

// Azar con semilla: el paño sale igual en todas las máquinas.
function seeded(seed) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}
const TAU = Math.PI * 2;

// Repite un dibujo en los cuatro cuadrantes (espejado): para guardas y esquinas simétricas.
function mirror4(ctx, w, h, draw) {
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(sx, sy);
    draw();
    ctx.restore();
  }
}

// Una flor de cinco (o n) pétalos.
function flower(ctx, x, y, r, petal, center, { n = 5, rot = 0, ratio = 0.62 } = {}) {
  ctx.fillStyle = petal;
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.55, r * 0.55 * ratio, a, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = center;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.24, 0, TAU);
  ctx.fill();
}

// Una hoja (forma de almendra) de la base hacia la punta.
function leaf(ctx, x, y, len, wid, a, fill, vein = null) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -wid, len, 0);
  ctx.quadraticCurveTo(len * 0.5, wid, 0, 0);
  ctx.fillStyle = fill;
  ctx.fill();
  if (vein) {
    ctx.strokeStyle = vein;
    ctx.lineWidth = Math.max(1, wid * 0.12);
    ctx.beginPath();
    ctx.moveTo(len * 0.05, 0);
    ctx.lineTo(len * 0.9, 0);
    ctx.stroke();
  }
  ctx.restore();
}

// Una estrella de n puntas.
function star(ctx, x, y, r0, r1, n, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i / (n * 2)) * TAU;
    const r = i % 2 ? r1 : r0;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

// ------------------------------------------------------------------ alfombra persa

// Alfombra persa: campo granate con arabescos y florcitas, el medallón central (lobulado, con su corona de pétalos y
// pendientes arriba y abajo), las esquinas en cuarto de medallón, y la guarda ancha de varias bandas: la de botones
// de flor y hojas que serpentean entre dos guardas finas de rombos.
function alfombra(ctx, w, h) {
  const C = { field: '#8a1f1c', fieldDark: '#5e1412', navy: '#1c2a4a', ivory: '#ecdcb6', gold: '#d3a24a', teal: '#2f6b6a', rose: '#c2524a', ink: '#24140f' };
  const r = seeded(11);
  ctx.fillStyle = C.field;
  ctx.fillRect(0, 0, w, h);
  // arabescos del campo: zarcillos finos y florcitas en una retícula de rombos
  const step = w / 14;
  ctx.lineWidth = w * 0.0022;
  for (let y = -step; y < h + step; y += step) {
    for (let x = -step; x < w + step; x += step) {
      const ox = ((y / step) % 2) * step * 0.5;
      ctx.strokeStyle = 'rgba(236,220,182,0.28)';
      ctx.beginPath();
      ctx.moveTo(x + ox, y - step * 0.42);
      ctx.bezierCurveTo(x + ox + step * 0.3, y - step * 0.1, x + ox - step * 0.3, y + step * 0.1, x + ox, y + step * 0.42);
      ctx.stroke();
      flower(ctx, x + ox, y, step * 0.11, r() < 0.5 ? C.gold : C.ivory, C.navy, { n: 6 });
      leaf(ctx, x + ox + step * 0.18, y - step * 0.2, step * 0.18, step * 0.05, -0.8, 'rgba(47,107,106,0.75)');
      leaf(ctx, x + ox - step * 0.18, y + step * 0.2, step * 0.18, step * 0.05, 2.3, 'rgba(47,107,106,0.75)');
    }
  }
  // esquinas: un cuarto de medallón azul con flores
  mirror4(ctx, w, h, () => {
    const R = w * 0.27;
    ctx.save();
    ctx.translate(-w / 2, -h / 2);
    ctx.fillStyle = C.navy;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * (Math.PI / 2);
      const rr = R * (1 + 0.06 * Math.sin(i * Math.PI));
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = w * 0.005;
    ctx.stroke();
    for (let k = 0; k < 7; k++) {
      const a = ((k + 0.5) / 7) * (Math.PI / 2);
      flower(ctx, Math.cos(a) * R * 0.66, Math.sin(a) * R * 0.66, R * 0.12, C.rose, C.gold, { n: 8, ratio: 0.5 });
      leaf(ctx, Math.cos(a) * R * 0.38, Math.sin(a) * R * 0.38, R * 0.22, R * 0.05, a, C.teal, C.ivory);
    }
    ctx.restore();
  });
  // el medallón del centro: lobulado, con anillos y la corona de pétalos (suave en el medio, donde caen las cartas)
  const cx = w / 2;
  const cy = h / 2;
  const lobed = (R, n, depth, fill, stroke) => {
    ctx.beginPath();
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * TAU;
      const rr = R * (1 + depth * Math.cos(a * n));
      ctx.lineTo(cx + Math.cos(a) * rr * 1.25, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = w * 0.004;
      ctx.stroke();
    }
  };
  // pendientes arriba y abajo
  for (const s of [-1, 1]) {
    ctx.fillStyle = C.navy;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.05, cy + s * h * 0.2);
    ctx.lineTo(cx, cy + s * h * 0.31);
    ctx.lineTo(cx + w * 0.05, cy + s * h * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = w * 0.003;
    ctx.stroke();
    flower(ctx, cx, cy + s * h * 0.27, w * 0.018, C.ivory, C.rose, { n: 6 });
  }
  lobed(w * 0.2, 12, 0.07, C.navy, C.gold);
  lobed(w * 0.16, 12, 0.05, C.ivory, C.gold);
  lobed(w * 0.13, 16, 0.04, C.fieldDark, null);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    leaf(ctx, cx + Math.cos(a) * w * 0.05 * 1.25, cy + Math.sin(a) * w * 0.05, w * 0.075, w * 0.02, a, i % 2 ? 'rgba(211,162,74,0.55)' : 'rgba(194,82,74,0.55)');
  }
  flower(ctx, cx, cy, w * 0.035, 'rgba(236,220,182,0.7)', C.navy, { n: 8, ratio: 0.5 });
  // la guarda: varias bandas
  const band = (inset, width, fill) => {
    ctx.fillStyle = fill;
    ctx.fillRect(inset, inset, w - inset * 2, width);
    ctx.fillRect(inset, h - inset - width, w - inset * 2, width);
    ctx.fillRect(inset, inset, width, h - inset * 2);
    ctx.fillRect(w - inset - width, inset, width, h - inset * 2);
  };
  const B = w * 0.012;
  band(0, w * 0.13, C.ivory);
  band(B * 1.2, B * 2, C.navy);
  band(w * 0.13 - B * 3, B * 2, C.navy);
  // rombitos en las guardas finas
  const diamonds = (inset, size, color) => {
    ctx.fillStyle = color;
    for (let t = inset + size; t < w - inset - size; t += size * 2.2) {
      for (const [x, y] of [[t, inset], [t, h - inset], [inset, t], [w - inset, t]]) {
        ctx.beginPath();
        ctx.moveTo(x, y - size * 0.6);
        ctx.lineTo(x + size * 0.6, y);
        ctx.lineTo(x, y + size * 0.6);
        ctx.lineTo(x - size * 0.6, y);
        ctx.fill();
      }
    }
  };
  diamonds(B * 2.2, B * 0.9, C.gold);
  diamonds(w * 0.13 - B * 2, B * 0.9, C.gold);
  // la guarda ancha: un tallo que serpentea con botones de flor y hojas
  const mid = w * 0.065;
  const runner = (len, place) => {
    const n = 18;
    ctx.strokeStyle = C.teal;
    ctx.lineWidth = w * 0.004;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const t = i / 200;
      const [x, y] = place(t * len, Math.sin(t * n * Math.PI) * mid * 0.32);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const off = Math.sin((i + 0.5) * Math.PI) * mid * 0.32;
      const [x, y] = place(t * len, off);
      flower(ctx, x, y, w * 0.016, i % 2 ? C.rose : C.field, C.gold, { n: 6 });
      const [lx, ly] = place(t * len + w * 0.02, -off * 0.6);
      flower(ctx, lx, ly, w * 0.007, C.gold, C.ink, { n: 5 });
    }
  };
  runner(w - mid * 2, (s, o) => [mid + s, mid + o]);
  runner(w - mid * 2, (s, o) => [mid + s, h - mid - o]);
  runner(h - mid * 2, (s, o) => [mid + o, mid + s]);
  runner(h - mid * 2, (s, o) => [w - mid - o, mid + s]);
  // flecos en las puntas (se ven apenas por los bordes)
  ctx.strokeStyle = C.ivory;
  ctx.lineWidth = 1.5;
  for (let x = 0; x < w; x += 5) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 1, B * 1.1);
    ctx.moveTo(x, h);
    ctx.lineTo(x + 1, h - B * 1.1);
    ctx.stroke();
  }
  // tejido: nudos que se notan (puntitos de color en todo)
  for (let i = 0; i < w * 40; i++) {
    ctx.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,240,210'},${0.03 + r() * 0.05})`;
    ctx.fillRect(r() * w, r() * h, 2, 2);
  }
}

// ------------------------------------------------------------------ almendro en flor

// Ramas de almendro en flor sobre un turquesa profundo: ramas nudosas que entran desde los bordes, flores blancas y
// rosadas (abiertas, a medio abrir y pimpollos), pétalos sueltos y el cielo con pinceladas.
function almendro(ctx, w, h) {
  const r = seeded(29);
  // cielo pintado a pinceladas cortas
  const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.75);
  g.addColorStop(0, '#5fa8a8');
  g.addColorStop(1, '#22585e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 2400; i++) {
    const x = r() * w;
    const y = r() * h;
    const a = Math.sin(x / w * 6 + y / h * 3) * 0.6 + (r() - 0.5) * 0.4;
    ctx.strokeStyle = `hsla(${180 + r() * 14},${35 + r() * 20}%,${36 + r() * 22}%,0.45)`;
    ctx.lineWidth = 3 + r() * 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * 18, y + Math.sin(a) * 18);
    ctx.stroke();
  }
  // una rama: un camino que se va afinando, con ramitas, y flores en las puntas
  const tips = [];
  const branch = (x, y, a, len, width, depth) => {
    const segs = 9;
    let px = x;
    let py = y;
    let pa = a;
    for (let i = 0; i < segs; i++) {
      pa += (r() - 0.5) * 0.5;
      const nx = px + Math.cos(pa) * (len / segs);
      const ny = py + Math.sin(pa) * (len / segs);
      const wd = width * (1 - i / segs) + 1.5;
      ctx.strokeStyle = '#3a2418';
      ctx.lineWidth = wd;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      // luz de un costado de la corteza
      ctx.strokeStyle = 'rgba(160,110,70,0.5)';
      ctx.lineWidth = wd * 0.3;
      ctx.beginPath();
      ctx.moveTo(px + 1, py - wd * 0.25);
      ctx.lineTo(nx + 1, ny - wd * 0.25);
      ctx.stroke();
      if (depth > 0 && i > 1 && r() < 0.45) branch(nx, ny, pa + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.5), len * 0.5, wd * 0.7, depth - 1);
      if (i > 2 && r() < 0.7) tips.push([nx + (r() - 0.5) * 20, ny + (r() - 0.5) * 20]);
      px = nx;
      py = ny;
    }
    tips.push([px, py]);
  };
  // entran desde los bordes, dejando el centro libre
  branch(-20, h * 0.18, 0.25, w * 0.55, w * 0.03, 2);
  branch(w + 20, h * 0.86, Math.PI + 0.3, w * 0.55, w * 0.03, 2);
  branch(w * 0.15, h + 20, -1.2, h * 0.38, w * 0.022, 2);
  branch(w * 0.9, -20, 1.9, h * 0.34, w * 0.022, 2);
  // flores
  const petals = ['#fbf6ee', '#f7e8ea', '#f2d4d9', '#fffaf4'];
  for (const [x, y] of tips) {
    // el centro (donde caen las cartas) con pocas flores
    if (Math.hypot(x - w / 2, y - h / 2) < w * 0.22 && r() < 0.75) continue;
    const n = 1 + Math.floor(r() * 2);
    for (let k = 0; k < n; k++) {
      const fx = x + (r() - 0.5) * w * 0.03;
      const fy = y + (r() - 0.5) * w * 0.03;
      const size = w * (0.007 + r() * 0.007);
      const kind = r();
      if (kind < 0.65) {
        // abierta: cinco pétalos con borde y el centro rosado con estambres
        flower(ctx, fx, fy, size * 1.6, petals[Math.floor(r() * petals.length)], '#c2546a', { rot: r() * TAU, ratio: 0.85 });
        ctx.strokeStyle = 'rgba(120,70,80,0.35)';
        ctx.lineWidth = 1;
        for (let s = 0; s < 6; s++) {
          const a = r() * TAU;
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(fx + Math.cos(a) * size * 0.6, fy + Math.sin(a) * size * 0.6);
          ctx.stroke();
        }
      } else if (kind < 0.85) {
        // a medio abrir
        leaf(ctx, fx, fy, size * 1.4, size * 0.7, r() * TAU, '#f6dfe3');
        leaf(ctx, fx, fy, size * 1.2, size * 0.5, r() * TAU, '#fbf3f0');
      } else {
        // pimpollo rosado con su cáliz
        ctx.fillStyle = '#e08a9c';
        ctx.beginPath();
        ctx.ellipse(fx, fy, size * 0.5, size * 0.7, r() * TAU, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#6b3a28';
        ctx.beginPath();
        ctx.arc(fx, fy + size * 0.5, size * 0.25, 0, TAU);
        ctx.fill();
      }
    }
  }
  // pétalos sueltos que caen (pocos en el centro)
  for (let i = 0; i < 160; i++) {
    const x = r() * w;
    const y = r() * h;
    if (Math.hypot(x - w / 2, y - h / 2) < w * 0.18 && r() < 0.8) continue;
    leaf(ctx, x, y, w * 0.008, w * 0.004, r() * TAU, 'rgba(250,240,236,0.85)');
  }
}

// ------------------------------------------------------------------ fileteado porteño

// Fileteado porteño: negro con las volutas de hojas de acanto en colores (de oscuro a claro, con la luz pintada), una
// cinta con la bandera en cada esquina, el marco de filetes en tres colores y un rombo de filete al medio con "TRUCO".
function fileteado(ctx, w, h) {
  ctx.fillStyle = '#0d0d0f';
  ctx.fillRect(0, 0, w, h);
  // la voluta: una espiral con hojas de acanto que van de un color oscuro a uno claro (tres tonos y un brillo)
  const acanthus = (x, y, size, a, hue) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    const tones = [`hsl(${hue},70%,22%)`, `hsl(${hue},75%,38%)`, `hsl(${hue},80%,55%)`, `hsl(${hue},90%,78%)`];
    // espiral (el tallo que se enrolla)
    ctx.lineCap = 'round';
    tones.forEach((tone, k) => {
      ctx.strokeStyle = tone;
      ctx.lineWidth = size * (0.16 - k * 0.035);
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const ang = t * Math.PI * 2.2;
        const rr = size * (1 - t * 0.85);
        const px = Math.cos(ang) * rr - size * 0.02 * k;
        const py = Math.sin(ang) * rr - size * 0.02 * k;
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.stroke();
    });
    // hojas que salen de la espiral, curvadas hacia afuera
    for (let j = 0; j < 5; j++) {
      const ang = -0.4 + j * 0.42;
      const bx = Math.cos(ang) * size;
      const by = Math.sin(ang) * size;
      tones.forEach((tone, k) => {
        ctx.fillStyle = tone;
        ctx.beginPath();
        const L = size * (0.9 - k * 0.15);
        const W = size * (0.32 - k * 0.07);
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + Math.cos(ang - 0.9) * L * 0.6 + Math.cos(ang) * W, by + Math.sin(ang - 0.9) * L * 0.6 + Math.sin(ang) * W, bx + Math.cos(ang - 1.3) * L, by + Math.sin(ang - 1.3) * L);
        ctx.quadraticCurveTo(bx + Math.cos(ang - 0.9) * L * 0.4, by + Math.sin(ang - 0.9) * L * 0.4, bx, by);
        ctx.fill();
      });
    }
    ctx.restore();
  };
  // cinta con la bandera
  const ribbon = (x, y, len, a) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    const wv = (t) => Math.sin(t * Math.PI * 2) * len * 0.06;
    const strip = (off, color, width) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        ctx.lineTo(t * len, wv(t) + off);
      }
      ctx.stroke();
    };
    const bw = len * 0.06;
    strip(-bw, '#74acdf', bw);
    strip(0, '#ffffff', bw);
    strip(bw, '#74acdf', bw);
    ctx.fillStyle = '#f6b40e';
    ctx.beginPath();
    ctx.arc(len * 0.5, wv(0.5), bw * 0.35, 0, TAU);
    ctx.fill();
    ctx.restore();
  };
  mirror4(ctx, w, h, () => {
    ctx.save();
    ctx.translate(-w / 2, -h / 2);
    acanthus(w * 0.16, h * 0.16, w * 0.085, 0.3, 350);
    acanthus(w * 0.3, h * 0.1, w * 0.05, 1.8, 140);
    acanthus(w * 0.1, h * 0.3, w * 0.05, -1.2, 45);
    acanthus(w * 0.42, h * 0.16, w * 0.035, 2.6, 210);
    acanthus(w * 0.16, h * 0.42, w * 0.035, -2.0, 210);
    ribbon(w * 0.2, h * 0.27, w * 0.2, -0.8);
    ctx.restore();
  });
  // el marco de filetes: tres líneas finas de color con las esquinas en curva
  const frame = (inset, color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.roundRect(inset, inset, w - inset * 2, h - inset * 2, w * 0.06);
    ctx.stroke();
  };
  frame(w * 0.035, '#e8c547', w * 0.006);
  frame(w * 0.048, '#d23a2a', w * 0.003);
  frame(w * 0.058, '#2f6fd6', w * 0.003);
  // el rombo del medio (finito: ahí van las cartas) con TRUCO en letra de filete
  const cx = w / 2;
  const cy = h / 2;
  ctx.strokeStyle = '#e8c547';
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(cx, cy - h * 0.12);
  ctx.quadraticCurveTo(cx + w * 0.05, cy - h * 0.02, cx + w * 0.2, cy);
  ctx.quadraticCurveTo(cx + w * 0.05, cy + h * 0.02, cx, cy + h * 0.12);
  ctx.quadraticCurveTo(cx - w * 0.05, cy + h * 0.02, cx - w * 0.2, cy);
  ctx.quadraticCurveTo(cx - w * 0.05, cy - h * 0.02, cx, cy - h * 0.12);
  ctx.stroke();
  ctx.font = `italic 800 ${Math.round(w * 0.05)}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // la letra fileteada: sombra roja, cuerpo dorado y un brillo
  ctx.fillStyle = '#7a1414';
  ctx.fillText('Truco', cx + w * 0.004, cy + w * 0.005);
  const lg = ctx.createLinearGradient(0, cy - w * 0.03, 0, cy + w * 0.03);
  lg.addColorStop(0, '#fff2a8');
  lg.addColorStop(0.5, '#e8b53a');
  lg.addColorStop(1, '#a8701a');
  ctx.fillStyle = lg;
  ctx.fillText('Truco', cx, cy);
  // florcitas en las puntas del rombo
  for (const [x, y] of [[cx, cy - h * 0.12], [cx, cy + h * 0.12], [cx - w * 0.2, cy], [cx + w * 0.2, cy]]) flower(ctx, x, y, w * 0.014, '#d23a2a', '#e8c547');
}

// ------------------------------------------------------------------ poncho salteño

// Poncho salteño: el rojo punzó tejido (la trama se ve), las dos franjas negras con el guarda pampa de rombos
// escalonados en blanco y ocre, y el fleco negro en los bordes.
function poncho(ctx, w, h) {
  const r = seeded(5);
  ctx.fillStyle = '#a3141a';
  ctx.fillRect(0, 0, w, h);
  // trama de lana: hilos horizontales y verticales apenas distintos
  for (let y = 0; y < h; y += 3) {
    ctx.fillStyle = `rgba(${r() < 0.5 ? '60,0,0' : '255,80,60'},${0.08 + r() * 0.06})`;
    ctx.fillRect(0, y, w, 1.5);
  }
  for (let x = 0; x < w; x += 4) {
    ctx.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.04})`;
    ctx.fillRect(x, 0, 1.5, h);
  }
  // las franjas negras con la guarda, cerca de dos bordes (y finitas en los otros dos)
  const stripe = (y0, height, vertical = false) => {
    ctx.save();
    if (vertical) {
      ctx.translate(w, 0);
      ctx.rotate(Math.PI / 2);
    }
    ctx.fillStyle = '#121010';
    ctx.fillRect(0, y0, w, height);
    // guarda pampa: rombos escalonados
    const u = height / 10;
    for (let x = 0; x < w; x += u * 8) {
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = k % 2 ? '#d9a441' : '#f1ead8';
        const s = (4 - k) * u;
        ctx.beginPath();
        ctx.moveTo(x + u * 4, y0 + height / 2 - s);
        ctx.lineTo(x + u * 4 + s, y0 + height / 2);
        ctx.lineTo(x + u * 4, y0 + height / 2 + s);
        ctx.lineTo(x + u * 4 - s, y0 + height / 2);
        ctx.fill();
      }
      ctx.fillStyle = '#f1ead8';
      ctx.fillRect(x, y0 + u, u * 8, u * 0.5);
      ctx.fillRect(x, y0 + height - u * 1.5, u * 8, u * 0.5);
    }
    ctx.restore();
  };
  stripe(h * 0.12, h * 0.07);
  stripe(h * 0.81, h * 0.07);
  stripe(w * 0.12, w * 0.07, true);
  stripe(w * 0.81, w * 0.07, true);
  // en el medio, un rombo bordado (chico, en tono sobre tono)
  ctx.strokeStyle = 'rgba(241,234,216,0.35)';
  ctx.lineWidth = w * 0.004;
  for (let k = 1; k <= 3; k++) {
    const s = w * 0.05 * k;
    ctx.beginPath();
    ctx.moveTo(w / 2, h / 2 - s);
    ctx.lineTo(w / 2 + s, h / 2);
    ctx.lineTo(w / 2, h / 2 + s);
    ctx.lineTo(w / 2 - s, h / 2);
    ctx.closePath();
    ctx.stroke();
  }
  // fleco
  ctx.strokeStyle = '#120808';
  ctx.lineWidth = 2;
  for (let t = 0; t < w; t += 6) {
    for (const [x0, y0, x1, y1] of [[t, 0, t + 2, h * 0.025], [t, h, t - 2, h * 0.975], [0, t, w * 0.025, t + 2], [w, t, w * 0.975, t - 2]]) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  }
}

// ------------------------------------------------------------------ casino

// Mesa de casino: paño verde profundo con la luz de la lámpara al medio, los arcos y filetes dorados, los cuatro palos
// de la baraja española en medallones y la leyenda alrededor.
function casino(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.05, w / 2, h / 2, w * 0.7);
  g.addColorStop(0, '#1f7a4c');
  g.addColorStop(0.6, '#145a37');
  g.addColorStop(1, '#0b3520');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const gold = '#d9b44a';
  ctx.strokeStyle = gold;
  // arcos concéntricos
  for (const [rr, lw] of [[0.42, 0.006], [0.4, 0.002], [0.24, 0.003]]) {
    ctx.lineWidth = w * lw;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * rr, 0, TAU);
    ctx.stroke();
  }
  // leyenda en el anillo
  ctx.fillStyle = gold;
  ctx.font = `700 ${Math.round(w * 0.022)}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = 'QUIERO RETRUCO · VALE CUATRO · ENVIDO · FALTA ENVIDO · ';
  const R = w * 0.32;
  for (let i = 0; i < text.length * 2; i++) {
    const ch = text[i % text.length];
    const a = (i / (text.length * 2)) * TAU - Math.PI / 2;
    ctx.save();
    ctx.translate(w / 2 + Math.cos(a) * R, h / 2 + Math.sin(a) * R);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  }
  // medallones con los palos (espada, basto, oro, copa), dibujados
  const suit = (x, y, s, kind) => {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(x, y, s * 1.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = gold;
    ctx.lineWidth = w * 0.003;
    ctx.stroke();
    if (kind === 'oro') {
      ctx.fillStyle = '#e8c547';
      ctx.beginPath();
      ctx.arc(x, y, s * 0.8, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#a8701a';
      ctx.lineWidth = s * 0.12;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.5, 0, TAU);
      ctx.stroke();
    } else if (kind === 'copa') {
      ctx.fillStyle = '#d23a2a';
      ctx.beginPath();
      ctx.moveTo(x - s * 0.7, y - s * 0.7);
      ctx.quadraticCurveTo(x, y + s * 0.4, x + s * 0.7, y - s * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e8c547';
      ctx.fillRect(x - s * 0.1, y - s * 0.1, s * 0.2, s * 0.6);
      ctx.fillRect(x - s * 0.4, y + s * 0.5, s * 0.8, s * 0.15);
    } else if (kind === 'espada') {
      ctx.fillStyle = '#4a8ad8';
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s * 0.15, y + s * 0.4);
      ctx.lineTo(x - s * 0.15, y + s * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e8c547';
      ctx.fillRect(x - s * 0.5, y + s * 0.4, s, s * 0.12);
      ctx.fillRect(x - s * 0.07, y + s * 0.5, s * 0.14, s * 0.4);
    } else {
      ctx.strokeStyle = '#7ab35a';
      ctx.lineWidth = s * 0.28;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - s * 0.4, y + s * 0.7);
      ctx.lineTo(x + s * 0.4, y - s * 0.7);
      ctx.stroke();
      ctx.fillStyle = '#4a7a32';
      for (const t of [-0.3, 0, 0.3]) {
        ctx.beginPath();
        ctx.arc(x + t * s, y - t * s * 1.6, s * 0.12, 0, TAU);
        ctx.fill();
      }
    }
  };
  const s = w * 0.035;
  suit(w * 0.5, h * 0.14, s, 'espada');
  suit(w * 0.86, h * 0.5, s, 'oro');
  suit(w * 0.5, h * 0.86, s, 'copa');
  suit(w * 0.14, h * 0.5, s, 'basto');
  // filetes de las esquinas
  mirror4(ctx, w, h, () => {
    ctx.strokeStyle = gold;
    ctx.lineWidth = w * 0.003;
    ctx.beginPath();
    ctx.arc(-w / 2, -h / 2, w * 0.2, 0, Math.PI / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-w / 2, -h / 2, w * 0.17, 0, Math.PI / 2);
    ctx.stroke();
    star(ctx, -w / 2 + w * 0.09, -h / 2 + h * 0.09, w * 0.02, w * 0.008, 8);
    ctx.fillStyle = gold;
    ctx.fill();
  });
}

// ------------------------------------------------------------------ baldosa calcárea

// Baldosas calcáreas (como las de un zaguán de casa chorizo): una grilla de baldosas con rosetón de cuatro hojas y
// esquinas en cuarto de círculo, en bordó, ocre, gris azulado y crema, con el desgaste del tiempo.
function calcareo(ctx, w, h) {
  const r = seeded(8);
  const n = 6;
  const s = w / n;
  const C = { cream: '#ece2cc', red: '#9a3b2c', ochre: '#c8913a', blue: '#4a6478', dark: '#2a2a2e' };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i * s;
      const y = j * s;
      const edge = i === 0 || j === 0 || i === n - 1 || j === n - 1;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, s, s);
      ctx.clip();
      ctx.fillStyle = C.cream;
      ctx.fillRect(x, y, s, s);
      if (edge) {
        // guarda del borde: rombos y franjas
        ctx.fillStyle = C.red;
        ctx.fillRect(x, y, s, s);
        ctx.fillStyle = C.cream;
        ctx.beginPath();
        ctx.moveTo(x + s / 2, y + s * 0.1);
        ctx.lineTo(x + s * 0.9, y + s / 2);
        ctx.lineTo(x + s / 2, y + s * 0.9);
        ctx.lineTo(x + s * 0.1, y + s / 2);
        ctx.fill();
        flower(ctx, x + s / 2, y + s / 2, s * 0.18, C.ochre, C.dark, { n: 4, ratio: 0.55 });
      } else {
        // cuartos de círculo en las esquinas: al juntarse las baldosas forman círculos
        for (const [cx, cy] of [[x, y], [x + s, y], [x, y + s], [x + s, y + s]]) {
          ctx.fillStyle = C.blue;
          ctx.beginPath();
          ctx.arc(cx, cy, s * 0.32, 0, TAU);
          ctx.fill();
          ctx.fillStyle = C.cream;
          ctx.beginPath();
          ctx.arc(cx, cy, s * 0.2, 0, TAU);
          ctx.fill();
          ctx.fillStyle = C.red;
          ctx.beginPath();
          ctx.arc(cx, cy, s * 0.1, 0, TAU);
          ctx.fill();
        }
        // rosetón de cuatro hojas al medio
        for (let k = 0; k < 4; k++) leaf(ctx, x + s / 2, y + s / 2, s * 0.34, s * 0.12, (k / 4) * TAU + Math.PI / 4, C.red, C.cream);
        flower(ctx, x + s / 2, y + s / 2, s * 0.12, C.ochre, C.dark, { n: 8, ratio: 0.5 });
      }
      // desgaste: manchas claras y algún pique
      for (let k = 0; k < 14; k++) {
        ctx.fillStyle = `rgba(255,250,235,${r() * 0.12})`;
        ctx.beginPath();
        ctx.arc(x + r() * s, y + r() * s, r() * s * 0.15, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      // junta
      ctx.strokeStyle = 'rgba(40,30,20,0.45)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, s, s);
    }
  }
}

// ------------------------------------------------------------------ noche de campo

// Noche de campo: azul de medianoche con la Vía Láctea cruzando en diagonal, la Cruz del Sur, estrellas de varios
// tamaños, la luna en cuarto creciente en una esquina y la silueta de la pampa con un ombú y un molino en el borde.
function noche(ctx, w, h) {
  const r = seeded(17);
  const g = ctx.createRadialGradient(w * 0.3, h * 0.3, w * 0.05, w / 2, h / 2, w * 0.8);
  g.addColorStop(0, '#1d2d5a');
  g.addColorStop(1, '#070b1d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // la Vía Láctea: una franja de bruma y polvo de estrellas
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-0.6);
  for (let i = 0; i < 90; i++) {
    const x = (r() - 0.5) * w * 1.4;
    const y = (r() - 0.5) * h * 0.18 + Math.sin(x / w * 4) * h * 0.04;
    const rr = w * (0.03 + r() * 0.06);
    const gg = ctx.createRadialGradient(x, y, 0, x, y, rr);
    gg.addColorStop(0, `rgba(${r() < 0.3 ? '255,210,230' : '200,215,255'},0.12)`);
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.5})`;
    ctx.fillRect((r() - 0.5) * w * 1.4, (r() - 0.5) * h * 0.22, 1.3, 1.3);
  }
  ctx.restore();
  // estrellas sueltas, algunas con destello
  for (let i = 0; i < 700; i++) {
    const x = r() * w;
    const y = r() * h;
    const big = r();
    ctx.fillStyle = big > 0.97 ? '#fff4d6' : `rgba(220,230,255,${0.3 + r() * 0.6})`;
    ctx.beginPath();
    ctx.arc(x, y, big > 0.97 ? 2.6 : 0.6 + r() * 1.1, 0, TAU);
    ctx.fill();
    if (big > 0.985) {
      ctx.strokeStyle = 'rgba(255,244,214,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 9, y);
      ctx.lineTo(x + 9, y);
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x, y + 9);
      ctx.stroke();
    }
  }
  // la Cruz del Sur
  for (const [x, y, s] of [[0.24, 0.18, 7], [0.24, 0.36, 6.5], [0.15, 0.27, 5.5], [0.32, 0.26, 6], [0.27, 0.3, 3.5]]) {
    ctx.fillStyle = '#ffffff';
    star(ctx, w * x, h * y, s * 2.2, s * 0.6, 4, 0);
    ctx.fill();
  }
  // la luna en cuarto creciente con su halo
  const mx = w * 0.8;
  const my = h * 0.74;
  const halo = ctx.createRadialGradient(mx, my, w * 0.04, mx, my, w * 0.2);
  halo.addColorStop(0, 'rgba(255,248,220,0.35)');
  halo.addColorStop(1, 'rgba(255,248,220,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(mx - w * 0.2, my - w * 0.2, w * 0.4, w * 0.4);
  // la medialuna: el borde de afuera y, al revés, el de adentro
  ctx.fillStyle = '#f6efd6';
  ctx.beginPath();
  ctx.arc(mx, my, w * 0.055, 0.35 * Math.PI, 1.75 * Math.PI);
  ctx.arc(mx + w * 0.022, my - w * 0.01, w * 0.048, 1.62 * Math.PI, 0.45 * Math.PI, true);
  ctx.closePath();
  ctx.fill();
  // la pampa en silueta alrededor (en los cuatro bordes), con un ombú y un molino
  ctx.fillStyle = '#05070f';
  for (let k = 0; k < 4; k++) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((k * Math.PI) / 2);
    ctx.translate(-w / 2, -h / 2);
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h - h * 0.03 - Math.sin(x / w * 9 + k) * h * 0.008);
    ctx.lineTo(w, h);
    ctx.fill();
    if (k === 0) {
      // ombú
      ctx.fillRect(w * 0.7, h * 0.9, w * 0.012, h * 0.08);
      for (const [dx, dy, rr] of [[0, -0.02, 0.04], [-0.03, 0, 0.03], [0.03, 0, 0.03]]) {
        ctx.beginPath();
        ctx.arc(w * (0.706 + dx), h * (0.9 + dy), w * rr, 0, TAU);
        ctx.fill();
      }
    }
    if (k === 2) {
      // molino
      ctx.fillRect(w * 0.3, h * 0.88, w * 0.004, h * 0.1);
      ctx.strokeStyle = '#05070f';
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        ctx.beginPath();
        ctx.moveTo(w * 0.302, h * 0.88);
        ctx.lineTo(w * 0.302 + Math.cos(a) * w * 0.02, h * 0.88 + Math.sin(a) * w * 0.02);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------------ mesa de bodegón

// Mesa de bodegón: tablones de roble gastado con vetas, nudos y clavos, marcas de vasos, una quemadura de cigarrillo
// y el escudo de la casa marcado a fuego en el medio.
function madera(ctx, w, h) {
  const r = seeded(21);
  const planks = 7;
  const pw = w / planks;
  for (let i = 0; i < planks; i++) {
    const x = i * pw;
    const base = 26 + r() * 6;
    const lum = 30 + r() * 8;
    ctx.fillStyle = `hsl(${base},45%,${lum}%)`;
    ctx.fillRect(x, 0, pw, h);
    // vetas: líneas onduladas a lo largo
    for (let k = 0; k < 26; k++) {
      const vx = x + r() * pw;
      ctx.strokeStyle = `hsla(${base - 4},50%,${lum - 10 + r() * 6}%,${0.25 + r() * 0.3})`;
      ctx.lineWidth = 1 + r() * 2.5;
      ctx.beginPath();
      ctx.moveTo(vx, 0);
      for (let y = 0; y <= h; y += 20) ctx.lineTo(vx + Math.sin(y / (60 + k * 3) + k) * 6, y);
      ctx.stroke();
    }
    // nudos con las vetas que los rodean
    for (let k = 0; k < 2; k++) {
      const nx = x + pw * (0.3 + r() * 0.4);
      const ny = r() * h;
      for (let ring = 6; ring > 0; ring--) {
        ctx.strokeStyle = `hsla(${base - 6},55%,${lum - 14 + ring}%,0.6)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(nx, ny, ring * 4, ring * 9, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.fillStyle = `hsl(${base - 8},50%,${lum - 18}%)`;
      ctx.beginPath();
      ctx.ellipse(nx, ny, 5, 10, 0, 0, TAU);
      ctx.fill();
    }
    // la junta y los clavos
    ctx.fillStyle = 'rgba(20,10,5,0.75)';
    ctx.fillRect(x, 0, 3, h);
    ctx.fillStyle = 'rgba(255,220,170,0.12)';
    ctx.fillRect(x + 3, 0, 2, h);
    for (const y of [h * 0.08, h * 0.92]) {
      ctx.fillStyle = '#2a2a2a';
      ctx.beginPath();
      ctx.arc(x + pw / 2, y, 5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(x + pw / 2 - 1.5, y - 1.5, 1.6, 0, TAU);
      ctx.fill();
    }
  }
  // marcas de vasos y una quemadura
  for (let i = 0; i < 6; i++) {
    const x = r() * w;
    const y = r() * h;
    if (Math.hypot(x - w / 2, y - h / 2) < w * 0.2) continue;
    ctx.strokeStyle = 'rgba(40,15,5,0.25)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, w * 0.03, r() * 3, r() * 3 + 4.5);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(20,8,2,0.6)';
  ctx.beginPath();
  ctx.ellipse(w * 0.78, h * 0.3, w * 0.012, w * 0.005, 0.6, 0, TAU);
  ctx.fill();
  // el escudo de la casa marcado a fuego (dos naipes cruzados y el nombre)
  const cx = w / 2;
  const cy = h / 2;
  ctx.strokeStyle = 'rgba(30,12,4,0.7)';
  ctx.fillStyle = 'rgba(30,12,4,0.7)';
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.13, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.12, 0, TAU);
  ctx.stroke();
  // el ancho de espada: la hoja, la guarda y el puño con su pomo
  ctx.beginPath();
  ctx.moveTo(cx, cy - w * 0.085);
  ctx.lineTo(cx + w * 0.013, cy + w * 0.02);
  ctx.lineTo(cx - w * 0.013, cy + w * 0.02);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx - w * 0.04, cy + w * 0.02, w * 0.08, w * 0.009);
  ctx.fillRect(cx - w * 0.005, cy + w * 0.029, w * 0.01, w * 0.03);
  ctx.beginPath();
  ctx.arc(cx, cy + w * 0.064, w * 0.008, 0, TAU);
  ctx.fill();
  ctx.font = `800 ${Math.round(w * 0.022)}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BODEGÓN', cx, cy + w * 0.1);
}

export const PANOS = { alfombra, almendro, fileteado, poncho, casino, calcareo, noche, madera, estrellada };

/**
 * Qué parte de la textura se ve en la mesa (en partes del lado): el rectángulo del polígono de `sides` lados metido en
 * el círculo (con 4, un cuadrado de 0.7; con 6, el hexágono). La vista de la tienda recorta lo mismo.
 */
export function paintBox(sides = 4) {
  const k = 0.99; // apenas más afuera que la costura (0.965)
  if (sides === 6) return { w: k, h: k * Math.cos(Math.PI / 6) };
  const s = k * Math.SQRT1_2;
  return { w: s, h: s };
}

/**
 * El paño pintado entero en un canvas de lado `size`: el dibujo, la trama de la tela, los bordes en sombra y la
 * costura alrededor (con la forma de la mesa: sides). Para la mesa y para la vista previa de la tienda.
 */
export function drawPano(canvas, look, sides = 4, { seam = true } = {}) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  // la mesa muestra solo el polígono metido en el círculo de la textura: el dibujo va en su rectángulo (un poco más
  // grande que la costura, así la guarda queda adentro y la costura le pasa por encima)
  const box = paintBox(sides);
  const bw = w * box.w;
  const bh = h * box.h;
  ctx.fillStyle = look.felt?.[2] || '#111';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate((w - bw) / 2, (h - bh) / 2);
  ctx.beginPath();
  ctx.rect(0, 0, bw, bh);
  ctx.clip();
  PANOS[look.draw]?.(ctx, bw, bh, sides);
  ctx.restore();
  // trama de la tela (líneas finas cruzadas)
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = '#000';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  for (let x = 0; x < w; x += 4) ctx.fillRect(x, 0, 1, h);
  ctx.globalAlpha = 1;
  // bordes en sombra (el centro casi igual, para que las cartas se lean)
  const g = ctx.createRadialGradient(w / 2, h / 2, bw * 0.2, w / 2, h / 2, bw * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0.04)');
  g.addColorStop(0.65, 'rgba(0,0,0,0.06)');
  g.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (!seam) return;
  ctx.strokeStyle = look.thread || 'rgba(226,204,166,0.6)';
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = Math.max(2, w * 0.003);
  ctx.setLineDash([w * 0.014, w * 0.009]);
  ctx.beginPath();
  for (let k = 0; k <= sides; k++) {
    const a = (k * Math.PI * 2) / sides + Math.PI / sides;
    const x = w * (0.5 + 0.5 * 0.965 * Math.sin(a));
    const y = h * (0.5 + 0.5 * 0.965 * Math.cos(a));
    if (k) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ noche estrellada (pintada con relieve)

// El cielo de la noche estrellada en el paño: remolinos de pinceladas azules y turquesa, estrellas como soles de
// anillos y la luna naranja; en el medio, más oscuro y tranquilo (ahí van las cartas). Lo pinta impasto.js: cada
// pincelada con su sombra y su brillo, como acrílico cargado.
const NOCHE = {
  deep: ['#0b1a4a', '#10245e', '#132c6e'],
  cobalt: ['#1d3f8f', '#244c9c', '#2b5aa8', '#1f4a95'],
  turq: ['#3f7fb0', '#4f93b8', '#5aa3bf', '#6fb3c4'],
  pale: ['#8fc0cf', '#a9d1d6', '#c6e0d8'],
  gold: ['#f6d54a', '#f9e27a', '#f2c230', '#e8b42a'],
  orange: ['#f3a43a', '#f7b84f', '#e88a2a'],
  cream: ['#fdf6d8', '#fff9e6'],
};
const pk = (a, r) => a[Math.floor(r() * a.length)];

function nocheSurface(w, h, { swirls, stars, moon, calm = 0.24, seed = 7, scale = 1 }) {
  const S = surface(w, h, '#0e2058');
  const near = (x, y) => Math.min(...swirls.map((s) => Math.hypot(x - s.x * w, y - s.y * h) / (s.r * w)));
  const field = (x, y) => {
    let ax = Math.cos(Math.sin(x / (w * 0.12) + y / (h * 0.3)) * 0.5);
    let ay = Math.sin(Math.sin(x / (w * 0.12) + y / (h * 0.3)) * 0.5);
    for (const s of swirls) {
      const dx = x - s.x * w;
      const dy = y - s.y * h;
      const wgt = Math.exp(-((Math.hypot(dx, dy) / (s.r * w * 1.5)) ** 2)) * 4;
      const t = Math.atan2(dy, dx) + (s.k * Math.PI) / 2;
      ax += Math.cos(t) * wgt;
      ay += Math.sin(t) * wgt;
    }
    return Math.atan2(ay, ax);
  };
  const color = (x, y, r) => {
    const d = Math.hypot(x / w - 0.5, y / h - 0.5);
    const sw = near(x, y);
    if (d < calm) return pk(r() < 0.75 ? NOCHE.deep : NOCHE.cobalt, r); // el centro, tranquilo
    if (sw < 0.4 && r() < 0.6) return pk(NOCHE.cream, r);
    if (sw < 0.9) return pk(r() < 0.5 ? NOCHE.pale : NOCHE.turq, r);
    return pk(r() < 0.55 ? NOCHE.cobalt : r() < 0.6 ? NOCHE.turq : NOCHE.deep, r);
  };
  strokes(S, { n: Math.round(2600 * scale), angle: field, paint: color, len: 44 * Math.sqrt(scale), width: 13 * Math.sqrt(scale), seed, load: 0.55 });
  strokes(S, { n: Math.round(4200 * scale), angle: field, paint: color, len: 30 * Math.sqrt(scale), width: 7 * Math.sqrt(scale), seed: seed + 1, load: 0.8 });
  strokes(S, { n: Math.round(3600 * scale), angle: field, paint: color, len: 20 * Math.sqrt(scale), width: 3.5 * Math.sqrt(scale), seed: seed + 2, load: 1 });
  for (const st of stars) swirlDot(S, st.x * w, st.y * h, st.r * w, [...NOCHE.pale, ...NOCHE.turq, ...NOCHE.gold, ...NOCHE.gold, ...NOCHE.cream], { rings: 5, seed: Math.round(st.x * 997), width: 4 * Math.sqrt(scale) });
  if (moon) {
    swirlDot(S, moon.x * w, moon.y * h, moon.r * w * 1.8, [...NOCHE.turq, ...NOCHE.pale, ...NOCHE.gold, ...NOCHE.orange, ...NOCHE.cream], { rings: 6, seed: 41, width: 5 * Math.sqrt(scale) });
    swirlDot(S, moon.x * w, moon.y * h, moon.r * w, [...NOCHE.orange, ...NOCHE.gold, ...NOCHE.orange], { rings: 4, seed: 43, width: 6 * Math.sqrt(scale) });
    swirlDot(S, moon.x * w + moon.r * w * 0.45, moon.y * h - moon.r * w * 0.2, moon.r * w * 0.7, [...NOCHE.cobalt, ...NOCHE.turq], { rings: 3, seed: 45, width: 6 * Math.sqrt(scale) });
  }
  return S;
}

// El paño: remolinos alrededor, estrellas y la luna en una esquina, el centro tranquilo, y abajo el pueblo dormido
// con sus ventanitas y el ciprés subiendo por el costado.
function estrellada(ctx, w, h) {
  const S = nocheSurface(w, h, {
    swirls: [{ x: 0.22, y: 0.24, r: 0.12, k: 1 }, { x: 0.78, y: 0.3, r: 0.1, k: -1 }, { x: 0.3, y: 0.78, r: 0.09, k: -1 }, { x: 0.76, y: 0.74, r: 0.11, k: 1 }],
    stars: [{ x: 0.12, y: 0.12, r: 0.022 }, { x: 0.42, y: 0.1, r: 0.018 }, { x: 0.62, y: 0.14, r: 0.02 }, { x: 0.9, y: 0.12, r: 0.016 }, { x: 0.1, y: 0.5, r: 0.018 }, { x: 0.9, y: 0.55, r: 0.02 }, { x: 0.55, y: 0.9, r: 0.017 }, { x: 0.12, y: 0.9, r: 0.016 }, { x: 0.4, y: 0.32, r: 0.012 }],
    moon: { x: 0.86, y: 0.86, r: 0.045 },
    scale: (w * h) / (1024 * 1024),
  });
  ctx.drawImage(S.color, 0, 0);
  // la luz del relieve (sin luz de verdad en la mesa, se marca un poco más el lomo de las pinceladas)
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.18;
  ctx.drawImage(S.height, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

/** El dorso de la noche estrellada: un remolino grande al medio con la luna, estrellas, y el marco de pinceladas. */
const backCache = new Map(); // se pinta una vez: en la partida cambia con cada turno
export function paintBack(id, w = 256, h = 394) {
  if (id !== 'estrellada') return null;
  const key = `${id}|${w}|${h}`;
  if (backCache.has(key)) return backCache.get(key);
  const out = paintBackNow(w, h);
  backCache.set(key, out);
  return out;
}

function paintBackNow(w, h) {
  const S = nocheSurface(w, h, {
    swirls: [{ x: 0.5, y: 0.45, r: 0.3, k: 1 }, { x: 0.25, y: 0.82, r: 0.16, k: -1 }],
    stars: [{ x: 0.2, y: 0.14, r: 0.07 }, { x: 0.78, y: 0.2, r: 0.06 }, { x: 0.8, y: 0.78, r: 0.06 }, { x: 0.18, y: 0.6, r: 0.05 }],
    moon: { x: 0.5, y: 0.45, r: 0.11 },
    calm: 0,
    seed: 23,
    scale: 0.22,
  });
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fbfaf6';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 16);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(12, 12, w - 24, h - 24, 10);
  ctx.clip();
  ctx.drawImage(S.color, 0, 0);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.2;
  ctx.drawImage(S.height, 0, 0);
  ctx.restore();
  // marco dorado de pintura
  ctx.strokeStyle = '#e8b42a';
  ctx.lineWidth = 3;
  ctx.strokeRect(22, 22, w - 44, h - 44);
  return c;
}
