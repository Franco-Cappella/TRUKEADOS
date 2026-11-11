// Tienda (comprar con monedas) y Personalizar (elegir lo que tenés puesto), pestañas del menú.
// El catálogo es COSMETICS (config.js); cómo se ve cada cosa, COSMETIC_LOOK (theme.js).
import { ROUTES, COSMETICS, COSMETIC_SLOTS, cosmeticById, TRY_VIEW } from './config.js';
import { COSMETIC_LOOK, SCENE } from './theme.js';
import { lookFor, dressed, drawCharacter, W as CW, H as CH } from './characters.js';
import { $, esc, api, savedName } from './dom.js';
import { currentMe } from './auth.js';
import { LockerStage } from './locker.js';
import { poster } from './poster.js';
import { drawPano, paintBox, paintBack } from './panos.js';
import { openCreator } from './creator.js';

let state = { owned: [], coins: 0, equipped: {} };
let stage = null; // la tarima de la Taquilla (se arma la primera vez que se abre)
let openSlot = 'personaje'; // la ranura que se está eligiendo en la Taquilla
let shopCat = 'todo'; // la categoría que se está mirando en la Tienda
let detailStage = null; // el personaje 3D que gira en la ficha de la tienda
let detailId = null; // lo que muestra la ficha abierta
let rotT = null; // el reloj de "cambia en …"

// Rareza según el precio (en blanco y negro: se nota por el estilo del casillero).
export const rarity = (it) => (!it ? null : it.price >= 1000 ? ['leg', 'Legendario'] : it.price >= 120 ? ['epi', 'Épico'] : it.price >= 60 ? ['raro', 'Raro'] : ['com', 'Común']);
const DEFAULT_NAME = { personaje: 'El dibujado', pano: 'El de siempre', dorso: 'El de siempre', ropa: 'La de siempre', baraja: 'La de siempre', mapa: 'El que toque' };
let onCoins = () => {};

const CHARACTER_SLOTS = ['ropa', 'gorro', 'anteojos'];
const TALL_SLOTS = [...CHARACTER_SLOTS, 'personaje']; // vista previa alta (la figura)

// Busto del personaje (cabeza y torso) en un canvas.
function drawBust(target, look) {
  const full = document.createElement('canvas');
  full.width = CW;
  full.height = CH;
  drawCharacter(full.getContext('2d'), look, { expr: 'neutral', cards: 0 });
  const ctx = target.getContext('2d');
  ctx.clearRect(0, 0, target.width, target.height);
  const sw = CW * 0.86;
  const sh = (sw * target.height) / target.width;
  ctx.drawImage(full, (CW - sw) / 2, 40, sw, sh, 0, 0, target.width, target.height);
}

function drawFelt(target, colors, look = null) {
  const ctx = target.getContext('2d');
  const { width: w, height: h } = target;
  // paño pintado (panos.js): el dibujo como queda en la mesa (casi entero), con las puntas redondeadas
  if (look?.draw) {
    const full = document.createElement('canvas');
    full.width = full.height = 640;
    drawPano(full, look, 4, { seam: false });
    const k = Math.max(w, h) / (full.width * paintBox(4).w * 0.97);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 8);
    ctx.clip();
    ctx.drawImage(full, (w - full.width * k) / 2, (h - full.height * k) / 2, full.width * k, full.height * k);
    ctx.restore();
    return;
  }
  const g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
  g.addColorStop(0, colors[0]);
  g.addColorStop(0.8, colors[1]);
  g.addColorStop(1, colors[2]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 8);
  ctx.fill();
}

