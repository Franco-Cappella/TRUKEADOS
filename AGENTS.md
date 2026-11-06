# Guía para agentes (y personas) que trabajen en Truco 3D

Leé esto antes de tocar código. Las reglas del juego están en [docs/REGLAS.md](docs/REGLAS.md).

## Qué es
Truco argentino online en 3D (1v1, 2v2, 3v3). Un Cloudflare Worker sirve los archivos de `public/` y
un Durable Object por sala (`TrucoRoom`) es la **única fuente de verdad**: valida cada jugada con el
motor de reglas y manda a cada jugador solo lo que puede ver. El cliente es HTML/CSS/JS sin build ni
frameworks (Three.js como módulo en `public/vendor/`).

## Mapa del código
```
src/                      SERVIDOR (Cloudflare Worker)
  index.js                rutas /api (crear sala, partida rápida, lobby, WebSocket)
  truco-room.js           Durable Object: sala, bots, AFK, señas, chat, alarmas
  lobby.js                Durable Object "global": mesas públicas para el menú
  util.js                 validación de nombres/pid, códigos de sala, json(), rng()
public/js/                CLIENTE (los marcados con * también los usa el servidor)
  config.js *             CONSTANTES COMPARTIDAS: modos, tiempos, rutas, señas, nombres de bots
  engine.js *             REGLAS puras (sin DOM): newGame, act, actionsFor, waitingFor, viewFor
  bot.js *                jugador automático (decide solo con lo que ve un jugador)
  theme.js                COLORES del JS (escena 3D, cartas quemadas, anotador, paletas de personajes)
  dom.js                  $, esc, store (localStorage seguro), KEYS, myPid, api()
  audio.js                sonidos sintetizados y voz de los cantos
  hud.js                  anotador de palitos, ayuda, caras de las señas, frases rápidas
  menu.js                 pantalla de inicio
  room-client.js          una sala abierta: WebSocket, estado, botones y carteles
  scene.js                escena Three.js: bar, mesa, mazo, cartas, cámara, manos
  characters.js           personajes 2D dibujados en canvas (caras y señas)
  hands.js                tus manos en primera persona
  main.js                 arranque y rutas (/ y /sala/CÓDIGO), eventos fijos de la UI
public/css/truco.css      todo el estilo; colores y tamaños en variables de :root
public/cards/             cartas WebP (id = número + palo: 1E, 7O, 12C… y back)
test/truco.test.js        tests del motor y partidas completas entre bots
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
5. Cada cambio de reglas lleva test en `test/truco.test.js` y una línea en `docs/REGLAS.md`.
6. Textos de la interfaz en español rioplatense ("tirá", "cantá", "vos").
7. Estilo: una sola tipografía (Archivo, variable `--font`) y la paleta de `:root` (grises + colores de los
   palos). Nada de itálicas decorativas, serif ni tonos marfil/latón.

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
Cliente → servidor: `join {pid,name,spectate}`, `sit {seat}`, `stand`, `addbot {seat}`, `removebot {seat}`,
`kick {seat}`, `config {cfg}`, `start {fillBots}`, `act {a}`, `look {target}`, `sena {sena}`, `chat {text}`,
`rematch`, `to-lobby`, `ping`.

Servidor → cliente: `state {room, you, isHost, game, now}`, `error {msg}`, `chat {msg}`,
`chat-history {messages}`, `gaze {seat,target}`, `gaze-all {gaze}`, `sena {seat,sena,self?,seenBy?}`,
`notfound`, `pong`.

Acciones (`a.t`): `play {card, mode:'normal'|'down'}` (fuera de turno o tapada = quemada), `play2 {bottom, top}`
(top = jugada quemada de la ronda siguiente),
`truco`, `envido {kind}`, `quiero`, `noquiero`, `cantar {value?}`, `buenas`, `mazo`, `denuncia {target}`,
`mostrar`, `nomostrar` (irse al mazo sin mostrar los tantos), `reclamar`.

## Probar
```bash
npm install
npm test          # motor + 60 partidas completas entre bots por modo
npm run dev       # http://localhost:8787
```
- `npm run dev` usa `workerd`, que en Windows necesita el *Microsoft Visual C++ Redistributable*
  (si falla con "write EOF", es eso).
- En el navegador: `window.__truco.room` y `window.__truco.scene` sirven para depurar desde la consola.
- Con la pestaña oculta el navegador pausa la animación; el reparto igual se destraba solo (`startDeal`).

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
