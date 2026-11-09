// Cartel del menú cuando te fuiste de una partida que sigue: cuánto te queda para volver y el botón para hacerlo.
import { ROUTES, MODES, modeLabel } from './config.js';
import { $, api, esc, store, KEYS } from './dom.js';

const POLL_MS = 3000;
const NOTICE_MS = 6000;

let go = () => {};
let poll = null;
let tick = null;
let deadline = null;
let forfeit = false;

const box = () => $('#rejoin');

function stopTimers() {
  clearInterval(poll);
  clearInterval(tick);
  poll = tick = null;
}

function hide() {
  stopTimers();
  box().classList.add('hidden');
  box().innerHTML = '';
}

function paintLeft() {
  const el = $('#rejoin-left');
  if (!el) return;
  if (deadline == null) return void (el.textContent = 'Tu partida sigue esperándote.');
  const s = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  el.textContent = forfeit ? `Si no volvés en ${s} s, perdés la partida.` : `Si no volvés en ${s} s, juega un bot en tu lugar.`;
}

async function refresh() {
  const code = store.get(KEYS.activeRoom);
  if (!code) return hide();
  const had = !box().classList.contains('hidden');
  let m;
  try {
    m = await api(ROUTES.api.roomMine(code));
  } catch {
    return; // sin conexión: se vuelve a probar
  }
  if (!m.playing) {
    store.set(KEYS.activeRoom, '');
    stopTimers();
    if (!had) return hide();
    box().innerHTML = '<p class="rj-text"><b>Se terminó la partida</b><span>No volviste a tiempo.</span></p>';
    setTimeout(hide, NOTICE_MS);
    return;
  }
  deadline = m.left == null ? null : Date.now() + m.left;
  forfeit = !!m.forfeit;
  const mine = m.myTeam;
  box().innerHTML = `<p class="rj-text"><b>Estás en una partida</b><span>${esc(MODES[m.mode] ? modeLabel(m.mode) : '')} · van ${esc(m.score[mine])} a ${esc(m.score[1 - mine])}. <span id="rejoin-left"></span></span></p>
    <button class="btn primary" type="button" data-code="${esc(code)}">Reconectar</button>`;
  box().classList.remove('hidden');
  paintLeft();
  if (!poll) {
    poll = setInterval(refresh, POLL_MS);
    tick = setInterval(paintLeft, 250);
  }
}

export function initRejoin(goToRoom) {
  go = goToRoom;
  box().addEventListener('click', (e) => {
    const b = e.target.closest('[data-code]');
    if (b) go(b.dataset.code);
  });
}

export const checkRejoin = () => void refresh();
export const stopRejoin = hide;
