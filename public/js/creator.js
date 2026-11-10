// El creador de personaje: tu personaje dibujado parado en una tarima, con una cámara que se acerca a la parte que
// estás eligiendo (la cara, el pelo, la barba, la ropa, la bandera del pecho) y se aleja para verlo entero. Se puede
// girar arrastrándolo, y "Aleatorio" arma uno al azar. Al registrarte aparece solo (sin personaje elegido todavía) y
// después se abre desde la Taquilla. Lo que se elige es profiles.look (LOOK_OPTS y cleanLook en config.js; los colores
// en AVATAR_COLORS de theme.js) y lo dibuja characters.js: en la mesa lo ven todos.
import { LOOK_OPTS, CREATOR, ROUTES, cleanLook, randomLook } from './config.js';
import { AVATAR_COLORS, FLAG_LOOK } from './theme.js';
import { drawCharacter, drawFlag, lookFor, W as CW, H as CH } from './characters.js';
import { $, esc, api, savedName, store, KEYS } from './dom.js';
import { currentMe } from './auth.js';

// Las partes: qué se elige en cada una y adónde va la cámara (centro y acercamiento, en píxeles del personaje).
const PARTS = [
  { key: 'cuerpo', label: 'Piel', cam: CREATOR.cam.cuerpo },
  { key: 'cara', label: 'Cara', cam: CREATOR.cam.cara },
  { key: 'pelo', label: 'Pelo', cam: CREATOR.cam.pelo },
  { key: 'barba', label: 'Barba', cam: CREATOR.cam.barba },
  { key: 'ropa', label: 'Ropa', cam: CREATOR.cam.ropa },
  { key: 'bandera', label: 'Bandera', cam: CREATOR.cam.bandera },
];
const FACE_LABELS = { fw: 'Ancho de cara', fh: 'Largo de cara', jaw: 'Mentón', scowl: 'Cejas' };

const damp = (a, b, rate, dt) => b + (a - b) * Math.exp(-rate * dt);

let open = null; // el creador abierto: { look, part, ... }

/**
 * Abre el creador. first: es la primera vez (al registrarte): "Después" lo deja para otro momento.
 * onDone(look | null): al guardar (o al cerrar sin guardar, con null).
 */
export function openCreator({ first = false, onDone = () => {} } = {}) {
  const root = $('#creator');
  const saved = currentMe()?.profile?.look;
  const look = cleanLook(saved) || randomLook();
  open = { look, part: 'cuerpo', first, onDone, cam: { ...CREATOR.cam.todo }, yaw: 0, tYaw: 0, hop: 0, flash: 0, talkUntil: 0, dirty: true };
  root.classList.remove('hidden');
  $('#cr-title').textContent = first ? 'Armá tu personaje' : 'Tu personaje';
  $('#cr-sub').textContent = first ? 'Así te van a ver en la mesa. Elegí parte por parte, o tocá Aleatorio.' : 'Así te ven en la mesa. Los cambios se ven en la próxima partida.';
  $('#cr-skip').textContent = first ? 'Después' : 'Cancelar';
  $('#cr-name').textContent = (currentMe()?.profile?.username || savedName() || '').toUpperCase();
  $('#cr-msg').textContent = '';
  // la cámara arranca lejos y se acerca (la entrada)
  open.cam.zoom *= 0.7;
  renderTabs();
  renderPart();
  loop();
}

export const creatorOpen = () => !!open;

function close(result) {
  const o = open;
  open = null;
  $('#creator').classList.add('hidden');
  o?.onDone(result);
}

// ------------------------------------------------------------------ panel

function renderTabs() {
  $('#cr-tabs').innerHTML = PARTS.map((p) => `<button type="button" role="tab" class="${open.part === p.key ? 'on' : ''}" aria-selected="${open.part === p.key}" data-part="${p.key}">${esc(p.label)}</button>`).join('');
}

