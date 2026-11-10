// Arranque del cliente: sesión (sin cuenta no se juega), rutas (/ = menú, /sala/CÓDIGO = partida) y eventos
// fijos de la interfaz.
// La lógica de la sala está en room-client.js; la escena 3D en scene.js.
import { TableScene, preloadCards } from './scene.js';
import { lookFor } from './characters.js';
import { SENAS, ROUTES, APP_NAME } from './config.js';
import { FONT } from './theme.js';
import { $, $$, esc, savedName, api, KEYS } from './dom.js';
import { showGate } from './gate.js';
import { isVoiceOn, toggleVoice } from './audio.js';
import { helpHtml, drawFace, readOptionChecks } from './hud.js';
import { initWheel } from './wheel.js';
import { initMenu, showMenu, hideMenu } from './menu.js';
import { initAuth, loadMe, currentMe, lastLoadError, onAuthChange, signOut } from './auth.js';
import { initAccount, showEntry, showLoginError } from './account.js';
import { initHistory, showReplay, hideReplay } from './history.js';
import { RoomClient } from './room-client.js';
import { initProfiles } from './profile-card.js';
import { startFriendWatch } from './social.js';
import { initFriends } from './friends.js';

let scene = null;
let room = null;

function go(code) {
  history.pushState({}, '', ROUTES.room(code));
  route();
}

// Copia al portapapeles y avisa si salió bien o no (el portapapeles puede estar bloqueado).
function copy(text, okHtml) {
  const p = navigator.clipboard?.writeText(text) ?? Promise.reject();
  p.then(() => room?.toast(okHtml, 'good', 1600), () => room?.toast('No se pudo copiar: ' + esc(text), 'bad'));
}

function goHome() {
  history.pushState({}, '', ROUTES.home);
  route();
}

function route() {
  // una partida compartida la ve cualquiera, con cuenta o sin ella
  const sm = location.pathname.match(ROUTES.sharedRe);
  if (sm) {
    room?.close();
    room = null;
    showEntry(null);
    $('#gate').classList.add('hidden');
    scene?.pause();
    const at = Number(new URLSearchParams(location.search).get('j')) || 0;
    return showReplay(sm[1], { shared: true, at });
  }
  // sin sesión: a entrar; con sesión pero sin nombre: a elegirlo. La ruta (/sala/CÓDIGO) se mantiene.
  const me = currentMe();
  if (!me?.profile) {
    room?.close();
    room = null;
    showEntry(me ? '#onboard' : '#login');
    if (!me) showLoginError(lastLoadError()); // si la cuenta no se pudo leer, se le dice por qué
    return;
  }
  showEntry(null);
  $('#gate').classList.add('hidden');
  const m = location.pathname.match(ROUTES.roomRe);
  if (m) return hideReplay(), openRoom(m[1].toUpperCase());
  room?.close();
  room = null;
  const pm = location.pathname.match(ROUTES.matchRe);
  if (pm) {
    scene?.pause();
    return showReplay(pm[1]);
  }
  hideReplay();
  showMenu();
}

// Antes de sentarte en una mesa ajena, sus reglas. Devuelve true si se quedó mostrándolas.
async function gated(code) {
  if (sessionStorage.getItem(KEYS.entered) === code || sessionStorage.getItem(KEYS.spectate) === code) return false;
  const info = await api(ROUTES.api.room(code)).catch(() => null);
  if (!info?.exists || info.status !== 'lobby' || info.quick) return false;
  $('#menu').classList.add('hidden');
  showGate(info, code, () => {
    sessionStorage.setItem(KEYS.entered, code);
    route();
  }, goHome);
  return true;
}

async function openRoom(code) {
  if (new URLSearchParams(location.search).has('equipo')) sessionStorage.setItem(KEYS.teamInvite, code);
  if (await gated(code)) return;
  $('#gate').classList.add('hidden');
  hideMenu();
  if (!scene) {
    scene = new TableScene($('#stage'));
    window.__truco = { scene, get room() { return room; } }; // para depurar desde la consola
    preloadCards();
    bindGameUI();
  }
  scene.resume();
  scene.resize();
  room?.close();
  room = new RoomClient(code, scene, { onNotFound: goHome });
}

