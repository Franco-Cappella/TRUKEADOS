// Motor de reglas del truco argentino (sin flor, sin muestra).
// JavaScript puro: lo usan el servidor (Durable Object), el bot y los tests. No toca el DOM.
// Las reglas implementadas (y las que no) están explicadas en docs/REGLAS.md.
//
// Asientos 0..n-1 en orden de juego ("hacia la derecha"). Equipo = asiento % 2.
// Reparte `dealer`, corta el de su izquierda (dealer - 1) y se reparte empezando por la mano
// (dealer + 1). En la mano siguiente reparte el que fue mano.
import { MODES, DEFAULT_MODE, DEFAULT_TARGET, TARGETS } from './config.js';

export const SUITS = ['E', 'B', 'O', 'C'];
export const NUMS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
export const SUIT_NAME = { E: 'espada', B: 'basto', O: 'oro', C: 'copa' };
export const TRUCO_NAMES = { 2: 'Truco', 3: 'Retruco', 4: 'Vale cuatro' };
export const ENVIDO_NAMES = { envido: 'Envido', real: 'Real envido', falta: 'Falta envido' };
const MAX_EVENTS = 40;

export const team = (seat) => seat % 2;
export const otherTeam = (t) => 1 - t;
export const cardNum = (c) => parseInt(c, 10);
export const cardSuit = (c) => c[c.length - 1];

export function cardName(c) {
  const n = cardNum(c);
  const s = SUIT_NAME[cardSuit(c)];
  if (n === 1 && (s === 'espada' || s === 'basto')) return `ancho de ${s}`;
  return `${n} de ${s}`;
}

export function newDeck() {
  const d = [];
  for (const s of SUITS) for (const n of NUMS) d.push(`${n}${s}`);
  return d;
}

// Jerarquía del truco: 14 = ancho de espada ... 1 = los cuatros.
const SPECIAL_RANK = { '1E': 14, '1B': 13, '7E': 12, '7O': 11 };
const NUM_RANK = { 3: 10, 2: 9, 1: 8, 12: 7, 11: 6, 10: 5, 7: 4, 6: 3, 5: 2, 4: 1 };
export const rank = (c) => SPECIAL_RANK[c] ?? NUM_RANK[cardNum(c)];

// Carta QUEMADA (tapada, tirada fuera de turno o la de arriba de dos encimadas): en la ronda en que
// cuenta vale como un 4, la más baja. No cambia el envido (se calcula con las 3 cartas repartidas).
export const BURNED_VALUE = NUM_RANK[4];
export const playValue = (p) => (p.burned ? BURNED_VALUE : rank(p.c));

const envVal = (c) => (cardNum(c) <= 7 ? cardNum(c) : 0);

// Tantos de una mano de 3 cartas y las cartas que los forman.
export function tanto(cards) {
  let best = { value: -1, cards: [] };
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (cardSuit(cards[i]) !== cardSuit(cards[j])) continue;
      const v = 20 + envVal(cards[i]) + envVal(cards[j]);
      if (v > best.value) best = { value: v, cards: [cards[i], cards[j]] };
    }
  }
  if (best.value < 0) for (const c of cards) if (envVal(c) > best.value) best = { value: envVal(c), cards: [c] };
  return best;
}

export const validTanto = (v) => Number.isInteger(v) && ((v >= 0 && v <= 7) || (v >= 20 && v <= 33));

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const cutter = (g) => (g.dealer - 1 + g.n) % g.n;
// "Pies" (los últimos de cada equipo): el que reparte y el que corta.
export const pies = (g) => (g.n === 2 ? [0, 1] : [g.dealer, cutter(g)]);
export const isPie = (g, seat) => pies(g).includes(seat);
// Regla de la mesa: en equipos el truco recién se canta desde segunda.
const trucoBlocked = (g) => g.trucoDesdeSegunda && g.h.r === 0;

// ---------------------------------------------------------------- partida

