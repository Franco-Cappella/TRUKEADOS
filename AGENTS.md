# Guía para agentes (y personas) que trabajen en Trukeados

Leé esto antes de tocar código. Las reglas del juego están en [docs/REGLAS.md](docs/REGLAS.md).

## Qué es
Trukeados: truco argentino online en 3D (1v1, 2v2, 3v3). El nombre está en `APP_NAME` (config.js) y,
en lo estático, en `index.html`, `package.json` y `wrangler.jsonc`. Un Cloudflare Worker sirve los archivos de `public/` y
un Durable Object por sala (`TrucoRoom`) es la **única fuente de verdad**: valida cada jugada con el
motor de reglas y manda a cada jugador solo lo que puede ver. **Sin cuenta no se juega**: la sesión es de
Supabase Auth y los perfiles viven en la base de Supabase (ver [docs/CUENTAS.md](docs/CUENTAS.md)). El cliente es HTML/CSS/JS sin build ni
frameworks (Three.js como módulo en `public/vendor/`).

## Mapa del código
```
src/                      SERVIDOR (Cloudflare Worker)
  index.js                rutas /api (config, perfil, crear sala, partida rápida, lobby, WebSocket)
  auth.js                 sesión de Supabase (verifica el token) y perfiles (lectura/alta en la base)
  recorder.js             graba la partida en curso (estado al repartir cada mano + jugadas) para el historial
  matches.js              partida terminada → Supabase (ELO, monedas, historial) y lectura del historial
  shop.js                 tienda: comprar (buy_item) y elegir lo que tenés puesto (profiles.equipped)
  social.js               amigos por nombre de usuario, foto de perfil y ranking
  show-tables.js          mesas en juego del lobby: 7 a 10 partidas entre usuarios automáticos que se pueden mirar
  matchmaking.js          partida rápida: nombre, ELO y ropa de los rivales automáticos que completan la mesa
  truco-room.js           Durable Object: sala, bots, AFK, señas, chat, alarmas
  lobby.js                Durable Object "global": mesas públicas para el menú y los cerebros de los bots
  util.js                 validación de nombres/pid, códigos de sala, json(), rng()
public/js/                CLIENTE (los marcados con * también los usa el servidor)
  config.js *             CONSTANTES COMPARTIDAS: modos, tiempos, rutas, señas, bots y opciones de sala (ROOM_OPTIONS)
  cards.js *              VALOR DE LAS CARTAS: jerarquía, envido, flor y muestra (funciones puras)
  engine.js *             REGLAS y estado de la mano (sin DOM): newGame, act, actionsFor, waitingFor, viewFor
  bot.js *                jugador automático: Monte Carlo + lo aprendido de cada rival, faroles y trampas
  brain.js *              lo que aprenden los bots de cada persona (regresiones logísticas online)
  replay.js *             formato del registro de una partida y cómo reproducirla/describirla
  analysis.js *           análisis post-partida (califica decisiones con evaluateDecision de bot.js)
  analysis-worker.js      Web Worker que corre el análisis
  elo.js *                ELO por equipos: K alto al principio que baja con las partidas, y premio por escalones
  talk.js *               lo que dicen los bots en el chat: frases (BOT_TALK) y cuándo decirlas
  theme.js                COLORES del JS (escena 3D, cartas quemadas, anotador, paletas de personajes)
  dom.js                  $, esc, store (localStorage seguro), KEYS, api() (manda el token de la sesión)
  auth.js                 Supabase Auth en el navegador: iniciar sesión, perfil (loadMe), cerrar sesión
  account.js              pantallas de entrada: iniciar sesión / crear cuenta y elegir el nombre
  audio.js                sonidos sintetizados y voces: audios de public/voz y, para lo escrito a mano, la voz del dispositivo
  voices.js *             qué voz usa cada asiento y cómo se llama el audio de cada frase
  wheel.js                ruleta de frases de la partida (botón Frases o tecla F)
  hud.js                  anotador de palitos, ayuda, caras de las señas, frases rápidas
  menu.js                 menú con barra lateral: jugar, mesas, partidas, amigos, ranking, tienda, taquilla y perfil
  social.js               pantallas de amigos y ranking, y subir la foto de perfil
  history.js              lista de partidas y revisión de una partida (/partida/ID): 3D, íconos, gráfico y precisión
  shop.js                 pestañas Tienda y Personalizar
  room-client.js          una sala abierta: WebSocket, estado, botones y carteles
  scene.js                escena Three.js: bar, mesa, mazo, cartas, cámara, manos
  characters.js           personajes 2D dibujados en canvas (caras y señas)
  hands.js                tus manos en primera persona
  main.js                 arranque (sesión), rutas (/ y /sala/CÓDIGO) y eventos fijos de la UI
public/css/truco.css      todo el estilo; colores y tamaños en variables de :root
public/cards/             cartas WebP (id = número + palo: 1E, 7O, 12C… y back)
test/truco.test.js        tests del motor y partidas completas entre bots
test/opciones.test.js     tests de flor, muestra y "no permitir trampas" (+ partidas entre bots con opciones)
test/bots.test.js         aprendizaje, decisiones y trampas de los bots
test/auth.test.js         verificación del token de Supabase y validación del nombre
test/replay.test.js       grabar y reproducir partidas, ELO y análisis
test/sala.test.js         la sala (TrucoRoom) de punta a punta: bots, consultas, señas, desconexiones
test/helpers/             banco de pruebas de la sala en Node (storage, sockets, Lobby, cuentas y reloj de mentira)
supabase/migrations/      tablas de la base (se aplican en el proyecto de Supabase)
docs/CUENTAS.md           cuentas: cómo está armado y cómo se configura Supabase
docs/REGLAS.md            reglas implementadas, decisiones de la mesa y pendientes
```

