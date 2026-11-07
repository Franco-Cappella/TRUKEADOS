// Sonidos sintetizados (sin archivos) y voz que canta los cantos.
import { store, KEYS } from './dom.js';

let actx = null;
// El AudioContext se crea con el primer gesto del usuario (los navegadores lo exigen).
export function audio() {
  if (!actx) {
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {}
  }
  return actx;
}

// Ruido corto filtrado: una carta que cae en el paño.
export function flick(vol = 0.25, dur = 0.07) {
  const a = audio();
  if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 2400;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

// "Te toca".
export function ding() {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.frequency.value = 880;
  g.gain.setValueAtTime(0.12, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.35);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + 0.4);
}

let voiceOn = store.get(KEYS.voice, '1') === '1';
export const isVoiceOn = () => voiceOn;
export function toggleVoice() {
  voiceOn = !voiceOn;
  store.set(KEYS.voice, voiceOn ? '1' : '0');
  if (!voiceOn) {
    queue.length = 0;
    current = null;
    window.speechSynthesis?.cancel();
  }
  return voiceOn;
}

// Voz de cada asiento: el tono cambia para que cada uno suene distinto (y, si hay varias voces en
// español, cada asiento usa otra).
const PITCHES = [1, 0.8, 1.25, 0.9, 1.15, 0.7];
const CHAT_STALE_MS = 4000; // una frase de charla que no llegó a decirse en este tiempo ya no se dice

// Cola propia: el navegador solo tiene la frase que está diciendo, así se puede descartar la charla vieja
// sin cortar los cantos. Los cantos (chat = false) se dicen siempre y antes que la charla.
const queue = [];
let current = null;

function pump() {
  if (current || !queue.length) return;
  const now = Date.now();
  while (queue.length && queue[0].chat && now - queue[0].at > CHAT_STALE_MS) queue.shift();
  const item = queue.shift();
  if (!item) return;
  current = item;
  const done = () => {
    if (current !== item) return;
    current = null;
    pump();
  };
  item.u.onend = done;
  item.u.onerror = done;
  speechSynthesis.speak(item.u);
}

// Se calla la charla (lo que está diciendo y lo que esperaba): pasó algo en la mesa y ya no viene al caso.
export function hush() {
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].chat) queue.splice(i, 1);
  if (current?.chat) {
    current = null;
    try {
      speechSynthesis.cancel();
    } catch {}
    pump();
  }
}

// chat: es charla (se descarta si pasa algo en la mesa antes de decirla); si no, es un canto.
export function say(text, seat = null, { chat = false } = {}) {
  if (!voiceOn || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    const es = voices.filter((v) => v.lang?.startsWith('es'));
    const ar = es.filter((v) => v.lang === 'es-AR');
    const pool = ar.length ? ar : es;
    u.voice = (seat != null && pool.length ? pool[seat % pool.length] : pool[0]) || null;
    u.lang = u.voice?.lang || 'es-AR';
    u.rate = 1.05;
    if (seat != null) u.pitch = PITCHES[seat % PITCHES.length];
    if (!chat) hush(); // un canto corta la charla
    queue.push({ u, chat, at: Date.now() });
    pump();
  } catch {}
}
