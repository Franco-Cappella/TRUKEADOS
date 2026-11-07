# Cambios

## 1.5.0 — flor, muestra y mesa sin trampas
- Opciones de sala nuevas (lista única en `config.js` `ROOM_OPTIONS`): **flor**, **muestra** y **no permitir
  trampas** (reemplaza "mostrar quién ganó cada ronda"). Reglas en `docs/REGLAS.md`.
- `cards.js`: valor de las cartas (jerarquía, envido, flor, muestra) separado del motor.
- Bots que cantan y contestan flor y entienden la muestra. Tests nuevos en `test/opciones.test.js`.
- Probado en el navegador: cantar y contestar flor (también en celular), muestra en mesa y anotador, mesa sin
  trampas. Arreglado: el estado decía "Tocá una carta" cuando había que cantar la flor.


## 1.4.1 — reparto sincronizado y quemada a destiempo
- **"Esperá que terminen de repartir" en primera**: en la primera mano de una sala el cliente no animaba el
  reparto y dejaba tirar mientras el servidor seguía repartiendo; la jugada se rechazaba y la carta volvía a la
  mano (también pasaba con la carta quemada fuera de turno). Ahora el servidor manda `dealLeft` (ms de reparto
  que faltan) y el cliente no muestra botones hasta que terminan la animación y el reparto del servidor.
- **Dos encimadas**: la de arriba se ve quemada recién al pasar a la ronda siguiente, para todos (antes el
  que la tiraba la veía quemada en el momento).
- Test nuevo: fuera de turno en 2 vs 2 (se saltea el turno y la carta no vuelve a la mano).


## 1.4.0 — irse sin mostrar y campo de visión más amplio
- **Irse al mazo sin mostrar** los tantos (para hacerse el boludo o tapar que mentiste): los rivales tienen
  6 s para reclamar (`TIMING.foldWindow`); si nadie reclama, los puntos valen. Los bots rivales pueden reclamar.
- **Mostrar después de irse al mazo**: antes, si ganabas el envido y te ibas al mazo en el truco, no aparecía
  el botón para mostrar. Ahora sí.
- Mentir y mostrar sigue costando el envido aunque tengas más que el rival (test nuevo).
- **Campo de visión** 70° (antes 62°; 84° en vertical): se ve más mesa. La mano se acerca lo justo para
  verse del mismo tamaño (`FOV` y `HAND_DESIGN_FOV` en `scene.js`).


## 1.3.0 — cartas quemadas, panel sin scroll y mesa legible
- **Cartas quemadas** (regla de la mesa): valen como un 4 en la ronda en que cuentan; el envido no cambia.
  Se quema la tapada, la que tirás **fuera de turno** (se puede: es tu jugada de esa ronda) y la de arriba de
  dos encimadas.
- **Dos encimadas**: la de arriba es tu jugada quemada de la ronda siguiente (se juega sola). Durante la
  ronda parece una carta normal y queda casi alineada; al terminar la ronda se ve quemada y aparece el aviso
  para pedir "mostrá las dos". Ya no se avisa a todos en el momento.
- **Panel sin scroll**: grilla fija (cantos 2×2, carta elegida en una fila de 3); en celular todo en una
  grilla de 4 columnas. "Mirar a" ya no scrollea: en pantallas angostas se esconde. Los avisos repetidos no
  se apilan.
- **Mesa legible**: menos luz de la lámpara y exposición más baja (`LIGHT` en `theme.js`) y cartas de la
  mesa 30 % más grandes.
- Tests: quemada = 4, fuera de turno, tapada, dos encimadas en dos rondas, quién empieza cada ronda en
  2 vs 2 / 3 vs 3, y que ganar primera y perder segunda lleva a tercera (reglamento).


## 1.2.0 — interfaz despejada, respuesta inmediata y movimiento suave
- **Botones sin amontonarse**: las acciones pasaron a un panel abajo a la derecha (con el estado como
  título) y se acomodan en una grilla; el centro de abajo queda libre para tu mano. "Mirar a" pasó a una fila
  arriba al centro y el anotador arriba a la izquierda (más compacto). En celular el panel va abajo a todo el
  ancho, con filas de botones deslizables, y la mano sube sola lo justo para no quedar tapada
  (`scene.setBottomInset`). Probado sin solapamientos en 1280×720, 1038×515, 768×1024 y 375×812.
