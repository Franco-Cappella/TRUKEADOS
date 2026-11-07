// Pantalla de inicio: nombre, partida rápida, crear sala, unirse con código y mesas públicas.
import { ROUTES, CODE_RE } from './config.js';
import { $, $$, esc, store, KEYS, myPid, api } from './dom.js';
import { optionChecks, readOptionChecks } from './hud.js';
import { roomOptions, APP_NAME } from './config.js';

const LOBBY_REFRESH_MS = 7000;
let lobbyTimer = null;

export function myName() {
  const v = $('#name').value.trim();
  if (v) store.set(KEYS.name, v);
  return v || store.get(KEYS.name) || 'Invitado';
}

// go(code): entra a la sala (lo resuelve main.js).
export function initMenu(go) {
  $('#name').value = store.get(KEYS.name, '');
  $('#create-options').innerHTML = optionChecks(roomOptions());
  for (const seg of $$('#menu .seg')) {
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    });
  }
  const segVal = (name) => $(`.seg[data-name="${name}"] .on`)?.dataset.v;
  const tryGo = (fn) => async (e) => {
    try {
      await fn(e);
    } catch (err) {
      alert(err.message);
    }
  };

  $('#quick').addEventListener('click', tryGo(async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const r = await api(ROUTES.api.quick, { pid: myPid(), name: myName(), mode: b.dataset.mode });
    go(r.code);
  }));

  const create = tryGo(async (practice) => {
    const r = await api(ROUTES.api.rooms, {
      pid: myPid(),
      name: myName(),
      mode: segVal('mode'),
      target: Number(segVal('target')),
      isPublic: !practice && segVal('isPublic') === '1',
      options: readOptionChecks($('#create-options')),
    });
    if (practice) sessionStorage.setItem(KEYS.autostart, r.code);
    go(r.code);
  });
  $('#create-form').addEventListener('submit', (e) => {
    e.preventDefault();
    create(false);
  });
  $('#practice').addEventListener('click', () => create(true));

  $('#join-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('#join-code').value.trim().toUpperCase();
    if (!CODE_RE.test(code)) return alert('El código tiene 5 letras o números');
    const info = await api(ROUTES.api.room(code)).catch(() => ({ exists: false }));
    if (!info.exists) return alert('No existe una sala con ese código');
    myName();
    go(code);
  });
  $('#refresh').addEventListener('click', loadPublic);
  $('#public-list').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-code]');
    if (!b) return;
    myName();
    if (b.dataset.spectate) sessionStorage.setItem(KEYS.spectate, b.dataset.code);
    go(b.dataset.code);
  });
}

async function loadPublic() {
  const el = $('#public-list');
  try {
    const { open, live } = await api(ROUTES.api.lobby);
    const card = (r, isLive) => `
      <div class="room">
        <div class="top"><span class="mode">${esc(r.mode.replace('v', ' vs '))}</span><span class="muted">${r.target} pts · ${isLive ? 'jugando' : `${r.free} lugar${r.free === 1 ? '' : 'es'}`}</span></div>
        ${r.options ? `<div class="muted">${esc(r.options)}</div>` : ''}
        <div class="players">${esc(r.players.filter(Boolean).join(', ') || '—')}</div>
        ${isLive && r.score ? `<div class="muted">Van ${r.score[0]} a ${r.score[1]}</div>` : ''}
        <button class="btn ${isLive ? '' : 'primary'} small" data-code="${esc(r.code)}" ${isLive ? 'data-spectate="1"' : ''}>${isLive ? 'Mirar' : 'Sentarme'}</button>
      </div>`;
    const html = open.map((r) => card(r, false)).join('') + live.map((r) => card(r, true)).join('');
    el.innerHTML = html || '<p class="hint">No hay mesas públicas ahora. ¡Abrí una con “Partida rápida”!</p>';
  } catch {
    el.innerHTML = '<p class="hint">No se pudo cargar la lista.</p>';
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
