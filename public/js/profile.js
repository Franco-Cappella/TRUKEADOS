// Perfil (evolución del ELO y últimas partidas) y Ajustes (cuenta y sonido).
import { ROUTES, MODES, modeLabel } from './config.js';
import { $, esc, api } from './dom.js';
import { rowHtml } from './history.js';
import { isVoiceOn, toggleVoice, voiceVolume, setVoiceVolume, isSfxOn, toggleSfx, myVoice, setMyVoice } from './audio.js';

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

export function loadSettings() {
  $('#set-voice').checked = isVoiceOn();
  $('#set-sfx').checked = isSfxOn();
  $('#set-volume').value = Math.round(voiceVolume() * 100);
  $('#set-volume').disabled = !isVoiceOn();
  $('#set-gender').value = myVoice();
}

export function initProfile() {
  $('#pf-modes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-chart]');
    if (!b) return;
    chartMode = b.dataset.chart;
    paintChart();
  });
  $('#set-voice').addEventListener('change', (e) => {
    if (e.target.checked !== isVoiceOn()) toggleVoice();
    $('#set-volume').disabled = !e.target.checked;
    dispatchEvent(new Event('trukeados:voice'));
  });
  $('#set-sfx').addEventListener('change', (e) => {
    if (e.target.checked !== isSfxOn()) toggleSfx();
  });
  $('#set-gender').addEventListener('change', (e) => setMyVoice(e.target.value));
  $('#set-volume').addEventListener('input', (e) => setVoiceVolume(Number(e.target.value) / 100));
}
