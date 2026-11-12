# Trukeados — componentes

Cada componente del juego con los valores exactos de `public/css/truco.css` (blanco y negro, Hanken Grotesk,
esquinas rectas), y cómo se usa en una página derivada (landing, reglas, prensa). Si un valor de acá no coincide
con el CSS del juego, gana el CSS y se corrige este archivo.

Columnas: **Juego** = cómo está hoy en `truco.css`. **Páginas** = cómo se usa en una página.
Los tokens están en [tokens.css](tokens.css).

> Regla general: **en el juego** (una aplicación) los rótulos y botones van en mayúsculas con aire (tracking
> `--track` 0,08 em) y hay bordes de 1 px, porque son paneles de trabajo. **En las páginas** se usa la misma
> tipografía y los mismos grises, con más escala y menos cajas. Ver [PAGINAS.md](PAGINAS.md).

---

## 1. Botón

### Base `.btn`
| Propiedad | Juego | Páginas |
|---|---|---|
| Fuente | Hanken Grotesk 650 | igual |
| Tamaño | `--btn-font` 15 px (16 px en celular ≤ 640 px) | 15–17 px; grande 19 px |
| Caja | `text-transform: uppercase`, tracking `--track` 0,08 em | igual |
| Relleno | `--btn-pad` 12 px 20 px (11 px 16 px en celular) | 12 px 20 px; grande 15 px 26 px |
| Alto mínimo | `--btn-min-h` 46 px | 46 px; grande 54 px |
| Borde | 1 px `--line-2` | igual |
| Fondo | `--panel` `rgba(10,10,10,.92)` | `--surface` o `--bg` |
| Esquina | `--radius` 2 px | 2 px |
| Hover | borde `--text-dim`, fondo `--panel-hover` | igual (`--surface-3`) |
| Presionado | `translateY(1px)` | igual, 120 ms |
| Deshabilitado | opacidad .35, `not-allowed` | igual |
| Transición | background, border-color, color .12 s | igual + transform, `--ease-out` |
| Contenido | `inline-flex`, gap 8 px, `white-space: nowrap`, line-height 1,1 | igual |

### Variantes
| Variante | Juego | Páginas |
|---|---|---|
| **Principal** | `.btn.primary`: fondo `--text`, texto `--bg`, borde `--text`. Hover `#d6d6d6` (`--accent-hover`). | Igual: **blanco con letra negra. Uno por pantalla.** |
| **Secundario** | `.btn` base | Igual. |
| **Bien** | `.btn.good`: borde y texto blancos (`--good-line`, `--good-ink`), hover `--good-bg` `rgba(255,255,255,.12)` | Casi no se usa en páginas. |
| **Peligro / trampa** | `.btn.danger`: borde `--red` `#ff5a4f`, texto `--bad-ink` `#ffb0aa`, hover `--bad-bg` | Solo para mostrar la trampa ("¡Mostrá las dos!"). |
| **Fantasma** | `.btn.ghost`: fondo `--panel-soft`, borde `--line` | Enlaces de la barra: texto solo, sin caja. |
| **Grande** | `.btn.big`: 15 px 26 px, 19 px, 54 px | igual |
| **Chico** | `.btn.small`: 7 px 13 px, 14 px, 36 px | No se usa (mínimo táctil 44 px en páginas). |
| **Canto** | `.btn.call`: 700, `--btn-call-font` 20 px, **sin mayúsculas**, tracking 0, relleno 9 px 24 px 10 px, borde `--line-2`, raya interior blanca `inset 0 -2px 0 var(--accent)`; hover 3 px y texto `--text-hi` | Mismo aspecto para cualquier botón que sea "cantar" algo (por ejemplo un CTA "¡Quiero!"). |

En el panel de la partida (`#panel .btn`): alto 44 px, relleno 8 px 10 px, 15 px, tracking 0,04 em;
cantos 19 px. En celular (≤ 760 px): 40 px, 14 px, cantos 17 px.

## 2. Campo de texto
| Propiedad | Juego (`.a-form input`, entrada y nombre) | Páginas |
|---|---|---|
| Fuente | Hanken Grotesk 400, 17 px, sin mayúsculas | 17–18 px (16 px mínimo: evita el zoom en iOS) |
| Fondo | `--surface-2` | `--surface-2` |
| Borde | 1 px transparente; foco: borde `--accent` (blanco) | igual, o contorno 2 px `--focus` con 2 px de separación |
| Relleno | 12 px 14 px | 14 px 16 px |
| Esquina | 2 px | 2 px |
| Rótulo | Estilo Rótulo: 600–700, 12–13 px, mayúsculas, tracking 0,08–0,1 em, `--text-dim` | igual |
| Mensajes | 14 px; bien `--good-ink`, mal `--bad-ink` | igual |