function drawBack(target, colors, painted = null) {
  const ctx = target.getContext('2d');
  const { width: w, height: h } = target;
  ctx.clearRect(0, 0, w, h);
  // dorso pintado: la carta parada al medio, entera
  const art = painted && paintBack(painted);
  if (art) {
    const k = Math.min(w / art.width, h / art.height) * 0.92;
    ctx.drawImage(art, (w - art.width * k) / 2, (h - art.height * k) / 2, art.width * k, art.height * k);
    return;
  }
  if (!colors) {
    // el dorso de siempre: la imagen del mazo
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, w, h);
    img.src = ROUTES.card('back');
    return;
  }
  ctx.fillStyle = colors[0];
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 4);
  ctx.fill();
  ctx.strokeStyle = colors[1];
  ctx.lineWidth = 2;
  ctx.strokeRect(5, 5, w - 10, h - 10);
}

function drawObject(target, colors) {
  const ctx = target.getContext('2d');
  const { width: w, height: h } = target;
  ctx.clearRect(0, 0, w, h);
  colors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(w / 2 + (i - 1) * w * 0.26, h / 2, w * 0.15, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Dos cartas de la baraja, sin suavizar el pixel art.
function drawDeck(target, deck) {
  const ctx = target.getContext('2d');
  const { width: w, height: h } = target;
  ctx.clearRect(0, 0, w, h);
  const ch = h;
  const cw = (ch * 73) / 113;
  ['1E', '1B'].forEach((id, i) => {
    const img = new Image();
    img.onload = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, w / 2 + (i - 1) * (cw + 3) + 1.5, 0, cw, ch);
    };
    img.src = ROUTES.deckCard(deck, id);
  });
}

// La baraja abierta (como en la imagen del autor): el as y las figuras en abanico arriba y
// del 2 al 7 abajo (la baraja de truco no tiene 8 ni 9).
// Se dibuja a escala 2 sin suavizar y se guarda por baraja.
const PEEK_SCALE = 2;
const peekCache = new Map();
function loadImg(src) {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = fail;
    img.src = src;
  });
}
function deckSpread(deck, suit = 'E') {
  if (peekCache.has(deck)) return peekCache.get(deck);
  const k = PEEK_SCALE;
  const cw = 73 * k;
  const ch = 113 * k;
  const c = document.createElement('canvas');
  c.width = 400 * k;
  c.height = 262 * k;
  const ctx = c.getContext('2d');
  const top = ['1', '10', '11', '12'];
  const low = ['2', '3', '4', '5', '6', '7'];
  const ready = Promise.all([...top, ...low].map((n) => loadImg(ROUTES.deckCard(deck, n + suit)))).then((imgs) => {
    ctx.imageSmoothingEnabled = false;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 6 * k;
    ctx.shadowOffsetY = 2 * k;
    // abajo: del 2 al 7 encimadas, de izquierda a derecha
    const step = 60 * k;
    const x0 = (c.width - (step * (low.length - 1) + cw)) / 2;
    imgs.slice(4).forEach((img, i) => ctx.drawImage(img, x0 + i * step, c.height - ch - 4 * k, cw, ch));
    // arriba: el as y las figuras en abanico
    top.forEach((_, i) => {
      const a = (i - 1.5) * 0.09;
      ctx.save();
      ctx.translate(c.width / 2 + (i - 1.5) * 64 * k, 6 * k + ch / 2 + Math.abs(i - 1.5) * 5 * k);
      ctx.rotate(a);
      ctx.drawImage(imgs[i], -cw / 2, -ch / 2, cw, ch);
      ctx.restore();
    });
    return c;
  });
  peekCache.set(deck, ready);
  return ready;
}

// Créditos: lo fijo está en index.html; lo de la tienda (barajas de otros autores) sale de COSMETICS.
function initCredits() {
  const dialog = $('#credits-dialog');
  const list = $('#credits-list');
  for (const it of COSMETICS.filter((c) => c.credit)) {
    if (list.querySelector(`[data-credit="${it.id}"]`)) continue;
    const row = document.createElement('div');
    row.dataset.credit = it.id;
    row.innerHTML = `<dt>${esc(it.name)}</dt><dd><a href="${esc(it.credit.url)}" target="_blank" rel="noopener">${esc(it.credit.text)}</a></dd>`;
    list.append(row);
  }
  $('#credits-open').addEventListener('click', () => dialog.showModal());
}