// Eventos de los elementos fijos de la pantalla de partida (se enlazan una sola vez).
function bindGameUI() {
  $('#leave').onclick = goHome;
  $('#code-chip').onclick = () => room && copy(room.link, 'Enlace copiado: ' + esc(room.link));

  const vt = $('#voice-toggle');
  const paintVoice = () => (vt.textContent = isVoiceOn() ? 'Voz: sí' : 'Voz: no');
  paintVoice();
  addEventListener('trukeados:voice', paintVoice);
  vt.onclick = () => {
    toggleVoice();
    paintVoice();
  };

  // rendirse: dos toques, como irse al mazo
  const sb = $('#surrender-btn');
  let surrenderT = null;
  const disarm = () => {
    clearTimeout(surrenderT);
    surrenderT = null;
    sb.textContent = 'Rendirse';
  };
  sb.onclick = () => {
    if (!surrenderT) {
      // en equipo no te rendís solo: se lo pedís a tu equipo
      sb.textContent = room?.st?.room.seats.length > 2 ? '¿Le pido a mi equipo?' : '¿Seguro?';
      surrenderT = setTimeout(disarm, 3000);
      return;
    }
    disarm();
    room?.act({ t: 'rendirse' });
  };

  // contestar el pedido de rendirse de tu equipo
  $('#surrender-vote').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sv]');
    if (b) room?.send({ t: 'surrender-vote', yes: b.dataset.sv === '1' });
  });

  // vista: primera persona o segunda (de frente, te ves la cara), con el botón o la tecla V
  const cb = $('#cam-btn');
  const CAM_LABEL = { first: 'Vista: 1ª', front: 'Vista: 2ª' };
  const paintCam = () => (cb.textContent = CAM_LABEL[scene.camMode] || CAM_LABEL.first);
  paintCam();
  cb.onclick = () => {
    scene.cycleCamMode();
    paintCam();
  };
  addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'v' || e.repeat || e.target.closest('input, textarea, select') || !room || room.you == null) return;
    scene.cycleCamMode();
    paintCam();
  });

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
  $('#chat-tabs').onclick = (e) => {
    const b = e.target.closest('[data-chat]');
    if (b) room?.showChat(b.dataset.chat);
  };
  $('#chat-form').onsubmit = (e) => {
    e.preventDefault();
    const v = $('#chat-input').value.trim();
    if (!v) return;
    room?.send({ t: 'chat', text: v });
    $('#chat-input').value = '';
    if (room?.you == null) room?.showChat('spec');
  };
  initWheel((text) => room?.send({ t: 'chat', text }), () => room?.st?.game?.n ?? 2);

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
    else if (d.rules) room.toggleRules();
    else if (d.exit) goHome();
    else if (d.copy) copy(d.copy, 'Copiado');
    else if (d.teamhold) room.holdTeam();
    else if (d.teamcancel) room.send({ t: 'invite-cancel' });
    else if (d.invite) room.inviteFriend(d.invite);
    else if (d.share) navigator.share?.({ title: APP_NAME, text: '¿Un truquito?', url: room.link }).catch(() => {});
    else if (d.v !== undefined) {
      const name = b.closest('[data-cfg]')?.dataset.cfg;
      if (!name) return;
      const v = name === 'target' ? Number(d.v) : name === 'isPublic' || name === 'rated' ? d.v === '1' : d.v;
      room.send({ t: 'config', cfg: { [name]: v } });
    }
  });
  bindSeatDrag();

  $('#waiting').addEventListener('change', (e) => {
    if (e.target.matches('[data-opt]')) room?.send({ t: 'config', cfg: readOptionChecks($('#waiting')) });
    if (e.target.matches('[data-trucoseg]')) room?.send({ t: 'config', cfg: { trucoDesdeSegunda: e.target.checked } });
  });

  // fin de la partida
  $('#result').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !room) return;
    if (b.dataset.rematch) room.send({ t: 'rematch' });
    if (b.dataset.rematchno) room.send({ t: 'rematch-no' });
    if (b.dataset.tolobby) room.send({ t: 'to-lobby' });
    if (b.dataset.exit) goHome();
    if (b.dataset.replay) openMatch(b.dataset.replay);
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
// Sala de espera: el anfitrión arrastra a un jugador (o bot) a otro lugar y se manda `move`.
// Con eventos de puntero, así funciona igual con mouse y con el dedo.
function bindSeatDrag() {
  let drag = null;
  const waiting = $('#waiting');
  const seatAt = (e) => document.elementFromPoint(e.clientX, e.clientY)?.closest('#waiting .w-seat');
  const clearOver = (keep) => waiting.querySelectorAll('.w-seat.over').forEach((s) => s !== keep && s.classList.remove('over'));
  waiting.addEventListener('pointerdown', (e) => {
    const seat = e.target.closest('.w-seat.drag');
    if (!seat || e.target.closest('button') || e.button > 0) return;
    drag = { from: Number(seat.dataset.seat), x: e.clientX, y: e.clientY, src: seat, ghost: null };
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.ghost) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
      const r = drag.src.getBoundingClientRect();
      drag.ghost = drag.src.cloneNode(true);
      drag.ghost.classList.add('w-ghost');
      drag.ghost.style.width = r.width + 'px';
      drag.dx = drag.x - r.left;
      drag.dy = drag.y - r.top;
      document.body.append(drag.ghost);
      waiting.classList.add('dragging');
    }
    e.preventDefault();
    drag.ghost.style.transform = `translate(${e.clientX - drag.dx}px, ${e.clientY - drag.dy}px)`;
    const over = seatAt(e);
    clearOver(over);
    if (over && Number(over.dataset.seat) !== drag.from) over.classList.add('over');
  }, { passive: false });
  const endDrag = (e) => {
    if (!drag) return;
    if (drag.ghost) {
      drag.ghost.remove();
      const over = e.type === 'pointerup' && seatAt(e);
      const to = over ? Number(over.dataset.seat) : NaN;
      if (Number.isInteger(to) && to !== drag.from) room?.send({ t: 'move', from: drag.from, to });
      clearOver();
      waiting.classList.remove('dragging');
    }
    drag = null;
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
}

