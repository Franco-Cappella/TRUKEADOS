// Genera los audios de public/voz con voces libres de Piper. Solo hace falta correrlo si cambian las frases.
//   node tools/generate-voices.mjs <carpeta con sherpa-onnx-node y ffmpeg-static> <carpeta con los modelos>
// Modelos: vits-piper-es_AR-daniela-high, -es_MX-ald-medium y -es_ES-davefx-medium, de
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

const MODEL = { daniela: 'es_AR-daniela-high', ald: 'es_MX-ald-medium', davefx: 'es_ES-davefx-medium' };
const OUT = path.resolve('public/voz');

// ---- todas las frases que el juego puede decir
const flat = (x) => (typeof x === 'string' ? [x] : Array.isArray(x) ? x.flatMap(flat) : x && typeof x === 'object' ? Object.values(x).flatMap(flat) : []);
const CANTOS = { strongCall: ['Truco', 'Retruco', 'Vale cuatro'], humbleCall: ['Truco', 'Retruco', 'Vale cuatro'], raise: ['Retruco', 'Vale cuatro'], envidoStrong: ['Envido', 'Real envido'], envidoHumble: ['Envido', 'Real envido'] };
const phrases = [];
for (const [key, list] of Object.entries(BOT_TALK)) {
  for (const t of flat(list)) {
    if (t.includes('{')) for (const c of CANTOS[key] || []) phrases.push(t.replace(/{C}/g, c).replace(/{c}/g, c.toLowerCase()));
    else phrases.push(t);
  }
}
phrases.push(...PHRASE_WHEEL.flatMap((c) => c.phrases), ...flat(ASK_TALK), ...TELL_TANTOS, ...flat(TRUCO_NAMES), ...flat(ENVIDO_NAMES), ...flat(FLOR_NAMES));
phrases.push('Quiero', 'No quiero', 'Son buenas', 'A ver, mostrá las dos', '¡No mostraste!', 'Truco', 'Envido', 'Real envido', 'Falta envido', 'Flor');
for (let n = 0; n <= 39; n++) phrases.push(String(n), `${n} en mesa`, `¡Cantaste ${n}!`);

const byKey = new Map();
for (const p of phrases) {
  const k = voiceKey(p);
  const prev = byKey.get(k);
  if (prev && voiceText(prev) !== voiceText(p)) throw new Error(`Choque de claves: ${prev} / ${p}`);
  if (!prev) byKey.set(k, p);
}
console.log(`${byKey.size} frases`);

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
    const audio = tts.generate({ text, sid: 0, speed: 1 });
    const pcm = Buffer.from(audio.samples.buffer, audio.samples.byteOffset, audio.samples.byteLength);
    const r = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'f32le', '-ar', String(audio.sampleRate), '-ac', '1', '-i', 'pipe:0', '-ar', '22050', '-ac', '1', '-b:a', '32k', file], { input: pcm, maxBuffer: 1 << 26 });
    if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr}`);
    if (++made % 50 === 0) console.log(voice, made);
  }
  console.log(voice, 'listo', made);
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ keys: [...byKey.keys()] }));
fs.writeFileSync(path.join(OUT, 'LICENCIAS.txt'), `Voces generadas con Piper (https://github.com/rhasspy/piper) y sherpa-onnx.

daniela (es_AR): modelo de Piper entrenado con el corpus de habla argentina OpenSLR SLR61,
  https://www.openslr.org/61/ - licencia CC BY-SA 4.0. Estos audios se distribuyen bajo la misma licencia.
ald (es_MX): https://huggingface.co/datasets/rmcpantoja/Ald_Mexican_Spanish_speech_dataset - Unlicense.
davefx (es_ES): https://github.com/OHF-Voice/voice-datasets - CC0.
`);
console.log('total listo');
