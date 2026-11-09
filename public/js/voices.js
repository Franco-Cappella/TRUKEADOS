// Voces grabadas: cada frase conocida (cantos, números, frases de los bots) ya está generada como audio en
// public/voz/<voz>/<clave>.mp3 (ver tools/generate-voices.mjs). Sin DOM: lo usan el navegador y la herramienta.

export const VOICES = ['davefx']; // la voz grabada: de hombre, española
export const VOICE_URL = (voice, key) => `/voz/${voice}/${key}.mp3`;
export const VOICE_MANIFEST = '/voz/manifest.json';

// Se alternan por asiento: la grabada de hombre, y (null) la voz de mujer del dispositivo.
export const voiceFor = (seat) => ((seat ?? 0) % 2 === 0 ? VOICES[0] : null);

const WOMAN = /helena|laura|sabina|elena|paulina|m[oó]nica|dalia|elvira|sof[ií]a|luc[ií]a|catalina|camila|female|mujer/i;
const MAN = /pablo|ra[uú]l|jorge|diego|tom[aá]s|[aá]lvaro|juan|carlos|\bmale\b/i;

/** La voz de mujer del dispositivo: en español y, si hay, una que no sea de hombre. */
export function womanVoice(voices) {
  const es = voices.filter((v) => v.lang?.toLowerCase().startsWith('es'));
  return es.find((v) => WOMAN.test(v.name)) || es.find((v) => !MAN.test(v.name)) || es[0] || null;
}

// Misma frase, mismo audio: sin importar mayúsculas ni signos.
export const voiceText = (text) => String(text ?? '').toLowerCase().replace(/[¡!¿?.,;:…"'()«»]/g, ' ').replace(/\s+/g, ' ').trim();

export function voiceKey(text) {
  let h = 2166136261;
  for (const ch of voiceText(text)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return (h >>> 0).toString(36);
}