export function newGame({ mode = DEFAULT_MODE, target = DEFAULT_TARGET, ayudas = false, dealer = 0, trucoDesdeSegunda = false } = {}, rng = Math.random) {
  const n = MODES[mode] || MODES[DEFAULT_MODE];
  const g = {
    mode: MODES[mode] ? mode : DEFAULT_MODE,
    n,
    target: TARGETS.includes(target) ? target : DEFAULT_TARGET,
    ayudas: !!ayudas,
    trucoDesdeSegunda: !!trucoDesdeSegunda && n > 2,
    score: [0, 0],
    dealer: dealer % n,
    handNo: 0,
    status: 'playing',
    winner: null,
    ev: [],
    evId: 0,
    h: null,
  };
  deal(g, rng);
  return g;
}

function event(g, e) {
  g.evId++;
  g.ev.push({ id: g.evId, ...e });
  if (g.ev.length > MAX_EVENTS) g.ev.splice(0, g.ev.length - MAX_EVENTS);
}

export function deal(g, rng = Math.random) {
  const n = g.n;
  const d = shuffle(newDeck(), rng);
  const cards = Array.from({ length: n }, () => []);
  const mano = (g.dealer + 1) % n;
  for (let r = 0; r < 3; r++) for (let k = 0; k < n; k++) cards[(mano + k) % n].push(d.pop());
  g.handNo++;
  g.h = {
    cards, // las 3 cartas originales (para el envido)
    inHand: cards.map((c) => c.slice()),
    mano,
    // por asiento: { c, faceDown, round, burned?, under?, over?, thrownIn?, revealed? } (ver play/play2)
    table: Array.from({ length: n }, () => []),
    pre: Array(n).fill(null), // carta de arriba de dos encimadas: se juega sola (quemada) en la ronda siguiente
    rounds: [{ plays: [], result: null, starter: mano }],
    r: 0,
    turn: mano,
    mazo: Array(n).fill(false),
    envido: { calls: [], by: null, bySeat: null, state: 'none', declare: null, winner: null, winnerSeat: null, points: 0, needsShow: false, shown: false },
    truco: { level: 1, pending: null, holder: null },
    pending: [], // puntos que se anotan al terminar la mano: { team, pts, why }
    phase: 'play',
    show: null,
    result: null,
  };
  event(g, { type: 'deal', seat: g.dealer, cutter: cutter(g), mano, hand: g.handNo });
}

// El que reparte la mano siguiente es el que fue mano (el mazo pasa a la derecha).
export function nextHand(g, rng = Math.random) {
  if (g.status !== 'playing' || g.h?.phase !== 'ended') return false;
  g.dealer = (g.dealer + 1) % g.n;
  deal(g, rng);
  return true;
}

export function rematch(g, rng = Math.random) {
  const ng = newGame({ mode: g.mode, target: g.target, ayudas: g.ayudas, trucoDesdeSegunda: g.trucoDesdeSegunda, dealer: (g.dealer + 1) % g.n }, rng);
  ng.evId = g.evId; // los ids de eventos siguen creciendo: el cliente no se confunde
  Object.assign(g, ng);
  return true;
}

// ---------------------------------------------------------------- consultas

const played = (h, seat) => h.rounds[h.r].plays.some((p) => p.seat === seat);
const active = (h, seat) => !h.mazo[seat];
const teamSeats = (g, t) => Array.from({ length: g.n }, (_, i) => i).filter((i) => team(i) === t);

// Quién de un equipo puede cantar/contestar el envido: el pie (o, si se fue al mazo, el que quede).
function envidoVoices(g, t) {
  const seats = teamSeats(g, t).filter((s) => active(g.h, s));
  if (g.n === 2) return seats;
  const pie = seats.filter((s) => isPie(g, s));
  return pie.length ? pie : seats;
}

