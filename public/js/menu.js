// Menú principal (con sesión iniciada): arriba tu usuario y las pestañas Jugar, Mesas, Historial, Tienda,
// Personalizar y Perfil. Las reglas de la mesa (modo, puntos, flor…) se eligen adentro, en la sala de espera.
import { ROUTES, CODE_RE, APP_NAME, MODES, ELO_START, modeLabel } from './config.js';
import { $, $$, esc, store, KEYS, api, initial } from './dom.js';
import { currentMe } from './auth.js';

const LOBBY_REFRESH_MS = 7000;
const PUBLIC_MAX = 3; // en la pestaña Jugar, como mucho; en pantallas bajas, las que entren sin scroll
const TAB_KEY = 'truco-menu-tab';
let lobbyTimer = null;

// go(code): entra a la sala (lo resuelve main.js). logout(): cierra la sesión.
export function initMenu(go, logout) {
  const tryGo = (fn) => async (e) => {
    try {
      await fn(e);
    } catch (err) {
      alert(err.message);
    }
  };
  const lastMode = () => store.get(KEYS.lastMode) || '1v1';
  const create = (mode, practice) =>
    api(ROUTES.api.rooms, { mode, isPublic: false, options: {} }).then((r) => {
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
  onMode($('#quick'), async (mode) => go((await api(ROUTES.api.quick, { mode })).code));

  const code = $('#join-code');
  code.addEventListener('input', () => (code.value = code.value.replace(/\D/g, '').slice(0, 4)));
  $('#join-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const c = code.value.trim();
    if (!CODE_RE.test(c)) return code.focus();
    const info = await api(ROUTES.api.room(c)).catch(() => ({ exists: false }));
    if (!info.exists) return alert('No hay ninguna mesa con ese código');
    go(c);
  });

  const onTable = (e) => {
    const b = e.target.closest('button[data-code]');
    if (!b) return;
    if (b.dataset.spectate) sessionStorage.setItem(KEYS.spectate, b.dataset.code);
    go(b.dataset.code);
  };
  $('#public-list').addEventListener('click', onTable);
  $('#public-all').addEventListener('click', onTable);

  // pestañas (cualquier botón con data-tab, también el usuario de arriba y "Ver todas")
  $('#menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b) showTab(b.dataset.tab);
  });
  $('#logout').addEventListener('click', logout);
}

function showTab(tab) {
  if (!$(`.h-panel[data-panel="${tab}"]`)) tab = 'jugar';
  $$('.h-panel').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== tab));
  $$('#tabs button').forEach((b) => {
    b.classList.toggle('on', b.dataset.tab === tab);
    b.toggleAttribute('aria-current', b.dataset.tab === tab);
  });
  try {
    sessionStorage.setItem(TAB_KEY, tab);
  } catch {}
  if (tab === 'jugar' || tab === 'mesas') loadPublic();
}

// Tu usuario arriba, las monedas y el ELO de cada modo.
function paintMe() {
  const p = currentMe()?.profile;
  if (!p) return;
  const games = Object.keys(MODES).reduce((n, m) => n + (p[`games_${m}`] || 0), 0);
  for (const id of ['#me-av', '#profile-av']) $(id).textContent = initial(p.username);
  $('#me-name').textContent = p.username;
  $('#profile-name').textContent = p.username;
  $('#me-sub').textContent = `${p.coins} monedas`;
  $('#profile-email').textContent = currentMe().user.email;
  $('#shop-coins').textContent = p.coins;
  $('#profile-elo').innerHTML = Object.keys(MODES)
    .map((m) => {
      const n = p[`games_${m}`] || 0;
      return `<div class="p-stat"><small>${esc(modeLabel(m))}</small><b>${esc(p[`elo_${m}`] ?? ELO_START)}</b><span>${n === 1 ? '1 partida' : `${n} partidas`}</span></div>`;
    })
    .join('');
  $('#profile-elo').title = games ? '' : 'Todavía no jugaste partidas por ELO: todos arrancan en ' + ELO_START;
}

const tableHtml = ([r, isLive]) => {
  const state = isLive ? (r.score ? `van ${r.score[0]} a ${r.score[1]}` : 'jugando') : `${r.free === 1 ? 'falta 1' : `faltan ${r.free}`}`;
  return `<div class="m-table">
    <span class="m-tmode">${esc(modeLabel(r.mode))}</span>
    <span class="m-tinfo"><b>${esc(r.players.filter(Boolean).join(', ') || '—')}</b><small>a ${r.target} · ${esc(state)}${r.options ? ' · ' + esc(r.options) : ''}</small></span>
    <button class="btn small ${isLive ? '' : 'primary'}" data-code="${esc(r.code)}" ${isLive ? 'data-spectate="1"' : ''}>${isLive ? 'Mirar' : 'Sentarme'}</button>
  </div>`;
};

// Mesas públicas: primero las que esperan gente, después las que se están jugando.
async function loadPublic() {
  const wrap = $('#public-wrap');
  try {
    const { open, live } = await api(ROUTES.api.lobby);
    const all = [...open.map((r) => [r, false]), ...live.map((r) => [r, true])];
    $('#public-all').innerHTML = all.map(tableHtml).join('');
    $('#public-empty').classList.toggle('hidden', !!all.length);

    const list = $('#public-list');
    list.innerHTML = all.slice(0, PUBLIC_MAX).map(tableHtml).join('');
    wrap.classList.toggle('hidden', !all.length);
    // si el menú no entra en pantalla, se sacan mesas de la lista corta (en "Mesas" están todas)
    const menu = $('#menu');
    while (list.children.length > 1 && menu.scrollHeight > menu.clientHeight) list.lastElementChild.remove();
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
  paintMe();
  let tab = 'jugar';
  try {
    tab = sessionStorage.getItem(TAB_KEY) || tab;
  } catch {}
  showTab(tab);
  clearInterval(lobbyTimer);
  lobbyTimer = setInterval(loadPublic, LOBBY_REFRESH_MS);
}

export function hideMenu() {
  clearInterval(lobbyTimer);
  $('#menu').classList.add('hidden');
  $('#game').classList.remove('hidden');
}
