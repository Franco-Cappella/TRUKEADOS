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
  limits.js               límite de pedidos a /api (por IP y escrituras por cuenta; ratelimits de wrangler.jsonc)
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
  creator.js              creador de personaje: tu dibujado en una tarima, la cámara va a cada parte, Aleatorio
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
  ambientes.js            registro de los lugares (cada uno en amb-interiores.js, amb-afuera.js o barrio-chino.js)
  amb-kit.js / amb-piezas.js  piezas de los lugares: luces con halo, fuego, humo, ventanas a la calle, agua, pasto; muebles y texturas
  paisaje.js              cielo pintado, nubes, capas de distancia, pétalos, luciérnagas
  characters.js           personajes 2D dibujados en canvas (caras y señas)
  models.js               personajes 3D de la tienda (GLB con esqueleto): lector propio, pose sentada y señas en la cara
  poster.js               el póster de cada personaje 3D en la tienda (se arma con el modelo; colores en COSMETIC_LOOK.poster)
  gif.js                  achicar GIF de perfil en el navegador (codificador GIF propio)
  hands.js                tus manos en primera persona
  main.js                 arranque (sesión), rutas (/ y /sala/CÓDIGO) y eventos fijos de la UI
public/css/truco.css      todo el estilo; colores y tamaños en variables de :root
public/cards/             cartas WebP (id = número + palo: 1E, 7O, 12C… y back)
test/truco.test.js        tests del motor y partidas completas entre bots
test/opciones.test.js     tests de flor, muestra y "no permitir trampas" (+ partidas entre bots con opciones)
test/personajes.test.js   personajes 3D: tienda, bots que los usan y modelos preparados
test/pica-pica.test.js    pica-pica (3 vs 3): cuándo toca, los duelos, la falta fija y partidas entre bots
test/bots.test.js         aprendizaje, decisiones y trampas de los bots
test/auth.test.js         verificación del token de Supabase y validación del nombre
test/replay.test.js       grabar y reproducir partidas, ELO y análisis
test/sala.test.js         la sala (TrucoRoom) de punta a punta: bots, consultas, señas, desconexiones
test/rendirse.test.js     rendirse en equipo: el pedido que tienen que aceptar los compañeros (SURRENDER_NEED)
test/limits.test.js       límite de pedidos a /api (src/limits.js)
test/cuenta.test.js       borrar la cuenta (con el nombre escrito a mano) y bajar los datos (src/account.js)
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
7. Estilo: la interfaz (menú, paneles) es blanco y negro, grotesk: una sola tipografía (Hanken Grotesk, variable
   `--font`) y la paleta de `:root` (negro, blanco y grises; el rojo solo para errores; esquinas rectas). La mesa y
   los ambientes de la partida, en cambio, van a todo color (paño verde, `SATURATION` en ambientes.js).
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
`rematch` (pedir o aceptar la revancha), `rematch-no`, `leave` (tocó "Salir": la revancha ya no lo espera), `away {on}` (pestaña oculta), `to-lobby`, `ping`.

Servidor → cliente: `state {room, you, isHost, game, dealLeft, now}` (`dealLeft`: ms de reparto que faltan), `error {msg}`, `chat {msg}`,
`chat-history {messages}`, `gaze {seat,target}`, `gaze-all {gaze}`, `sena {seat,sena,self?,seenBy?}`,
`match {id, players, rated}` (la partida terminada quedó guardada: ELO y monedas de cada uno), `notfound`, `auth` (sin sesión válida o sin perfil: el cliente vuelve a la pantalla de entrada), `pong`.

