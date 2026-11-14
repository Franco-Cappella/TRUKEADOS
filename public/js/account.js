// Pantallas de entrada: iniciar sesión (Google o mail y contraseña), crear la cuenta y elegir el nombre.
// main.js decide cuál se ve: sin sesión, #login; con sesión pero sin perfil, #onboard.
import { AUTH, SKILL_LEVELS, DEFAULT_LEVEL, COINS } from './config.js';
import { $, $$, esc, initial } from './dom.js';
import { signInWithGoogle, signInWithPassword, signUp, chooseUsername, signOut } from './auth.js';
import { initStage, stageMode, stageReply } from './entrada.js';

const SCREENS = ['#boot', '#login', '#onboard'];

/** Muestra una de las pantallas de entrada (o ninguna, con null) y esconde el menú y la partida. */
export function showEntry(which) {
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== which);
  if (which) {
    $('#menu').classList.add('hidden');
    $('#game').classList.add('hidden');
  }
}

/** Aviso en la pantalla de entrada (p. ej. que la cuenta no se pudo leer); vacío para quitarlo. */
export function showLoginError(text) {
  $('#login-msg').textContent = text || '';
  $('#login-msg').classList.toggle('bad', !!text);
  stageReply(text, true);
}

// done(): ya hay sesión y perfil (main.js sigue con la ruta). out(): volver al inicio de sesión.
export function initAccount(done, out) {
  let creating = false; // el formulario de mail sirve para entrar o para crear la cuenta
  const msg = (text, bad = true) => {
    $('#login-msg').textContent = text;
    $('#login-msg').classList.toggle('bad', bad);
    stageReply(text, bad);
  };
  const paintMode = () => {
    $('#login-title').textContent = creating ? 'Creá tu cuenta' : 'Entrá para jugar';
    $('#login-submit').textContent = creating ? 'Crear cuenta' : 'Entrar';
    $('#login-switch-text').textContent = creating ? '¿Ya tenés cuenta?' : '¿Primera vez?';
    $('#login-switch').textContent = creating ? 'Entrá' : 'Creá tu cuenta';
    $('#login-pass').autocomplete = creating ? 'new-password' : 'current-password';
    $('#login-pass').placeholder = creating ? `Contraseña (${AUTH.minPassword} o más)` : 'Contraseña';
    $('#login-pass').minLength = creating ? AUTH.minPassword : 0;
    msg('');
    stageMode(creating);
  };
  $('#login-switch').onclick = () => {
    creating = !creating;
    paintMode();
  };
  initStage();
  paintMode();

  const busy = (on) => $$('#login button').forEach((b) => (b.disabled = on));
  $('#login-google').onclick = async () => {
    busy(true);
    try {
      await signInWithGoogle(); // la página se va a Google y vuelve
    } catch (err) {
      msg(err.message);
      busy(false);
    }
  };
  $('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = $('#login-email').value.trim();
    const pass = $('#login-pass').value;
    busy(true);
    try {
      if (!creating) await signInWithPassword(email, pass);
      else if (!(await signUp(email, pass))) {
        msg(`Te mandamos un mail a ${email}: tocá el enlace y volvés acá con la sesión iniciada.`, false);
        return;
      }
      $('#login-pass').value = '';
      await done();
    } catch (err) {
      msg(err.message);
    } finally {
      busy(false);
    }
  };

  // elegir el nombre (una sola vez)
  const name = $('#onboard-name');
  $('#onboard-hint').textContent = AUTH.usernameHint + '.';
  $('#onboard-levels').insertAdjacentHTML('beforeend', SKILL_LEVELS.map((l) => `<label class="a-level">
    <input type="radio" name="level" value="${esc(l.key)}" ${l.key === DEFAULT_LEVEL ? 'checked' : ''}>
    <span><b>${esc(l.label)}</b><small>${esc(l.desc)}</small></span><em>${l.elo}</em></label>`).join(''));
  $('#onboard-form').insertAdjacentHTML('beforeend', `<p class="a-switch">Te regalamos ${COINS.signup} monedas para empezar.</p>`);
  name.addEventListener('input', () => {
    $('#onboard-av').textContent = initial(name.value);
    $('#onboard-msg').textContent = '';
  });
  $('#onboard-form').onsubmit = async (e) => {
    e.preventDefault();
    const v = name.value.trim();
    if (!AUTH.usernameRe.test(v)) {
      $('#onboard-msg').textContent = AUTH.usernameHint;
      return name.focus();
    }
    try {
      await chooseUsername(v, new FormData($('#onboard-form')).get('level'));
      await done();
    } catch (err) {
      $('#onboard-msg').textContent = err.message;
    }
  };
  $('#onboard-out').onclick = async () => {
    await signOut();
    out();
  };
}
