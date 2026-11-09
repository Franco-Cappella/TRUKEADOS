# Trukeados — recursos del juego

Qué piezas del juego se pueden usar fuera de él (landing, redes, prensa), dónde están, cómo se
llaman y cómo se usan sin cambiarlas. Regla: **se reutilizan tal cual, no se redibujan ni se imitan.**
Si una página necesita algo que el juego no tiene, primero se agrega al juego.

## Cómo los toma una página derivada

La landing vive en otro proyecto (React). No importa archivos del juego por ruta relativa: los
**copia** con un script de sincronización y deja las copias en su repositorio, para poder publicarse
sola. Qué se copia:

| Del juego | A la página | Por qué |
|---|---|---|
| `public/cards/*.webp` | `public/cards/` | Cartas |
| `public/js/characters.js` | `src/game/characters.js` | Personajes y caras |
| `public/js/theme.js` | `src/game/theme.js` | Colores del canvas (lo usa `characters.js`) |
| `public/js/config.js` | `src/game/config.js` | Nombre (`APP_NAME`), señas (`SENAS`), nombres de bots, tiempos, opciones de sala |
| `public/js/engine.js` (si hace falta) | `src/game/engine.js` | `cardName`, `rank`, `tanto` |
| `brand/tokens.css` | `src/brand/tokens.css` | Tokens |
| `brand/logo/*.svg` | `public/brand/` | Logos |

Los archivos copiados **no se editan** en la página: si hay que cambiarlos, se cambia el juego y se
vuelve a sincronizar. `characters.js`, `theme.js`, `config.js` y `engine.js` no usan el DOM al
importarse, así que funcionan en cualquier bundler.

---

## 1. Cartas

- **Dónde**: `public/cards/`. 40 cartas + `back.webp` (dorso). WebP, 512 × 788 px.
- **Nombre**: número + palo. Palos: `E` espada, `B` basto, `O` oro, `C` copa. Números 1–7 y 10–12
  (sin 8 ni 9). Ejemplos: `1E` ancho de espada, `1B` ancho de basto, `7E`, `7O`, `12C`.
- **Nombre en texto**: `cardName(id)` de `engine.js` → "ancho de espada", "7 de oro", "12 de copa".
- **Proporción**: `aspect-ratio: 512 / 788`. Esquina `--radius-naipe` (6,5 %).
- **Jerarquía** (mayor a menor): 1E · 1B · 7E · 7O · 3 · 2 · 1 falsos (1O, 1C) · 12 · 11 · 10 ·
  7 falsos (7B, 7C) · 6 · 5 · 4. En código: `rank(id)`.
- **Las "cuatro grandes"**: 1E, 1B, 7E, 7O. Son las cartas de portada.
- **Carta "en blanco"**: la de abajo de dos encimadas vista por un rival, blanca `#fbfaf6` con borde
  `#8d8a80` (`CARD.blank` en `theme.js`).
- **Carta quemada**: la de arriba de dos encimadas. Se oscurece con `#6e5a4c`, bordes carbonizados
  `rgba(28,14,6,.92)` y brasas `rgba(214,96,28,.55)` (`burnTex()` en `scene.js`, `CARD` en `theme.js`).
  En páginas se reproduce con los mismos valores (multiplicar el tinte, viñeta radial de carbón en los
  bordes, puntos de brasa); nunca con un filtro de "fuego".
- **Licencia**: "Naipes Libres" de Basquetteur (Wikimedia Commons), vectorizadas por gjenkins20,
  **CC BY-SA 3.0**. El crédito va en el pie de toda página que muestre cartas:
  > Cartas: diseño "Naipes Libres" de Basquetteur (Wikimedia Commons), CC BY-SA 3.0, vectorizadas por gjenkins20.

## 2. Personajes

Dibujados en 2D sobre canvas por `characters.js`. No son imágenes: se generan.

**Estilo**: ilustración plana de tinta y sepia. Proporciones adultas (cabeza chica, hombros anchos, cuello
largo), cara angulosa, ojos de párpado pesado, cejas afiladas. Cada superficie tiene dos tonos con sombra
de borde duro; los pliegues y mechones son cuñas que terminan en punta. Grano de papel encima. **Sin
degradados, sin brillos suaves, sin cabezas redondas.** Una pieza nueva sigue estas reglas o desentona.
Arquetipos propios: chaleco con corbata y gaucho (poncho con guarda pampa, pañuelo, rastra, sombrero).

- **Lienzo**: `W = 512`, `H = 1200` (cuerpo entero sentado, del piso a la cabeza).
- **Dibujar**: `drawCharacter(ctx, look, state)`
  - `look`: aspecto, sale de `lookFor(nombre, asiento)`.
  - `state.expr`: la cara (ver tabla de señas). `'neutral'` por defecto.
  - `state.talking`: boca hablando (alternar cada 130 ms mientras "canta").
  - `state.headYaw` / `state.bodyYaw`: giro en radianes (−1,35 a 1,35; 0 = de frente). Sirve para que
    la cabeza siga al cursor o mire a otro personaje.
  - `state.down`: 0 a 1, cuánto mira hacia la mesa.
  - `state.cards`: cuántas cartas sostiene (0–3).
- **Aspecto determinístico**: `lookFor('Pocha', 2)` da **siempre la misma cara** para ese nombre en ese
  asiento: piel (6 tonos), pelo (8 colores, canas en los mayores), peinado (`short`, `swept`, `wavy`, `long`,
  `bun`, `receding`, `curly`, `boina`, `cap`, `buzz`, `sombrero`), barba, barba de días, bigote, anteojos,
  ancho y alto de cara, mandíbula, gesto de las cejas, ropa (`button`, `vest`, `gaucho`, `sweater`, `tee`,
  `jacket`, `polo`), color de acento y pantalón.