// ¿Puede `seat` abrir el envido ahora? Solo en primera, antes de tirar su carta y EN SU TURNO
// (o contestando un truco: "el envido está primero").
export function envidoOpenFor(g, seat) {
  const h = g.h;
  if (!h || h.phase !== 'play' || h.r !== 0 || h.envido.state !== 'none') return false;
  if (!active(h, seat) || played(h, seat) || h.truco.level > 1) return false;
  if (!envidoVoices(g, team(seat)).includes(seat)) return false;
  const p = h.truco.pending;
  if (p) return p.level === 2 && team(seat) !== p.byTeam;
  return h.turn === seat;
}

// ¿Puede `seat` cantar truco (o subirlo) en la fase de juego normal? Solo en su turno.
function trucoOpenFor(g, seat) {
  const t = g.h.truco;
  return g.h.turn === seat && !trucoBlocked(g) && t.level < 4 && (t.holder === null || t.holder === team(seat));
}

function envidoNextOptions(calls) {
  if (!calls.length) return ['envido', 'real', 'falta'];
  const last = calls[calls.length - 1];
  if (last === 'envido') return calls.filter((c) => c === 'envido').length < 2 ? ['envido', 'real', 'falta'] : ['real', 'falta'];
  if (last === 'real') return ['falta'];
  return [];
}

function faltaPoints(g, winnerTeam) {
  const leader = g.score[0] >= g.score[1] ? 0 : 1;
  if (g.score[0] === g.score[1] || winnerTeam === leader) return g.target - g.score[winnerTeam];
  return g.target - g.score[leader];
}

function envidoAcceptedPoints(g, calls, winnerTeam) {
  if (calls.includes('falta')) return faltaPoints(g, winnerTeam);
  return calls.reduce((s, c) => s + (c === 'envido' ? 2 : 3), 0);
}

function envidoDeclinedPoints(g, calls, winnerTeam) {
  if (calls.length <= 1) return 1;
  return envidoAcceptedPoints(g, calls.slice(0, -1), winnerTeam);
}

// Quién tiene que actuar ahora: { kind, seats }.
export function waitingFor(g) {
  const h = g.h;
  if (!h || g.status !== 'playing') return { kind: 'none', seats: [] };
  if (h.phase === 'ended') return { kind: 'next-hand', seats: [] };
  if (h.phase === 'show') return { kind: 'show', seats: [h.show.seat] };
  const e = h.envido;
  if (e.state === 'declaring') return { kind: 'declare', seats: [e.declare.seat] };
  if (e.state === 'pending') return { kind: 'envido', seats: envidoVoices(g, otherTeam(e.by)) };
  const p = h.truco.pending;
  if (p) return { kind: 'truco', seats: teamSeats(g, otherTeam(p.byTeam)).filter((s) => active(h, s)) };
  return { kind: 'play', seats: [h.turn] };
}

// Acciones que puede hacer un asiento (el cliente arma los botones con esto).
export function actionsFor(g, seat) {
  const h = g.h;
  const out = {
    play: false, canDouble: false, canDown: false, truco: null, envido: [], quiero: false, noquiero: false,
    cantar: false, buenas: false, minTanto: 0, mazo: false, denunciar: [], mostrar: false, reclamar: false,
  };
  if (!h || g.status !== 'playing' || seat == null) return out;
  if (h.phase === 'show') {
    out.mostrar = seat === h.show.seat && !h.mazo[seat];
    out.reclamar = team(seat) !== team(h.show.seat);
    return out;
  }
  if (h.phase !== 'play' || !active(h, seat)) return out;
  const w = waitingFor(g);
  const mine = w.seats.includes(seat);
  const e = h.envido;
  const t = h.truco;
  if (w.kind === 'declare') {
    if (mine) {
      const best = e.declare.best;
      out.cantar = true; // puede cantar lo que quiera (si miente y lo cazan, pierde)
      out.buenas = !!best;
      out.minTanto = best ? best.value + 1 : 0;
    }
    return out;
  }
  if (w.kind === 'envido') {
    if (mine) {
      out.quiero = out.noquiero = true;
      out.envido = envidoNextOptions(e.calls);
    }
    return out;
  }
  if (w.kind === 'truco') {
    if (mine) {
      out.quiero = out.noquiero = out.mazo = true;
      if (t.pending.level < 4) out.truco = TRUCO_NAMES[t.pending.level + 1];
      if (envidoOpenFor(g, seat)) out.envido = ['envido', 'real', 'falta'];
    }
    return out;
  }
  // fase de juego normal
  out.mazo = true;
  out.denunciar = teamSeats(g, otherTeam(team(seat)));
  if (h.turn !== seat) {
    out.throwOut = !outOfTurnBlock(h, seat); // tirar fuera de turno: la carta se quema
    return out;
  }
  out.play = true;
  out.canDouble = h.inHand[seat].length >= 2 && h.r <= 1 && !h.pre[seat];
  out.canDown = h.r > 0;
  if (trucoOpenFor(g, seat)) out.truco = TRUCO_NAMES[t.level + 1];
  if (envidoOpenFor(g, seat)) out.envido = ['envido', 'real', 'falta'];
  return out;
}

