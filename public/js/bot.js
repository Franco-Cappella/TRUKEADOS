// Jugador automático. Corre solo en el servidor.
//
// Cómo piensa: imagina muchas veces las cartas que pueden tener los demás (Monte Carlo), juega cada
// mano imaginada hasta el final y cuenta cuántas gana. Esas manos imaginadas se pesan con lo que
// aprendió de cada rival (brain.js): si alguien casi nunca canta truco sin cartas, su truco pesa.
// Con eso calcula cuántos puntos espera ganar con cada opción (querer, no querer, subir, farolear)
// y elige casi siempre la mejor, con un poco de ruido para que no se le lea el juego.
//
// Trampas (solo si la mesa las permite; ver BOT en config.js): a veces espía las cartas de los rivales
// (`ctx.peek`), miente en el envido y después se va sin mostrar, tira dos encimadas y, cuando reparte,
// se acomoda una carta buena (`stackDeck`).
//
// ctx (lo arma el servidor): { peek, bots: asientos que son bots, brainOf(seat), senas: [{ seat, sena }] }.
// `senas` son las señas que vio en esta mano: todas las de su compañero y las de los rivales que justo
// estaba mirando. Con eso imagina las manos de los demás (si el compañero le guiñó, tiene el ancho de basto)
// y decide qué cantar y qué tirar sabiendo con qué cuenta el equipo. Sin ctx juega honesto con lo que se
// supone de cualquiera.
import {
  rank, tanto, team, cardNum, playValue, actionsFor, waitingFor, envidoOpenFor, florFor, act, newDeck, shuffle,
  validTanto, envidoAcceptedPoints, envidoDeclinedPoints,
} from './engine.js';
import { predict, rate, strength, X } from './brain.js';
import { BOT } from './config.js';

const pick = (rng, p) => rng() < p;

// ---------------------------------------------------------------- lo que sabe y lo que imagina

// Asientos cuyas cartas conoce: las suyas, las de sus compañeros bots (se las pasaron por señas)
// y, si está espiando, las de todos.
function knownSeats(g, seat, ctx) {
  if (ctx.peek) return new Set(Array.from({ length: g.n }, (_, i) => i));
  const k = new Set([seat]);
  for (const s of ctx.bots || []) if (team(s) === team(seat)) k.add(s);
  return k;
}

// Carta de la mesa que el bot puede ver (las tapadas y la de abajo de dos encimadas, no).
const visible = (p) => !p.faceDown && !(p.under && !p.revealed);

// ---- señas: qué carta (o qué tantos) dice cada una
const SENA_CARD = { ancho_espada: (c) => c === '1E', ancho_basto: (c) => c === '1B', siete_espada: (c) => c === '7E', siete_oro: (c) => c === '7O', tres: (c) => cardNum(c) === 3, dos: (c) => cardNum(c) === 2, ancho_falso: (c) => c === '1C' || c === '1O' };
const BRAVA = new Set(['1E', '1B', '7E', '7O']);
const SENA_FITS = {
  ciego: (full) => !full.some((c) => BRAVA.has(c) || cardNum(c) === 3 || cardNum(c) === 2),
  envido_alto: (full, m) => tanto(full, m).value >= 27,
  treinta: (full, m) => tanto(full, m).value >= 30,
  nada_envido: (full, m) => tanto(full, m).value <= 25,
  // lo que contestó el compañero a "¿le canto truco?": "cantá" = tiene un tres o algo mejor; "nada" = no
  truco_si: (full, m) => full.some((c) => rank(c, m) >= rank('3E', m)),
  truco_no: (full, m) => !full.some((c) => rank(c, m) >= rank('3E', m)),
};

