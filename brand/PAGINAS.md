# Trukeados — páginas derivadas

Reglas para toda página que no es el juego: la landing, una página de reglas, prensa, un 404. El juego
es una aplicación; estas son páginas que se leen y se recorren. Comparten marca (tokens, logo, tipografía,
voz) y cambian la gramática: más escala, menos interfaz. Desde noviembre 2026 la marca es **blanco y negro,
grotesk** (Hanken Grotesk, negro, blanco y grises, esquinas rectas): las páginas también.

Se apoya en [BRAND.md](BRAND.md), [COMPONENTES.md](COMPONENTES.md), [RECURSOS.md](RECURSOS.md) y
[VOZ.md](VOZ.md). Para la landing, el contenido y las secciones posibles están en
[../docs/landing/](../docs/landing/).

## 1. Propósito

Toda página derivada tiene **una sola acción**: llevar al juego. El botón principal (blanco con letra negra,
como en el juego) dice "Jugar ahora" y abre el juego. Lo demás (mirar señas, leer reglas) está para que esa acción se tome con ganas.

**Destinos** (la URL del juego va en una variable de entorno, nunca escrita a mano en el código):

| Acción | Destino |
|---|---|
| Jugar ahora / Partida rápida / Practicar con bots / Abrir una mesa | `${GAME_URL}/` (el menú del juego) |
| Entrar a una sala | `${GAME_URL}/sala/CÓDIGO` |
| Reglas completas | página de reglas o `docs/REGLAS.md` del repositorio |

Hoy el juego no acepta parámetros para entrar directo a partida rápida o práctica ni para recibir el
nombre: todos los CTA van al menú. Si se quiere saltear el menú, se agrega al juego primero
(ver [ALINEACION.md](ALINEACION.md)).

## 2. Lienzo

- **Fondo**: `--bg` en toda la página. Escalones `--surface` / `--surface-2` para separar zonas.
- **Sin campos de color**: ninguna sección con fondo de color. El color de la página lo ponen las imágenes
  de la mesa, las cartas y los personajes. (Antes se permitía una sección en `--pano-3`; ya no.)
- **Margen exterior**: `--gutter` (16 → 32 px), igual a izquierda y derecha en todos los anchos.
- **Grilla**: 12 columnas en escritorio, 4 en celular; separación entre columnas igual a `--gutter`.
  Ancho máximo del contenido: 1440 px; las imágenes pueden ir a sangre.
- **Ritmo**: entre secciones `--section-gap` (96 → 208 px); dentro de una sección, siempre menos
  (hasta `--space-8`, 64 px).
- **Anchos de prueba**: 1440, 1280 × 720, 768 × 1024, 390 y 375 × 812. Sin desplazamiento horizontal.

## 3. Tipografía en página

Una sola familia, **Hanken Grotesk** (400–800). Cinco tamaños como máximo por página, tomados de la escala de
[tokens.css](tokens.css):

| Uso | Estilo | Token |
|---|---|---|
| Título principal (un `h1` por página, en la primera pantalla) | Display: 800, mayúsculas, tracking −0,04 em | `--fs-display` |
| Título de sección (`h2`, uno por sección) | Título: 800, mayúsculas, tracking −0,035 em | `--fs-title` |
| Bajada, preguntas, frases destacadas | Bajada: 400, oración | `--fs-lead` |
| Párrafos | Texto: 400, oración | `--fs-body` |
| Rótulos, datos, enlaces de barra, botones | Rótulo: 600–700, mayúsculas, tracking `--track` 0,08 em | `--fs-small` |

Más el estilo Canto para globos (700, sin mayúsculas forzadas) y el Legal (13 px) solo para créditos.

- Todo título en **dos líneas como máximo** en cualquier ancho (unos 32 caracteres a tamaño Display).
- Alineado a la izquierda; centrado solo en un momento de la página.
- Texto corrido en `--text` (tinta llena), 18 px, 62 caracteres de ancho máximo. El gris
  (`--text-dim`) es para notas.
- Ninguna palabra del título en otro color o estilo para "destacarla". La única excepción es el nombre
  (`TRUKE` 800 + `ADOS` 400), como en el menú del juego.
- **Fuente**: Hanken Grotesk variable, eje de peso 400–800. La misma URL de Google Fonts que el juego
  (`family=Hanken+Grotesk:wght@400..800&display=swap`), o autoalojada (por ejemplo
  `@fontsource-variable/hanken-grotesk`). Precargar el archivo latino. No tiene eje de ancho: `font-stretch`
  no hace nada (los tokens `--wide`, `--narrow`… quedan en 100 % solo por compatibilidad).

## 4. Lo que no va en una página de Trukeados

Viene de la marca y de las reglas de diseño del hub. Una página que tiene algo de esto está mal hecha:

- Colores en la interfaz: oro, amarillo, azul, verde, ni botones ni textos ni fondos de color. El rojo solo
  para un error real o para mostrar la trampa.
- Rótulos de relleno en mayúsculas encima de los títulos ("NUEVO", "CÓMO FUNCIONA") que no dicen nada. Los
  rótulos en mayúsculas son para datos y etiquetas de verdad.
- Numeración 01 / 02 / 03.
- Grillas dibujadas y cajas con borde por todos lados (el borde de 1 px es de los controles y paneles).
- Degradés (fondos, botones, textos) y brillos. La única excepción es una sombra neutra debajo de un
  texto sobre foto.