// ---------------------------------------------------------------- acciones

export function act(g, seat, a) {
  const h = g.h;
  if (g.status !== 'playing') return { error: 'La partida terminó' };
  if (!h) return { error: 'Esperá la próxima mano' };
  if (seat == null || seat < 0 || seat >= g.n) return { error: 'No estás sentado' };
  if (h.phase === 'show') return actShow(g, seat, a);
  if (h.phase !== 'play') return { error: 'Esperá la próxima mano' };
  if (!active(h, seat)) return { error: 'Te fuiste al mazo' };
  const w = waitingFor(g);
  const mine = w.seats.includes(seat);
  const T = team(seat);
  const e = h.envido;
  const tr = h.truco;

  switch (a?.t) {
    // Tirar una carta. Tapada o fuera de turno, la carta se QUEMA: cuenta en esta ronda como un 4.
    // Si la tirás fuera de turno, esa es tu jugada de la ronda: cuando te toque, se te saltea.
    case 'play': {
      if (w.kind !== 'play') return { error: 'Hay que contestar el canto primero' };
      const idx = h.inHand[seat].indexOf(a.card);
      if (idx < 0) return { error: 'No tenés esa carta' };
      const faceDown = a.mode === 'down';
      if (faceDown && h.r === 0) return { error: 'En primera no se puede tirar tapada' };
      const outOfTurn = h.turn !== seat;
      if (outOfTurn) {
        const why = outOfTurnBlock(h, seat);
        if (why) return { error: why };
      }
      const burned = faceDown || outOfTurn;
      h.inHand[seat].splice(idx, 1);
      h.table[seat].push({ c: a.card, faceDown, round: h.r, burned });
      h.rounds[h.r].plays.push({ seat, c: a.card, burned });
      event(g, { type: 'play', seat, c: faceDown ? null : a.card, faceDown, burned, outOfTurn, round: h.r });
      if (!outOfTurn) advanceTurn(g);
      return { ok: true };
    }

    // Dos cartas encimadas (trampa). La de abajo juega esta ronda (los rivales no la ven). La de
    // arriba ya está en la mesa y no se puede levantar: es tu jugada de la ronda SIGUIENTE, quemada
    // (vale un 4). Mientras dura esta ronda parece una carta normal; al terminar la ronda se ve
    // quemada, y ahí los rivales pueden pedir "mostrá las dos". Ver docs/REGLAS.md.
    case 'play2': {
      const err = checkPlayTurn(h, w, seat);
      if (err) return err;
      if (h.r > 1) return { error: 'En tercera no se pueden tirar dos' };
      const { bottom, top } = a;
      if (bottom === top) return { error: 'Elegí dos cartas distintas' };
      const hand = h.inHand[seat];
      if (!hand.includes(bottom) || !hand.includes(top)) return { error: 'No tenés esas cartas' };
      h.inHand[seat] = hand.filter((c) => c !== bottom && c !== top);
      h.table[seat].push({ c: bottom, faceDown: false, round: h.r, under: true });
      h.table[seat].push({ c: top, faceDown: false, round: h.r + 1, over: true, burned: true, thrownIn: h.r });
      h.rounds[h.r].plays.push({ seat, c: bottom });
      h.pre[seat] = top;
      event(g, { type: 'play', seat, c: top, double: true, round: h.r });
      advanceTurn(g);
      return { ok: true };
    }

    case 'envido': {
      const kind = a.kind;
      if (!ENVIDO_NAMES[kind]) return { error: 'Canto inválido' };
      if (w.kind === 'envido') {
        if (!mine) return { error: g.n > 2 ? 'El envido lo contesta el pie' : 'Le toca contestar al otro' };
        if (!envidoNextOptions(e.calls).includes(kind)) return { error: 'No se puede subir así' };
        e.calls.push(kind);
      } else {
        if (!envidoOpenFor(g, seat)) return { error: envidoClosedReason(g, seat) };
        e.calls = [kind];
        e.state = 'pending';
      }
      e.by = T;
      e.bySeat = seat;
      event(g, { type: 'call', seat, text: ENVIDO_NAMES[kind], kind: 'envido' });
      return { ok: true };
    }

    case 'truco': {
      if (w.kind === 'truco') {
        if (!mine) return { error: 'Le toca contestar al otro equipo' };
        if (tr.pending.level >= 4) return { error: 'No se puede subir más' };
        tr.level = tr.pending.level; // subir implica querer lo anterior
        tr.pending = { level: tr.pending.level + 1, byTeam: T, bySeat: seat };
        tr.holder = null;
      } else if (w.kind === 'play') {
        if (trucoBlocked(g)) return { error: 'En equipo el truco se canta desde segunda' };
        if (tr.level >= 4) return { error: 'Ya está en vale cuatro' };
        if (tr.holder !== null && tr.holder !== T) return { error: 'El quiero lo tiene el otro equipo' };
        if (h.turn !== seat) return { error: 'Se canta en tu turno, antes de tirar' };
        tr.pending = { level: tr.level + 1, byTeam: T, bySeat: seat };
      } else return { error: 'Primero hay que contestar el envido' };
      event(g, { type: 'call', seat, text: TRUCO_NAMES[tr.pending.level], kind: 'truco' });
      return { ok: true };
    }

    case 'quiero':
    case 'noquiero': {
      if (w.kind !== 'envido' && w.kind !== 'truco') return { error: 'Ya se contestó' };
      if (!mine) return { error: 'Le toca contestar al otro equipo' };
      event(g, { type: 'call', seat, text: a.t === 'quiero' ? 'Quiero' : 'No quiero', kind: a.t });
      if (w.kind === 'envido') {
        if (a.t === 'quiero') return startDeclare(g), { ok: true };
        const pts = envidoDeclinedPoints(g, e.calls, e.by);
        Object.assign(e, { state: 'done', winner: e.by, points: pts });
        h.pending.push({ team: e.by, pts, why: 'envido' });
        return { ok: true };
      }
      const p = tr.pending;
      tr.pending = null;
      if (a.t === 'quiero') {
        tr.level = p.level;
        tr.holder = T;
      } else endHand(g, p.byTeam, p.level - 1, 'noquiero');
      return { ok: true };
    }

    case 'cantar':
    case 'buenas': {
      if (w.kind !== 'declare' || !mine) return { error: 'No te toca cantar los tantos' };
      const d = e.declare;
      if (a.t === 'cantar') {
        const v = a.value == null ? tanto(h.cards[seat]).value : Number(a.value);
        if (!validTanto(v)) return { error: 'Ese número no existe en el envido' };
        if (d.best && v <= d.best.value) return { error: `Tenés que cantar más de ${d.best.value}` };
        d.best = { seat, value: v, team: T };
        d.said.push({ seat, value: v });
        event(g, { type: 'tanto', seat, value: v });
      } else {
        if (!d.best) return { error: 'El primero tiene que cantar' };
        d.said.push({ seat, value: null });
        event(g, { type: 'tanto', seat, value: null });
      }
      d.idx++;
      advanceDeclare(g);
      return { ok: true };
    }

    case 'mazo': {
      if (w.kind === 'envido' || w.kind === 'declare') return { error: 'Primero resolvé el envido' };
      // en equipo uno se va al mazo por todo el equipo
      for (const s of teamSeats(g, T)) {
        h.mazo[s] = true;
        h.inHand[s] = [];
        h.pre[s] = null;
      }
      event(g, { type: 'mazo', seat, team: T });
      const win = otherTeam(T);
      const pts = tr.pending && tr.pending.byTeam === win ? tr.pending.level - 1 : tr.level;
      if (h.r === 0 && e.state === 'none') h.pending.push({ team: win, pts: 1, why: 'envido-mazo' });
      endHand(g, win, pts, 'mazo');
      return { ok: true };
    }

    // "Mostrá las dos": se le pide a un rival que levante la carta quemada de su tiro doble
    // para que todos vean la de abajo. No suma ni resta puntos.
    case 'denuncia': {
      const target = a.target;
      if (!Number.isInteger(target) || target < 0 || target >= g.n || team(target) === T) return { error: 'Denuncia inválida' };
      const under = h.table[target].filter((p) => p.under && !p.revealed);
      for (const p of under) p.revealed = true;
      event(g, { type: 'denuncia', seat, target, ok: under.length > 0, cards: under.map((p) => p.c) });
      return { ok: true };
    }
  }
  return { error: 'Acción desconocida' };
}

