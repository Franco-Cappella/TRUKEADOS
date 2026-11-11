// Ambientes de la partida (AMBIENTES en config.js: el servidor sortea uno por partida, y el mapa de la tienda de cada
// uno se ve en su turno). Lugares argentinos a todo color, como en la vida real, cada uno en su archivo:
//   amb-interiores.js  bar notable, café porteño, parrilla de barrio, club de barrio
//   amb-afuera.js      Bosques de Palermo, quincho, estancia
//   barrio-chino.js    Barrio Chino (el de la tienda)
//   amb-noche.js       Noche estrellada (el de la tienda): pintado con relieve (impasto.js)
// Las piezas que comparten (luces con halo, fuego, humo, ventanas a la calle, agua, pasto) están en amb-kit.js y los
// muebles y texturas en amb-piezas.js; el cielo, las capas de distancia y lo que vuela, en paisaje.js.
// Cada ambiente arma su grupo alrededor de la mesa, que está en el centro (radio < 1.3 m), y devuelve
// { background, fog: [color, cerca, lejos] }. Lo que se mueve se registra con tick() (paisaje.js).
// Para mirarlos: /tools/scene-test.html (con shoot() se guardan capturas en tools/shots/).
import * as THREE from 'three';
import { updater } from './paisaje.js';
import { resetLeaves } from './amb-piezas.js';
import { bar, cafe, parrilla, club } from './amb-interiores.js';
import { parque, quincho, campo } from './amb-afuera.js';
import { chinatown } from './barrio-chino.js';
import { noche } from './amb-noche.js';

const BUILD = { bar, cafe, parrilla, parque, quincho, club, campo, chinatown, noche };

/** Ids de los ambientes (el orden no importa: el servidor elige uno al azar). */
export const AMBIENTE_IDS = Object.keys(BUILD);

/** Arma el ambiente `id` (o el bar si no existe). Devuelve { group, update, background, fog }. */
export function buildAmbiente(id) {
  const g = new THREE.Group();
  g.name = `ambiente:${id}`;
  // cada ambiente con sus materiales de hojas (la escena guarda varios armados y los libera de a uno)
  resetLeaves();
  const out = (BUILD[id] || BUILD.bar)(g);
  // update(now, dt): lo que se mueve (nubes, estrellas, pétalos, faroles); null si el ambiente es quieto
  return { group: g, update: updater(g), ...out };
}

/** Libera la memoria de un ambiente que ya no se usa. */
export function disposeAmbiente(group) {
  group.traverse((o) => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      m.map?.dispose?.();
      m.dispose?.();
    }
    o.shadow?.map?.dispose?.();
  });
}