**Código de sala** (`#join-code`, `.code-chip b`): monoespaciada del sistema, mayúsculas, tracking 0,25–0,3 em,
700. `#join-code` va en 30 px y en `--accent`. Es la única monoespaciada permitida, porque es un código real.
En páginas se muestra igual cuando aparece un código (ejemplo: `ABCDE`).

## 3. Selector segmentado `.seg` y píldoras
`.seg`: caja con borde 1 px `--line-2`, esquina 2 px; botones 600, 15 px, mayúsculas, tracking 0,05 em,
relleno 11 px 12 px, `--text-dim`, separados por 1 px `--line`; activo `.on` fondo `--text`, texto `--bg`.
`.m-pills button` (modo de juego en el menú): borde 1 px `--line-2`, 600, 15 px, mayúsculas, tracking 0,04 em.
Páginas: igual.

## 4. Tarjeta, panel y diálogo
| Componente | Juego | Páginas |
|---|---|---|
| `.m-card` (tarjeta del menú) | `--surface`, borde 1 px `--line-2`, esquina 2 px, relleno 18 px, gap 16 px, sombra `0 24px 60px rgba(0,0,0,.45)`. `h3`: 13 px, mayúsculas, tracking 0,1 em | Una superficie `--surface` sobre `--bg`; sombra solo si flota. |
| `.card-box` (diálogos) | `--surface`, borde 1 px `--line-2`, esquina 2 px, relleno 22 px, sombra `0 24px 60px rgba(0,0,0,.7)`, título 28 px 700 | Solo para diálogos reales. |
| `.overlay` | fondo `--shade` `rgba(0,0,0,.74)`, relleno 16 px | igual para modales |
| Título de pantalla (`.m-head h1`) | 800, `clamp(40px, 6.4vw, 64px)`, mayúsculas, tracking −0,035 em, interlineado 0,95; `TRUKE` 800 + `ADOS` 400 | Estilo Display. |
| Títulos de la tienda (`.lk-head h3`, `.lk-tag b`) | 800, 28–46 px, mayúsculas, tracking −0,04 em | Estilo Título. |

El fondo del menú y de la entrada lleva un halo `radial-gradient` de `--glow` `#1a1a1a` sobre `--bg`: es gris
sobre negro, la única "luz" de la interfaz. En páginas no se usa.

## 5. Globo de canto `.bubble`
Fondo `--text`, texto `--text-on-light`, Hanken Grotesk 700, 19 px (cantos `.call` 23 px; chat 500 14 px),
relleno 5 px 14 px 6 px, esquina 2 px, sombra `0 6px 18px rgba(0,0,0,.45)`, ancho máximo 260 px,
centrado, colita de 7 px abajo al centro. Aparece con `pop` en 180 ms.
**Es el componente más reconocible del juego**: en páginas se usa igual, sobre la cara de un personaje
o sobre una carta, con el texto real del canto (`¡Truco!`, `¡Quiero retruco!`, `Son buenas`).

## 6. Placa de nombre `.nameplate`
Grilla de foto (42 × 42, `.np-av` sobre `--surface-2`, inicial en 800 17 px) + nombre. Fondo `--panel`, borde
1 px `--line` y borde izquierdo 3 px del equipo (`--team0` blanco o `--team1` gris), relleno 5 px 12 px 5 px 5 px,
sombra `0 8px 24px rgba(0,0,0,.35)`. Nombre 750 15 px, tracking −0,01 em; ELO 700 12 px tabular ("ELO" en 500 al
60 %). Chips 10 px 700 mayúsculas `--track`, `--muted`; "te mira" en `--text`; desconectado en `--offline`.
**Con el turno se invierte**: fondo `--text`, texto `--bg`, foto `#d9d9d9`.
Al tocarla se abre `.np-drop` (fondo `--bg`, borde `--line-2`) con las últimas 3 partidas.
Páginas: para nombrar personajes y bots, igual que en el juego.

