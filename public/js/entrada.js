// La mesa de la pantalla de entrada: un rival dibujado que te mira, hace señas y canta. Es un adorno
// (aria-hidden): no cambia nada del inicio de sesión. Los tiempos y los textos están en LOGIN_STAGE (config.js).
import { LOGIN_STAGE, SENAS, SENA_MS } from './config.js';
import { drawCharacter, lookFor, W, H } from './characters.js';
import { $ } from './dom.js';

const quiet = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let look = null;
let full = null; // el dibujo entero, fuera de pantalla; a la vista va el recorte
let creating = false;
let said = '';

function draw(expr = 'neutral', talking = false) {
  const face = $('#lg-face');
  if (!face) return;
  look ||= lookFor(LOGIN_STAGE.rival, LOGIN_STAGE.seat);
  if (!full) {
    full = document.createElement('canvas');
    full.width = W;
    full.height = H;
  }
  drawCharacter(full.getContext('2d'), look, { expr, talking, cards: 3 });
  const { y, h } = LOGIN_STAGE.crop;
  const ctx = face.getContext('2d');
  ctx.clearRect(0, 0, face.width, face.height);
  ctx.drawImage(full, 0, y, W, h, 0, 0, face.width, face.height);
}

function say(text) {
  if (text === said) return;
  said = text;
  const b = $('#lg-bubble');
  b.textContent = text;
  b.style.animation = 'none'; // vuelve a entrar con `pop`, como un canto nuevo
  void b.offsetWidth;
  b.style.animation = '';
  if (quiet()) return;
  draw('neutral', true);
  setTimeout(() => draw(), 420);
}

// cuánto del formulario está completo: 0 nada, 1 el mail, 2 el mail y la contraseña
function step() {
  const mail = $('#login-email');
  if (!mail.value.trim() || !mail.checkValidity()) return 0;
  return $('#login-pass').value ? 2 : 1;
}
const canto = () => LOGIN_STAGE.cantos[creating ? 'crear' : 'entrar'][step()];

/** El formulario cambió entre entrar y crear la cuenta: cambia la escalera de cantos. */
export function stageMode(isCreating) {
  creating = isCreating;
  say(canto());
}

/** Lo que contestó el inicio de sesión: un error (bad) o un aviso bueno; vacío vuelve al canto que toca. */
export function stageReply(text, bad) {
  if (!text) return say(canto());
  say(LOGIN_STAGE.cantos[bad ? 'error' : 'listo']);
  draw(bad ? 'frown' : 'neutral');
}

function sena(id) {
  const s = SENAS[id];
  draw(s.expr);
  $('#lg-sena-label').textContent = s.label;
  $('#lg-sena-desc').textContent = s.desc;
  $('#lg-sena').classList.add('on');
  setTimeout(() => {
    $('#lg-sena').classList.remove('on');
    draw();
  }, SENA_MS);
}

export function initStage() {
  $('#lg-name').textContent = LOGIN_STAGE.rival;
  draw();
  for (const id of ['#login-email', '#login-pass']) $(id).addEventListener('input', () => say(canto()));
  if (quiet()) return; // sin señas que cambian solas
  let i = 0;
  setInterval(() => {
    if ($('#login').classList.contains('hidden') || document.hidden) return;
    sena(LOGIN_STAGE.senas[i++ % LOGIN_STAGE.senas.length]);
  }, LOGIN_STAGE.senaEvery);
}
