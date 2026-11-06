// Piezas de la interfaz que no dependen de la sala: anotador, ayuda, caras de las señas.
import { SENAS } from './config.js';
import { drawCharacter, W as CW, H as CH } from './characters.js';
import { esc } from './dom.js';
import { SCORE } from './theme.js';

// Frases rápidas del chat.
export const QUICK_PHRASES = ['¡Buenas!', 'Jugá, che', 'Uh, qué mano…', 'Las viejas', 'Las perdedoras', '¡Qué suerte tenés!', 'Bien jugado', 'Me voy a la parda', '¿Truco?', 'Uy, se me cayó'];

// Recorte de la cara de un personaje con una expresión (para el menú de señas y el espejo).
const FACE_CROP = { x: 106, y: 100, size: 300 };
export function drawFace(target, look, expr) {
  const full = document.createElement('canvas');
  full.width = CW;
  full.height = CH;
  drawCharacter(full.getContext('2d'), look, { expr, cards: 0 });
  const ctx = target.getContext('2d');
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(full, FACE_CROP.x, FACE_CROP.y, FACE_CROP.size, FACE_CROP.size, 0, 0, target.width, target.height);
  return target;
}

// Palitos como en el anotador de verdad: cuatro forman un cuadrado y el quinto lo cruza.
// Los grupos van uno debajo del otro; en partidas a 30 una raya separa las malas de las buenas.
export function palitos(pts, target) {
  const groups = Math.ceil(target / 5);
  const gap = 8;
  const size = 22;
  const rule = target === 30 ? 12 : 0;
  const h = groups * (size + gap) + rule;
  const wob = [0.6, -0.8, 0.4, -0.5, 0.7, -0.3]; // variaciones fijas: parecen hechos a mano
  let svg = `<svg viewBox="0 0 34 ${h}" width="34" height="${h}" aria-label="${pts} puntos">`;
  for (let gI = 0; gI < groups; gI++) {
    const n = Math.max(0, Math.min(5, pts - gI * 5));
    const y = gI * (size + gap) + (rule && gI >= 3 ? rule : 0) + 4;
    const x = 6;
    const w = wob[gI % wob.length];
    const lines = [
      [x, y + w, x, y + size],
      [x, y, x + size, y - w],
      [x + size, y, x + size + w, y + size],
      [x, y + size, x + size, y + size + w],
      [x + 2, y + size - 2, x + size - 2, y + 2],
    ];
    lines.forEach((l, i) => {
      const on = i < n;
      svg += `<line x1="${l[0]}" y1="${l[1]}" x2="${l[2]}" y2="${l[3]}" stroke="${on ? SCORE.stick : SCORE.stickOff}" stroke-width="${on ? 2.6 : 1.4}" stroke-linecap="round"/>`;
    });
  }
  if (rule) {
    const y = 3 * (size + gap) + rule / 2 - 2;
    svg += `<line x1="0" y1="${y}" x2="34" y2="${y}" stroke="${SCORE.rule}" stroke-width="1" stroke-dasharray="3 3"/>`;
  }
  return svg + '</svg>';
}

export function helpHtml() {
  const senas = Object.values(SENAS).map((s) => `<li><b>${esc(s.label)}</b>: ${esc(s.desc)}</li>`).join('');
  return `<div class="card-box">
    <div class="row between"><h2>Cómo se juega</h2><button class="btn small" data-close>✕</button></div>
    <h3>Controles</h3>
    <ul>
      <li>Arrastrá con el mouse o el dedo para mirar a los costados y para abajo (a la mesa). También <kbd>A</kbd>/<kbd>D</kbd> y <kbd>W</kbd>/<kbd>S</kbd>, o los botones de la izquierda.</li>
      <li>Tocá una carta para elegirla y después: <b>Tirar</b>, <b>Tirar tapada</b> (boca abajo, desde segunda; no gana la ronda) o <b>Dos encimadas</b> (trampa: la de abajo es la que juega y la de arriba queda <b>quemada</b>, se pierde y todos la ven quemada; un rival te puede pedir que muestres las dos). Doble clic la tira directo. Atajos: <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> y <kbd>Enter</kbd>.</li>
      <li>“te mira” al lado de un nombre quiere decir que esa persona te está mirando. Las señas no avisan nada: hay que verlas en la cara. Los personajes no parpadean solos: si alguien cierra los ojos, es la seña de “ciego”.</li>
      <li>Mantené apretada la <kbd>Z</kbd> (o el botón Zoom) para hacer zoom y ver mejor la mesa o una cara.</li>
    </ul>
    <h3>Señas (las ven solo los que te miran en ese momento)</h3><ul>${senas}<li>De palabra (por el chat, y las escuchan todos): “las viejas” = 27, “las perdedoras” = 29.</li></ul>
    <h3>Cantos</h3>
    <ul>
      <li>Se canta <b>en tu turno</b>, antes de tirar la carta. Para contestar (quiero, no quiero, subir) no hace falta que sea tu turno.</li>
      <li>El envido se canta en primera, antes de tirar tu carta. “El envido está primero”: si te cantan truco, podés cantar envido antes de contestar.</li>
      <li>Retruco y vale cuatro: solo el equipo que tiene el quiero, en su turno (o contestando).</li>
      <li>En 2 vs 2 y 3 vs 3 el envido lo canta y lo contesta el <b>pie</b> de cada equipo (el que reparte y el que corta).</li>
      <li>En equipo el truco se canta recién desde segunda (se puede desactivar en la sala).</li>
    </ul>
    <h3>Puntos</h3>
    <ul>
      <li>Truco 2 (no querido 1) · Retruco 3 (2) · Vale cuatro 4 (3). Sin cantar: 1.</li>
      <li>Envido 2 · Real envido 3 · Falta envido: lo que le falta al que va ganando. No querido: 1, o lo que se había querido antes.</li>
      <li>Los puntos se anotan al terminar la mano. El que gana el envido tiene que <b>mostrar las cartas</b>: si no las muestra y le reclaman, o si cantó un número falso, pierde los puntos del envido (el truco no cambia).</li>
      <li>En equipo, irse al mazo es por todo el equipo: termina la mano. En primera sin envido cantado, el rival suma 1 de envido + lo del truco.</li>
      <li>Dos encimadas: cualquier rival te puede pedir que muestres las dos. No hay puntos de por medio: solo se ve la de abajo.</li>
    </ul>
  </div>`;
}