## 7. Anotador `#anotador`
Fondo `--panel`, borde 1 px `--line`, esquina 2 px, relleno 8 px 10 px 6 px, ancho mínimo 100 px.
Cabecera "Nos / Ellos" 600 11 px mayúsculas tracking 0,12 em `--text-dim`; la muestra (si hay) con rótulo
10 px 700 en `--accent`.
Palitos SVG (`palitos()` en `hud.js`): grupos de 16 px, separación 6 px, trazo 2,6 px `SCORE.stick` `#f5f5f5`
(apagado 1,4 px a 8 %), cuatro forman un cuadrado y el quinto lo cruza; variaciones fijas para que parezcan a
mano; a 30 puntos, raya punteada entre malas y buenas.
Páginas: cualquier puntaje o conteo se dibuja con palitos, nunca con barras de progreso.

## 8. Toast `.toast`
Fondo `--panel-hover`, borde 1 px `--line-2` y borde izquierdo 3 px (`--text-dim`; bien blanco; mal `--red`),
relleno 8 px 14 px, esquina 2 px, 14 px, line-height 1,4; puede llevar cartas de 66 px de alto. Aparece con `pop`.

## 9. Línea de estado `#status-line`
700, 17 px, mayúsculas, tracking 0,06 em, `--text-dim`, borde inferior 1 px `--line-2`. Cuando te toca
(`.mine`): texto `--text` y borde inferior 2 px `--accent`. Debajo, nota 13 px `--muted`.

## 10. Menú desplegable y señas
`.dropdown .menu`: `--surface`, borde 1 px `--line-2`, esquina 2 px, relleno 4 px, ancho mínimo
270 px, sombra `0 14px 34px rgba(0,0,0,.6)`. Ítem: 16 px, relleno 10 px, hover `--hover-tint`; título
600, nota 13 px `--muted`; cara de la seña en canvas de 52 × 52 sobre `--face-bg` `#1f1f1f`, esquina 2 px.
Espejo "Así te ven" (`#mirror`): 110 × 110, `--face-bg`, borde 1 px `--line-2`, esquina 2 px.
Barra de mirar (`#look-bar`): rótulos 10 px 700 mayúsculas `--muted`; el botón activo con texto `--accent` y raya
de 2 px abajo.

## 11. Chat
Panel `--panel-hover`, borde 1 px `--line-2`, ancho hasta 340 px; cabecera 13 px mayúsculas tracking 0,1 em;
texto 14 px / 1,4; nombres 600 en color de equipo (`--team0` blanco / `--team1` gris); mensajes del sistema
13 px `--muted`.
Ruleta de frases (`#wheel`): disco `--panel-soft` con borde `--line-2`; cada frase en `--surface-2`, borde
`--line-2`, 2 px; en hover y foco se invierte (fondo `--accent`, texto `--accent-ink`).

## 12. Teclas `kbd`
700, 11 px, borde 1 px `--line-2` con 2 px abajo, esquina 2 px, relleno 0 5 px, alto de línea 16 px,
`--text-dim`. En páginas solo si se explica un control (Z, A/D, 1-2-3, Enter).

## 13. Resultado `#result`
Diálogo centrado sobre `--shade`; marcador final 56 px 700; botón **Revancha** grande y principal (blanco).
En la repetición, el marcador y los bordes de cada equipo van en `--team0` / `--team1`.

---

## Componentes que solo existen en páginas

| Componente | Especificación |
|---|---|
| **Barra de navegación** | El nombre (o el logo mono blanco, alto 24–28 px), 3 a 4 enlaces en estilo Rótulo (mayúsculas, 13–15 px, `--text-dim`, hover `--text`), un botón principal blanco "Jugar". Fondo `--bg` sólido, sin blur. Alto 64–72 px. |
| **Naipe** | Imagen WebP del juego, proporción 512 : 788, esquina `--radius-naipe`, sin borde. Sombra solo si está "en el aire" (volando o levantada). En el paño, sin sombra. |
| **Cara** | Personaje dibujado con `drawCharacter` (ver [RECURSOS.md](RECURSOS.md)), recorte de cara sobre `--face-bg` o `--surface`, esquina 2 px. |
| **Imagen de mesa** | Captura o render de la mesa a color, a sangre o en un bloque recto. Es el único lugar con color de la página. |
| **Pie** | El nombre en grande (Display), enlaces en Rótulo, créditos en Legal (13 px `--muted`). Créditos de cartas obligatorios. |

## Estados obligatorios en cualquier control
- **Hover**: un escalón de tono, 120–180 ms.
- **Foco**: `outline: 2px solid var(--focus); outline-offset: 2px;` (blanco) siempre visible con teclado.
- **Presionado**: `translateY(1px)`, 120 ms.
- **Deshabilitado**: opacidad .35.
- **Cargando**: el texto del botón cambia ("Buscando mesa…"); no se usan ruedas giratorias.
