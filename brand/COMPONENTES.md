# Trukeados — componentes

Cada componente del juego, con sus medidas y los tokens que usa (`public/css/truco.css`). Colores, fuentes y esquinas
están en [tokens.css](tokens.css) y en [BRAND.md](BRAND.md); acá se nombran los tokens y no se repiten los valores.
Si algo de acá no coincide con el CSS del juego, gana el CSS.

En el juego (una aplicación) los rótulos y botones van en mayúsculas con aire y hay bordes de 1 px. En las páginas se
usa la misma tipografía y los mismos grises, con más escala y menos cajas: [PAGINAS.md](PAGINAS.md).

---

## 1. Botón

**Base `.btn`**: tamaño `--btn-font` (15 px; 16 px en celular ≤ 640 px) · relleno `--btn-pad` (12 px 20 px; 11 px 16 px
en celular) · alto mínimo `--btn-min-h` (46 px) · borde 1 px `--line-2` · fondo `--panel` · esquina `--radius` · mayúsculas
y tracking según [BRAND.md](BRAND.md) §4 · contenido en `inline-flex`, con 8 px de separación, sin saltos de línea,
interlineado 1,1. Hover: borde `--text-dim` y fondo `--panel-hover`. Presionado: `translateY(1px)` en 120 ms.
Deshabilitado: opacidad .35 y cursor `not-allowed`. Transición de fondo, borde y color en 0,12 s.

En páginas, el mismo botón, de 15 a 17 px. El grande, de 19 px, con relleno 15 px 26 px y alto 54 px.

| Variante | Juego | Páginas |
|---|---|---|
| **Principal** | `.btn.primary`: fondo `--text`, texto `--bg`, borde `--text`. Hover `--accent-hover`. | Igual. **Uno por pantalla.** |
| **Secundario** | `.btn` base. | Igual. |
| **Bien** | `.btn.good`: borde y texto `--good-line` / `--good-ink`, hover `--good-bg`. | Casi no se usa. |
| **Peligro / trampa** | `.btn.danger`: borde `--red`, texto `--bad-ink`, hover `--bad-bg`. | Solo para mostrar la trampa ("¡Mostrá las dos!"). |
| **Fantasma** | `.btn.ghost`: fondo `--panel-soft`, borde `--line`. | Enlaces de la barra: texto solo, sin caja. |
| **Grande** | `.btn.big`: relleno 15 px 26 px, 19 px, alto 54 px. | Igual. |
| **Chico** | `.btn.small`: relleno 7 px 13 px, 14 px, alto 36 px. | No se usa (mínimo táctil de 44 px). |
| **Canto** | `.btn.call`: 700, `--btn-call-font` (20 px), **sin mayúsculas**, tracking 0, relleno 9 px 24 px 10 px, borde `--line-2`, raya interior `inset 0 -2px 0 var(--accent)`; en hover, la raya pasa a 3 px y el texto a `--text-hi`. | El mismo aspecto para cualquier botón que sea "cantar" algo (por ejemplo "¡Quiero!"). |

**Panel de la partida** (`#panel .btn`): alto 44 px, relleno 8 px 10 px, 15 px, tracking 0,04 em; los cantos, 19 px.
En celular (≤ 760 px): 40 px de alto, 14 px, cantos a 17 px.

## 2. Campo de texto

Juego (`.a-form input`, entrada y nombre): 17 px, sin mayúsculas, fondo `--surface-2`, borde 1 px transparente; en foco,
el borde pasa a `--accent`. Relleno 12 px 14 px. Esquina `--radius`.
En páginas: 17 a 18 px (nunca menos de 16 px, para que iOS no haga zoom), relleno 14 px 16 px, y foco con contorno de `--focus`.
Rótulo: estilo Rótulo de [BRAND.md](BRAND.md) §4. Mensajes: 14 px, en `--good-ink` o `--bad-ink`.

**Código de sala** (`#join-code`, `.code-chip b`): son 4 números (`ROOM_CODE_LEN` en `config.js`), en la monoespaciada del
sistema, peso 700 y tracking de 0,25 a 0,3 em. `#join-code` va en 30 px y en `--accent`. Es la única monoespaciada
permitida, porque es un código real. En páginas se muestra igual (ejemplo: `1234`).

