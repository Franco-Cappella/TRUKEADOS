// Ruleta de frases de la partida: un botón (o la tecla F) abre las frases en círculo y con un toque se tiran.
// Son todas las que usan los bots: van por tema y de a páginas.
import { PHRASE_WHEEL } from './talk.js';
import { $, esc } from './dom.js';

const RADIUS = 38; // % del tamaño de la ruleta
const PER_PAGE = 8;
let tab = 0;
let page = 0;

// send(text): manda la frase. seats(): cuántos juegan (la pestaña de equipo solo va en 2v2 y 3v3).
export function initWheel(send, seats) {
  const box = $('#wheel');
  const close = () => box.classList.add('hidden');
  const categories = () => PHRASE_WHEEL.filter((c) => !c.team || seats() > 2);
  const paint = () => {
    const cats = categories();
    tab = Math.min(tab, cats.length - 1);
    const all = cats[tab].phrases;
    const pages = Math.ceil(all.length / PER_PAGE);
    page = (page + pages) % pages;
    const items = all.slice(page * PER_PAGE, (page + 1) * PER_PAGE).map((p, i) => {
      const a = (i / PER_PAGE) * Math.PI * 2 - Math.PI / 2;
      return `<button type="button" class="wh-phrase" data-phrase="${esc(p)}" style="left:${50 + RADIUS * Math.cos(a)}%;top:${50 + RADIUS * Math.sin(a)}%">${esc(p)}</button>`;
    });
    const pager = pages > 1 ? `<div class="wh-pager"><button type="button" data-page="-1" aria-label="Página anterior">‹</button><span>${page + 1}/${pages}</span><button type="button" data-page="1" aria-label="Página siguiente">›</button></div>` : '';
    box.innerHTML = `<div class="wh-disc"></div>${items.join('')}
      <div class="wh-center">${cats.map((c, i) => `<button type="button" class="wh-tab ${i === tab ? 'on' : ''}" data-tab="${i}">${esc(c.label)}</button>`).join('')}${pager}</div>`;
  };
  const toggle = () => {
    if (box.classList.toggle('hidden')) return;
    paint();
  };
  $('#wheel-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggle();
  });
  box.addEventListener('click', (e) => {
    e.stopPropagation();
    const t = e.target.closest('[data-tab]');
    if (t) {
      tab = Number(t.dataset.tab);
      page = 0;
      return paint();
    }
    const nav = e.target.closest('[data-page]');
    if (nav) {
      page += Number(nav.dataset.page);
      return paint();
    }
    const p = e.target.closest('[data-phrase]');
    if (p) {
      send(p.dataset.phrase);
      close();
    }
  });
  document.addEventListener('click', close);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return close();
    if (e.key.toLowerCase() === 'f' && !e.target.closest('input, textarea') && !$('#game').classList.contains('hidden')) toggle();
  });
}
