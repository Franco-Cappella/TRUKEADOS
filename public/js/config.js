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
// Pica-pica (opción de sala, solo 3 vs 3): se alterna una mano redonda y una de pica-pica, en la que cada uno
// juega mano a mano contra el de enfrente (tres duelos, uno detrás del otro). Se juega desde que un equipo llega
// a `from` hasta que a alguno le faltan `stopLeft` o menos (a 30: de 5 a 25, "las 10 buenas"). En el pica-pica
// la falta envido y la contraflor al resto valen `falta`, fijo.
export const PICA_PICA = { from: 5, stopLeft: 5, falta: 6 };
export const MAX_NAME = 20;
export const MAX_CHAT_TEXT = 280;
export const MAX_CHAT_HISTORY = 120;
export const ROOM_CODE_LEN = 4; // solo números: fácil de dictar y de tipear en el celular
export const ROOM_REUSE_MS = 3 * 60 * 60 * 1000; // una sala vacía e inactiva hace 3 h libera su código

// ------------------------------------------------------------------ ambientes
// Dónde se juega cada partida (uno al azar, distinto del anterior; los dibuja public/js/ambientes.js).
// shop: solo de la tienda (ranura "mapa"): no sale en el sorteo, se ve cuando juega el que lo tiene puesto.
export const AMBIENTES = [
  { id: 'bar', name: 'Bar notable' },
  { id: 'cafe', name: 'Café porteño' },
  { id: 'parrilla', name: 'Parrilla de barrio' },
  { id: 'parque', name: 'Bosques de Palermo' },
  { id: 'quincho', name: 'Quincho' },
  { id: 'club', name: 'Club de barrio' },
  { id: 'campo', name: 'Estancia' },
  { id: 'chinatown', name: 'Barrio Chino', shop: true },
  { id: 'noche', name: 'Noche estrellada', shop: true },
];
// Los mapas que quedan armados en la escena (el de cada turno) y cuánto dura el fundido al cambiar de uno a otro.
export const AMBIENTE_CACHE = 3; // el de la sala, el tuyo y el anterior (la revancha cambia de lugar)
export const AMBIENTE_FADE_MS = 560;
// Probar un mapa, un paño o un mazo en la tienda: la mesa vacía girando despacio (spin: radianes por cuadro) y hacia
// dónde mira la cámara (pitch: con el mapa, más arriba, hacia el lugar).
export const TRY_VIEW = { spin: 0.0035, mapPitch: 0.9, tablePitch: 0 };
/** Otro ambiente al azar (distinto del anterior, prev). Los de la tienda no salen. */
export function pickAmbiente(rng = Math.random, prev = null) {
  const pool = AMBIENTES.filter((a) => a.id !== prev && !a.shop);
  return pool[Math.floor(rng() * pool.length)].id;
}

// ------------------------------------------------------------------ rutas
export const ROUTES = {
  room: (code) => `/sala/${code}`, // enlace para compartir
  roomRe: /^\/sala\/(\d{4})/,
  match: (id) => `/partida/${id}`, // una partida del historial (solo la ven los que jugaron)
  matchRe: /^\/partida\/([0-9a-f-]{36})$/,
  // una partida compartida (la ve cualquiera con el enlace, aun sin cuenta); ?j=N abre en ese paso de la revisión
  shared: (id, at = 0) => `/repeticion/${id}${at > 0 ? `?j=${at}` : ''}`,
  sharedRe: /^\/repeticion\/([A-Za-z0-9_-]{16,32})$/,
  home: '/',
  api: {
    rooms: '/api/rooms',
    room: (code) => `/api/rooms/${code}`,
    roomMine: (code) => `/api/rooms/${code}/me`,
    ws: (code) => `/api/rooms/${code}/ws`,
    quick: '/api/quick',
    lobby: '/api/lobby',
    config: '/api/config',
    me: '/api/me',
    matches: '/api/matches',
    avatar: '/api/me/avatar',
    look: '/api/me/look',
    exportMe: '/api/me/export',
    deleteMe: '/api/me/delete',
    username: '/api/me/username',
    friends: '/api/friends',
    friendsRespond: '/api/friends/respond',
    friendsRemove: '/api/friends/remove',
    invites: '/api/invites',
    invitesDone: '/api/invites/done',
    ranking: (mode) => `/api/ranking?mode=${mode}`,
    user: (name) => `/api/users/${encodeURIComponent(name)}`,
    presence: '/api/presence',
    dm: '/api/dm',
    dmWith: (id, after = 0) => `/api/dm?with=${encodeURIComponent(id)}&after=${after}`,
    shop: '/api/shop',
    buy: '/api/shop/buy',
    equip: '/api/shop/equip',
    match: (id) => `/api/matches/${id}`,
    share: (id) => `/api/matches/${id}/share`,
    shared: (id) => `/api/shared/${id}`,
  },
  card: (id) => `/cards/${id}.webp`,
  deckCard: (deck, id) => `/cards/${deck}/${id}.png`, // las barajas de la tienda
  mapaThumb: (amb) => `/img/mapas/${amb}.webp`, // la foto de cada mapa de la tienda (tools/scene-test.html: mapShots())
};