// Respuesta de un bot cuando el compañero le consulta: 'si' ("Cantá"), 'callado' o 'nada' ("No tengo nada").
// Con lo que tiene él. Si tiene muchísimo, a veces dice "callado" igual: va a la pesca (que canten los
// rivales y después se sube). Con poco, casi siempre avisa que no tiene nada (a veces solo "callado").
export function botAnswer(g, seat, kind, rng = Math.random) {
  const h = g.h;
  if (kind === 'tantos') {
    const v = tanto(h.cards[seat], h.muestra).value;
    if (v >= 31 && pick(rng, 0.35)) return 'callado';
    if (v >= 27) return 'si';
    if (v <= 23) return pick(rng, 0.8) ? 'nada' : 'callado';
    return 'callado';
  }
  const R = (c) => rank(c, h.muestra);
  const hand = h.inHand[seat].map(R);
  const best = Math.max(...hand, -1);
  const bravas = hand.filter((r) => r >= R('7O')).length;
  if ((hand.some((r) => r >= R('1B')) || bravas >= 2) && pick(rng, 0.35)) return 'callado';
  if (best >= R('3E') || strength(g, seat) >= 0.5) return 'si';
  if (best < R('2E')) return pick(rng, 0.8) ? 'nada' : 'callado';
  return 'callado';
}

// Qué le pregunta un bot a su compañero antes de decidir (o null): los tantos, si es el que canta el envido;
// el truco, si lo puede cantar. Le pregunta más seguido a una persona que a otro bot (que ya sabe sus cartas).
export function botAsks(g, seat, rng, humanPartner) {
  const h = g.h;
  const a = actionsFor(g, seat);
  if (envidoOpenFor(g, seat) && a.envido.length) return pick(rng, humanPartner ? 0.6 : 0.15) ? 'tantos' : null;
  if (a.truco && h.r <= 1 && !h.truco.pending) return pick(rng, humanPartner ? 0.3 : 0.08) ? 'truco' : null;
  return null;
}
// cuánto le cree a una seña: la del compañero casi siempre es verdad; la de un rival puede ser para despistar
const senaTrust = (seat, s) => (team(s) === team(seat) ? 0.95 : 0.8);

// Peso de un mundo por las señas de tantos o de "nada": si no cuadra, es poco creíble.
function senaWeight(g, seat, ctx, world, known) {
  let w = 1;
  for (const { seat: s, sena } of ctx.senas || []) {
    const fits = SENA_FITS[sena];
    if (!fits || known.has(s)) continue;
    w *= fits(world.full[s], g.h.muestra) ? 1 : 1 - senaTrust(seat, s);
  }
  return w;
}

// Un "mundo": las cartas que imagina para cada asiento desconocido.
// hands[s] = lo que tiene en la mano; full[s] = sus 3 cartas originales (para el envido).
// Si alguien hizo la seña de una carta, casi siempre se la da (si todavía puede tenerla).
function sampleWorld(g, seat, known, rng, senas = []) {
  const h = g.h;
  const used = new Set();
  if (h.muestra) used.add(h.muestra);
  const unknown = [];
  for (let s = 0; s < g.n; s++) {
    if (known.has(s)) h.cards[s].forEach((c) => used.add(c));
    else {
      h.table[s].forEach((p) => visible(p) && used.add(p.c));
      unknown.push(s);
    }
  }
  const pool = shuffle(newDeck().filter((c) => !used.has(c)), rng);
  const hands = h.inHand.slice();
  const full = h.cards.slice();
  for (const s of unknown) {
    const seen = h.table[s].filter(visible).map((p) => p.c);
    const hidden = 3 - seen.length;
    const forced = [];
    for (const x of senas) {
      const is = x.seat === s && SENA_CARD[x.sena];
      if (!is || forced.length >= hidden || seen.some(is) || rng() > senaTrust(seat, s)) continue;
      const i = pool.findIndex(is);
      if (i >= 0) forced.push(...pool.splice(i, 1));
    }
    const mine = [...forced, ...pool.splice(0, hidden - forced.length)];
    hands[s] = mine.slice(0, h.inHand[s].length);
    full[s] = [...seen, ...mine];
  }
  return { hands, full, unknown };
}

// ---------------------------------------------------------------- simulación del resto de la mano

// Cómo juegan todos en las manos imaginadas: si mi equipo ya gana la ronda, la más baja; si no, la más
// baja que gana; si no gana ninguna, la más baja. El que abre tira la del medio en primera y la más alta después.
function simCard(g, s) {
  const h = g.h;
  const hand = h.inHand[s];
  if (!hand.length) return null;
  const R = (c) => rank(c, h.muestra);
  const sorted = hand.slice().sort((a, b) => R(a) - R(b));
  const plays = h.rounds[h.r].plays;
  if (!plays.length) return h.r === 0 && sorted.length === 3 ? sorted[1] : sorted[sorted.length - 1];
  let mine = -1;
  let theirs = -1;
  for (const p of plays) {
    const v = playValue(p, g);
    if (team(p.seat) === team(s)) mine = Math.max(mine, v);
    else theirs = Math.max(theirs, v);
  }
  if (mine > theirs) return sorted[0];
  return sorted.find((c) => R(c) > theirs) || sorted[0];
}