function checkPlayTurn(h, w, seat) {
  if (w.kind !== 'play') return { error: 'Hay que contestar el canto primero' };
  if (h.turn !== seat) return { error: 'Todavía no es tu turno' };
  return null;
}

// Por qué no se puede tirar fuera de turno ahora (null = se puede, y la carta se quema).
function outOfTurnBlock(h, seat) {
  if (h.phase !== 'play' || h.envido.state === 'pending' || h.envido.state === 'declaring' || h.truco.pending) return 'Hay que contestar el canto primero';
  if (played(h, seat)) return 'Ya jugaste en esta ronda';
  if (h.pre[seat]) return 'Tu carta de esta ronda ya está en la mesa';
  if (!h.inHand[seat].length) return 'No te quedan cartas';
  return null;
}

function envidoClosedReason(g, seat) {
  const h = g.h;
  if (h.r !== 0 || played(h, seat) || h.envido.state !== 'none' || h.truco.level > 1) return 'Ya no se puede cantar envido';
  if (g.n > 2 && !isPie(g, seat)) return 'En equipo el envido lo canta el pie';
  if (h.turn !== seat) return 'El envido se canta en tu turno, antes de tirar';
  return 'Ahora no se puede cantar envido';
}

// Después de la mano: mostrar los tantos o reclamar que no se mostraron.
function actShow(g, seat, a) {
  const h = g.h;
  const s = h.show;
  if (a?.t === 'mostrar') {
    if (seat !== s.seat) return { error: 'Tiene que mostrar el que ganó el envido' };
    if (h.mazo[seat]) return { error: 'Tus cartas ya están en el mazo' };
    const real = tanto(h.cards[seat]);
    h.envido.shown = true;
    const ok = real.value === s.value;
    event(g, { type: 'show', seat, value: real.value, said: s.value, cards: real.cards, ok });
    finishHand(g, ok ? null : 'mal-cantado');
    return { ok: true };
  }
  if (a?.t === 'reclamar') {
    if (team(seat) === team(s.seat)) return { error: 'No te podés reclamar a vos mismo' };
    event(g, { type: 'reclamo', seat, target: s.seat });
    finishHand(g, 'no-mostro');
    return { ok: true };
  }
  return { error: 'Ahora se muestran los tantos' };
}

