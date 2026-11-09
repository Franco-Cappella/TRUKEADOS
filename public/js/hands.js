// Manos en primera persona (dibujadas en canvas, mismo estilo que los personajes).
// - holdBack: antebrazo y palma de la mano izquierda, detrás del abanico de cartas.
// - holdThumb: el pulgar que va por encima de las cartas.
// - reach: la mano derecha que agarra una carta y la apoya en la mesa (con el antebrazo hacia abajo a la derecha).

import { INK, mix } from './theme.js';

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx);
  return c;
}

function stroke(ctx, fill, lw = 4) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw;
  ctx.stroke();
}

// Mano izquierda (vista desde los ojos): el antebrazo entra desde abajo a la izquierda,
// la palma queda detrás de las cartas y asoman las puntas de los dedos a la derecha.
export function drawHoldBack(skin, sleeve) {
  return canvas(512, 512, (ctx) => {
    // manga
    ctx.beginPath();
    ctx.moveTo(40, 512);
    ctx.lineTo(150, 330);
    ctx.quadraticCurveTo(210, 300, 262, 352);
    ctx.lineTo(210, 512);
    ctx.closePath();
    stroke(ctx, sleeve, 5);
    ctx.strokeStyle = mix(sleeve, 0.7);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(120, 470);
    ctx.quadraticCurveTo(150, 420, 140, 380);
    ctx.stroke();
    // puño de la manga
    ctx.beginPath();
    ctx.moveTo(150, 330);
    ctx.quadraticCurveTo(210, 300, 262, 352);
    ctx.lineTo(250, 372);
    ctx.quadraticCurveTo(200, 330, 158, 352);
    ctx.closePath();
    stroke(ctx, mix(sleeve, 1.15), 4);
    // muñeca y palma
    ctx.beginPath();
    ctx.moveTo(170, 340);
    ctx.bezierCurveTo(170, 250, 220, 190, 300, 196);
    ctx.bezierCurveTo(372, 202, 392, 270, 360, 320);
    ctx.bezierCurveTo(330, 360, 270, 372, 238, 352);
    ctx.closePath();
    stroke(ctx, skin, 5);
    // sombra plana de las cartas sobre la palma, con borde duro
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(170, 340);
    ctx.bezierCurveTo(170, 250, 220, 190, 300, 196);
    ctx.bezierCurveTo(372, 202, 392, 270, 360, 320);
    ctx.bezierCurveTo(330, 360, 270, 372, 238, 352);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = mix(skin, 0.74);
    ctx.beginPath();
    ctx.moveTo(250, 380);
    ctx.quadraticCurveTo(300, 300, 400, 250);
    ctx.lineTo(400, 400);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // puntas de los dedos que asoman por el costado derecho de las cartas
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(388 + i * 6, 150 + i * 34, 26, 15, -0.5 + i * 0.1, 0, Math.PI * 2);
      stroke(ctx, skin, 4);
      ctx.strokeStyle = mix(skin, 0.6);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(398 + i * 6, 146 + i * 34);
      ctx.lineTo(408 + i * 6, 156 + i * 34);
      ctx.stroke();
    }
  });
}