// Juega la mano imaginada hasta el final (solo cartas) y devuelve si la gana el equipo de `seat`.
function rollout(g, seat, world, first) {
  // copia liviana: solo lo que cambia al tirar cartas (sin cantos pendientes ni flor)
  const o = g.h;
  const h = {
    ...o,
    inHand: o.inHand.map((c, s) => (world.unknown.includes(s) ? world.hands[s] : c).slice()),
    table: o.table.map((l) => l.slice()),
    pre: o.pre.slice(),
    rounds: o.rounds.map((r) => ({ ...r, plays: r.plays.slice() })),
    mazo: o.mazo.slice(),
    pending: [],
    envido: { ...o.envido, state: 'done', needsShow: false },
    flor: { ...o.flor, state: 'done' },
    truco: { ...o.truco, pending: null },
  };
  const c = { ...g, flor: false, score: g.score.slice(), ev: [], h };
  if (first && !act(c, seat, first).ok) return 0.5;
  for (let i = 0; i < 12 && c.h.phase === 'play'; i++) {
    const w = waitingFor(c);
    if (w.kind !== 'play') break;
    const s = w.seats[0];
    const card = simCard(c, s);
    if (!card || !act(c, s, { t: 'play', card, mode: 'normal' }).ok) break;
  }
  const res = c.h.trucoResult;
  return res ? (res.team === team(seat) ? 1 : 0) : 0.5;
}

// Muestras ponderadas: [{ world, w }] con w = qué tan creíble es ese mundo dado lo que hicieron los rivales.
function worlds(g, seat, ctx, rng, weigh) {
  const known = knownSeats(g, seat, ctx);
  const n = known.size === g.n ? 1 : ctx.samples || BOT.samples; // si ve todo, con una alcanza
  const out = [];
  for (let i = 0; i < n; i++) {
    const world = sampleWorld(g, seat, known, rng, ctx.senas);
    out.push({ world, w: (weigh ? weigh(world, known) : 1) * senaWeight(g, seat, ctx, world, known) });
  }
  return out;
}

// ---------------------------------------------------------------- memoria de situaciones
//
// Como el programa de damas de Samuel (IBM, años 50): las situaciones que ya vio las guarda con lo que calculó.
// La próxima vez que está en la misma, suma más manos imaginadas a lo que ya sabía (cada vez decide mejor) y
// cuando juntó BOT.memoSamples ya no piensa: usa lo guardado y decide al toque.
//
// Se guardan las sumas de la simulación (chance de ganar la mano, de que quieran el truco, por carta), no la
// decisión: el tanteador y el ruido se aplican cada vez, así que lo guardado sirve con cualquier resultado.
// La clave es lo que sabe el bot, con los asientos contados desde él y las cartas por su valor (dos cuatros
// juegan igual); si importan los palos (se cantaron tantos o hay señas de tantos), por la carta exacta.

// Lo que se guarda por situación: { n: manos imaginadas, sw: suma de pesos, ...sumas pesadas }.
export class BotMemo {
  constructor(max = 50000) {
    this.map = new Map();
    this.max = max;
    this.ripe = new Map(); // las que llegaron a BOT.memoSamples desde la última vez que se guardaron
    this.hits = 0;
    this.misses = 0;
  }
  get(k) {
    const v = this.map.get(k);
    if (v) {
      this.map.delete(k); // la más usada queda al final (se borran primero las viejas)
      this.map.set(k, v);
    }
    return v;
  }
  set(k, v) {
    this.map.set(k, v);
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value);
    if (v.n >= BOT.memoSamples) this.ripe.set(k, v);
  }
  load(entries) {
    for (const [k, v] of entries) if (!this.map.has(k)) this.map.set(k, v);
  }
  takeRipe() {
    const out = [...this.ripe];
    this.ripe.clear();
    return out;
  }
}

// Hash de 64 bits (dos FNV-1a) para que la clave guardada sea corta.
function hashKey(s) {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619);
    b = Math.imul(b ^ c, 2246822519);
  }
  return (a >>> 0).toString(36) + '.' + (b >>> 0).toString(36);
}

