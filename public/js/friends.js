// Amigos conectados (como en los juegos con lista de amigos): quién está conectado y qué está haciendo, para
// unirte a su mesa, mirarla o invitarlo a la tuya, y un chat con cada uno. Está en el menú (el resumen del lateral) y en
// la partida (botón "Amigos"). Cada PRESENCE.ping avisa dónde estás y trae la lista; con un chat abierto, los mensajes
// se revisan cada PRESENCE.chatPoll.
import { ROUTES, PRESENCE, modeLabel, MAX_CHAT_TEXT } from './config.js';
import { $, esc, api, store, KEYS, DEFAULT_AVATAR } from './dom.js';
import { currentMe } from './auth.js';
import { onIncoming } from './social.js';

let opts = { go: () => {}, spectate: () => {}, where: () => ({ where: 'menu' }) };
let friends = [];
let chatWith = null; // id del amigo con el que está abierto el chat
let chatMsgs = [];
let chatMe = null;
let chatT = null;
let lastUnread = 0;

// ---- lo que leíste de cada chat (por amigo, la fecha del último mensaje visto)
const readMap = () => {
  try {
    return JSON.parse(store.get(KEYS.dmRead, '{}')) || {};
  } catch {
    return {};
  }
};
const markRead = (id, at) => {
  const m = readMap();
  m[id] = Math.max(m[id] || 0, at || Date.now());
  store.set(KEYS.dmRead, JSON.stringify(m));
};
const unreadOf = (f) => !!f.lastMsg && f.lastMsg.from === f.id && f.lastMsg.at > (readMap()[f.id] || 0);

// Qué está haciendo, en una frase.
function statusText(p) {
  if (!p?.online) return 'Desconectado';
  if (p.where !== 'room') return 'En el menú';
  const mode = p.mode ? modeLabel(p.mode) : '';
  if (p.spectating) return 'Mirando una partida';
  if (p.status === 'playing') return `Jugando ${mode}${p.score ? ` · ${p.score[0]} a ${p.score[1]}` : ''}`;
  if (p.status === 'ended') return `Terminó una partida de ${mode}`;
  return `En una sala esperando · ${mode}`;
}
const stateClass = (p) => (!p?.online ? 'off' : p.where === 'room' && p.status === 'playing' ? 'play' : 'on');

function avatar(f) {
  return `<span class="fd-av"><img src="${esc(f.avatar || DEFAULT_AVATAR)}" alt=""><i class="fd-dot"></i></span>`;
}

// ---- la lista
function renderList() {
  const me = opts.where();
  const online = friends.filter((f) => f.presence?.online);
  const sorted = [...online.sort((a, b) => (stateClass(b.presence) === 'play') - (stateClass(a.presence) === 'play')), ...friends.filter((f) => !f.presence?.online)];
  const row = (f) => {
    const p = f.presence || {};
    const acts = [];
    if (p.online && p.where === 'room' && p.code && p.code !== me.code) {
      if (me.where !== 'room' && p.status === 'lobby') acts.push(`<button type="button" class="btn small primary" data-fd-join="${esc(p.code)}">Unirme</button>`);
      if (me.where !== 'room' && p.status === 'playing') acts.push(`<button type="button" class="btn small" data-fd-watch="${esc(p.code)}">Mirar</button>`);
    }
    if (p.online && me.where === 'room' && me.status === 'lobby' && p.code !== me.code) acts.push(`<button type="button" class="btn small" data-fd-invite="${esc(f.id)}">Invitar</button>`);
    acts.push(`<button type="button" class="btn small ghost fd-chatbtn" data-fd-chat="${esc(f.id)}" title="Chatear">Chat${unreadOf(f) ? '<i class="fd-new"></i>' : ''}</button>`);
    return `<li class="fd-f ${stateClass(p)}">${avatar(f)}<span class="fd-nm"><b class="u-link" data-user="${esc(f.username)}">${esc(f.username)}</b><small>${esc(statusText(p))}</small></span><span class="fd-acts">${acts.join('')}</span></li>`;
  };
  $('#fd-count').textContent = friends.length ? `${online.length} de ${friends.length} conectados` : '';
  $('#fd-body').innerHTML = friends.length
    ? `<ul class="fd-list">${sorted.map(row).join('')}</ul>`
    : '<p class="fd-empty">Todavía no tenés amigos. Agregalos desde su perfil (tocá su nombre en el ranking o en la mesa) o desde Amigos, en el menú.</p>';
}

// ---- el chat con un amigo
function renderChat() {
  const f = friends.find((x) => x.id === chatWith);
  if (!f) return closeChat();
  const msgs = chatMsgs
    .map((m) => `<li class="${m.from === chatMe ? 'me' : ''}"><p>${esc(m.text)}</p><small>${new Date(m.at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</small></li>`)
    .join('');
  $('#fd-count').textContent = '';
  $('#fd-body').innerHTML = `<div class="fd-chat">
    <header class="fd-chat-h"><button type="button" class="fd-back" data-fd-back="1" aria-label="Volver">←</button>${avatar(f)}<span class="fd-nm"><b>${esc(f.username)}</b><small>${esc(statusText(f.presence))}</small></span></header>
    <ul class="fd-msgs" id="fd-msgs">${msgs || '<li class="fd-hint">Mandale un mensaje. Lo ve aunque esté jugando.</li>'}</ul>
    <form class="fd-form" id="fd-form"><input id="fd-input" maxlength="${MAX_CHAT_TEXT}" placeholder="Escribile a ${esc(f.username)}…" autocomplete="off"><button class="btn small primary">Enviar</button></form>
  </div>`;
  const box = $('#fd-msgs');
  box.scrollTop = box.scrollHeight;
}