// Pulgar por encima de las cartas (abajo a la izquierda del abanico).
export function drawHoldThumb(skin) {
  return canvas(256, 256, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(30, 230);
    ctx.bezierCurveTo(40, 160, 90, 100, 150, 86);
    ctx.bezierCurveTo(190, 76, 214, 104, 196, 130);
    ctx.bezierCurveTo(170, 160, 120, 190, 96, 240);
    ctx.closePath();
    stroke(ctx, skin, 5);
    // uña
    ctx.beginPath();
    ctx.ellipse(176, 104, 18, 12, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = mix(skin, 1.08);
    ctx.fill();
    ctx.strokeStyle = mix(skin, 0.6);
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

// Mano derecha vista desde arriba, con la palma hacia abajo, apoyando la carta con las yemas.
// Los dedos apuntan hacia arriba a la izquierda (donde está la carta: punto 104, 250 del canvas)
// y el antebrazo sale hacia abajo a la derecha, fuera de la pantalla.
export function drawReach(skin, sleeve) {
  return canvas(512, 512, (ctx) => {
    const shade = mix(skin, 0.86);
    const cloth = sleeve;
    // antebrazo (piel) y manga
    ctx.beginPath();
    ctx.moveTo(250, 300);
    ctx.lineTo(330, 250);
    ctx.lineTo(420, 360);
    ctx.lineTo(352, 420);
    ctx.closePath();
    stroke(ctx, shade, 4);
    ctx.beginPath();
    ctx.moveTo(352, 330);
    ctx.lineTo(420, 280);
    ctx.lineTo(540, 420);
    ctx.lineTo(540, 540);
    ctx.lineTo(460, 540);
    ctx.lineTo(330, 400);
    ctx.closePath();
    stroke(ctx, cloth, 5);
    ctx.beginPath();
    ctx.moveTo(352, 330);
    ctx.lineTo(420, 280);
    ctx.lineTo(432, 296);
    ctx.lineTo(362, 348);
    ctx.closePath();
    stroke(ctx, mix(cloth, 1.18), 3);
    // dorso de la mano
    ctx.beginPath();
    ctx.moveTo(176, 236);
    ctx.bezierCurveTo(186, 196, 236, 176, 276, 192);
    ctx.bezierCurveTo(318, 210, 336, 256, 318, 292);
    ctx.bezierCurveTo(300, 324, 258, 332, 226, 316);
    ctx.bezierCurveTo(196, 300, 170, 270, 176, 236);
    ctx.closePath();
    stroke(ctx, skin, 4.5);
    // sombra dura del lado de la muñeca
    ctx.save();
    ctx.clip();
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(214, 340);
    ctx.quadraticCurveTo(286, 286, 300, 180);
    ctx.lineTo(360, 180);
    ctx.lineTo(360, 340);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // nudillos
    ctx.strokeStyle = mix(skin, 0.6);
    ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.arc(196 + k * 10, 222 + k * 18, 5, 0.6, 2.4);
      ctx.stroke();
    }
    // cuatro dedos estirados hacia la carta (índice arriba, meñique abajo)
    const fingers = [
      { x: 196, y: 210, len: 92, w: 17, a: -2.62 },
      { x: 194, y: 232, len: 98, w: 17, a: -2.82 },
      { x: 198, y: 256, len: 88, w: 16, a: -3.0 },
      { x: 208, y: 280, len: 70, w: 14, a: 3.05 },
    ];
    for (const f of fingers) {
      const ex = f.x + Math.cos(f.a) * f.len;
      const ey = f.y + Math.sin(f.a) * f.len;
      const nx = -Math.sin(f.a) * f.w * 0.5;
      const ny = Math.cos(f.a) * f.w * 0.5;
      ctx.beginPath();
      ctx.moveTo(f.x + nx, f.y + ny);
      ctx.lineTo(ex + nx, ey + ny);
      ctx.arc(ex, ey, f.w * 0.5, f.a + Math.PI / 2, f.a - Math.PI / 2, true);
      ctx.lineTo(f.x - nx, f.y - ny);
      ctx.closePath();
      stroke(ctx, skin, 3.5);
      // uña y pliegue de la falange
      ctx.beginPath();
      ctx.ellipse(ex - Math.cos(f.a) * 6, ey - Math.sin(f.a) * 6, f.w * 0.3, f.w * 0.22, f.a, 0, Math.PI * 2);
      ctx.fillStyle = mix(skin, 1.08);
      ctx.fill();
      ctx.strokeStyle = mix(skin, 0.6);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const mx = f.x + Math.cos(f.a) * f.len * 0.55;
      const my = f.y + Math.sin(f.a) * f.len * 0.55;
      ctx.beginPath();
      ctx.moveTo(mx + nx * 0.7, my + ny * 0.7);
      ctx.lineTo(mx - nx * 0.7, my - ny * 0.7);
      ctx.stroke();
    }
    // pulgar por debajo
    ctx.beginPath();
    ctx.moveTo(214, 300);
    ctx.quadraticCurveTo(170, 316, 140, 300);
    ctx.quadraticCurveTo(128, 290, 140, 282);
    ctx.quadraticCurveTo(176, 284, 206, 274);
    ctx.closePath();
    stroke(ctx, shade, 3.5);
  });
}
