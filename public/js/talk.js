// Lo que dicen los bots en el chat (y en voz alta en el cliente). Corre en el servidor.
// No delatan la mano: con cartas buenas a veces se hacen los humildes y cuando farolean casi siempre
// se hacen los guapos. Reaccionan a lo que pasa en la mesa, chicanean, se calientan y charlan entre ellos.
import { team, rank } from './engine.js';

// Regla de la charla: decir "truco" (en cualquier momento) o "envido" (si sos pie) en una frase es cantarlo, o subirlo.
// Por eso solo las frases de canto nombran el canto (strongCall, humbleCall, raise, envidoStrong, envidoHumble, falta).
// Las demás, cuando hablan del tema, dicen "el segundo" (truco) o "el primero", "los tantos", "los puntos" (envido),
// y al no querer el envido no lo nombran. test/bots.test.js lo verifica.
export const BOT_TALK = {
  // ---- cantos: {C} / {c} es el canto de verdad ("Truco", "Retruco", "Vale cuatro", "Real envido"...).
  // Cada frase dice el canto o la respuesta: reemplaza al "¡Truco!" o al "Quiero" de siempre, no se le suma.
  strongCall: [
    '{C}, y no me hagas perder tiempo.', 'Dale que va: {c}.', 'Esta mano es mía: {c}.', '{C}. Preparate que viene fuerte.',
    '{C}. ¿Querés? Pensalo bien...', 'A esto vine: {c}.', '{C}, y andá llamando a tu abogado.', 'Con esta gano hasta dormido. {C}.',
    '{C}. Y no me mires así.', '{C}. Si no querés, no te culpo.', '{C}, que hace frío.', 'Esto es pan comido. {C}.',
    'Agarrate Catalina: {c}.', '{C}, y que Dios reparta suerte.', 'Te canto {c} con una mano atada.',
    '{C}. Ya sé lo que tenés, eh.', 'Mirá que te conozco: {c}.',
  ],
  humbleCall: [
    'Bueno... probemos: {c}.', 'Uh, no sé, pero {c}.', '{C}, y vamos a ver qué pasa.', 'Me la juego, che: {c}.',
    'El que no arriesga no gana. {C}.', 'Y bueno, {c}... qué sé yo.', '{C}, y que sea lo que sea.',
    'A la que te criaste: {c}.', '{C}, pero despacito.', 'Sin miedo al éxito: {c}.',
  ],
  // subir cuando el otro cantó (retruco o vale cuatro)
  raise: [
    '¿Ah, sí? {C}, y no me tiembla el pulso.', '¡{C}! ¿Qué te pensabas?', '{C}. A ver quién es más guapo.',
    '¡{C}! Y ahora llorá.', '{C}, y te espero sentado.', '¿Me cantás a mí? {C}.', '{C}, y que se arme.',
  ],
  // ---- contestar truco (todas dicen "quiero" o "no quiero")
  strongAccept: [
    'Quiero, y andá contando los porotos.', 'Quiero. Gracias por avisar.', '¡Pero obvio que quiero!', 'Quiero, tirá nomás.',
    'Quiero, y traé el mate que esto va para largo.', 'Quiero. Te veo flojito.', '¡Quiero! Me hiciste el día.',
    'Quiero, y sin pestañear.', '¿Eso es todo? Quiero.',
  ],
  humbleAccept: [
    'Bueno, quiero... a ver.', 'Quiero, total ya fue.', 'Quiero, que sea lo que Dios quiera.', 'Quiero, pero me estás asustando.',
    'Ufa... quiero.', 'Y bueno, quiero. Si pierdo, no me mires.', 'Quiero, por orgullo nomás.',
  ],
  decline: [
    'No quiero, llevátelo.', 'Andá, andá... no quiero.', 'Hoy no, che: no quiero.', 'No quiero. Me achico, pero ya vas a ver.',
    'Ni en pedo te quiero eso.', 'No quiero. Disfrutalo, que es el último.', 'No quiero, llevátelo de regalo.',
    'No quiero, guardo las balas para después.', 'No quiero. Se te nota en la cara.', 'Uh, no quiero. Esta te la debo.',
  ],
  // ---- envido
  envidoStrong: [
    '{C}, y contá bien los tuyos.', '{C}. Tengo para cantar, eh.', '{C}. Ojo.', '{C}, y no me mientas.',
    '{C}. Andá preparando el "son buenas".', '{C}, que me pica la mano.', '{C}, y mirá que vengo con todo.',
  ],
  envidoHumble: ['{C}... por las dudas.', 'Tiro un {c}, a ver.', '{C}, total es gratis.', '{C}, y que sea lo que Dios quiera.'],
  falta: ['¡Falta envido, y que se termine acá!', 'Falta envido. Todo o nada.', 'Falta envido, y que tiemble la mesa.'],
  envidoAccept: ['Quiero los tantos. Cantá.', 'Quiero, a ver esos tantos.', 'Dale, quiero. Contá despacito.'],
  envidoDecline: ['No quiero los tantos, llevate el poroto.', 'No quiero. Tomá tu punto y callate.', 'No quiero, para qué.'],
  partner: [
    'Este lo contesto yo, compañero.', 'Tranqui, lo manejo yo.', 'Dejámelo a mí.', 'Tranqui, que de este me encargo.',
    'Compañero, esta va por mí.', 'Vos tomate el mate, yo contesto.',
  ],
  // ---- fin de mano y partida
  winHand: [
    'Anotá, anotá.', 'Así se juega.', 'Una más para la cuenta.', 'Fácil.', 'Y van...',
    '¡Adentro!', 'Andá contando los palitos, que te faltan.', 'Como robarle un caramelo a un nene.', 'Otra para el bolsillo.',
  ],
  winTruco: ['¡Y el segundo era nuestro!', 'El segundo querido, el segundo ganado.'], // solo si se jugó por truco o más
  loseHand: [
    'Me mataste.', 'Bien jugado, eh.', 'Ya va a venir la mía.', 'Qué mano fea me tocó.', 'La próxima es mía.',
    'Esta no cuenta, estaba pensando en otra cosa.', 'Suerte de principiante.', 'Disfrutala, que dura poco.', 'Ah, ¿así que así viene la cosa?',
    'Me la hiciste, eh. No me olvido.',
  ],
  bluffWon: [
    '¿Y si te digo que no tenía nada?', 'Jeje...', 'Ni te imaginás lo que tenía.', 'Tenía un cuatro y un cinco. Mentira. O no.',
    'Se asustó...', 'Nunca sabrás.', 'Con esto te gané: con la cara.',
  ],
  caught: ['Bueno, me pescaste.', 'Uh... justo me tenías que reclamar.', 'Era para ver si estabas atento.', 'Me confundí de número, viste.'],
  ahead: ['Esto ya está.', 'Vayan preparando la revancha.', 'Ya podemos ir pidiendo la cuenta.', '¿Seguimos o lo dejamos acá?'],
  behind: ['Todavía no terminó, eh.', 'Ahora empieza el partido.', 'Esto se da vuelta, ya vas a ver.', 'Dejalos que se agranden.'],
  gameWon: ['¡Ganamos! ¿La revancha o te vas a llorar?', 'Fue un placer. Para mí.', 'Otro día será. Para vos.', '¡Campeones!'],
  gameLost: ['Bien ganado. Pero quiero la revancha.', 'Me ganaste porque te dejé.', 'Revancha. Ya.', 'Las cartas no me quieren hoy.'],
  // ---- reacciones a los demás
  rivalTruco: [
    '¿El segundo? Mirá cómo tiemblo.', 'Uh, se vino con todo.', '¿Vos con qué cartas, a ver?', 'Ese segundo tiene olor a mentira.',
    'Huele a farol...', '¿El segundo? Te veo la cara y no te creo.', 'Ay, ay, ay... qué miedo.',
  ],
  rivalEnvido: ['¿Los tantos? Ya va.', 'Mmm... esos tantos me suenan.', '¿Los tantos, vos? Mirá vos.', 'Uh, éste vino con tantos.'],
  rivalFalta: ['¿La falta? ¿Estás de la cabeza?', 'Uh, se viene la grande.', '¿Todo o nada? Me gusta.'],
  rivalQuiero: ['¿Querés? Ahora vas a ver.', 'Te gusta sufrir, ¿eh?', 'Valiente. Me gusta.'],
  rivalNoQuiero: ['Ah, ¿no querés? Gallina.', 'Se achicó.', 'Sabía que no te ibas a animar.', 'Cobarde, pero inteligente.', 'Tomo nota, eh.'],
  rivalMazo: ['¡Se fue al mazo! Corré, corré.', 'Uh, ni pelearon.', 'Al mazo... qué tristeza.', 'Eso, andate, que te conviene.'],
  partnerMazo: ['¿Nos vamos? Bueno, vos sabrás.', 'Al mazo... estaba para pelearla.', 'Ok compañero, la próxima la peleamos.'],
  roundWon: ['¡Tomá!', 'Esa es mía.', 'Agarrá esa.', 'Mirá cómo la mato.', 'Chau, carta.'],
  // la que nombra la ronda solo se dice en esa ronda
  roundWonNth: [['Primera para nosotros.', 'Primera es nuestra.'], ['Segunda es nuestra.', 'Segunda para nosotros.'], ['Tercera y adentro.', 'Tercera es nuestra.']],
  roundLost: ['Uh, qué carta.', 'Bueno, esa se la llevaron.', 'Me la ganaste de pedo.', 'Disfrutala.', 'Mirá lo que tenía guardado...'],
  partnerCheer: ['¡Eso, compañero!', 'Así me gusta.', '¡Bien ahí!', '¡Esa es la que va!', '¡Vamos todavía!'],
  partnerBlame: ['¿Qué tiraste, compañero?', 'Uh, compañero...', 'Tranqui, la arreglo yo.', 'Bueno, vos sabrás lo que hacés.'],
  envidoWon: ['Los tantos son míos, gracias.', 'Te dije que tenía.', 'Anotá esos puntitos.', '¿Viste? No mentía.'],
  envidoLost: ['Bueno, tenías.', 'Ok, son buenas... por ahora.', 'Mmm, mirá si te pido que muestres...'],
  rivalHighTanto: ['¿Tanto? Mostrá, mostrá.', 'Mmm, mucho número para tan poca cara.', 'Eso lo quiero ver.', 'Ajá... seguro.'],
  // carta brava de un rival: las genéricas sirven para cualquiera; las que nombran la carta, solo para esa
  rivalBigCard: ['Mirá lo que tenía guardado...', 'Ah, bueno, venía armado.', 'Esa carta me dolió.'],
  rivalBigCardOf: {
    '1E': ['Uh, sacó el macho.', 'Mirá ese ancho de espada...', 'El ancho de espada. Qué raro, justo vos.'],
    '1B': ['Uh, sacó el ancho de basto.', 'Mirá ese ancho...', 'El bastito, mirá vos.'],
    '7E': ['Uh, el siete bravo.', 'Siete de espada, mirá vos.', 'Mirá ese siete...'],
    '7O': ['El siete de oro... venía armado.', 'Uh, el siete de oro.', 'Mirá ese siete...'],
  },
  myBigCard: {
    '1E': ['¡Ahí va el macho!', 'El ancho de espada, ¿qué tal?', 'Con el macho no se jode.'],
    '1B': ['Ancho de basto, para que aprendas.', 'Tomá, el bastito.'],
    '7E': ['Siete de espada, el bravo.', 'Siete bravo, ¿te gusta?'],
    '7O': ['Siete de oro, una joyita.', 'El siete de oro, brillando.'],
  },
  denounced: ['¿Quién, yo? ¡Jamás!', 'Me ofendés.', 'Habrá sido el viento.'],
  handStart: [
    'Mezclá bien, eh.', 'Esta mano viene linda, lo presiento.', '¿Quién trajo el mate?', 'Dale que se enfría la partida.',
    'A ver qué me tocó...', 'Repartí sin espiar, eh.', 'Ojo que vengo con hambre.',
  ],
  handStartTeam: ['Esta la ganamos, compañero.', 'Atento a las señas, compañero.'], // solo en equipo
  idle: [
    'Dale que se enfría el mate.', '¿Te dormiste?', 'Pensalo, pensalo, que no tenés nada.', 'Hoy, si es posible.',
    'Ey, ¿seguís ahí?', 'Tirá algo, aunque sea un cuatro.', 'Tanto pensar te va a hacer mal.', 'Mientras tanto me tomo un mate.',
  ],
  reply: ['Jajaja.', 'Sí, claro...', 'Ya vas a ver.', 'Hablá menos y jugá más.', 'Mirá quién habla.', 'Eso decís siempre.', 'Ajá.', 'Jaja, dale.'],
};