// Lo que sabe `seat` en este momento, como texto (ver arriba).
function situation(g, seat, ctx, kind) {
  const h = g.h;
  const n = g.n;
  const rel = (s) => (s - seat + n) % n;
  const known = knownSeats(g, seat, ctx);
  const e = h.envido;
  const said = (e.declare?.said || []).filter((x) => x.value != null).map((x) => [rel(x.seat), x.value]);
  const senas = (ctx.senas || []).filter((x) => !known.has(x.seat)).map((x) => [rel(x.seat), x.sena]).sort();
  const exact = said.length > 0 || e.state === 'pending' || senas.some(([, s]) => SENA_FITS[s]);
  const C = (c) => (exact ? c : rank(c, h.muestra));
  const bySeat = (f) => Array.from({ length: n }, (_, k) => f((seat + k) % n));
  const tp = h.truco.pending;
  // los modelos de los rivales cambian la cuenta en el truco (si quieren) y cuando pesan lo que cantaron
  const brains = kind.startsWith('truco') || !!tp || said.length > 0 || e.state === 'pending';
  return JSON.stringify([
    kind, n, h.muestra || '', rel(h.mano), h.r, rel(h.turn), ctx.peek ? 1 : 0,
    bySeat((s) => (known.has(s) ? [h.cards[s].map(C).sort(), h.inHand[s].map(C).sort()] : h.inHand[s].length)),
    bySeat((s) => h.table[s].map((p) => [known.has(s) || visible(p) ? C(p.c) : 'x', p.burned ? 1 : 0, p.round, p.under ? 1 : 0])),
    h.rounds.map((r) => [r.plays.map((p) => [rel(p.seat), C(p.c), p.burned ? 1 : 0]), r.result == null ? '' : r.result === 'parda' ? 'p' : r.result === team(seat) ? 'm' : 't']),
    bySeat((s) => (h.pre[s] ? C(h.pre[s]) : 0)),
    bySeat((s) => (h.mazo[s] ? 1 : 0)),
    [h.truco.level, tp ? [tp.level, rel(tp.bySeat)] : 0],
    [e.state, e.state === 'pending' ? [rel(e.bySeat), e.calls] : 0, said],
    senas,
    brains ? bySeat((s) => (team(s) !== team(seat) ? ctx.brainKey?.(s) ?? '' : '')) : 0,
  ]);
}

// Sumas de la simulación para `kind`, usando y engordando la memoria si hay (ctx.memo).
// compute(samples, S) devuelve sumas pesadas; S(f) = suma de peso * f(mundo). avg(campo) = suma / suma de pesos.
function simStats(g, seat, ctx, rng, kind, compute) {
  const memo = ctx.memo;
  const key = memo && hashKey(situation(g, seat, ctx, kind));
  let st = memo?.get(key);
  if (st && st.n >= BOT.memoSamples) memo.hits++;
  else {
    if (memo) memo.misses++;
    const samples = worlds(g, seat, ctx, rng, weigher(g, seat, ctx));
    // si ningún mundo es creíble (pesos en 0), todos pesan igual
    if (!samples.some((x) => x.w > 0)) for (const x of samples) x.w = 1;
    const S = (f) => samples.reduce((a, x) => a + x.w * f(x.world), 0);
    const add = { n: samples.length, sw: samples.reduce((a, x) => a + x.w, 0), ...compute(samples, S) };
    if (st) for (const k of Object.keys(add)) add[k] += st[k] || 0;
    st = add;
    memo?.set(key, st);
  }
  return { n: st.n, avg: (k) => (st.sw > 0 ? (st[k] || 0) / st.sw : 0.5) };
}

// Para los tests: las manos que imagina `seat` (con sus pesos).
export const imagine = (g, seat, ctx = {}, rng = Math.random) => worlds(g, seat, ctx, rng, weigher(g, seat, ctx));

const brainOf = (ctx, s) => ctx.brainOf?.(s) || null;

// Peso por lo que se dijo en el envido: el que cantó un número casi siempre lo tiene (salvo que mienta).
function saidWeight(g, ctx, world, known) {
  const said = g.h.envido.declare?.said || [];
  let w = 1;
  for (const { seat: s, value } of said) {
    if (value == null || known.has(s)) continue;
    const lie = rate(brainOf(ctx, s), 'lie');
    w *= tanto(world.full[s], g.h.muestra).value === value ? 1 - lie : lie * 0.1;
  }
  return w;
}

