// Historial: la lista de tus partidas y la revisión de una partida grabada (/partida/ID), como la de chess.com:
// la partida se reproduce en la mesa 3D frase por frase, para adelante y para atrás, con un ícono según lo buena o
// mala que fue cada jugada, la barra y el gráfico de quién la tenía ganada, y la precisión de cada equipo.
// La evaluación corre en un Web Worker (analysis-worker.js) y empieza sola al abrir la partida.
import { ROUTES, GRADES, modeLabel, roomOptionsText } from './config.js';
import { cardName, team, burnVisible } from './engine.js';
import { handFrames, describe, actionLabel } from './replay.js';
import { accuracy, gradeCounts, winSeries, explain } from './analysis.js';
import { lookFor, dressed } from './characters.js';
import { TableScene } from './scene.js';
import { $, esc, api } from './dom.js';
import { say, hush, isVoiceOn, toggleVoice } from './audio.js';

// ------------------------------------------------------------------ lista

let oldest = null; // ended_at de la última partida mostrada, para "Ver más"

const ago = (iso) => {
  const s = (Date.parse(iso) - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' });
  for (const [unit, sec] of [['day', 86400], ['hour', 3600], ['minute', 60]]) if (Math.abs(s) >= sec) return rtf.format(Math.round(s / sec), unit);
  return 'recién';
};
const sign = (n) => (n > 0 ? `+${n}` : String(n));

export function rowHtml(r) {
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

// openMatch(id): abre la revisión (lo resuelve main.js con la ruta /partida/ID).
export function initHistory(openMatch, back) {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-match]');
    if (b) openMatch(b.dataset.match);
  });
  $('#history-more').addEventListener('click', () => loadHistory(true));
  $('#replay-back').addEventListener('click', back);
  $('#replay-log').addEventListener('click', (e) => {
    const li = e.target.closest('[data-at]');
    if (li) viewer?.go(Number(li.dataset.at));
  });
  $('#replay-graph').addEventListener('click', (e) => viewer?.seekGraph(e));
  $('#replay-reveal').addEventListener('change', (e) => viewer?.setReveal(e.target.checked));
  $('#replay-voice').checked = isVoiceOn();
  $('#replay-voice').addEventListener('change', (e) => {
    if (e.target.checked !== isVoiceOn()) toggleVoice();
  });
  $('#replay-controls').addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]');
    if (b) viewer?.step(b.dataset.step);
  });
  addEventListener('keydown', (e) => {
    if (!viewer || $('#replay').classList.contains('hidden') || e.target.matches('input, textarea')) return;
    const k = { ArrowRight: 'next', ArrowLeft: 'prev', Home: 'first', End: 'last', ' ': 'play', ArrowDown: 'nextHand', ArrowUp: 'prevHand' }[e.key];
    if (!k) return;
    e.preventDefault();
    viewer.step(k);
  });
}

// ------------------------------------------------------------------ revisión

let viewer = null;
let stage = null; // una sola escena 3D para todas las revisiones

export async function showReplay(id) {
  for (const s of ['#menu', '#game']) $(s).classList.add('hidden');
  $('#replay').classList.remove('hidden');
  $('#replay-log').innerHTML = '<li class="muted">Cargando la partida…</li>';
  $('#replay-summary').innerHTML = '';
  $('#replay-graph').innerHTML = '';
  $('#replay-coach').innerHTML = '';
  $('#replay-title').textContent = '';
  $('#replay-sub').textContent = '';
  viewer?.close();
  viewer = null;
  try {
    const { match } = await api(ROUTES.api.match(id));
    if (!stage) stage = new TableScene($('#replay-stage'));
    stage.resume();
    stage.resize();
    viewer = new Viewer(match, stage);
  } catch (err) {
    $('#replay-log').innerHTML = `<li class="muted">${esc(err.message)}</li>`;
  }
}

export function hideReplay() {
  viewer?.close();
  viewer = null;
  stage?.pause();
  $('#replay').classList.add('hidden');
}

const GRADE = Object.fromEntries(GRADES.map((g) => [g.key, g]));
const AUTOPLAY_MS = 1800;

