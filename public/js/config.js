// Configuración COMPARTIDA entre el servidor (Durable Object) y el navegador.
// Todo número mágico de reglas, tiempos o rutas va acá: si lo cambiás, cambia en los dos lados.
// No importa nada ni toca el DOM.

// ------------------------------------------------------------------ marca
export const APP_NAME = 'Trukeados';

// ------------------------------------------------------------------ partida
export const MODES = { '1v1': 2, '2v2': 4, '3v3': 6 };
export const DEFAULT_MODE = '1v1';
export const modeLabel = (mode) => mode.replace('v', ' vs '); // '2v2' -> '2 vs 2'
export const TARGETS = [15, 30]; // a cuántos puntos se juega
export const DEFAULT_TARGET = 30;
export const MAX_NAME = 20;
export const MAX_CHAT_TEXT = 280;
export const MAX_CHAT_HISTORY = 120;
export const ROOM_CODE_LEN = 4; // solo números: fácil de dictar y de tipear en el celular
export const ROOM_REUSE_MS = 3 * 60 * 60 * 1000; // una sala vacía e inactiva hace 3 h libera su código

// ------------------------------------------------------------------ rutas
export const ROUTES = {
  room: (code) => `/sala/${code}`, // enlace para compartir
  roomRe: /^\/sala\/(\d{4})/,
  match: (id) => `/partida/${id}`, // una partida del historial (solo la ven los que jugaron)
  matchRe: /^\/partida\/([0-9a-f-]{36})$/,
  home: '/',
  api: {
    rooms: '/api/rooms',
    room: (code) => `/api/rooms/${code}`,
    ws: (code) => `/api/rooms/${code}/ws`,
    quick: '/api/quick',
    lobby: '/api/lobby',
    config: '/api/config',
    me: '/api/me',
    matches: '/api/matches',
    shop: '/api/shop',
    buy: '/api/shop/buy',
    equip: '/api/shop/equip',
    match: (id) => `/api/matches/${id}`,
  },
  card: (id) => `/cards/${id}.webp`,
};

// ------------------------------------------------------------------ tiempos (ms)
// La animación de reparto del cliente y la espera del servidor salen de los mismos números.
export const TIMING = {
  shuffle: 1100, // el mazo llega al que reparte y se mezcla
  cut: 800, // corta el de la izquierda
  dealStep: 170, // entre carta y carta
  dealTail: 260, // margen al final del reparto
  handPause: 5200, // pausa para ver cómo terminó la mano (y escuchar lo que dicen)
  showWindow: 15_000, // tiempo para mostrar los tantos o reclamar
  foldWindow: 6000, // si el que ganó el envido se va al mazo sin mostrar, lo que les queda a los rivales para reclamar
  afk: 40_000, // humano desconectado: después de esto juega el bot por él
  botThinkMin: 1300, // los bots "piensan" entre 1,3 y 2,3 s después de lo último que pasó
  botThinkRand: 1000,
  botAfterTalk: 500, // después de que termina de decirse un canto o una frase, antes de que un bot juegue
  roundPause: 1400, // al cerrarse una ronda (o el envido), para ver quién ganó
  botHeartbeat: 2500, // latido para las miradas de los bots
  askWait: 7000, // consulta al compañero ("¿tienen tantos?"): lo que se espera la respuesta antes de seguir
  askBotAnswer: 1600, // + hasta 0,9 s: lo que tarda un bot en contestarle al compañero
  partnerAnswer: 3500, // en equipo, lo que espera el compañero bot antes de contestar un canto por los dos
  botChatGap: 2200, // como mucho un mensaje de bot cada tanto
  botIdle: 9000, // si una persona tarda más que esto en jugar, algún bot la apura
};
// Duración total de mezclar + cortar + repartir n jugadores (3 cartas cada uno).
// Cuánto tarda la voz en decir un texto (aprox.): los bots esperan a que termine antes de jugar.
export const speechMs = (text) => 500 + String(text ?? '').length * 70;
export const dealMs = (n) => TIMING.shuffle + TIMING.cut + n * 3 * TIMING.dealStep + TIMING.dealTail;