// Mundo pesado por el canto del rival que está pendiente (truco o envido) y por los tantos que dijeron.
function weigher(g, seat, ctx) {
  const h = g.h;
  return (world, known) => {
    let w = saidWeight(g, ctx, world, known);
    const tp = h.truco.pending;
    if (tp && tp.byTeam !== team(seat) && !known.has(tp.bySeat)) {
      // la mano que tenía el que cantó, tal como estaba al cantar (todavía no tiró)
      const s = strength(g, tp.bySeat, world.hands[tp.bySeat]);
      w *= predict(brainOf(ctx, tp.bySeat), 'trucoCall', X.trucoCall(s, tp.level - 1, h.r));
    }
    const e = h.envido;
    if (e.state === 'pending' && e.by !== team(seat) && !known.has(e.bySeat)) {
      w *= predict(brainOf(ctx, e.bySeat), 'envidoCall', X.envidoCall(tanto(world.full[e.bySeat], h.muestra).value));
    }
    return w;
  };
}

const wavg = (samples, f) => {
  let sw = 0;
  let s = 0;
  for (const x of samples) {
    sw += x.w;
    s += x.w * f(x.world);
  }
  return sw > 0 ? s / sw : samples.reduce((a, x) => a + f(x.world), 0) / samples.length;
};

// Rivales activos que contestarían un canto del equipo de `seat`.
const rivals = (g, seat) => Array.from({ length: g.n }, (_, i) => i).filter((i) => team(i) !== team(seat) && !g.h.mazo[i]);

// P(el equipo rival quiere) en un mundo: alcanza con que quiera uno.
function teamAccepts(g, seat, ctx, world, key, xOf) {
  let no = 1;
  for (const s of rivals(g, seat)) no *= 1 - predict(brainOf(ctx, s), key, xOf(s, world));
  return 1 - no;
}

// Cuánto vale ganar d puntos (o perderlos, si d < 0) medido en "puntos de ahora": no es lo mismo
// arriesgar una falta envido 0 a 0 que 28 a 12. Sale de una estimación de la chance de ganar la partida.
function utility(g, seat) {
  const T = team(seat);
  const V = (d) => {
    const a = g.target - g.score[T] - Math.max(d, 0);
    const b = g.target - g.score[1 - T] - Math.max(-d, 0);
    if (a <= 0) return 1;
    if (b <= 0) return 0;
    return 1 / (1 + Math.exp((-0.9 * (b - a)) / Math.sqrt(a + b)));
  };
  const v0 = V(0);
  const slope = Math.max((V(1) - V(-1)) / 2, 1e-4);
  return (d) => (d ? (V(d) - v0) / slope : 0);
}

// Elige entre opciones { a, ev } (puntos esperados): casi siempre la mejor, con algo de ruido.
function choose(options, rng) {
  const best = Math.max(...options.map((o) => o.ev));
  const ws = options.map((o) => Math.exp((o.ev - best) / BOT.temp));
  let r = rng() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < options.length; i++) if ((r -= ws[i]) <= 0) return options[i].a;
  return options[options.length - 1].a;
}

// ---------------------------------------------------------------- truco

const trucoX = (g, level) => (s, world) => X.trucoAccept(strength(g, s, world.hands[s]), level);

// Simulación del truco: chance de ganar la mano (p), de que quieran subir a `level` (pa) y las dos juntas (pap).
function trucoStats(g, seat, ctx, rng, level) {
  return simStats(g, seat, ctx, rng, 'truco' + level, (samples, S) => {
    const wins = new Map(samples.map((x) => [x.world, rollout(g, seat, x.world, null)]));
    const acc = new Map(samples.map((x) => [x.world, teamAccepts(g, seat, ctx, x.world, 'trucoAccept', trucoX(g, level))]));
    return { p: S((w) => wins.get(w)), pa: S((w) => acc.get(w)), pap: S((w) => acc.get(w) * wins.get(w)) };
  });
}

