// Arranque del cliente: rutas (/ = menú, /sala/CÓDIGO = partida) y eventos fijos de la interfaz.
// La lógica de la sala está en room-client.js; la escena 3D en scene.js.
import { TableScene, preloadCards } from './scene.js';
import { lookFor } from './characters.js';
import { SENAS, ROUTES, APP_NAME } from './config.js';
import { FONT } from './theme.js';
import { $, $$, esc, savedName } from './dom.js';
import { isVoiceOn, toggleVoice } from './audio.js';
import { QUICK_PHRASES, helpHtml, drawFace, readOptionChecks } from './hud.js';
import { initMenu, showMenu, hideMenu } from './menu.js';
import { RoomClient } from './room-client.js';

let scene = null;
let room = null;

function go(code) {
  history.pushState({}, '', ROUTES.room(code));
  route();
}

function goHome() {
  history.pushState({}, '', ROUTES.home);
  route();
}

function route() {
  const m = location.pathname.match(ROUTES.roomRe);
  if (m) return openRoom(m[1].toUpperCase());
  room?.close();
  room = null;
  showMenu();
}

function openRoom(code) {
  hideMenu();
  if (!scene) {
    scene = new TableScene($('#stage'));
    window.__truco = { scene, get room() { return room; } }; // para depurar desde la consola
    preloadCards();
    bindGameUI();
  }
  scene.resize();
  room?.close();
  room = new RoomClient(code, scene, { onNotFound: goHome });
}