## 3. Selector segmentado

`.seg`: borde 1 px `--line-2`, esquina `--radius`. Botones de 15 px, peso 600, mayúsculas, tracking 0,05 em, relleno
11 px 12 px, separados por 1 px `--line`. El activo (`.on`) tiene fondo `--text` y texto `--bg`.
`.m-pills button` (modo de juego en el menú): borde 1 px `--line-2`, 600, 15 px, mayúsculas, tracking 0,04 em.
En páginas, igual.

## 4. Tarjeta, panel y diálogo

| Componente | Juego | Páginas |
|---|---|---|
| `.m-card` (tarjeta del menú) | Fondo `--surface`, borde 1 px `--line-2`, relleno 18 px, separación 16 px, sombra `0 24px 60px rgba(0,0,0,.45)`. Título `h3`: 13 px, mayúsculas, tracking 0,1 em. | Una superficie `--surface` sobre `--bg`; sombra solo si flota. |
| `.card-box` (diálogos) | Fondo `--surface`, borde 1 px `--line-2`, relleno 22 px, sombra `0 24px 60px rgba(0,0,0,.7)`, título 28 px 700. | Solo para diálogos reales. |
| `.overlay` | Fondo `--shade`, relleno 16 px. | Igual, para modales. |
| Título de pantalla (`.m-head h1`) | `clamp(40px, 6.4vw, 64px)`, interlineado 0,95, tracking −0,035 em. `TRUKE` 800 + `ADOS` 400. | Estilo Display. |
| Títulos de la tienda (`.lk-head h3`, `.lk-tag b`) | 28 a 46 px, mayúsculas, tracking −0,04 em. | Estilo Título. |

El menú y la entrada llevan un halo `radial-gradient` de `--glow` sobre `--bg`: es gris sobre negro, la única "luz" de la
interfaz. En páginas no se usa.

## 5. Globo de canto `.bubble`

Fondo `--text`, texto `--text-on-light`, peso 700, 19 px (el `.call`, 23 px; el chat, peso 500 y 14 px). Relleno 5 px 14 px
6 px, esquina `--radius`, sombra `0 6px 18px rgba(0,0,0,.45)`, ancho máximo 260 px, centrado, con una colita de 7 px al
centro de abajo. Aparece con `pop` en 180 ms.
Es el componente más reconocible del juego: en páginas se usa igual, sobre la cara de un personaje o una carta, con el
canto real.

## 6. Placa de nombre `.nameplate`

Foto de 42 × 42 (`.np-av` sobre `--surface-2`, inicial en 800 de 17 px) y nombre. Fondo `--panel`, borde 1 px `--line`
y borde izquierdo de 3 px del equipo (`--team0` o `--team1`), relleno 5 px 12 px 5 px 5 px, sombra `0 8px 24px rgba(0,0,0,.35)`.
Nombre de 15 px, peso 750, tracking −0,01 em. ELO de 12 px, peso 700, cifras tabulares ("ELO" en 500, al 60 %).
Chips de 10 px, peso 700, mayúsculas: "te mira" en `--text`; desconectado en `--offline`.
**Con el turno se invierte**: fondo `--text`, texto `--bg`, foto `#d9d9d9`.
Al tocarla se abre `.np-drop` (fondo `--bg`, borde `--line-2`) con las últimas 3 partidas.
En páginas: para nombrar personajes y bots, igual que en el juego.

## 7. Anotador `#anotador`

Fondo `--panel`, borde 1 px `--line`, esquina `--radius`, relleno 8 px 10 px 6 px, ancho mínimo 100 px. Cabecera "Nos /
Ellos": 600, 11 px, mayúsculas, tracking 0,12 em, en `--text-dim`. La muestra, si hay, lleva un rótulo de 10 px, 700,
en `--accent`.