Acciones (`a.t`): `play {card, mode:'normal'|'down'}` (fuera de turno o tapada = quemada), `play2 {bottom, top}`
(top = jugada quemada de la ronda siguiente),
`truco`, `envido {kind}`, `flor {kind: flor|quiero|achico|contraflor|resto|noquiero}`, `quiero`, `noquiero`, `cantar {value?}`, `buenas`, `mazo {show?}` (show: al terminar la mano da vuelta lo que no tiró), `denuncia {target}`,
`mostrar`, `nomostrar` (irse al mazo sin mostrar los tantos), `reclamar`, `lucir` (terminada la mano, dar vuelta las cartas que no tiró).

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
- **"¿Queremos?"** (`kind: 'canto'`): consulta del que tiene que contestar un canto; se puede repetir si lo suben (`askKey`). Las respuestas (`nada`, `vos`, `algo`, `cargado`) le sirven al bot como señas (`askSenas`).
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
- **Charla** (`talk.js`): los bots cantan a secas, como una persona, y solo dicen frases de `BOT_TALK`, que son las mismas de la ruleta (`PHRASE_WHEEL`; test/bots.test.js lo verifica). Reaccionan a lo que
  hacen los demás (`talkEvent`: cantos, cartas grandes, rondas, mazo, envido, fin de partida), apuran al que tarda
  (`TIMING.botIdle`) y a veces se contestan entre ellos. Las frases dependen de
  la chance de ganar que calcularon, sin delatarse: con mano buena a veces se hacen los humildes y cuando
  farolean casi siempre se hacen los guapos.
- **Faroles con medida** (`bluffTax` en bot.js, `BOT.bluffTax`/`bluffSure`/`faltaMinWin` en config.js): como el modelo de base
  supone rivales que casi nunca quieren, cantar con nada "convenía" siempre y los bots cantaban envido (y falta) en
  cada mano. Ahora cantar con poca chance de ganar el envido o el truco resta puntos. La falta (`faltaOk`) pide tantos propios de
verdad (`BOT.faltaMinTanto`, 31) y estar seguro de ganar el envido con suficientes manos imaginadas (`faltaSamples`);
una "macana" de un bot flojo nunca es una falta. La excepción: va perdiendo y al rival le faltan `BOT.faltaDesperate`
puntos o menos (igual, con `faltaDesperateTanto` o más). Lo verifica test/bots.test.js. Como mucho uno cada `TIMING.botChatGap` ms. Ninguna frase nombra el truco ni el envido salvo que sea el canto: decir una de esas palabras en una frase es cantarla (o subirla), así que la charla dice "el segundo", "el primero" o "los tantos" ([reglas](docs/REGLAS.md)).

## Interfaz
- Al abrir una sala, `RoomClient` borra los botones del panel: si no, al volver a una partida con el mismo canto
  pendiente quedaban los de la conexión vieja (sus clics no llegaban a ningún lado).
- Chat: tocar el nombre de alguien lo silencia (`KEYS.muted`, por nombre de usuario): no se ven sus mensajes ni sus
  frases, sí sus cantos y tantos (son eventos del juego, no chat).
- El ciclo de dibujo (`safeFrame`) no se corta por un error: cada animación y cada personaje se actualizan aparte.
  Si se corta, la mesa queda congelada aunque el juego siga.
- Pantalla de partida: arriba la barra (salir, código, voz, zoom, ayuda, chat), "Mirar a" al centro y el
  anotador a la izquierda; abajo a la izquierda Señas y "Mostrá las dos"; **abajo a la derecha el panel**
  (`#panel`: estado + carta elegida + acciones). El centro de abajo es de la mano: no pongas nada ahí.
- En celular (`max-width: 760px`) el panel va a todo el ancho con filas deslizables y la mano sube con
  `scene.setBottomInset()`. Antes de cerrar un cambio de interfaz, medí solapamientos en 1280×720, 768×1024
  y 375×812.
- Movimiento: la cámara y las cabezas usan `damp()` (suavizado por tiempo, no por cuadro). Para mover la
  cámara cambiá `tYaw`/`tPitch` (objetivo), nunca `yaw`/`pitch` directo.

## Pica-pica
Opción de sala de 3 vs 3 (`picapica`). La mano de pica-pica son tres manos seguidas del motor, una por duelo:
`g.h.duel = { k, of, seats }` y los que no juegan quedan con `h.mazo[s] = true` (así el turno, el envido, la flor
y los bots ya los saltean). `nextHand` arma la vuelta (`picaDue`, `picaDuel`). Una opción que solo vale para
algunos modos lleva `modes` en `ROOM_OPTIONS` y se filtra con `optionForMode`.

