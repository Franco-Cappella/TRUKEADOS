// Utilidades del servidor (validación de entradas y respuestas JSON).
import { MAX_NAME, PID_RE, ROOM_CODE_LEN } from '../public/js/config.js';

export function cleanName(name) {
  const s = String(name ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, MAX_NAME);
  return s || 'Invitado';
}

export function cleanPid(pid) {
  const s = String(pid ?? '');
  return PID_RE.test(s) ? s : null;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

// Código de sala: solo dígitos (ej. "4827"), para pasarlo de palabra o tipearlo con el teclado numérico.
export function newRoomCode(len = ROOM_CODE_LEN) {
  return Array.from(crypto.getRandomValues(new Uint32Array(len)), (n) => n % 10).join('');
}

// Número al azar en [0, 1) con el generador seguro de la plataforma.
export const rng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