// tu personaje dibujado (el del creador; sin elegir, el que sale de tu nombre)
const baseLook = () => lookFor(savedName(), 0, currentMe()?.profile?.look);

// Vista previa de una cosa de la tienda (o de lo que tenés puesto si item es null).
// Personaje 3D: la foto (public/models/<id>.webp), recortada al centro.
function drawThumb(canvas, src) {
  loadImg(src)
    .then((img) => {
      const ctx = canvas.getContext('2d');
      const k = Math.max(canvas.width / img.width, canvas.height / img.height);
      const w = img.width * k;
      const h = img.height * k;
      ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    })
    .catch(() => {});
}

function preview(canvas, item) {
  if (item.slot === 'baraja') return drawDeck(canvas, item.id);
  // personaje 3D: su póster (armado con el modelo), recortado alrededor del personaje; si falla, la foto de siempre
  if (item.slot === 'personaje') {
    return poster(item.id, item.name).then((src) => {
      if (!src) return drawThumb(canvas, COSMETIC_LOOK[item.id]?.thumb);
      const ctx = canvas.getContext('2d');
      const k = Math.max(canvas.width / src.width, canvas.height / src.height);
      const w = src.width * k;
      const h = src.height * k;
      const x = Math.min(0, Math.max(canvas.width - w, canvas.width / 2 - w * 0.66)); // el personaje está a la derecha
      ctx.drawImage(src, x, (canvas.height - h) / 2, w, h);
    });
  }
  // mapa: la foto del lugar (public/img/mapas/<ambiente>.webp, sale de tools/scene-test.html con mapShots())
  if (item.slot === 'mapa') return drawThumb(canvas, ROUTES.mapaThumb(item.ambiente));
  const L = COSMETIC_LOOK[item.id];
  if (CHARACTER_SLOTS.includes(item.slot)) drawBust(canvas, dressed(baseLook(), { ...state.equipped, [item.slot]: item.id }));
  else if (item.slot === 'pano') drawFelt(canvas, L.felt, L);
  else if (item.slot === 'dorso') drawBack(canvas, L.back, L.backDraw);
  else drawObject(canvas, L.colors);
}

function setCoins(coins) {
  state.coins = coins;
  $('#shop-coins').textContent = coins;
  const p = currentMe()?.profile;
  if (p) p.coins = coins;
  onCoins();
}

export function initShop(paint) {
  onCoins = paint;
  initCredits();
  $('#shop-cats').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-cat]');
    if (!b) return;
    shopCat = b.dataset.cat;
    renderShop();
  });
  addEventListener('scroll', () => $('#shop-dots').childElementCount && markDot(), { capture: true, passive: true });
  $('#shop-dots').addEventListener('click', (e) => {
    const b = e.target.closest('[data-dot]');
    if (b) $('#shop-list').querySelectorAll('.sh-sec')[b.dataset.dot]?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });
  $('#shop-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]');
    if (b) openDetail(b.dataset.open);
  });
  const dlg = $('#shop-detail');
  dlg.addEventListener('click', async (e) => {
    if (e.target === dlg || e.target.closest('[data-sdclose]')) return dlg.close();
    const tryIt = e.target.closest('button[data-try]');
    if (tryIt) {
      dlg.close();
      return openTry(cosmeticById(tryIt.dataset.try));
    }
    const buy = e.target.closest('button[data-buy]');
    const wear = e.target.closest('button[data-wear]');
    if (buy) await buyItem(buy);
    else if (wear) await wearItem(wear);
  });
  dlg.addEventListener('close', () => {
    if (dlg.open) return; // se volvió a abrir antes de que llegara el aviso
    detailId = null;
    detailStage?.show({ personaje: null, look: baseLook() }); // que deje de girar
  });
  const goShop = () => document.querySelector('[data-tab="tienda"]')?.click();
  $('#lk-shop').addEventListener('click', goShop);
  $('#try-close').addEventListener('click', closeTry);
  $('#shop-try').addEventListener('keydown', (e) => e.key === 'Escape' && closeTry());
  $('#lk-creator').addEventListener('click', () => openCreator({ onDone: () => renderCustomize() }));
  $('#cu-slots').addEventListener('click', async (e) => {
    const t = e.target.closest('button[data-tile]');
    if (t) {
      openSlot = t.dataset.tile;
      return renderCustomize();
    }
    if (e.target.closest('[data-goshop]')) return goShop();
    const b = e.target.closest('button[data-slot]');
    if (!b || b.classList.contains('on')) return;
    try {
      const r = await api(ROUTES.api.equip, { slot: b.dataset.slot, item: b.dataset.item || null });
      state.equipped = r.equipped;
      const p = currentMe()?.profile;
      if (p) p.equipped = r.equipped;
      $('#cu-msg').textContent = '';
      renderCustomize();
    } catch (err) {
      $('#cu-msg').textContent = err.message;
      $('#cu-msg').classList.add('bad');
    }
  });
}