// Si pasa el tiempo y nadie reclamó, los tantos valen igual (lo usa el servidor).
export function closeShow(g) {
  if (g.h?.phase !== 'show') return false;
  event(g, { type: 'show-timeout', seat: g.h.show.seat });
  finishHand(g, null);
  return true;
}

function addPoints(g, t, pts, why) {
  if (pts <= 0 || g.status !== 'playing') return;
  g.score[t] = Math.min(g.target, g.score[t] + pts);
  event(g, { type: 'points', team: t, pts, why });
  if (g.score[t] >= g.target) {
    g.status = 'ended';
    g.winner = t;
    event(g, { type: 'game-end', team: t });
  }
}

function startDeclare(g) {
  const h = g.h;
  const order = [];
  for (let k = 0; k < g.n; k++) {
    const s = (h.mano + k) % g.n;
    if (active(h, s)) order.push(s);
  }
  h.envido.state = 'declaring';
  h.envido.declare = { order, idx: 0, seat: null, best: null, said: [] };
  advanceDeclare(g);
}

function advanceDeclare(g) {
  const h = g.h;
  const e = h.envido;
  const d = e.declare;
  while (d.idx < d.order.length) {
    const s = d.order[d.idx];
    if (d.best && team(s) === d.best.team) {
      d.idx++;
      continue;
    }
    d.seat = s;
    return;
  }
  d.seat = null;
  e.state = 'done';
  e.winner = d.best.team;
  e.winnerSeat = d.best.seat;
  e.saidValue = d.best.value;
  e.points = envidoAcceptedPoints(g, e.calls, e.winner);
  e.needsShow = true;
  h.pending.push({ team: e.winner, pts: e.points, why: 'envido' });
  event(g, { type: 'envido-done', seat: d.best.seat, value: d.best.value, team: e.winner, said: d.said, points: e.points });
}

