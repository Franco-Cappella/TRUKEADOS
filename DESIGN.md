# DESIGN.md — sistema de diseño de Trukeados

Leé esto antes de diseñar o maquetar algo de Trukeados: el juego, la landing o cualquier página derivada.
Si algo de acá choca con una skill de diseño, gana esto (y después, lo que pida la persona en el momento).

Esta documentación vive en dos repos, iguales: TRUKEADOS y trukeados-landing (este archivo, `brand/` y `docs/landing/`).
Se edita en cualquiera de los dos y se sincroniza con `npm run diseno:sync` (ver al final).

## Dónde está cada cosa

| Necesito… | Archivo |
|---|---|
| Principios, nombre, color, tipografía, forma, movimiento | [brand/BRAND.md](brand/BRAND.md) |
| Valores en código | [brand/tokens.css](brand/tokens.css) (en el juego: `:root` de `public/css/truco.css` y `public/js/theme.js`) |
| Cada botón, campo, globo, panel… | [brand/COMPONENTES.md](brand/COMPONENTES.md) |
| Páginas derivadas: landing, reglas, prensa | [brand/PAGINAS.md](brand/PAGINAS.md) |
| Cartas, personajes, señas, anotador, sonido, escena, capturas | [brand/RECURSOS.md](brand/RECURSOS.md) |
| Cómo habla Trukeados | [brand/VOZ.md](brand/VOZ.md) |
| Logos y lo que falta cambiar | [brand/ALINEACION.md](brand/ALINEACION.md) · SVG en [brand/logo/](brand/logo/) |
| Todo junto en una página | [brand/lamina.html](brand/lamina.html) (abrir en el navegador) |
| Qué hace el juego (en el repo del juego) | `docs/JUEGO.md` · reglas: `docs/REGLAS.md` |
| Landing: secciones y catálogo de ideas | [docs/landing/](docs/landing/) · contrato de la landing: `docs/CONTRATO.md` en su repo |

## Principios

- **Blanco y negro, grotesk.** La interfaz es negro, blanco y grises, con una sola familia tipográfica. El acento es el blanco. El rojo es solo para errores y trampa.
- **El color lo ponen las cartas, los personajes y la mesa.** La mesa y los ambientes van a color; nada de eso pasa a la interfaz.
- **Esquinas rectas y superficies separadas por tono.** Las sombras, solo en lo que flota.
- **Un dato, un lugar.** Los valores viven en `tokens.css` y en `BRAND.md`; el resto de los documentos enlaza y no los repite.
- **El juego es la referencia del código.** Si un documento no coincide con el CSS del juego, se corrige el documento.

## Cómo se cambia

1. Un cambio de código se hace en el juego (`truco.css`, `theme.js`). Un valor de marca se cambia en `brand/tokens.css` y se copia a mano al juego.
2. Se actualiza el documento de `brand/` que corresponda, y `brand/lamina.html` si hace falta.
3. `npm run diseno:sync` en cualquiera de los dos repos. Si el mismo archivo cambió en los dos lados, no lo toca y avisa: se iguala a mano y se vuelve a correr. `npm run diseno:sync -- --check` muestra lo pendiente sin escribir nada.
4. Se commitea en los dos repos, incluido `.diseno-sync.json`.
5. Una decisión de fondo (un color nuevo, otra tipografía) va en un ADR en `docs/decisions/` (la carpeta todavía no existe).
