// Partidas grabadas: el formato del registro (lo arma la sala, src/truco-room.js) y cómo reproducirlo.
// Compartido y sin DOM: lo usan el servidor (para grabar), el visor del historial y el análisis.
//
// Registro: { v, mode, target, options, seats: [{ name, uid, bot }], hands: [{ start, steps }] }
//   start: el estado de la partida justo después de repartir (con las trampas de los bots ya hechas), sin eventos.
//   steps: lo que pasó en orden: [asiento, acción] (una jugada que el motor aceptó) o ['close'] (venció el tiempo
//   para mostrar los tantos). Como el motor es determinista, aplicar los pasos al estado reproduce la mano.
import { act, closeShow, cardName, team } from './engine.js';

export const LOG_VERSION = 1;

const clone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

/** Estado para guardar al empezar una mano (sin los eventos viejos, que no hacen falta y ocupan). */
export const snapshot = (g) => ({ ...clone({ ...g, ev: [] }), ev: [] });

/** Aplica un paso a un estado (lo modifica). Devuelve false si el motor no lo acepta (registro corrupto). */
export function applyStep(g, step) {
  if (step[0] === 'close') return closeShow(g);
  return !!act(g, step[0], step[1]).ok;
}

/**
 * Cuadros de una mano: el estado al repartir y después de cada paso, con lo que pasó en ese paso.
 * [{ g, step, seat, a, events }] (el primero, sin paso).
 */
export function handFrames(hand) {
  const g = clone(hand.start);
  g.ev = [];
  const frames = [{ g: clone(g), step: null, seat: null, a: null, events: [] }];
  for (const step of hand.steps) {
    const before = g.evId;
    if (!applyStep(g, step)) break;
    const seat = step[0] === 'close' ? null : step[0];
    frames.push({ g: clone(g), step, seat, a: step[1] || null, events: g.ev.filter((e) => e.id > before) });
    g.ev = [];
  }
  return frames;
}

// --------------------------------------------------------------- descripción en castellano

const ROUND = ['primera', 'segunda', 'tercera'];
const WHY = { truco: 'el truco', envido: 'el envido', flor: 'la flor', mazo: 'el mazo', noquiero: 'no quiero', show: 'los tantos' };

/** Texto de lo que pasó en un cuadro. names[seat] = nombre. */
export function describe(frame, names) {
  const n = (s) => names[s] ?? `Asiento ${s + 1}`;
  const teamName = (t) => names.filter((_, i) => team(i) === t).join(' y ');
  const out = [];
  for (const e of frame.events) {
    switch (e.type) {
      case 'play':
        if (e.double) out.push(`${n(e.seat)} tiró dos encimadas (arriba, el ${cardName(e.c)})`);
        else out.push(`${n(e.seat)} tiró ${e.faceDown ? 'una carta tapada' : `el ${cardName(e.c)}`}${e.burned ? ' (quemada)' : ''}`);
        break;
      case 'lucir':
        out.push(`${n(e.seat)} mostró lo que tenía: ${e.cards.map(cardName).join(', ')}`);
        break;
      case 'call':
        out.push(`${n(e.seat)}: «${e.text}»`);
        break;
      case 'tanto':
        out.push(e.value == null ? `${n(e.seat)}: «Son buenas»` : `${n(e.seat)}: «${e.value}»`);
        break;
      case 'mazo':
        out.push(`${n(e.seat)} se fue al mazo`);
        break;
      case 'denuncia':
        out.push(`${n(e.seat)} pidió que ${n(e.target)} muestre las dos: ${e.ok ? 'había trampa' : 'no había nada'}`);
        break;
      case 'round':
        out.push(e.result === 'parda' ? `${ROUND[e.round]} parda` : `${ROUND[e.round]} para ${n(e.seat)}`);
        break;
      case 'envido-done':
        out.push(`El envido es de ${n(e.seat)} (${e.value})`);
        break;
      case 'show':
        out.push(`${n(e.seat)} mostró ${e.value}${e.ok ? '' : `, pero había dicho ${e.said}`}`);
        break;
      case 'nomuestra':
        out.push(`${n(e.seat)} no mostró los tantos`);
        break;
      case 'reclamo':
        out.push(`${n(e.seat)} reclamó los tantos de ${n(e.target)}`);
        break;
      case 'show-timeout':
        out.push('Se terminó el tiempo para mostrar');
        break;
      case 'points':
        {
        const why = WHY[e.why] || (String(e.why).startsWith('envido') ? 'el envido' : '');
        out.push(`+${e.pts} para ${teamName(e.team)}${why ? ` (${why})` : ''}`);
        }
        break;
      case 'hand-end':
        break;
      case 'rendicion':
        out.push(`${n(e.seat)} se rindió`);
        break;
      case 'game-end':
        out.push('Fin de la partida');
        break;
    }
  }
  return out;
}

/**
 * Nombre corto de una acción (para "lo mejor era…"). ctx: { calls, trucoNext }, lo ya cantado, para decir
 * "envido envido" o "retruco" en vez de un nombre genérico.
 */
export function actionLabel(a, ctx = {}) {
  if (!a) return '';
  switch (a.t) {
    case 'play':
      return `tirar el ${cardName(a.card)}`;
    case 'play2':
      return `tirar el ${cardName(a.bottom)}`;
    case 'truco':
      return `cantar ${(ctx.trucoNext || 'truco').toLowerCase()}`;
    case 'envido':
      if (a.kind === 'envido' && ctx.calls?.includes('envido')) return 'cantar envido envido';
      return { envido: 'cantar envido', real: 'cantar real envido', falta: 'cantar falta envido' }[a.kind];
    case 'quiero':
      return 'querer';
    case 'noquiero':
      return 'no querer';
    case 'mazo':
      return 'irse al mazo';
    default:
      return a.t;
  }
}
