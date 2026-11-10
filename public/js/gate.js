// Antes de sentarte en una mesa ajena: cómo se juega ahí (por ELO o sin puntuar, puntos, flor, muestra, trampas).
import { ROOM_OPTIONS, optionForMode, modeLabel } from './config.js';
import { $, esc } from './dom.js';

const row = (k, v) => `<div class="gt-row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;

export function showGate(info, code, enter, leave) {
  const c = info.cfg;
  const box = $('#gate');
  const rated = c.rated !== false;
  // "sin trampas" -> Trampas: Sí / No
  const title = (o) => { const t = o.short.replace(/^(con|sin) /, ''); return t[0].toUpperCase() + t.slice(1); };
  const rules = [
    row('Puntuación', rated ? 'Por ELO' : 'Sin puntuar'),
    row('Jugadores', modeLabel(c.mode)),
    row('Se juega', `a ${c.target} puntos`),
    ...ROOM_OPTIONS.filter((o) => optionForMode(o, c.mode)).map((o) => row(title(o), c[o.key] ? 'Sí' : 'No')),
    ...(c.mode === '1v1' ? [] : [row('Truco desde segunda', c.trucoDesdeSegunda ? 'Sí' : 'No')]),
  ].join('');
  box.innerHTML = `<div class="m-wrap gt">
    <h2>${info.host ? `La mesa de ${esc(info.host)}` : `Mesa ${esc(code)}`}</h2>
    <p class="gt-rated ${rated ? 'on' : ''}">${rated ? 'Esta mesa juega por ELO' : 'Esta mesa no suma ni resta ELO'}</p>
    <div class="gt-rules">${rules}</div>
    ${info.players.length ? `<p class="gt-who">En la mesa: ${info.players.map(esc).join(', ')}</p>` : ''}
    <div class="gt-foot"><button class="btn ghost big" type="button" id="gate-no">Volver</button><button class="btn primary big" type="button" id="gate-yes">Sentarme</button></div>
  </div>`;
  box.classList.remove('hidden');
  $('#gate-yes').onclick = enter;
  $('#gate-no').onclick = () => {
    box.classList.add('hidden');
    leave();
  };
}