function buildSenasMenu() {
  const m = $('#senas-menu');
  const tgt = scene.lookTarget;
  const who = tgt === 'table' ? 'la mesa' : tgt != null && room?.st ? room.nameOf(tgt, true) : 'nadie';
  const look = room ? room.myLook() : lookFor(savedName(), 0);
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

async function refresh() {
  await loadMe();
  route();
}

async function logout() {
  await signOut();
  route();
}

function openMatch(id) {
  history.pushState({}, '', ROUTES.match(id));
  route();
}

initMenu(go, logout);
initProfiles(); // tocar el nombre de alguien abre su perfil
startFriendWatch(); // avisos de solicitudes de amistad (menú, partida y título de la pestaña)
// amigos conectados y chat: dónde estás vos (para que te vean tus amigos), entrar a su mesa o mirarla
initFriends({
  go,
  spectate: (code) => {
    sessionStorage.setItem(KEYS.spectate, code);
    go(code);
  },
  where: () => {
    const st = room?.st;
    if (!room || !st) return { where: 'menu' };
    return { where: 'room', code: room.code, status: st.room.status, mode: st.room.cfg?.mode, score: st.game?.score, spectating: st.you == null };
  },
});
initHistory(openMatch, () => {
  // volver al historial (o atrás, si se llegó desde ahí)
  sessionStorage.setItem('truco-menu-tab', 'partidas');
  goHome();
});
initAccount(refresh, route);
window.addEventListener('popstate', route);
// la sesión venció o la cerraron en otra pestaña (si ya se sabe que no hay sesión, no se vuelve a preguntar)
addEventListener('trukeados:logout', () => currentMe() && refresh());
try {
  if (await initAuth()) await loadMe();
  // fuera del callback: Supabase no deja llamar a la sesión desde adentro de onAuthStateChange
  onAuthChange((event) => {
    if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && !currentMe())) setTimeout(refresh);
  });
} catch (err) {
  console.error(err);
  $('#boot').innerHTML = `<p class="muted">${esc(err.message)}</p>`;
  throw err;
}
route();