// ------------------------------------------------------------------ tiempos (ms)
// La animación de reparto del cliente y la espera del servidor salen de los mismos números.
export const TIMING = {
  cardLabel: 2500, // el cartelito de una carta recién tirada
  shuffle: 1100, // el mazo llega al que reparte y se mezcla
  cut: 800, // corta el de la izquierda
  dealStep: 170, // entre carta y carta
  dealTail: 260, // margen al final del reparto
  handPause: 5200, // pausa para ver cómo terminó la mano (y escuchar lo que dicen)
  showWindow: 15_000, // tiempo para mostrar los tantos o reclamar
  foldWindow: 6000, // si el que ganó el envido se va al mazo sin mostrar, lo que les queda a los rivales para reclamar
  surrenderVote: 25_000, // en equipo, cuánto dura el pedido para rendirse (lo tienen que aceptar los compañeros)
  surrenderCooldown: 60_000, // si no salió, cuánto hay que esperar para volver a pedirlo
  mazoVote: 15_000, // en equipo, cuánto dura el pedido para irse al mazo (es de una mano: se cae si la mano termina)
  mazoCooldown: 8000, // si no salió, cuánto hay que esperar para volver a pedirlo
  afk: 40_000, // humano desconectado: después de esto pierde la partida (si le queda un compañero conectado, juega un bot por él)
  // con la pestaña oculta (sigue conectado) a los afk ms juega un bot por él, pero no pierde la partida.
  // Si le toca cantar los tantos y no está (oculto o desconectado), a los autoTanto ms se cantan solos: lo que tiene o "son buenas".
  autoTanto: 10_000,
  botThinkMin: 1300, // los bots "piensan" entre 1,3 y 2,3 s después de lo último que pasó
  botThinkRand: 1000,
  botAfterTalk: 500, // después de que termina de decirse un canto o una frase, antes de que un bot juegue
  roundPause: 1400, // al cerrarse una ronda (o el envido), para ver quién ganó
  botHeartbeat: 2500, // latido para las miradas de los bots
  askWait: 7000, // consulta al compañero ("¿tenés tantos?"): lo que se espera la respuesta antes de seguir
  askBotAnswer: 1600, // + hasta 0,9 s: lo que tarda un bot en contestarle al compañero
  partnerAnswer: 15_000, // en equipo, lo que espera el compañero bot antes de contestar un canto que le toca a los dos
  botChatGap: 2200, // como mucho un mensaje de bot cada tanto
  botIdle: 9000, // si una persona tarda más que esto en jugar, algún bot la apura
};
// Duración total de mezclar + cortar + repartir n jugadores (3 cartas cada uno).
// Cuánto tarda la voz en decir un texto (aprox.): los bots esperan a que termine antes de jugar.
export const speechMs = (text) => 500 + String(text ?? '').length * 70;
export const dealMs = (n) => TIMING.shuffle + TIMING.cut + n * 3 * TIMING.dealStep + TIMING.dealTail;

