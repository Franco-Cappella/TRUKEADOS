# Trukeados — marca

Guía de identidad para el juego y para todo lo que salga de él (landing, reglas, prensa, redes).
Todo sale de lo que el juego ya usa. Qué cubre cada archivo del sistema: [DESIGN.md](../DESIGN.md). Qué falta cambiar: [ALINEACION.md](ALINEACION.md).

---

## 1. La idea

**Truco de verdad, en la mesa de un bar, donde te están mirando.**

- **Qué es**: truco argentino online en 3D, gratis y sin cuenta, con señas que se hacen con la cara.
- **Para quién**: gente que juega o jugó al truco en familia, con amigos o en el club, y quiere seguir jugando a distancia.
- **Personalidad**: canchera, de barrio, con picardía, sin chabacanería. Tradicional en las reglas, moderna en cómo se ve: blanco y negro, letra grotesk, nada de adornos en la interfaz.
- **Lo que se evita**: el folclore de souvenir (mate y gaucho por todos lados), el casino (dorados, brillos, fichas), el "app de juegos" genérico (degradés, íconos de colores, mascotas).

### El nombre

**Trukeados.** Juega con *truco* y con *truqueado* (arreglado, con trampa): el juego tiene señas y deja hacer trampa, y te pueden cazar.

- En texto: siempre **Trukeados**, con mayúscula inicial. Nunca "TrukeadoS", "Truqueados", "Truk3ados" ni "Trukeados 3D".
- En mayúsculas (TRUKEADOS) solo dentro del logo.
- Bajada que acompaña al nombre cuando hace falta explicar qué es: **"Truco argentino online, en 3D."**
- "Truco 3D" era el nombre de trabajo: ya no se usa en ninguna pieza nueva (ver [ALINEACION.md](ALINEACION.md) para los lugares del juego que todavía lo dicen).

## 2. Logo

### La marca

Dos naipes cruzados: la mano, y también la trampa del juego (tirar dos encimadas). El de adelante lleva el **ancho de espada** ("el macho"), reducido a una raya. En blanco y negro: un naipe lleno y uno calado, nunca con color.

Hoy no hay logo nuevo. Para piezas nuevas se usan las versiones de una tinta de la tabla, o el nombre escrito en Hanken Grotesk (`TRUKE` 800 + `ADOS` 400, como en el menú). Qué falta rehacer, y cómo se regeneran los SVG actuales: [ALINEACION.md](ALINEACION.md) §1.

### Versiones (archivos actuales)

| Archivo | Uso hoy |
|---|---|
| `public/favicon.svg` | Favicon y referencia de la marca blanco y negro. |
| `logo-horizontal-mono-blanco.svg` / `-negro` | **Las únicas que se usan mientras no haya logo nuevo.** Una sola tinta. |
| `marca-mono-blanco.svg` / `-mono-negro` | Solo el símbolo, una tinta. |
| `logo-horizontal.svg`, `logo-apilado.svg`, `marca.svg`, `icono-app.svg` y sus `-claro` | Versiones en color de antes. No usar en piezas nuevas. |
| `palabra.svg` / `palabra-negro.svg` | La palabra en Archivo. No usar en piezas nuevas (escribir el nombre en Hanken Grotesk). |
| `logo-data.json` | Trazado de la palabra y caja de la marca (versión anterior). |

### Reglas

- **Aire alrededor**: como mínimo, la altura de la "T" en los cuatro lados.
- **Tamaño mínimo**: horizontal 120 px de ancho; marca sola 20 px; por debajo de 32 px, el favicon.
- **Fondos**: oscuro (`--bg`, `--surface`, fotos oscuras) → blanco; claro (`--text`) → negro. Nunca sobre color.
- **No**: ponerle color, rotar o deformar, poner la palabra en otra fuente o en itálica, agregar sombras, brillos, contornos o degradés, usar el logo dentro de una frase.

## 3. Color

**Negro, blanco y grises.** La interfaz no tiene colores: el acento es el blanco y el rojo queda solo para lo que sale mal. El color de la pantalla lo ponen las cartas, los personajes y la mesa.

### Neutros