## Ambientes (mapas)
Cada partida se juega en un lugar distinto (`AMBIENTES` en config.js): bar notable, café porteño, parrilla, club de
barrio (en `amb-interiores.js`), Bosques de Palermo, quincho, estancia (`amb-afuera.js`) y el Barrio Chino
(`barrio-chino.js`, solo de la tienda: `shop: true`, no sale en el sorteo). La sala elige uno al crearse (se ve de
fondo en la sala de espera, `party.js` → `setAmbiente`), lo mantiene al empezar, y cambia en la revancha y al volver a
la sala (`pickAmbiente`, `r.ambiente`, va en `publicRoom`).
- Cada lugar es un salón grande o un paisaje con profundidad: ventanas a la calle (`streetOutside`), varias luces con
  halo, y cosas que se mueven (fuego, humo, ventiladores, el reloj, la tele, agua, pasto, pájaros) registradas con
  `tick()`. Del lado de +z (atrás de tu silla) el centro queda libre y bajo: por ahí mira la cámara de la sala de espera.
- Uno nuevo: `export function id(g)` en un `amb-*.js` (arma el grupo y devuelve `{ background, fog }`), en `BUILD` de
  ambientes.js y en `AMBIENTES`; si es de la tienda, un ítem `mapa-<id>` en `COSMETICS` con `ambiente` y su foto.
- Para mirarlos: `/tools/scene-test.html` (con `shoot()` se guardan capturas en `tools/shots/`; con `mapShots()`, las
  fotos de la tienda en `public/img/mapas/<id>.webp`).

## Noche estrellada (pintura con relieve)
`public/js/impasto.js`: pinceladas que siguen un campo de direcciones (`strokes`), soles de anillos (`swirlDot`) y
siluetas (`clipTo`); además del color pinta la altura de la pintura y `paintMaterial` arma un material con el mapa de
normales (la luz marca el relieve). La usan el mapa `amb-noche.js` y el paño y el dorso de la noche estrellada
(`estrellada` y `paintBack` en panos.js). Las texturas son grandes: el mapa tarda unos segundos en armarse (se arma de
antemano con `prepareAmbientes`).

## Buscadores e IAs
`public/index.html` tiene el título, la descripción, la tarjeta para compartir (`/img/og.png`, sale de
`tools/og-test.html` con los íconos) y los datos estructurados (VideoGame, WebSite y FAQPage: las preguntas están
también a la vista abajo de la entrada, `.a-about`). Además `public/robots.txt`, `sitemap.xml`, `llms.txt` (resumen
para buscadores con IA), `manifest.webmanifest` y la página estática `public/como-jugar/` (reglas del truco). Si se
agrega una página pública, sumarla al sitemap.

## Probar en la tienda
La ficha de un mapa, un paño o un mazo tiene "Probar" (`openTry` en shop.js): una `TableScene` vacía a pantalla
completa que gira despacio (`TRY_VIEW` en config.js). Al cerrar vuelve a la ficha.

## La mesa de cada turno
El paño y el dorso del mazo son **los del que tiene el turno** (`tableOwner`, `tableLook` en config.js; lo aplica
room-client.js en cada `state`): cuando te toca, todos ven tu paño y tu mazo, también los que miran. El **mapa** (el
fondo) no cambia con el turno: es el que eligió la sala, el mismo para todos, salvo que tengas uno comprado y puesto
(ranura "mapa"): ese lo ves vos, siempre, también en la sala de espera. Los bots y los rivales automáticos tienen siempre
su paño y su mazo (`botCos`, `BOT_TABLE` en config.js; los agrega `publicRoom`). La baraja no cambia con el turno: es
la de cada uno. La escena guarda armados hasta `AMBIENTE_CACHE` lugares (`envFor`) y los paños (`feltCache`); al cambiar
de lugar, un fundido corto (`AMBIENTE_FADE_MS`).

