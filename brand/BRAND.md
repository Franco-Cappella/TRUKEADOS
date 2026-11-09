# Trukeados — marca

Guía de identidad para el juego y para todo lo que salga de él (landing, reglas, prensa, redes).
Todo sale de lo que el juego ya usa: Archivo, los grises de la interfaz, los cuatro palos de la baraja y
el bar de la escena 3D. Esto lo ordena, completa lo que faltaba (logo, escala, estilos de texto, usos) y
lo vuelve una regla.

| Archivo | Qué es |
|---|---|
| [tokens.css](tokens.css) | Colores, tipografía, espacios, formas y movimiento como variables CSS. **Fuente de verdad.** |
| [logo/](logo/) | Logos en SVG con letras convertidas a contornos (no dependen de la fuente instalada). |
| [tools/build-logos.mjs](tools/build-logos.mjs) | Genera los logos desde Archivo Expanded Black (ver al final). |
| [lamina.html](lamina.html) | La marca en una página: logos, paleta, estilos de texto y componentes. Abrir en el navegador. |
| [COMPONENTES.md](COMPONENTES.md) | Cada componente del juego con sus valores exactos, y cómo se traduce a páginas. |
| [RECURSOS.md](RECURSOS.md) | Cartas, personajes, señas, anotador, sonido y escena: cómo usarlos fuera del juego. |
| [VOZ.md](VOZ.md) | Cómo habla Trukeados: vocabulario del juego, cantos, frases y textos reales. |
| [PAGINAS.md](PAGINAS.md) | Reglas para páginas derivadas (landing, reglas, prensa): grilla, escala, secciones, imágenes, movimiento, accesibilidad. |
| [ALINEACION.md](ALINEACION.md) | Diferencias que hoy hay entre el juego y la marca, y qué cambiar en cada archivo. |

Índice general del sistema de diseño: [DESIGN.md](../DESIGN.md) en la raíz del repositorio.

En el juego, `public/css/truco.css` (`:root`) y `public/js/theme.js` tienen que coincidir con
`tokens.css`. Los nombres del juego (`--bg`, `--surface`, `--text`, `--accent`, `--blue`…) se mantienen.

---

## 1. La idea

**Truco de verdad, en la mesa de un bar, donde te están mirando.**

- **Qué es**: truco argentino online en 3D, gratis y sin cuenta, con señas que se hacen con la cara.
- **Para quién**: gente que juega o jugó al truco en familia, con amigos o en el club, y quiere seguir
  jugando a distancia.
- **Personalidad**: canchera, de barrio, con picardía, sin chabacanería. Tradicional en las reglas,
  moderna en cómo se ve.
- **Lo que se evita**: el folclore de souvenir (mate y gaucho por todos lados), el casino (dorados,
  brillos, fichas), el "app de juegos" genérico (degradés, íconos de colores, mascotas).

### El nombre

**Trukeados.** Juega con *truco* y con *truqueado* (arreglado, con trampa): el juego tiene señas y deja
hacer trampa, y te pueden cazar.

- En texto: siempre **Trukeados**, con mayúscula inicial. Nunca "TrukeadoS", "Truqueados", "Truk3ados"
  ni "Trukeados 3D".
- En mayúsculas (TRUKEADOS) solo dentro del logo.
- Bajada que acompaña al nombre cuando hace falta explicar qué es: **"Truco argentino online, en 3D."**
- "Truco 3D" era el nombre de trabajo: ya no se usa en ninguna pieza nueva (ver [ALINEACION.md](ALINEACION.md)
  para los lugares del juego que todavía lo dicen).

## 2. Logo

### La marca: el ancho de espada en la mano
Dos naipes cruzados. El de adelante lleva el **ancho de espada** reducido: hoja azul espada, guarda y
pomo oro. Es la mejor carta del truco ("el macho") y los dos naipes encimados son la mano, y también la
trampa del juego (tirar dos encimadas). Viene del favicon original (dos naipes, una espada azul y un
punto oro), redibujado con la paleta y con una espada que se lee como espada.

