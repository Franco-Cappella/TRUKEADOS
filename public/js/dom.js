// Ayudas chicas del navegador: selectores, escape de HTML, preferencias guardadas y API.

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => el.querySelectorAll(s);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

// localStorage que no explota en modo privado.
export const store = {
  get(k, d) {
    try {
      return localStorage.getItem(k) ?? d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
  del(k) {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};

// Claves de lo que se guarda en el navegador (un solo lugar para no pisarse).
export const KEYS = {
  name: 'truco-name', // el nombre del perfil (lo pone auth.js al iniciar sesión)
  voice: 'truco-voice',
  teamInvite: 'truco-team-invite', // sessionStorage: la mesa a la que te invitaron a su equipo
  activeRoom: 'truco-active-room', // la partida en la que estás sentado (para el cartel de reconectar)
  voiceVol: 'truco-voice-volume',
  cardLabels: 'truco-card-labels', // 0: sin cartelito al tirar una carta
  lowGfx: 'truco-low-gfx', // 1: gráficos livianos
  voiceGender: 'truco-voice-gender', // la voz con la que hablás en la mesa: m, f o vacío (según el asiento)
  sfx: 'truco-sfx',
  entered: 'truco-entered', // sessionStorage: la mesa cuyas reglas ya viste
  zoomTip: 'truco-zoom-tip',
  spectate: 'truco-spectate', // sessionStorage
  autostart: 'truco-autostart', // sessionStorage
  lastMode: 'truco-last-mode', // último modo elegido (para armar la mesa)
  camMode: 'truco-cam-mode', // vista: first, back o front
  muted: 'truco-muted',
  dmRead: 'truco-dm-read', // hasta dónde leíste el chat con cada amigo (JSON id -> fecha)
  invisible: 'truco-invisible', // 1: no avisar que estás conectado (los amigos te ven desconectado)
  noteMsgs: 'truco-note-msgs', // 0: sin aviso de mensaje nuevo de un amigo
  noteReqs: 'truco-note-reqs', // 0: sin carteles de solicitudes de amistad
  lessMotion: 'truco-less-motion', // 1: menos animaciones
  bigText: 'truco-big-text', // 1: letra más grande
  creatorLater: 'truco-creator-later', // 1: al registrarte dijiste "Después" en el creador de personaje (no se vuelve a abrir solo)
  friendSeen: 'truco-friend-seen', // solicitudes de amistad a las que dijiste "Ahora no" (JSON de ids) // nombres de usuario silenciados en el chat (JSON)
};

export const savedName = () => store.get(KEYS.name) || 'Invitado';

// Primera letra de un nombre para los avatares (sin escapar: el que la pone en innerHTML usa esc()).
export const initial = (name) => [...String(name ?? '').trim()][0]?.toUpperCase() || '?';

// Foto de perfil, o la inicial si no tiene. p: { name o username, avatar }. Devuelve HTML ya escapado.
// Sin foto: la silueta de siempre (la misma para todos los que no subieron una).
export const DEFAULT_AVATAR = '/img/avatar.svg';
export function avatarHtml(p, cls = '') {
  return `<img class="w-av photo ${cls}" src="${esc(p?.avatar || DEFAULT_AVATAR)}" alt="" loading="lazy">`;
}

// Lee una vez y borra (para pasar un dato de una pantalla a otra).
export function takeSession(key, value) {
  const hit = sessionStorage.getItem(key) === value;
  sessionStorage.removeItem(key);
  return hit;
}

// Token de la sesión para los pedidos (lo configura auth.js; así dom.js no depende de Supabase).
let getToken = async () => null;
export const setTokenGetter = (fn) => (getToken = fn);
export const sessionToken = () => getToken();

// Pedido a /api con la sesión. Un 401 avisa con un evento para que main.js vuelva a la pantalla de entrada.
export async function api(path, body) {
  const token = await getToken();
  const headers = { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) };
  const res = await fetch(path, body ? { method: 'POST', headers, body: JSON.stringify(body) } : { headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) dispatchEvent(new Event('trukeados:logout'));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Error de conexión'), { status: res.status });
  return data;
}
