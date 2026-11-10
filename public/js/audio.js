// Sonidos sintetizados (sin archivos) y voz que canta los cantos.
import { store, KEYS } from './dom.js';
import { RECORDED_VOICE_GAIN } from './config.js';
import { VOICES, voiceFor, womanVoice, manVoice, VOICE_MANIFEST, VOICE_URL, voiceKey } from './voices.js';

let actx = null;
let sfxOn = store.get(KEYS.sfx, '1') === '1';
export const isSfxOn = () => sfxOn;
export function toggleSfx() {
  sfxOn = !sfxOn;
  store.set(KEYS.sfx, sfxOn ? '1' : '0');
  return sfxOn;
}
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
  if (!a || !sfxOn) return;
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
  if (!a || !sfxOn) return;
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
let volume = Math.max(0, Math.min(1, Number(store.get(KEYS.voiceVol, '1')) || 0));
export const voiceVolume = () => volume;
export function setVoiceVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  store.set(KEYS.voiceVol, String(volume));
}
export function toggleVoice() {
  voiceOn = !voiceOn;
  store.set(KEYS.voice, voiceOn ? '1' : '0');
  if (!voiceOn) {
    queue.length = 0;
    current?.stop();
    current = null;
  }
  return voiceOn;
}

// La voz que eligió cada jugador (Configuración). Quien no eligió, según el asiento.
let myGender = store.get(KEYS.voiceGender, '');
export const myVoice = () => myGender;
export function setMyVoice(v) {
  myGender = v === 'm' || v === 'f' ? v : '';
  store.set(KEYS.voiceGender, myGender);
}
// Para probarla en Ajustes.
export function previewVoice() {
  hush(true);
  say('Truco', null, { gender: myGender || 'm' });
}
let seatVoices = [];
export function setSeatVoices(seats) {
  seatVoices = seats.map((s) => s?.voice || null);
}
const genderOf = (seat) => seatVoices[seat] || (voiceFor(seat) ? 'm' : 'f');

// La voz de mujer y lo que no tiene audio grabado salen con las voces del dispositivo.
function deviceVoice(gender) {
  const all = speechSynthesis.getVoices();
  return (gender === 'm' && manVoice(all)) || womanVoice(all);
}

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
  item.start(done);
}

// Se calla la charla (lo que está diciendo y lo que esperaba): pasó algo en la mesa y ya no viene al caso.
// all: también los cantos (jugaste vos: lo tuyo se dice ya, sin esperar a que terminen los demás).
export function hush(all = false) {
  for (let i = queue.length - 1; i >= 0; i--) if (all || queue[i].chat) queue.splice(i, 1);
  if (current && (all || current.chat)) {
    const was = current;
    current = null;
    was.stop();
    pump();
  }
}

// Los audios que existen (public/voz): lo que no esté acá (lo que escribe cada uno) sale con la voz del dispositivo.
let clips = null;
function loadClips() {
  if (clips) return;
  clips = new Set();
  fetch(VOICE_MANIFEST).then((r) => r.json()).then((m) => m.keys.forEach((k) => clips.add(k))).catch(() => {});
}
loadClips();

function clipItem(key, voice) {
  const a = new Audio(VOICE_URL(voice, key));
  a.volume = volume * RECORDED_VOICE_GAIN;
  return {
    start(done) {
      a.onended = done;
      a.onerror = done;
      a.play().catch(done);
    },
    stop() {
      a.onended = a.onerror = null;
      a.pause();
    },
  };
}

function speechItem(text, gender) {
  const u = new SpeechSynthesisUtterance(text);
  u.voice = deviceVoice(gender);
  u.lang = u.voice?.lang || 'es-AR';
  u.rate = 1;
  u.volume = volume;
  return {
    start(done) {
      u.onend = done;
      u.onerror = done;
      speechSynthesis.speak(u);
    },
    stop() {
      u.onend = u.onerror = null;
      try {
        speechSynthesis.cancel();
      } catch {}
    },
  };
}

// chat: es charla (se descarta si pasa algo en la mesa antes de decirla); si no, es un canto.
export function say(text, seat = null, { chat = false, gender = null } = {}) {
  if (!voiceOn) return;
  try {
    const key = voiceKey(text);
    const g = gender || genderOf(seat);
    const item = g === 'm' && clips?.has(key) ? clipItem(key, VOICES[0]) : window.speechSynthesis ? speechItem(text, g) : null;
    if (!item) return;
    if (!chat) hush(); // un canto corta la charla
    queue.push(Object.assign(item, { chat, at: Date.now() }));
    pump();
  } catch {}
}