const pick = (rng, p) => rng() < p;
export const sayFrom = (list, rng = Math.random) => list[Math.floor(rng() * list.length)];
const say = (key, rng) => sayFrom(BOT_TALK[key], rng);

// Qué dice un bot al cantar o contestar. out.p: la chance que calculó de ganar (truco o envido).
// canto: el nombre del canto que acaba de hacer ("Retruco", "Real envido"...), para que la frase lo diga bien.
// Devuelve { text, call }: call = la frase ya dice el canto o la respuesta (el cliente no repite el "¡Truco!").
// partner: contestó por el equipo sin esperar al compañero humano (eso no reemplaza el canto: se dice antes).
export function talkFor(a, kind, out, rng = Math.random, partner = false, canto = '') {
  const p = out?.p ?? 0.5;
  const fill = (key) => ({ text: say(key, rng).replace(/{C}/g, canto).replace(/{c}/g, canto.toLowerCase()), call: true });
  if (partner && pick(rng, 0.6)) return { text: say('partner', rng), call: false };
  if (a.t === 'truco' && canto && pick(rng, 0.7)) {
    if (kind === 'truco') return fill('raise');
    const proud = p >= 0.6 ? pick(rng, 0.65) : p < 0.4 ? pick(rng, 0.75) : pick(rng, 0.5);
    return fill(proud ? 'strongCall' : 'humbleCall');
  }
  if (a.t === 'envido' && canto && pick(rng, 0.6)) {
    if (a.kind === 'falta') return fill('falta');
    return fill(p >= 0.6 || (p < 0.35 && pick(rng, 0.75)) ? 'envidoStrong' : 'envidoHumble');
  }
  if (a.t === 'quiero' && pick(rng, 0.55)) {
    if (kind === 'envido') return fill('envidoAccept');
    return fill(p > 0.6 && pick(rng, 0.8) ? 'strongAccept' : 'humbleAccept');
  }
  if (a.t === 'noquiero' && pick(rng, 0.55)) return fill(kind === 'envido' ? 'envidoDecline' : 'decline');
  return null;
}