const icon = (key, cls = '') => (key ? `<i class="g-ic g-${key} ${cls}" title="${esc(GRADE[key].label)}">${esc(GRADE[key].glyph)}</i>` : '');
const pct = (x) => `${Math.round(x * 100)}%`;
// La frase que se escucha en la mesa ("¡Truco!", "Quiero"): solo los cantos y los tantos van en globo.
const spoken = (f) => f.events.filter((e) => e.type === 'call' || e.type === 'tanto').map((e) => (e.type === 'call' ? e.text : e.value ?? 'Son buenas')).join(' · ');
// Todo lo que se dice en voz alta en este paso.
const voiceLines = (f) => f.events.flatMap((e) => {
  if (e.type === 'call') return [[e.text, e.seat]];
  if (e.type === 'tanto') return [[String(e.value ?? 'Son buenas'), e.seat]];
  if (e.type === 'show') return [[`${e.value} en mesa`, e.seat]];
  return [];
});

class Viewer {
  constructor(match, scene) {
    this.m = match;
    this.scene = scene;
    this.me = match.me.seat;
    this.myTeam = team(this.me);
    this.names = match.seats.map((s) => s.name);
    this.hands = match.log.hands;
    this.frames = this.hands.map(handFrames); // cuadros de cada mano (reproducidos con el motor)
    // la partida entera en una sola línea: cada paso que dice algo
    this.line = [];
    this.frames.forEach((frames, hand) => frames.forEach((f, frame) => {
      if (!frame || describe(f, this.names).length) this.line.push({ hand, frame });
    }));
    const series = winSeries(this.frames);
    const key = (hand, frame) => `${hand}:${frame}`;
    const byKey = new Map(series.map((s) => [key(s.hand, s.frame), s.p]));
    this.series = this.line.map(({ hand, frame }) => {
      const p = byKey.get(key(hand, frame)); // chance del equipo 0
      return this.myTeam === 0 ? p : 1 - p;
    });
    this.analysis = this.hands.map(() => null);
    this.at = 0;
    this.reveal = $('#replay-reveal').checked;
    this.plates = new Map();
    this.drawn = null;
    const mine = this.myTeam;
    $('#replay-title').textContent = `${match.me.won ? 'Ganaste' : 'Perdiste'} ${match.score[mine]} a ${match.score[1 - mine]}`;
    const opts = roomOptionsText(match.options || {});
    $('#replay-sub').textContent = [modeLabel(match.mode), `a ${match.target}`, match.rated ? 'por ELO' : '', opts, new Date(match.ended_at).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })].filter(Boolean).join(' · ');

    $('#replay-voice').checked = isVoiceOn();
    this.seats = match.seats.map((s, i) => ({ name: s.name, cos: s.cos || {}, seat: i }));
    scene.setLayout({ n: match.seats.length, me: this.me, spectator: false });
    scene.setTable({});
    scene.setMyLook(dressed(lookFor(this.names[this.me], this.me), this.seats[this.me].cos));
    this.buildPlates();
    scene.onFrame = () => this.placePlates();
    this.renderLog();
    this.renderGraph();
    this.renderSummary();
    this.go(0);
    this.analyze();
  }

  close() {
    this.worker?.terminate();
    this.worker = null;
    clearInterval(this.timer);
    this.timer = null;
    hush(true);
    this.scene.onFrame = null;
    $('#replay-labels').innerHTML = '';
    $('#replay-caption').textContent = '';
  }

  // ---------------------------------------------------------------- moverse
  get cur() {
    return this.line[this.at];
  }

  go(i, { auto = false } = {}) {
    if (!auto) this.stopAuto();
    const prev = this.drawn;
    this.at = Math.max(0, Math.min(this.line.length - 1, i));
    const { hand, frame } = this.cur;
    // de a un paso hacia adelante en la misma mano se anima; si no, la mesa se arma de nuevo de golpe
    const animate = !!prev && prev.hand === hand && this.at === prev.at + 1;
    this.drawn = { hand, frame, at: this.at };
    this.paintScene(animate);
    // se escucha solo al avanzar de a un paso; al saltar o ir para atrás, silencio. En la reproducción automática
    // no se corta lo que se está diciendo: cada frase termina.
    if (!auto) hush(true);
    if (prev && this.at === prev.at + 1) for (const [text, seat] of voiceLines(this.frames[hand][frame])) say(text, seat);
    this.renderPosition();
  }

  step(k) {
    const { hand } = this.cur;
    const firstOf = (h) => this.line.findIndex((x) => x.hand === h);
    if (k === 'next') return this.go(this.at + 1);
    if (k === 'prev') return this.go(this.at - 1);
    if (k === 'first') return this.go(0);
    if (k === 'last') return this.go(this.line.length - 1);
    if (k === 'nextHand') return hand + 1 < this.hands.length && this.go(firstOf(hand + 1));
    if (k === 'prevHand') return this.go(firstOf(this.at === firstOf(hand) ? Math.max(0, hand - 1) : hand));
    if (k === 'play') return this.timer ? this.stopAuto() : this.startAuto();
  }

  startAuto() {
    if (this.at >= this.line.length - 1) this.go(0);
    $('#replay-play').textContent = '❚❚';
    this.timer = setInterval(() => {
      if (this.at >= this.line.length - 1) return this.stopAuto();
      this.go(this.at + 1, { auto: true });
    }, AUTOPLAY_MS);
  }

  stopAuto() {
    clearInterval(this.timer);
    this.timer = null;
    $('#replay-play').textContent = '▶';
  }

  seekGraph(e) {
    const svg = e.currentTarget.querySelector('svg');
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    this.go(Math.round(((e.clientX - r.left) / r.width) * (this.line.length - 1)));
  }

  setReveal(on) {
    this.reveal = on;
    this.paintPlates();
  }

  // ---------------------------------------------------------------- la mesa
  paintScene(animate) {
    const { hand, frame } = this.cur;
    const f = this.frames[hand][frame];
    const g = f.g;
    const h = g.h;
    const s = this.scene;
    s.setPlayers(this.seats, h.inHand.map((c) => c.length));
    if (!animate) {
      s.setMyCards([], null);
      s.syncTable([], { animate: false });
    }
    s.setMyCards(h.inHand[this.me], null);
    // como en la mesa: la de arriba de dos encimadas se ve quemada recién cuando se decide
    s.syncTable(h.table.map((list) => list.map((p) => ({ ...p, burned: burnVisible(h, p) }))), { animate });
    s.setDealer(g.dealer);
    s.setMuestra(h.muestra);
    const fold = f.events.find((e) => e.type === 'mazo');
    if (fold && animate && frame) {
      const before = this.frames[hand][frame - 1].g.h.inHand;
      s.foldCards(before.map((c, seat) => ({ seat, cards: team(seat) === team(fold.seat) ? c.length : 0 })));
    }
    const said = spoken(f);
    if (said && f.seat != null && f.seat !== this.me) s.speak(f.seat, 1400);
    this.paintPlates();
  }

  buildPlates() {
    const box = $('#replay-labels');
    box.innerHTML = '';
    this.plates.clear();
    this.seats.forEach((p, seat) => {
      if (seat === this.me) return;
      const el = document.createElement('div');
      el.className = `rv-plate t${team(seat)}`;
      box.appendChild(el);
      this.plates.set(seat, el);
    });
  }

  paintPlates() {
    const { hand, frame } = this.cur;
    const f = this.frames[hand][frame];
    const r = this.resultAt(hand, frame);
    const h = f.g.h;
    for (const [seat, el] of this.plates) {
      const acted = f.seat === seat;
      const said = acted ? spoken(f) : '';
      const cards = this.reveal ? h.inHand[seat].map((c) => `<img src="${ROUTES.card(c)}" alt="${esc(cardName(c))}" title="${esc(cardName(c))}">`).join('') : '';
      el.innerHTML = `${said ? `<div class="bubble">${esc(said)}</div>` : ''}
        ${acted && r ? icon(r.grade, 'big') : ''}
        <div class="nameplate t${team(seat)}"><span>${esc(this.names[seat])}</span>${f.g.dealer === seat ? '<span class="chip">reparte</span>' : ''}${h.mazo[seat] ? '<span class="chip">al mazo</span>' : ''}</div>
        ${cards ? `<div class="rv-cards">${cards}</div>` : ''}`;
    }
    this.placePlates();
  }

  placePlates() {
    for (const [seat, el] of this.plates) {
      const p = this.scene.screenPos(seat);
      el.style.display = p?.visible ? '' : 'none';
      if (p?.visible) el.style.transform = `translate(calc(${p.x}px - 50%), calc(${p.y}px - 100%))`;
    }
  }

  // ---------------------------------------------------------------- panel
  resultAt(hand, frame) {
    return (this.analysis[hand] || []).find((r) => r.frame === frame) || null;
  }

  renderPosition() {
    const { hand, frame } = this.cur;
    const f = this.frames[hand][frame];
    const r = this.resultAt(hand, frame);
    const text = frame ? describe(f, this.names) : [`Mano ${hand + 1}: reparte ${this.names[f.g.dealer]}${f.g.h.muestra ? ` · muestra ${cardName(f.g.h.muestra)}` : ''}`];
    $('#replay-caption').innerHTML = `${r ? icon(r.grade) : ''}<span>${text.map(esc).join('<br>')}</span>`;
    $('#replay-pos').textContent = `Mano ${hand + 1} de ${this.hands.length} · ${this.at + 1}/${this.line.length}`;

    const score = f.g.score;
    const names = (t) => this.names.filter((_, i) => team(i) === t).join(' y ');
    const mine = this.myTeam;
    $('#replay-score').innerHTML = `<span class="t${mine}">${esc(names(mine))}</span><b>${score[mine]}</b><i>a ${f.g.target}</i><b>${score[1 - mine]}</b><span class="t${1 - mine}">${esc(names(1 - mine))}</span>`;

    const p = this.series[this.at];
    $('#replay-eval-fill').style.height = pct(p);
    $('#replay-eval-me').textContent = p >= 0.5 ? pct(p) : '';
    $('#replay-eval-them').textContent = p < 0.5 ? pct(1 - p) : '';
    const cursor = $('#replay-graph .rv-cursor');
    if (cursor) cursor.setAttribute('x', this.gx(this.at) - 0.6);

    for (const li of $('#replay-log').children) li.classList.toggle('on', Number(li.dataset.at) === this.at);
    const on = $('#replay-log .on');
    if (on) on.scrollIntoView({ block: 'nearest' });
    this.renderCoach(r);
  }

  renderCoach(r) {
    const box = $('#replay-coach');
    if (!r) {
      box.innerHTML = this.analyzing ? '<p class="muted">Analizando la partida…</p>' : '<p class="muted">Esta jugada no tenía decisión para evaluar.</p>';
      return;
    }
    const cost = (x) => (x < 0.0005 ? 'la mejor' : `−${(x * 100).toFixed(1).replace('.', ',')}%`);
    const label = (a) => {
      const t = actionLabel(a, r.ctx).replace(/^cantar /, '');
      return t[0].toUpperCase() + t.slice(1);
    };
    const options = r.ranked.map((o) => `<li class="${o.mine ? 'mine' : ''}"><span>${esc(label(o.a))}</span><em>${cost(o.cost)}</em></li>`).join('');
    box.innerHTML = `<div class="rv-coach-head">${icon(r.grade, 'big')}<div><b>${esc(this.names[r.seat])}: ${esc(GRADE[r.grade].label)}</b><small>${esc(explain(r))}</small></div></div>
      <ol class="rv-options" aria-label="Chance de ganar que dejaba cada opción">${options}</ol>`;
  }

  renderLog() {
    let lastHand = -1;
    $('#replay-log').innerHTML = this.line
      .map(({ hand, frame }, at) => {
        const f = this.frames[hand][frame];
        const head = hand !== lastHand ? `<li class="rv-hand" data-at="${at}">Mano ${hand + 1}<small>${f.g.score[this.myTeam]} a ${f.g.score[1 - this.myTeam]}</small></li>` : '';
        lastHand = hand;
        if (!frame) return head;
        const r = this.resultAt(hand, frame);
        return `${head}<li data-at="${at}" class="${f.seat === this.me ? 'mine' : ''}">${r ? icon(r.grade) : '<i class="g-ic g-none"></i>'}<span>${describe(f, this.names).map(esc).join('<br>')}</span></li>`;
      })
      .join('');
  }

  gx(i) {
    return (i / Math.max(1, this.line.length - 1)) * 300;
  }

  // Gráfico de ventaja: la parte clara es tu equipo. Marcas en las jugadas destacadas.
  renderGraph() {
    const H = 72;
    const y = (p) => H - p * H;
    const pts = this.series.map((p, i) => `${this.gx(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
    const seps = this.line.map(({ hand, frame }, i) => (frame === 0 && hand ? `<line class="rv-sep" x1="${this.gx(i)}" x2="${this.gx(i)}" y1="0" y2="${H}"/>` : '')).join('');
    const marks = this.line
      .map(({ hand, frame }, i) => {
        const r = this.resultAt(hand, frame);
        return r && ['brillante', 'genial', 'error', 'insensata', 'perdida'].includes(r.grade) ? `<circle class="rv-mark g-${r.grade}" cx="${this.gx(i)}" cy="${y(this.series[i])}" r="2.6"/>` : '';
      })
      .join('');
    $('#replay-graph').innerHTML = `<svg viewBox="0 0 300 ${H}" preserveAspectRatio="none" role="img" aria-label="Chance de ganar de tu equipo durante la partida">
      <polygon class="rv-area" points="0,${H} ${pts} 300,${H}"/>
      <line class="rv-mid" x1="0" x2="300" y1="${H / 2}" y2="${H / 2}"/>
      ${seps}${marks}
      <rect class="rv-cursor" x="${this.gx(this.at) - 0.6}" y="0" width="1.2" height="${H}"/>
    </svg>`;
  }

  renderSummary() {
    const all = this.analysis.flat().filter(Boolean);
    const of = (t) => all.filter((r) => team(r.seat) === t);
    const names = (t) => this.names.filter((_, i) => team(i) === t).join(' y ');
    const side = (t) => `<div class="rv-acc t${t}"><small>${esc(names(t))}</small><b>${all.length && of(t).length ? `${accuracy(of(t))}%` : '—'}</b><small>precisión</small></div>`;
    const a = gradeCounts(of(this.myTeam));
    const b = gradeCounts(of(1 - this.myTeam));
    $('#replay-summary').innerHTML = `<div class="rv-accs">${side(this.myTeam)}${side(1 - this.myTeam)}</div>
      ${all.length ? `<div class="rv-counts">${GRADES.filter((g) => a[g.key] || b[g.key]).map((g) => `<div><b>${a[g.key]}</b>${icon(g.key)}<span title="${esc(g.label)}">${esc(g.label)}</span><b>${b[g.key]}</b></div>`).join('')}</div>` : ''}`;
  }

  // Analiza las decisiones de todos, mano por mano, en un Web Worker (no traba la pantalla).
  analyze() {
    const seats = this.seats.map((s) => s.seat);
    this.analyzing = true;
    this.worker = new Worker('/js/analysis-worker.js', { type: 'module' });
    let i = 0;
    const done = () => {
      this.worker?.terminate();
      this.worker = null;
      this.analyzing = false;
      $('#replay-progress').textContent = '';
      this.renderPosition();
    };
    const next = () => {
      if (i >= this.hands.length) return done();
      $('#replay-progress').textContent = `Analizando mano ${i + 1} de ${this.hands.length}…`;
      this.worker.postMessage({ id: i, hand: this.hands[i], seats, seed: i + 1 });
    };
    this.worker.onmessage = (e) => {
      this.analysis[e.data.id] = e.data.results || [];
      this.renderLog();
      this.renderGraph();
      this.renderSummary();
      this.paintPlates();
      this.renderPosition();
      i++;
      next();
    };
    this.worker.onerror = () => {
      this.worker?.terminate();
      this.worker = null;
      this.analyzing = false;
      $('#replay-progress').textContent = 'No se pudo analizar';
    };
    next();
  }
}