## Reglas de oro
1. **Las reglas viven solo en `engine.js`.** El servidor y el cliente nunca deciden si algo es legal:
   el cliente dibuja los botones con `game.actions` (de `actionsFor`) y el servidor llama a `act()`.
   Si un botón aparece cuando no debería, el bug está en `actionsFor`/`act`, no en la UI.
2. **Números mágicos a `config.js`** (tiempos, límites, rutas, señas) y **colores/tipografía a `theme.js` / `:root`
   de `truco.css`**. No escribas `'#abc123'` ni `5200` sueltos en otro lado.
3. `engine.js`, `bot.js` y `config.js` no pueden usar `window`, `document` ni nada del navegador
   (los importa el Worker).
4. Todo lo que venga de otros jugadores (nombres, chat) se escapa con `esc()` antes de ir a `innerHTML`.
5. Cada cambio de reglas lleva test en `test/` y una línea en `docs/REGLAS.md`. Una opción de sala nueva se
   agrega en `ROOM_OPTIONS` (config.js): el menú, la sala de espera y el servidor la toman de ahí.
6. Textos de la interfaz en español rioplatense ("tirá", "cantá", "vos").
7. Estilo: una sola tipografía (Archivo, variable `--font`) y la paleta de `:root` (grises + colores de los
   palos). Nada de itálicas decorativas, serif ni tonos marfil/latón.
8. **Sistema de diseño y marca (Trukeados)**: [DESIGN.md](DESIGN.md) y [brand/](brand/). Todo color, tipografía, componente
   o texto nuevo sigue esas reglas.

## Flujo de una jugada
1. Botón → `RoomClient.act(a)` manda `{t:'act', a}` y **bloquea los botones** hasta el próximo `state`
   (evita el doble envío que antes mostraba "No te toca").
   Al mismo tiempo `predict(a)` muestra el resultado esperado (la carta vuela a la mesa, aparece el globo del
   canto) para que no haya delay; cuando llega el evento propio, `wasPredicted` evita repetirlo. Si el servidor
   rechaza la jugada, el `state` que manda corrige la mesa y la mano solas.
2. `TrucoRoom.webSocketMessage` → `act(game, seat, a)` del motor. Si hay error lo manda como `{t:'error'}`
   junto con el estado actual.
3. `commit()` guarda, manda `state` a cada socket con `viewFor(game, seat)` (oculta cartas ajenas) y
   programa la alarma.