// Pasa el turno al siguiente que no jugó en esta ronda (el que tiró fuera de turno ya jugó: se saltea).
function advanceTurn(g) {
  const h = g.h;
  for (let k = 1; k <= g.n; k++) {
    const s = (h.turn + k) % g.n;
    if (!active(h, s) || played(h, s)) continue;
    h.turn = s;
    return autoPre(g);
  }
  resolveRound(g);
}

// La carta de arriba de dos encimadas ya está en la mesa: cuando le toca, se juega sola, quemada.
function autoPre(g) {
  const h = g.h;
  const s = h.turn;
  const c = h.pre[s];
  if (h.phase !== 'play' || !c || played(h, s)) return;
  h.pre[s] = null;
  h.rounds[h.r].plays.push({ seat: s, c, burned: true });
  advanceTurn(g);
}

function resolveRound(g) {
  const h = g.h;
  const R = h.rounds[h.r];
  const top = Math.max(...R.plays.map(playValue));
  const tops = R.plays.filter((p) => playValue(p) === top);
  const teams = new Set(tops.map((p) => team(p.seat)));
  R.result = teams.size === 1 ? team(tops[0].seat) : 'parda';
  R.winnerSeat = teams.size === 1 ? tops[0].seat : null;
  event(g, { type: 'round', round: h.r, result: R.result, seat: R.winnerSeat });

  const winner = handWinner(h.rounds, team(h.mano));
  if (winner !== null) return endHand(g, winner, h.truco.level, 'cartas');
  h.r++;
  let starter = R.winnerSeat;
  if (starter == null || !active(h, starter)) {
    starter = h.mano;
    for (let k = 0; k < g.n && !active(h, starter); k++) starter = (h.mano + k) % g.n;
  }
  // la ronda siguiente la empieza el que ganó la anterior (en parda, la mano) — [R] glosario, "Mano"
  h.rounds.push({ plays: [], result: null, starter });
  h.turn = starter;
  autoPre(g);
}

// Devuelve el equipo ganador de la mano o null si hay que seguir.
export function handWinner(rounds, manoTeam) {
  const res = rounds.map((r) => r.result).filter((r) => r !== null && r !== undefined);
  const [a, b, c] = res;
  if (res.length < 2) return null;
  if (res.length === 2) {
    if (a !== 'parda' && (b === a || b === 'parda')) return a;
    if (a === 'parda' && b !== 'parda') return b;
    return null;
  }
  if (c !== 'parda') return c;
  if (a !== 'parda') return a;
  return manoTeam;
}