// ------------------------------------------------------------------ señas
// id -> { label, expr (cara que pone el personaje), desc }. El servidor solo valida los ids.
// No hay "parpadeo" automático: la única forma de cerrar los ojos es la seña "ciego".
export const SENAS = {
  ancho_espada: { label: 'Ancho de espada', expr: 'brows', desc: 'Levantar las cejas' },
  ancho_basto: { label: 'Ancho de basto', expr: 'wink', desc: 'Guiñar un ojo' },
  siete_espada: { label: 'Siete de espada', expr: 'mouthRight', desc: 'Torcer la boca a la derecha' },
  siete_oro: { label: 'Siete de oro', expr: 'mouthLeft', desc: 'Torcer la boca a la izquierda' },
  tres: { label: 'Un tres', expr: 'bite', desc: 'Morderse el labio' },
  dos: { label: 'Un dos', expr: 'kiss', desc: 'Tirar un beso (trompita bien marcada)' },
  ancho_falso: { label: 'Ancho falso', expr: 'open', desc: 'Abrir la boca' },
  ciego: { label: 'Nada (ciego)', expr: 'eyesClosed', desc: 'Cerrar los ojos' },
  envido_alto: { label: 'Tengo envido', expr: 'puff', desc: 'Inflar los cachetes' },
  treinta: { label: '30 o más de envido', expr: 'nose', desc: 'Fruncir la nariz' },
  nada_envido: { label: 'No tengo envido', expr: 'frown', desc: 'Boca para abajo' },
};
export const SENA_MS = 2200; // cuánto dura la cara de una seña
export const SENA_BITE_MS = 700; // un mordisco de labio (la seña del tres se anima, no es una cara quieta)

// ------------------------------------------------------------------ bots
// Cómo piensan (ver bot.js y brain.js). Las trampas solo valen en mesas que las permiten.
export const BOT = {
  samples: 40, // manos imaginadas del rival por decisión (Monte Carlo)
  memoSamples: 160, // memoria: con tantas manos imaginadas juntadas en una situación ya no piensa (ver BotMemo)
  temp: 0.15, // ruido al elegir entre cantos (en puntos): más alto = más impredecible
  peek: 0.15, // trampa: espía las cartas de los rivales en esa mano
  peekBehind: 0.35, // ... si va perdiendo por mucho
  stack: 0.1, // trampa: el bot que reparte se acomoda una carta buena
  stackBehind: 0.25,
  lie: 0.6, // como mucho, cuántas veces miente en el envido cuando lo pierde
  aggro: 0.3, // ganas de farolear: puntos de más que le suma a cantar y subir (más alto = más faroles)
  double: 0.04, // tira dos cartas encimadas (con la de arriba quemada)
  doubleKill: 0.2, // si juega último y mata, a veces deja encimada la de la ronda siguiente (no se quema)
  behind: 1 / 6, // "va perdiendo por mucho": la diferencia supera esta parte de la partida
};

export const BOT_NAMES = ['Tito', 'Coca', 'El Ruso', 'Chacho', 'Pocha', 'Beto', 'Nené', 'Cacho', 'Mirta', 'Pirulo', 'Tota', 'Rulo', 'Sancho', 'Volcho', 'Olcho', 'Carlitos', 'Tronco'];

// ------------------------------------------------------------------ cuentas (Supabase Auth)
// Sin cuenta no se juega: el servidor pide el token de Supabase para crear salas, entrar y mirar.
export const AUTH = {
  usernameRe: /^[\p{L}\p{N}_.]{3,20}$/u, // el nombre en la mesa y en el ranking: único, sin espacios
  usernameHint: 'Entre 3 y 20 letras o números (también _ y .), sin espacios',
  minPassword: 6,
  jwksTtl: 10 * 60_000, // cada cuánto el servidor vuelve a bajar las claves públicas de Supabase
  profileTtl: 60_000, // cuánto se guarda un perfil leído en memoria del Worker
};
export const ELO_START = 1200;
// ELO por modo. Solo cuentan las partidas entre personas (ningún bot sentado al empezar). En equipo se usa el
// promedio de cada equipo y todos los del equipo suman o restan lo mismo.
export const ELO = {
  k: 32, // cuánto se mueve por partida
  kNew: 48, // en las primeras partidas se mueve más, para llegar rápido a tu nivel
  newGames: 10,
};
// Monedas que se ganan al terminar una partida (para la tienda). Contra bots, la mitad.
export const COINS = { game: 10, win: 10, botFactor: 0.5 };
// Análisis post-partida: cuántos puntos equivalentes perdiste con tu decisión respecto de la mejor.
export const ANALYSIS = {
  samples: 60, // manos imaginadas por decisión (más que un bot: acá no hay apuro)
  // hasta cuánto perdido es cada calificación (lo que pasa del último es "error grave")
  grades: [
    { key: 'mejor', max: 0.05, label: 'La mejor' },
    { key: 'buena', max: 0.35, label: 'Buena' },
    { key: 'imprecision', max: 0.8, label: 'Imprecisión' },
    { key: 'error', max: 1.6, label: 'Error' },
    { key: 'grave', max: Infinity, label: 'Error grave' },
  ],
  accuracyScale: 0.8, // precisión = promedio de exp(-perdido / esto), como un porcentaje
  // El modelo de base de los bots supone rivales que casi nunca aceptan una falta o un retruco: contra eso,
  // cualquier farol "conviene". Para aconsejar a una persona se supone que el rival que va ganando acepta así.
  honestAccept: 0.85,
};
export const HISTORY_PAGE = 20; // partidas por página en el historial

