// Del menú: amigos por nombre de usuario, ranking y foto de perfil.
import { ROUTES, AVATAR, MODES, modeLabel, ELO_START } from './config.js';
import { $, esc, api, avatarHtml, KEYS } from './dom.js';
import { loadMe, currentMe } from './auth.js';

const eloOf = (p, mode) => p[`elo_${mode}`] ?? ELO_START;
let rankMode = Object.keys(MODES)[0];

const person = (p, extra = '') => `<div class="so-row">${avatarHtml(p)}<span class="so-name"><b>${esc(p.username)}</b><small>${Object.keys(MODES).map((m) => `${esc(modeLabel(m))}: ${esc(eloOf(p, m))}`).join(' · ')}</small></span>${extra}</div>`;

function friendsMsg(text, bad = true) {
  $('#fr-msg').textContent = text;
  $('#fr-msg').classList.toggle('bad', bad);
}

export async function loadFriends() {
  try {
    const { friends, incoming, outgoing } = await api(ROUTES.api.friends);
    $('#fr-incoming-wrap').classList.toggle('hidden', !incoming.length);
    $('#fr-incoming').innerHTML = incoming.map((p) => person(p, `<button class="btn small primary" data-accept="${esc(p.id)}">Aceptar</button><button class="btn small ghost" data-remove="${esc(p.id)}">Rechazar</button>`)).join('');
    $('#fr-outgoing-wrap').classList.toggle('hidden', !outgoing.length);
    $('#fr-outgoing').innerHTML = outgoing.map((p) => person(p, `<button class="btn small ghost" data-remove="${esc(p.id)}">Cancelar</button>`)).join('');
    $('#fr-list').innerHTML = friends.map((p) => person(p, `<button class="btn small ghost" data-remove="${esc(p.id)}">Sacar</button>`)).join('');
    $('#fr-empty').classList.toggle('hidden', friends.length > 0);
    paintFriendsBadge(incoming.length);
    return { friends, incoming };
  } catch (err) {
    friendsMsg(err.message);
    return null;
  }
}

function paintFriendsBadge(n) {
  const b = $('#nav-friends-badge');
  b.textContent = n || '';
  b.classList.toggle('hidden', !n);
}

export async function loadRanking() {
  $('#rk-modes').innerHTML = Object.keys(MODES).map((m) => `<button type="button" data-rank="${esc(m)}" class="${m === rankMode ? 'on' : ''}">${esc(modeLabel(m))}</button>`).join('');
  const box = $('#rk-list');
  try {
    const { players } = await api(ROUTES.api.ranking(rankMode));
    const myId = currentMe()?.user?.id;
    box.innerHTML = players.map((p, i) => `<div class="so-row rk ${p.id === myId ? 'me' : ''}"><span class="rk-pos">${i + 1}</span>${avatarHtml(p)}<span class="so-name"><b>${esc(p.username)}</b><small>${esc(p[`games_${rankMode}`])} partidas</small></span><b class="rk-elo">${esc(eloOf(p, rankMode))}</b></div>`).join('') || '<p class="muted">Todavía nadie jugó por ELO en este modo.</p>';
  } catch (err) {
    box.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
  }
}

const readDataUrl = (file) => new Promise((ok, fail) => {
  const r = new FileReader();
  r.onload = () => ok(r.result);
  r.onerror = () => fail(new Error('No se pudo leer el archivo'));
  r.readAsDataURL(file);
});

// Recorta la foto al centro, la achica y la comprime hasta que entre. Los GIF van tal cual, para que sigan moviéndose.
async function shrink(file) {
  if (file.type === 'image/gif') {
    if (file.size > AVATAR.gifMaxBytes) throw new Error('Ese GIF pesa más de 800 KB');
    return readDataUrl(file);
  }
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  c.width = c.height = AVATAR.size;
  const side = Math.min(bmp.width, bmp.height);
  c.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, AVATAR.size, AVATAR.size);
  bmp.close();
  for (const q of [0.82, 0.65, 0.45, 0.3]) {
    let url = c.toDataURL('image/webp', q);
    if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/jpeg', q); // navegadores que no exportan webp
    if (url.length <= AVATAR.maxChars) return url;
  }
  throw new Error('Esa imagen no se pudo achicar lo suficiente');
}

let enterRoom = () => {};

// Las invitaciones a un equipo: aparecen arriba del menú mientras estén vigentes.
export async function loadInvites() {
  const box = $('#invites');
  try {
    const { invites } = await api(ROUTES.api.invites);
    box.innerHTML = invites.map((i) => `<div class="rj"><p class="rj-text"><b>${esc(i.from)} te invita a su equipo</b><span>${esc(modeLabel(i.mode))}</span></p>
      <div class="rj-actions"><button class="btn ghost" type="button" data-skip="${esc(i.code)}">Ahora no</button><button class="btn primary" type="button" data-join="${esc(i.code)}">Unirme</button></div></div>`).join('');
  } catch {
    box.innerHTML = '';
  }
}

// repaint(): vuelve a pintar tu usuario con la foto nueva. go(código): entra a una mesa.
export function initSocial(repaint, go) {
  enterRoom = go;
  $('#invites').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-join],[data-skip]');
    if (!b) return;
    const code = b.dataset.join || b.dataset.skip;
    b.closest('.rj').remove();
    await api(ROUTES.api.invitesDone, { code }).catch(() => {});
    if (b.dataset.join) {
      sessionStorage.setItem(KEYS.teamInvite, code);
      enterRoom(code);
    }
  });
  $('#fr-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#fr-name');
    const username = input.value.trim();
    if (!username) return input.focus();
    try {
      const r = await api(ROUTES.api.friends, { username });
      friendsMsg(r.status === 'accepted' ? `Ya sos amigo de ${username}` : `Le mandaste una solicitud a ${username}`, false);
      input.value = '';
      await loadFriends();
    } catch (err) {
      friendsMsg(err.message);
    }
  });
  $('#panel-amigos').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-accept],[data-remove]');
    if (!b) return;
    b.disabled = true;
    try {
      if (b.dataset.accept) await api(ROUTES.api.friendsRespond, { id: b.dataset.accept, accept: true });
      else await api(ROUTES.api.friendsRemove, { id: b.dataset.remove });
      await loadFriends();
    } catch (err) {
      friendsMsg(err.message);
      b.disabled = false;
    }
  });
  $('#rk-modes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rank]');
    if (!b) return;
    rankMode = b.dataset.rank;
    loadRanking();
  });

  const msg = (t, bad = true) => {
    for (const id of ['#av-msg', '#set-av-msg']) {
      $(id).textContent = t;
      $(id).classList.toggle('bad', bad);
    }
  };
  const save = async (avatar) => {
    await api(ROUTES.api.avatar, { avatar });
    await loadMe();
    repaint();
  };
  $('#av-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    msg('Subiendo…', false);
    try {
      await save(await shrink(file));
      msg('Listo', false);
    } catch (err) {
      msg(err.message || 'No se pudo usar esa imagen');
    }
  });
  $('#av-clear').addEventListener('click', async () => {
    try {
      await save(null);
      msg('', false);
    } catch (err) {
      msg(err.message);
    }
  });
}
