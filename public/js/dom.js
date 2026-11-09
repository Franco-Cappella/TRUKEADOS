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
};

// Claves de lo que se guarda en el navegador (un solo lugar para no pisarse).
export const KEYS = {
  name: 'truco-name', // el nombre del perfil (lo pone auth.js al iniciar sesión)
  voice: 'truco-voice',
  teamInvite: 'truco-team-invite', // sessionStorage: la mesa a la que te invitaron a su equipo
  activeRoom: 'truco-active-room', // la partida en la que estás sentado (para el cartel de reconectar)
  voiceVol: 'truco-voice-volume',
  sfx: 'truco-sfx',
  entered: 'truco-entered', // sessionStorage: la mesa cuyas reglas ya viste
  zoomTip: 'truco-zoom-tip',
  spectate: 'truco-spectate', // sessionStorage
  autostart: 'truco-autostart', // sessionStorage
  lastMode: 'truco-last-mode', // último modo elegido (para armar la mesa)
};

export const savedName = () => store.get(KEYS.name) || 'Invitado';

// Primera letra de un nombre para los avatares (sin escapar: el que la pone en innerHTML usa esc()).
export const initial = (name) => [...String(name ?? '').trim()][0]?.toUpperCase() || '?';

// Foto de perfil, o la inicial si no tiene. p: { name o username, avatar }. Devuelve HTML ya escapado.
export function avatarHtml(p, cls = '') {
  const name = p?.username ?? p?.name;
  return p?.avatar
    ? `<img class="w-av photo ${cls}" src="${esc(p.avatar)}" alt="" loading="lazy">`
    : `<span class="w-av ${cls}">${esc(initial(name))}</span>`;
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
