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
  return voiceOn;
}

export function say(text) {
  if (!voiceOn || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    u.voice = voices.find((v) => v.lang === 'es-AR') || voices.find((v) => v.lang?.startsWith('es')) || null;
    u.lang = u.voice?.lang || 'es-AR';
    u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch {}
}
