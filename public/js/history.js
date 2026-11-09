// Historial: la lista de tus partidas (pestaña del menú) y el visor de una partida grabada (/partida/ID), que
// la rebobina mano por mano y paso por paso, con el análisis de tus decisiones (analysis.js en un Web Worker).
import { ROUTES, GRADES, modeLabel, roomOptionsText } from './config.js';
import { cardName, team, TRUCO_NAMES } from './engine.js';
import { handFrames, describe, actionLabel } from './replay.js';
import { accuracy, gradeCounts } from './analysis.js';
import { $, esc, api } from './dom.js';

// ------------------------------------------------------------------ lista (pestaña Historial)

let oldest = null; // ended_at de la última partida mostrada, para "Ver más"

const ago = (iso) => {
  const s = (Date.parse(iso) - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' });
  for (const [unit, sec] of [['day', 86400], ['hour', 3600], ['minute', 60]]) if (Math.abs(s) >= sec) return rtf.format(Math.round(s / sec), unit);
  return 'recién';
};
const sign = (n) => (n > 0 ? `+${n}` : String(n));

function rowHtml(r) {
  const m = r.match;
  const mine = team(r.seat);
  const rivals = m.seats.filter((_, i) => team(i) !== mine).map((s) => s.name).join(', ');
  const elo = r.elo_before != null && r.elo_after != null ? `<b class="${r.elo_after >= r.elo_before ? 'up' : 'down'}">${sign(r.elo_after - r.elo_before)} ELO</b>` : '<small>sin ELO</small>';
  return `<button type="button" class="hi-row" data-match="${esc(m.id)}">
    <span class="m-tmode">${esc(modeLabel(m.mode))}</span>
    <span class="hi-info"><b class="${r.won ? 'won' : 'lost'}">${r.won ? 'Ganaste' : 'Perdiste'} ${m.score[mine]} a ${m.score[1 - mine]}</b>
      <small>contra ${esc(rivals)} · ${esc(ago(r.ended_at))}</small></span>
    <span class="hi-gain">${elo}<small>+${r.coins} monedas</small></span>
  </button>`;
}

export async function loadHistory(more = false) {
  const list = $('#history-list');
  if (!more) oldest = null;
  try {
    const q = more && oldest ? `?before=${encodeURIComponent(oldest)}` : '';
    const { matches } = await api(ROUTES.api.matches + q);
    const html = matches.map(rowHtml).join('');
    list.innerHTML = more ? list.innerHTML + html : html;
    if (matches.length) oldest = matches[matches.length - 1].ended_at;
    $('#history-empty').classList.toggle('hidden', !!list.children.length);
    $('#history-more').classList.toggle('hidden', matches.length < 20);
  } catch (err) {
    if (!more) list.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
  }
}

// openMatch(id): abre el visor (lo resuelve main.js con la ruta /partida/ID).
export function initHistory(openMatch, back) {
  $('#history-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-match]');
    if (b) openMatch(b.dataset.match);
  });
  $('#history-more').addEventListener('click', () => loadHistory(true));
  $('#replay-back').addEventListener('click', back);
  $('#replay-analyze').addEventListener('click', () => viewer?.analyze());
  $('#replay-hands').addEventListener('click', (e) => {
    const b = e.target.closest('[data-hand]');
    if (b) viewer?.goHand(Number(b.dataset.hand));
  });
  $('#replay-log').addEventListener('click', (e) => {
    const li = e.target.closest('[data-frame]');
    if (li) viewer?.goFrame(Number(li.dataset.frame));
  });
  document.querySelector('.r-controls').addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]');
    if (b) viewer?.step(b.dataset.step);
  });
  addEventListener('keydown', (e) => {
    if (!viewer || $('#replay').classList.contains('hidden') || e.target.matches('input, textarea')) return;
    const k = { ArrowRight: 'next', ArrowLeft: 'prev', Home: 'first', End: 'last' }[e.key];
    if (k) {
      e.preventDefault();
      viewer.step(k);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      viewer.goHand(viewer.hand + (e.key === 'ArrowDown' ? 1 : -1));
    }
  });
}

// ------------------------------------------------------------------ visor

let viewer = null;

export async function showReplay(id) {
  for (const s of ['#menu', '#game']) $(s).classList.add('hidden');
  $('#replay').classList.remove('hidden');
  $('#replay-board').innerHTML = '<p class="muted">Cargando la partida…</p>';
  $('#replay-log').innerHTML = '';
  $('#replay-hands').innerHTML = '';
  $('#replay-summary').classList.add('hidden');
  viewer?.close();
  viewer = null;
  try {
    const { match } = await api(ROUTES.api.match(id));
    viewer = new Viewer(match);
  } catch (err) {
    $('#replay-board').innerHTML = `<p class="muted">${esc(err.message)}</p>`;
  }
}

export function hideReplay() {
  viewer?.close();
  viewer = null;
  $('#replay').classList.add('hidden');
}

