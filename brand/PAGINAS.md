# Trukeados — páginas derivadas

Reglas para toda página que no es el juego: la landing, una página de reglas, prensa, un 404. El juego es una aplicación;
estas son páginas que se leen y se recorren. Comparten marca ([BRAND.md](BRAND.md)), componentes ([COMPONENTES.md](COMPONENTES.md))
y voz ([VOZ.md](VOZ.md)), y cambian la gramática: más escala, menos interfaz.

Para la landing, las ideas de secciones están en [../docs/landing/](../docs/landing/), y el contrato de la landing
(decisiones y estado) en `docs/CONTRATO.md` de su repo.

## 1. Propósito

Toda página derivada tiene **una sola acción**: llevar al juego. El botón principal (blanco con letra negra, como en el
juego) dice "Jugar ahora" y abre el juego. Lo demás (mirar señas, leer reglas) está para que esa acción se tome con ganas.

**Destinos** (la URL del juego va en una variable de entorno, nunca escrita a mano en el código):

| Acción | Destino |
|---|---|
| Jugar ahora / Partida rápida / Practicar con bots / Abrir una mesa | `${GAME_URL}/` (el menú del juego) |
| Entrar a una sala | `${GAME_URL}/sala/CÓDIGO` |
| Reglas completas | página de reglas o `docs/REGLAS.md` del repositorio |

Hoy el juego no acepta parámetros para entrar directo a partida rápida o práctica, ni para recibir el nombre: todos los
CTA van al menú. Si se quiere saltear el menú, se agrega al juego primero (ver [ALINEACION.md](ALINEACION.md) §4).

## 2. Lienzo

- **Fondo**: `--bg`, con escalones `--surface` y `--surface-2` para separar zonas. Ninguna sección con fondo de color: el
  color lo ponen las imágenes de la mesa, las cartas y los personajes.
- **Márgenes y espacios**: `--gutter` y `--section-gap`, según [BRAND.md](BRAND.md) §5.
- **Grilla**: 12 columnas en escritorio y 4 en celular; la separación entre columnas es `--gutter`. Ancho máximo del
  contenido: 1440 px. Las imágenes pueden ir a sangre.
- **Anchos de prueba**: 1440, 1280 × 720, 768 × 1024, 390 y 375 × 812. Sin desplazamiento horizontal.

## 3. Tipografía en página

Cinco tamaños como máximo por página, de los estilos de [BRAND.md](BRAND.md) §4: el Display (un `h1` por página, en la
primera pantalla), el Título (un `h2` por sección), la Bajada, el Texto y el Rótulo. El Canto, para globos, y el Legal
(13 px), solo para créditos.

- Todo título en **dos líneas como máximo**, en cualquier ancho (unos 32 caracteres a tamaño Display).
- Alineado a la izquierda; centrado solo en un momento de la página.
- Texto corrido en `--text`, de 62 caracteres de ancho máximo. El gris `--text-dim` es para notas.
- Ninguna palabra del título en otro color o estilo para "destacarla". La única excepción es el nombre
  (`TRUKE` 800 + `ADOS` 400), como en el menú.
- Fuente: Hanken Grotesk, con la URL de Google Fonts del juego o autoalojada (por ejemplo
  `@fontsource-variable/hanken-grotesk`). Precargar el archivo latino. No tiene eje de ancho: `font-stretch` no hace nada.

## 4. Lo que no va en una página

Una página que tiene algo de esto está mal hecha:

- Rótulos de relleno en mayúsculas encima de los títulos ("NUEVO", "CÓMO FUNCIONA"). Los rótulos en mayúsculas son para
  datos y etiquetas de verdad.
- Numeración 01 / 02 / 03.
- Grillas dibujadas y cajas con borde por todos lados. El borde de 1 px es de los controles y paneles.
- Vidrio (`backdrop-filter`), barras flotantes tipo píldora y esquinas redondeadas.
- Tarjetas con ícono arriba en filas iguales, o filas de tarjetas idénticas.
- Emojis, íconos decorativos, manchas de color y "tableros" falsos de barras grises.
- Sombras en cosas quietas. Solo flotan: globos, menús, diálogos.

El resto de lo prohibido (colores, degradés, brillos, fotos de stock) está en [BRAND.md](BRAND.md) §3 y §7.

## 5. Imágenes

