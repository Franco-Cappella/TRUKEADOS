// Ayudas chicas del navegador: selectores, escape de HTML, preferencias guardadas y API.
import { PID_RE } from './config.js';

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
  pid: 'truco-pid',
  name: 'truco-name',
  voice: 'truco-voice',
  zoomTip: 'truco-zoom-tip',
  spectate: 'truco-spectate', // sessionStorage
  autostart: 'truco-autostart', // sessionStorage
};

// Identificador anónimo y estable de este navegador (el servidor lo usa para el asiento).
export function myPid() {
  let p = store.get(KEYS.pid);
  if (!p || !PID_RE.test(p)) {
    p = (crypto.randomUUID?.() || String(Math.random()).slice(2) + Date.now()).replace(/-/g, '');
    store.set(KEYS.pid, p);
  }
  return p;
}

export const savedName = () => store.get(KEYS.name) || 'Invitado';

// Lee una vez y borra (para pasar un dato de una pantalla a otra).
export function takeSession(key, value) {
  const hit = sessionStorage.getItem(key) === value;
  sessionStorage.removeItem(key);
  return hit;
}

export async function api(path, body) {
  const opts = body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {};
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error de conexión');
  return data;
}
