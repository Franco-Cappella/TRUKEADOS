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

// Sin I, O, 0 ni 1 para que no se confundan al dictarlo.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newRoomCode(len = ROOM_CODE_LEN) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

// Número al azar en [0, 1) con el generador seguro de la plataforma.
export const rng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
