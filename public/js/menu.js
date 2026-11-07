// Pantalla de inicio: tu nombre, armar una mesa, entrar con código, partida rápida, práctica y mesas públicas.
// Las reglas de la mesa (modo, puntos, flor…) se eligen adentro, en la sala de espera.
import { ROUTES, CODE_RE, APP_NAME, modeLabel } from './config.js';
import { $, esc, store, KEYS, myPid, api, savedName, initial } from './dom.js';

const LOBBY_REFRESH_MS = 7000;
const PUBLIC_MAX = 3; // mesas públicas a la vista como mucho; en pantallas bajas, las que entren sin scroll
let lobbyTimer = null;

// Guarda el nombre escrito (si hay) y devuelve el que se usa en la mesa.
function myName() {
  const v = $('#name').value.trim();
  if (v) store.set(KEYS.name, v);
  return v || savedName();
}

// go(code): entra a la sala (lo resuelve main.js).
export function initMenu(go) {
  const name = $('#name');
  name.value = store.get(KEYS.name, '');
  const paintAv = () => ($('#name-av').textContent = initial(name.value));
  name.addEventListener('input', paintAv);
  paintAv();

  const tryGo = (fn) => async (e) => {
    try {
      await fn(e);
    } catch (err) {
      alert(err.message);
    }
  };
  const lastMode = () => store.get(KEYS.lastMode) || '1v1';
  const create = (mode, practice) =>
    api(ROUTES.api.rooms, { pid: myPid(), name: myName(), mode, isPublic: false, options: {} }).then((r) => {
      if (practice) sessionStorage.setItem(KEYS.autostart, r.code);
      go(r.code);
    });

  // armar una mesa privada: se abre con el último modo que usaste y las reglas se tocan adentro
  $('#create').addEventListener('click', tryGo(() => create(lastMode(), false)));

  // filas de modos (partida rápida y práctica): recuerdan el modo para la próxima mesa
  const onMode = (el, fn) =>
    el.addEventListener('click', tryGo(async (e) => {
      const mode = e.target.closest('button[data-mode]')?.dataset.mode;
      if (!mode) return;
      store.set(KEYS.lastMode, mode);
      await fn(mode);
    }));
  onMode($('#practice'), (mode) => create(mode, true));
  onMode($('#quick'), async (mode) => go((await api(ROUTES.api.quick, { pid: myPid(), name: myName(), mode })).code));

  const code = $('#join-code');
  code.addEventListener('input', () => (code.value = code.value.replace(/\D/g, '').slice(0, 4)));
  $('#join-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const c = code.value.trim();
    if (!CODE_RE.test(c)) return code.focus();
    const info = await api(ROUTES.api.room(c)).catch(() => ({ exists: false }));
    if (!info.exists) return alert('No hay ninguna mesa con ese código');
    myName();
    go(c);
  });

  $('#public-list').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-code]');
    if (!b) return;
    myName();
    if (b.dataset.spectate) sessionStorage.setItem(KEYS.spectate, b.dataset.code);
    go(b.dataset.code);
  });
}

// Lista corta de mesas públicas: primero las que esperan gente, después las que se están jugando.
async function loadPublic() {
  const wrap = $('#public-wrap');
  try {
    const { open, live } = await api(ROUTES.api.lobby);
    const all = [...open.map((r) => [r, false]), ...live.map((r) => [r, true])];
    wrap.classList.toggle('hidden', !all.length);
    const list = $('#public-list');
    list.innerHTML = all
      .slice(0, PUBLIC_MAX)
      .map(([r, isLive]) => {
        const state = isLive ? (r.score ? `van ${r.score[0]} a ${r.score[1]}` : 'jugando') : `${r.free === 1 ? 'falta 1' : `faltan ${r.free}`}`;
        return `<div class="m-table">
          <span class="m-tmode">${esc(modeLabel(r.mode))}</span>
          <span class="m-tinfo"><b>${esc(r.players.filter(Boolean).join(', ') || '—')}</b><small>a ${r.target} · ${esc(state)}${r.options ? ' · ' + esc(r.options) : ''}</small></span>
          <button class="btn small ${isLive ? '' : 'primary'}" data-code="${esc(r.code)}" ${isLive ? 'data-spectate="1"' : ''}>${isLive ? 'Mirar' : 'Sentarme'}</button>
        </div>`;
      })
      .join('');
    // si el menú no entra en pantalla, se sacan mesas de la lista; si no entra ninguna, la lista se esconde
    // (la partida rápida igual te sienta en esas mesas)
    const menu = $('#menu');
    while (list.children.length && menu.scrollHeight > menu.clientHeight) list.lastElementChild.remove();
    const shown = list.children.length;
    wrap.classList.toggle('hidden', !shown);
    $('#public-count').textContent = all.length > shown ? `${shown} de ${all.length}` : '';
  } catch {
    wrap.classList.add('hidden');
  }
}

export function showMenu() {
  $('#game').classList.add('hidden');
  $('#menu').classList.remove('hidden');
  document.title = APP_NAME;
  loadPublic();
  clearInterval(lobbyTimer);
  lobbyTimer = setInterval(loadPublic, LOBBY_REFRESH_MS);
}

export function hideMenu() {
  clearInterval(lobbyTimer);
  $('#menu').classList.add('hidden');
  $('#game').classList.remove('hidden');
}