4. `alarm()` hace jugar a los bots / ausentes, pasa a la mano siguiente y cierra el "mostrar tantos".

## Protocolo WebSocket (`/api/rooms/CÓDIGO/ws`)
Cliente → servidor: `join {token,spectate}` (el token de Supabase: el servidor saca de ahí el id y el nombre), `sit {seat}`, `stand`, `addbot {seat}`, `removebot {seat}`,
`kick {seat}`, `move {from, to}` (anfitrión: cambia o intercambia lugares en la sala de espera), `config {cfg}`, `start {fillBots}`, `act {a}`, `look {target}`, `sena {sena}`, `chat {text}`,
`rematch`, `to-lobby`, `ping`.

Servidor → cliente: `state {room, you, isHost, game, dealLeft, now}` (`dealLeft`: ms de reparto que faltan), `error {msg}`, `chat {msg}`,
`chat-history {messages}`, `gaze {seat,target}`, `gaze-all {gaze}`, `sena {seat,sena,self?,seenBy?}`,
`match {id, players, rated}` (la partida terminada quedó guardada: ELO y monedas de cada uno), `notfound`, `auth` (sin sesión válida o sin perfil: el cliente vuelve a la pantalla de entrada), `pong`.

Acciones (`a.t`): `play {card, mode:'normal'|'down'}` (fuera de turno o tapada = quemada), `play2 {bottom, top}`
(top = jugada quemada de la ronda siguiente),
`truco`, `envido {kind}`, `flor {kind: flor|quiero|achico|contraflor|resto|noquiero}`, `quiero`, `noquiero`, `cantar {value?}`, `buenas`, `mazo`, `denuncia {target}`,
`mostrar`, `nomostrar` (irse al mazo sin mostrar los tantos), `reclamar`.

## Probar
```bash
npm install
npm test          # motor + 60 partidas completas entre bots por modo
npm run dev       # http://localhost:8787 (necesita .dev.vars con SUPABASE_SECRET_KEY, ver .dev.vars.example)
```
- `npm run dev` usa `workerd`, que en Windows necesita el *Microsoft Visual C++ Redistributable*
  (si falla con "write EOF", es eso).
- En el navegador: `window.__truco.room` y `window.__truco.scene` sirven para depurar desde la consola.
- Con la pestaña oculta el navegador pausa la animación; el reparto igual se destraba solo (`startDeal`).

## Bots
- **Cómo deciden** (`bot.js`): imaginan `BOT.samples` repartos posibles de las cartas que no ven, juegan cada uno
  hasta el final y comparan cuánto esperan ganar con cada opción (querer, no querer, subir, farolear, qué carta
  tirar). Los puntos se miden con `utility()`, que pesa cuánto cambia la chance de ganar la partida (una falta
  envido 0 a 0 no vale lo mismo que 28 a 12). Eligen casi siempre lo mejor, con ruido `BOT.temp`.
- **Aprenden** (`brain.js`): cuando una persona juega, `observe()` anota qué hizo y con qué cartas de verdad; al
  terminar la mano la sala manda eso al Lobby (`learn`), que entrena el cerebro de esa persona y uno global.
  Los bots usan esos modelos para pesar los repartos imaginados (si cantó truco, ¿suele tener o farolea?) y para
  estimar si el rival va a querer un farol. Cambiar las features o los modelos → subir `BRAIN_VERSION`.
- **Trampas** (solo con la opción de trampas activa, ver `BOT` en config.js): espían las cartas de los rivales
  algunas manos (`botPeek`), el bot que reparte se acomoda una carta buena (`stackDeck`), mienten en el envido y
  se van sin mostrar (menos contra quien suele reclamar), y tiran dos encimadas. Más seguido si van perdiendo.
- **Memoria de situaciones** (`BotMemo` en bot.js, como el programa de damas de Samuel): guarda las sumas de
  la simulación (chance de ganar, de que quieran el truco, por carta) por situación, con los asientos contados
  desde el bot y las cartas por su valor. Cada vez que vuelve a una situación suma manos imaginadas; con
  `BOT.memoSamples` ya no simula. Una memoria por isolate (`MEMO` en truco-room.js); lo que madura se guarda en
  el Lobby (`memoPut`) y al arrancar se trae (`memoGet`). Si cambia lo que calcula la simulación o la clave,
  cambiar el `kind` en `simStats` para no mezclar con lo viejo.
