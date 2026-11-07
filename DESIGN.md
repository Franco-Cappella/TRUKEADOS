# DESIGN.md — sistema de diseño de Trukeados

Leé esto antes de diseñar o maquetar cualquier cosa de Trukeados: el juego, la landing o cualquier
página derivada. Todo sale de lo que el juego ya usa. Si algo de acá choca con una skill de diseño,
gana esto (y por encima de esto, lo que pida el usuario en el momento).

## Dónde está cada cosa

| Necesito… | Archivo |
|---|---|
| La idea, el nombre, el logo, el color, la tipografía, la voz en general | [brand/BRAND.md](brand/BRAND.md) |
| Los valores en código | [brand/tokens.css](brand/tokens.css) |
| Los logos | [brand/logo/](brand/logo/) |
| Verlo todo junto | [brand/lamina.html](brand/lamina.html) (abrir en el navegador) |
| Cómo es cada botón, campo, globo, panel… | [brand/COMPONENTES.md](brand/COMPONENTES.md) |
| Cartas, personajes, señas, anotador, sonido, capturas | [brand/RECURSOS.md](brand/RECURSOS.md) |
| Qué palabras usar y cómo suena | [brand/VOZ.md](brand/VOZ.md) |
| Reglas para la landing y otras páginas | [brand/PAGINAS.md](brand/PAGINAS.md) |
| Qué falta cambiar en el juego para que coincida | [brand/ALINEACION.md](brand/ALINEACION.md) |
| Qué hace el juego (contenido) | [docs/JUEGO.md](docs/JUEGO.md) |
| Plan y secciones de la landing | [docs/landing/](docs/landing/) |

## Las reglas en una pantalla

- **Nombre**: Trukeados. Bajada: "Truco argentino online, en 3D."
- **Logo**: dos naipes cruzados con el ancho de espada (hoja azul, guarda y pomo oro) + TRUKEADOS en
  Archivo Expanded Black. Siempre desde los SVG de `brand/logo/`.
- **Tipografía**: solo Archivo, variable. Ancho 125 % para títulos y cantos, 100 % para leer, 78 % para
  rótulos y botones. Sin itálicas, sin serif, sin monoespaciada (salvo códigos de sala).
- **Color**: negro `#121212` de fondo, tinta `#f5f5f5`, grises. Los cuatro palos como señales:
  espada `#2f6fd6`, basto `#2e9e57`, **oro `#f2c12e` (el único acento, la acción principal)**, copa
  `#d93b30`. Espada y copa como texto, en sus versiones "tinta". Paño `#1a4529` como único campo de
  color de página. Nada de marfil, latón, marrones de interfaz, violeta ni degradés.
- **Forma**: esquinas de 3 px; superficies separadas por tono, no por líneas; sombras solo en lo que
  flota (globo de canto, menú, diálogo).
- **Movimiento**: "arranca rápido y se asienta" (`cubic-bezier(0.16, 1, 0.3, 1)`), 120 / 180 / 420 ms;
  las señas duran 2,2 s; nadie parpadea solo; con movimiento reducido no hay desplazamientos.
- **Voz**: rioplatense, voseo, corto, con picardía, sin prometer lo que el juego no tiene.
- **Imágenes**: capturas reales del juego, cartas y personajes del juego. Nunca fotos de stock.
- **Juego ≠ página**: el juego es una aplicación (rótulos en mayúsculas angostas, bordes de 1 px,
  paneles); las páginas no (oración, escala grande, escalones de tono).

## Cómo se cambia el sistema

1. Se cambia `brand/tokens.css` (y los logos con `brand/tools/build-logos.mjs`).
2. Se actualiza el documento de `brand/` que corresponda.
3. Se copia al juego (`:root` de `public/css/truco.css`, `public/js/theme.js`) y se vuelve a
   sincronizar la landing.
4. Si hay una decisión de fondo (un color nuevo, otra tipografía), un ADR en `docs/decisions/`.