// Eventos de los elementos fijos de la pantalla de partida (se enlazan una sola vez).
function bindGameUI() {
  $('#leave').onclick = goHome;
  $('#code-chip').onclick = () => {
    if (!room) return;
    navigator.clipboard?.writeText(room.link);
    room.toast('Enlace copiado: ' + esc(room.link), 'good');
  };

  const vt = $('#voice-toggle');
  const paintVoice = () => (vt.textContent = isVoiceOn() ? 'Voz: sí' : 'Voz: no');
  paintVoice();
  vt.onclick = () => {
    toggleVoice();
    paintVoice();
  };

  const zb = $('#zoom-btn');
  zb.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    scene.zoomHeld = true;
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) zb.addEventListener(ev, () => (scene.zoomHeld = false));

  // chat
  const chat = $('#chat');
  $('#chat-toggle').onclick = () => {
    chat.classList.toggle('hidden');
    $('#chat-badge').classList.add('hidden');
    if (!chat.classList.contains('hidden')) $('#chat-input').focus();
  };
  $('#chat-close').onclick = () => chat.classList.add('hidden');
  $('#chat-form').onsubmit = (e) => {
    e.preventDefault();
    const v = $('#chat-input').value.trim();
    if (!v) return;
    room?.send({ t: 'chat', text: v });
    $('#chat-input').value = '';
  };
  $('#quick-phrases').innerHTML = QUICK_PHRASES.map((q) => `<button type="button">${esc(q)}</button>`).join('');
  $('#quick-phrases').onclick = (e) => {
    const b = e.target.closest('button');
    if (b) room?.send({ t: 'chat', text: b.textContent });
  };

  // carta elegida
  $('#card-actions').onclick = (e) => {
    const b = e.target.closest('button[data-play]');
    if (b && !b.disabled) room?.playCard(room.selected, b.dataset.play);
  };

  // menús desplegables (señas y "mostrá las dos")
  const closeMenus = () => $$('.dropdown .menu').forEach((x) => x.classList.add('hidden'));
  const toggleMenu = (id) => {
    const m = $(id);
    const open = m.classList.contains('hidden');
    closeMenus();
    if (open) m.classList.remove('hidden');
    return open;
  };
  $('#senas-btn').onclick = (e) => {
    e.stopPropagation();
    if (toggleMenu('#senas-menu')) buildSenasMenu();
  };
  $('#trampa-btn').onclick = (e) => {
    e.stopPropagation();
    toggleMenu('#trampa-menu');
  };
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) closeMenus();
  });

  $('#look-bar').onclick = (e) => {
    const b = e.target.closest('[data-look]');
    if (b) scene.lookAtSeat(b.dataset.look === 'table' ? 'table' : Number(b.dataset.look));
  };

  // sala de espera (delegación)
  $('#waiting').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !room) return;
    const d = b.dataset;
    if (d.sit) room.send({ t: 'sit', seat: Number(d.sit) });
    else if (d.bot) room.send({ t: 'addbot', seat: Number(d.bot) });
    else if (d.unbot) room.send({ t: 'removebot', seat: Number(d.unbot) });
    else if (d.kick) room.send({ t: 'kick', seat: Number(d.kick) });
    else if (d.start) room.send({ t: 'start', fillBots: d.start === '1' });
    else if (d.copy) {
      navigator.clipboard?.writeText(d.copy);
      room.toast('Copiado', 'good', 1200);
    } else if (d.share) navigator.share?.({ title: APP_NAME, text: '¿Un truquito?', url: room.link }).catch(() => {});
    else if (d.v !== undefined) {
      const name = b.closest('[data-cfg]')?.dataset.cfg;
      if (!name) return;
      const v = name === 'target' ? Number(d.v) : name === 'isPublic' ? d.v === '1' : d.v;
      room.send({ t: 'config', cfg: { [name]: v } });
    }
  });
  $('#waiting').addEventListener('change', (e) => {
    if (e.target.matches('[data-opt]')) room?.send({ t: 'config', cfg: readOptionChecks($('#waiting')) });
    if (e.target.matches('[data-trucoseg]')) room?.send({ t: 'config', cfg: { trucoDesdeSegunda: e.target.checked } });
  });

  // fin de la partida
  $('#result').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !room) return;
    if (b.dataset.rematch) room.send({ t: 'rematch' });
    if (b.dataset.tolobby) room.send({ t: 'to-lobby' });
    if (b.dataset.exit) goHome();
  });

  // ayuda
  $('#help-btn').onclick = () => {
    $('#help').innerHTML = helpHtml();
    $('#help').classList.remove('hidden');
  };
  $('#help').onclick = (e) => {
    if (e.target.id === 'help' || e.target.closest('[data-close]')) $('#help').classList.add('hidden');
  };

  // atajos: 1/2/3 eligen carta, Enter la tira, C abre el chat
  window.addEventListener('keydown', (e) => {
    const g = room?.st?.game;
    if (e.target.closest('input, textarea') || !g) return;
    const card = g.h?.myCards[Number(e.key) - 1];
    if (['1', '2', '3'].includes(e.key) && card) room.clickCard(card);
    if (e.key === 'Enter' && room.selected) room.playCard(room.selected, 'normal');
    if (e.key.toLowerCase() === 'c') $('#chat-toggle').click();
  });
}

// Menú de señas: cada una con la cara que vas a poner.
function buildSenasMenu() {
  const m = $('#senas-menu');
  const tgt = scene.lookTarget;
  const who = tgt === 'table' ? 'la mesa' : tgt != null && room?.st ? room.nameOf(tgt, true) : 'nadie';
  const look = lookFor(savedName(), room?.you ?? 0);
  m.innerHTML = `<div class="tip">La seña <b>solo la ven los que te están mirando</b> en ese momento (fijate quién dice “te mira” en los nombres). Ahora estás mirando a: <b>${esc(who)}</b>.</div>`;
  for (const [id, s] of Object.entries(SENAS)) {
    const b = document.createElement('button');
    b.className = 'item';
    const face = document.createElement('canvas');
    face.width = face.height = 120;
    const span = document.createElement('span');
    span.innerHTML = `<b>${esc(s.label)}</b><small>${esc(s.desc)}</small>`;
    b.append(drawFace(face, look, s.expr), span);
    b.onclick = () => {
      m.classList.add('hidden');
      room?.doSena(id);
    };
    m.appendChild(b);
  }
}

// La escena dibuja textos en canvas: esperamos la tipografía (si no carga, sigue con la de respaldo).
await Promise.race([document.fonts?.load(`700 28px ${FONT}`), new Promise((r) => setTimeout(r, 1500))]).catch(() => {});

initMenu(go);
window.addEventListener('popstate', route);
route();