| Token | Hex | Rol |
|---|---|---|
| `--bg` | `#0a0a0a` | Fondo de todo. |
| `--surface` | `#141414` | Un escalón arriba (paneles, tarjetas, diálogos). |
| `--surface-2` | `#1f1f1f` | Dos escalones (campos, asientos, caras de las señas). |
| `--surface-3` | `#2a2a2a` | Hover en páginas (en el juego: `--panel-hover` `rgba(34,34,34,.96)`). |
| `--text` | `#f4f4f4` | Tinta principal (18:1). También el "papel" cuando el fondo es claro. |
| `--text-dim` | `#a8a8a8` | Texto secundario (8,3:1). |
| `--muted` | `#757575` | Notas y créditos no esenciales (4,3:1: no llega a AA; nunca sobre `--surface-2`). |
| `--line` / `--line-2` | `rgba(255,255,255,.1)` / `.22` | Bordes de 1 px de la interfaz. |

En el juego también: `--panel` `rgba(10,10,10,.92)` (paneles sobre la escena), `--panel-soft` `.74`, `--hover-tint` `rgba(255,255,255,.07)`, `--shade` `rgba(0,0,0,.74)` (detrás de diálogos), `--face-bg` `#1f1f1f`.

### Usos

| Token | Valor | Para qué |
|---|---|---|
| `--accent` | `#ffffff` | **El acento.** Botón principal, foco, "te toca", raya de los cantos, "te mira". |
| `--accent-ink` | `#0a0a0a` | Texto sobre el acento (20:1). |
| `--team0` | `#ffffff` | Equipo "nosotros": borde de placa, nombres en el chat, marcador. |
| `--team1` | `#8c8c8c` | Equipo "ellos" (5,9:1). |
| `--good-*` | blanco, fondo `rgba(255,255,255,.12)` | Bien: ganaste, querido, mostró. Se marca en blanco, no en verde. |
| `--red` | `#ff5a4f` | **Único color de interfaz.** Errores, trampa, peligro, "¡Mostrá las dos!" (6,4:1). |
| `--bad-ink` / `--bad-bg` | `#ffb0aa` / `rgba(255,90,79,.16)` | Texto y fondo de lo que salió mal. |
| `--offline` | `#ff8a80` | "Desconectado" en la placa de nombre. |

Los palos (`--blue`, `--green`, `--yellow` en `truco.css`) quedaron en grises y blanco: ya no son colores de interfaz. En `tokens.css` siguen `--oro`, `--espada`, `--basto`, `--copa` y sus "tinta" como **alias heredados** (apuntan al blanco, a los grises y al rojo) para no romper la landing; no se usan en nada nuevo.

### La mesa y los ambientes

La escena 3D va a todo color: paño, madera, los nueve ambientes y las cartas. Sus colores y los nombres de cada ambiente están en [RECURSOS.md](RECURSOS.md) §7. Nada de eso pasa a la interfaz: ni botones, ni textos, ni fondos de panel.

### Proporciones

En la interfaz: **todo negro y grises, con blanco para lo importante**. El blanco lleno (botón principal, globo, placa con el turno) aparece pocas veces por pantalla; el rojo, solo cuando algo salió mal.

**Prohibido en la interfaz**: oro o amarillo, azul, verde, marfil, crema, latón, dorado metálico, marrones, violeta, degradés de color, brillos, neón.

## 4. Tipografía

