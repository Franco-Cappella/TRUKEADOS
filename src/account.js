// La cuenta de cada uno: bajar sus datos y borrarla.
// Borrar: se borra el usuario de Supabase Auth (con la clave secreta, desde el Worker); la base borra en cascada el
// perfil, lo comprado, los amigos, la foto y su lugar en las partidas (ver supabase/migrations). Las partidas quedan
// para los demás jugadores, sin él.
import { rest, forgetProfile } from './auth.js';

const FIELDS_OUT = ['username', 'elo', 'coins', 'equipped', 'created_at', 'username_changed_at'];

/** Todo lo que guardamos de vos, en un JSON (Ajustes → Descargar mis datos). */
export async function exportData(env, user, profile) {
  const get = async (path) => {
    const res = await rest(env, path);
    return res.ok ? res.json() : [];
  };
  const [inventory, friends, matches] = await Promise.all([
    get(`inventory?user_id=eq.${user.id}&select=item_id,price,bought_at`),
    get(`friendships?or=(user_a.eq.${user.id},user_b.eq.${user.id})&select=user_a,user_b,status,created_at`),
    get(`match_players?user_id=eq.${user.id}&select=*&order=ended_at.desc&limit=500`),
  ]);
  const prof = {};
  for (const [k, v] of Object.entries(profile || {})) if (FIELDS_OUT.includes(k) || k.startsWith('elo')) prof[k] = v;
  return {
    exportado: new Date().toISOString(),
    cuenta: { id: user.id, mail: user.email || null },
    perfil: prof,
    compras: inventory,
    amigos: friends,
    partidas: matches,
  };
}

/** Borra la cuenta. confirm: el nombre de usuario, escrito a mano (para no borrarla sin querer). */
export async function deleteAccount(env, user, profile, confirm) {
  const name = String(profile?.username || '');
  if (!name || String(confirm || '').trim().toLowerCase() !== name.toLowerCase()) {
    return { error: 'Escribí tu nombre de usuario tal cual para confirmar' };
  }
  if (!env.SUPABASE_SECRET_KEY) throw new Error('Falta SUPABASE_SECRET_KEY en el Worker (ver docs/CUENTAS.md)');
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
    method: 'DELETE',
    headers: { apikey: env.SUPABASE_SECRET_KEY, authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` },
  });
  if (!res.ok && res.status !== 404) {
    console.error('borrar cuenta: Supabase respondió', res.status, await res.text().catch(() => ''));
    return { error: 'No se pudo borrar la cuenta. Probá de nuevo en un rato o escribinos.' };
  }
  forgetProfile(user.id);
  return { ok: true };
}
