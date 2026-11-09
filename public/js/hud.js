// Piezas de la interfaz que no dependen de la sala: anotador, ayuda, caras de las señas.
import { SENAS, ROOM_OPTIONS } from './config.js';
import { drawCharacter, W as CW, H as CH } from './characters.js';
import { esc } from './dom.js';
import { SCORE } from './theme.js';

// Frases rápidas del chat.

// Recorte de la cara de un personaje con una expresión (para el menú de señas y el espejo).
const FACE_CROP = { x: 106, y: 100, size: 300 };
export function drawFace(target, look, expr, extra = {}) {
  const full = document.createElement('canvas');
  full.width = CW;
  full.height = CH;
  drawCharacter(full.getContext('2d'), look, { expr, cards: 0, ...extra });
  const ctx = target.getContext('2d');
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(full, FACE_CROP.x, FACE_CROP.y, FACE_CROP.size, FACE_CROP.size, 0, 0, target.width, target.height);
  return target;
}

// Palitos como en el anotador de verdad: cuatro forman un cuadrado y el quinto lo cruza.
// Los grupos van uno debajo del otro; en partidas a 30 una raya separa las malas de las buenas.
export function palitos(pts, target) {
  const groups = Math.ceil(target / 5);
  const gap = 6;
  const size = 16;
  const rule = target === 30 ? 12 : 0;
  const h = groups * (size + gap) + rule;
  const wob = [0.6, -0.8, 0.4, -0.5, 0.7, -0.3]; // variaciones fijas: parecen hechos a mano
  let svg = `<svg viewBox="0 0 28 ${h}" width="28" height="${h}" aria-label="${pts} puntos">`;
  for (let gI = 0; gI < groups; gI++) {
    const n = Math.max(0, Math.min(5, pts - gI * 5));
    const y = gI * (size + gap) + (rule && gI >= 3 ? rule : 0) + 4;
    const x = 5;
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
    svg += `<line x1="0" y1="${y}" x2="28" y2="${y}" stroke="${SCORE.rule}" stroke-width="1" stroke-dasharray="3 3"/>`;
  }
  return svg + '</svg>';
}