const swatches = (key, colors, { dual = false } = {}) => `<div class="cr-sw" role="radiogroup">${colors.map((c, i) => {
  const bg = dual ? `linear-gradient(135deg, ${c[0]} 55%, ${c[1]} 55%)` : c;
  return `<button type="button" role="radio" aria-checked="${open.look[key] === i}" class="${open.look[key] === i ? 'on' : ''}" data-set="${key}" data-val="${i}" style="background:${bg}" aria-label="Color ${i + 1}"></button>`;
}).join('')}</div>`;
const chips = (key, list) => `<div class="cr-chips" role="radiogroup">${list.map((x) => `<button type="button" role="radio" aria-checked="${open.look[key] === x.id}" class="${open.look[key] === x.id ? 'on' : ''}" data-set="${key}" data-val="${esc(x.id)}">${esc(x.label || x.name)}</button>`).join('')}</div>`;
const toggle = (key, label) => `<label class="cr-tog"><input type="checkbox" data-tog="${key}" ${open.look[key] ? 'checked' : ''}><span>${esc(label)}</span></label>`;
const slider = (key) => {
  const [a, b] = LOOK_OPTS.face[key];
  const step = key === 'jaw' ? 0.01 : 1;
  const v = open.look[key] ?? (a + b) / 2;
  return `<label class="cr-sl"><span>${esc(FACE_LABELS[key])}</span><input type="range" min="${a}" max="${b}" step="${step}" value="${v}" data-slide="${key}"></label>`;
};
const group = (title, body) => `<section class="cr-grp"><h4>${esc(title)}</h4>${body}</section>`;

function renderPart() {
  const L = open.look;
  let html = '';
  switch (open.part) {
    case 'cuerpo':
      html = group('Tono de piel', swatches('skin', AVATAR_COLORS.skins, { dual: true }));
      break;
    case 'cara':
      html = group('Forma', Object.keys(LOOK_OPTS.face).map(slider).join(''))
        + group('Rasgos', toggle('soft', 'Rasgos finos (sin barba)') + toggle('glasses', 'Anteojos'));
      break;
    case 'pelo':
      html = group('Peinado', chips('style', LOOK_OPTS.styles)) + group('Color', swatches('hair', AVATAR_COLORS.hairs));
      break;
    case 'barba':
      html = L.soft
        ? `<p class="cr-note">Con rasgos finos no hay barba ni bigote. Sacalo en <button type="button" class="a-link" data-goto="cara">Cara</button>.</p>`
        : group('Barba', chips('beard', LOOK_OPTS.beards)) + group('Bigote', toggle('mustache', 'Bigote'));
      break;
    case 'ropa':
      html = group('Qué tenés puesto', chips('shirt', LOOK_OPTS.shirts)) + group('Color', swatches('cloth', AVATAR_COLORS.clothes))
        + group('Segundo color (saco, chaleco, poncho)', swatches('cloth2', AVATAR_COLORS.clothes));
      break;
    case 'bandera':
      html = group('De dónde sos', `<div class="cr-flags" role="radiogroup">${LOOK_OPTS.flags.map((f) => `<button type="button" role="radio" aria-checked="${L.flag === f.id}" class="${L.flag === f.id ? 'on' : ''}" data-set="flag" data-val="${f.id}"><canvas width="48" height="32" data-flag="${f.id}"></canvas><span>${esc(f.name)}</span></button>`).join('')}</div>`);
      break;
  }
  $('#cr-opts').innerHTML = html;
  for (const c of $('#cr-opts').querySelectorAll('canvas[data-flag]')) {
    const ctx = c.getContext('2d');
    if (FLAG_LOOK[c.dataset.flag]) drawFlag(ctx, c.dataset.flag, 0, 0, 48, 32);
    else {
      ctx.strokeStyle = '#757575';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 46, 30);
      ctx.beginPath();
      ctx.moveTo(4, 28);
      ctx.lineTo(44, 4);
      ctx.stroke();
    }
  }
}

function setPart(key) {
  if (!PARTS.some((p) => p.key === key)) return;
  open.part = key;
  open.tYaw = 0;
  renderTabs();
  renderPart();
}

function change(key, val) {
  open.look = cleanLook({ ...open.look, [key]: val });
  open.dirty = true;
  open.talkUntil = performance.now() + CREATOR.reactMs; // reacciona: dice algo
  renderPart();
}

// ------------------------------------------------------------------ escenario

let ctx = null;
let charCanvas = null;
let last = 0;
let running = false;
let dust = [];

function loop() {
  if (running) return;
  running = true;
  const cv = $('#cr-canvas');
  ctx = cv.getContext('2d');
  charCanvas ||= Object.assign(document.createElement('canvas'), { width: CW, height: CH });
  dust = Array.from({ length: 40 }, () => [Math.random(), Math.random(), Math.random() * 10]);
  last = performance.now();
  const tick = (now) => {
    if (!open) {
      running = false;
      return;
    }
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
      frame(cv, now, dt);
    } catch (err) {
      console.error('creador', err);
    }
  };
  requestAnimationFrame(tick);
}

