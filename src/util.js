// Utilidades del servidor (validación de entradas y respuestas JSON).
import { MAX_NAME, ROOM_CODE_LEN } from '../public/js/config.js';

export function cleanName(name) {
  const s = String(name ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, MAX_NAME);
  return s || 'Invitado';
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

// Código de sala: solo dígitos (ej. "4827"), para pasarlo de palabra o tipearlo con el teclado numérico.
export function newRoomCode(len = ROOM_CODE_LEN) {
  // nunca empieza con 9: esos códigos son de las mesas en juego del lobby (SHOW_TABLES)
  return Array.from(crypto.getRandomValues(new Uint32Array(len)), (n, i) => n % (i ? 10 : 9)).join('');
}

// El cuerpo JSON de un pedido: siempre un objeto ({} si no vino, no es JSON o es otra cosa, como null o un número).
export async function readBody(request) {
  const body = await request.json().catch(() => null);
  return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
}

// La respuesta de una acción que devuelve { error } o el resultado: 400 con el error, o el resultado.
export const reply = (r) => (r.error ? json({ error: r.error }, 400) : json(r));

// Id de una cuenta o de una partida (uuid).
export const UUID_RE = /^[0-9a-f-]{36}$/;

// Número al azar en [0, 1) con el generador seguro de la plataforma.
export const rng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
