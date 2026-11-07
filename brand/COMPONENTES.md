# Trukeados — componentes

Cada componente del juego con los valores exactos de `public/css/truco.css`, y cómo se usa en una
página derivada (landing, reglas, prensa). Si un valor de acá no coincide con el CSS del juego, gana el
CSS y se corrige este archivo.

Columnas: **Juego** = cómo está hoy en `truco.css`. **Páginas** = cómo se usa en una página.
Los tokens están en [tokens.css](tokens.css).

> Regla general: **en el juego** (una aplicación) los rótulos van en mayúsculas angostas y hay bordes
> de 1 px, porque son paneles de trabajo. **En las páginas** no: oración, escalones de tono en vez de
> líneas, nada de mayúsculas espaciadas chicas. Ver [PAGINAS.md](PAGINAS.md).

---

## 1. Botón

### Base `.btn`
| Propiedad | Juego | Páginas |
|---|---|---|
| Fuente | Archivo 78 % (`--narrow`), 600 | Archivo 78 %, 650 |
| Tamaño | `--btn-font` 17 px (16 px en celular) | 17 px; grande 19 px |
| Caja | `text-transform: uppercase`, tracking 0,06 em | **Oración**, tracking 0,04 em |
| Relleno | `--btn-pad` 12 px 20 px (11 px 16 px en celular) | 12 px 20 px; grande 15 px 26 px |
| Alto mínimo | `--btn-min-h` 46 px | 46 px; grande 54 px |
| Borde | 1 px `--line-2` | sin borde (el relleno marca el botón) |
| Fondo | `--panel` `rgba(18,18,18,.9)` | según variante |
| Esquina | 3 px | 3 px (`--radius`) |
| Hover | borde `--text-dim`, fondo `--panel-hover` | un escalón de tono más claro |
| Presionado | `translateY(1px)` | `translateY(1px)`, 120 ms |
| Deshabilitado | opacidad .35, `not-allowed` | igual |
| Transición | background, border-color, color .12 s | igual + transform, `--ease-out` |
| Contenido | `inline-flex`, gap 8 px, `white-space: nowrap`, line-height 1,1 | igual |

### Variantes
| Variante | Juego | Páginas |
|---|---|---|
| **Principal** | `.btn.primary`: fondo `--text`, texto `--bg` (blanco). Hover `--text-hi`. Por ahora se queda así (ver [ALINEACION.md](ALINEACION.md) §4). | Fondo **`--oro`**, texto `--accent-ink`. Hover: oro un 6 % más claro. **Uno por pantalla.** |
| **Secundario** | `.btn` base | Fondo `--surface-2`, texto `--text`. Hover `--surface-3`. |
| **Bien** | `.btn.good`: borde `--basto`, texto `--good-ink` `#8fe0aa`, hover `--good-bg` | Casi no se usa en páginas. |
| **Peligro / trampa** | `.btn.danger`: borde `--copa`, texto `--bad-ink` `#ffb3ad`, hover `--bad-bg` | Solo para mostrar la trampa ("¡Mostrá las dos!"). |
| **Fantasma** | `.btn.ghost`: fondo `--panel-soft`, borde `--line` | Enlaces de la barra: texto solo, sin caja. |
| **Grande** | `.btn.big`: 15 px 26 px, 19 px, 54 px | igual |
| **Chico** | `.btn.small`: 7 px 13 px, 14 px, 36 px | No se usa (mínimo táctil 44 px en páginas). |
| **Canto** | `.btn.call`: 700, `--btn-call-font` 22 px (20 px celular), **sin mayúsculas**, tracking 0, relleno 9 px 24 px 10 px, subrayado interior `inset 0 -2px 0 var(--accent)`; hover 3 px y texto `--text-hi` | Mismo aspecto para cualquier botón que sea "cantar" algo (por ejemplo un CTA "¡Quiero!"). |

En el panel de la partida (`#panel .btn`): alto 44 px, relleno 8 px 10 px, 15 px, tracking 0,04 em;
cantos 19 px. En celular: 40 px, 14 px, cantos 17 px.