- **Consulta al compañero** (en equipo): `ask {kind}` / `answer {yes}` por WebSocket; la sala guarda la consulta
  abierta en `room.asks[equipo]` (una por mano y tipo) y los bots compañeros contestan con `botAnswer` (a veces
  "callado" para ir a la pesca). Un bot puede consultar antes de decidir (`botAsks`) y espera hasta `TIMING.askWait`;
  "Cantá" y "No tengo nada" entran como señas (`askSenas`: decide él, y si tiene canta igual); "callado"
  hace que no cante eso (`ctx.hush`). "¿Pongo o voy?" (`primera`) la contesta solo el pie (`answerers`); el bot
  que preguntó tira la más baja si le dicen "vení" o la que gana si le dicen "poné" (`ctx.primera`).
- **Nunca se traba la mesa**: si `botAction` falla o elige algo inválido, la sala prueba `fallbackActions`; si
  falla la alarma entera, se registra y se reprograma.
- Los compañeros bots conocen las cartas entre ellos (como si se pasaran todo por señas).
- **Leen las señas** (`ctx.senas`, lo anota `deliverSena` en `room.senaSeen`): todas las de su compañero y las de
  un rival si justo lo miraban. Una seña de carta hace que casi siempre imaginen esa carta en esa mano
  (`sampleWorld`); una de tantos o "ciego" pesa los repartos (`senaWeight`). La del rival se cree un poco menos.
- **Compañero bot**: si un canto (truco, envido, flor) lo puede contestar tu equipo y hay un bot en él, el bot
  contesta por los dos a los `TIMING.partnerAnswer` ms si vos no contestaste antes. Si el canto lo tenés que contestar vos (el envido lo contesta el pie), nadie contesta por vos mientras estés conectado (`partnerAt` en truco-room.js).
- **"Cantámelo que tengo"** (`botCallsTantos`, `tellTantos`): en equipo, el bot que no es pie le avisa al pie que tiene tantos, sin que le pregunten; a veces lo dice faroleando. El pie bot lo toma como una seña.
- **Charla** (`talk.js`): los bots tiran frases en el chat al cantar y contestar (`talkFor`), reaccionan a lo que
  hacen los demás (`talkEvent`: cantos, cartas grandes, rondas, mazo, envido, fin de partida), apuran al que tarda
  (`TIMING.botIdle`) y a veces se contestan entre ellos. Las frases dependen de
  la chance de ganar que calcularon, sin delatarse: con mano buena a veces se hacen los humildes y cuando
  farolean casi siempre se hacen los guapos. Como mucho uno cada `TIMING.botChatGap` ms. Ninguna frase nombra el truco ni el envido salvo que sea el canto: decir una de esas palabras en una frase es cantarla (o subirla), así que la charla dice "el segundo", "el primero" o "los tantos" ([reglas](docs/REGLAS.md)).

## Interfaz
- Pantalla de partida: arriba la barra (salir, código, voz, zoom, ayuda, chat), "Mirar a" al centro y el
  anotador a la izquierda; abajo a la izquierda Señas y "Mostrá las dos"; **abajo a la derecha el panel**
  (`#panel`: estado + carta elegida + acciones). El centro de abajo es de la mano: no pongas nada ahí.
- En celular (`max-width: 760px`) el panel va a todo el ancho con filas deslizables y la mano sube con
  `scene.setBottomInset()`. Antes de cerrar un cambio de interfaz, medí solapamientos en 1280×720, 768×1024
  y 375×812.
- Movimiento: la cámara y las cabezas usan `damp()` (suavizado por tiempo, no por cuadro). Para mover la
  cámara cambiá `tYaw`/`tPitch` (objetivo), nunca `yaw`/`pitch` directo.

## Cómo agregar cosas
- **Algo para la tienda**: una entrada en `COSMETICS` (config.js: id, ranura, nombre, precio) y cómo se ve en
  `COSMETIC_LOOK` (theme.js, misma clave). Ropa/gorro/anteojos se aplican con `dressed()` (characters.js); un objeto
  nuevo de la mesa necesita su forma en `tableObject()` (scene.js). Una ranura nueva, en `COSMETIC_SLOTS`.