// ------------------------------------------------------------------ tienda y personalización
// Se compra con las monedas que se ganan jugando (COINS). Lo que tenés puesto lo ven todos en la mesa: la ropa,
// el gorro, los anteojos y lo que tenés delante, siempre; el paño y el mazo, en las mesas donde sos anfitrión.
// Los colores y las formas de cada cosa están en theme.js (COSMETIC_LOOK), con la misma clave.
export const COSMETIC_SLOTS = [
  { key: 'ropa', label: 'Ropa', where: 'Tu personaje' },
  { key: 'gorro', label: 'Gorro', where: 'Tu personaje' },
  { key: 'anteojos', label: 'Anteojos', where: 'Tu personaje' },
  { key: 'objeto', label: 'En la mesa', where: 'Delante tuyo' },
  { key: 'pano', label: 'Paño', where: 'La mesa, cuando sos anfitrión' },
  { key: 'dorso', label: 'Mazo', where: 'El dorso de las cartas, cuando sos anfitrión' },
];
export const COSMETICS = [
  { id: 'remera-celeste', slot: 'ropa', name: 'Remera celeste', price: 40 },
  { id: 'chomba-verde', slot: 'ropa', name: 'Chomba verde', price: 60 },
  { id: 'pulover-bordo', slot: 'ropa', name: 'Pulóver bordó', price: 60 },
  { id: 'saco-negro', slot: 'ropa', name: 'Saco negro', price: 90 },
  { id: 'boina', slot: 'gorro', name: 'Boina', price: 70 },
  { id: 'gorra', slot: 'gorro', name: 'Gorra', price: 50 },
  { id: 'lentes', slot: 'anteojos', name: 'Lentes', price: 40 },
  { id: 'mate', slot: 'objeto', name: 'Mate', price: 30 },
  { id: 'cafe', slot: 'objeto', name: 'Cafecito', price: 30 },
  { id: 'porron', slot: 'objeto', name: 'Porrón', price: 50 },
  { id: 'fernet', slot: 'objeto', name: 'Fernet con coca', price: 80 },
  { id: 'pano-azul', slot: 'pano', name: 'Paño azul', price: 120 },
  { id: 'pano-bordo', slot: 'pano', name: 'Paño bordó', price: 120 },
  { id: 'pano-negro', slot: 'pano', name: 'Paño negro', price: 150 },
  { id: 'dorso-azul', slot: 'dorso', name: 'Dorso azul', price: 100 },
  { id: 'dorso-verde', slot: 'dorso', name: 'Dorso verde', price: 100 },
  { id: 'dorso-negro', slot: 'dorso', name: 'Dorso negro', price: 130 },
];
export const cosmeticById = (id) => COSMETICS.find((c) => c.id === id) || null;
/** Lo que tiene puesto, limpio: solo ids que existen, cada uno en su ranura (y, si se pasa, solo lo comprado). */
export function cleanEquipped(eq, owned = null) {
  const out = {};
  for (const s of COSMETIC_SLOTS) {
    const it = cosmeticById(eq?.[s.key]);
    if (it && it.slot === s.key && (!owned || owned.includes(it.id))) out[s.key] = it.id;
  }
  return out;
}

// ------------------------------------------------------------------ validación
export const CODE_RE = /^\d{4}$/;

// ------------------------------------------------------------------ opciones de la sala
// Una sola lista para el servidor, el menú y la sala de espera. `invert`: el checkbox dice lo contrario
// del valor (ej.: "No permitir trampas" marcado = trampas: false).
export const ROOM_OPTIONS = [
  { key: 'flor', def: false, label: 'Jugar con flor', short: 'con flor' },
  { key: 'muestra', def: false, label: 'Jugar con muestra (las piezas del palo de la carta dada vuelta son las más altas)', short: 'con muestra' },
  { key: 'trampas', def: true, invert: true, label: 'No permitir trampas (ej.: encimar cartas o mentir en el envido)', short: 'sin trampas' },
];
// Opciones válidas a partir de lo que mande el cliente (lo que falte o no sea booleano, por defecto).
export const roomOptions = (src) => Object.fromEntries(ROOM_OPTIONS.map((o) => [o.key, typeof src?.[o.key] === 'boolean' ? src[o.key] : o.def]));
// Texto corto para mostrar las opciones activas ("con flor · sin trampas").
export const roomOptionsText = (cfg) => ROOM_OPTIONS.filter((o) => cfg[o.key] !== o.def).map((o) => o.short).join(' · ');
