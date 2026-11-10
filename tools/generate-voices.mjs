// Genera los audios de public/voz con voces libres de Piper. Solo hace falta correrlo si cambian las frases.
//   node tools/generate-voices.mjs <carpeta con sherpa-onnx-node y ffmpeg-static> <carpeta con los modelos>
// Modelo: vits-piper-es_ES-davefx-medium, de
// https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models (licencias en public/voz/LICENCIAS.txt).
// Lo que ya existe no se vuelve a generar.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { BOT_TALK, ASK_TALK, TELL_TANTOS, PHRASE_WHEEL } from '../public/js/talk.js';
import { TRUCO_NAMES, ENVIDO_NAMES, FLOR_NAMES } from '../public/js/engine.js';
import { VOICES, voiceKey, voiceText } from '../public/js/voices.js';

const [toolsDir, modelsDir] = process.argv.slice(2);
if (!toolsDir || !modelsDir) throw new Error('Uso: node tools/generate-voices.mjs <tools> <modelos>');
const require = createRequire(path.resolve(toolsDir, 'x.js'));
process.env.PATH = `${path.resolve(toolsDir, 'node_modules/sherpa-onnx-win-x64')};${process.env.PATH}`;
const sherpa = require('sherpa-onnx-node');
const ffmpeg = require('ffmpeg-static');

const MODEL = { davefx: 'es_ES-davefx-medium' };
const OUT = path.resolve('public/voz');

// ---- todas las frases que el juego puede decir
const flat = (x) => (typeof x === 'string' ? [x] : Array.isArray(x) ? x.flatMap(flat) : x && typeof x === 'object' ? Object.values(x).flatMap(flat) : []);
const phrases = flat(BOT_TALK);
phrases.push(...PHRASE_WHEEL.flatMap((c) => c.phrases), ...flat(ASK_TALK), ...TELL_TANTOS, ...flat(TRUCO_NAMES), ...flat(ENVIDO_NAMES), ...flat(FLOR_NAMES));
phrases.push('Me voy al mazo', 'Nos vamos al mazo', '¡Mirá lo que tenía!', 'Quiero', 'No quiero', 'Son buenas', 'A ver, mostrá las dos', '¡No mostraste!', 'Truco', 'Envido', 'Real envido', 'Falta envido', 'Flor');
for (let n = 0; n <= 39; n++) phrases.push(String(n), `${n} en mesa`, `¡Cantaste ${n}!`);

const byKey = new Map();
for (const p of phrases) {
  const k = voiceKey(p);
  const prev = byKey.get(k);
  if (prev && voiceText(prev) !== voiceText(p)) throw new Error(`Choque de claves: ${prev} / ${p}`);
  if (!prev) byKey.set(k, p);
}
console.log(`${byKey.size} frases`);

// Cómo se le pasa el texto a la voz. Una palabra sola sin signos sale estirada o cortada: los cantos van con exclamación
// y los números, escritos.
const UNITS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve', 'treinta'];
const numberWords = (n) => (n <= 30 ? UNITS[n] : `treinta y ${UNITS[n - 30]}`);
function speakable(text) {
  const t = text.replace(/\d+/g, (d) => numberWords(Number(d))).trim();
  if (/[.!?…]$/.test(t)) return t;
  return /^\S+( \S+){0,2}$/.test(t) && !/\d/.test(text) ? `¡${t}!` : `${t}.`;
}

const SPEED = { davefx: 1 };
const PAD_START = 0.12; // segundos de silencio: algunos reproductores se comen el principio
const PAD_END = 0.16;
const PEAK = 0.8; // todas las voces al mismo volumen y sin saturar

// Mismo volumen para todos los audios, con un margen de silencio a cada lado.
function master(samples, rate) {
  let peak = 1e-6;
  for (const x of samples) peak = Math.max(peak, Math.abs(x));
  const gain = PEAK / peak;
  const start = Math.round(PAD_START * rate);
  const out = new Float32Array(start + samples.length + Math.round(PAD_END * rate));
  samples.forEach((x, i) => (out[start + i] = x * gain));
  return out;
}

function engine(voice) {
  const dir = path.resolve(modelsDir, `vits-piper-${MODEL[voice]}`);
  return new sherpa.OfflineTts({
    model: { vits: { model: path.join(dir, `${MODEL[voice]}.onnx`), tokens: path.join(dir, 'tokens.txt'), dataDir: path.join(dir, 'espeak-ng-data'), lengthScale: 1.05, noiseScale: 0.667, noiseW: 0.8 }, numThreads: 4, provider: 'cpu', debug: false },
    maxNumSentences: 1,
  });
}

for (const voice of VOICES) {
  fs.mkdirSync(path.join(OUT, voice), { recursive: true });
  const tts = engine(voice);
  let made = 0;
  for (const [key, text] of byKey) {
    const file = path.join(OUT, voice, `${key}.mp3`);
    if (fs.existsSync(file)) continue;
    const audio = tts.generate({ text: speakable(text), sid: 0, speed: SPEED[voice] });
    const clean = master(audio.samples, audio.sampleRate);
    const pcm = Buffer.from(clean.buffer, clean.byteOffset, clean.byteLength);
    const r = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'f32le', '-ar', String(audio.sampleRate), '-ac', '1', '-i', 'pipe:0', '-ar', '22050', '-ac', '1', '-b:a', '32k', file], { input: pcm, maxBuffer: 1 << 26 });
    if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr}`);
    if (++made % 50 === 0) console.log(voice, made);
  }
  // lo que ya no se usa, se borra
  for (const f of fs.readdirSync(path.join(OUT, voice))) if (!byKey.has(f.replace('.mp3', ''))) fs.rmSync(path.join(OUT, voice, f));
  console.log(voice, 'listo', made);
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ keys: [...byKey.keys()] }));
fs.writeFileSync(path.join(OUT, 'LICENCIAS.txt'), `Voz generada con Piper (https://github.com/rhasspy/piper) y sherpa-onnx.

davefx (es_ES): https://github.com/OHF-Voice/voice-datasets - CC0.
`);
console.log('total listo');