export async function loadShop(tab) {
  try {
    state = await api(ROUTES.api.shop);
    setCoins(state.coins);
  } catch (err) {
    const where = tab === 'tienda' ? '#shop-msg' : '#cu-msg';
    $(where).textContent = err.message;
    $(where).classList.add('bad');
  }
  if (tab === 'tienda') renderShop();
  else renderCustomize();
}

// ---- Tienda
// Categorías (filtros de arriba): cada una junta ranuras de COSMETIC_SLOTS.
const SHOP_CATS = [
  { key: 'todo', label: 'Todo' },
  { key: 'personajes', label: 'Personajes', slots: ['personaje'] },
  { key: 'ropa', label: 'Ropa', slots: ['ropa', 'gorro', 'anteojos'] },
  { key: 'mapas', label: 'Mapas', slots: ['mapa'] },
  { key: 'mesa', label: 'En la mesa', slots: ['objeto', 'pano'] },
  { key: 'cartas', label: 'Cartas', slots: ['dorso', 'baraja'] },
];
const DAY_PICKS = 4; // cuántas cosas trae "Del día"
const FEATURED_MAPS = ['mapa-noche', 'mapa-chinatown']; // los mapas que van en grande en la vidriera
const slotLabel = (slot) => COSMETIC_SLOTS.find((x) => x.key === slot)?.label || '';

// "Del día": unas cosas que no tenés, elegidas con la fecha (todos ven las mismas; cambia a la medianoche).
function dayPicks() {
  const d = new Date();
  let seed = d.getFullYear() * 1000 + d.getMonth() * 40 + d.getDate();
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pool = COSMETICS.filter((c) => c.slot !== 'personaje');
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, DAY_PICKS);
}
const untilMidnight = () => {
  const d = new Date();
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) - d;
  const h = Math.floor(m / 3_600_000);
  const min = Math.floor((m % 3_600_000) / 60_000);
  return h ? `${h} h ${min} min` : `${min} min`;
};

// Precio (o "Ya lo tenés"/"Puesto") de una tarjeta.
function priceTag(it) {
  if (state.owned.includes(it.id)) return `<span class="sh-tag own">${state.equipped[it.slot] === it.id ? 'Puesto' : 'Ya lo tenés'}</span>`;
  return `<span class="sh-tag ${state.coins >= it.price ? '' : 'short'}"><i class="sh-coin" aria-hidden="true"></i>${it.price}</span>`;
}

function card(it, big = false) {
  const r = rarity(it);
  const tall = TALL_SLOTS.includes(it.slot);
  const [w, h] = big ? [640, 400] : tall ? [160, 176] : [176, 132];
  return `<button type="button" class="sh-card ${r[0]} ${big ? 'big' : ''} ${state.owned.includes(it.id) ? 'owned' : ''}" data-open="${esc(it.id)}">
    <canvas width="${w}" height="${h}" data-preview="${esc(it.id)}"></canvas>
    <span class="sh-meta"><small>${esc(r[1])} · ${esc(slotLabel(it.slot))}</small><b>${esc(it.name)}</b>${priceTag(it)}</span>
  </button>`;
}

