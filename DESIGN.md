# DESIGN.md — sistema de diseño de Trukeados

Leé esto antes de diseñar o maquetar cualquier cosa de Trukeados: el juego, la landing o cualquier
página derivada. Todo sale de lo que el juego ya usa. Si algo de acá choca con una skill de diseño,
gana esto (y por encima de esto, lo que pida el usuario en el momento).

Esta documentación vive en dos repos, iguales: TRUKEADOS y trukeados-landing (este archivo, `brand/` y `docs/landing/`).
Se edita en cualquiera de los dos y se sincroniza con `npm run diseno:sync`; ver al final.

## Dónde está cada cosa

| Necesito… | Archivo |
|---|---|
| La idea, el nombre, el logo, el color, la tipografía, la voz en general | [brand/BRAND.md](brand/BRAND.md) |
| Los valores en código | [brand/tokens.css](brand/tokens.css) (y en el juego: `:root` de `public/css/truco.css`, `public/js/theme.js`) |
| Los logos | [brand/logo/](brand/logo/) |
| Verlo todo junto | [brand/lamina.html](brand/lamina.html) (abrir en el navegador) |
| Cómo es cada botón, campo, globo, panel… | [brand/COMPONENTES.md](brand/COMPONENTES.md) |
| Cartas, personajes, señas, anotador, ambientes, sonido, capturas | [brand/RECURSOS.md](brand/RECURSOS.md) |
| Qué palabras usar y cómo suena | [brand/VOZ.md](brand/VOZ.md) |
| Reglas para la landing y otras páginas | [brand/PAGINAS.md](brand/PAGINAS.md) |
| Qué falta pasar al sistema nuevo (logos, landing) | [brand/ALINEACION.md](brand/ALINEACION.md) |
| Qué hace el juego (contenido) | [docs/JUEGO.md](docs/JUEGO.md) |
| Plan y secciones de la landing | [docs/landing/](docs/landing/) |

## Las reglas en una pantalla

**Blanco y negro, grotesk** (desde noviembre 2026, commit `90dd922`). La interfaz es negro, blanco y grises;
el color lo ponen las cartas, los personajes y la mesa 3D.

- **Nombre**: Trukeados. Bajada: "Truco argentino online, en 3D."
- **Tipografía**: solo **Hanken Grotesk** (Hanken Design Co., Google Fonts, OFL), variable de 400 a 800.
  Títulos en **mayúsculas grandes y apretadas** (800, tracking −0,035 a −0,04 em, interlineado 0,95);
  rótulos y botones en **mayúsculas con aire** (600–700, tracking 0,08 em, 10–15 px); texto en oración, 400.
  Los cantos van sin mayúsculas forzadas (700). Sin itálicas, sin serif, sin monoespaciada (salvo códigos de sala).
- **Color**: fondo `#0a0a0a`, superficies `#141414` / `#1f1f1f`, tinta `#f4f4f4`, grises `#a8a8a8` y `#757575`.
  **El acento es el blanco**: el botón principal es blanco con letra negra. Equipos: "nosotros" en blanco,
  "ellos" en gris `#8c8c8c`. **El rojo `#ff5a4f` es el único color de interfaz** y es solo para errores, trampa y
  peligro. Nada de oro, azul, verde, marfil, latón, marrones ni degradés en la interfaz.
- **La mesa sí va a color**: paño (verde por defecto, o el de la tienda), madera, los nueve ambientes
  (`ambientes.js`), las 40 cartas y los personajes. La interfaz nunca toma esos colores.
- **Forma**: **esquinas rectas** (2 px); bordes de 1 px `rgba(255,255,255,.1)` / `.22`; sombras solo en lo que
  flota (globo de canto, menú, diálogo, placa de nombre sobre la escena).
- **Movimiento**: "arranca rápido y se asienta" (`cubic-bezier(0.16, 1, 0.3, 1)`), 120 / 180 / 420 ms;
  las señas duran 2,2 s; nadie parpadea solo; con movimiento reducido no hay desplazamientos.
- **Voz**: rioplatense, voseo, corto, con picardía, sin prometer lo que el juego no tiene.
- **Imágenes**: capturas reales del juego, cartas y personajes del juego. Nunca fotos de stock.
- **Logo**: el favicon del juego ya es blanco y negro (dos naipes, uno blanco y uno calado). Los SVG de
  `brand/logo/` todavía son los de antes (espada azul y oro, palabra en Archivo): están por rehacerse
  (ver [brand/ALINEACION.md](brand/ALINEACION.md)).
- **Juego ≠ página**: el juego es una aplicación (rótulos en mayúsculas, bordes de 1 px, paneles); las páginas
  usan la misma tipografía y los mismos grises con más escala y menos interfaz.

## Cómo se cambia el sistema

La documentación se edita en cualquiera de los dos repos. Después se corre `npm run diseno:sync` en ese repo: copia
el cambio al otro. Si el mismo archivo cambió en los dos lados, el script no lo toca y avisa: se iguala a mano y se
vuelve a correr. `npm run diseno:sync -- --check` dice si falta algo, sin escribir nada.

1. El juego es la referencia del código: `:root` de `public/css/truco.css` (interfaz) y `public/js/theme.js` (canvas y
   escena). Si un documento no coincide con el CSS, se corrige el documento.
2. Los valores de `brand/tokens.css` se copian a mano a `:root` de `truco.css`. Se actualiza el documento de `brand/`
   que corresponda (y `brand/lamina.html`).
3. Se corre `npm run diseno:sync` y se commitea en los dos repos (incluido `.diseno-sync.json`).
4. Si hay una decisión de fondo (un color nuevo, otra tipografía), un ADR en `docs/decisions/`.