## 2. Campo de texto
| Propiedad | Juego (`.field input`) | Páginas |
|---|---|---|
| Fuente | Archivo 100 %, 16 px, sin mayúsculas | Archivo 100 %, 18 px (16 px mínimo: evita el zoom en iOS) |
| Fondo | `--bg` | `--surface-2` (sobre `--bg`) |
| Borde | 1 px `--line-2`, foco: borde `--accent` | sin borde; foco: contorno 2 px `--focus` con 2 px de separación |
| Relleno | 10 px 12 px | 14 px 16 px |
| Esquina | 3 px | 3 px |
| Rótulo (`.field`) | 78 %, 12 px, mayúsculas, tracking 0,08 em, `--muted`, gap 6 px | Estilo Rótulo: 78 %, 650, 15 px, oración, `--text-dim` |

**Código de sala** (`#join-code`, `.code-chip b`, `.share .big-code`): monoespaciada del sistema,
mayúsculas, tracking 0,25–0,4 em, 600–700. Es la única monoespaciada permitida, porque es un código real.
En páginas se muestra igual cuando aparece un código (ejemplo: `ABCDE`).

## 3. Selector segmentado `.seg`
Juego: caja con borde 1 px `--line-2`, esquina 3 px; botones 78 %, 600, 15 px, mayúsculas, tracking
0,05 em, relleno 11 px 12 px, separados por 1 px `--line`; activo `.on` fondo `--text`, texto `--bg`.
Páginas: botones con fondo `--surface-2`, separados por 2 px de `--bg` (sin líneas); activo fondo
`--text` y texto `--bg`, en oración.

## 4. Panel y tarjeta
| Componente | Juego | Páginas |
|---|---|---|
| `.panel` | `--surface`, borde 1 px `--line`, esquina 4 px, relleno 20 px | Un escalón de tono (`--surface` sobre `--bg`), sin borde, esquina 3 px. |
| `.panel h2` | 78 %, 700, 14 px, mayúsculas, tracking 0,1 em, `--text-dim` | Estilo Título o Rótulo, en oración. |
| `.card-box` (diálogos) | `--surface`, borde 1 px `--line-2`, esquina 4 px, relleno 22 px, sombra `0 24px 60px rgba(0,0,0,.7)`, título 28 px 700 | Solo para diálogos reales (flotan: llevan sombra). |
| `.room` (mesa pública) | `--bg`, borde 1 px `--line`, esquina 3 px, relleno 12 px; modo en 78 % 700 mayúsculas oro | En páginas, como fragmento de interfaz real (marcado `data-ui`). |
| `.overlay` | fondo `--shade` `rgba(0,0,0,.72)`, relleno 16 px | igual para modales |

## 5. Globo de canto `.bubble`
Fondo `--text`, texto `--text-on-light`, Archivo 700, 19 px (cantos `.call` 23 px; chat 500 14 px),
relleno 5 px 14 px 6 px, esquina 2 px, sombra `0 6px 18px rgba(0,0,0,.45)`, ancho máximo 260 px,
centrado, colita de 7 px abajo al centro. Aparece con `pop`: sube 4 px y aparece en 180 ms.
**Es el componente más reconocible del juego**: en páginas se usa igual, sobre la cara de un personaje
o sobre una carta, con el texto real del canto (`¡Truco!`, `¡Quiero retruco!`, `Son buenas`).

## 6. Placa de nombre `.nameplate`
78 %, 600, 16 px, tracking 0,04 em, fondo `--panel`, borde izquierdo 3 px (`--team0` azul o `--team1`
rojo según equipo), relleno 3 px 10 px 3 px 8 px. Con el turno: fondo `--text`, texto `--bg`.
Chip interno 10 px 700 mayúsculas; "te mira" en oro.
Páginas: para nombrar personajes y bots, igual que en el juego.