La **palabra** es TRUKEADOS en **Archivo Expanded Black**, mayúsculas, tracking −0,01 em, convertida a
contornos. Una sola tinta: el color lo pone la marca.

### Versiones

| Archivo | Uso |
|---|---|
| `logo-horizontal.svg` | **Principal.** Fondo oscuro. Barra de navegación, pie, encabezados. |
| `logo-horizontal-claro.svg` | Fondo claro (naipes en tinta, espada en color). |
| `logo-apilado.svg` / `-claro` | Espacios cuadrados: portada, carga, posteos. |
| `logo-horizontal-mono-blanco.svg` / `-negro` | Una sola tinta: sellos, impresos, fondos de foto. La espada queda calada. |
| `marca.svg` / `-claro` / `-mono-blanco` / `-mono-negro` | Solo el símbolo: avatar, botón, marca de agua. |
| `palabra.svg` / `palabra-negro.svg` | Solo la palabra, cuando la marca ya está cerca. |
| `icono-app.svg` | Ícono de app y favicon: marca en color sobre `--bg`, esquinas al 22 %. |
| `logo-data.json` | Trazado de la palabra y caja de la marca, para dibujarlo en componentes. |

### Reglas
- **Aire alrededor**: como mínimo, la altura de la "T" de TRUCO en los cuatro lados.
- **Tamaño mínimo**: horizontal 120 px de ancho; marca sola 20 px; por debajo de 32 px usar `icono-app.svg`.
- **Fondos**: `--bg`, `--surface`, `--pano-3` o fotos oscuras → versión de color o mono blanco.
  `--text` (claro) → versión clara o mono negro. Sobre oro, espada o copa → solo mono negro (oro) o
  mono blanco (espada, copa).
- **No**: cambiar los colores de la espada, rotar o deformar, poner la palabra en otra fuente o en
  itálica, agregar sombras, brillos, contornos o degradés, separar la marca de la palabra en otra
  proporción, usar el logo dentro de una frase.

## 3. Color

### Neutros: la mesa de noche
| Token | Hex | Rol |
|---|---|---|
| `--bg` | `#121212` | Fondo de todo. |
| `--surface` | `#1c1c1c` | Un escalón arriba (paneles, secciones alternas). |
| `--surface-2` | `#262626` | Dos escalones (tarjetas sobre panel, campos). |
| `--surface-3` | `#303030` | Hover. |
| `--text` | `#f5f5f5` | Tinta principal. También el "papel" cuando el fondo es claro. |
| `--text-dim` | `#b3b3b3` | Texto secundario. |
| `--muted` | `#808080` | Notas y créditos. No usar sobre `--surface-2`. |

### Los cuatro palos
| Palo | Relleno | Como texto sobre oscuro | Para qué |
|---|---|---|---|
| Espada | `--espada` `#2f6fd6` | `--espada-tinta` `#5b93e8` | Equipo 1 ("nosotros"), información, la marca. |
| Basto | `--basto` `#2e9e57` | `--basto-tinta` `#4fbf7a` | Bien: ganaste, querido, mostró. |
| **Oro** | `--oro` `#f2c12e` | `--oro-tinta` `#f2c12e` | **El acento.** Acción principal, foco, "te toca". |
| Copa | `--copa` `#d93b30` | `--copa-tinta` `#ef6a5c` | Equipo 2 ("ellos"), trampa, error, peligro. |

Espada y copa como relleno no llegan a 4,5:1 contra el fondo: **nunca como color de texto chico**;
para texto, las versiones "tinta". Sobre oro se escribe siempre en `--accent-ink` (`#121212`, 11:1).
Blanco sobre espada o copa solo en texto de 18 px o más en negrita (4,4:1 y 4,2:1).

