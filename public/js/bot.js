// Jugador automático. Corre solo en el servidor: ve el estado completo del motor pero decide
// usando únicamente sus propias cartas y lo que está sobre la mesa.
import { rank, tanto, team, cardNum, playValue, actionsFor, waitingFor, envidoOpenFor } from './engine.js';

const pick = (rng, p) => rng() < p;

// Mejor carta de mi equipo y del rival en la ronda actual.
function tableBest(h, seat) {
  let mine = -1;
  let theirs = -1;
  const plays = h.rounds[h.r].plays;
  for (const p of plays) {
    if (team(p.seat) === team(seat)) mine = Math.max(mine, playValue(p));
    else theirs = Math.max(theirs, playValue(p));
  }
  return { mine, theirs, count: plays.length };
}

function roundsWon(h, seat) {
  let won = 0;
  let lost = 0;
  for (const r of h.rounds) {
    if (r.result == null || r.result === 'parda') continue;
    if (r.result === team(seat)) won++;
    else lost++;
  }
  return { won, lost };
}

// 0..1: qué tan buena es la mano para el truco ahora mismo.
function power(g, seat) {
  const h = g.h;
  const cards = h.inHand[seat].map(rank).sort((a, b) => b - a);
  const { won, lost } = roundsWon(h, seat);
  let p = (cards[0] || 0) / 14 * 0.55 + (cards[1] || 0) / 14 * 0.25 + won * 0.3 - lost * 0.3;
  const tb = tableBest(h, seat);
  if (tb.count && tb.mine > tb.theirs) p += 0.1;
  return Math.max(0, Math.min(1, p));
}

function chooseCard(g, seat, rng) {
  const h = g.h;
  const hand = h.inHand[seat].slice().sort((a, b) => rank(a) - rank(b));
  const tb = tableBest(h, seat);
  const lowest = hand[0];
  const highest = hand[hand.length - 1];
  let card;
  if (tb.count === 0) {
    // abre la ronda
    if (h.r === 0 && hand.length === 3) card = hand[1];
    else card = roundsWon(h, seat).won > 0 ? highest : hand[Math.floor(hand.length / 2)];
  } else if (tb.mine > tb.theirs) {
    card = lowest; // ya gana mi compañero
  } else {
    const beat = hand.find((c) => rank(c) > tb.theirs);
    const tie = hand.find((c) => rank(c) === tb.theirs);
    card = beat || (tie && h.r === 0 ? tie : lowest); // si no gana, va a la parda en primera
  }
  const a = actionsFor(g, seat);
  if (a.canDown && tb.count && !hand.some((c) => rank(c) > tb.theirs) && pick(rng, 0.25)) return { t: 'play', card, mode: 'down' };
  // muy de vez en cuando hace trampa: tapa su carta con la más baja, que queda quemada
  if (a.canDouble && h.r === 0 && hand.length === 3 && card !== lowest && pick(rng, 0.03)) return { t: 'play2', bottom: card, top: lowest };
  return { t: 'play', card, mode: 'normal' };
}

export function botAction(g, seat, rng = Math.random) {
  const h = g.h;
  if (!h || g.status !== 'playing') return null;
  if (h.phase === 'show') return h.show.seat === seat && !h.mazo[seat] ? { t: 'mostrar' } : null;
  if (h.phase !== 'play') return null;
  const w = waitingFor(g);
  if (!w.seats.includes(seat)) return null;
  const a = actionsFor(g, seat);
  const t = tanto(h.cards[seat]).value;

  if (w.kind === 'declare') {
    const best = h.envido.declare.best;
    return !best || t > best.value ? { t: 'cantar' } : { t: 'buenas' };
  }

  if (w.kind === 'envido') {
    if (a.envido.includes('real') && t >= 31 && pick(rng, 0.6)) return { t: 'envido', kind: 'real' };
    if (a.envido.includes('falta') && t >= 32 && pick(rng, 0.5)) return { t: 'envido', kind: 'falta' };
    if (a.envido.includes('envido') && t >= 29 && pick(rng, 0.4)) return { t: 'envido', kind: 'envido' };
    if (h.envido.calls.includes('falta')) return { t: t >= 30 ? 'quiero' : 'noquiero' };
    if (t >= 27 || (t >= 25 && pick(rng, 0.5)) || (t >= 23 && pick(rng, 0.15))) return { t: 'quiero' };
    if (a.envido.includes('real') && pick(rng, 0.04)) return { t: 'envido', kind: 'real' }; // farol
    return { t: 'noquiero' };
  }

  if (w.kind === 'truco') {
    if (a.envido.length && t >= 27 && pick(rng, 0.8)) return { t: 'envido', kind: t >= 31 ? 'real' : 'envido' };
    const p = power(g, seat);
    if (a.truco && p > 0.8 && pick(rng, 0.6)) return { t: 'truco' };
    return { t: p > 0.45 || pick(rng, 0.12) ? 'quiero' : 'noquiero' };
  }

  if (w.kind === 'play') {
    if (envidoOpenFor(g, seat)) {
      if (t >= 30 && pick(rng, 0.7)) return { t: 'envido', kind: t >= 32 && pick(rng, 0.4) ? 'real' : 'envido' };
      if (t >= 27 && pick(rng, 0.5)) return { t: 'envido', kind: 'envido' };
      if (pick(rng, 0.07)) return { t: 'envido', kind: 'envido' }; // farol
    }
    if (a.truco) {
      const p = power(g, seat);
      const lvl = h.truco.level;
      if (lvl === 1 && (p > 0.62 || pick(rng, 0.08))) return { t: 'truco' };
      if (lvl > 1 && p > 0.85 && pick(rng, 0.5)) return { t: 'truco' };
    }
    return chooseCard(g, seat, rng);
  }
  return null;
}

// ¿El bot le reclama al rival que no mostró los tantos?
export function botClaims(g, seat, rng = Math.random) {
  const h = g.h;
  return h?.phase === 'show' && team(seat) !== team(h.show.seat) && rng() < 0.75;
}

// Seña que hace un bot para su compañero al principio de la mano.
export function botSena(g, seat) {
  const h = g.h;
  const cards = h.inHand[seat];
  const has = (c) => cards.includes(c);
  const hasNum = (n) => cards.some((c) => cardNum(c) === n);
  if (has('1E')) return 'ancho_espada';
  if (has('1B')) return 'ancho_basto';
  if (has('7E')) return 'siete_espada';
  if (has('7O')) return 'siete_oro';
  if (hasNum(3)) return 'tres';
  if (tanto(h.cards[seat]).value >= 30) return 'envido_alto';
  if (hasNum(2)) return 'dos';
  return 'ciego';
}
