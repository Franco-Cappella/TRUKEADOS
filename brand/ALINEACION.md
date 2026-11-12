# Trukeados — lo que falta pasar al blanco y negro

En noviembre 2026 (commit `90dd922`, "Diseño blanco y negro grotesk") el juego pasó a **blanco y negro,
grotesk**: Hanken Grotesk, negro, blanco y grises, el blanco como acento, el rojo solo para errores, esquinas
rectas. La mesa y los ambientes siguen a color. Desde entonces **el juego es la referencia** y la marca lo sigue.
Esta es la lista de lo que todavía no coincide.

**Estado (2026-11-12)**: juego ✅, documentos de `brand/` y `DESIGN.md` ✅, `brand/tokens.css` ✅ (con alias
heredados), `brand/lamina.html` ✅. Pendiente: logos (§1), landing (§2) y detalles del juego (§3).

Prioridad: 🔴 se ve en la pantalla de entrada · 🟡 coherencia visual · ⚪ cuando se pueda.

## 0. Decisiones cerradas

| Tema | Decisión |
|---|---|
| Tipografía | **Hanken Grotesk**, 400–800, una sola familia. Reemplaza a Archivo (y con ella los anchos 62–125 %). |
| Paleta de interfaz | Negro, blanco y grises. El acento es el blanco. Equipos blanco / gris `#8c8c8c`. Rojo `#ff5a4f` solo para errores y trampa. |
| Botón principal | **Blanco con letra negra, en el juego y en las páginas.** Se descarta el botón oro (era el §4 de la versión anterior de este documento). |
| Palos como colores | Ya no son colores de interfaz. `--oro`, `--espada`, `--basto`, `--copa` quedan en `tokens.css` como alias heredados. |
| Paño como fondo de sección | **No.** Las páginas no tienen campos de color; el paño queda en la escena y en las imágenes. |
| Esquinas | 2 px en todo (antes 3–4 px). |
| La mesa | A todo color (paño verde por defecto, ambientes, cartas, personajes). Se probó un paño grafito en `90dd922` y se volvió al color. |

## 1. Logos 🔴

| Dónde | Hoy | Qué hacer |
|---|---|---|
| `public/favicon.svg`, `public/img/icon-*.png` | ✅ Blanco y negro: dos naipes cruzados, uno blanco lleno y uno calado con la raya de la espada. | Tomarlo como base de la marca nueva. |
| `brand/logo/*.svg` | Espada azul `#2f6fd6` con guarda y pomo oro `#f2c12e`; palabra en Archivo Expanded Black. | Rehacer: marca de una sola tinta (como el favicon) y palabra TRUKEADOS en Hanken Grotesk 800 convertida a contornos. Versiones: blanco sobre negro y negro sobre blanco (ya no hace falta la de color). |
| `brand/tools/build-logos.mjs` | Lee `ArchivoExpanded-Black.ttf` y pinta la espada en color. | Pasarlo a Hanken Grotesk (TTF de Google Fonts) y a una tinta; regenerar `logo-data.json`. |
| `public/img/og.png` | ✅ Ya en el sistema nuevo: favicon blanco y negro, TRUKEADOS en Hanken Grotesk 800 en mayúsculas, botón blanco "JUGAR GRATIS" sobre una captura a color. | Es la referencia de cómo se ve una pieza de la marca. |

Mientras tanto, en piezas nuevas: el nombre escrito en Hanken Grotesk (`TRUKE` 800 + `ADOS` 400), o los SVG
mono blanco / mono negro.

## 2. La landing (`trukeados-landing`) 🔴

La landing sigue en el sistema anterior: Archivo autoalojada (`@fontsource-variable/archivo`), anchos 78–125 %,
botón principal oro con reflejo de moneda, selección de texto oro y "te mira" en oro.

| Archivo de la landing | Qué cambiar |
|---|---|
| `package.json` | `@fontsource-variable/archivo` → `@fontsource-variable/hanken-grotesk`. |
| `src/styles/base.css` | `--font` a `'Hanken Grotesk Variable', 'Hanken Grotesk', …`; botón principal blanco con letra negra (hover `--accent-hover`); sacar el reflejo de moneda; selección de texto blanca con tinta negra. |
| `src/styles/landing.css`, `estudios.css` | Sacar los `font-stretch` (no hacen nada con Hanken); títulos y rótulos en mayúsculas como en el juego; "te mira" en `--text`; el campo de paño, fuera. |
| `src/styles/tokens.css` | Es una copia vieja (la trae `npm run sync`). La versión nueva está en `brand/tokens.css`, con el mismo contenido que la del juego; al migrar, `src/main.tsx` tiene que importar `../brand/tokens.css`. Los alias heredados evitan que se rompa antes de cambiar el CSS. |
| `index.html` | Precargar Hanken Grotesk en lugar de Archivo; `theme-color` `#0a0a0a`. |
| `src/ui/Footer.tsx`, `docs/CONTRATO.md`, `public/llms.txt` | Crédito de la tipografía: "Hanken Grotesk, de Hanken Design Co. (OFL)". |
| `src/three/bar/palette.ts` | Revisar: la escena puede seguir a color, pero ningún color de ahí va a la interfaz. |

## 3. Detalles del juego 🟡

| Tema | Hoy | Qué hacer |
|---|---|---|
| `theme-color` | `<meta name="theme-color" content="#121212">` en `public/index.html` | Pasar a `#0a0a0a` (el `--bg` nuevo). Revisar también `manifest.webmanifest`. |
| Restos de Archivo en el CSS | `font-stretch: var(--narrow)` en muchos selectores de `truco.css` (`--narrow` vale 100 %) | Se pueden borrar sin cambio visible. |
| `accent-color: var(--yellow)` | Casillas de verificación (`.a-level`, `.rv-reveal`) | Funciona (`--yellow` es blanco), pero conviene pasarlo a `--accent`. |
| Fondo del menú | `radial-gradient` de `--glow` `#1a1a1a` | Excepción aceptada del juego: es gris sobre negro, no un degradé de color. |

## 4. Para que la landing lleve más directo al juego ⚪

No hacen falta para publicar, pero mejoran el paso de la landing al juego:

| Cambio | Para qué |
|---|---|
| Aceptar `?nombre=` en el menú y guardarlo con `store.set(KEYS.name)` | Que el nombre escrito en la landing llegue puesto. |
| Aceptar `?modo=1v1\|2v2\|3v3&rapida=1` y `?practica=1` | Que "Partida rápida" y "Practicar con bots" de la landing salteen el menú. |
| Encabezado CORS en `GET /api/lobby` (solo el origen de la landing) | Mostrar "mesas jugándose ahora" en la landing. |

Cada uno es un cambio chico en `main.js` / `menu.js` / `src/index.js`, con su prueba.

## Cómo se usa este documento

Cuando se haga un cambio de esta lista, se marca la fila como hecha, se actualiza la fecha al principio, y se
corre `npm test` en el juego (y `npm run build` en la landing si se tocó).