## 7. Anotador `#anotador`
Fondo `--panel`, borde 1 px `--line`, esquina 3 px, relleno 8 px 10 px 6 px, ancho mínimo 100 px.
Cabecera "Nos / Ellos" 78 % 600 11 px mayúsculas; total 700 19 px.
Palitos SVG (`palitos()` en `hud.js`): grupos de 16 px, separación 6 px, trazo 2,6 px `#f5f5f5` (apagado
1,4 px a 8 %), cuatro forman un cuadrado y el quinto lo cruza; variaciones fijas para que parezcan a
mano; a 30 puntos, raya punteada entre malas y buenas.
Páginas: cualquier puntaje o conteo se dibuja con palitos, nunca con barras de progreso.

## 8. Toast `.toast`
Fondo `--panel-hover`, borde 1 px `--line-2` y borde izquierdo 3 px (`--text-dim`; bien `--basto`;
mal `--copa`), relleno 8 px 14 px, esquina 2 px, 14 px, line-height 1,4, ancho hasta 520 px; puede
llevar cartas de 66 px de alto. Aparece con `pop`.

## 9. Línea de estado `#status-line`
78 %, 700, 17 px, mayúsculas, tracking 0,06 em, `--text-dim`, borde inferior 1 px. Cuando te toca
(`.mine`): texto `--text` y borde inferior 2 px oro. Debajo, nota en 100 % 500 13 px `--muted`.

## 10. Menú desplegable y señas
`.dropdown .menu`: `--surface`, borde 1 px `--line-2`, esquina 3 px, relleno 4 px, ancho mínimo
270 px, sombra `0 14px 34px rgba(0,0,0,.6)`. Ítem: 16 px, relleno 10 px, hover `--hover-tint`; título
600, nota 13 px `--muted`; cara de la seña en canvas de 52 × 52 sobre `--face-bg` `#262626`, esquina 2 px.
Espejo "Así te ven" (`#mirror`): 110 × 110 (80 en celular), `--face-bg`, borde 1 px, esquina 3 px.

## 11. Chat
Panel `--panel-hover`, borde 1 px `--line-2`, ancho hasta 340 px; texto 14 px / 1,4; nombres en color
de equipo (`--team0` / `--team1`); mensajes del sistema 13 px `--muted`. Frases rápidas: 14 px, relleno
6 px 10 px, esquina 2 px, borde 1 px `--line`.

## 12. Teclas `kbd`
78 %, 700, 11 px, borde 1 px `--line-2` con 2 px abajo, esquina 3 px, relleno 0 5 px, alto de línea
16 px, `--text-dim`. En páginas solo si se explica un control (Z, A/D, 1-2-3, Enter).

## 13. Resultado `#result`
Diálogo centrado sobre `--shade`; marcador final 56 px 700; botón **Revancha** grande y principal.

---

## Componentes que solo existen en páginas

| Componente | Especificación |
|---|---|
| **Barra de navegación** | Logo horizontal (alto 28 px escritorio / 24 px celular), 3 a 4 enlaces en texto (estilo Rótulo, 15 px, `--text-dim`, hover `--text`), un botón principal oro "Jugar". Fondo `--bg` sólido, sin borde ni blur. Alto 64–72 px. |
| **Naipe** | Imagen WebP del juego, proporción 512 : 788, esquina `--radius-naipe`, sin borde. Sombra solo si está "en el aire" (volando o levantada). En el paño, sin sombra. |
| **Cara** | Personaje dibujado con `drawCharacter` (ver [RECURSOS.md](RECURSOS.md)), recorte de cara sobre `--face-bg` o `--surface`, esquina 3 px. |
| **Campo de paño** | Sección con fondo `--pano-3`, texto `--text`, acento oro. Una vez por página como máximo. |
| **Pie** | Logo o palabra en grande, enlaces en Rótulo, créditos en Legal (13 px `--muted`). Créditos de cartas obligatorios. |

## Estados obligatorios en cualquier control
- **Hover**: un escalón de tono, 180 ms.
- **Foco**: `outline: 2px solid var(--focus); outline-offset: 2px;` siempre visible con teclado.
- **Presionado**: `translateY(1px)`, 120 ms.
- **Deshabilitado**: opacidad .35.
- **Cargando**: el texto del botón cambia ("Buscando mesa…"); no se usan ruedas giratorias.
