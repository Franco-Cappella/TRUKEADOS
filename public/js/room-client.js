// Una sala abierta en el navegador: conexión WebSocket, estado del servidor y todo el HUD de la partida.
// El servidor es la única fuente de verdad: el cliente solo muestra `state` y manda acciones.
import { SENAS, SENA_MS, ROUTES, dealMs } from './config.js';
import { cardName, team, ENVIDO_NAMES, TRUCO_NAMES } from './engine.js';
import { lookFor } from './characters.js';
import { $, esc, store, KEYS, myPid, savedName, takeSession } from './dom.js';
import { audio, flick, ding, say } from './audio.js';
import { palitos, drawFace } from './hud.js';

const ACTION_LOCK_MS = 4000; // si el servidor no contesta, se destraban los botones igual
const MAZO_CONFIRM_MS = 3500;
const PREDICT_MS = 4000;
const DEAL_MARGIN_MS = 80; // margen sobre el fin del reparto del servidor (por la latencia) // un evento propio dentro de este tiempo ya se mostró por adelantado
const cardImg = (c, alt = '') => `<img src="${ROUTES.card(c)}" alt="${esc(alt)}">`;

export class RoomClient {
  // scene: TableScene compartida. onNotFound: volver al menú.
  constructor(code, scene, { onNotFound }) {
    this.code = code;
    this.scene = scene;
    this.onNotFound = onNotFound;
    this.closed = false;
    this.st = null;
    this.lastEv = null;
    this.selected = null;
    this.choosingTop = null;
    this.busy = false; // hay una acción en viaje: los botones quedan deshabilitados
    this.gaze = {};
    this.labels = new Map();
    this.retry = 0;
    this.spectate = takeSession(KEYS.spectate, code);
    this.autostart = takeSession(KEYS.autostart, code);
    $('#room-code').textContent = code;
    $('#chat-log').innerHTML = '';
    $('#labels').innerHTML = '';
    document.title = `Truco 3D · Sala ${code}`;
    scene.onLook = (t) => this.sendLook(t);
    scene.onCardClick = (id) => this.clickCard(id);
    scene.onCardDouble = (id) => this.playCard(id, 'normal');
    scene.onFrame = () => this.updateLabels();
    if (store.get(KEYS.zoomTip) !== '1') {
      store.set(KEYS.zoomTip, '1');
      setTimeout(() => this.toast('Mantené apretada la <b>Z</b> para hacer zoom. Arrastrá las cartas de tu mano para ordenarlas.', '', 6000), 1500);
    }
    this.connect();
  }