// Puntos esperados de cantar (o subir) a `level` cuando la mano vale `cur` si no lo quieren:
// promedio de (1 - pa)*u(cur) + pa*(p*u(level) + (1 - p)*u(-level)), armado con las sumas guardadas.
function evRaise(st, u, level, cur) {
  const pa = st.avg('pa');
  const pap = st.avg('pap');
  return (1 - pa) * u(cur) + pap * u(level) + (pa - pap) * u(-level);
}

function trucoTurn(g, seat, ctx, rng, a) {
  const h = g.h;
  const L = h.truco.level;
  const st = trucoStats(g, seat, ctx, rng, L + 1);
  const p = st.avg('p');
  ctx.out = { p };
  const u = utility(g, seat);
  const evPass = p * u(L) + (1 - p) * u(-L);
  const evCall = evRaise(st, u, L + 1, L) + BOT.aggro;
  return choose([{ a: null, ev: evPass }, { a: { t: 'truco' }, ev: evCall }], rng);
}

function trucoAnswer(g, seat, ctx, rng, a) {
  const h = g.h;
  const Lp = h.truco.pending.level;
  const st = trucoStats(g, seat, ctx, rng, Lp + 1);
  const p = st.avg('p');
  ctx.out = { p };
  const u = utility(g, seat);
  const opts = [
    { a: { t: 'quiero' }, ev: p * u(Lp) + (1 - p) * u(-Lp) },
    { a: { t: 'noquiero' }, ev: u(-(Lp - 1)) },
  ];
  if (a.truco) opts.push({ a: { t: 'truco' }, ev: evRaise(st, u, Lp + 1, Lp) + BOT.aggro });
  return choose(opts, rng);
}

// ---------------------------------------------------------------- envido

// ¿Gana el envido el equipo de `seat` en este mundo? (empate: el más cerca de la mano)
function envidoWins(g, seat, world) {
  const h = g.h;
  let best = null;
  for (let k = 0; k < g.n; k++) {
    const s = (h.mano + k) % g.n;
    if (h.mazo[s]) continue;
    const v = tanto(world.full[s], h.muestra).value;
    if (!best || v > best.v) best = { s, v };
  }
  return team(best.s) === team(seat);
}

const envidoX = (g, calls) => (s, world) => X.envidoAccept(tanto(world.full[s], g.h.muestra).value, calls);

// Puntos esperados de cantar `calls` (si no quieren: lo de antes; si quieren: se juega por todo).
function evEnvido(g, seat, ctx, samples, calls) {
  const T = team(seat);
  const u = utility(g, seat);
  return wavg(samples, (world) => {
    const win = envidoWins(g, seat, world);
    const pa = teamAccepts(g, seat, ctx, world, 'envidoAccept', envidoX(g, calls));
    const acc = envidoAcceptedPoints(g, calls, win ? T : 1 - T);
    return (1 - pa) * u(envidoDeclinedPoints(g, calls, T)) + pa * u(win ? acc : -acc);
  });
}

function envidoSamples(g, seat, ctx, rng) {
  return worlds(g, seat, ctx, rng, weigher(g, seat, ctx));
}

function envidoOpen(g, seat, ctx, rng, a) {
  const samples = envidoSamples(g, seat, ctx, rng);
  ctx.out = { p: wavg(samples, (w) => (envidoWins(g, seat, w) ? 1 : 0)) };
  const opts = [{ a: null, ev: 0 }];
  for (const kind of a.envido) opts.push({ a: { t: 'envido', kind }, ev: evEnvido(g, seat, ctx, samples, [kind]) + BOT.aggro / 2 });
  return choose(opts, rng);
}

function envidoAnswer(g, seat, ctx, rng, a) {
  const h = g.h;
  const calls = h.envido.calls;
  const T = team(seat);
  const samples = envidoSamples(g, seat, ctx, rng);
  ctx.out = { p: wavg(samples, (w) => (envidoWins(g, seat, w) ? 1 : 0)) };
  const u = utility(g, seat);
  const opts = [
    {
      a: { t: 'quiero' },
      ev: wavg(samples, (world) => {
        const win = envidoWins(g, seat, world);
        const acc = envidoAcceptedPoints(g, calls, win ? T : 1 - T);
        return u(win ? acc : -acc);
      }),
    },
    { a: { t: 'noquiero' }, ev: u(-envidoDeclinedPoints(g, calls, 1 - T)) },
  ];
  for (const kind of a.envido) opts.push({ a: { t: 'envido', kind }, ev: evEnvido(g, seat, ctx, samples, [...calls, kind]) });
  return choose(opts, rng);
}