export function helpHtml() {
  const senas = Object.values(SENAS).map((s) => `<li><b>${esc(s.label)}</b>: ${esc(s.desc)}</li>`).join('');
  return `<div class="card-box">
    <div class="row between"><h2>Cómo se juega</h2><button class="btn small" data-close>✕</button></div>
    <h3>Controles</h3>
    <ul>
      <li>Arrastrá con el mouse o el dedo para mirar a los costados y para abajo (a la mesa). También <kbd>A</kbd>/<kbd>D</kbd> y <kbd>W</kbd>/<kbd>S</kbd>, o “Mirar a” arriba al centro.</li>
      <li>Tocá una carta para elegirla y tocala de nuevo (o doble clic) para tirarla. Con la carta elegida también podés: <b>Tapada</b> (boca abajo, desde segunda) o <b>Dos encimadas</b>. Atajos: <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> y <kbd>Enter</kbd>.</li>
      <li>“te mira” al lado de un nombre quiere decir que esa persona te está mirando. Las señas no avisan nada: hay que verlas en la cara. Los personajes no parpadean solos: si alguien cierra los ojos, es la seña de “ciego”.</li>
      <li>Mantené apretada la <kbd>Z</kbd> (o el botón Zoom) para hacer zoom y ver mejor la mesa o una cara.</li>
    </ul>
    <h3>Señas (las ven solo los que te miran en ese momento)</h3><ul>${senas}<li>De palabra (por el chat, y las escuchan todos): “las viejas” = 27, “las perdedoras” = 29.</li><li>En equipo podés <b>consultarle a tu compañero</b>: “¿Tenés tantos, compañero?” o “¿Le canto truco?”. Te contesta <b>Cantá</b>, <b>Callado</b> (seguir jugando sin cantarlo, que lo canten los otros: a veces es porque va a la pesca) o <b>No tengo nada</b> (y si vos tenés, igual podés cantar). En primera, si no sos pie, también podés preguntarle al pie <b>¿Pongo o voy?</b>: <b>Poné</b> (tirá alta y ganá la primera) o <b>Vení</b> (tirá baja, mata él). Los bots también te consultan y se consultan entre ellos. Si te cantan algo, antes de contestar le podés preguntar <b>¿Queremos?</b>: te dice <b>No tengo nada</b>, <b>Te hablan a vos</b>, <b>Algo tengo</b> o <b>Estoy cargado</b>. Se dice en voz alta: los rivales lo escuchan.</li></ul>
    <h3>Cantos</h3>
    <ul>
      <li>Se canta <b>en tu turno</b>, antes de tirar la carta. Para contestar (quiero, no quiero, subir) no hace falta que sea tu turno.</li>
      <li>El envido se canta en primera, antes de tirar tu carta. “El envido está primero”: si te cantan truco, podés cantar envido antes de contestar.</li>
      <li>Retruco y vale cuatro: solo el equipo que tiene el quiero, en su turno (o contestando).</li>
      <li>En 2 vs 2 y 3 vs 3 el envido lo canta y lo contesta el <b>pie</b> de cada equipo (el que reparte y el que corta).</li>
      <li>En equipo el truco se canta recién desde segunda (se puede desactivar en la sala).</li>
    </ul>
    <h3>Opciones de la sala</h3>
    <ul>
      <li><b>Flor</b>: tres cartas del mismo palo. Es obligatorio cantarla en primera, antes de tirar (también contestando un envido o un truco). Anula el envido. Si el otro equipo no tiene flor: 3 puntos. Si tiene, contesta: <i>con flor quiero</i> (gana la mejor, 3), <i>con flor me achico</i> (3 para el que cantó), <i>contraflor</i> (6) o <i>contraflor al resto</i>.</li>
      <li><b>Muestra</b>: después de repartir se da vuelta una carta. Las <b>piezas</b> (2, 4, 5, 11 y 10 de ese palo) son las más altas, por encima del ancho de espada; si la muestra es pieza, el 12 toma su lugar. En el envido valen 30, 29, 28, 27 y 27 (más la carta más alta de las otras) y sirven de cualquier palo para la flor.</li>
      <li><b>No permitir trampas</b>: no se pueden tirar dos encimadas ni mentir en el envido (y no hace falta mostrar). Se ve quién ganó cada ronda.</li>
    </ul>
    <h3>Puntos</h3>
    <ul>
      <li>Truco 2 (no querido 1) · Retruco 3 (2) · Vale cuatro 4 (3). Sin cantar: 1.</li>
      <li>Envido 2 · Real envido 3 · Falta envido: lo que le falta al que va ganando. No querido: 1, o lo que se había querido antes.</li>
      <li>Los puntos se anotan al terminar la mano. El que gana el envido tiene que <b>mostrar las cartas</b>: si no las muestra y le reclaman, o si cantó un número falso, pierde los puntos del envido (el truco no cambia).</li>
      <li>En equipo, irse al mazo es por todo el equipo: termina la mano. En primera sin envido cantado, el rival suma 1 de envido + lo del truco.</li>
      <li><b>Cartas quemadas</b>: valen como un 4 en la ronda en que cuentan (el envido no cambia). Se quema la carta tapada, la que tirás <b>fuera de turno</b> (es tu jugada de esa ronda: cuando te toca, se te saltea) y la de arriba de dos encimadas si la de abajo no mató.</li>
      <li><b>Dos encimadas</b> (trampa): la de abajo juega ahora y nadie la ve; la de arriba es tu carta de la ronda siguiente. Si la de abajo mata, la de arriba vale normal (arrancás vos la siguiente); si no mata (perdés, mata tu compañero o es parda), se quema. Mientras dura la ronda parece una carta normal; al terminar, si se quemó, se ve quemada y cualquier rival te puede pedir que muestres las dos (no hay puntos de por medio).</li>
    </ul>
    <div class="help-ok"><button class="btn primary" data-close>Entendido</button></div>
  </div>`;
}

// Lee las opciones (checkboxes data-opt) dentro de `root` y devuelve { flor, muestra, trampas }.
export function readOptionChecks(root) {
  const out = {};
  for (const o of ROOM_OPTIONS) {
    const el = root.querySelector(`[data-opt="${o.key}"]`);
    if (el) out[o.key] = o.invert ? !el.checked : el.checked;
  }
  return out;
}