### Ambiente del bar
| Token | Hex | Rol |
|---|---|---|
| `--pano` / `--pano-2` / `--pano-3` | `#27523e` / `#204534` / `#1a4529` | El paño. `--pano-3` es el único campo de color permitido para una sección entera de página (blanco 10:1, oro 6,5:1). |
| `--lampara` | `#ffd9a0` | Luz cálida. Solo en imágenes y en la escena 3D. |
| `--bar` / `--madera` / `--pared` | `#1a120c` / `#5b3418` / `#6b3b2a` | Escena 3D e imágenes. **Nunca en interfaz** (ni botones, ni textos, ni fondos de panel). |

### Proporciones
Más o menos así en cualquier pantalla: **70 % negro** (`--bg`/`--surface`), **20 % tinta y grises**,
**hasta 8 % paño o imagen del bar**, **menos de 3 % oro**. Los otros palos aparecen como señales (un
equipo, un resultado, la espada del logo), nunca como decoración ni todos juntos en fila.

**Prohibido**: marfil, crema, latón, dorado metálico, marrones en la interfaz, violeta, degradés,
brillos, neón.

## 4. Tipografía

**Una sola familia: Archivo** (Omnibus-Type, Buenos Aires; Google Fonts, licencia OFL), variable en
peso (100–900) y ancho (62–125 %). La familia hace todo el trabajo cambiando de ancho: expandida para
gritar, normal para leer, angosta para rotular. Sin itálicas. Sin serif. Sin monoespaciada (salvo el
código de sala dentro del juego, que es un código de verdad).

```css
font-family: var(--font);
font-stretch: var(--wide); /* 125 % | 112 % | 100 % | 78 % | 62 % */
font-weight: 850;
```

### Estilos de texto

| Estilo | Ancho | Peso | Tamaño | Interlineado / tracking | Uso |
|---|---|---|---|---|---|
| **Display** | 125 % | 850 | `--fs-display` (52–152 px) | 0,9 / −0,035 em | Título principal de página. Una vez por página. Oración, no mayúsculas. |
| **Título** | 112 % | 800 | `--fs-title` (36–72 px) | 1 / −0,02 em | Título de cada sección. Máximo dos líneas. |
| **Canto** | 125 % | 900 | `--fs-canto` (28–48 px) | 1 / 0 | Lo que se canta: **¡TRUCO!**, **¡QUIERO!**, **¡ENVIDO!** En mayúsculas, con signos de apertura. Globos, momentos de voz. |
| **Bajada** | 100 % | 400 | `--fs-lead` (20–26 px) | 1,4 / 0 | La frase debajo del título. |
| **Texto** | 100 % | 400 (600 para resaltar) | `--fs-body` (18 px) | 1,55 / 0 | Párrafos. Máx. 62 caracteres por línea. Tinta llena, no gris. |
| **Rótulo** | 78 % | 650 | `--fs-small` (15 px) | 1,3 / 0,02 em | Datos y etiquetas en páginas, en oración (no mayúsculas espaciadas). |
| **Botón** | 78 % | 650 | 17–19 px | 1 / 0,04 em | Acciones. Mayúsculas solo dentro del juego. |
| **Cifra** | 62–100 % | 800 | según contexto | `font-variant-numeric: tabular-nums` | Tanteador, tantos, puntos. |
| **Legal** | 100 % | 400 | `--fs-micro` (13 px) | 1,45 | Créditos de cartas y licencias. |

Dentro del juego, que es una aplicación, los rótulos de panel pueden seguir en mayúsculas angostas
(≥ 11 px, tracking 0,1 em). En páginas no.

## 5. Forma y espacio

- **Esquinas**: `--radius` 3 px en botones, campos y paneles (casi rectas, como el juego). Las cartas
  tienen su esquina de naipe (`--radius-naipe`). No hay botones píldora.
- **Espacio**: base 8 (`--space-1` … `--space-10`). Margen de página `--gutter` (16–32 px).
  Entre secciones de página `--section-gap` (96–208 px).