// Termina la parte de cartas. Si hay un envido querido, el ganador tiene que mostrar.
function endHand(g, winnerTeam, pts, reason) {
  const h = g.h;
  if (h.phase !== 'play') return;
  h.truco.pending = null;
  h.trucoResult = { team: winnerTeam, pts, reason };
  event(g, { type: 'hand-end', team: winnerTeam, pts, reason });
  const e = h.envido;
  if (e.needsShow && !e.shown) {
    h.phase = 'show';
    h.show = { seat: e.winnerSeat, value: e.saidValue };
    return;
  }
  finishHand(g, null);
}

// Anota todo lo de la mano. penalty: el que ganó el envido no mostró o cantó mal (pierde el envido).
function finishHand(g, penalty) {
  const h = g.h;
  const e = h.envido;
  const tr = h.trucoResult;
  const entries = h.pending.map((p) => (penalty && p.why === 'envido' ? { ...p, team: otherTeam(p.team), why: 'envido-' + penalty } : p));
  entries.push({ team: tr.team, pts: tr.pts, why: 'truco' });
  h.phase = 'ended';
  const shown = e.shown ? tanto(h.cards[e.winnerSeat]) : null;
  h.result = {
    winner: tr.team,
    pts: tr.pts,
    reason: tr.reason,
    penalty,
    envido: e.winner !== null ? { team: e.winner, seat: e.winnerSeat, points: e.points, said: e.saidValue ?? null, shown: e.shown } : null,
    envidoShow: shown ? { seat: e.winnerSeat, value: shown.value, cards: shown.cards } : null,
  };
  // primero el envido, después el truco
  for (const p of entries) addPoints(g, p.team, p.pts, p.why);
}

// ---------------------------------------------------------------- vista por jugador

// Lo que puede ver un asiento (o un espectador con seat = null): oculta las cartas ajenas.
export function viewFor(g, seat) {
  const h = g.h;
  const done = h && h.phase === 'ended';
  const vh = h && {
    mano: h.mano,
    r: h.r,
    turn: h.turn,
    phase: h.phase,
    mazo: h.mazo,
    pies: pies(g),
    cutter: cutter(g),
    handCounts: h.inHand.map((c) => c.length),
    myCards: seat != null ? h.inHand[seat] : [],
    myTanto: seat != null ? tanto(h.cards[seat]).value : null,
    table: h.table.map((list, s) =>
      list.map(({ thrownIn, ...p }) => {
        const mine = s === seat;
        // la tapada y la de abajo de dos encimadas no se ven hasta que termina la mano
        const hidden = !mine && !done && (p.faceDown || (p.under && !p.revealed));
        // la de arriba de dos encimadas recién se ve quemada cuando termina la ronda en que se tiró
        const burned = !!p.burned && (mine || done || thrownIn === undefined || h.r > thrownIn);
        return { ...p, c: hidden ? null : p.c, hidden, burned };
      })
    ),
    rounds: h.rounds.map((r) => ({ result: g.ayudas || done ? r.result : undefined, starter: r.starter })),
    envido: {
      calls: h.envido.calls,
      by: h.envido.by,
      bySeat: h.envido.bySeat,
      state: h.envido.state,
      winner: h.envido.winner,
      points: h.envido.points,
      declare: h.envido.declare && { seat: h.envido.declare.seat, best: h.envido.declare.best, said: h.envido.declare.said },
    },
    truco: h.truco,
    show: h.show,
    result: h.result,
  };
  return {
    mode: g.mode,
    n: g.n,
    target: g.target,
    ayudas: g.ayudas,
    trucoDesdeSegunda: g.trucoDesdeSegunda,
    score: g.score,
    dealer: g.dealer,
    handNo: g.handNo,
    status: g.status,
    winner: g.winner,
    h: vh,
    waiting: waitingFor(g),
    actions: actionsFor(g, seat),
    ev: g.ev,
  };
}