// ------------------------------------------------------------------ voces
// La voz grabada de hombre (public/voz) suena bastante más fuerte que la del dispositivo: se la baja a esta fracción.
export const RECORDED_VOICE_GAIN = 0.5;

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
// Las señas se ven mirando al que la hace, no de reojo: la carita está entera hasta `clear` grados del centro de la
// vista y se borra del todo a los `gone` (más allá, se le ve la cara de siempre). Así hay que girar para pescarla.
export const SENA_GLANCE = { clear: 9, gone: 20 };
// ------------------------------------------------------------------ tu personaje (creator.js)
// Lo que se puede elegir de tu personaje dibujado. Se guarda en profiles.look (lo valida cleanLook, también en el
// servidor) y lo dibuja characters.js (lookFor con el look elegido). Los colores están en AVATAR_COLORS (theme.js).
export const LOOK_OPTS = {
  counts: { skin: 10, hair: 18, cloth: 16 },
  styles: [
    { id: 'short', label: 'Corto' }, { id: 'swept', label: 'Para atrás' }, { id: 'wavy', label: 'Ondulado' },
    { id: 'curly', label: 'Rulos' }, { id: 'long', label: 'Largo' }, { id: 'bun', label: 'Rodete' },
    { id: 'receding', label: 'Con entradas' }, { id: 'buzz', label: 'Rapado' }, { id: 'boina', label: 'Boina' },
    { id: 'cap', label: 'Gorra' }, { id: 'sombrero', label: 'Sombrero' },
  ],
  shirts: [
    { id: 'button', label: 'Camisa' }, { id: 'tee', label: 'Remera' }, { id: 'polo', label: 'Chomba' },
    { id: 'sweater', label: 'Pulóver' }, { id: 'vest', label: 'Chaleco' }, { id: 'jacket', label: 'Saco' },
    { id: 'gaucho', label: 'Gaucho' },
  ],
  beards: [{ id: 'none', label: 'Nada' }, { id: 'stubble', label: 'Sin afeitar' }, { id: 'beard', label: 'Barba' }],
  flags: [
    { id: 'none', name: 'Ninguna' }, { id: 'ar', name: 'Argentina' }, { id: 'uy', name: 'Uruguay' }, { id: 'cl', name: 'Chile' },
    { id: 'py', name: 'Paraguay' }, { id: 'bo', name: 'Bolivia' }, { id: 'pe', name: 'Perú' }, { id: 'br', name: 'Brasil' },
    { id: 'co', name: 'Colombia' }, { id: 've', name: 'Venezuela' }, { id: 'mx', name: 'México' }, { id: 'es', name: 'España' },
    { id: 'it', name: 'Italia' }, { id: 'fr', name: 'Francia' }, { id: 'de', name: 'Alemania' }, { id: 'us', name: 'Estados Unidos' },
    { id: 'uk', name: 'Reino Unido' }, { id: 'cn', name: 'China' }, { id: 'jp', name: 'Japón' },
  ],
  // forma de la cara: ancho, alto y mandíbula (los de lookFor), y cuánto frunce las cejas
  face: { fw: [52, 66], fh: [74, 92], jaw: [0.5, 0.86], scowl: [0, 7] },
};
const pickIn = (list, v, def) => (list.some((x) => x.id === v) ? v : def);
const intIn = (v, n) => (Number.isInteger(v) && v >= 0 && v < n ? v : null);
const numIn = (v, [a, b]) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : null);

/** Un personaje elegido, limpio (lo que no sirve, afuera). null si no hay nada que guardar. */
export function cleanLook(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const c = LOOK_OPTS.counts;
  const out = {
    v: 1,
    skin: intIn(raw.skin, c.skin) ?? 3,
    hair: intIn(raw.hair, c.hair) ?? 1,
    style: pickIn(LOOK_OPTS.styles, raw.style, 'short'),
    shirt: pickIn(LOOK_OPTS.shirts, raw.shirt, 'button'),
    cloth: intIn(raw.cloth, c.cloth) ?? 0,
    cloth2: intIn(raw.cloth2, c.cloth) ?? 3,
    beard: pickIn(LOOK_OPTS.beards, raw.beard, 'none'),
    mustache: raw.mustache === true,
    glasses: raw.glasses === true,
    soft: raw.soft === true,
    flag: pickIn(LOOK_OPTS.flags, raw.flag, 'none'),
  };
  for (const [k, range] of Object.entries(LOOK_OPTS.face)) {
    const n = numIn(raw[k], range);
    if (n != null) out[k] = k === 'jaw' ? Math.round(n * 100) / 100 : Math.round(n);
  }
  return out;
}

/** Un personaje al azar (el botón "Aleatorio" del creador). */
export function randomLook(rng = Math.random) {
  const c = LOOK_OPTS.counts;
  const any = (list) => list[Math.floor(rng() * list.length)].id;
  const inRange = ([a, b], round = true) => (round ? Math.round(a + rng() * (b - a)) : Math.round((a + rng() * (b - a)) * 100) / 100);
  const style = any(LOOK_OPTS.styles);
  const soft = style === 'long' || style === 'bun' ? rng() < 0.8 : rng() < 0.15;
  return cleanLook({
    skin: Math.floor(rng() * c.skin),
    hair: rng() < 0.85 ? Math.floor(rng() * 14) : Math.floor(rng() * c.hair), // de fantasía, pocas veces
    style,
    shirt: any(LOOK_OPTS.shirts),
    cloth: Math.floor(rng() * c.cloth),
    cloth2: Math.floor(rng() * c.cloth),
    beard: soft ? 'none' : any(LOOK_OPTS.beards),
    mustache: !soft && rng() < 0.25,
    glasses: rng() < 0.18,
    soft,
    flag: rng() < 0.6 ? 'ar' : any(LOOK_OPTS.flags),
    fw: inRange(LOOK_OPTS.face.fw),
    fh: inRange(LOOK_OPTS.face.fh),
    jaw: inRange(LOOK_OPTS.face.jaw, false),
    scowl: inRange(LOOK_OPTS.face.scowl),
  });
}
// El creador (creator.js): adónde va la cámara en cada parte ({ x, y } en píxeles del personaje dibujado, x desde el
// medio; zoom 1 = el personaje entero), qué tan rápido llega, dónde están los pies y cuánto "habla" al cambiar algo.
export const CREATOR = {
  cam: {
    todo: { x: 0, y: 700, zoom: 0.8 },
    cuerpo: { x: 0, y: 690, zoom: 0.86 },
    cara: { x: 0, y: 235, zoom: 2.7 },
    pelo: { x: 0, y: 200, zoom: 2.5 },
    barba: { x: 0, y: 270, zoom: 3.3 },
    ropa: { x: 0, y: 600, zoom: 1.25 },
    bandera: { x: -60, y: 430, zoom: 2.9 },
  },
  camRate: 4.5,
  feetY: 1186,
  reactMs: 650,
};