- **Superficies**: se separan por un escalón de tono (`--bg` → `--surface` → `--surface-2`), no con
  líneas ni sombras. Sombra solo en lo que flota de verdad (globo de canto, menú, diálogo).

## 6. Componentes base

- **Botón principal (página)**: fondo `--oro`, texto `--accent-ink`, 650 angosto, 3 px. Uno por pantalla.
  En el juego, por ahora, sigue blanco; el cambio a oro está documentado en [ALINEACION.md](ALINEACION.md) §4.
- **Botón secundario**: fondo `--surface-2`, texto `--text`; hover `--surface-3`.
- **Botón de canto** (juego): texto Canto, subrayado interior oro de 2 px (`box-shadow: inset 0 -2px 0 var(--accent)`).
- **Peligro / trampa**: borde y texto copa ("¡Mostrá las dos!").
- **Globo de canto**: fondo `--text`, texto `--text-on-light`, estilo Canto, esquina 2 px, sombra.
- **Foco**: contorno 2 px `--focus` (oro) con 2 px de separación, siempre visible.
- **Anotador**: palitos en `--text` sobre `--surface`, cuatro y el quinto cruzado (es parte de la
  identidad: usarlo para cualquier puntaje).

## 7. Imágenes

En orden de preferencia:
1. **El juego mismo**: capturas de la mesa en primera persona, cartas en el paño, caras haciendo señas.
2. **Los recursos del juego**: las 40 cartas "Naipes Libres", los personajes dibujados en canvas
   (`characters.js`), la carta quemada, el anotador.
3. **El mundo del truco**: bares, clubes, mesas de fórmica, paño, sifones, luz de lámpara, en fotos
   reales con crédito.

Tratamiento: oscuro, cálido en la luz (lámpara) y neutro en las sombras; esquinas rectas; recortes
generosos. Nunca fotos de stock de gente sonriendo con celulares, ni dorados de casino.

Las cartas llevan siempre el crédito: *Naipes Libres de Basquetteur (Wikimedia Commons), CC BY-SA 3.0,
vectorizadas por gjenkins20.*

## 8. Movimiento

"Arranca rápido y se asienta", igual que las cartas del juego: `--ease-out`
(`cubic-bezier(0.16, 1, 0.3, 1)`). Botones 120 ms, globos y hover 180 ms, cartas y entradas 420 ms.
Una seña dura 2,2 s. Solo transform y opacidad. Con `prefers-reduced-motion`, sin desplazamientos.

## 9. Voz

Español rioplatense, de mesa: "jugá", "sentate", "cantá", "vos". Frases cortas, con picardía.

| Sí | No |
|---|---|
| "Sentate, que se reparte." | "¡Únete a la experiencia de truco definitiva!" |
| "Si te cazan la seña, te la cazaron." | "Comunicate con tu compañero mediante gestos." |
| "Sin cuenta. Sin instalar." | "Registrate gratis en segundos." |
| "¡Mostrá las dos!" | "Denunciar jugada sospechosa" |

Los cantos van en mayúsculas con signos de apertura: **¡TRUCO!**, **¡QUIERO RETRUCO!**, **¡ENVIDO!**
Nunca se promete lo que el juego no tiene (ranking, cuentas). La flor y la muestra existen como opciones de
la sala: se nombran como opciones, no como lo que pasa siempre.

## 10. Regenerar los logos

```bash
mkdir /tmp/logos && cd /tmp/logos && npm init -y && npm i opentype.js@1.3.4
curl -LO https://raw.githubusercontent.com/Omnibus-Type/Archivo/master/fonts/ttf/ArchivoExpanded-Black.ttf
node <repo>/brand/tools/build-logos.mjs . <repo>/brand/logo
```
La geometría de la marca (`CARD`, `BACK`, `FRONT`, `swordLocal`) está al principio del script.
