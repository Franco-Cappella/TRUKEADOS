# Cambios

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
