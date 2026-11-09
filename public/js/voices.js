// Voces grabadas: cada frase conocida (cantos, números, frases de los bots) ya está generada como audio en
// public/voz/<voz>/<clave>.mp3 (ver tools/generate-voices.mjs). Sin DOM: lo usan el navegador y la herramienta.

export const VOICES = ['daniela', 'ald', 'davefx']; // argentina, mexicana y española
export const VOICE_URL = (voice, key) => `/voz/${voice}/${key}.mp3`;
export const VOICE_MANIFEST = '/voz/manifest.json';

// Qué voz usa cada asiento y con qué velocidad (cambia también el tono): así suenan todos distintos.
export const VOICE_CAST = [['daniela', 1], ['ald', 1], ['davefx', 1], ['daniela', 0.93], ['ald', 1.07], ['davefx', 0.93]];

// Misma frase, mismo audio: sin importar mayúsculas ni signos.
export const voiceText = (text) => String(text ?? '').toLowerCase().replace(/[¡!¿?.,;:…"'()«»]/g, ' ').replace(/\s+/g, ' ').trim();

export function voiceKey(text) {
  let h = 2166136261;
  for (const ch of voiceText(text)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return (h >>> 0).toString(36);
}