const card = (c, cls = '') => `<img class="r-card ${cls}" src="${ROUTES.card(c)}" alt="${esc(cardName(c))}" title="${esc(cardName(c))}">`;
const GRADE = Object.fromEntries(GRADES.map((g) => [g.key, g]));
const ROUND = ['Primera', 'Segunda', 'Tercera'];

class Viewer {
  constructor(match) {
    this.m = match;
    this.me = match.me.seat;
    this.names = match.seats.map((s) => s.name);
    this.hands = match.log.hands;
    this.frames = this.hands.map(handFrames); // cuadros de cada mano (reproducidos con el motor)
    this.analysis = []; // resultados por mano (analyzeHand)
    this.hand = 0;
    this.frame = 0;
    const mine = team(this.me);
    $('#replay-title').textContent = `${match.me.won ? 'Ganaste' : 'Perdiste'} ${match.score[mine]} a ${match.score[1 - mine]}`;
    const opts = roomOptionsText(match.options || {});
    $('#replay-sub').textContent = [modeLabel(match.mode), `a ${match.target}`, opts, new Date(match.ended_at).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })].filter(Boolean).join(' · ');
    $('#replay-analyze').disabled = false;
    $('#replay-analyze').textContent = 'Analizar mis jugadas';
    this.goHand(0);
  }

  close() {
    this.worker?.terminate();
    this.worker = null;
  }

  framesOf(i) {
    return this.frames[i];
  }

  goHand(i) {
    if (i < 0 || i >= this.hands.length) return;
    this.hand = i;
    this.frame = 0;
    this.renderHands();
    this.renderLog();
    this.render();
  }

  goFrame(i) {
    const n = this.framesOf(this.hand).length;
    this.frame = Math.max(0, Math.min(n - 1, i));
    this.render();
  }

  step(k) {
    const n = this.framesOf(this.hand).length;
    if (k === 'first') return this.goFrame(0);
    if (k === 'last') return this.goFrame(n - 1);
    if (k === 'next') {
      if (this.frame < n - 1) return this.goFrame(this.frame + 1);
      return this.goHand(this.hand + 1);
    }
    if (this.frame > 0) return this.goFrame(this.frame - 1);
    if (this.hand > 0) {
      this.goHand(this.hand - 1);
      this.goFrame(this.framesOf(this.hand).length - 1);
    }
  }

  // Manos: el tanteador con que terminó cada una (y la peor calificación tuya, si ya se analizó).
  renderHands() {
    $('#replay-hands').innerHTML = this.hands
      .map((h, i) => {
        const fr = this.frames[i];
        const end = fr ? fr[fr.length - 1].g.score : null;
        const worst = (this.analysis[i] || []).reduce((w, r) => (GRADES.findIndex((g) => g.key === r.grade) > GRADES.findIndex((g) => g.key === w) ? r.grade : w), 'mejor');
        const flag = this.analysis[i] && ['error', 'insensata'].includes(worst) ? `<i class="g-dot g-${worst}"></i>` : '';
        return `<button type="button" data-hand="${i}" class="${i === this.hand ? 'on' : ''}">Mano ${i + 1}${end ? `<small>${end[0]}-${end[1]}</small>` : ''}${flag}</button>`;
      })
      .join('');
    $('#replay-hands .on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  resultFor(frame) {
    return (this.analysis[this.hand] || []).find((r) => r.frame === frame);
  }

  renderLog() {
    const frames = this.framesOf(this.hand);
    $('#replay-log').innerHTML = frames
      .map((f, i) => {
        if (!i) return `<li data-frame="0" class="r-deal">Reparte ${esc(this.names[f.g.dealer])}${f.g.h.muestra ? ` · muestra: ${esc(cardName(f.g.h.muestra))}` : ''}</li>`;
        const text = describe(f, this.names);
        if (!text.length) return '';
        const r = this.resultFor(i);
        const badge = r ? `<span class="g-badge g-${r.grade}">${esc(GRADE[r.grade].label)}</span>` : '';
        const tip = r && r.grade !== 'mejor' ? `<small class="r-tip">Lo mejor era ${esc(actionLabel(r.best.a))}${r.loss >= 0.05 ? ` (perdiste ${r.loss.toFixed(1).replace('.', ',')})` : ''}</small>` : '';
        const auto = f.step?.[2] ? ' <small>(jugó el bot por él)</small>' : '';
        return `<li data-frame="${i}" class="${f.seat === this.me ? 'mine' : ''}">${badge}${text.map(esc).join('<br>')}${auto}${tip}</li>`;
      })
      .join('');
  }

  render() {
    const frames = this.framesOf(this.hand);
    const f = frames[this.frame];
    const g = f.g;
    const h = g.h;
    $('#replay-pos').textContent = `Mano ${this.hand + 1} de ${this.hands.length} · paso ${this.frame} de ${frames.length - 1}`;
    for (const li of $('#replay-log').children) li.classList.toggle('on', Number(li.dataset.frame) === this.frame);
    $('#replay-log .on')?.scrollIntoView({ block: 'nearest' });

    // asientos: los rivales arriba, tu equipo abajo (vos al medio de abajo)
    const order = Array.from({ length: g.n }, (_, k) => (this.me + k) % g.n);
    const mine = order.filter((s) => team(s) === team(this.me));
    const theirs = order.filter((s) => team(s) !== team(this.me));
    const seatHtml = (s) => {
      const played = h.table[s];
      const turn = !f.events.some((e) => e.type === 'hand-end') && h.phase === 'play' && h.turn === s;
      return `<div class="r-seat t${team(s)} ${s === this.me ? 'me' : ''} ${turn ? 'turn' : ''}">
        <div class="r-name">${esc(this.names[s])}${s === g.dealer ? ' <small>reparte</small>' : ''}${s === h.mano ? ' <small>mano</small>' : ''}${h.mazo[s] ? ' <small>al mazo</small>' : ''}</div>
        <div class="r-hand">${h.inHand[s].map((c) => card(c)).join('') || '<span class="muted">sin cartas</span>'}</div>
        <div class="r-played">${[0, 1, 2]
          .map((rd) => {
            const p = played.find((x) => x.round === rd && !x.over) || played.find((x) => x.round === rd);
            if (!p) return '<span class="r-slot"></span>';
            const cls = [p.faceDown ? 'down' : '', p.burned ? 'burned' : ''].join(' ');
            return `<span class="r-slot">${card(p.c, cls)}<small>${ROUND[rd]}${p.faceDown ? ' · tapada' : p.burned ? ' · quemada' : ''}</small></span>`;
          })
          .join('')}</div>
      </div>`;
    };
    const tr = h.truco;
    const status = [
      tr.level > 1 ? `${TRUCO_NAMES[tr.level]} querido` : '',
      tr.pending ? `${TRUCO_NAMES[tr.pending.level]} sin contestar` : '',
      h.envido.state === 'done' && h.envido.winnerSeat != null ? `Envido: ${this.names[h.envido.winnerSeat]}` : '',
    ].filter(Boolean);
    const teamNames = (t) => this.names.filter((_, i) => team(i) === t).join(' y ');
    $('#replay-board').innerHTML = `
      <div class="r-row">${theirs.map(seatHtml).join('')}</div>
      <div class="r-center">
        <div class="r-score"><span class="t${team(this.me)}">${esc(teamNames(team(this.me)))} <b>${g.score[team(this.me)]}</b></span><span class="t${1 - team(this.me)}"><b>${g.score[1 - team(this.me)]}</b> ${esc(teamNames(1 - team(this.me)))}</span></div>
        ${h.muestra ? `<div class="r-muestra">${card(h.muestra)}<small>muestra</small></div>` : ''}
        ${status.length ? `<div class="r-status">${status.map(esc).join(' · ')}</div>` : ''}
        ${this.frame ? `<div class="r-now">${describe(f, this.names).map(esc).join('<br>')}</div>` : ''}
      </div>
      <div class="r-row">${mine.map(seatHtml).join('')}</div>`;
  }

  // Analiza tus decisiones mano por mano en un Web Worker (no traba la pantalla).
  analyze() {
    if (this.worker) return;
    const btn = $('#replay-analyze');
    btn.disabled = true;
    this.worker = new Worker('/js/analysis-worker.js', { type: 'module' });
    let i = 0;
    const next = () => {
      if (i >= this.hands.length) {
        this.worker.terminate();
        this.worker = null;
        btn.textContent = 'Análisis listo';
        return this.renderSummary();
      }
      btn.textContent = `Analizando mano ${i + 1} de ${this.hands.length}…`;
      this.worker.postMessage({ id: i, hand: this.hands[i], seats: [this.me], seed: i + 1 });
    };
    this.worker.onmessage = (e) => {
      this.analysis[e.data.id] = e.data.results || [];
      if (e.data.id === this.hand) this.renderLog(), this.render();
      this.renderHands();
      this.renderSummary();
      i++;
      next();
    };
    this.worker.onerror = () => {
      btn.textContent = 'No se pudo analizar';
      this.worker?.terminate();
      this.worker = null;
    };
    next();
  }

  renderSummary() {
    const all = this.analysis.flat().filter(Boolean);
    if (!all.length) return;
    const c = gradeCounts(all);
    const worst = all.reduce((w, r) => (r.loss > (w?.loss ?? -1) ? r : w), null);
    const handOf = (r) => this.analysis.findIndex((a) => a?.includes(r));
    $('#replay-summary').classList.remove('hidden');
    $('#replay-summary').innerHTML = `
      <div class="r-acc"><b>${accuracy(all)}%</b><small>precisión</small></div>
      <div class="r-grades">${GRADES.map((g) => `<span class="g-badge g-${g.key}">${esc(g.label)} <b>${c[g.key]}</b></span>`).join('')}</div>
      ${worst && worst.loss >= 0.8 ? `<button type="button" class="a-link" id="replay-worst">Ver tu jugada más cara (mano ${handOf(worst) + 1})</button>` : ''}`;
    $('#replay-worst')?.addEventListener('click', () => {
      this.goHand(handOf(worst));
      this.goFrame(worst.frame);
    });
  }
}
