// Valor de las cartas: jerarquía del truco, tantos del envido y flor, con o sin muestra.
// Funciones puras (sin estado de partida): las usan el motor, el bot, la escena y los tests.
// Reglas y fuentes: docs/REGLAS.md.

export const SUITS = ['E', 'B', 'O', 'C'];
export const NUMS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
export const SUIT_NAME = { E: 'espada', B: 'basto', O: 'oro', C: 'copa' };

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

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ------------------------------------------------------------------ jerarquía (truco)
// 14 = ancho de espada ... 1 = los cuatros. Con muestra, las piezas (15 a 19) van por encima de todo.
const SPECIAL_RANK = { '1E': 14, '1B': 13, '7E': 12, '7O': 11 };
const NUM_RANK = { 3: 10, 2: 9, 1: 8, 12: 7, 11: 6, 10: 5, 7: 4, 6: 3, 5: 2, 4: 1 };
export const LOWEST_RANK = NUM_RANK[4];
const plainRank = (c) => SPECIAL_RANK[c] ?? NUM_RANK[cardNum(c)];

// ------------------------------------------------------------------ muestra
// Piezas: 2, 4, 5, 11 y 10 del palo de la muestra (en ese orden, de mayor a menor). Si la muestra misma es
// una pieza, el 12 de ese palo toma su lugar. Las piezas cuentan como de cualquier palo para envido y flor.
const PIEZA_NUMS = [2, 4, 5, 11, 10];
const PIEZA_RANK = { 2: 19, 4: 18, 5: 17, 11: 16, 10: 15 };
const PIEZA_VALUE = { 2: 10, 4: 9, 5: 8, 11: 7, 10: 7 }; // valor para envido y flor (más los 20)

// Número de pieza que representa la carta (2, 4, 5, 11 o 10), o null si no es pieza.
export function piezaOf(c, muestra) {
  if (!muestra || cardSuit(c) !== cardSuit(muestra)) return null;
  const n = cardNum(c);
  const m = cardNum(muestra);
  if (PIEZA_NUMS.includes(n) && n !== m) return n;
  if (n === 12 && PIEZA_NUMS.includes(m)) return m; // el 12 reemplaza a la muestra
  return null;
}

// Jerarquía de una carta (con la muestra de la mano, si se juega con muestra).
export function rank(c, muestra = null) {
  const p = piezaOf(c, muestra);
  return p ? PIEZA_RANK[p] : plainRank(c);
}

// ------------------------------------------------------------------ envido y flor
const envVal = (c) => (cardNum(c) <= 7 ? cardNum(c) : 0);
const byPieza = (muestra) => (a, b) => PIEZA_VALUE[piezaOf(b, muestra)] - PIEZA_VALUE[piezaOf(a, muestra)];

// Tantos de una mano de 3 cartas y las cartas que los forman.
// Sin piezas: dos del mismo palo = 20 + sus valores; si no, la carta más alta.
// Con una pieza: 20 + la pieza + la carta más alta de las otras. Con dos piezas: 20 + las dos piezas.
export function tanto(cards, muestra = null) {
  const piezas = cards.filter((c) => piezaOf(c, muestra)).sort(byPieza(muestra));
  if (piezas.length) {
    const [p] = piezas;
    if (piezas.length >= 2) return { value: 20 + PIEZA_VALUE[piezaOf(p, muestra)] + PIEZA_VALUE[piezaOf(piezas[1], muestra)], cards: piezas.slice(0, 2) };
    const rest = cards.filter((c) => c !== p).sort((a, b) => envVal(b) - envVal(a));
    return { value: 20 + PIEZA_VALUE[piezaOf(p, muestra)] + envVal(rest[0]), cards: [p, rest[0]] };
  }
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

// Números que existen en el envido (con muestra se llega hasta 39: 20 + 10 + 9).
export const validTanto = (v, muestra = null) => Number.isInteger(v) && ((v >= 0 && v <= 7) || (v >= 20 && v <= (muestra ? 39 : 33)));

// Flor: tres cartas del mismo palo (las piezas cuentan como de cualquier palo; dos piezas ya son flor).
// Devuelve { value, cards } o null. Valor: 20 + la suma de las tres (piezas con su valor de pieza).
export function flor(cards, muestra = null) {
  if (cards.length !== 3) return null;
  const piezas = cards.filter((c) => piezaOf(c, muestra));
  const others = cards.filter((c) => !piezaOf(c, muestra));
  const sameSuit = others.every((c) => cardSuit(c) === cardSuit(others[0]));
  if (!(piezas.length >= 2 || sameSuit)) return null;
  const value = 20 + piezas.reduce((s, c) => s + PIEZA_VALUE[piezaOf(c, muestra)], 0) + others.reduce((s, c) => s + envVal(c), 0);
  return { value, cards: cards.slice() };
}
