// Perfil (evolución del ELO y últimas partidas) y Ajustes (cuenta, sonido y mesa).
import { ROUTES, MODES, modeLabel, AUTH, usernameFreeAt, usernameFreeDay } from './config.js';
import { $, esc, api, store, KEYS } from './dom.js';
import { currentMe, changeUsername, signOut } from './auth.js';
import { rowHtml } from './history.js';
import { isVoiceOn, toggleVoice, voiceVolume, setVoiceVolume, isSfxOn, toggleSfx, myVoice, setMyVoice, previewVoice } from './audio.js';

let rows = [];
let chartMode = Object.keys(MODES)[0];

const W = 640;
const H = 150;

function paintChart() {
  $('#pf-modes').innerHTML = Object.keys(MODES).map((m) => `<button type="button" data-chart="${esc(m)}" class="${m === chartMode ? 'on' : ''}">${esc(modeLabel(m))}</button>`).join('');
  const games = rows.filter((r) => r.match.mode === chartMode && r.elo_after != null).reverse();
  const box = $('#pf-chart');
  const won = games.filter((g) => g.won).length;
  $('#pf-record').textContent = games.length ? `${won} ganadas · ${games.length - won} perdidas` : '';
  if (games.length < 2) {
    box.innerHTML = `<p class="pf-empty">${games.length ? 'Con una partida más ya se ve la curva.' : 'Todavía no jugaste por ELO en este modo.'}</p>`;
    return;
  }
  const vals = [games[0].elo_before, ...games.map((g) => g.elo_after)];
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = Math.max(20, hi - lo);
  const x = (i) => (i / (vals.length - 1)) * W;
  const y = (v) => H - 10 - ((v - lo) / span) * (H - 24);
  const line = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="ELO en tus últimas partidas de ${esc(modeLabel(chartMode))}: de ${vals[0]} a ${vals[vals.length - 1]}">
    <polygon class="pf-area" points="0,${H} ${line} ${W},${H}"/>
    <polyline class="pf-line" points="${line}"/>
  </svg>
  <div class="pf-scale"><span>${hi}</span><span>${lo}</span></div>`;
}

export async function loadProfile() {
  try {
    rows = (await api(ROUTES.api.matches)).matches;
  } catch {
    rows = [];
  }
  $('#pf-recent').innerHTML = rows.slice(0, 5).map(rowHtml).join('');
  $('#pf-recent-empty').classList.toggle('hidden', rows.length > 0);
  // arranca en el modo que más jugaste últimamente
  const count = (m) => rows.filter((r) => r.match.mode === m).length;
  chartMode = Object.keys(MODES).reduce((a, b) => (count(b) > count(a) ? b : a));
  paintChart();
}

function paintName() {
  const free = usernameFreeAt(currentMe()?.profile?.username_changed_at);
  const locked = Date.now() < free;
  $('#set-name-edit').disabled = locked;
  $('#set-name-hint').textContent = locked ? `Podés volver a cambiarlo el ${usernameFreeDay(free)}` : `Podés cambiarlo una vez cada ${AUTH.usernameCooldownDays} días`;
}

function paintVolume() {
  $('#set-volume-val').textContent = `${$('#set-volume').value}%`;
}

function paintVoice() {
  const on = isVoiceOn();
  for (const id of ['#set-volume', '#set-gender', '#set-voice-test']) $(id).disabled = !on;
}

// Menos movimiento y letra más grande: una clase en <html> (se aplica al cargar y al cambiarlos)
export function applyLook() {
  document.documentElement.classList.toggle('less-motion', store.get(KEYS.lessMotion, '0') === '1');
  document.documentElement.classList.toggle('big-text', store.get(KEYS.bigText, '0') === '1');
}
applyLook();

export function loadSettings() {
  $('#set-voice').checked = isVoiceOn();
  $('#set-sfx').checked = isSfxOn();
  $('#set-volume').value = Math.round(voiceVolume() * 100);
  $('#set-gender').value = myVoice();
  $('#set-labels').checked = store.get(KEYS.cardLabels, '1') === '1';
  $('#set-lowgfx').checked = store.get(KEYS.lowGfx, '0') === '1';
  $('#set-online').checked = store.get(KEYS.invisible, '0') !== '1';
  $('#set-note-msgs').checked = store.get(KEYS.noteMsgs, '1') !== '0';
  $('#set-note-reqs').checked = store.get(KEYS.noteReqs, '1') !== '0';
  $('#set-cam').value = store.get(KEYS.camMode, 'first') === 'front' ? 'front' : 'first';
  $('#set-motion').checked = store.get(KEYS.lessMotion, '0') === '1';
  $('#set-bigtext').checked = store.get(KEYS.bigText, '0') === '1';
  $('#set-acct-msg').textContent = '';
  $('#set-name-form').classList.add('hidden');
  $('#set-name-msg').textContent = '';
  paintVolume();
  paintVoice();
  paintName();
}

export function initProfile(repaint) {
  $('#pf-modes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-chart]');
    if (!b) return;
    chartMode = b.dataset.chart;
    paintChart();
  });
  $('#set-voice').addEventListener('change', (e) => {
    if (e.target.checked !== isVoiceOn()) toggleVoice();
    paintVoice();
    dispatchEvent(new Event('trukeados:voice'));
  });
  $('#set-sfx').addEventListener('change', (e) => {
    if (e.target.checked !== isSfxOn()) toggleSfx();
  });
  $('#set-gender').addEventListener('change', (e) => setMyVoice(e.target.value));
  $('#set-volume').addEventListener('input', (e) => {
    setVoiceVolume(Number(e.target.value) / 100);
    paintVolume();
  });
  $('#set-voice-test').addEventListener('click', previewVoice);
  $('#set-labels').addEventListener('change', (e) => store.set(KEYS.cardLabels, e.target.checked ? '1' : '0'));
  $('#set-lowgfx').addEventListener('change', (e) => store.set(KEYS.lowGfx, e.target.checked ? '1' : '0'));
  $('#set-online').addEventListener('change', (e) => store.set(KEYS.invisible, e.target.checked ? '0' : '1'));
  $('#set-note-msgs').addEventListener('change', (e) => store.set(KEYS.noteMsgs, e.target.checked ? '1' : '0'));
  $('#set-note-reqs').addEventListener('change', (e) => {
    store.set(KEYS.noteReqs, e.target.checked ? '1' : '0');
    if (!e.target.checked) $('#friend-notes').querySelectorAll('.fr-note').forEach((n) => n.remove());
  });
  $('#set-cam').addEventListener('change', (e) => store.set(KEYS.camMode, e.target.value));
  $('#set-motion').addEventListener('change', (e) => {
    store.set(KEYS.lessMotion, e.target.checked ? '1' : '0');
    applyLook();
  });
  $('#set-bigtext').addEventListener('change', (e) => {
    store.set(KEYS.bigText, e.target.checked ? '1' : '0');
    applyLook();
  });
  // de fábrica: lo de este dispositivo (no la sesión ni lo de la cuenta)
  $('#set-reset').addEventListener('click', () => {
    for (const k of [KEYS.voice, KEYS.voiceVol, KEYS.cardLabels, KEYS.lowGfx, KEYS.voiceGender, KEYS.sfx, KEYS.camMode, KEYS.muted, KEYS.invisible, KEYS.noteMsgs, KEYS.noteReqs, KEYS.lessMotion, KEYS.bigText]) store.del(k);
    applyLook();
    loadSettings();
    $('#set-acct-msg').textContent = 'Listo: los ajustes volvieron a como venían.';
    $('#set-acct-msg').classList.remove('bad');
  });
  // bajar tus datos: un JSON
  $('#set-export').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try {
      const data = await api(ROUTES.api.exportMe);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `trukeados-${currentMe()?.profile?.username || 'datos'}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      $('#set-acct-msg').textContent = err.message;
      $('#set-acct-msg').classList.add('bad');
    }
    b.disabled = false;
  });
  // borrar la cuenta: con el nombre de usuario escrito a mano
  const dlg = $('#delete-dialog');
  const want = () => currentMe()?.profile?.username || '';
  $('#set-delete').addEventListener('click', () => {
    $('#delete-name').textContent = want();
    $('#delete-confirm').value = '';
    $('#delete-msg').textContent = '';
    $('#delete-go').disabled = true;
    dlg.showModal();
    $('#delete-confirm').focus();
  });
  $('#delete-confirm').addEventListener('input', (e) => {
    $('#delete-go').disabled = e.target.value.trim().toLowerCase() !== want().toLowerCase();
  });
  $('#delete-form').addEventListener('submit', async (e) => {
    if (e.submitter?.value === 'cancel') return;
    e.preventDefault();
    $('#delete-go').disabled = true;
    try {
      await api(ROUTES.api.deleteMe, { confirm: $('#delete-confirm').value });
      dlg.close();
      await signOut();
      location.href = ROUTES.home;
    } catch (err) {
      $('#delete-msg').textContent = err.message;
      $('#delete-go').disabled = false;
    }
  });

  const nameMsg = (t, bad = true) => {
    $('#set-name-msg').textContent = t;
    $('#set-name-msg').classList.toggle('bad', bad);
  };
  const closeRename = () => $('#set-name-form').classList.add('hidden');
  $('#set-name-warn').textContent = `${AUTH.usernameHint}. Después no lo vas a poder cambiar por ${AUTH.usernameCooldownDays} días.`;
  $('#set-name-edit').addEventListener('click', () => {
    nameMsg('');
    $('#set-name-input').value = currentMe()?.profile?.username || '';
    $('#set-name-form').classList.remove('hidden');
    $('#set-name-input').select();
  });
  $('#set-name-cancel').addEventListener('click', () => {
    nameMsg('');
    closeRename();
  });
  $('#set-name-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#set-name-input').value.trim();
    if (!AUTH.usernameRe.test(name)) return nameMsg(AUTH.usernameHint);
    $('#set-name-save').disabled = true;
    try {
      await changeUsername(name);
      closeRename();
      repaint();
      paintName();
      nameMsg(`Listo, ahora sos ${name}`, false);
    } catch (err) {
      nameMsg(err.message);
    } finally {
      $('#set-name-save').disabled = false;
    }
  });
}
