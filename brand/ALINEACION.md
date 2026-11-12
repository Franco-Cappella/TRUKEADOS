# Trukeados — lo que falta pasar al blanco y negro

Desde noviembre de 2026 el juego es blanco y negro, en Hanken Grotesk (ver [DESIGN.md](../DESIGN.md)). La mesa y los
ambientes siguen a color. Esta es la lista de lo que todavía no coincide con ese sistema y de lo que queda pendiente.

**Estado (2026-11-12)**: juego ✅, documentos de `brand/` y `DESIGN.md` ✅, `brand/tokens.css` ✅ (con alias heredados),
`brand/lamina.html` ✅. Pendiente: logos (§1), landing (§2), detalles del juego (§3), y lo que queda para publicar la
landing (§5).

Prioridad: 🔴 se ve en la pantalla de entrada · 🟡 coherencia visual · ⚪ cuando se pueda.

## 0. Decisiones cerradas

| Tema | Decisión |
|---|---|
| Tipografía | Hanken Grotesk. Reemplaza a Archivo (ver [BRAND.md](BRAND.md) §4). |
| Paleta de interfaz | Negro, blanco y grises. El acento es el blanco. El rojo, solo para errores y trampa (ver [BRAND.md](BRAND.md) §3). |
| Botón principal | Blanco con letra negra, en el juego y en las páginas. Se descartó el botón oro. |
| Palos como colores | Ya no son colores de interfaz. `--oro`, `--espada`, `--basto` y `--copa` quedan en `tokens.css` como alias heredados. |
| Paño como fondo de sección | No. Las páginas no tienen campos de color: el paño queda en la escena y en las imágenes. |
| La mesa | A todo color. |

## 1. Logos 🔴

| Dónde | Hoy | Qué hacer |
|---|---|---|
| `public/favicon.svg`, `public/img/icon-*.png` | ✅ Blanco y negro: dos naipes cruzados, uno blanco lleno y uno calado con la raya de la espada. | Tomarlo como base de la marca nueva. |
| `brand/logo/*.svg` | Espada azul con guarda y pomo dorados; palabra en Archivo Expanded Black. | Rehacer: marca de una sola tinta (como el favicon) y palabra TRUKEADOS en Hanken Grotesk 800 convertida a contornos. Versiones: blanco sobre negro y negro sobre blanco. Ya no hace falta la de color. |
| `brand/tools/build-logos.mjs` | Lee `ArchivoExpanded-Black.ttf` y pinta la espada en color. | Pasarlo a Hanken Grotesk (TTF de Google Fonts) y a una tinta; regenerar `logo-data.json`. |
| `public/img/og.png` | ✅ Ya está en el sistema nuevo: favicon blanco y negro, TRUKEADOS en Hanken Grotesk 800 en mayúsculas, botón blanco "JUGAR GRATIS" sobre una captura a color. | Es la referencia de cómo se ve una pieza de la marca. |

Mientras tanto, en piezas nuevas: el nombre escrito en Hanken Grotesk (`TRUKE` 800 + `ADOS` 400), o los SVG mono blanco / mono negro.

### Cómo se regeneran los SVG actuales

`brand/tools/build-logos.mjs` arma los SVG de `brand/logo/` con la palabra convertida a contornos. Hoy lo hace desde
Archivo Expanded Black y con la espada en color. Mientras no se rehagan, así se regeneran:

```bash
mkdir /tmp/logos && cd /tmp/logos && npm init -y && npm i opentype.js@1.3.4
curl -LO https://raw.githubusercontent.com/Omnibus-Type/Archivo/master/fonts/ttf/ArchivoExpanded-Black.ttf
node <repo>/brand/tools/build-logos.mjs . <repo>/brand/logo
```

La geometría de la marca (`CARD`, `BACK`, `FRONT`, `swordLocal`) está al principio del script.

## 2. La landing (`trukeados-landing`) 🔴

La landing sigue en el sistema anterior: Archivo autoalojada (`@fontsource-variable/archivo`), anchos de 78 a 125 %,
botón principal dorado con reflejo de moneda, selección de texto dorada y "te mira" en dorado.