- **Sin delay**: al tirar una carta o cantar, la carta vuela y el globo aparece al instante
  (`RoomClient.predict`); el estado del servidor después lo confirma o lo corrige. Tocar de nuevo la carta
  elegida la tira. Los botones solo se rehacen si cambian (antes se recreaban en cada actualización y un
  clic podía perderse).
- **Movimiento suave**: la cámara sigue un objetivo con amortiguación independiente de los FPS (arrastrar,
  teclado, rueda y "mirar a"), las cabezas de los personajes giran con la misma técnica, y las cartas se tiran
  y se reparten con curvas que arrancan rápido y se asientan.
- Ritmo: los bots piensan 0,65–1,3 s (antes 0,9–1,8 s) y la pausa entre manos bajó de 5,2 a 4,2 s.


## 1.1.0 — tipografía y paleta
- Tipografía única: **Archivo** (Omnibus-Type, Buenos Aires; Google Fonts, OFL), variable en peso y ancho.
  Ancho normal para textos y botones; angosta (`font-stretch: var(--narrow)`) para rótulos. Se sacaron
  Barlow, Barlow Condensed y Alegreya (y todas las itálicas). En canvas se usa `FONT` de `theme.js`.
- Paleta básica: grises neutros + los cuatro palos de la baraja (`--blue` espada, `--green` basto,
  `--yellow` oro, `--red` copa). El amarillo es el único acento. Se sacaron el marfil, el latón y los marrones
  de la interfaz. Variables renombradas: `--bg`, `--surface`, `--line`, `--text`, `--accent`…
- `theme.js`: `FONT` y `SUIT_COLORS`; anotador y textos del paño en blanco neutro.

## 1.0.0 — separado de Cadalado.com

Traído desde la rama `truco` de `Arkhram-Organization/Cadalado.com` (solo el truco, sin el ajedrez).

### Arreglos
- **Botones más grandes**: tamaños nuevos en variables de `:root` (`--btn-font`, `--btn-pad`, `--btn-min-h`,
  `--btn-call-font`); también menús, selector de mirada, frases del chat y versión móvil.
- **Mazo partido después de cortar**: al terminar la animación del corte las dos mitades del modelo 3D
  quedaban desplazadas (el último cuadro de la animación no las volvía a su lugar). Ahora `resetDeck()` las
  deja alineadas al terminar cada etapa y al ubicar el mazo.
- **Parpadeo automático eliminado**: los personajes ya no cierran los ojos solos; los ojos cerrados son
  únicamente la seña "ciego".
- **"No te toca" cuando sí te tocaba**: un doble clic (o un clic con el estado viejo) mandaba la respuesta dos
  veces; la segunda daba error. Ahora los botones se bloquean hasta que llega el estado nuevo, y si un canto ya
  se contestó el mensaje es "Ya se contestó".
- **Cantar fuera de turno**: el que tenía el quiero podía cantar retruco aunque no fuera su turno, y el pie
  podía cantar envido antes de que le tocara. Según el reglamento se canta "en su turno": ahora el motor solo
  permite abrir truco/envido en tu turno (contestar sigue siendo inmediato).
- **Dos cartas encimadas**: la carta de arriba queda **quemada** (no juega ninguna ronda) y se ve claramente
  quemada en la mesa. Antes se jugaba sola en la ronda siguiente. Ver `docs/REGLAS.md`.
- El reparto ya no se queda trabado si la pestaña estuvo oculta.

### Refactor
- Todo en la raíz: `/` es el menú y `/sala/CÓDIGO` la partida (antes `/truco/...`).
- `public/js/config.js`: constantes compartidas servidor/cliente (modos, tiempos, rutas, señas, bots). El
  tiempo de reparto del servidor y la animación del cliente salen de los mismos números.
- `public/js/theme.js`: colores de la escena 3D, cartas, anotador y paletas de personajes; `mix()` e `INK`
  compartidos (antes duplicados en `characters.js` y `hands.js`).
- `truco.css`: colores sueltos pasados a variables.
- `main.js` (1160 líneas) partido en `dom.js`, `audio.js`, `hud.js`, `menu.js`, `room-client.js` y `main.js`.
- Código muerto eliminado: `h.pre`, `h.stacked`, `h.falseAccuse`, `autoPre`, `cheater`, `onReorder`,
  `choosingTopId`, parpadeo, `isHumanSeated`, función `isAway` duplicada, nombres de truco repetidos.
- Lobby y Worker solo con las rutas del truco (`/api/rooms`, `/api/quick`, `/api/lobby`).
- Tests nuevos: cantar fuera de turno, doble respuesta, carta quemada y jugar sin cartas.