export const SENA_BITE_MS = 1100; // un mordisco de labio (la seña del tres se anima, no es una cara quieta)
// Antitrampas (los aplica la sala; ver "Antitrampas" en AGENTS.md). Las señas viajan solo a los que miran al que la
// hace; esto evita además que un cliente modificado "barra" la mesa cambiando de mirada a toda velocidad para pescarlas.
export const ANTICHEAT = {
  senaDwell: 350, // ms que tenés que venir mirando a alguien para ver su seña (un vistazo al pasar no alcanza)
  lookBurst: { n: 8, ms: 3000 }, // cambios de mirada "normales" por ventana; pasarse cuesta lookPenalty
  lookPenalty: 1500, // ms sin ver señas después de pasarse (la mirada igual se mueve: los demás la ven)
  senaGap: 700, // ms mínimos entre dos señas del mismo jugador
  msgBurst: { n: 120, ms: 5000 }, // mensajes por conexión por ventana; los que sobran se descartan
  joinBurst: { n: 4, ms: 10000 }, // "join" por conexión (cada uno lee la base): los que sobran se descartan
  chatBurst: { n: 6, ms: 5000 }, // mensajes de chat por conexión: los que sobran se descartan
};

// ------------------------------------------------------------------ bots
// Cómo piensan (ver bot.js y brain.js). Las trampas solo valen en mesas que las permiten.
export const BOT = {
  claim: 0.95, // chance de que un bot rival te pida ver los tantos (y reclame si no los mostrás)
  samples: 40, // manos imaginadas del rival por decisión (Monte Carlo)
  memoSamples: 160, // memoria: con tantas manos imaginadas juntadas en una situación ya no piensa (ver BotMemo)
  temp: 0.15, // ruido al elegir entre cantos (en puntos): más alto = más impredecible
  peek: 0.15, // trampa: espía las cartas de los rivales en esa mano
  peekBehind: 0.35, // ... si va perdiendo por mucho
  stack: 0.1, // trampa: el bot que reparte se acomoda una carta buena
  stackBehind: 0.25,
  lie: 0.6, // como mucho, cuántas veces miente en el envido cuando lo pierde
  aggro: 0.3, // ganas de farolear: puntos de más que le suma a cantar y subir (más alto = más faroles)
  // Faroles en el envido con medida: cantar con poco cuesta "imagen" (el rival aprende y después te quiere todo).
  // Se resta esto (en puntos) por cada canto, proporcional a lo poco que confía en ganarlo (ver bluffTax en bot.js).
  bluffTax: { envido: 0.6, real: 1.4, falta: 9, truco: 1.2 },
  bluffSure: { envido: 0.5, real: 0.6, falta: 0.96, truco: 0.6 }, // desde esta chance de ganar el envido ya no es farol
  // La falta envido (que se puede llevar la partida) solo con tantos de verdad: al menos faltaMinTanto propios Y
  // faltaMinWin de chance de ganar el envido (imaginada con faltaSamples manos o más; con menos no se confía).
  faltaMinTanto: 31,
  faltaMinWin: 0.86,
  faltaSamples: 20,
  // La excepción: va perdiendo y al rival le faltan faltaDesperate puntos o menos (ya no hay nada que cuidar);
  // igual, con faltaDesperateTanto o más (no con cualquier cosa).
  faltaDesperate: 5,
  faltaDesperateTanto: 26,
  double: 0.04, // tira dos cartas encimadas (con la de arriba quemada)
  doubleKill: 0.2, // si juega último y mata, a veces deja encimada la de la ronda siguiente (no se quema)
  behind: 1 / 6, // "va perdiendo por mucho": la diferencia supera esta parte de la partida
  tellTantos: 27, // desde estos tantos, el compañero que no es pie le avisa al pie: "Cantámelo que tengo"
  tellLoaded: 0.7, // ... cuántas veces lo avisa cuando los tiene
  tellBluff: 0.12, // ... y cuántas lo dice sin tener nada (hasta 23 de tantos), para asustar a los rivales
};