async function pollChat() {
  if (!chatWith) return;
  const after = chatMsgs.at(-1)?.at || 0;
  try {
    const r = await api(ROUTES.api.dmWith(chatWith, after));
    chatMe = r.me;
    // solo los que no tenía (por las dudas, aunque el servidor ya manda solo los nuevos)
    const fresh = r.messages.filter((m) => m.at > after && !chatMsgs.some((x) => x.at === m.at && x.from === m.from));
    if (fresh.length) {
      chatMsgs = [...chatMsgs, ...fresh].slice(-PRESENCE.dmKeep);
      markRead(chatWith, chatMsgs.at(-1).at);
      const input = $('#fd-input');
      const draft = input?.value || '';
      const focused = document.activeElement === input;
      renderChat();
      if (draft) $('#fd-input').value = draft;
      if (focused) $('#fd-input').focus();
    }
  } catch {}
}

async function openChat(id) {
  chatWith = id;
  chatMsgs = [];
  renderChat();
  await pollChat();
  renderChat();
  $('#fd-input')?.focus();
  clearInterval(chatT);
  chatT = setInterval(pollChat, PRESENCE.chatPoll);
  paintBadges();
}

function closeChat() {
  chatWith = null;
  clearInterval(chatT);
  renderList();
}

// ---- abrir y cerrar el panel
export function openFriends() {
  $('#fd').classList.remove('hidden');
  $('#fd').setAttribute('aria-hidden', 'false');
  if (chatWith) renderChat();
  else renderList();
  refresh();
}

function closeFriends() {
  $('#fd').classList.add('hidden');
  $('#fd').setAttribute('aria-hidden', 'true');
  clearInterval(chatT);
  chatWith = null;
}

// ---- el resumen del lateral del menú y los botones con aviso
function paintBadges() {
  const online = friends.filter((f) => f.presence?.online);
  const unread = friends.filter(unreadOf).length;
  const mini = $('#fd-mini');
  if (mini) {
    mini.innerHTML = `<span class="fd-mini-h"><b>Amigos</b><small>${friends.length ? `${online.length} conectados` : 'Agregá amigos'}</small></span>
      <span class="fd-stack">${online.slice(0, 5).map((f) => `<img src="${esc(f.avatar || DEFAULT_AVATAR)}" alt="" title="${esc(f.username)}">`).join('')}${online.length > 5 ? `<i>+${online.length - 5}</i>` : ''}</span>
      ${unread ? `<i class="fd-mini-new">${unread}</i>` : ''}`;
  }
  const btn = $('#fd-btn');
  if (btn) btn.innerHTML = `Amigos${online.length ? ` <small>${online.length}</small>` : ''}${unread ? '<i class="fd-new"></i>' : ''}`;
  // mensaje nuevo con el panel cerrado: un aviso
  if (unread > lastUnread && $('#fd').classList.contains('hidden')) {
    const f = friends.find(unreadOf);
    notify(`<b>${esc(f.username)}</b> te escribió. Abrí Amigos para contestarle.`);
  }
  lastUnread = unread;
}

function notify(html) {
  const inGame = !$('#game')?.classList.contains('hidden');
  const area = inGame ? $('#toast-area') : $('#friend-notes');
  if (!area) return;
  const t = document.createElement('div');
  t.className = inGame ? 'toast' : 'rj fd-toast';
  t.innerHTML = inGame ? html : `<p class="rj-text"><b>${html}</b></p><button type="button" class="btn small primary" data-fd-open="1">Abrir</button>`;
  area.appendChild(t);
  setTimeout(() => t.remove(), 7000);
}

// ---- cada PRESENCE.ping: avisa dónde estás y trae a los amigos
async function refresh() {
  if (!currentMe()?.profile) return;
  try {
    await api(ROUTES.api.presence, opts.where());
  } catch {}
  try {
    const r = await api(ROUTES.api.friends);
    friends = r.friends || [];
    onIncoming(r.incoming || []);
    paintBadges();
    if (!$('#fd').classList.contains('hidden') && !chatWith) renderList();
  } catch {}
}

/**
 * go(código): entrar a una mesa; spectate(código): mirarla; where(): dónde estás ({ where: 'menu' } o
 * { where: 'room', code, status, mode, score, spectating }).
 */
export function initFriends(o) {
  opts = { ...opts, ...o };
  refresh();
  setInterval(refresh, PRESENCE.ping);
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-fd-open], #fd-mini, #fd-btn')) {
      e.preventDefault();
      return openFriends();
    }
  });
  $('#fd').addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (e.target.closest('[data-fd-close]') || e.target === $('#fd')) return closeFriends();
    if (!b) return;
    const d = b.dataset;
    if (d.fdChat) return openChat(d.fdChat);
    if (d.fdBack) return closeChat();
    if (d.fdJoin) {
      closeFriends();
      return opts.go(d.fdJoin);
    }
    if (d.fdWatch) {
      closeFriends();
      return opts.spectate(d.fdWatch);
    }
    if (d.fdInvite) {
      b.disabled = true;
      try {
        await api(ROUTES.api.invites, { friend: d.fdInvite, code: opts.where().code });
        b.textContent = 'Invitado';
      } catch (err) {
        b.textContent = err.message.slice(0, 24);
      }
    }
  });
  $('#fd').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#fd-input');
    const text = input.value.trim();
    if (!text || !chatWith) return;
    input.value = '';
    try {
      const { msg } = await api(ROUTES.api.dm, { to: chatWith, text });
      chatMsgs.push(msg);
      chatMe = msg.from;
      markRead(chatWith, msg.at);
      renderChat();
      $('#fd-input').focus();
    } catch (err) {
      input.value = text;
    }
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#fd').classList.contains('hidden')) closeFriends();
  });
}