## Creador de personaje
`public/js/creator.js` (pantalla `#creator`): tu personaje dibujado en una tarima con un cono de luz; cada parte (piel,
cara, pelo, barba, ropa, bandera) lleva la cámara a otro lugar (`CREATOR.cam` en config.js). Se gira arrastrando y
"Aleatorio" arma uno al azar (`randomLook`). Al registrarte (o si todavía no armaste uno) aparece solo antes del menú
(`route` en main.js; "Después" lo deja para otro momento: `KEYS.creatorLater`); después, desde la Taquilla ("Tu
personaje"). Se guarda con `POST /api/me/look` (`setLook` en src/social.js, limpio con `cleanLook`) en `profiles.look`
(migración `20261118000000_personaje_2d`). En la mesa viaja dentro de lo que tenés puesto (`cos.look`) y lo aplica
`dressed()` (characters.js). Para probarlo sin cuenta: `/tools/creator-test.html`.

## Cartel de cada jugador
Foto, nombre, ELO y estado; al pasarle el mouse (o tocarlo) muestra sus últimas 3 partidas (`recent` de cada
asiento: `recentMatches` en matches.js al entrar, y se actualiza al terminar; los rivales automáticos tienen uno de
mentira, `fakeRecent`, para no delatarse; también el ELO de cada modo, `elos`, y unos pocos, un personaje 3D:
`MATCH.personajeChance`). Sin foto se usa `/img/avatar.svg` (`DEFAULT_AVATAR`). Los bots piden ver los tantos
`BOT.claim` (95 %) de las veces.

## Perfil de otros
`GET /api/users/<nombre>` (`publicProfile` en social.js) y el diálogo de `public/js/profile-card.js`: cualquier
elemento con `data-user="nombre"` lo abre. Los usuarios automáticos tienen un perfil como cualquiera (del plantel o
inventado a partir del nombre) y se les puede mandar solicitud (queda pendiente).

## Sala de espera y amigos conectados
- `public/js/party.js` (`PartyStage`): el escenario de la sala de espera (una tarima por lugar, personajes 3D o
  dibujados, siluetas al buscar). Es uno solo para todas las salas (`#pl-stage`); la interfaz va en `#pl-ui` y
  `placePlates` (room-client.js) pone cada cartel abajo de su tarima en cada cuadro.
- `public/js/friends.js`: cada `PRESENCE.ping` avisa dónde estás (`POST /api/presence`) y trae a los amigos con su
  presencia y el último mensaje (`GET /api/friends`). El Lobby guarda la presencia en memoria (`ping`,
  `presenceOf`, se vence a los `PRESENCE.ttl`) y el chat entre amigos (`dmSend`, `dmGet`, `dmLast`, ruta `/api/dm`,
  solo entre amigos de verdad).

## Avisos de amistad
`startFriendWatch` (social.js) revisa `/api/friends` cada `FRIEND_POLL_MS`: pinta el número de Amigos y el del título
de la pestaña, un cartel por solicitud en `#friend-notes` (los de "Ahora no" se guardan en `KEYS.friendSeen`) y, en
la partida, un aviso una vez por solicitud.

## Legales
`public/legal/`: términos, privacidad (Ley 25.326) y licencias. Enlazadas desde la entrada, el pie del menú y los
créditos. Si cambia lo que se guarda o cómo funcionan las monedas, actualizarlas.

## Personajes 3D y vistas
- Ranura `personaje` de la tienda (Volcho y Olcho). Los modelos viven en `public/models/<id>.glb` y se arman con
  `node tools/build-skin.mjs <archivo.glb> <id>`: deja solo la malla con su esqueleto (estilo Mixamo, sin animaciones),
  achica la textura y busca en la cara los ojos, la boca y el color de piel (`extras.face`). La foto de la tienda
  (`<id>.webp`) sale del visor: `node tools/serve.mjs` y abrir `/tools/model-viewer.html` ("guardar foto").
  `/tools/scene-test.html` arma la mesa de verdad con datos de mentira (personajes, tiros, señas y vistas);
  `/tools/shop-test.html`, la Tienda con monedas y compras de mentira.
- Modelos de piezas sueltas y sin esqueleto (el Gato Melón): `node tools/rig-rigid.mjs <archivo.glb> <id>`, con las
  piezas de cada uno en `PARTS` (cuerpo, cabeza, brazos, patas, la pieza de la cara). Junta todo en una malla, une las
  texturas (con transparencia), arma huesos con nombres de Mixamo y reparte los brazos y las patas entre sus tres
  huesos para que se doblen. `seatLift` y `handsForward` acomodan cuerpos que no son de persona. Sus señas son una
  carita encima de la cara (`extras.face.emoji`). `clearFace` saca lo del cuerpo que tapa la cara y `cardsOffset`
  adelanta las cartas de la mano.
- `models.js` (`Rig`) los posa por código con cinemática inversa de dos huesos: sentado, la izquierda con las cartas,
  la derecha que tira (`reach` en scene.js), la cabeza que mira. Las señas son una carita tipo emoji que tapa la cara
  (`EmojiFace`), en el lugar que encontró la herramienta (entre los ojos y la boca, o `extras.face.emoji`).
- Los bots que se llaman como un personaje lo usan (`BOT_PERSONAJES`, `botCos` en config.js; lo agrega `publicRoom`).
- Vistas (botón "Vista" arriba o tecla V): primera persona y segunda (de frente). En primera persona tu personaje
  3D sigue a la cámara (solo lo ves vos) y sus manos sostienen y tiran las cartas.
- Taquilla: `public/js/locker.js` (`LockerStage`) muestra tu personaje en una tarima (3D con `Rig.stand`, o el
  dibujado); los casilleros y la rareza por precio (`rarity`) están en shop.js.
- Una cara nueva: correr build-skin, revisar en el visor que las señas caigan bien, agregar el ítem en `COSMETICS` y
  el modelo en `COSMETIC_LOOK` (url, escala y foto).

## Cómo agregar cosas
- **Algo para la tienda**: una entrada en `COSMETICS` (config.js: id, ranura, nombre, precio) y cómo se ve en
  `COSMETIC_LOOK` (theme.js, misma clave). Ropa/gorro/anteojos se aplican con `dressed()` (characters.js); un objeto
  nuevo de la mesa necesita su forma en `tableObject()` (scene.js). Una ranura nueva, en `COSMETIC_SLOTS`.
- **Un paño dibujado**: un pintor `nombre(ctx, w, h)` en `PANOS` de `public/js/panos.js` (llena el rectángulo que se ve
  de la mesa: `paintBox`; el centro tranquilo para que se lean las cartas) y en COSMETIC_LOOK `{ felt, draw, thread }`.
  `drawPano` le pone la trama, la sombra de los bordes y la costura; la escena los guarda armados (`feltCache`) porque
  la mesa cambia al paño del que tiene el turno. Nada de imágenes: todo se pinta en canvas.
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

## Abandonar una partida
Con la pestaña oculta (`away`) corre la misma cuenta, pero no se pierde: juega un bot hasta que vuelva. Si le toca
cantar los tantos y no está (oculto o desconectado), a los `TIMING.autoTanto` (10 s) se cantan solos y sin mentir
(`honestTanto`). Todo sale de `awayDeadline` en truco-room.js.
Si alguien se desconecta o toca la X, corre `TIMING.afk` (40 s). Si no vuelve y no le queda un compañero persona conectado, su equipo pierde (`forfeitDue` en truco-room.js, también con la sala vacía: `scheduleAlarm` deja la alarma). Si le queda un compañero, juega un bot por él. El menú muestra el cartel de reconectar (`rejoin.js`, ruta `/api/rooms/CÓDIGO/me`).

## Plantel, espectadores e invitaciones
- `src/roster.js`: los usuarios automáticos (siempre los mismos). Juegan las mesas del lobby y la partida rápida, y salen en el ranking.
- Los que miran tienen su chat (`spec-chat`): a los jugadores no les llega.
- Partida rápida en equipo: `invite-team` guarda los lugares del equipo de quien busca (`heldSeats`). Entran con `invited` (enlace `?equipo=1` o invitación de un amigo por `/api/invites`).
- Invitación a una mesa normal (un amigo te invita desde la sala): el invitado no se sienta solo. `openSeat` lo deja mirando y `inviteChoiceHtml` (room-client.js) le ofrece sumarse a su equipo o al otro, con `sit`. Quién lo invitó queda en `KEYS.teamInviteFrom` (sessionStorage) para saber cuál es su equipo.

## Voces
Los audios de `public/voz` se generan con `tools/generate-voices.mjs` (voz libre de Piper, `davefx`; licencia en `public/voz/LICENCIAS.txt`). Por defecto los asientos pares usan esa voz y los impares la voz de mujer del dispositivo (`voiceFor`); cada jugador puede elegir hombre o mujer en Configuración. **Una frase nueva en `talk.js` necesita volver a correrlo**, o sale con la voz del dispositivo; solo genera lo que falta.

## Mesas en juego
`Lobby.showTables` mantiene entre `SHOW_TABLES.min` y `max` mesas (12 a 18), sin que nadie juegue en dos a la vez (`busy`, `uniquePlayers`). Mientras nadie las mira no corren: `scoreAt` calcula el tanteador según el tiempo. Al entrar a mirar, `ensureShow` arma la sala (`showUp`) con ese tanteador y se juega de verdad. Sus códigos empiezan con 9 (`newRoomCode` nunca los usa).

## Partida rápida y ELO
- `/api/quick` manda a una mesa abierta de ELO parecido (`Lobby.findOpen`) o crea una con `room.quick`. Esa mesa arranca sola al llenarse. Si no aparece gente, `quickTick` sienta rivales automáticos: el primero a los 6-22 s, los demás más seguido (`MATCH` en config.js).
- Esos rivales son asientos con `bot: true, disguised: true, elo`. **`disguised` nunca sale del servidor**: `publicRoom` los manda como jugadores comunes y `forClient` (matches.js) limpia el historial. Juegan por ELO, con fuerza según su ELO (`botSkill`), sin trampas y sin pasarse las cartas.
- El ELO se calcula en `elo.js`: K baja de 160 a 14 según las partidas jugadas. Los rivales automáticos cuentan con su ELO para el promedio del equipo.
- Migración `20261109000000_social`: foto, récord de ELO y amigos. El código funciona sin aplicarla (se leen todas las columnas con `*` y lo que falta se ignora): sin foto, sin amigos y sin premios por escalón.

## Antitrampas
- **Señas**: el servidor las manda solo a quien mira al que la hace (`deliverSena`); al resto no le llega ni que hubo
  una, así que un cliente modificado no tiene nada que destapar. Además (`ANTICHEAT` en config.js): hay que venir
  mirando hace `senaDwell` ms (`senaWatchers`), el que cambia de mirada más de `lookBurst` veces queda `lookPenalty`
  ms sin ver señas (la mirada igual se mueve: los demás la ven), entre dos señas tiene que haber `senaGap` ms y el
  que se fue al mazo no hace señas. Las miradas pasan siempre por `setGaze` (también las de los bots).
- **Mensajes**: cada conexión manda como mucho `msgBurst` mensajes por ventana (`flooding`); lo que sobra se descarta.
- **Lo que ve cada uno**: `viewFor` (engine.js) y `publicRoom` son lo único que sale de la sala. Un campo nuevo con
  información oculta (cartas, si un rival es automático) no va ahí.
- Lo verifica test/antitrampas.test.js.

## Compartir partidas
`POST /api/matches/ID/share` (solo alguien que la jugó; `shareMatch` en matches.js) da una clave al azar guardada en
`match_shares` (migración `20261117000000_compartir_partidas`), siempre la misma por jugador y partida. El enlace es
`/repeticion/CLAVE` (`?j=N` abre en el paso N) y lo ve cualquiera, aun sin cuenta (`GET /api/shared/CLAVE`,
`getShared`): la revisión desde el lugar del que la compartió, sin ids de cuentas ni de la partida.

## Historial y análisis
- Calificaciones (`classify` en analysis.js, umbrales en `ANALYSIS`): se miden en chance de ganar la partida perdida, como los *expected points* de chess.com. `evaluateDecision` devuelve `slope` (cuánto vale un punto ahora) para pasar de puntos a chance. La serie del gráfico sale de `winChance` (bot.js), que ve todas las cartas.
- La sala graba con `this.rec` (`MatchRecorder`): `start` al empezar o en la revancha, `hand(g)` en `afterDeal`
  (después de las trampas de los bots) y `step(...)` por cada jugada aceptada (`botAct` para bots y ausentes, con
  la marca `auto` si un bot jugó por una persona). **Toda jugada nueva que cambie `r.game` tiene que pasar por ahí**
  o la partida grabada no se va a poder reproducir (lo verifica `test/replay.test.js`).
- El análisis usa `evaluateDecision` de `bot.js` con `ctx.honest` (el rival que va ganando acepta los cantos):
  si cambia cómo evalúan los bots, cambia el análisis.
