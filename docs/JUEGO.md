# Trukeados — qué hace el juego

Documentación funcional completa: qué ve, qué puede hacer y qué siente quien juega. Es la materia prima
para la landing (ver [landing/](landing/)). Para el código, [AGENTS.md](../AGENTS.md); para el detalle
de cada regla, [REGLAS.md](REGLAS.md).

> Estado documentado: versión 1.5.3 (commit `4766ecf`).

---

## 1. En una frase

**Truco argentino online, en 3D y en primera persona: te sentás a la mesa de un bar con amigos o
desconocidos, y las señas se hacen con la cara, así que un rival te las puede cazar.**

Gratis, sin registro, sin instalar nada, desde el navegador (compu o celular).

## 2. Lo que lo hace distinto

Esto es lo que tiene que contar la landing. Ordenado de más a menos diferencial:

| # | Diferencial | Por qué importa |
|---|---|---|
| 1 | **Señas con la cara de verdad** | 11 señas (cejas, guiño, boca torcida, boca abierta, un beso, cachetes inflados…). El servidor solo se la manda a **quien te está mirando en ese momento**. Si el rival te estaba mirando, la vio. Es el truco de verdad, no un menú de "enviar seña al compañero". |
| 2 | **Primera persona en un bar** | Estás sentado. Mirás a los costados, bajás la vista a la mesa, hacés zoom a una cara. Lámpara colgante, paño verde, vino, mate, estantería de botellas y láminas ilustradas en la pared. |
| 3 | **Se puede hacer trampa** | "Dos encimadas": tirás una carta tapada con otra. La de abajo juega; la de arriba queda **quemada** (se ve carbonizada). Cualquier rival puede pedir "¡mostrá las dos!". La sala puede no permitir trampas. |
| 4 | **Se puede mentir el envido** | Cantás el número que quieras. Si ganás tenés que mostrar; si no coincide o te reclaman, perdés los puntos (salvo en una sala sin trampas). |
| 5 | **1 vs 1, 2 vs 2 y 3 vs 3** | Con "pie" de cada equipo, truco desde segunda en equipos, y las reglas del reglamento tradicional. La flor y la muestra son opciones de la sala. |
| 6 | **Cero fricción** | Sin cuenta. Nombre y listo. Sala por código de 5 letras, link `/sala/CÓDIGO`, compartir por WhatsApp, partida rápida. |
| 7 | **Nunca te quedás sin mesa** | Bots con nombres de barrio (Tito, Coca, El Ruso, Chacho, Pocha, Cacho, Mirta, Pirulo…) llenan lugares y juegan por quien se desconecta. |
| 8 | **Suena a truco** | Voz que canta los cantos ("¡Truco!", "¡A ver esos tantos!", "A ver, mostrá las dos"), ruido de carta en el paño, frases rápidas de chat ("Las viejas", "Jugá, che", "Uy, se me cayó"). |
| 9 | **Anotador de palitos** | Los puntos se anotan como en papel: cuatro palitos y el quinto cruzado. A 30, raya entre malas y buenas. |

## 3. Recorrido de quien juega

### 3.1 Menú de inicio (`/`)
- Título "Trukeados" y bajada *"Truco argentino en 3D, online, con señas de verdad."*
- **Tu nombre** ("¿Cómo te llaman en la mesa?"). Se recuerda en el navegador.
- **Partida rápida**: botones 1 vs 1 / 2 vs 2 / 3 vs 3. Te sienta en una mesa pública que espera gente,
  o abre una nueva.
- **Unirte con código** (5 letras/números) o con el link `/sala/CÓDIGO`.
- **Crear sala**: modo, puntos (30 con malas y buenas, o 15), privada o pública, y las opciones de la sala
  (`ROOM_OPTIONS` en `config.js`): **con flor**, **con muestra** y **no permitir trampas** (sin dos encimadas
  ni mentir en el envido, y se ve quién ganó cada ronda). Por defecto: sin flor, sin muestra y con trampas.
- **Practicar con bots**: crea una sala privada y arranca sola, completada con bots.
- **Mesas públicas** (se actualiza cada 7 s): las que esperan gente ("Sentarme") y las que se están
  jugando con el tanteador ("Van 12 a 9" → "Mirar", modo espectador).

### 3.2 Sala de espera
- Asientos alrededor de la mesa; el anfitrión puede **agregar/sacar bots**, **echar** gente, cambiar la
  configuración (opciones de la sala, pública, truco desde segunda) y **empezar** ("llenar con bots" si faltan).
- Se comparte el link o el código (chip "Sala ABCDE" copia el enlace).

### 3.3 La partida
**Reparto animado**: el mazo llega al que reparte, se mezcla (1,1 s), corta el de la izquierda (0,8 s) y
se reparte de a una empezando por la mano. Toast: *"Mano 3: reparte Coca y corta Tito"*.

**Pantalla**:
- Arriba: salir, código de sala, Voz sí/no, Zoom (tecla Z), Ayuda, Chat.
- Arriba al centro: **"Mirar a"** (botones para girar la vista hacia cada jugador). "te mira" junto al
  nombre de quien te está mirando y, en equipos, la marca de quién es **pie** en cada mano.
