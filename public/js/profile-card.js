// El perfil de otro jugador (ranking, amigos, el cartel de la mesa): foto, ELO y partidas de cada modo, sus
// últimas partidas y el botón para agregarlo de amigo. Se abre tocando cualquier cosa con data-user="nombre".
import { ROUTES, MODES, modeLabel, ELO_START } from './config.js';
import { $, esc, api, DEFAULT_AVATAR } from './dom.js';

let current = null;

const ago = (at) => {
  if (!at) return '';
  const m = Math.max(1, Math.round((Date.now() - Date.parse(at)) / 60000));
  return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
};

const FRIEND = {
  none: ['Agregar de amigo', 'primary', 'add'],
  outgoing: ['Solicitud enviada', '', null],
  incoming: ['Aceptar solicitud', 'primary', 'accept'],
  friends: ['Son amigos', '', null],
  me: ['Sos vos', '', null],
};

function render(p, msg = '') {
  const [label, cls, act] = FRIEND[p.friend] || FRIEND.none;
  const elos = Object.keys(MODES)
    .map((m) => `<span><small>${esc(modeLabel(m))}</small><b>${esc(p[`elo_${m}`] ?? ELO_START)}</b><em>${esc(p[`games_${m}`] ?? 0)} partidas</em></span>`)
    .join('');
  const rows = (p.recent || [])
    .map((r) => `<li class="${r.won ? 'w' : 'l'}"><b>${r.won ? 'G' : 'P'}</b><span>${esc(r.mode ? modeLabel(r.mode) : '')}</span><span class="np-sc">${esc(r.score[0])}–${esc(r.score[1])}</span><span class="np-d">${r.delta == null ? '' : `${r.delta >= 0 ? '+' : ''}${esc(r.delta)}`}</span><small>${esc(ago(r.at))}</small></li>`)
    .join('');
  $('#ud-body').innerHTML = `
    <header class="ud-head">
      <img class="ud-av" src="${esc(p.avatar || DEFAULT_AVATAR)}" alt="">
      <div><small>Jugador</small><h2>${esc(p.username)}</h2></div>
    </header>
    <div class="np-elos ud-elos">${elos}</div>
    <h5 class="ud-h">Últimas partidas</h5>
    ${rows ? `<div class="np-drop static"><ul>${rows}</ul></div>` : '<p class="np-none">Todavía no terminó ninguna partida</p>'}
    <p class="a-msg ${msg && msg.bad ? 'bad' : ''}" id="ud-msg">${esc(msg.text || '')}</p>
    <div class="dl-foot ud-foot">
      <button type="button" class="btn ghost" data-ud-close="1">Cerrar</button>
      <button type="button" class="btn ${cls}" ${act ? `data-ud-act="${act}"` : 'disabled'}>${esc(label)}</button>
    </div>`;
}

/** Abre el perfil de `name`. */
export async function openProfile(name) {
  const dialog = $('#user-dialog');
  $('#ud-body').innerHTML = '<p class="np-none">Cargando…</p>';
  if (!dialog.open) dialog.showModal();
  try {
    const { profile } = await api(ROUTES.api.user(name));
    current = profile;
    render(profile);
  } catch (err) {
    $('#ud-body').innerHTML = `<p class="np-none">${esc(err.message)}</p><div class="dl-foot ud-foot"><button type="button" class="btn ghost" data-ud-close="1">Cerrar</button></div>`;
  }
}

/** Se engancha una sola vez: cualquier [data-user] abre el perfil. */
export function initProfiles() {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-user]');
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    openProfile(t.dataset.user);
  });
  const dialog = $('#user-dialog');
  dialog.addEventListener('click', async (e) => {
    if (e.target === dialog || e.target.closest('[data-ud-close]')) return dialog.close();
    const b = e.target.closest('[data-ud-act]');
    if (!b || !current) return;
    b.disabled = true;
    try {
      if (b.dataset.udAct === 'add') {
        const r = await api(ROUTES.api.friends, { username: current.username, fromProfile: true });
        current.friend = r.status === 'accepted' ? 'friends' : 'outgoing';
        render(current, { text: r.status === 'accepted' ? '¡Ahora son amigos!' : 'Le mandaste la solicitud.' });
      } else if (b.dataset.udAct === 'accept') {
        await api(ROUTES.api.friendsRespond, { id: current.id, accept: true });
        current.friend = 'friends';
        render(current, { text: '¡Ahora son amigos!' });
      }
    } catch (err) {
      render(current, { text: err.message, bad: true });
    }
  });
}
