// Menú principal (con sesión iniciada), como el de chess.com: barra lateral con Jugar, Mesas, Partidas, Amigos,
// Ranking, Tienda, Taquilla y Perfil. Las reglas de la mesa (modo, puntos, flor…) se eligen adentro, en la sala de espera.
import { ROUTES, CODE_RE, APP_NAME, MODES, ELO_START, ELO, modeLabel } from './config.js';
import { $, $$, esc, store, KEYS, api, avatarHtml } from './dom.js';
import { currentMe, loadMe } from './auth.js';
import { loadHistory, rowHtml } from './history.js';
import { initShop, loadShop } from './shop.js';
import { initSocial, loadFriends, loadRanking } from './social.js';
import { initProfile, loadProfile, loadSettings } from './profile.js';
import { initRejoin, checkRejoin, stopRejoin } from './rejoin.js';

const LOBBY_REFRESH_MS = 7000;
const PUBLIC_MAX = 5; // en la pantalla de inicio, como mucho
const RECENT_MAX = 4;
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
    api(ROUTES.api.rooms, { mode, isPublic: false, rated: false, options: {} }).then((r) => {
      sessionStorage.setItem(KEYS.entered, r.code);
      if (practice) sessionStorage.setItem(KEYS.autostart, r.code);
      go(r.code);
    });

  // armar una mesa privada: se abre con el último modo que usaste y las reglas se tocan adentro
  const dialog = $('#create-dialog');
  $('#create').addEventListener('click', () => {
    dialog.querySelector(`[name=mode][value="${lastMode()}"]`).checked = true;
    dialog.showModal();
  });
  dialog.addEventListener('close', tryGo(async () => {
    if (dialog.returnValue !== 'ok') return;
    const f = new FormData($('#create-form'));
    store.set(KEYS.lastMode, f.get('mode'));
    const r = await api(ROUTES.api.rooms, { mode: f.get('mode'), target: Number(f.get('target')), rated: f.get('rated') === '1', isPublic: f.get('isPublic') === '1', options: {} });
    sessionStorage.setItem(KEYS.entered, r.code); // las reglas las pusiste vos
    go(r.code);
  }));

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
  initShop(paintMe);
  initSocial(paintMe);
  initProfile();
  initRejoin(go);
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
  if (tab === 'jugar') loadRecent();
  if (tab === 'partidas') loadHistory();
  if (tab === 'amigos') loadFriends();
  if (tab === 'ranking') loadRanking();
  if (tab === 'tienda') loadShop('tienda');
  if (tab === 'taquilla') loadShop('personalizar');
  if (tab === 'perfil') loadProfile();
  if (tab === 'ajustes') loadSettings();
}

// Las últimas partidas en la pantalla de inicio.
async function loadRecent() {
  try {
    const { matches } = await api(ROUTES.api.matches);
    $('#recent-list').innerHTML = matches.slice(0, RECENT_MAX).map(rowHtml).join('');
    $('#recent-empty').classList.toggle('hidden', matches.length > 0);
  } catch {
    $('#recent-empty').classList.remove('hidden');
  }
}

// Tu usuario arriba, las monedas y el ELO de cada modo.
function paintMe() {
  const p = currentMe()?.profile;
  if (!p) return;
  const games = Object.keys(MODES).reduce((n, m) => n + (p[`games_${m}`] || 0), 0);
  for (const id of ['#me-av', '#profile-av']) $(id).innerHTML = avatarHtml(p);
  $('#me-name').textContent = p.username;
  $('#profile-name').textContent = p.username;
  $('#set-name').textContent = p.username;
  $('#profile-coins').textContent = p.coins;
  $('#profile-since').textContent = p.created_at ? `Juega desde ${new Date(p.created_at).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}` : '';
  $('#me-sub').textContent = `${p.coins} monedas`;
  $('#profile-email').textContent = currentMe().user.email;
  $('#shop-coins').textContent = p.coins;
  const eloText = (m) => `${p[`elo_${m}`] ?? ELO_START}${(p[`games_${m}`] || 0) < ELO.provisional ? '?' : ''}`;
  for (const m of Object.keys(MODES)) $(`#quick-elo-${m}`).textContent = `ELO ${eloText(m)}`;
  $('#profile-elo').innerHTML = Object.keys(MODES)
    .map((m) => {
      const n = p[`games_${m}`] || 0;
      return `<div class="pf-rating"><span>${esc(modeLabel(m))}</span><b>${esc(eloText(m))}</b><small>${n === 1 ? '1 partida' : `${n} partidas`}</small></div>`;
    })
    .join('');
  $('#profile-elo').title = games ? '' : 'Todavía no jugaste partidas por ELO';
}

const tableHtml = ([r, isLive]) => {
  const state = isLive ? (r.score ? `van ${r.score[0]} a ${r.score[1]}` : 'jugando') : `${r.free === 1 ? 'falta 1' : `faltan ${r.free}`}`;
  return `<div class="m-table">
    <span class="m-tmode">${esc(modeLabel(r.mode))}</span>
    <span class="m-tinfo"><b>${esc(r.players.filter(Boolean).join(', ') || '—')}</b><small>a ${r.target} · ${r.rated === false ? 'sin puntuar' : 'por ELO'} · ${esc(state)}${r.options ? ' · ' + esc(r.options) : ''}</small></span>
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
    $('#public-none').classList.toggle('hidden', all.length > 0);
    const shown = list.children.length;
    $('#public-count').textContent = all.length > shown ? `${shown} de ${all.length}` : '';
  } catch {
    wrap.classList.add('hidden');
  }
}

export function showMenu() {
  $('#game').classList.add('hidden');
  $('#menu').classList.remove('hidden');
  document.title = APP_NAME;
  checkRejoin();
  paintMe();
  // al volver de una partida cambian el ELO y las monedas
  loadMe().then((me) => me?.profile && paintMe());
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
  stopRejoin();
  $('#menu').classList.add('hidden');
  $('#game').classList.remove('hidden');
}
