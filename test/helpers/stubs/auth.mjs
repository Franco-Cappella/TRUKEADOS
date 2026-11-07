// Cuentas de prueba: el token es el id del usuario y el nombre sale de NAMES (o "Jugador").
export const NAMES = {};
export async function verifyToken(env, token) {
  return token ? { id: String(token) } : null;
}
export async function getProfile(env, id) {
  return { id, username: NAMES[id] || 'Jugador ' + id };
}
export const forgetProfile = () => {};
export const rest = async () => new Response('[]');
