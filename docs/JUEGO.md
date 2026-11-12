# Trukeados — qué hace el juego

Documentación funcional completa: qué ve, qué puede hacer y qué siente quien juega. Es la materia prima
para la landing. Para el código, [AGENTS.md](../AGENTS.md); para el detalle
de cada regla, [REGLAS.md](REGLAS.md).

> Lo que hace el juego hoy. La historia de cambios está en [CHANGELOG.md](../CHANGELOG.md).

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
| 6 | **Cero fricción** | Sin cuenta. Nombre y listo. Sala por código de 4 números, link `/sala/CÓDIGO`, compartir por WhatsApp, partida rápida. |
| 7 | **Nunca te quedás sin mesa** | Bots con nombres de barrio (Tito, Coca, El Ruso, Chacho, Pocha, Cacho, Mirta, Pirulo…) llenan lugares y juegan por quien se desconecta. |
| 8 | **Suena a truco** | Voz que canta los cantos ("¡Truco!", "¡A ver esos tantos!", "A ver, mostrá las dos"), ruido de carta en el paño, frases rápidas de chat ("Las viejas", "Jugá, che", "Uy, se me cayó"). |
| 9 | **Anotador de palitos** | Los puntos se anotan como en papel: cuatro palitos y el quinto cruzado. A 30, raya entre malas y buenas. |

## 3. Recorrido de quien juega

### 3.1 Menú de inicio (`/`)
- Título "Trukeados" y bajada *"Truco argentino en 3D, online, con señas de verdad."*
- **Tu nombre** ("¿Cómo te llaman en la mesa?"). Se recuerda en el navegador.
- **Partida rápida**: botones 1 vs 1 / 2 vs 2 / 3 vs 3. Te sienta en una mesa pública que espera gente,
  o abre una nueva.
- **Unirte con código** (4 números) o con el link `/sala/CÓDIGO`.
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

## 4. Reglas

Las reglas completas, con sus fuentes y lo que falta, están en [REGLAS.md](REGLAS.md). Lo que el copy necesita saber:

- Partida a **15** o a **30** (malas y buenas). Truco argentino, con baraja española de 40.
- **Flor**, **muestra** y **no permitir trampas** son opciones de la sala, apagadas por defecto (las trampas, en cambio, vienen permitidas). Se puede decir "con flor o sin flor", nunca que se juega con flor siempre; y "se puede hacer trampa" vale porque es lo que viene por defecto.

## 5. Las 11 señas

La tabla de señas (carta, cara y expresión) está en [RECURSOS.md](RECURSOS.md) §3. Los bots también hacen señas a su
compañero: miran primero al compañero y después ponen la cara. Los personajes **no parpadean solos**: ojos cerrados
siempre significan "ciego".

## 6. Personajes

Dibujados en 2D sobre canvas, no son modelos 3D. Cómo se generan y qué hacen: [RECURSOS.md](RECURSOS.md) §2. Giran la
cabeza para mirar a otros, hablan cuando cantan y sostienen sus cartas.

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

Todo sintetizado, sin archivos. Detalle en [RECURSOS.md](RECURSOS.md) §6. Se apaga con "Voz: no".

## 9. Identidad visual

Blanco y negro, en Hanken Grotesk; la mesa y los ambientes van a color. Todo está en [DESIGN.md](../DESIGN.md) y en
[brand/](../brand/).

## 10. Técnica (lo justo para la landing)

- **Cloudflare Workers + Durable Objects** (una sala = un objeto, única fuente de verdad). Gratis en el
  plan free. Antitrampa real: cada jugador recibe solo lo que puede ver.
- **Cliente sin build ni frameworks**: HTML/CSS/JS + Three.js como módulo en `public/vendor/`.
- Rutas: `/` menú, `/sala/CÓDIGO` partida, `/api/lobby` mesas públicas (JSON: `open` y `live`).
- Tests: motor + 60 partidas completas entre bots por modo, y las opciones de sala (`test/opciones.test.js`).
- Funciona en celular (panel a todo el ancho, filas deslizables). Probado en 1280×720, 768×1024, 375×812.

## 11. Activos reutilizables para la landing

Qué se puede copiar y cómo: [RECURSOS.md](RECURSOS.md), sección «Cómo los toma una página derivada». Los tokens de
marca están en [brand/tokens.css](../brand/tokens.css).