function frame(cv, now, dt) {
  const o = open;
  const host = cv.parentElement;
  const pr = Math.min(devicePixelRatio || 1, 2);
  const w = host.clientWidth;
  const h = host.clientHeight;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * pr) || cv.height !== Math.round(h * pr)) {
    cv.width = Math.round(w * pr);
    cv.height = Math.round(h * pr);
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || store.get(KEYS.lessMotion) === '1';
  // la cámara va hacia la parte elegida (en celular el escenario es más bajo: se aleja un poco)
  const target = PARTS.find((p) => p.key === o.part)?.cam || CREATOR.cam.todo;
  const rate = reduce ? 30 : CREATOR.camRate;
  o.cam.x = damp(o.cam.x, target.x, rate, dt);
  o.cam.y = damp(o.cam.y, target.y, rate, dt);
  o.cam.zoom = damp(o.cam.zoom, target.zoom, rate, dt);
  o.yaw = damp(o.yaw, o.dragging ? o.tYaw : o.tYaw, 8, dt);
  if (!o.dragging) o.tYaw = damp(o.tYaw, 0, 1.2, dt); // vuelve solo de frente
  o.hop = damp(o.hop, 0, 7, dt);
  o.flash = damp(o.flash, 0, 5, dt);

  const c = ctx;
  c.setTransform(pr, 0, 0, pr, 0, 0);
  // fondo: penumbra con el cono de luz de arriba
  const bg = c.createRadialGradient(w / 2, h * 0.35, 10, w / 2, h * 0.5, Math.max(w, h) * 0.8);
  bg.addColorStop(0, '#2a2a2a');
  bg.addColorStop(1, '#070707');
  c.fillStyle = bg;
  c.fillRect(0, 0, w, h);

  // escala: el personaje entero (CH px) ocupa ~ 0.9 del alto con zoom 1
  const s = ((h * 0.92) / CH) * o.cam.zoom;
  const sx = (x) => w / 2 + (x - o.cam.x) * s;
  const sy = (y) => h / 2 + (y - o.cam.y) * s;
  const feet = CREATOR.feetY;

  // el cono de luz
  const top = sy(-400);
  const cone = c.createLinearGradient(0, top, 0, sy(feet));
  cone.addColorStop(0, 'rgba(255,255,255,0.10)');
  cone.addColorStop(1, 'rgba(255,255,255,0.02)');
  c.fillStyle = cone;
  c.beginPath();
  c.moveTo(sx(-60), top);
  c.lineTo(sx(60), top);
  c.lineTo(sx(380), sy(feet));
  c.lineTo(sx(-380), sy(feet));
  c.closePath();
  c.fill();
  // motas de polvo en la luz
  c.fillStyle = 'rgba(255,255,255,0.35)';
  for (const d of dust) {
    const t = now / 1000;
    const x = sx(-300 + d[0] * 600 + Math.sin(t * 0.2 + d[2]) * 20);
    const y = sy(-200 + ((d[1] * (feet + 200) + t * 8) % (feet + 200)));
    c.fillRect(x, y, 1.5, 1.5);
  }

  // la tarima: un cilindro chato visto un poco desde arriba, con el aro de luz
  const tw = 330;
  const th = 60;
  const ty = feet + 8;
  c.fillStyle = '#161616';
  c.beginPath();
  c.ellipse(sx(0), sy(ty + th), tw * s, 46 * s, 0, 0, Math.PI);
  c.lineTo(sx(-tw), sy(ty));
  c.ellipse(sx(0), sy(ty), tw * s, 46 * s, 0, Math.PI, 0, true);
  c.closePath();
  c.fill();
  const topG = c.createRadialGradient(sx(0), sy(ty), 10, sx(0), sy(ty), tw * s);
  topG.addColorStop(0, '#3a3a3a');
  topG.addColorStop(1, '#202020');
  c.fillStyle = topG;
  c.beginPath();
  c.ellipse(sx(0), sy(ty), tw * s, 46 * s, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = `rgba(255,255,255,${0.75 + Math.sin(now / 700) * 0.2})`;
  c.lineWidth = Math.max(1.5, 4 * s);
  c.beginPath();
  c.ellipse(sx(0), sy(ty), tw * s, 46 * s, 0, 0, Math.PI * 2);
  c.stroke();
  // sombra del personaje en la tarima
  c.fillStyle = 'rgba(0,0,0,0.45)';
  c.beginPath();
  c.ellipse(sx(0), sy(ty), 150 * s, 22 * s, 0, 0, Math.PI * 2);
  c.fill();

  // el personaje: respira, mira para los costados y, si se tocó algo, dice algo
  const t = now / 1000;
  const look = lookFor(currentMe()?.profile?.username || savedName() || '?', 0, o.look);
  const breathe = reduce ? 0 : Math.sin(t * 1.8) * 0.006;
  const glance = reduce ? 0 : Math.sin(t * 0.45) * 0.22;
  drawCharacter(charCanvas.getContext('2d'), look, {
    expr: 'neutral',
    talking: now < o.talkUntil,
    cards: 0,
    bodyYaw: o.yaw,
    headYaw: o.yaw + glance,
  });
  const hop = o.hop * 60;
  c.save();
  c.translate(sx(0), sy(feet) - hop * s);
  c.scale(1, 1 + breathe);
  c.drawImage(charCanvas, (-CW / 2) * s, -feet * s, CW * s, CH * s);
  c.restore();

  // el destello del "Aleatorio"
  if (o.flash > 0.01) {
    c.fillStyle = `rgba(255,255,255,${o.flash * 0.35})`;
    c.fillRect(0, 0, w, h);
  }
  // viñeta
  const vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  c.fillStyle = vg;
  c.fillRect(0, 0, w, h);
}

// ------------------------------------------------------------------ eventos

export function initCreator() {
  const root = $('#creator');
  $('#cr-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-part]');
    if (b) setPart(b.dataset.part);
  });
  // con las flechas se cambia de parte (como pestañas)
  $('#cr-tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = PARTS.findIndex((p) => p.key === open.part);
    const next = PARTS[(i + (e.key === 'ArrowRight' ? 1 : PARTS.length - 1)) % PARTS.length];
    setPart(next.key);
    $('#cr-tabs').querySelector(`[data-part="${next.key}"]`)?.focus();
  });
  $('#cr-opts').addEventListener('click', (e) => {
    const go = e.target.closest('[data-goto]');
    if (go) return setPart(go.dataset.goto);
    const b = e.target.closest('[data-set]');
    if (!b) return;
    const key = b.dataset.set;
    const v = b.dataset.val;
    change(key, ['skin', 'hair', 'cloth', 'cloth2'].includes(key) ? Number(v) : v);
  });
  $('#cr-opts').addEventListener('change', (e) => {
    const t = e.target.closest('[data-tog]');
    if (t) change(t.dataset.tog, t.checked);
  });
  $('#cr-opts').addEventListener('input', (e) => {
    const s = e.target.closest('[data-slide]');
    if (!s) return;
    open.look = cleanLook({ ...open.look, [s.dataset.slide]: Number(s.value) });
  });
  $('#cr-random').addEventListener('click', () => {
    open.look = randomLook();
    open.hop = 1;
    open.flash = 1;
    open.talkUntil = performance.now() + CREATOR.reactMs;
    renderPart();
  });
  $('#cr-skip').addEventListener('click', () => {
    if (open?.first) store.set(KEYS.creatorLater, '1');
    close(null);
  });
  $('#cr-save').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    $('#cr-msg').textContent = '';
    try {
      const { look } = await api(ROUTES.api.look, { look: open.look });
      const p = currentMe()?.profile;
      if (p) p.look = look;
      store.set(KEYS.creatorLater, '');
      close(look);
    } catch (err) {
      $('#cr-msg').textContent = err.message;
      $('#cr-msg').classList.add('bad');
    } finally {
      b.disabled = false;
    }
  });
  // arrastrar el personaje lo gira
  const stage = $('#cr-canvas');
  let x0 = 0;
  stage.addEventListener('pointerdown', (e) => {
    if (!open) return;
    open.dragging = true;
    x0 = e.clientX;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!open?.dragging) return;
    open.tYaw = Math.max(-1.2, Math.min(1.2, open.tYaw + (e.clientX - x0) * 0.008));
    x0 = e.clientX;
  });
  const up = () => open && (open.dragging = false);
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open && !open.first) close(null);
  });
}