// Cantar los tantos. Si pierde y la mesa permite trampas, a veces dice uno más y después no muestra:
// si los rivales no reclaman, se lleva el envido. Miente menos contra los que suelen reclamar.
function declare(g, seat, ctx, rng, a) {
  const h = g.h;
  const best = h.envido.declare.best;
  const real = tanto(h.cards[seat], h.muestra).value;
  if (!best || real > best.value) return { t: 'cantar' };
  if (a.lie && team(best.seat) !== team(seat)) {
    let v = best.value + 1;
    while (v <= 39 && !validTanto(v, h.muestra)) v++;
    const claim = Math.max(...rivals(g, seat).map((s) => rate(brainOf(ctx, s), 'claim')));
    if (validTanto(v, h.muestra) && pick(rng, BOT.lie * (1 - claim) + 0.05)) return { t: 'cantar', value: v };
  }
  return { t: 'buenas' };
}

// ---------------------------------------------------------------- cartas

function tableBest(g, seat) {
  let mine = -1;
  let theirs = -1;
  const plays = g.h.rounds[g.h.r].plays;
  for (const p of plays) {
    if (team(p.seat) === team(seat)) mine = Math.max(mine, playValue(p, g));
    else theirs = Math.max(theirs, playValue(p, g));
  }
  return { mine, theirs, count: plays.length };
}

// La carta que más manos imaginadas gana; si dan parecido, la más baja (las buenas se guardan).
function chooseCard(g, seat, ctx, rng, a) {
  const h = g.h;
  const R = (c) => rank(c, h.muestra);
  const hand = h.inHand[seat].slice().sort((x, y) => R(x) - R(y));
  const tb = tableBest(g, seat);
  let card = hand[0];
  if (hand.length > 1) {
    // dos cartas del mismo valor juegan igual: se simula una por valor
    const byRank = new Map(hand.map((c) => [R(c), c]));
    const st = simStats(g, seat, ctx, rng, 'card', (samples, S) =>
      Object.fromEntries([...byRank].map(([r, c]) => ['c' + r, S((w) => rollout(g, seat, w, { t: 'play', card: c, mode: 'normal' }))])),
    );
    let bestP = -1;
    for (const c of hand) {
      const p = st.avg('c' + R(c));
      if (p > bestP + 0.03) (bestP = p), (card = c);
    }
  }
  // si no puede ganar la ronda, a veces la tira tapada (no regala información)
  if (a.canDown && tb.count && !hand.some((c) => R(c) > tb.theirs) && pick(rng, 0.25)) return { t: 'play', card, mode: 'down' };
  // trampa: tapa su carta con la más baja, que queda quemada para la ronda siguiente
  const lowest = hand[0];
  // juega último y mata él (no su compañero): deja encimada la de la ronda siguiente, que no se quema
  const rest = hand.filter((c) => c !== card);
  const last = tb.count === h.mazo.filter((m) => !m).length - 1;
  if (a.canDouble && rest.length && last && R(card) > tb.theirs && R(card) > tb.mine && pick(rng, BOT.doubleKill)) {
    return { t: 'play2', bottom: card, top: rest[rest.length - 1] };
  }
  if (a.canDouble && h.r === 0 && hand.length === 3 && card !== lowest && pick(rng, BOT.double)) return { t: 'play2', bottom: card, top: lowest };
  return { t: 'play', card, mode: 'normal' };
}

// ---------------------------------------------------------------- decisión

// Jugadas de respaldo, en orden, por si el bot falla o lo que eligió no vale: la sala prueba hasta que una
// entra, así la partida nunca queda trabada esperando a un bot.
export function fallbackActions(g, seat) {
  const h = g.h;
  if (h?.phase === 'show') return [{ t: 'mostrar' }, { t: 'nomostrar' }];
  const hand = (h?.inHand[seat] || []).slice().sort((x, y) => rank(x, h.muestra) - rank(y, h.muestra));
  return [
    { t: 'buenas' }, { t: 'cantar' }, { t: 'quiero' }, { t: 'noquiero' },
    { t: 'flor', kind: 'flor' }, { t: 'flor', kind: 'quiero' }, { t: 'flor', kind: 'noquiero' },
    ...hand.map((card) => ({ t: 'play', card, mode: 'normal' })),
    { t: 'mazo' },
  ];
}