- **Una seña**: agregala en `SENAS` de `config.js` con una `expr`; si la cara es nueva, dibujala en
  `characters.js` (`drawEyes`/`drawMouth`…). El servidor valida contra las mismas claves.
- **Una regla**: `engine.js` (+ `actionsFor` si cambia qué botones hay) → test → `docs/REGLAS.md`.
  Si el bot tiene que saber usarla, `bot.js`.
- **Un color**: `theme.js` (escena) o `:root` en `truco.css` (interfaz).
- **Un tiempo**: `TIMING` en `config.js` (el reparto del cliente y el del servidor salen de ahí).

## Historia
Vino de la rama `truco` de `Arkhram-Organization/Cadalado.com` (donde vivía en `/truco` junto a un
ajedrez). Al separarlo se movió a la raíz, se partió `main.js` en módulos, se centralizaron constantes y
colores, y se arreglaron: botones chicos, mazo partido después del corte, parpadeo que se confundía con
la seña "ciego", "no te toca" por doble envío, cantos fuera de turno, y la carta de arriba de las dos
encimadas ahora queda quemada. Ver [CHANGELOG.md](CHANGELOG.md).

## Voces
Los audios de `public/voz` se generan con `tools/generate-voices.mjs` (voces libres de Piper; licencias en `public/voz/LICENCIAS.txt`). **Una frase nueva en `talk.js` necesita volver a correrlo**, o sale con la voz del dispositivo; solo genera lo que falta.

## Mesas en juego
`Lobby.showTables` mantiene entre 7 y 10 mesas. Mientras nadie las mira no corren: `scoreAt` calcula el tanteador según el tiempo. Al entrar a mirar, `ensureShow` arma la sala (`showUp`) con ese tanteador y se juega de verdad. Sus códigos empiezan con 9 (`newRoomCode` nunca los usa).

## Partida rápida y ELO
- `/api/quick` manda a una mesa abierta de ELO parecido (`Lobby.findOpen`) o crea una con `room.quick`. Esa mesa arranca sola al llenarse. Si no aparece gente, `quickTick` sienta rivales automáticos: el primero a los 6-22 s, los demás más seguido (`MATCH` en config.js).
- Esos rivales son asientos con `bot: true, disguised: true, elo`. **`disguised` nunca sale del servidor**: `publicRoom` los manda como jugadores comunes y `forClient` (matches.js) limpia el historial. Juegan por ELO, con fuerza según su ELO (`botSkill`), sin trampas y sin pasarse las cartas.
- El ELO se calcula en `elo.js`: K baja de 160 a 14 según las partidas jugadas. Los rivales automáticos cuentan con su ELO para el promedio del equipo.
- Migración `20261109000000_social`: foto, récord de ELO y amigos. El código funciona sin aplicarla (se leen todas las columnas con `*` y lo que falta se ignora): sin foto, sin amigos y sin premios por escalón.

## Historial y análisis
- Calificaciones (`classify` en analysis.js, umbrales en `ANALYSIS`): se miden en chance de ganar la partida perdida, como los *expected points* de chess.com. `evaluateDecision` devuelve `slope` (cuánto vale un punto ahora) para pasar de puntos a chance. La serie del gráfico sale de `winChance` (bot.js), que ve todas las cartas.
- La sala graba con `this.rec` (`MatchRecorder`): `start` al empezar o en la revancha, `hand(g)` en `afterDeal`
  (después de las trampas de los bots) y `step(...)` por cada jugada aceptada (`botAct` para bots y ausentes, con
  la marca `auto` si un bot jugó por una persona). **Toda jugada nueva que cambie `r.game` tiene que pasar por ahí**
  o la partida grabada no se va a poder reproducir (lo verifica `test/replay.test.js`).
- El análisis usa `evaluateDecision` de `bot.js` con `ctx.honest` (el rival que va ganando acepta los cantos):
  si cambia cómo evalúan los bots, cambia el análisis.