- Arriba a la izquierda: **anotador de palitos**.
- Abajo al centro: **tu mano** en primera persona (tus manos dibujadas sosteniendo las cartas). Las
  cartas se ordenan arrastrándolas.
- Abajo a la izquierda: **Señas** (con la cara que vas a poner) y **Mostrá las dos**.
- Abajo a la derecha: **panel** con el estado ("Te toca", "Esperando a Chacho…"), la carta elegida
  (Tirar / Dos encimadas / Tapada) y los cantos disponibles.
- Espejo "Así te ven": al hacer una seña aparece tu cara con la expresión durante 2,2 s.

**Controles**: arrastrar (mouse o dedo) o A/D, W/S para mirar; Z para zoom; 1/2/3 elige carta y Enter
la tira; tocar dos veces la carta la tira.

**Respuesta inmediata**: la carta vuela y el globo del canto aparece al instante; el servidor confirma
después (o corrige).

**Fin de la mano**: pausa de 4,2 s para ver cómo terminó. Toasts de cada ronda ("Ganamos la ronda 2",
"Parda"), del envido ("Envido para nosotros: Pocha con 31"), de trampas ("dos encimadas: quedó quemado
el 4 de copa") y de reclamos ("Cacho reclamó: Beto no mostró. Pierde los puntos del envido").

**Fin de la partida**: pantalla de resultado con **Revancha**.

### 3.4 Espectador
Desde "Mesas públicas" → "Mirar". Se ve la mesa sin ver cartas ajenas.

### 3.5 Desconexión
"Se cortó la conexión. Reconectando…". Si un humano no vuelve en 40 s, un bot juega por él hasta que
vuelve. Si se va el anfitrión, pasa a otro humano.

## 4. Reglas (resumen para humanos)

Truco argentino, baraja española de 40. La **flor** y la **muestra** son opciones de la sala (apagadas
por defecto), igual que **no permitir trampas**.

- **Jerarquía**: ancho de espada > ancho de basto > 7 de espada > 7 de oro > 3 > 2 > anchos falsos >
  12 > 11 > 10 > 7 falsos > 6 > 5 > 4.
- **La mano** se gana con 2 de 3 rondas. Pardas: define la primera no parda; si todo es parda, gana la mano.
- **Truco** 2 · **Retruco** 3 · **Vale cuatro** 4 (no querido: el nivel anterior; sin cantar: 1). Solo
  sube quien tiene el quiero. Se canta en tu turno, antes de tirar; contestar es inmediato.
- **Envido** 2 · **Real envido** 3 · **Falta envido** (lo que le falta al que va ganando). Solo en primera.
  "El envido está primero". En equipos canta y contesta el **pie**.
- **Tantos**: dos del mismo palo = 20 + valores (figuras 0). Se cantan desde la mano; "son buenas".
  Se puede mentir; hay que mostrar; se puede reclamar. 15 s sin reclamo → valen.
- **Al mazo**: en equipo se va todo el equipo; en primera sin envido cantado, el rival suma 1 extra.
- **Tapada**: desde segunda, boca abajo, no gana la ronda.
- **Dos encimadas** (trampa): la de abajo juega, la de arriba queda quemada; "mostrá las dos" la revela.
- **Flor** (opción): tres del mismo palo, obligatoria y anula el envido; con flor quiero, me achico,
  contraflor y contraflor al resto. No se puede mentir: la calcula el motor.
- **Muestra** (opción): se da vuelta una carta; las piezas de ese palo (2, 4, 5, 11 y 10) pasan a ser las
  más altas y cambian el envido.
- **Pica-pica** (opción, 3 vs 3): una mano redonda y una mano a mano contra el de enfrente.
- Partida a **15** o a **30** (malas y buenas).
- Detalle y fuentes (reglamento de juegosdesalon.com): [REGLAS.md](REGLAS.md).

**No tiene (todavía)**: partidas de 3 con gallo / de 8, chicos (mejor de dos).
Importa para el copy: la flor, la muestra y las trampas dependen de la sala. Se puede decir "con flor o sin
flor", nunca que se juega con flor siempre; y "se puede hacer trampa" vale porque es lo que viene por defecto.

## 5. Las 11 señas

| Carta / dato | Cara |
|---|---|
| Ancho de espada | Levantar las cejas |
| Ancho de basto | Guiñar un ojo |
| Siete de espada | Torcer la boca a la derecha |
| Siete de oro | Torcer la boca a la izquierda |
| Un tres | Morderse el labio |
| Un dos | Tirar un beso (trompita bien marcada) |
| Ancho falso | Abrir la boca |
| Nada (ciego) | Cerrar los ojos |
| Tengo envido | Inflar los cachetes |
| 30 o más de envido | Fruncir la nariz |
| No tengo envido | Boca para abajo |

De palabra (chat, lo escuchan todos): "las viejas" = 27, "las perdedoras" = 29.
Los personajes **no parpadean solos**: ojos cerrados = siempre "ciego". Los bots también hacen señas a
su compañero (miran primero al compañero y después ponen la cara).

## 6. Personajes

Dibujados en 2D sobre canvas (no son modelos 3D) y ubicados en la escena 3D como recortes.
Cada uno se genera a partir del nombre + asiento, así que **el mismo nombre en el mismo lugar tiene
siempre la misma cara**: 6 tonos de piel, 8 colores de pelo (canas en los mayores), peinados (incluido
"pelado"), barba, barba de días, bigote, anteojos, forma de cara y mandíbula, ropa y pantalones.
Giran la cabeza para mirar a otros, hablan cuando cantan y sostienen sus cartas.

## 7. El bot

Corre en el servidor y decide **solo con lo que vería un jugador**. Juega razonable, no perfecto:
- Elige carta según lo que hay en la mesa (si ya gana el compañero, tira la más baja; si no puede
  ganar, va a la parda en primera).
- Canta envido con 27+ (más agresivo con 30+), quiere con 27+, a veces **farolea** (7 % de envido, 4 % de
  real envido sin tener).
- Canta truco con mano fuerte (y a veces de farol, 8 %).
- Muy de vez en cuando **hace trampa** (3 %, dos encimadas en primera), si la sala lo permite.
- Canta y contesta la **flor** y entiende la **muestra** cuando la sala las tiene.
- **Reclama** si un humano no muestra los tantos (75 %).
- Piensa entre 0,65 y 1,3 s: ni instantáneo ni lento.

## 8. Sonido

Todo sintetizado (sin archivos): golpe de carta en el paño, "ding" de "te toca", y voz del navegador
en español (prefiere es-AR) para los cantos. Se apaga con "Voz: no".

## 9. Identidad visual (detalle completo en [../DESIGN.md](../DESIGN.md) y [../brand/](../brand/))

- **Tipografía única**: Archivo (Omnibus-Type, estudio de Buenos Aires), variable en peso y ancho.
  Angosta para rótulos. **Sin itálicas, sin serif.**
- **Paleta**: grises neutros (`#121212` → `#f5f5f5`) + los **cuatro palos** de la baraja:
  espada `#2f6fd6`, basto `#2e9e57`, oro `#f2c12e` (único acento), copa `#d93b30`.
  Prohibido: marfil, latón, marrones en la interfaz.
- **Escena** (solo 3D): bar en penumbra (paredes `#1b120d`, luz de lámpara `#ffdcaa`, paño `#27523e`).
- **Cartas**: "Naipes Libres" de Basquetteur (CC BY-SA 3.0) en WebP, 40 + dorso.
- **Logo**: dos naipes cruzados con el ancho de espada + TRUKEADOS en Archivo Expanded Black ([../brand/logo/](../brand/logo/)). El nombre del juego sale de `APP_NAME` (`config.js`); el `favicon.svg` todavía es el viejo (ver [../brand/ALINEACION.md](../brand/ALINEACION.md)).
- **Voz del copy**: español rioplatense ("tirá", "cantá", "vos").

## 10. Técnica (lo justo para la landing)

- **Cloudflare Workers + Durable Objects** (una sala = un objeto, única fuente de verdad). Gratis en el
  plan free. Antitrampa real: cada jugador recibe solo lo que puede ver.
- **Cliente sin build ni frameworks**: HTML/CSS/JS + Three.js como módulo en `public/vendor/`.
- Rutas: `/` menú, `/sala/CÓDIGO` partida, `/api/lobby` mesas públicas (JSON: `open` y `live`).
- Tests: motor + 60 partidas completas entre bots por modo, y las opciones de sala (`test/opciones.test.js`).
- Funciona en celular (panel a todo el ancho, filas deslizables). Probado en 1280×720, 768×1024, 375×812.

## 11. Activos reutilizables para la landing

| Activo | Dónde | Uso posible |
|---|---|---|
| 40 cartas + dorso WebP | `public/cards/` | Hero, jerarquía interactiva, abanicos, texturas 3D |
| Escena del bar | `public/js/scene.js` (`TableScene`) | Hero en vivo, "tour" de la mesa |
| Personajes y caras | `public/js/characters.js` (`drawCharacter`, `lookFor`) | Demo de señas, galería de personajes, "generá tu cara" |
| Recorte de cara | `public/js/hud.js` (`drawFace`) | Tarjetas de seña |
| Anotador de palitos | `public/js/hud.js` (`palitos`) | Contadores, sección de puntos |
| Carta quemada | `scene.js` (`burnTex`) | Sección de la trampa |
| Sonidos y voz | `public/js/audio.js` | Microinteracciones con sonido (opt-in) |
| Motor de reglas | `public/js/engine.js` (`rank`, `tanto`) | Calculadora de envido, "¿quién gana?" |
| Lobby en vivo | `GET /api/lobby` | "Mesas jugándose ahora" |
| Tokens | `:root` de `truco.css`, `theme.js` | Paleta y tipografía de la landing |