export function botAction(g, seat, rng = Math.random, ctx = {}) {
  const h = g.h;
  if (!h || g.status !== 'playing') return null;
  if (h.phase === 'show') return h.show.seat === seat && !h.show.folded ? botShow(g, seat) : null;
  if (h.phase !== 'play') return null;
  const w = waitingFor(g);
  if (!w.seats.includes(seat)) return null;
  const a = actionsFor(g, seat);

  // flor: si la tiene, la canta (es obligatorio); si le cantan flor, contesta según lo que tiene
  if (a.flor.includes('flor')) return { t: 'flor', kind: 'flor' };
  if (w.kind === 'flor') return { t: 'flor', kind: florReply(a.flor, florFor(g, seat).value, rng) };
  if (w.kind === 'declare') return declare(g, seat, ctx, rng, a);
  if (w.kind === 'envido') return envidoAnswer(g, seat, ctx, rng, a);

  if (w.kind === 'truco') {
    // "el envido está primero": si conviene, lo canta antes de contestar el truco
    if (a.envido.length) {
      const e = envidoOpen(g, seat, ctx, rng, a);
      if (e) return e;
    }
    return trucoAnswer(g, seat, ctx, rng, a);
  }

  if (w.kind === 'play') {
    // si el compañero le dijo "callado", no lo canta él: sigue jugando y que lo canten los rivales
    if (envidoOpenFor(g, seat) && a.envido.length && !ctx.hush?.tantos) {
      const e = envidoOpen(g, seat, ctx, rng, a);
      if (e) return e;
    }
    if (a.truco && !ctx.hush?.truco) {
      const t = trucoTurn(g, seat, ctx, rng, a);
      if (t) return t;
    }
    return chooseCard(g, seat, ctx, rng, a);
  }
  return null;
}

// Después de la mano: muestra si dijo la verdad; si mintió, se va sin mostrar.
export function botShow(g, seat) {
  const h = g.h;
  return tanto(h.cards[seat], h.muestra).value === h.show.value ? { t: 'mostrar' } : { t: 'nomostrar' };
}

// Respuesta a la flor rival según el valor de la propia (los bots no mienten: no se puede).
function florReply(options, value, rng) {
  if (options.includes('contraflor') && value >= 33 && pick(rng, 0.6)) return 'contraflor';
  if (options.includes('resto') && value >= 36 && pick(rng, 0.5)) return 'resto';
  if (value >= 30 || (value >= 27 && pick(rng, 0.5))) return 'quiero';
  return options.includes('achico') ? 'achico' : 'noquiero';
}

// ¿El bot le reclama al rival que no mostró los tantos? Más seguido a los que suelen mentir; si está
// espiando, sabe si mintió.
export function botClaims(g, seat, rng = Math.random, ctx = {}) {
  const h = g.h;
  if (h?.phase !== 'show' || team(seat) === team(h.show.seat)) return false;
  if (ctx.peek && tanto(h.cards[h.show.seat], h.muestra).value !== h.show.value) return true;
  return rng() < 0.55 + 0.4 * rate(brainOf(ctx, h.show.seat), 'lie');
}

// Trampa del que reparte: se da una de las cartas buenas que quedaron en el mazo en lugar de su peor carta.
export function stackDeck(g, seat, rng = Math.random) {
  const h = g.h;
  if (!h || !g.trampas) return false;
  const R = (c) => rank(c, h.muestra);
  const dealt = new Set([...h.cards.flat(), h.muestra]);
  const good = newDeck().filter((c) => !dealt.has(c) && R(c) >= R('7O'));
  if (!good.length) return false;
  const give = good[Math.floor(rng() * good.length)];
  const mine = h.cards[seat];
  const worst = mine.slice().sort((x, y) => R(x) - R(y))[0];
  if (R(worst) >= R(give)) return false;
  h.cards[seat] = mine.map((c) => (c === worst ? give : c));
  h.inHand[seat] = h.inHand[seat].map((c) => (c === worst ? give : c));
  return true;
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
  if (tanto(h.cards[seat], h.muestra).value >= 30) return 'envido_alto';
  if (hasNum(2)) return 'dos';
  return 'ciego';
}
