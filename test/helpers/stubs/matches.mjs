// Historial de prueba: guarda las partidas terminadas en memoria.
export const recorded = [];
export async function recordMatch(env, meta, log, game) {
  recorded.push({ meta, game });
  return { ok: true };
}
export async function listMatches() {
  return [];
}
export async function getMatch() {
  return null;
}