  get link() {
    return location.origin + ROUTES.room(this.code);
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}${ROUTES.api.ws(this.code)}`);
    this.ws = ws;
    ws.onopen = () => {
      this.send({ t: 'join', pid: myPid(), name: savedName(), spectate: this.spectate });
      this.retry = 0;
    };
    ws.onmessage = (e) => {
      try {
        this.onMessage(JSON.parse(e.data));
      } catch (err) {
        console.error(err);
      }
    };
    ws.onclose = () => {
      if (this.closed) return;
      this.unlock();
      this.toast('Se cortó la conexión. Reconectando…', 'bad');
      setTimeout(() => !this.closed && this.connect(), Math.min(5000, 800 * ++this.retry));
    };
    clearInterval(this.pinger);
    this.pinger = setInterval(() => this.send({ t: 'ping' }), 25000);
  }

  close() {
    this.closed = true;
    clearInterval(this.pinger);
    try {
      this.ws?.close();
    } catch {}
    $('#waiting').classList.add('hidden');
    $('#result').classList.add('hidden');
  }

  send(obj) {
    if (this.ws?.readyState === 1) {
      this.ws.send(JSON.stringify(obj));
      return true;
    }
    return false;
  }

  // Manda una jugada. Mientras viaja, los botones se deshabilitan: así un doble clic no manda dos
  // veces lo mismo (antes eso hacía aparecer "No te toca" justo después de contestar).
  act(a) {
    if (this.busy) return;
    audio();
    if (!this.send({ t: 'act', a })) return;
    this.busy = true;
    clearTimeout(this.busyT);
    this.busyT = setTimeout(() => this.unlock(), ACTION_LOCK_MS);
    this.predict(a);
    this.render();
  }

  // Respuesta inmediata: muestra lo que va a pasar sin esperar al servidor (la carta vuela a la mesa,
  // el globo del canto aparece). El próximo `state` lo confirma; si el servidor lo rechaza, lo corrige.
  predict(a) {
    const g = this.st?.game;
    const me = this.you;
    if (!g?.h || me == null) return;
    const said = {
      truco: () => g.actions.truco && ['call', `¡${g.actions.truco}!`, g.actions.truco],
      envido: () => ['call', `¡${ENVIDO_NAMES[a.kind]}!`, ENVIDO_NAMES[a.kind]],
      quiero: () => ['call', '¡Quiero!', 'Quiero'],
      noquiero: () => ['call', '¡No quiero!', 'No quiero'],
      cantar: () => ['tanto', `${a.value ?? g.h.myTanto}`, `${a.value ?? g.h.myTanto}`],
      buenas: () => ['tanto', 'Son buenas', 'Son buenas'],
      mazo: () => ['mazo', g.n > 2 ? 'Nos vamos al mazo' : 'Me voy al mazo', null],
      nomostrar: () => ['nomuestra', 'Me voy al mazo', null],
    }[a.t]?.();
    if (said) {
      const [type, bubble, voice] = said;
      this.bubble(me, bubble, type === 'mazo' ? '' : 'call', 2600);
      if (voice) say(voice);
      this.predicted = { type, until: Date.now() + PREDICT_MS };
    }
    if (a.t === 'play' || a.t === 'play2') {
      const round = g.h.r;
      // mismas reglas que el motor: tapada o fuera de turno se quema; la de arriba de dos encimadas también
      const faceDown = a.mode === 'down';
      const cards = a.t === 'play'
        ? [{ c: a.card, faceDown, round, burned: faceDown || !g.actions.play }]
        : [{ c: a.bottom, under: true, round }, { c: a.top, over: true, burned: false, round: round + 1 }];
      const used = new Set(cards.map((p) => p.c));
      this.scene.setMyCards(g.h.myCards.filter((c) => !used.has(c)), null);
      this.scene.syncTable(g.h.table.map((list, s) => (s === me ? list.concat(cards) : list)), { animate: true });
      flick();
      this.predicted = { type: 'play', until: Date.now() + PREDICT_MS };
    }
  }

  // Al terminar la ronda, la de arriba de dos encimadas de un rival pasa a verse quemada: se avisa una vez,
  // así en la ronda siguiente se le puede pedir "mostrá las dos".
  noticeBurned(prevGame, g) {
    if (!prevGame?.h || prevGame.handNo !== g.handNo) return;
    g.h.table.forEach((list, s) => {
      if (s === this.you) return;
      list.forEach((p, i) => {
        if (p.over && p.burned && !prevGame.h.table[s]?.[i]?.burned) {
          this.toast(`La carta de arriba de ${esc(this.nameOf(s))} estaba quemada: tiró dos encimadas. Pedile que muestre las dos.`, 'bad', 5000);
        }
      });
    });
  }

  // ¿Este evento propio ya se mostró por adelantado con predict()?
  wasPredicted(e) {
    const p = this.predicted;
    if (!p || e.seat !== this.you || Date.now() > p.until) return false;
    const type = e.type === 'call' ? 'call' : e.type;
    if (type !== p.type) return false;
    this.predicted = null;
    return true;
  }

  unlock() {
    clearTimeout(this.busyT);
    if (!this.busy) return;
    this.busy = false;
    this.render();
  }

  // ---------------------------------------------------- mensajes
  onMessage(m) {
    switch (m.t) {
      case 'state':
        this.busy = false;
        clearTimeout(this.busyT);
        return this.onState(m);
      case 'notfound':
        alert('Esa sala no existe o ya cerró.');
        return this.onNotFound();
      case 'error':
        this.unlock();
        return this.toast(esc(m.msg), 'bad');
      case 'chat-history':
        $('#chat-log').innerHTML = '';
        m.messages.forEach((x) => this.addChat(x, false));
        return;
      case 'chat':
        return this.addChat(m.msg, true);
      case 'gaze-all':
        for (const [s, t] of Object.entries(m.gaze)) this.setGaze(Number(s), t);
        return;
      case 'gaze':
        return this.setGaze(m.seat, m.target);
      case 'sena':
        // Sin carteles: la seña solo se ve en la cara del que la hace (si lo estabas mirando).
        if (SENAS[m.sena] && !m.self) this.scene.showSena(m.seat, m.sena);
        return;
    }
  }

  setGaze(seat, target) {
    this.gaze[seat] = target;
    this.scene.setGaze(seat, target);
  }

  nameOf(seat, rel = false) {
    const n = this.st?.room.seats[seat]?.name || `Jugador ${seat + 1}`;
    if (!rel || this.you == null) return n;
    return `${n} (${team(seat) === team(this.you) ? 'compañero' : 'rival'})`;
  }

  teamLabel(t) {
    if (this.you != null) return t === team(this.you) ? 'Nosotros' : 'Ellos';
    return this.st.room.seats.filter((_, i) => team(i) === t).map((s) => s?.name).join(' y ');
  }

  onState(st) {
    const scene = this.scene;
    const first = !this.st;
    const prev = this.st;
    this.st = st;
    this.you = st.you;
    const seats = st.room.seats;
    const g = st.game;
    scene.setLayout({ n: seats.length, me: st.you ?? 0, spectator: st.you == null });
    const layoutKey = `${seats.length}:${st.you}`;
    if (layoutKey !== this.layoutKey) {
      this.layoutKey = layoutKey;
      this.labels.clear();
      $('#labels').innerHTML = '';
      for (const [s, t] of Object.entries(this.gaze)) scene.setGaze(Number(s), t);
    }
    if (st.you != null && seats[st.you]) scene.setMyLook(lookFor(seats[st.you].name, st.you));

    if (g?.h) {
      // mano nueva: se anima el mezclado, el corte y el reparto (las cartas aparecen de a una)
      if (st.dealLeft > 0 && g.handNo !== this.dealtHand) this.startDeal(g, st.dealLeft);
      this.dealtHand = g.handNo;
      this.handNo = g.handNo;
      scene.setDealer(g.dealer);
      const canPick = g.actions.play || g.actions.throwOut;
      if (!canPick || (this.selected && !g.h.myCards.includes(this.selected))) this.selected = null;
      if (this.choosingTop && (!g.actions.canDouble || !g.h.myCards.includes(this.choosingTop))) this.choosingTop = null;
      this.refreshHand();
      scene.syncTable(g.h.table, { animate: !first });
      if (!first) this.noticeBurned(prev?.game, g);
      const evs = g.ev || [];
      const lastId = evs.length ? evs[evs.length - 1].id : 0;
      if (this.lastEv !== null && !first) for (const e of evs) if (e.id > this.lastEv) this.onEvent(e, g);
      this.lastEv = Math.max(this.lastEv ?? 0, lastId);
      const myTurn = (gg) => gg?.h?.phase === 'play' && gg.waiting.seats.includes(st.you);
      if (myTurn(g) && !myTurn(prev?.game)) ding();
    } else {
      scene.setPlayers(seats, null);
      scene.setMyCards([], null);
      scene.syncTable([], { animate: false });
      this.lastEv = null;
    }

    // arranque automático en modo práctica
    if (this.autostart && st.isHost && st.room.status === 'lobby') {
      this.autostart = false;
      this.send({ t: 'start', fillBots: true });
    }
    this.render();
  }

  // Muestra mis cartas y las de los demás según lo que ya se repartió.
  refreshHand() {
    const g = this.st?.game;
    if (!g?.h) return;
    const counts = this.dealing ? this.dealing.counts : g.h.handCounts;
    this.scene.setPlayers(this.st.room.seats, counts);
    const mine = this.dealing ? g.h.myCards.slice(0, this.dealing.counts[this.you] ?? 0) : g.h.myCards;
    this.scene.setMyCards(mine, this.selected);
  }

  // Mientras se reparte no hay botones ni se puede tirar: el servidor rechazaría la jugada.
  // Termina cuando terminan la animación y el tiempo de reparto del servidor (`left` ms), lo último.
  startDeal(g, left = dealMs(g.n)) {
    const counts = Array(g.n).fill(0);
    const deal = { counts, anim: false, server: false };
    this.dealing = deal;
    this.selected = null;
    this.choosingTop = null;
    const finish = () => {
      if (this.dealing !== deal) return;
      this.dealing = null;
      this.refreshHand();
      this.render();
    };
    const done = (part) => {
      deal[part] = true;
      if (deal.anim && deal.server) finish();
    };
    setTimeout(() => done('server'), left + DEAL_MARGIN_MS);
    // si la pestaña estuvo oculta la animación se congela: igual se destraba poco después del servidor
    setTimeout(finish, left + DEAL_MARGIN_MS + 1500);
    this.scene.dealAnim({
      dealer: g.dealer,
      cutter: g.h.cutter,
      mano: g.h.mano,
      n: g.n,
      onCard: (seat) => {
        if (this.dealing !== deal) return;
        counts[seat]++;
        flick(0.08, 0.05);
        this.refreshHand();
      },
      onDone: () => done('anim'),
    });
  }

  onEvent(e, g) {
    const me = this.you;
    const name = (s) => esc(this.nameOf(s));
    const shown = this.wasPredicted(e); // lo mío ya se mostró al tocar el botón
    switch (e.type) {
      case 'call':
        if (shown) break;
        this.bubble(e.seat, `¡${e.text}!`, 'call', 2600);
        say(e.text);
        break;
      case 'tanto': {
        if (shown) break;
        const txt = e.value == null ? 'Son buenas' : `${e.value}`;
        this.bubble(e.seat, txt, 'call', 4000);
        say(txt);
        break;
      }
      case 'mazo':
        if (!shown) this.bubble(e.seat, g.n > 2 ? 'Nos vamos al mazo' : 'Me voy al mazo', '', 2400);
        flick(0.15, 0.2);
        break;
      case 'play':
        if (!shown) flick();
        // dos encimadas NO se avisa: se descubre al terminar la ronda (ver noticeBurned)
        if (e.outOfTurn) {
          const who = e.seat === me ? 'Tiraste' : `${name(e.seat)} tiró`;
          this.toast(`${who} fuera de turno: la carta se quema (vale como un 4).`, 'bad', 3500);
        }
        break;
      case 'round':
        if (g.ayudas) {
          const t = e.result === 'parda' ? 'Parda' : `${e.result === team(me ?? 0) ? 'Ganamos' : 'Perdimos'} la ronda ${e.round + 1}`;
          this.toast(t, '');
        }
        break;
      case 'denuncia':
        this.bubble(e.seat, 'A ver, mostrá las dos', 'call', 2600);
        say('A ver, mostrá las dos');
        if (e.ok) this.toast(`${name(e.target)} levantó la carta quemada: abajo había ${e.cards.map((c) => esc(cardName(c))).join(' y ')}.<br>${e.cards.map((c) => cardImg(c)).join('')}`, 'good', 5000);
        else this.toast(`${name(e.target)} no había tirado dos cartas encimadas.`, '', 3500);
        break;
      case 'hand-end': {
        const why = { noquiero: 'no quisieron', mazo: 'se fueron al mazo' }[e.reason] || '';
        const us = me != null && e.team === team(me);
        this.toast(`${this.teamLabel(e.team)} ${us ? 'ganamos' : 'ganan'} la mano ${why} (${e.pts} del truco)`, us ? 'good' : '');
        break;
      }
      case 'show': {
        const imgs = e.cards.map((c) => cardImg(c, cardName(c))).join('');
        this.bubble(e.seat, e.ok ? `Mirá: ${e.value}` : `Tenía ${e.value}...`, 'call', 3000);
        if (e.ok) this.toast(`${name(e.seat)} muestra sus ${e.value}<br>${imgs}`, 'good', 5000);
        else this.toast(`${name(e.seat)} cantó ${e.said} pero tenía ${e.value}<br>${imgs}<br>Pierde los puntos del envido.`, 'bad', 6000);
        break;
      }
      case 'envido-done': {
        const parts = e.said.map((x) => `${name(x.seat)}: ${x.value == null ? 'son buenas' : x.value}`).join(' · ');
        const us = me != null && e.team === team(me);
        this.toast(`Envido para ${this.teamLabel(e.team).toLowerCase()} (${name(e.seat)} con ${e.value}). ${parts}`, us ? 'good' : '', 5000);
        break;
      }
      case 'nomuestra':
        if (!shown) this.bubble(e.seat, 'Me voy al mazo', '', 2400);
        flick(0.15, 0.2);
        if (e.seat !== me && me != null && team(e.seat) !== team(me)) this.toast(`${name(e.seat)} se fue al mazo sin mostrar los tantos. ¿Le reclamás? Si no, valen.`, 'bad', 5000);
        break;
      case 'reclamo':
        this.bubble(e.seat, '¡A ver esos tantos!', 'call', 2600);
        say('¡A ver esos tantos!');
        this.toast(`${name(e.seat)} reclamó: ${name(e.target)} no mostró. Pierde los puntos del envido.`, 'bad', 5000);
        break;
      case 'show-timeout':
        this.toast(`Nadie le pidió a ${name(e.seat)} que muestre: los tantos valen.`, '', 3500);
        break;
      case 'deal':
        flick(0.12, 0.25);
        this.selected = null;
        this.toast(`Mano ${e.hand}: reparte ${name(e.seat)} y corta ${name(e.cutter)}`, '', 2200);
        break;
      case 'points':
        if (e.why.startsWith('envido')) this.toast(`Envido: ${e.pts} para ${this.teamLabel(e.team)}`, '', 2500);
        break;
    }
  }

  // ---------------------------------------------------- cartas
  clickCard(id) {
    const g = this.st?.game;
    if (this.dealing) return;
    if (this.busy) return;
    if (!g?.actions.play) {
      // fuera de turno se puede elegir una carta, pero tirarla la quema: solo con el botón, nunca de un toque
      if (!g?.actions.throwOut) return this.toast('Todavía no es tu turno', '', 1200);
      this.selected = this.selected === id ? null : id;
    } else if (this.choosingTop) {
      // tiro doble: la primera elegida va abajo (juega), la segunda arriba (queda quemada)
      const bottom = this.choosingTop;
      this.choosingTop = null;
      this.selected = null;
      if (id !== bottom) return this.act({ t: 'play2', bottom, top: id });
    } else if (this.selected === id) {
      return this.playCard(id, 'normal'); // tocar de nuevo la carta elegida la tira
    } else {
      this.selected = id;
    }
    this.scene.setMyCards(g.h.myCards, this.selected);
    this.render();
  }

  // mode: 'normal' | 'down' (tapada) | 'double' (dos encimadas) | 'burn' (fuera de turno, se quema)
  playCard(id, mode) {
    const g = this.st?.game;
    if (!id || this.dealing || this.busy) return;
    if (mode === 'burn') {
      if (!g?.actions.throwOut) return;
      this.selected = null;
      return this.act({ t: 'play', card: id });
    }
    if (!g?.actions.play) return;
    if (mode === 'double') {
      this.choosingTop = id;
      return this.render();
    }
    this.selected = null;
    this.act({ t: 'play', card: id, mode });
  }

  sendLook(target) {
    clearTimeout(this.lookT);
    this.lookT = setTimeout(() => this.send({ t: 'look', target: target ?? null }), 90);
    this.renderLookBar();
  }

  // ---------------------------------------------------- etiquetas 3D (nombres y globos)
  labelFor(seat) {
    let l = this.labels.get(seat);
    if (!l) {
      const el = document.createElement('div');
      el.className = 'tag3d';
      el.innerHTML = '<div class="bubbles"></div><div class="nameplate"></div>';
      $('#labels').appendChild(el);
      l = { el, plate: el.querySelector('.nameplate'), bubbles: el.querySelector('.bubbles') };
      this.labels.set(seat, l);
    }
    return l;
  }

  updateLabels() {
    if (!this.st) return;
    this.st.room.seats.forEach((p, seat) => {
      if (seat === this.you) return;
      const l = this.labelFor(seat);
      const pos = this.scene.screenPos(seat);
      const show = pos?.visible && p;
      l.el.style.opacity = show ? '1' : '0';
      if (!show) return;
      l.el.style.left = pos.x + 'px';
      l.el.style.top = pos.y + 'px';
    });
    // mis globos, abajo al centro
    const mine = this.labelFor('me');
    mine.el.style.left = '50%';
    mine.el.style.top = '62%';
    mine.plate.style.display = 'none';
  }

  bubble(seat, text, kind = '', ms = 2500) {
    const l = this.labelFor(seat === this.you ? 'me' : seat);
    const b = document.createElement('div');
    b.className = 'bubble ' + kind;
    b.textContent = text;
    l.bubbles.appendChild(b);
    while (l.bubbles.children.length > 2) l.bubbles.firstChild.remove();
    if (seat !== this.you) this.scene.speak(seat, Math.min(2000, 500 + text.length * 60));
    setTimeout(() => b.remove(), ms);
  }

  // ---------------------------------------------------- chat
  addChat(msg, live) {
    const log = $('#chat-log');
    const div = document.createElement('div');
    if (msg.system) {
      div.className = 'sys';
      div.textContent = msg.text;
    } else {
      const t = msg.seat == null ? '' : `t${team(msg.seat)}`;
      div.innerHTML = `<b class="${t}">${esc(msg.name)}:</b> ${esc(msg.text)}`;
      if (live && msg.seat != null) this.bubble(msg.seat, msg.text, 'chat', 4500);
    }
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    if (live && $('#chat').classList.contains('hidden') && !msg.system) $('#chat-badge').classList.remove('hidden');
  }

  // ---------------------------------------------------- HUD
  render() {
    const st = this.st;
    if (!st) return;
    this.renderScore();
    this.renderStatus();
    this.renderActions();
    this.renderLookBar();
    this.renderPlates();
    this.renderWaiting();
    this.renderResult();
    $('#spect').textContent = st.room.spectators ? `${st.room.spectators} mirando` : '';
    const playing = !!st.game && st.room.status === 'playing';
    $('#tools').classList.toggle('hidden', this.you == null || !playing);
    const panel = $('#panel');
    panel.classList.toggle('hidden', !playing);
    panel.classList.toggle('busy', this.busy);
    // Si el panel ocupa todo el ancho (celular), la mano sube para no quedar tapada.
    const r = panel.getBoundingClientRect();
    const full = playing && r.width > window.innerWidth * 0.6;
    this.scene.setBottomInset(full ? window.innerHeight - r.top + 8 : 0);
  }

  renderScore() {
    const st = this.st;
    const score = st.game?.score || [0, 0];
    const target = st.game?.target || st.room.cfg.target;
    const order = this.you != null ? [team(this.you), 1 - team(this.you)] : [0, 1];
    const names = this.you != null ? ['Nosotros', 'Ellos'] : ['Equipo A', 'Equipo B'];
    const el = $('#anotador');
    const key = `${score}|${target}|${order}`;
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    el.innerHTML = `
      <div class="an-head">${order.map((t, i) => `<span class="t${t}">${names[i]}</span>`).join('')}</div>
      <div class="an-body">${order.map((t) => palitos(score[t], target)).join('<i class="an-sep"></i>')}</div>
      <div class="an-foot">${order.map((t) => `<b>${score[t]}</b>`).join('')}<small>a ${target}</small></div>`;
  }

  renderStatus() {
    const el = $('#status-line');
    const g = this.st.game;
    el.classList.remove('mine');
    if (!g || this.st.room.status !== 'playing') return (el.textContent = '');
    if (this.dealing) return (el.textContent = `Reparte ${this.nameOf(g.dealer)}, corta ${this.nameOf(g.h.cutter)}`);
    const w = g.waiting;
    const me = this.you;
    const mine = w.seats.includes(me);
    const who = (s) => this.nameOf(s);
    const texts = {
      play: () => (mine ? 'Te toca jugar' : `Juega ${who(w.seats[0])}`),
      envido: () => {
        const calls = g.h.envido.calls.map((c) => ENVIDO_NAMES[c]).join(' + ');
        return mine ? `Te cantaron ${calls}: ¿querés?` : `${calls}: esperando respuesta`;
      },
      truco: () => {
        const name = TRUCO_NAMES[g.h.truco.pending.level];
        return mine ? `Te cantaron ${name}: ¿querés?` : `${name}: esperando respuesta`;
      },
      declare: () => (mine ? 'Cantá tus tantos' : `${who(w.seats[0])} canta los tantos`),
      'next-hand': () => 'Fin de la mano',
      show: () => {
        const sh = g.h.show;
        if (sh.folded) return sh.seat === me ? 'Te fuiste al mazo sin mostrar' : `${who(sh.seat)} se fue al mazo sin mostrar`;
        return mine ? `Ganaste el envido con ${sh.value}: mostrá las cartas` : `${who(sh.seat)} tiene que mostrar sus ${sh.value}`;
      },
    };
    let t = texts[w.kind]?.() || '';
    let hint = '';
    if (this.choosingTop) {
      t = 'Dos encimadas';
      hint = 'Elegí la de arriba: será tu carta de la ronda siguiente, quemada (vale un 4).';
    } else if (mine && w.kind === 'play') hint = 'Tocá una carta para elegirla y tocala de nuevo para tirarla. Arrastrala para ordenar.';
    else if (!mine && this.selected && g.actions.throwOut) hint = 'No es tu turno: si la tirás ahora, se quema y vale como un 4.';
    else if (g.n > 2 && w.kind === 'play' && g.h.r === 0 && g.h.pies?.includes(me) && g.h.envido.state === 'none') hint = 'Sos pie: el envido lo cantás vos, en tu turno.';
    el.innerHTML = esc(t) + (hint ? `<small>${esc(hint)}</small>` : '');
    el.classList.toggle('mine', mine);
  }

  renderActions() {
    const g = this.st.game;
    const box = $('#actions');
    const cardBox = $('#card-actions');
    box.classList.toggle('busy', this.busy);
    const show = g && this.you != null && this.st.room.status === 'playing' && !this.dealing;
    const a = g?.actions;
    const next = show ? this.buildActions(g, a) : document.createElement('div');
    // Solo se reemplazan los botones si cambiaron: así no parpadean ni se pierde un clic a mitad de camino
    // (y no se borra el número que estás escribiendo para mentir los tantos).
    if (box.dataset.key !== next.innerHTML) {
      box.dataset.key = next.innerHTML;
      box.replaceChildren(...next.children);
    }
    // carta elegida: en tu turno, Tirar / Dos encimadas / Tapada; fuera de turno, solo "Tirarla igual (se quema)"
    const burnOnly = !!(show && !a.play && a.throwOut && this.selected);
    const cardOn = !!(show && this.selected && ((a.play && !this.choosingTop) || burnOnly));
    cardBox.classList.toggle('hidden', !cardOn);
    if (cardOn) {
      const btn = (mode) => cardBox.querySelector(`[data-play="${mode}"]`);
      const set = (mode, visible, enabled = true) => {
        btn(mode).classList.toggle('hidden', !visible);
        btn(mode).disabled = this.busy || !enabled;
      };
      set('normal', !burnOnly);
      set('double', !burnOnly, a.canDouble);
      set('down', !burnOnly, a.canDown);
      set('burn', burnOnly);
    }
    if (show) this.renderDenuncias(a);
  }

  // Arma los grupos de botones (en un contenedor suelto) según lo que el motor permite ahora.
  buildActions(g, a) {
    const out = document.createElement('div');
    const ORDER = ['tantos', 'mostrar', 'resp', 'cantar', 'mano'];
    const groups = {};
    const group = (key, label) => {
      if (!groups[key]) {
        const el = document.createElement('div');
        el.className = 'act-group';
        el.innerHTML = `<span class="lbl">${label}</span><div class="btns"></div>`;
        groups[key] = el;
      }
      return groups[key].querySelector('.btns');
    };
    const add = (key, label, text, cls, fn, title) => {
      const b = document.createElement('button');
      b.className = 'btn ' + cls;
      b.textContent = text;
      b.disabled = this.busy;
      if (title) b.title = title;
      b.onclick = fn;
      group(key, label).appendChild(b);
    };
    const acting = (action) => () => this.act(action);

    if (a.cantar) {
      const min = a.minTanto ?? 0;
      if (g.h.myTanto >= min) add('tantos', 'Tus tantos', `Cantar ${g.h.myTanto}`, 'call', acting({ t: 'cantar' }), 'Tus tantos de verdad');
      // mentir: cantar otro número (si te piden que muestres, perdés los puntos del envido)
      const wrap = document.createElement('span');
      wrap.className = 'lie';
      wrap.title = 'Cantar otro número. Si te piden que muestres, perdés los puntos del envido.';
      wrap.innerHTML = `<input type="number" min="${min}" max="33" value="${Math.max(min, Math.min(33, g.h.myTanto + 3))}"><button class="btn"${this.busy ? ' disabled' : ''}>Cantar otro</button>`;
      wrap.querySelector('button').onclick = () => this.act({ t: 'cantar', value: Number(wrap.querySelector('input').value) });
      group('tantos', 'Tus tantos').appendChild(wrap);
    }
    if (a.buenas) add('tantos', 'Tus tantos', 'Son buenas', '', acting({ t: 'buenas' }));
    if (a.mostrar) add('mostrar', 'Envido', 'Mostrar mis cartas', 'good', acting({ t: 'mostrar' }), 'Si cantaste otro número y mostrás, perdés los puntos del envido');
    if (a.nomostrar) add('mostrar', 'Envido', 'Irme al mazo sin mostrar', '', acting({ t: 'nomostrar' }), 'Si nadie te reclama en unos segundos, los tantos valen; si te reclaman, los perdés');
    if (a.reclamar) add('mostrar', 'Envido', 'A ver esos tantos', 'call', acting({ t: 'reclamar' }), 'Si no los muestra, pierde los puntos del envido');
    if (a.quiero) add('resp', 'Responder', 'Quiero', 'good', acting({ t: 'quiero' }));
    if (a.noquiero) add('resp', 'Responder', 'No quiero', 'danger', acting({ t: 'noquiero' }));
    if (a.truco) add('cantar', 'Cantar', a.truco, 'call', acting({ t: 'truco' }));
    for (const k of a.envido) add('cantar', 'Cantar', ENVIDO_NAMES[k], 'call', acting({ t: 'envido', kind: k }), `Tenés ${g.h.myTanto} de envido`);
    if (a.mazo) {
      // dos toques: el primero pide confirmación (sin ventanas del navegador)
      add('mano', 'Mano', this.mazoArmed ? 'Sí, me voy' : 'Irse al mazo', this.mazoArmed ? 'danger' : '', () => {
        if (this.mazoArmed) {
          this.mazoArmed = false;
          return this.act({ t: 'mazo' });
        }
        this.mazoArmed = true;
        clearTimeout(this.mazoT);
        this.mazoT = setTimeout(() => {
          this.mazoArmed = false;
          this.render();
        }, MAZO_CONFIRM_MS);
        this.render();
      });
    }
    if (a.play && this.choosingTop) {
      add('mano', 'Mano', 'Cancelar', '', () => {
        this.choosingTop = null;
        this.render();
      });
    }
    for (const k of ORDER) if (groups[k]) out.appendChild(groups[k]);
    return out;
  }

  renderDenuncias(a) {
    const tm = $('#trampa-menu');
    tm.innerHTML = '<div class="tip">Si un rival tiró <b>dos cartas encimadas</b> (la de arriba queda quemada), pedile que la levante: todos ven la de abajo. No suma ni resta puntos.</div>';
    if (!a.denunciar.length) tm.innerHTML += '<div class="tip">Ahora no se puede pedir.</div>';
    for (const s of a.denunciar) {
      const b = document.createElement('button');
      b.className = 'item';
      b.innerHTML = `<span>Que <b>${esc(this.nameOf(s))}</b> muestre las dos<small>“Levantá esa carta, a ver qué hay abajo”</small></span>`;
      b.onclick = () => {
        tm.classList.add('hidden');
        this.act({ t: 'denuncia', target: s });
      };
      tm.appendChild(b);
    }
  }

  renderLookBar() {
    const bar = $('#look-bar');
    if (!this.st || this.you == null || this.st.room.status === 'lobby') return (bar.innerHTML = '');
    const cur = this.scene.lookTarget;
    let html = '<span class="lbl">Mirar a</span>';
    this.st.room.seats.forEach((p, s) => {
      if (s === this.you || !p) return;
      const rel = team(s) === team(this.you) ? 'Compañero' : 'Rival';
      html += `<button class="btn ghost ${cur === s ? 'on' : ''}" data-look="${s}"><small>${rel}</small> ${esc(p.name)}</button>`;
    });
    html += `<button class="btn ghost ${cur === 'table' ? 'on' : ''}" data-look="table">La mesa</button>`;
    if (bar.dataset.html !== html) {
      bar.innerHTML = html;
      bar.dataset.html = html;
    }
  }

  renderPlates() {
    const st = this.st;
    const g = st.game;
    st.room.seats.forEach((p, seat) => {
      if (seat === this.you) return;
      const l = this.labelFor(seat);
      if (!p) return (l.plate.innerHTML = '');
      const chips = [];
      if (g?.h) {
        if (g.dealer === seat) chips.push('reparte');
        if (g.h.mano === seat) chips.push('mano');
        if (g.n > 2 && g.h.pies?.includes(seat)) chips.push('pie');
        if (g.h.mazo[seat]) chips.push('al mazo');
      }
      if (p.bot) chips.unshift('bot');
      if (this.you != null && team(seat) === team(this.you)) chips.unshift('compañero');
      const looking = this.you != null && this.gaze[seat] === this.you ? '<span class="chip eye">te mira</span>' : '';
      const turn = g && st.room.status === 'playing' && g.waiting.seats.includes(seat);
      l.plate.className = `nameplate t${team(seat)} ${turn ? 'turn' : ''}`;
      l.plate.innerHTML = `${esc(p.name)} ${looking} ${chips.map((c) => `<span class="chip">${c}</span>`).join('')} ${p.online ? '' : '<span class="off">desconectado</span>'}`;
    });
  }

  renderWaiting() {
    const st = this.st;
    const el = $('#waiting');
    if (st.room.status !== 'lobby') return el.classList.add('hidden');
    el.classList.remove('hidden');
    const r = st.room;
    const host = st.isHost;
    const link = this.link;
    const seatHtml = (i) => {
      const p = r.seats[i];
      const me = i === st.you;
      if (!p) {
        return `<div class="seat empty"><span class="nm">Lugar libre</span>
          <button class="btn small" data-sit="${i}">Sentarme</button>
          ${host ? `<button class="btn small" data-bot="${i}">Agregar bot</button>` : ''}</div>`;
      }
      return `<div class="seat ${me ? 'me' : ''}"><span class="nm">${esc(p.name)}${p.bot ? ' <span class="muted">(bot)</span>' : ''}${p.host ? ' <span class="muted">(anfitrión)</span>' : ''}${me ? ' (vos)' : ''}</span>
        ${!p.online ? '<span class="muted">desconectado</span>' : ''}
        ${host && p.bot ? `<button class="btn small" data-unbot="${i}">Sacar</button>` : ''}
        ${host && !p.bot && !me && !p.host ? `<button class="btn small" data-kick="${i}">Echar</button>` : ''}</div>`;
    };
    const cols = [0, 1]
      .map((t) => {
        const idx = r.seats.map((_, i) => i).filter((i) => team(i) === t);
        return `<div class="team-col t${t}"><h3>Equipo ${t === 0 ? 'A' : 'B'}</h3>${idx.map(seatHtml).join('')}</div>`;
      })
      .join('');
    const cfg = r.cfg;
    const seg = (name, opts, cur) =>
      `<div class="seg" data-cfg="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    el.innerHTML = `<div class="card-box">
      <h2>Sala ${esc(r.code)} · ${esc(cfg.mode.replace('v', ' vs '))}</h2>
      <div class="muted">${cfg.target} puntos · ${cfg.isPublic ? 'pública' : 'privada'}${cfg.ayudas ? ' · con ayudas' : ''}</div>
      <div class="share">
        <span class="big-code">${esc(r.code)}</span>
        <button class="btn small" data-copy="${esc(link)}">Copiar enlace</button>
        <button class="btn small" data-copy="${esc(r.code)}">Copiar código</button>
        <a class="btn small" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent('¿Un truquito? Entrá a mi mesa: ' + link)}">WhatsApp</a>
        ${navigator.share ? '<button class="btn small" data-share="1">Compartir…</button>' : ''}
      </div>
      <div class="seats">${cols}</div>
      ${host ? `<div class="field">Modo ${seg('mode', [['1v1', '1 vs 1'], ['2v2', '2 vs 2'], ['3v3', '3 vs 3']], cfg.mode)}</div>
        <div class="field">Puntos ${seg('target', [[30, '30'], [15, '15']], cfg.target)}</div>
        <div class="field">Sala ${seg('isPublic', [[0, 'Privada'], [1, 'Pública']], cfg.isPublic ? 1 : 0)}</div>
        <label class="check"><input type="checkbox" data-ayudas ${cfg.ayudas ? 'checked' : ''}> Mostrar quién gana cada ronda</label>
        ${cfg.mode !== '1v1' ? `<label class="check"><input type="checkbox" data-trucoseg ${cfg.trucoDesdeSegunda ? 'checked' : ''}> En equipos, el truco se canta recién desde segunda</label>` : ''}
        <div class="row">
          <button class="btn primary big" data-start="0" ${r.seats.every(Boolean) ? '' : 'disabled'}>Empezar</button>
          <button class="btn big" data-start="1">Empezar llenando con bots</button>
        </div>` : '<p class="hint">Esperando que el anfitrión empiece la partida…</p>'}
      ${st.you == null ? '<p class="hint">Estás mirando. Tocá “Sentarme” en un lugar libre para jugar.</p>' : ''}
    </div>`;
  }

  renderResult() {
    const st = this.st;
    const el = $('#result');
    const g = st.game;
    if (st.room.status !== 'ended' || !g) return el.classList.add('hidden');
    el.classList.remove('hidden');
    const w = g.winner;
    const won = this.you != null && team(this.you) === w;
    const names = st.room.seats.filter((_, i) => team(i) === w).map((s) => s?.name).join(' y ');
    el.innerHTML = `<div class="card-box">
      <h2>${this.you == null ? '¡Terminó!' : won ? '¡Ganaron!' : 'Perdieron'}</h2>
      <div class="muted">Ganan ${esc(names)}</div>
      <div class="final">${g.score[w]} – ${g.score[1 - w]}</div>
      <div class="row center">
        ${this.you != null ? '<button class="btn primary big" data-rematch="1">Revancha</button>' : ''}
        ${st.isHost ? '<button class="btn big" data-tolobby="1">Volver a la sala</button>' : ''}
        <button class="btn big" data-exit="1">Salir</button>
      </div></div>`;
  }

  // html: el que llama escapa lo que venga de otros jugadores.
  toast(html, kind = '', ms = 3200) {
    const area = $('#toast-area');
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.innerHTML = html;
    if ([...area.children].some((x) => x.innerHTML === t.innerHTML)) return; // el mismo aviso no se apila
    area.appendChild(t);
    while (area.children.length > 4) area.firstChild.remove();
    setTimeout(() => t.remove(), ms);
  }

  // Manda una seña y muestra el "espejo": así te ven los que te miran.
  doSena(id) {
    this.send({ t: 'sena', sena: id });
    const mirror = drawFace($('#mirror'), lookFor(savedName(), this.you), SENAS[id].expr);
    mirror.classList.remove('hidden');
    clearTimeout(this.mirrorT);
    this.mirrorT = setTimeout(() => mirror.classList.add('hidden'), SENA_MS);
  }
}
