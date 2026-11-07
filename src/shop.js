// Tienda: comprar con monedas y elegir lo que tenés puesto. El catálogo y los precios son los de config.js
// (COSMETICS): el navegador solo dice qué quiere; el precio lo pone el servidor.
import { COSMETIC_SLOTS, cosmeticById, cleanEquipped } from '../public/js/config.js';
import { rest, forgetProfile } from './auth.js';

export async function ownedItems(env, uid) {
  const res = await rest(env, `inventory?user_id=eq.${uid}&select=item_id`);
  if (!res.ok) throw new Error('No se pudo leer lo que compraste');
  return (await res.json()).map((r) => r.item_id);
}

/** { ok, coins } o { error } */
export async function buyItem(env, uid, itemId) {
  const item = cosmeticById(itemId);
  if (!item) return { error: 'Eso no está en la tienda' };
  const res = await rest(env, 'rpc/buy_item', { method: 'POST', body: JSON.stringify({ uid, item: item.id, cost: item.price }) });
  if (!res.ok) throw new Error('No se pudo comprar');
  forgetProfile(uid);
  return res.json();
}

/** Ponerse (o sacarse, con item null) algo de una ranura. Devuelve { equipped } o { error }. */
export async function equipItem(env, uid, profile, slot, itemId) {
  if (!COSMETIC_SLOTS.some((s) => s.key === slot)) return { error: 'No existe esa ranura' };
  const eq = { ...cleanEquipped(profile.equipped) };
  if (itemId == null) delete eq[slot];
  else {
    const item = cosmeticById(itemId);
    if (!item || item.slot !== slot) return { error: 'Eso no va ahí' };
    if (!(await ownedItems(env, uid)).includes(item.id)) return { error: 'Primero compralo en la tienda' };
    eq[slot] = item.id;
  }
  const res = await rest(env, `profiles?id=eq.${uid}`, { method: 'PATCH', body: JSON.stringify({ equipped: eq }) });
  if (!res.ok) throw new Error('No se pudo guardar');
  forgetProfile(uid);
  return { equipped: eq };
}
