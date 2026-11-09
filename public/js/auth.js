// Sesión del jugador con Supabase Auth (Google o mail y contraseña) y su perfil (nombre, monedas, ELO).
// La configuración pública del proyecto la da el Worker (/api/config); el token viaja en cada pedido a /api
// y al entrar a una sala. Sin sesión y sin perfil no se juega.
import { AuthClient } from '/vendor/supabase-auth.js';
import { ROUTES } from './config.js';
import { api, setTokenGetter, store, KEYS } from './dom.js';

let client = null;
let me = null; // { user: { id, email }, profile: { username, coins, elo_1v1… } | null }
let loadError = ''; // por qué no se pudo leer la cuenta cuando no fue falta de sesión (ver loadMe)

/** Arranca Supabase Auth (y completa el regreso de Google si la URL trae ?code=). Devuelve si hay sesión. */
export async function initAuth() {
  const cfg = await fetch(ROUTES.api.config).then((r) => r.json());
  if (!cfg.supabaseUrl || !cfg.supabaseKey) throw new Error('Falta configurar Supabase en el servidor');
  client = new AuthClient({
    url: `${cfg.supabaseUrl}/auth/v1`,
    headers: { apikey: cfg.supabaseKey },
    storageKey: 'trukeados-auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  });
  setTokenGetter(async () => (await client.getSession()).data.session?.access_token ?? null);
  const { data } = await client.getSession();
  cleanUrl();
  return !!data.session;
}

// Después de volver de Google, la URL trae ?code= (o un error): se saca para que no quede en el historial.
function cleanUrl() {
  const u = new URL(location.href);
  const keys = ['code', 'error', 'error_code', 'error_description'];
  if (!keys.some((k) => u.searchParams.has(k))) return;
  keys.forEach((k) => u.searchParams.delete(k));
  history.replaceState(history.state, '', u.pathname + u.search + u.hash);
}

export const onAuthChange = (fn) => client.onAuthStateChange((event) => fn(event));
export const currentMe = () => me;
export const lastLoadError = () => loadError;

/** Lee el perfil del servidor. null si no hay sesión válida (lastLoadError dice si fue otra cosa). */
export async function loadMe() {
  loadError = '';
  try {
    me = await api(ROUTES.api.me);
  } catch (err) {
    me = null;
    // 401 es "no hay sesión"; si la base o el servidor fallan, o no hay conexión, la persona tiene que enterarse
    if (err.status !== 401) loadError = err.status ? err.message : 'No hay conexión con el servidor. Probá de nuevo.';
  }
  if (me?.profile) store.set(KEYS.name, me.profile.username);
  return me;
}

/** Primera vez: el nombre con el que aparece en la mesa y en el ranking. */
export async function chooseUsername(username, level) {
  me = await api(ROUTES.api.me, { username, level });
  store.set(KEYS.name, me.profile.username);
  return me;
}

/** Cambia el nombre (una vez cada 14 días: lo controla el servidor). */
export async function changeUsername(username) {
  const { profile } = await api(ROUTES.api.username, { username });
  me.profile = profile;
  store.set(KEYS.name, profile.username);
  return me;
}

// Errores de Supabase Auth en castellano (los que puede ver alguien que se equivocó al escribir).
const AUTH_ERRORS = {
  invalid_credentials: 'Mail o contraseña incorrectos',
  email_not_confirmed: 'Confirmá tu mail: te mandamos un enlace',
  user_already_exists: 'Ya hay una cuenta con ese mail: entrá con tu contraseña',
  weak_password: 'La contraseña es muy corta',
  over_email_send_rate_limit: 'Probá de nuevo en unos minutos',
  over_request_rate_limit: 'Probá de nuevo en unos minutos',
  validation_failed: 'Revisá el mail',
};
// (algunas versiones de Supabase Auth no mandan el código, solo el mensaje en inglés)
const AUTH_MESSAGES = { 'Invalid login credentials': 'invalid_credentials', 'Email not confirmed': 'email_not_confirmed', 'User already registered': 'user_already_exists' };
const authError = (error) => new Error(AUTH_ERRORS[error.code] || AUTH_ERRORS[AUTH_MESSAGES[error.message]] || 'No se pudo iniciar sesión. Probá de nuevo.');

export async function signInWithGoogle() {
  // vuelve a la misma dirección (si te pasaron /sala/1234, entrás a esa sala)
  const { error } = await client.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } });
  if (error) throw authError(error);
}

export async function signInWithPassword(email, password) {
  const { error } = await client.signInWithPassword({ email, password });
  if (error) throw authError(error);
}

/** Crea la cuenta. Devuelve true si ya quedó con sesión, false si hay que confirmar el mail primero. */
export async function signUp(email, password) {
  const { data, error } = await client.signUp({ email, password, options: { emailRedirectTo: location.href } });
  if (error) throw authError(error);
  return !!data.session;
}

export async function signOut() {
  await client.signOut().catch(() => {});
  me = null;
  loadError = '';
}
