// Sincroniza la documentación de diseño entre TRUKEADOS (el juego) y trukeados-landing, en los dos sentidos.
// Se sincronizan DESIGN.md, brand/ (todo) y docs/landing/. Este script viaja con esos archivos: está igual en los dos repos.
//
//   npm run diseno:sync                 copia lo que cambió de un lado al otro
//   npm run diseno:sync -- --check      solo informa; sale con 1 si hay algo pendiente o un conflicto
//   node brand/tools/sync-diseno.mjs --init
//                                       primera vez: copia este repo sobre el otro y registra el estado común
//   node brand/tools/sync-diseno.mjs ../ruta
//                                       si el otro repo no está al lado con su nombre
//
// Conflicto: si un mismo archivo cambió en los dos repos desde la última sincronización, no se toca y se avisa.
// Se igualan a mano (o se copia una versión a los dos) y se vuelve a correr.
//
// Registro: .diseno-sync.json en la raíz de cada repo, con el estado común de la última sincronización.
// Lo escribe el script y se commitea junto con los cambios. No editar a mano.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SETS = ['DESIGN.md', 'brand', 'docs/landing'];
const REGISTRO = '.diseno-sync.json';

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const INIT = args.includes('--init');
const RUTA = args.find((a) => !a.startsWith('--'));

const NOMBRE_A = path.basename(ROOT);
const NOMBRE_OTRO = NOMBRE_A.toLowerCase().includes('landing') ? 'trukeados' : 'trukeados-landing';

function encontrarOtro() {
  if (RUTA) return path.resolve(RUTA);
  const padre = path.dirname(ROOT);
  const hit = fs.readdirSync(padre).find((n) => n.toLowerCase() === NOMBRE_OTRO);
  if (!hit) {
    console.error(`No encuentro "${NOMBRE_OTRO}" al lado de ${NOMBRE_A}. Pasá la ruta: node brand/tools/sync-diseno.mjs ../ruta`);
    process.exit(2);
  }
  return path.join(padre, hit);
}

const OTRO = encontrarOtro();
const NOMBRE_B = path.basename(OTRO);

// Archivos de la documentación, con ruta relativa y "/" como separador.
function archivos(base, rel = '') {
  const abs = path.join(base, rel);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return [rel.split(path.sep).join('/')];
  return fs.readdirSync(abs).sort().flatMap((n) => archivos(base, path.join(rel, n)));
}
const documentacion = (base) => SETS.flatMap((s) => archivos(base, s)).sort();

const hashArchivo = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const hashDe = (base, rel) => (fs.existsSync(path.join(base, rel)) ? hashArchivo(path.join(base, rel)) : null);

function leerRegistro(base) {
  const f = path.join(base, REGISTRO);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).archivos : null;
}
function ordenar(obj) {
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
}
function escribirRegistro(base, hashes) {
  const contenido = {
    nota: 'Estado común de la documentación de diseño tras la última sincronización. Lo escribe brand/tools/sync-diseno.mjs; no editar a mano.',
    archivos: ordenar(hashes),
  };
  fs.writeFileSync(path.join(base, REGISTRO), JSON.stringify(contenido, null, 2) + '\n');
}

function copiar(desde, hacia) {
  fs.mkdirSync(path.dirname(hacia), { recursive: true });
  fs.copyFileSync(desde, hacia);
}
function borrar(base, rel) {
  const f = path.join(base, rel);
  fs.rmSync(f, { force: true });
  let dir = path.dirname(f);
  while (dir.startsWith(base) && dir !== base && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
    dir = path.dirname(dir);
  }
}

// --init: primera vez. Este repo es la copia buena: se copia sobre el otro y se registra el estado común.
if (INIT) {
  if (leerRegistro(ROOT) || leerRegistro(OTRO)) {
    console.error(`Ya hay registro de sincronización (${REGISTRO}). --init es solo para la primera vez.`);
    process.exit(2);
  }
  const lista = documentacion(ROOT);
  for (const rel of documentacion(OTRO)) if (!lista.includes(rel)) borrar(OTRO, rel);
  for (const rel of lista) copiar(path.join(ROOT, rel), path.join(OTRO, rel));
  const registro = Object.fromEntries(lista.map((rel) => [rel, hashDe(ROOT, rel)]));
  escribirRegistro(ROOT, registro);
  escribirRegistro(OTRO, registro);
  console.log(`Listo: ${lista.length} archivos copiados de ${NOMBRE_A} a ${NOMBRE_B}. Registro escrito en los dos.`);
  process.exit(0);
}

