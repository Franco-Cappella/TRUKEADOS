// Configuración COMPARTIDA entre el servidor (Durable Object) y el navegador.
// Todo número mágico de reglas, tiempos o rutas va acá: si lo cambiás, cambia en los dos lados.
// No importa nada ni toca el DOM.

// ------------------------------------------------------------------ marca
export const APP_NAME = 'Trukeados';

// ------------------------------------------------------------------ partida
export const MODES = { '1v1': 2, '2v2': 4, '3v3': 6 };
export const DEFAULT_MODE = '1v1';
export const TARGETS = [15, 30]; // a cuántos puntos se juega
export const DEFAULT_TARGET = 30;
export const MAX_NAME = 20;
export const MAX_CHAT_TEXT = 280;
export const MAX_CHAT_HISTORY = 120;
export const ROOM_CODE_LEN = 5;

// ------------------------------------------------------------------ rutas
export const ROUTES = {
  room: (code) => `/sala/${code}`, // enlace para compartir
  roomRe: /^\/sala\/([A-Za-z0-9]{5})/,
  home: '/',
  api: {
    rooms: '/api/rooms',
    room: (code) => `/api/rooms/${code}`,
    ws: (code) => `/api/rooms/${code}/ws`,
    quick: '/api/quick',
    lobby: '/api/lobby',
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
  handPause: 4200, // pausa para ver cómo terminó la mano
  showWindow: 15_000, // tiempo para mostrar los tantos o reclamar
  foldWindow: 6000, // si el que ganó el envido se va al mazo sin mostrar, lo que les queda a los rivales para reclamar
  afk: 40_000, // humano desconectado: después de esto juega el bot por él
  botThinkMin: 650, // los bots "piensan" entre 0,65 y 1,3 s: ni instantáneo ni lento
  botThinkRand: 650,
  botHeartbeat: 2500, // latido para las miradas de los bots
};
// Duración total de mezclar + cortar + repartir n jugadores (3 cartas cada uno).
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

export const BOT_NAMES = ['Tito', 'Coca', 'El Ruso', 'Chacho', 'Pocha', 'Beto', 'Nené', 'Cacho', 'Mirta', 'Pirulo', 'Tota', 'Rulo'];

// ------------------------------------------------------------------ validación
export const PID_RE = /^[A-Za-z0-9_-]{8,64}$/;
export const CODE_RE = /^[A-Z0-9]{5}$/;

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
