// Tienda (comprar con monedas) y Personalizar (elegir lo que tenés puesto), pestañas del menú.
// El catálogo es COSMETICS (config.js); cómo se ve cada cosa, COSMETIC_LOOK (theme.js).
import { ROUTES, COSMETICS, COSMETIC_SLOTS, cosmeticById } from './config.js';
import { COSMETIC_LOOK, SCENE } from './theme.js';
import { lookFor, dressed, drawCharacter, W as CW, H as CH } from './characters.js';
import { $, esc, api, savedName } from './dom.js';
import { currentMe } from './auth.js';

let state = { owned: [], coins: 0, equipped: {} };
let onCoins = () => {};

const CHARACTER_SLOTS = ['ropa', 'gorro', 'anteojos'];

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

function drawFelt(target, colors) {
  const ctx = target.getContext('2d');
  const { width: w, height: h } = target;
  const g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
  g.addColorStop(0, colors[0]);
  g.addColorStop(0.8, colors[1]);
  g.addColorStop(1, colors[2]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 8);
  ctx.fill();
}

function drawBack(target, colors) {
  const ctx = target.getContext('2d');
  const { width: w, height: h } = target;
  ctx.clearRect(0, 0, w, h);
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

const baseLook = () => lookFor(savedName(), 0);

// Vista previa de una cosa de la tienda (o de lo que tenés puesto si item es null).
function preview(canvas, item) {
  const L = COSMETIC_LOOK[item.id];
  if (CHARACTER_SLOTS.includes(item.slot)) drawBust(canvas, dressed(baseLook(), { ...state.equipped, [item.slot]: item.id }));
  else if (item.slot === 'pano') drawFelt(canvas, L.felt);
  else if (item.slot === 'dorso') drawBack(canvas, L.back);
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
  $('#shop-list').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-buy]');
    if (!b) return;
    const item = cosmeticById(b.dataset.buy);
    b.disabled = true;
    try {
      const r = await api(ROUTES.api.buy, { item: item.id });
      state.owned.push(item.id);
      setCoins(r.coins);
      $('#shop-msg').textContent = `¡Compraste ${item.name}! Ponételo en Personalizar.`;
      $('#shop-msg').classList.remove('bad');
      renderShop();
    } catch (err) {
      $('#shop-msg').textContent = err.message;
      $('#shop-msg').classList.add('bad');
      b.disabled = false;
    }
  });
  $('#cu-slots').addEventListener('click', async (e) => {
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

function renderShop() {
  $('#shop-coins').textContent = state.coins;
  $('#shop-list').innerHTML = COSMETIC_SLOTS.map((s) => {
    const items = COSMETICS.filter((c) => c.slot === s.key);
    return `<section class="sh-slot"><h4>${esc(s.label)} <small>${esc(s.where)}</small></h4><div class="sh-items">${items
      .map((it) => {
        const owned = state.owned.includes(it.id);
        const worn = state.equipped[it.slot] === it.id;
        const btn = owned
          ? `<span class="sh-own">${worn ? 'Puesto' : 'Ya lo tenés'}</span>`
          : `<button type="button" class="btn small ${state.coins >= it.price ? 'primary' : ''}" data-buy="${esc(it.id)}" ${state.coins >= it.price ? '' : 'disabled'}>${it.price} monedas</button>`;
        return `<div class="sh-item ${owned ? 'owned' : ''}"><canvas width="${CHARACTER_SLOTS.includes(it.slot) ? 128 : 96}" height="${CHARACTER_SLOTS.includes(it.slot) ? 140 : 64}" data-preview="${esc(it.id)}"></canvas><b>${esc(it.name)}</b>${btn}</div>`;
      })
      .join('')}</div></section>`;
  }).join('');
  for (const c of $('#shop-list').querySelectorAll('canvas[data-preview]')) preview(c, cosmeticById(c.dataset.preview));
}

function renderCustomize() {
  const eq = state.equipped;
  drawBust($('#cu-bust'), dressed(baseLook(), eq));
  drawFelt($('#cu-felt'), COSMETIC_LOOK[eq.pano]?.felt || SCENE.felt);
  drawBack($('#cu-back'), COSMETIC_LOOK[eq.dorso]?.back || null);
  $('#cu-slots').innerHTML = COSMETIC_SLOTS.map((s) => {
    const mine = COSMETICS.filter((c) => c.slot === s.key && state.owned.includes(c.id));
    const chip = (id, label) => `<button type="button" data-slot="${s.key}" data-item="${esc(id || '')}" class="${(eq[s.key] || '') === (id || '') ? 'on' : ''}">${esc(label)}</button>`;
    return `<div class="cu-slot"><h4>${esc(s.label)} <small>${esc(s.where)}</small></h4><div class="m-pills cu-pills">${chip(null, { pano: 'El de siempre', dorso: 'El de siempre', ropa: 'La de siempre' }[s.key] || 'Nada')}${mine.map((it) => chip(it.id, it.name)).join('')}</div>${mine.length ? '' : '<small class="muted">Comprá algo en la tienda para elegirlo acá.</small>'}</div>`;
  }).join('');
}