// Bots que juegan con un personaje 3D de la tienda (por su nombre).
export const BOT_PERSONAJES = { Volcho: 'volcho', Olcho: 'olcho' };
// Los demás bots se visten con lo que haya en la tienda (COSMETICS), siempre lo mismo para el mismo nombre: un
// personaje 3D (cualquiera, también los que se agreguen después) BOT_SKIN.personaje de las veces, y algo de ropa.
export const BOT_SKIN = { personaje: 0.45, prenda: 0.5 };
const nameHash = (s, salt) => {
  let h = 2166136261 ^ salt;
  for (const ch of String(s)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
// Los bots y los rivales automáticos tienen siempre puesta su mesa (paño y mazo: se ven en su turno, como los de
// cualquiera) y BOT_SKIN.mesa de las veces algo delante y su propia baraja.
export const BOT_TABLE = ['pano', 'dorso'];
BOT_SKIN.mesa = 0.6;
/** Lo que tiene puesto un bot: si su nombre tiene personaje 3D, ese; si no, algo de la tienda según su nombre. */
export const botCos = (name, cos = {}) => {
  const pick = (slot, i) => {
    const items = COSMETICS.filter((c) => c.slot === slot);
    return items.length ? items[Math.floor(nameHash(name, i + 7) * items.length)].id : null;
  };
  let out;
  if (BOT_PERSONAJES[name]) out = { ...cos, personaje: BOT_PERSONAJES[name] };
  else if (Object.keys(cos).some((k) => !BOT_TABLE.includes(k))) out = { ...cos };
  else {
    out = { ...cos };
    if (nameHash(name, 1) < BOT_SKIN.personaje) out.personaje = pick('personaje', 0);
    ['ropa', 'gorro', 'anteojos'].forEach((slot, i) => {
      const id = nameHash(name, i + 2) < BOT_SKIN.prenda ? pick(slot, i + 1) : null;
      if (id) out[slot] = id;
    });
  }
  // la mesa, siempre (lo que ya traía, se respeta)
  // (con el nombre de la ranura en el azar: si no, todos caían en lo mismo)
  const pickBy = (slot) => {
    const items = COSMETICS.filter((c) => c.slot === slot);
    return items.length ? items[Math.floor(nameHash(`${name}|${slot}`, 3) * items.length)].id : null;
  };
  for (const slot of BOT_TABLE) out[slot] ||= pickBy(slot);
  for (const slot of ['objeto', 'baraja']) if (!out[slot] && nameHash(`${name}|${slot}?`, 5) < BOT_SKIN.mesa) out[slot] = pickBy(slot);
  return out;
};
export const BOT_NAMES = ['Tito', 'Coca', 'El Ruso', 'Chacho', 'Pocha', 'Beto', 'Nené', 'Cacho', 'Mirta', 'Pirulo', 'Tota', 'Rulo', 'Sancho', 'Volcho', 'Olcho', 'Carlitos', 'Tronco'];

// ------------------------------------------------------------------ cuentas (Supabase Auth)
// Sin cuenta no se juega: el servidor pide el token de Supabase para crear salas, entrar y mirar.
export const AUTH = {
  usernameRe: /^[\p{L}\p{N}_.]{3,20}$/u, // el nombre en la mesa y en el ranking: único, sin espacios
  usernameHint: 'Entre 3 y 20 letras o números (también _ y .), sin espacios',
  usernameCooldownDays: 14,
  usernameCooldown: 14 * 24 * 60 * 60_000, // cada cuánto se puede cambiar el nombre
  minPassword: 6,
  jwksTtl: 10 * 60_000, // cada cuánto el servidor vuelve a bajar las claves públicas de Supabase
  profileTtl: 60_000, // cuánto se guarda un perfil leído en memoria del Worker
};
/** Desde cuándo puede volver a cambiar el nombre (ms). 0 si nunca lo cambió. */
export const usernameFreeAt = (changedAt) => (changedAt ? new Date(changedAt).getTime() + AUTH.usernameCooldown : 0);
export const usernameFreeDay = (ms) => new Date(ms).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
export const ELO_START = 1200;
// Al registrarte elegís tu nivel y arrancás en ese ELO (en los tres modos).
export const SKILL_LEVELS = [
  { key: 'nuevo', elo: 400, label: 'Recién empiezo', desc: 'Estoy aprendiendo las reglas' },
  { key: 'principiante', elo: 800, label: 'Principiante', desc: 'Sé jugar, pero me cuesta cantar y mentir' },
  { key: 'intermedio', elo: 1200, label: 'Intermedio', desc: 'Juego seguido con amigos' },
  { key: 'avanzado', elo: 1600, label: 'Avanzado', desc: 'Leo a los rivales y sé cuándo farolear' },
  { key: 'experto', elo: 2000, label: 'Experto', desc: 'Gano torneos y me sé todas las señas' },
];
export const DEFAULT_LEVEL = 'intermedio';
export const levelElo = (key) => (SKILL_LEVELS.find((l) => l.key === key) || SKILL_LEVELS.find((l) => l.key === DEFAULT_LEVEL)).elo;
// ELO por modo: cuenta contra personas y en partida rápida; las mesas con bots elegidos por vos no. En equipo se
// usa el promedio de cada equipo. K baja de kStart a kMin a medida que jugás (ver elo.js).
export const ELO = {
  kStart: 160, // la primera partida mueve hasta 160 puntos: el sistema todavía no sabe tu nivel
  kMin: 14, // ya ubicado, una partida pareja mueve unos 7
  settle: 7, // cuántas partidas tarda en calmarse (a las 20 ya se mueve ~11 por partida)
  provisional: 15, // hasta acá se muestra como "en calibración"
  floor: 100,
};
// Partida rápida: lo que se espera gente antes de que completen la mesa rivales automáticos.
export const MATCH = {
  personajeChance: 0.35, // los rivales automáticos con personaje 3D (cualquiera de la tienda, también los nuevos)
  waitMin: 6000, // primer rival: entre 6 y 22 s
  waitRand: 16000,
  gapMin: 1500, // los siguientes, más seguidos
  gapRand: 4000,
  eloSpread: 150, // qué tan lejos de tu ELO aparecen
  joinRange: 400, // a qué mesas abiertas te manda
  cosmeticChance: 0.35,
  inviteHold: 90_000, // cuánto se le guardan los lugares a tu equipo mientras invitás
  inviteTtl: 120_000, // cuánto dura una invitación sin contestar
  rematchMin: 1500, // lo que tardan en aceptar la revancha
  rematchRand: 3000,
};
// Mesas en juego del lobby: partidas entre usuarios automáticos que cualquiera puede mirar (ver src/show-tables.js).
export const SHOW_TABLES = {
  min: 12,
  max: 18,
  refreshMs: 8 * 60_000, // cada cuánto puede cambiar cuántas mesas hay
  paceMin: 22_000, // cada cuánto se anotan puntos en una mesa que nadie mira
  paceRand: 26_000,
  share1v1: 0.5,
  share2v2: 0.35,
  codePrefix: '9', // los códigos que empiezan con 9 son solo de estas mesas
};
// Qué tan bien juega un rival automático según su ELO: cuántas manos imagina, cuánto ruido mete y qué tan
// seguido se equivoca feo (en esa decisión casi no piensa).
export function botSkill(elo) {
  const t = Math.max(0, Math.min(1, (elo - 400) / 1600));
  return { samples: Math.round(6 + 44 * t), temp: 0.9 - 0.75 * t, slip: 0.3 * (1 - t) ** 1.5 };
}
// Monedas: al registrarte, por partida (contra bots elegidos, la mitad) y cada escalón nuevo de ELO.
export const COINS = { signup: 200, game: 10, win: 10, // ganar: game + win (perder no da monedas)
  botFactor: 0.5, milestoneStep: 100, milestone: 75 };
// Anti-farmeo: entre las mismas personas (una de cada lado), como mucho `maxRated` partidas por ELO en `hours`
// horas. Las que siguen se juegan igual pero no mueven el ELO y dan las monedas de una partida sin ELO.
export const FARM = { hours: 24, maxRated: 3 };
export const AVATAR = {
  size: 128, // lado en píxeles de la foto guardada
  maxChars: 24000,
  gifMaxBytes: 800 * 1024, // los GIF se guardan aparte y se sirven desde /api/avatars/ID
  gifRe: /^data:image\/gif;base64,[A-Za-z0-9+/=]+$/,
  re: /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/,
};
export const RANKING_SIZE = 50;
// Análisis post-partida, como el de chess.com: cada jugada se califica por cuánta chance de ganar la partida
// perdió frente a la mejor opción (0 a 1). `max` es hasta cuánto perdido corresponde esa calificación.
export const ANALYSIS = {
  samples: 150, // manos imaginadas por decisión (más que un bot: acá no hay apuro)
  // de mejor a peor; glyph e icon los usa la revisión
  grades: [
    { key: 'mejor', max: 0.002, label: 'La mejor', glyph: '★' },
    { key: 'excelente', max: 0.01, label: 'Excelente', glyph: '✓' },
    { key: 'buena', max: 0.025, label: 'Buena', glyph: '✓' },
    { key: 'imprecision', max: 0.05, label: 'Imprecisión', glyph: '?!' },
    { key: 'error', max: 0.1, label: 'Error', glyph: '?' },
    { key: 'insensata', max: Infinity, label: 'Jugada insensata', glyph: '??' },
  ],
  // calificaciones especiales, que dependen de la situación además de lo perdido
  special: {
    brillante: { label: 'Mentira brillante', glyph: '!!' },
    genial: { label: 'Gran jugada', glyph: '!' },
    arriesgada: { label: 'Jugada arriesgada', glyph: '!?' },
    perdida: { label: 'Oportunidad perdida', glyph: '✕' },
  },
  bluffStrength: 0.25, // cantar con menos que esto de chance de ganar la mano es una mentira
  onlyMoveGap: 0.06, // "gran jugada": la única buena, las demás perdían al menos esto
  missLoss: 0.03, // "oportunidad perdida": no cantar costó al menos esto
  accuracyScale: 0.05, // precisión = promedio de exp(-perdido / esto), como un porcentaje
  // El modelo de base de los bots supone rivales que casi nunca aceptan una falta o un retruco: contra eso,
  // cualquier farol "conviene". Para aconsejar a una persona se supone que el rival que va ganando acepta así.
  honestAccept: 0.85,
};
// Todas las calificaciones, de mejor a peor (para el resumen y los íconos).
const G = Object.fromEntries(ANALYSIS.grades.map((g) => [g.key, g]));
const S = ANALYSIS.special;
export const GRADES = [
  { key: 'brillante', ...S.brillante },
  { key: 'genial', ...S.genial },
  G.mejor,
  G.excelente,
  G.buena,
  { key: 'arriesgada', ...S.arriesgada },
  G.imprecision,
  G.error,
  G.insensata,
  { key: 'perdida', ...S.perdida },
];
export const HISTORY_PAGE = 20; // partidas por página en el historial
// Rendirse en equipo: cuántos del equipo tienen que estar de acuerdo (en 1 vs 1 no hay votación).
export const SURRENDER_NEED = { '2v2': 2, '3v3': 2 };
// Irse al mazo en equipo: se va todo el equipo, así que es un pedido como rendirse (2 de 2 en 2v2, 2 de 3 en 3v3).
export const MAZO_NEED = { '2v2': 2, '3v3': 2 };
// Amigos conectados: cada navegador avisa dónde está cada ping ms; sin aviso por ttl ms, desconectado.
// El chat entre amigos guarda los últimos dmKeep mensajes de cada pareja y, con el chat abierto, se revisa cada chatPoll ms.
export const PRESENCE = { ping: 20_000, ttl: 70_000, dmKeep: 60, chatPoll: 3000 };

// ------------------------------------------------------------------ tienda y personalización
// Se compra con las monedas que se ganan jugando (COINS). Lo que tenés puesto lo ven todos en la mesa: la ropa,
// el gorro, los anteojos y lo que tenés delante, siempre; el paño y el mazo, cuando es tu turno; el mapa (el fondo), lo
// ves vos (los demás ven el de la sala). Ver tableLook.
// Los colores y las formas de cada cosa están en theme.js (COSMETIC_LOOK), con la misma clave.
export const COSMETIC_SLOTS = [
  { key: 'personaje', label: 'Personaje', where: 'Un personaje en 3D en vez del dibujado: lo ven todos' },
  { key: 'ropa', label: 'Ropa', where: 'Tu personaje' },
  { key: 'gorro', label: 'Gorro', where: 'Tu personaje' },
  { key: 'anteojos', label: 'Anteojos', where: 'Tu personaje' },
  { key: 'objeto', label: 'En la mesa', where: 'Delante tuyo' },
  { key: 'mapa', label: 'Mapa', where: 'El fondo de la partida: con uno puesto, siempre jugás ahí (lo ves vos)' },
  { key: 'pano', label: 'Paño', where: 'La mesa: la ven todos en tu turno' },
  { key: 'dorso', label: 'Mazo', where: 'El dorso de las cartas: lo ven todos en tu turno' },
  { key: 'baraja', label: 'Baraja', where: 'Las cartas que tirás vos: las ven todos' },
];
export const COSMETICS = [
  { id: 'volcho', slot: 'personaje', name: 'Volcho', price: 2500 },
  { id: 'olcho', slot: 'personaje', name: 'Olcho', price: 2500 },
  { id: 'gato-melon', slot: 'personaje', name: 'Gato Melón', price: 2500, credit: { text: 'Evil Foid Melon Cat de Kasugay (Sketchfab, licencia Sketchfab Standard)', url: 'https://sketchfab.com/3d-models/evil-foid-melon-cat-4a8be1db15504079bba21e0062395f2c' } },
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
  { id: 'pano-alfombra', slot: 'pano', name: 'Paño alfombra persa', price: 450 },
  { id: 'pano-almendro', slot: 'pano', name: 'Paño almendro en flor', price: 450 },
  { id: 'pano-fileteado', slot: 'pano', name: 'Paño fileteado porteño', price: 480 },
  { id: 'pano-poncho', slot: 'pano', name: 'Paño poncho salteño', price: 400 },
  { id: 'pano-casino', slot: 'pano', name: 'Paño de casino', price: 350 },
  { id: 'pano-calcareo', slot: 'pano', name: 'Paño baldosa calcárea', price: 400 },
  { id: 'pano-noche', slot: 'pano', name: 'Paño noche de campo', price: 450 },
  { id: 'pano-madera', slot: 'pano', name: 'Mesa de bodegón', price: 300 },
  { id: 'pano-estrellada', slot: 'pano', name: 'Paño noche estrellada', price: 490 },
  { id: 'dorso-azul', slot: 'dorso', name: 'Dorso azul', price: 100 },
  { id: 'dorso-verde', slot: 'dorso', name: 'Dorso verde', price: 100 },
  { id: 'dorso-negro', slot: 'dorso', name: 'Dorso negro', price: 130 },
  { id: 'dorso-estrellada', slot: 'dorso', name: 'Dorso noche estrellada', price: 380 },
  { id: 'baraja-pixel', slot: 'baraja', name: 'Baraja pixel art', price: 300, credit: { text: 'Spanish Deck - Pixel Art by jcanabal', url: 'https://jcanabal.itch.io/spanish-deck-pixel-art' } },
  // mapas (ambiente: el id de AMBIENTES). El Barrio Chino es solo de la tienda; los demás también salen en el sorteo.
  { id: 'mapa-noche', slot: 'mapa', name: 'Noche estrellada', price: 495, ambiente: 'noche' },
  { id: 'mapa-chinatown', slot: 'mapa', name: 'Barrio Chino', price: 480, ambiente: 'chinatown' },
  { id: 'mapa-bar', slot: 'mapa', name: 'Bar notable', price: 250, ambiente: 'bar' },
  { id: 'mapa-cafe', slot: 'mapa', name: 'Café porteño', price: 250, ambiente: 'cafe' },
  { id: 'mapa-parrilla', slot: 'mapa', name: 'Parrilla de barrio', price: 250, ambiente: 'parrilla' },
  { id: 'mapa-parque', slot: 'mapa', name: 'Bosques de Palermo', price: 280, ambiente: 'parque' },
  { id: 'mapa-quincho', slot: 'mapa', name: 'Quincho', price: 280, ambiente: 'quincho' },
  { id: 'mapa-club', slot: 'mapa', name: 'Club de barrio', price: 250, ambiente: 'club' },
  { id: 'mapa-campo', slot: 'mapa', name: 'Estancia', price: 280, ambiente: 'campo' },
];
export const cosmeticById = (id) => COSMETICS.find((c) => c.id === id) || null;
/** El ambiente de un mapa de la tienda (o null). */
export const mapaAmbiente = (itemId) => cosmeticById(itemId)?.ambiente || null;
/**
 * De quién es la mesa ahora: en la partida, del que tiene el turno (h.turn); antes de repartir o sin partida, de nadie.
 * game: lo que manda la sala (viewFor) o el estado completo del motor.
 */
export const tableOwner = (game) => (game?.h && Number.isInteger(game.h.turn) ? game.h.turn : null);
/**
 * Cómo se ve la mesa: el paño y el mazo del dueño de la mesa (tableOwner: el que tiene el turno; sin dueño, en la sala
 * de espera, los del anfitrión). El mapa (el fondo) no cambia con el turno: es el que eligió la sala (ambiente), el
 * mismo para todos, salvo que tengas uno puesto: ese lo ves vos (me: tu asiento, o null si mirás).
 */
export function tableLook(seats, { owner = null, me = null, ambiente = 'bar', host = null } = {}) {
  const cosOf = (s) => (s != null && seats[s] ? seats[s].cos || {} : {});
  const who = owner != null ? cosOf(owner) : host != null ? cosOf(host) : {};
  const mine = cosOf(me);
  return {
    pano: who.pano || null,
    dorso: who.dorso || null,
    ambiente: mapaAmbiente(mine.mapa) || ambiente,
  };
}
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
  { key: 'picapica', def: false, modes: ['3v3'], label: 'Jugar pica-pica (una mano redonda y una mano a mano contra el de enfrente)', short: 'con pica-pica' },
];
// ¿La opción sirve en este modo? (`modes`: solo en esos; el pica-pica es de 3 vs 3)
export const optionForMode = (o, mode) => !o.modes || !mode || o.modes.includes(mode);
// Opciones válidas a partir de lo que mande el cliente (lo que falte o no sea booleano, por defecto).
export const roomOptions = (src) => Object.fromEntries(ROOM_OPTIONS.map((o) => [o.key, typeof src?.[o.key] === 'boolean' ? src[o.key] : o.def]));
// Texto corto para mostrar las opciones activas ("con flor · sin trampas").
export const roomOptionsText = (cfg) => ROOM_OPTIONS.filter((o) => cfg[o.key] !== o.def && optionForMode(o, cfg.mode)).map((o) => o.short).join(' · ');