- **Recorte de cara**: `{ x: 106, y: 100, size: 300 }` sobre el lienzo de 512 × 1200 (el que usa
  `drawFace` en `hud.js` para el menú de señas y el espejo). Fondo de la cara: `--face-bg` `#262626`.
- **Contorno**: tinta `INK` `#17100b`. Paletas en `PALETTE` de `theme.js`; colores de la boca y los ojos en
  `FACE`; accesorios en `OUTFIT`.
- **No parpadean solos**: los ojos cerrados son solo la seña "ciego". Una página nunca anima un
  parpadeo automático.
- **Nitidez**: dibujar el canvas a `devicePixelRatio` (ancho y alto multiplicados, CSS al tamaño real).

## 3. Señas

`SENAS` de `config.js`. Una seña dura `SENA_MS` = 2200 ms.

| id | Carta / dato | `expr` | Cara |
|---|---|---|---|
| `ancho_espada` | Ancho de espada | `brows` | Levantar las cejas |
| `ancho_basto` | Ancho de basto | `wink` | Guiñar un ojo |
| `siete_espada` | Siete de espada | `mouthRight` | Torcer la boca a la derecha |
| `siete_oro` | Siete de oro | `mouthLeft` | Torcer la boca a la izquierda |
| `tres` | Un tres | `bite` | Morderse el labio |
| `dos` | Un dos | `kiss` | Tirar un beso (trompita bien marcada) |
| `ancho_falso` | Ancho falso | `open` | Abrir la boca |
| `ciego` | Nada (ciego) | `eyesClosed` | Cerrar los ojos |
| `envido_alto` | Tengo envido | `puff` | Inflar los cachetes |
| `treinta` | 30 o más de envido | `nose` | Fruncir la nariz |
| `nada_envido` | No tengo envido | `frown` | Boca para abajo |

De palabra (chat): "las viejas" = 27, "las perdedoras" = 29.
Texto alternativo de una cara haciendo una seña: **"[Nombre] guiña un ojo: ancho de basto."**

## 4. Nombres de los bots

`BOT_NAMES` de `config.js`: Tito, Coca, El Ruso, Chacho, Pocha, Beto, Nené, Cacho, Mirta, Pirulo,
Tota, Rulo, Sancho, Volcho, Olcho, Carlitos, Tronco. En una mesa no se repiten. Son los únicos nombres de
ejemplo que usan las páginas (no inventar otros).

## 5. Anotador de palitos

`palitos(puntos, objetivo)` de `hud.js` devuelve un SVG (28 px de ancho, grupos de 5 uno debajo del
otro). Para una página: copiar la función o reproducir sus medidas exactas (ver
[COMPONENTES.md](COMPONENTES.md) §7). Partidas a 15 o a 30 (a 30, raya entre malas y buenas).

## 6. Sonido y voz (`audio.js`)

- `flick()`: golpe de carta en el paño (ruido filtrado, 70 ms). Sin archivos.
- `ding()`: "te toca" (880 Hz, 350 ms).
- `say(texto)`: voz del navegador en español (prefiere `es-AR`), velocidad 1,05.
- En páginas: **apagado por defecto**, solo después de un gesto del usuario, con un interruptor visible.

## 7. La escena del bar (`scene.js`, colores en `SCENE` de `theme.js`)

Un bar en penumbra, con el mismo lenguaje que los personajes: materiales de sombreado por escalones
(`toon()` en `scene.js`) y paredes pintadas, sin mapeo de tonos para que la paleta quede exacta.
Lámpara colgante de pantalla verde (`#27352b`) con luz `#ffdcaa`, paño verde en franjas planas (`#27523e` →
`#1a4529`) con costura, guarda escalonada y el nombre del juego en un rombo (`SCENE.feltName`, que sale de
`APP_NAME`), mesa de madera oscura, boiserie `#1b120d` con molduras, estantería de botellas en la pared de
enfrente, piso de tablones, vaso de vino, botella, mate con bombilla y cuatro láminas de dos tintas en los
costados: sol, guarda pampa, espada y pampa con ombú.

Para usar la escena en una página: **capturas reales del juego** (ver abajo). Montar Three.js en una
landing solo si la escena es lo principal de esa sección, y siempre cargándolo después del primer
pintado (son ~680 KB sin comprimir).

## 8. Capturas del juego

Son la mejor imagen que tiene la marca. Cómo sacarlas:
1. `npm run dev` en el juego (`http://localhost:8787`), "Practicar con bots" (2 vs 2 da la mesa más llena).
2. En la consola: `window.__truco.scene` (cámara: cambiar `tYaw` / `tPitch`; `lookAtSeat(n)`;
   `showSena(asiento, id)` para que un personaje haga una seña) y `window.__truco.room`.
3. Tamaños: 2560 × 1440 (escritorio), 1170 × 2532 (celular). Ocultar la interfaz si la toma es de ambiente.
4. Guardar en WebP calidad 82 y en AVIF; nombre descriptivo (`mesa-2v2-reparto.webp`).

Lista mínima para la landing: mesa en primera persona con cartas en la mano · primer plano de una cara
haciendo una seña · carta quemada sobre el paño · globo "¡Truco!" sobre un personaje · vista en celular
· la mesa de 3 vs 3 desde arriba.