Palitos (`palitos()` en `hud.js`): grupos de 16 px con 6 px de separación; trazo de 2,6 px en `SCORE.stick`, y apagado
de 1,4 px al 8 %. Cuatro forman un cuadrado y el quinto lo cruza. Cada palito tiene una variación fija para que parezca
hecho a mano. A 30 puntos, una raya punteada separa las malas de las buenas.
En páginas: cualquier puntaje o conteo se dibuja con palitos, nunca con barras de progreso.

## 8. Toast `.toast`

Fondo `--panel-hover`, borde 1 px `--line-2` y borde izquierdo de 3 px (`--text-dim`; bien, `--good-line`; mal, `--red`).
Relleno 8 px 14 px, esquina `--radius`, 14 px de letra e interlineado 1,4. Puede llevar cartas de 66 px de alto.
Aparece con `pop`.

## 9. Línea de estado `#status-line`

Peso 700, 17 px, mayúsculas, tracking 0,06 em, `--text-dim`, borde inferior de 1 px `--line-2`. Cuando te toca (`.mine`):
texto `--text` y borde inferior de 2 px `--accent`. Debajo, una nota de 13 px en `--muted`.

## 10. Menú desplegable y señas

`.dropdown .menu`: fondo `--surface`, borde 1 px `--line-2`, esquina `--radius`, relleno 4 px, ancho mínimo 270 px,
sombra `0 14px 34px rgba(0,0,0,.6)`. Ítem: 16 px, relleno 10 px, hover `--hover-tint`. Título en 600; nota de 13 px en
`--muted`. La cara de la seña es un canvas de 52 × 52 sobre `--face-bg`.
Espejo "Así te ven" (`#mirror`): 110 × 110, sobre `--face-bg`, borde 1 px `--line-2`.
Barra de mirar (`#look-bar`): rótulos de 10 px, peso 700, mayúsculas, en `--muted`. El botón activo va en `--accent`,
con una raya de 2 px abajo.

## 11. Chat

Panel `--panel-hover`, borde 1 px `--line-2`, ancho hasta 340 px. Cabecera de 13 px en mayúsculas, tracking 0,1 em. Texto
de 14 px con interlineado 1,4. Nombres en 600 y con el color del equipo; mensajes del sistema de 13 px en `--muted`.

Ruleta de frases (`#wheel`): disco `--panel-soft` con borde `--line-2`. Cada frase va sobre `--surface-2`, con borde
`--line-2`; en hover y en foco se invierte (fondo `--accent`, texto `--accent-ink`).

## 12. Teclas `kbd`

Peso 700, 11 px, borde 1 px `--line-2` con 2 px abajo, relleno 0 5 px, alto de línea 16 px, en `--text-dim`.
En páginas, solo si se explica un control (Z, A/D, 1-2-3, Enter).

## 13. Resultado `#result`

Diálogo centrado sobre `--shade`. Marcador final de 56 px, peso 700. Botón **Revancha**, grande y principal. En la
repetición, el marcador y los bordes de cada equipo van en `--team0` y `--team1`.

---

## Solo en páginas

- **Barra de navegación**: el nombre (o el logo mono blanco, de 24 a 28 px de alto), de 3 a 4 enlaces en estilo Rótulo
  (en `--text-dim`, hover `--text`) y el botón principal "Jugar". Fondo `--bg` sólido, sin blur. Alto de 64 a 72 px.
- **Pie**: el nombre en grande (estilo Display), enlaces en Rótulo y créditos en Legal. Los créditos de las cartas son
  obligatorios: [RECURSOS.md](RECURSOS.md) §1.
- **Naipe, cara e imagen de mesa**: ver [RECURSOS.md](RECURSOS.md) §1 y §2, y [BRAND.md](BRAND.md) §7.

## Estados de cualquier control

- **Hover**: un escalón de tono, con la duración de [BRAND.md](BRAND.md) §8.
- **Foco**: `outline: 2px solid var(--focus); outline-offset: 2px`, siempre visible con teclado.
- **Presionado**: `translateY(1px)`.
- **Deshabilitado**: opacidad .35.
- **Cargando**: el texto del botón cambia ("Buscando mesa…"). No se usan ruedas giratorias.