const base = leerRegistro(ROOT);
const baseOtro = leerRegistro(OTRO);
if (!base || !baseOtro) {
  console.error(`Falta ${REGISTRO} en uno de los repos. Corré una sola vez, desde el repo que tiene la versión buena: node brand/tools/sync-diseno.mjs --init`);
  process.exit(2);
}
if (JSON.stringify(ordenar(base)) !== JSON.stringify(ordenar(baseOtro))) {
  console.error(`Los registros de ${NOMBRE_A} y ${NOMBRE_B} no coinciden. Revisá ${REGISTRO} en los dos antes de seguir.`);
  process.exit(2);
}

// Para cada archivo: comparo lo que hay en cada repo con lo que había en la última sincronización.
const rutas = [...new Set([...documentacion(ROOT), ...documentacion(OTRO), ...Object.keys(base)])].sort();
const acciones = [];
for (const rel of rutas) {
  const hA = hashDe(ROOT, rel);
  const hB = hashDe(OTRO, rel);
  const hBase = base[rel] ?? null;
  if (hA === hB) acciones.push({ rel, op: 'igual', hash: hA });
  else if (hA === hBase) acciones.push({ rel, op: 'desdeOtro', hash: hB }); // cambió solo en el otro repo
  else if (hB === hBase) acciones.push({ rel, op: 'desdeAca', hash: hA });  // cambió solo en este repo
  else acciones.push({ rel, op: 'conflicto' });                             // cambió en los dos
}

const pendientes = acciones.filter((a) => a.op === 'desdeAca' || a.op === 'desdeOtro');
const conflictos = acciones.filter((a) => a.op === 'conflicto');

if (CHECK) {
  for (const a of pendientes) {
    const sentido = a.op === 'desdeAca' ? `${NOMBRE_A} → ${NOMBRE_B}` : `${NOMBRE_B} → ${NOMBRE_A}`;
    console.log(`pendiente: ${a.rel} (${sentido})${a.hash === null ? ' [borrado]' : ''}`);
  }
  for (const a of conflictos) console.log(`CONFLICTO: ${a.rel} cambió en ${NOMBRE_A} y en ${NOMBRE_B}`);
  if (!pendientes.length && !conflictos.length) console.log('Al día: los dos repos tienen la misma documentación de diseño.');
  process.exit(pendientes.length || conflictos.length ? 1 : 0);
}

const nuevo = {};
for (const a of acciones) {
  if (a.op === 'igual' && a.hash) nuevo[a.rel] = a.hash;
  if (a.op === 'conflicto' && base[a.rel]) nuevo[a.rel] = base[a.rel]; // queda como estaba: sigue pendiente
}
for (const a of pendientes) {
  const desdeAca = a.op === 'desdeAca';
  const origen = desdeAca ? ROOT : OTRO;
  const destino = desdeAca ? OTRO : ROOT;
  const nombreDestino = desdeAca ? NOMBRE_B : NOMBRE_A;
  if (a.hash === null) {
    borrar(destino, a.rel);
    console.log(`× borrado en ${nombreDestino}: ${a.rel}`);
  } else {
    copiar(path.join(origen, a.rel), path.join(destino, a.rel));
    nuevo[a.rel] = a.hash;
    console.log(`→ copiado a ${nombreDestino}: ${a.rel}`);
  }
}
for (const a of conflictos) {
  console.log(`CONFLICTO: ${a.rel} cambió en ${NOMBRE_A} y en ${NOMBRE_B}. No lo toqué: igualalo a mano en los dos y volvé a correr.`);
}
escribirRegistro(ROOT, nuevo);
escribirRegistro(OTRO, nuevo);
if (!pendientes.length && !conflictos.length) console.log('Al día: no había nada que copiar.');
else console.log(`Listo: ${pendientes.length} cambios copiados, ${conflictos.length} conflictos.`);
process.exit(conflictos.length ? 1 : 0);