function renderShop() {
  $('#shop-coins').textContent = state.coins;
  $('#shop-cats').innerHTML = SHOP_CATS.map((c) => `<button type="button" class="${shopCat === c.key ? 'on' : ''}" data-cat="${c.key}" aria-pressed="${shopCat === c.key}">${esc(c.label)}</button>`).join('');
  const cat = SHOP_CATS.find((c) => c.key === shopCat) || SHOP_CATS[0];
  let html = '';
  if (!cat.slots) {
    // la vidriera: los personajes en grande y lo del día
    const stars = COSMETICS.filter((c) => c.slot === 'personaje' || FEATURED_MAPS.includes(c.id));
    html += `<section class="sh-sec" data-label="Destacados"><h4>Destacados <small>Personajes en 3D y mapas: los ven todos en la mesa</small></h4><div class="sh-feat">${stars.map((it) => card(it, true)).join('')}</div></section>`;
    html += `<section class="sh-sec" data-label="Del día"><h4>Del día <small>Cambia en <span id="sh-rot">${untilMidnight()}</span></small></h4><div class="sh-grid">${dayPicks().map((it) => card(it)).join('')}</div></section>`;
  }
  const slots = cat.slots || COSMETIC_SLOTS.map((x) => x.key).filter((k) => k !== 'personaje');
  for (const key of slots) {
    const s = COSMETIC_SLOTS.find((x) => x.key === key);
    // primero lo que no tenés, de lo más caro a lo más barato
    const items = COSMETICS.filter((c) => c.slot === key).sort((a, b) => state.owned.includes(a.id) - state.owned.includes(b.id) || b.price - a.price);
    if (!items.length) continue;
    const wide = key === 'personaje' || key === 'mapa'; // los mapas, con foto grande
    html += `<section class="sh-sec" data-label="${esc(s.label)}"><h4>${esc(s.label)} <small>${esc(s.where)}</small></h4><div class="sh-grid ${wide ? 'feat' : ''}">${items.map((it) => card(it, wide)).join('')}</div></section>`;
  }
  $('#shop-list').innerHTML = html;
  renderDots();
  for (const c of $('#shop-list').querySelectorAll('canvas[data-preview]')) preview(c, cosmeticById(c.dataset.preview));
  clearInterval(rotT);
  rotT = setInterval(() => {
    const el = $('#sh-rot');
    if (!el) return clearInterval(rotT);
    el.textContent = untilMidnight();
  }, 30_000);
}

// Los puntitos de la derecha: uno por sección (dicen que hay más abajo); tocar uno baja a esa sección y el de la
// sección que se está viendo queda marcado.
function renderDots() {
  const secs = [...$('#shop-list').querySelectorAll('.sh-sec')];
  $('#shop-dots').innerHTML = secs.length > 1 ? secs.map((x, i) => `<button type="button" data-dot="${i}" aria-label="${esc(x.dataset.label)}"><span>${esc(x.dataset.label)}</span></button>`).join('') : '';
  markDot();
}
// marcada: la última sección que ya empezó (su título pasó el tercio de arriba de la pantalla); abajo de todo, la última
function markDot() {
  const secs = [...$('#shop-list').querySelectorAll('.sh-sec')];
  const line = innerHeight * 0.35;
  let cur = 0;
  secs.forEach((x, i) => {
    if (x.getBoundingClientRect().top <= line) cur = i;
  });
  const last = secs.at(-1);
  if (last && last.getBoundingClientRect().bottom <= innerHeight + 2) cur = secs.length - 1;
  $('#shop-dots').querySelectorAll('button').forEach((x, k) => x.classList.toggle('on', k === cur));
}

