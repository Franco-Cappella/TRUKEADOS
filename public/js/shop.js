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

let peekEl = null;
let peekFor = null;
function showPeek(itemEl) {
  const item = cosmeticById(itemEl.dataset.peek);
  if (!item) return;
  if (!peekEl) {
    peekEl = document.createElement('div');
    peekEl.className = 'sh-peek';
    peekEl.setAttribute('aria-hidden', 'true');
    peekEl.innerHTML = '<canvas></canvas><b></b>';
    document.body.append(peekEl);
  }
  peekFor = itemEl;
  deckSpread(item.id).then((src) => {
    if (peekFor !== itemEl) return;
    const cv = peekEl.querySelector('canvas');
    cv.width = src.width;
    cv.height = src.height;
    cv.getContext('2d').drawImage(src, 0, 0);
    peekEl.querySelector('b').textContent = item.name;
    // arriba de la tarjeta si entra; si no, abajo. Sin salirse de la pantalla.
    const r = itemEl.getBoundingClientRect();
    const pw = peekEl.offsetWidth;
    const ph = peekEl.offsetHeight;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - pw / 2), window.innerWidth - pw - 8);
    const top = r.top - ph - 10 >= 8 ? r.top - ph - 10 : Math.min(r.bottom + 10, window.innerHeight - ph - 8);
    peekEl.style.left = `${left}px`;
    peekEl.style.top = `${top}px`;
    peekEl.classList.add('on');
  }).catch(() => {});
}
function hidePeek(itemEl) {
  if (itemEl && peekFor !== itemEl) return;
  peekFor = null;
  peekEl?.classList.remove('on');
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

const baseLook = () => lookFor(savedName(), 0);

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
  if (item.slot === 'personaje') return drawThumb(canvas, COSMETIC_LOOK[item.id]?.thumb);
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
  initCredits();
  const list = $('#shop-list');
  list.addEventListener('pointerover', (e) => {
    const it = e.target.closest('.sh-item[data-peek]');
    if (it && it !== peekFor) showPeek(it);
  });
  list.addEventListener('pointerout', (e) => {
    const it = e.target.closest('.sh-item[data-peek]');
    if (it && !it.contains(e.relatedTarget)) hidePeek(it);
  });
  list.addEventListener('focusin', (e) => {
    const it = e.target.closest('.sh-item[data-peek]');
    if (it) showPeek(it);
  });
  list.addEventListener('focusout', (e) => {
    const it = e.target.closest('.sh-item[data-peek]');
    if (it && !it.contains(e.relatedTarget)) hidePeek(it);
  });
  window.addEventListener('scroll', () => hidePeek(), true);
  $('#shop-list').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-buy]');
    if (!b) return;
    const item = cosmeticById(b.dataset.buy);
    b.disabled = true;
    try {
      const r = await api(ROUTES.api.buy, { item: item.id });
      state.owned.push(item.id);
      setCoins(r.coins);
      $('#shop-msg').textContent = `¡Compraste ${item.name}! Ponételo en la Taquilla.`;
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
  hidePeek();
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
        const peek = it.slot === 'baraja' ? ` data-peek="${esc(it.id)}"` : '';
        return `<div class="sh-item ${owned ? 'owned' : ''}"${peek}><canvas width="${TALL_SLOTS.includes(it.slot) ? 128 : 96}" height="${TALL_SLOTS.includes(it.slot) ? 140 : 64}" data-preview="${esc(it.id)}"></canvas><b>${esc(it.name)}</b>${btn}</div>`;
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
    return `<div class="cu-slot"><h4>${esc(s.label)} <small>${esc(s.where)}</small></h4><div class="m-pills cu-pills">${chip(null, { personaje: 'El dibujado', pano: 'El de siempre', dorso: 'El de siempre', ropa: 'La de siempre', baraja: 'La de siempre' }[s.key] || 'Nada')}${mine.map((it) => chip(it.id, it.name)).join('')}</div>${mine.length ? '' : '<small class="muted">Comprá algo en la tienda para elegirlo acá.</small>'}</div>`;
  }).join('');
}