| Archivo de la landing | Qué cambiar |
|---|---|
| `package.json` | `@fontsource-variable/archivo` → `@fontsource-variable/hanken-grotesk`. |
| `src/styles/base.css` | `--font` a `'Hanken Grotesk Variable', 'Hanken Grotesk', …`; botón principal blanco con letra negra (hover `--accent-hover`); sacar el reflejo de moneda; selección de texto blanca con tinta negra. |
| `src/styles/landing.css` | Sacar los `font-stretch` (no hacen nada con Hanken); títulos y rótulos en mayúsculas como en el juego; "te mira" en `--text`; el campo de paño, fuera. |
| `src/styles/tokens.css` | Es una copia vieja (la trae `npm run sync`). La versión nueva está en `brand/tokens.css`, con el mismo contenido que la del juego; al migrar, `src/main.tsx` tiene que importar `../brand/tokens.css`. Los alias heredados evitan que se rompa antes de cambiar el CSS. |
| `index.html` | Precargar Hanken Grotesk en lugar de Archivo; `theme-color` `#0a0a0a`. |
| `src/ui/Footer.tsx`, `docs/CONTRATO.md`, `public/llms.txt` | Crédito de la tipografía: "Hanken Grotesk, de Hanken Design Co. (OFL)". |

## 3. Detalles del juego 🟡

| Tema | Hoy | Qué hacer |
|---|---|---|
| `theme-color` | `<meta name="theme-color" content="#121212">` en `public/index.html` | Pasar a `#0a0a0a` (el `--bg` nuevo). Revisar también `manifest.webmanifest`. |
| Restos de Archivo en el CSS | `font-stretch: var(--narrow)` en muchos selectores de `truco.css` (`--narrow` vale 100 %) | Se pueden borrar sin cambio visible. |
| `accent-color: var(--yellow)` | Casillas de verificación (`.a-level`, `.rv-reveal`) | Funciona (`--yellow` es blanco), pero conviene pasarlo a `--accent`. |
| Fondo del menú | `radial-gradient` de `--glow` | Excepción aceptada del juego: es gris sobre negro, no un degradé de color. |

## 4. Para que la landing lleve más directo al juego ⚪

No hacen falta para publicar, pero mejoran el paso de la landing al juego:

| Cambio | Para qué |
|---|---|
| Aceptar `?nombre=` en el menú y guardarlo con `store.set(KEYS.name)` | Que el nombre escrito en la landing llegue puesto. |
| Aceptar `?modo=1v1\|2v2\|3v3&rapida=1` y `?practica=1` | Que "Partida rápida" y "Practicar con bots" de la landing salteen el menú. |
| Encabezado CORS en `GET /api/lobby` (solo el origen de la landing) | Mostrar "mesas jugándose ahora" en la landing. |

Cada uno es un cambio chico en `main.js` / `menu.js` / `src/index.js`, con su prueba.

## 5. Lo que queda de publicar la landing ⚪

| Tema | Estado |
|---|---|
| Medición del tráfico | No decidida. Se recomendó Cloudflare Web Analytics (sin cookies). |
| INP y picos al redibujar personajes | Pendiente en un celular real. En laboratorio se midió con la CPU 4 veces más lenta (ver el contrato de la landing, §7). |
| Variables de build | Confirmar en Vercel que estén `VITE_GAME_URL` y `VITE_SITE_URL` (están en `.env.example`). |
| Ideas que necesitan tocar el juego | Un contador de partidas jugadas (el servidor no lo cuenta hoy). Un desafío diario o un ranking (no hay cuentas ni persistencia de jugadores). Entrar a la mesa desde la landing sin recargar (hay que rehacer las rutas `/` y `/sala/CÓDIGO`). Personalizar el personaje más allá del nombre. |

## Cómo se usa este documento

Cuando se haga un cambio de esta lista, se marca la fila como hecha, se actualiza la fecha al principio, y se corre `npm test`
en el juego (y `npm run build` en la landing si se tocó).