Orden de preferencia y tratamiento: [BRAND.md](BRAND.md) §7 y [RECURSOS.md](RECURSOS.md).

- Al menos cuatro imágenes reales (capturas, cartas, fotos) por página; lo normal es entre seis y doce.
- Una imagen dominante por pantalla, no seis chicas. Nada encima de un título.
- Formatos: AVIF con WebP de respaldo; `width` y `height` siempre; `loading="lazy"` fuera de la primera pantalla; la imagen
  principal de la primera pantalla con `fetchpriority="high"`.
- Texto alternativo que diga lo que se ve: "Mesa de 2 vs 2 en primera persona: tres cartas en la mano y Coca levantando
  las cejas."

## 6. Movimiento

Curva y duraciones: [BRAND.md](BRAND.md) §8. Solo `transform` y `opacity`.

- Entrada de cada sección: título, después texto, después imagen, con 60 a 90 ms entre cada uno, subiendo de 16 a 32 px.
  Una sola vez. Si el script falla, el contenido se ve igual.
- Las cartas se mueven como en el juego: arrancan rápido y se asientan; giran poco (±12°).
- Una seña dura 2,2 s y vuelve a la cara neutra. Ningún personaje parpadea solo.
- `prefers-reduced-motion: reduce`: sin desplazamientos ni giros, solo cambios de opacidad cortos. Las caras pueden cambiar
  de seña sin animación.
- Nada de secuestrar el scroll. Un bloque fijo (`sticky`) puede sostenerse hasta tres pantallas.

## 7. Accesibilidad

- Contraste: ver [BRAND.md](BRAND.md) §3. El gris `--muted` no llega a AA: solo para créditos y notas no esenciales.
- Foco visible en todo (ver los estados en [COMPONENTES.md](COMPONENTES.md)). Todo se usa con teclado, en el orden de
  lectura. Los canvas interactivos tienen alternativa con botones.
- Un `h1` por página; un `h2` por sección; `lang="es-AR"`.
- Objetivos táctiles de 44 × 44 px como mínimo.
- Sonido apagado por defecto y nunca automático.

## 8. Rendimiento

- LCP por debajo de 2,5 s en 4G; CLS por debajo de 0,1.
- La primera pantalla no depende de Three.js ni de nada pesado. Los canvas de personajes son livianos.
- Fuente: un solo archivo variable (latín) con `font-display: swap`.
- Imágenes de la primera pantalla por debajo de 200 KB en total.
- Si es React: lo que no se ve al entrar se carga después (`lazy`), y nada se dibuja en canvas fuera de pantalla
  (`IntersectionObserver`).

## 9. Compartir y buscadores

- `<title>`: "Trukeados · Truco argentino online, en 3D" (portada) o "[Página] · Trukeados".
- Descripción: "Truco argentino online en 3D, gratis y sin cuenta. Las señas se hacen con la cara: si te miran, te las
  cazan. 1 vs 1, 2 vs 2 y 3 vs 3."
- Imagen para compartir de 1200 × 630: fondo `--bg`, el nombre en blanco, una captura o una cara haciendo una seña. Sin
  texto chico. La del juego es `public/img/og.png`.
- Favicon: `public/favicon.svg` (blanco y negro), y PNG de 180 px para Apple (`img/icon-180.png`). Su estado, en
  [ALINEACION.md](ALINEACION.md) §1.
- `theme-color`: `#0a0a0a`.

## 10. Lista para cerrar cualquier página

- [ ] Un `h1` en la primera pantalla que dice qué es; un título en cada sección.
- [ ] Una sola acción principal (blanca) por pantalla, que lleva al juego.
- [ ] Solo tokens de `tokens.css`; ningún color ni tamaño suelto.
- [ ] Hanken Grotesk cargando de verdad (títulos en 800, no en la fuente del sistema).
- [ ] Nada de §4, ni los colores o las fotos de stock de [BRAND.md](BRAND.md) §3 y §7.
- [ ] Al menos cuatro imágenes reales; crédito de las cartas en el pie ([RECURSOS.md](RECURSOS.md) §1).
- [ ] Textos en voseo, cortos y sin promesas falsas ([VOZ.md](VOZ.md)).
- [ ] Revisado en 1440, 768 y 390; sin desplazamiento horizontal.
- [ ] Teclado, foco, contraste y movimiento reducido revisados.
- [ ] Auditoría `impeccable` pasada; si es React, también `vercel-react-best-practices`.