// Al terminar la mano: festeja, se lamenta, o (a veces) se burla si un farol le salió bien.
export function talkHandEnd(g, seat, bluffWon, rng = Math.random) {
  if (bluffWon && pick(rng, 0.6)) return say('bluffWon', rng);
  if (!pick(rng, 0.45)) return null;
  const T = team(seat);
  const diff = g.score[T] - g.score[1 - T];
  if (Math.abs(diff) > g.target / 3 && pick(rng, 0.35)) return say(diff > 0 ? 'ahead' : 'behind', rng);
  const won = g.h.result?.winner === T;
  if (won && g.h.result.pts >= 2 && pick(rng, 0.4)) return say('winTruco', rng);
  return say(won ? 'winHand' : 'loseHand', rng);
}

export const talkCaught = (rng = Math.random) => say('caught', rng);
// Consulta al compañero (en equipo): el que pregunta y lo que le contestan: "Cantá" (si), "Callado" o "No tengo
// nada" (nada). "Callado" no es "no tengo": es seguir jugando sin cantarlo, que lo canten los otros (sea porque
// va a la pesca con buenas cartas o porque no quiere cantarlo). "No tengo nada" es eso: el que preguntó igual
// puede cantar si tiene él.
export const ASK_TALK = {
  tantos: {
    ask: ['¿Tienen tantos?', '¿Cómo andan de tantos?', '¿Canto el primero?', '¿Hay tantos, compañeros?'],
    si: ['Tengo, cantá.', 'Cantá nomás.', 'Dale, que tengo.', 'Cantá, que hay.'],
    callado: ['Callado.', 'Callado, que canten ellos.', 'Mejor callado.', 'Callado, compañero.'],
    nada: ['No tengo nada.', 'Nada, compañero.', 'De tantos, nada.', 'Ni para empezar.'],
  },
  truco: {
    ask: ['¿Le canto el segundo?', '¿Cómo vienen? ¿Canto?', '¿El segundo o no?', '¿Canto, compañeros?'],
    // ya se cantó: lo que se pregunta es subirlo
    askRe: ['¿Canto el re?', '¿Le damos el re?', '¿Va el re, compañeros?'],
    askCuatro: ['¿Canto el cuatro?', '¿Le mando el cuatro?', '¿Va el cuatro, compañeros?'],
    si: ['Dale, cantá.', 'Cantá, que vengo bien.', 'Cantale nomás.', 'Dale, que tengo con qué.'],
    callado: ['Callado.', 'Callado por ahora.', 'Mejor callado, compañero.', 'Callado, que lo canten ellos.'],
    nada: ['No tengo nada.', 'Nada, compañero.', 'Vengo seco.', 'Con esto no gano ni una.'],
  },
  // en primera, el compañero le pregunta al pie si "pone" (tira alta para ganar la ronda) o "va" (tira baja y
  // deja que mate el pie)
  primera: {
    ask: ['¿Pongo o voy?', '¿Pongo o voy, compañero?', '¿Mato o voy a vos?', '¿Qué hago, pongo o voy?'],
    poner: ['Poné.', 'Poné nomás.', 'Poné, que estoy flojo.', 'Matá vos.'],
    ir: ['Vení.', 'Vení, que mato yo.', 'Vení a mí.', 'Andá nomás, que la mato yo.'],
  },
};
// Respuestas válidas para cada consulta
export const ASK_ANSWERS = { tantos: ['si', 'callado', 'nada'], truco: ['si', 'callado', 'nada'], primera: ['poner', 'ir'] };
// level: el truco en juego (1 sin cantar, 2 querido, 3 retruco): se pregunta por lo que sigue.
export function talkAsk(kind, rng = Math.random, level = 1) {
  const t = ASK_TALK[kind];
  return sayFrom(kind === 'truco' && level >= 3 ? t.askCuatro : kind === 'truco' && level === 2 ? t.askRe : t.ask, rng);
}