// La ficha: la cosa en grande (el personaje 3D girando, la baraja abierta), qué es y comprar o ponértela.
function openDetail(id) {
  const it = cosmeticById(id);
  if (!it) return;
  detailId = id;
  const dlg = $('#shop-detail');
  const view = dlg.querySelector('.sd-view');
  const r = rarity(it);
  dlg.className = `dl sd ${r[0]}`;
  const cv = $('#sd-canvas');
  const is3d = it.slot === 'personaje';
  view.classList.toggle('is3d', is3d);
  if (is3d) {
    detailStage ||= new LockerStage($('#sd-stage'));
    detailStage.show({ personaje: it.id, look: baseLook() });
  } else {
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (it.slot === 'mapa') {
      loadImg(ROUTES.mapaThumb(it.ambiente)).then((img) => {
        if (detailId !== id) return;
        const k = Math.max(cv.width / img.width, cv.height / img.height);
        ctx.drawImage(img, (cv.width - img.width * k) / 2, (cv.height - img.height * k) / 2, img.width * k, img.height * k);
      }).catch(() => {});
    } else if (it.slot === 'baraja') {
      deckSpread(it.id).then((src) => {
        if (detailId !== id) return;
        const k = Math.min(cv.width / src.width, cv.height / src.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(src, (cv.width - src.width * k) / 2, (cv.height - src.height * k) / 2, src.width * k, src.height * k);
      }).catch(() => {});
    } else {
      // la figura entera con la ropa puesta; lo demás, grande al medio
      const tmp = document.createElement('canvas');
      tmp.width = TALL_SLOTS.includes(it.slot) ? 300 : 360;
      tmp.height = TALL_SLOTS.includes(it.slot) ? 330 : 240;
      preview(tmp, it);
      const k = Math.min(cv.width / tmp.width, cv.height / tmp.height) * 0.92;
      // drawBack (el de siempre) dibuja después de cargar: se copia en el próximo cuadro
      requestAnimationFrame(() => detailId === id && ctx.drawImage(tmp, (cv.width - tmp.width * k) / 2, (cv.height - tmp.height * k) / 2, tmp.width * k, tmp.height * k));
    }
  }
  renderDetailInfo(it);
  if (!dlg.open) dlg.showModal();
}

// ------------------------------------------------------------------ probar antes de comprar
// Los mapas, los paños y los mazos se prueban en una mesa de verdad (la misma escena de la partida, vacía) que gira
// despacio; al cerrar se vuelve a la ficha para comprarlo o ponérselo.
const TRY_SLOTS = ['mapa', 'pano', 'dorso'];
let tryScene = null;
let tryTimer = null;
let tryId = null;

async function openTry(it) {
  if (!it) return;
  tryId = it.id;
  const box = $('#shop-try');
  box.classList.remove('hidden');
  $('#try-name').textContent = it.name;
  $('#try-where').textContent = COSMETIC_SLOTS.find((x) => x.key === it.slot)?.label || '';
  const { TableScene } = await import('./scene.js');
  if (tryId !== it.id || box.classList.contains('hidden')) return;
  if (!tryScene) tryScene = new TableScene($('#try-stage'));
  else tryScene.resume();
  tryScene.resize();
  tryScene.setLayout({ n: 4, me: 0, spectator: true });
  tryScene.setPlayers([null, null, null, null], null);
  tryScene.syncTable([[], [], [], []], { animate: false });
  const eq = state.equipped;
  const mapa = it.slot === 'mapa' ? it.ambiente : cosmeticById(eq.mapa)?.ambiente || 'bar';
  tryScene.setTable({ pano: it.slot === 'pano' ? it.id : eq.pano || null, dorso: it.slot === 'dorso' ? it.id : eq.dorso || null });
  tryScene.setAmbiente(mapa);
  // el mapa se mira más hacia el lugar; el paño y el mazo, más sobre la mesa
  tryScene.tPitch = tryScene.pitch = it.slot === 'mapa' ? TRY_VIEW.mapPitch : TRY_VIEW.tablePitch;
  clearInterval(tryTimer);
  tryTimer = setInterval(() => tryScene && (tryScene.tYaw += TRY_VIEW.spin), 16);
}

function closeTry() {
  clearInterval(tryTimer);
  tryScene?.pause();
  $('#shop-try').classList.add('hidden');
  const id = tryId;
  tryId = null;
  if (id) openDetail(id);
}

function renderDetailInfo(it) {
  const r = rarity(it);
  const s = COSMETIC_SLOTS.find((x) => x.key === it.slot);
  const owned = state.owned.includes(it.id);
  const worn = state.equipped[it.slot] === it.id;
  const missing = it.price - state.coins;
  const offWith3d = CHARACTER_SLOTS.includes(it.slot) && cosmeticById(state.equipped.personaje);
  let act;
  if (worn) act = '<button type="button" class="btn big" disabled>Equipado</button>';
  else if (owned) act = `<button type="button" class="btn primary big" data-wear="${esc(it.id)}">Equipar</button>`;
  else if (missing > 0) act = `<button type="button" class="btn big" disabled>Te faltan ${missing} monedas</button>`;
  else act = `<button type="button" class="btn primary big" data-buy="${esc(it.id)}">Comprar · ${it.price}</button>`;
  $('#sd-info').innerHTML = `
    <button type="button" class="sd-x" data-sdclose="1" aria-label="Cerrar">×</button>
    <span class="rar ${r[0]}">${esc(r[1])}</span>
    <h2>${esc(it.name)}</h2>
    <p class="sd-where"><b>${esc(s?.label || '')}</b> · ${esc(s?.where || '')}</p>
    ${owned ? '' : `<p class="sd-price"><i class="sh-coin" aria-hidden="true"></i><b>${it.price}</b><small>tenés ${state.coins}</small></p>`}
    ${offWith3d ? '<p class="sd-note">Con un personaje 3D puesto no se ve: es del personaje dibujado.</p>' : ''}
    ${it.credit ? `<p class="sd-note">Arte: <a href="${esc(it.credit.url)}" target="_blank" rel="noopener">${esc(it.credit.text)}</a></p>` : ''}
    <div class="sd-acts">${act}${TRY_SLOTS.includes(it.slot) ? `<button type="button" class="btn big" data-try="${esc(it.id)}">Probar</button>` : ''}</div>
    <p class="a-msg" id="sd-msg" role="status"></p>`;
}

async function buyItem(b) {
  const item = cosmeticById(b.dataset.buy);
  b.disabled = true;
  try {
    const r = await api(ROUTES.api.buy, { item: item.id });
    state.owned.push(item.id);
    setCoins(r.coins);
    renderShop();
    renderDetailInfo(item);
    $('#sd-msg').textContent = `¡Es tuyo! Equipalo ahora o después en la Taquilla.`;
  } catch (err) {
    $('#sd-msg').textContent = err.message;
    $('#sd-msg').classList.add('bad');
    b.disabled = false;
  }
}

async function wearItem(b) {
  const item = cosmeticById(b.dataset.wear);
  b.disabled = true;
  try {
    const r = await api(ROUTES.api.equip, { slot: item.slot, item: item.id });
    state.equipped = r.equipped;
    const p = currentMe()?.profile;
    if (p) p.equipped = r.equipped;
    renderShop();
    renderDetailInfo(item);
  } catch (err) {
    $('#sd-msg').textContent = err.message;
    $('#sd-msg').classList.add('bad');
    b.disabled = false;
  }
}

// Lo que está puesto en una ranura (o lo de siempre), dibujado en un canvas.
function previewSlot(canvas, slot, id) {
  const it = cosmeticById(id);
  if (it) return preview(canvas, it);
  const eq = { ...state.equipped, [slot]: undefined };
  if (CHARACTER_SLOTS.includes(slot) || slot === 'personaje') return drawBust(canvas, dressed(baseLook(), eq));
  if (slot === 'pano') return drawFelt(canvas, SCENE.felt);
  if (slot === 'dorso') return drawBack(canvas, null);
  const ctx = canvas.getContext('2d');
  if (slot === 'mapa') {
    // sin mapa: el que toque en cada partida (un signo de pregunta sobre gris)
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#9a9a9a';
    ctx.font = `800 ${Math.round(canvas.height * 0.5)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', canvas.width / 2, canvas.height / 2);
    return;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// La Taquilla: la tarima con tu personaje y, al costado, un casillero por ranura; el de la ranura abierta despliega
// lo que tenés para esa ranura.
function renderCustomize() {
  const eq = state.equipped;
  const char = cosmeticById(eq.personaje);
  stage ||= new LockerStage($('#lk-view'));
  stage.show({ personaje: char?.id || null, look: dressed(baseLook(), eq) });
  $('#lk-bigname').textContent = (char?.name || savedName()).toUpperCase();
  $('#lk-char').textContent = char ? char.name : savedName();
  const rar = rarity(char);
  $('#lk-rar').textContent = rar ? `Personaje 3D · ${rar[1]}` : 'Personaje dibujado';
  $('#lk-rar').className = `rar ${rar ? rar[0] : ''}`;
  $('#lk-coins').textContent = state.coins;
  // con un personaje 3D, la ropa, el gorro y los anteojos (que son del dibujado) no se ven: quedan apagados
  const off = (key) => !!char && CHARACTER_SLOTS.includes(key);
  if (off(openSlot)) openSlot = 'personaje';
  const tile = (s) => {
    const it = cosmeticById(eq[s.key]);
    const r = rarity(it);
    if (off(s.key)) {
      return `<button type="button" class="lk-tile off" disabled title="Con un personaje 3D no se ve: es del personaje dibujado"><canvas width="192" height="108" data-tilepreview="${s.key}"></canvas><small>${esc(s.label)}</small><b>${esc(it?.name || DEFAULT_NAME[s.key] || 'Nada')}</b><i class="lk-off">No va con 3D</i></button>`;
    }
    return `<button type="button" class="lk-tile ${r ? r[0] : 'none'} ${openSlot === s.key ? 'open' : ''}" data-tile="${s.key}" aria-expanded="${openSlot === s.key}"><canvas width="192" height="108" data-tilepreview="${s.key}"></canvas><small>${esc(s.label)}</small><b>${esc(it?.name || DEFAULT_NAME[s.key] || 'Nada')}</b></button>`;
  };
  const s = COSMETIC_SLOTS.find((x) => x.key === openSlot) || COSMETIC_SLOTS[0];
  const mine = COSMETICS.filter((c) => c.slot === s.key && state.owned.includes(c.id));
  const card = (id, name, r) => `<button type="button" class="lk-item ${r ? r[0] : 'none'} ${(eq[s.key] || '') === (id || '') ? 'on' : ''}" data-slot="${s.key}" data-item="${esc(id || '')}"><canvas width="192" height="108" data-itempreview="${esc(id || '')}"></canvas><b>${esc(name)}</b><small>${r ? r[1] : 'Gratis'}</small></button>`;
  const items = [card(null, DEFAULT_NAME[s.key] || 'Nada', null), ...mine.map((it) => card(it.id, it.name, rarity(it)))];
  $('#cu-slots').innerHTML = `<div class="lk-tiles">${COSMETIC_SLOTS.map(tile).join('')}</div>
    <div class="lk-pick"><h4>${esc(s.label)} <small>${esc(s.where)}</small></h4><div class="lk-items">${items.join('')}<button type="button" class="lk-item more" data-goshop="1"><span>+</span><b>Más en la tienda</b><small>${COSMETICS.filter((c) => c.slot === s.key && !state.owned.includes(c.id)).length} para comprar</small></button></div></div>`;
  for (const c of $('#cu-slots').querySelectorAll('canvas[data-tilepreview]')) previewSlot(c, c.dataset.tilepreview, eq[c.dataset.tilepreview]);
  for (const c of $('#cu-slots').querySelectorAll('canvas[data-itempreview]')) previewSlot(c, s.key, c.dataset.itempreview || null);
}