**Una sola familia: Hanken Grotesk** (Hanken Design Co.; Google Fonts, licencia OFL), variable de 400 a 800. Grotesk de palo seco, sin ejes de ancho: el trabajo lo hacen el peso, el tamaño, las mayúsculas y el tracking. Sin itálicas. Sin serif. Sin monoespaciada (salvo el código de sala, que es un código de verdad).

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400..800&display=swap">
```
```css
font-family: var(--font); /* 'Hanken Grotesk', system-ui, … */
```

### Estilos de texto

| Estilo | Peso | Tamaño | Interlineado / tracking | Caja | Uso |
|---|---|---|---|---|---|
| **Display** | 800 | `--fs-display` (52–152 px); en el menú `clamp(40px, 6.4vw, 64px)` | 0,92–0,95 / −0,035 a −0,04 em | **Mayúsculas** | Título principal. Una vez por pantalla. |
| **Título** | 800 | `--fs-title` (36–72 px); en el juego 28–46 px | 0,95–1 / −0,035 a −0,04 em | **Mayúsculas** | Título de sección o de panel grande (tienda, taquilla). |
| **Rótulo** | 600–700 | 10–15 px | 1,2–1,3 / 0,06–0,12 em (`--track` 0,08 em) | **Mayúsculas** | Encabezados de tarjeta, etiquetas, chips, datos, enlaces de barra. |
| **Botón** | 650 | `--btn-font` 15 px (14–19 px) | 1,1 / `--track` 0,08 em | **Mayúsculas** | Acciones. |
| **Canto** | 700 | `--btn-call-font` 20 px; globo 19–23 px; en página `--fs-canto` | 1 / 0 | Como se dice: **¡Truco!**, **¡Quiero retruco!** | Botones de canto y globos del juego: sin mayúsculas. En páginas, el estilo Canto puede ir en mayúsculas (ver [VOZ.md](VOZ.md)). |
| **Bajada** | 400 | `--fs-lead` (20–26 px); en el juego 16 px `--text-dim` | 1,4 / 0 | Oración | La frase debajo del título. |
| **Texto** | 400 (600 para resaltar) | `--fs-body` 18 px (en el juego 14–16 px) | 1,55 / 0 | Oración | Párrafos. Máx. 62 caracteres por línea. |
| **Cifra** | 700–800 | según contexto | `font-variant-numeric: tabular-nums` | — | Tanteador, tantos, puntos, ELO, monedas. |
| **Legal** | 400 | `--fs-micro` 13 px | 1,45 | Oración | Créditos de cartas y licencias. |

El contraste es de **mayúsculas grandes y apretadas** (títulos) contra **mayúsculas chicas con aire** (rótulos), con el texto corrido en oración en el medio. El nombre se escribe `TRUKE` 800 + `ADOS` 400 en el encabezado.

## 5. Forma y espacio

- **Esquinas**: **rectas**, `--radius` 2 px en botones, campos, paneles, globos y toasts. Las cartas tienen su esquina de naipe (`--radius-naipe`). No hay botones píldora ni esquinas redondeadas.
- **Bordes**: 1 px `--line` o `--line-2`. Es la forma de separar en el juego; las páginas pueden separar por escalón de tono (`--bg` → `--surface` → `--surface-2`).
- **Espacio**: base 8 (`--space-1` … `--space-10`). Margen de página `--gutter` (16–32 px). Entre secciones de página `--section-gap` (96–208 px).
- **Sombras**: solo en lo que flota de verdad (globo de canto, menú, diálogo, tarjeta del menú, placa sobre la escena), siempre negras y difusas (`0 24px 60px rgba(0,0,0,.45)`).

## 6. Componentes

Cada componente del juego, con sus medidas y tokens: [COMPONENTES.md](COMPONENTES.md). El botón principal es blanco con letra negra, en el juego y en las páginas, y hay uno por pantalla.

## 7. Imágenes

En orden de preferencia:
1. **El juego mismo**: capturas de la mesa en primera persona, cartas en el paño, caras haciendo señas.
2. **Los recursos del juego**: las 40 cartas "Naipes Libres", los personajes dibujados en canvas (`characters.js`), la carta quemada, el anotador.
3. **El mundo del truco**: bares, clubes, mesas de fórmica, paño, sifones, luz de lámpara, en fotos reales con crédito.

Tratamiento: la imagen va a color (la mesa, los ambientes y las cartas son a color) dentro de una interfaz en blanco y negro; esquinas rectas; recortes generosos. Lo que se escribe encima va en blanco o negro, nunca en un color sacado de la imagen. Nunca fotos de stock de gente sonriendo con celulares, ni dorados de casino.

El crédito de las cartas es obligatorio en toda página que las muestre: texto y licencia en [RECURSOS.md](RECURSOS.md) §1.

## 8. Movimiento

"Arranca rápido y se asienta", igual que las cartas del juego: `--ease-out` (`cubic-bezier(0.16, 1, 0.3, 1)`). Botones 120 ms, globos y hover 180 ms, cartas y entradas 420 ms. Una seña dura 2,2 s. Solo transform y opacidad. Con `prefers-reduced-motion`, sin desplazamientos.

## 9. Voz

Ver [VOZ.md](VOZ.md). Los cantos llevan mayúscula inicial y signos de apertura: **¡Truco!**, **¡Quiero retruco!**. Sin mayúsculas forzadas, salvo el estilo Canto de las páginas (§4).