- Sombras en cosas quietas. Solo flotan: globos de canto, menús, diálogos, una carta en el aire.
- Vidrio (`backdrop-filter`), barras flotantes tipo píldora, botones píldora, esquinas redondeadas.
- Tarjetas con ícono arriba en filas iguales; filas de tarjetas idénticas.
- Emojis, íconos decorativos, manchas de color, "tableros" falsos de barras grises.
- Monoespaciada (salvo un código de sala real).
- Marfil, crema, latón, dorado metálico, marrones en la interfaz, violeta, neón.
- Fotos de stock de gente.

## 5. Imágenes

En este orden (ver [BRAND.md](BRAND.md) §7 y [RECURSOS.md](RECURSOS.md)):
1. **Capturas reales del juego**: la mesa, las caras, la carta quemada, el globo de canto, el celular.
2. **Recursos del juego**: cartas WebP, caras dibujadas con `characters.js`, anotador.
3. **Fotos reales del mundo del truco** (bar, club, paño), con licencia libre y crédito en el pie.

- Al menos cuatro imágenes reales (capturas, cartas, fotos) por página; lo normal es entre seis y doce.
- Las imágenes van a color (la mesa y los ambientes son a color); la página alrededor, en blanco y negro.
- Esquinas rectas en capturas y fotos; esquina de naipe en las cartas.
- Una imagen dominante por pantalla, no seis chicas.
- Nada encima de un título.
- Formatos: AVIF con WebP de respaldo; `width` y `height` siempre; `loading="lazy"` fuera de la primera
  pantalla; la imagen principal de la primera pantalla con `fetchpriority="high"`.
- Texto alternativo que diga lo que se ve: "Mesa de 2 vs 2 en primera persona: tres cartas en la mano y
  Coca levantando las cejas."

## 6. Movimiento

- Curva `--ease-out`; duraciones `--dur-press` 120 ms, `--dur-quick` 180 ms, `--dur-move` 420 ms.
- Solo `transform` y `opacity`.
- Entrada de cada sección: título, después texto, después imagen, con 60–90 ms entre cada uno,
  subiendo 16–32 px. Una sola vez. El contenido nunca queda oculto si el script falla.
- Las cartas se mueven como en el juego: arrancan rápido y se asientan; giran poco (±12°).
- Una seña dura 2,2 s y vuelve a la cara neutra. Ningún personaje parpadea solo.
- `prefers-reduced-motion: reduce`: sin desplazamientos ni giros, solo cambios de opacidad cortos; las
  caras pueden cambiar de seña sin animación.
- Nada de secuestrar el scroll. Un bloque fijo (`sticky`) puede sostenerse hasta tres pantallas.

## 7. Accesibilidad

- Contraste AA: tinta y grises según la tabla de [BRAND.md](BRAND.md) §3. `--muted` (4,3:1) no llega a AA:
  solo para créditos y notas no esenciales; lo que hay que leer va en `--text` o `--text-dim`.
- Foco visible en todo: `outline: 2px solid var(--focus); outline-offset: 2px` (blanco). Sobre un botón
  blanco el contorno se separa 2 px, así que se ve igual.
- Todo se usa con teclado en el orden de lectura; los canvas interactivos tienen alternativa con botones.
- Un `h1` por página; un `h2` por sección; `lang="es-AR"`.
- Objetivos táctiles de 44 × 44 px como mínimo.
- Sonido apagado por defecto y nunca automático.

## 8. Rendimiento

- LCP por debajo de 2,5 s en 4G; CLS por debajo de 0,1.
- La primera pantalla no depende de Three.js ni de nada pesado. Los canvas de personajes son livianos.
- Fuente: un solo archivo variable (latín) con `font-display: swap`.
- Imágenes de la primera pantalla por debajo de 200 KB en total.
- Si es React: lo que no se ve al entrar se carga después (`lazy`), y nada se dibuja en canvas fuera de
  pantalla (`IntersectionObserver`).

## 9. Compartir y buscadores

- `<title>`: "Trukeados · Truco argentino online, en 3D" (portada) o "[Página] · Trukeados".
- Descripción: "Truco argentino online en 3D, gratis y sin cuenta. Las señas se hacen con la cara: si
  te miran, te las cazan. 1 vs 1, 2 vs 2 y 3 vs 3."
- Imagen para compartir 1200 × 630: fondo `--bg`, el nombre en blanco, una captura o una cara haciendo una
  seña. Sin texto chico. La del juego es `public/img/og.png`.
- Favicon: el del juego, `public/favicon.svg` (blanco y negro), y PNG de 180 px para Apple (`img/icon-180.png`).
- `theme-color`: `#0a0a0a` (el juego todavía dice `#121212` en `index.html`).

## 10. Lista para cerrar cualquier página

- [ ] Un `h1` en la primera pantalla que dice qué es; un título en cada sección.
- [ ] Una sola acción principal (blanca) por pantalla, que lleva al juego.
- [ ] Solo tokens de `tokens.css`; ningún color ni tamaño suelto.
- [ ] Hanken Grotesk cargando de verdad (títulos en 800, no en la fuente del sistema).
- [ ] Interfaz sin colores: negro, blanco, grises y, si hace falta, el rojo de error.
- [ ] Nada de la lista del §4.
- [ ] Al menos cuatro imágenes reales; crédito de las cartas en el pie.
- [ ] Textos en voseo, cortos y sin promesas falsas ([VOZ.md](VOZ.md)).
- [ ] Revisado en 1440, 768 y 390; sin desplazamiento horizontal.
- [ ] Teclado, foco, contraste y movimiento reducido revisados.
- [ ] Auditoría `impeccable` pasada; si es React, también `vercel-react-best-practices`.