// El compañero que no es pie le avisa que tiene tantos (o farolea), sin que nadie le pregunte.
export const TELL_TANTOS = ['Cantámelo que tengo.', 'Cantámelo que tengo, compañero.', 'Dale, cantámelo que tengo.', 'Cantámelo, que vengo cargado.'];
export const talkTellTantos = (rng = Math.random) => sayFrom(TELL_TANTOS, rng);

export const talkAnswer = (kind, ans, rng = Math.random) => sayFrom(ASK_TALK[kind][ans], rng);

export const talkIdle = (rng = Math.random) => say('idle', rng);
export const talkReply = (rng = Math.random) => say('reply', rng);

// Reacción de un bot (`seat`) a algo que hizo otro. humans: asientos humanos (para hablarle al compañero).
export function talkEvent(g, seat, e, humans, rng = Math.random) {
  const T = team(seat);
  const by = e.seat;
  if (by === seat && e.type !== 'round' && e.type !== 'play') return null; // los cantos propios los dice talkFor
  const rival = by != null && team(by) !== T;
  const humanPartner = by != null && !rival && humans.includes(by);
  switch (e.type) {
    case 'call':
      if (!rival) return humanPartner && e.kind === 'truco' && pick(rng, 0.3) ? say('partnerCheer', rng) : null;
      if (e.kind === 'truco') return pick(rng, 0.5) ? say('rivalTruco', rng) : null;
      if (e.kind === 'envido') return pick(rng, 0.45) ? say(/falta/i.test(e.text) ? 'rivalFalta' : 'rivalEnvido', rng) : null;
      if (e.kind === 'quiero') return pick(rng, 0.35) ? say('rivalQuiero', rng) : null;
      if (e.kind === 'noquiero') return pick(rng, 0.55) ? say('rivalNoQuiero', rng) : null;
      return null;
    case 'play': {
      if (!e.c || e.faceDown) return null;
      const big = BOT_TALK.myBigCard[e.c];
      if (by === seat) return big && pick(rng, 0.55) ? sayFrom(big, rng) : null;
      if (rival && rank(e.c, g.h?.muestra) >= rank('7O') && pick(rng, 0.4)) {
        const named = !g.h?.muestra && BOT_TALK.rivalBigCardOf[e.c];
        return named && pick(rng, 0.6) ? sayFrom(named, rng) : say('rivalBigCard', rng);
      }
      return null;
    }
    case 'round': {
      if (e.result === 'parda') return e.round < 2 && pick(rng, 0.25) ? 'Parda. Esto se pone bueno.' : null;
      if (e.result === T) {
        if (e.seat === seat) {
          if (!pick(rng, 0.35)) return null;
          const nth = BOT_TALK.roundWonNth[e.round];
          return nth && pick(rng, 0.3) ? sayFrom(nth, rng) : say('roundWon', rng);
        }
        return humans.includes(e.seat) && pick(rng, 0.4) ? say('partnerCheer', rng) : null;
      }
      return pick(rng, 0.25) ? say('roundLost', rng) : null;
    }
    case 'mazo':
      if (rival) return pick(rng, 0.6) ? say('rivalMazo', rng) : null;
      return humanPartner && pick(rng, 0.5) ? say('partnerMazo', rng) : null;
    case 'tanto':
      return rival && e.value >= 30 && pick(rng, 0.45) ? say('rivalHighTanto', rng) : null;
    case 'envido-done':
      if (!pick(rng, 0.45)) return null;
      return say(e.team === T ? 'envidoWon' : 'envidoLost', rng);
    case 'denuncia':
      return e.target === seat && pick(rng, 0.8) ? say('denounced', rng) : null;
    case 'deal':
      if (!pick(rng, 0.2)) return null;
      return g.n > 2 && pick(rng, 0.25) ? say('handStartTeam', rng) : say('handStart', rng);
    case 'game-end':
      return pick(rng, 0.85) ? say(e.team === T ? 'gameWon' : 'gameLost', rng) : null;
  }
  return null;
}
