# Reglas del truco en Truco 3D

Truco argentino **sin flor**, para 1 vs 1, 2 vs 2 y 3 vs 3. Este documento dice qué reglas aplica el
motor (`public/js/engine.js`), cuáles son decisiones de la mesa y cuáles **no** están implementadas.
Si cambiás una regla: cambiá el motor, agregá un test en `test/truco.test.js` y actualizá este archivo.

Fuente principal: *Reglamento de Truco* de juegosdesalon.com
([PDF](https://www.folkloretradiciones.com.ar/reglamento%20truco.pdf)), citado abajo como **[R]**.

## Implementadas

### Cartas y reparto
| Regla | Dónde | Nota |
|---|---|---|
| Baraja española de 40 cartas (sin 8 ni 9) | `newDeck` | |
| Jerarquía: ancho de espada > ancho de basto > 7 de espada > 7 de oro > 3 > 2 > anchos falsos > 12 > 11 > 10 > 7 falsos > 6 > 5 > 4 | `rank` | |
| Reparte el dador, corta el de su izquierda, se reparte de a una empezando por la mano (a la derecha del dador) | `deal`, `cutter` | [R] §17 |
| La mano siguiente la reparte el que fue mano | `nextHand` | |
| Asientos alternados por equipo (equipo = asiento % 2) | `team` | [R] §3 |

### Truco (las cartas)
| Regla | Dónde | Nota |
|---|---|---|
| Gana la mano quien gana 2 de 3 rondas; pardas: define la primera no parda, y si todo es parda gana la mano | `handWinner` | |
| Truco 2 / Retruco 3 / Vale cuatro 4; no querido vale el nivel anterior; sin cantar, 1 | `act` truco/quiero/noquiero | [R] |
| Solo sube (retruco, vale cuatro) el equipo que tiene el quiero | `trucoOpenFor` | [R] "no puede retrucarse sin haber dicho quiero" |
| Subir contestando implica querer lo anterior | `act` truco | |
| **Se canta en tu turno, antes de tirar** (contestar no requiere turno) | `trucoOpenFor`, `envidoOpenFor` | [R] §11: cada jugador canta "en su turno". Antes se podía cantar fuera de turno: era un bug |
| Carta tapada: desde segunda, vale 0 (pierde con cualquier carta) | `act` play, `playValue` | |
| Irse al mazo: en equipo se va todo el equipo; el rival cobra lo que valga el truco | `act` mazo | |
| Irse al mazo en primera sin envido cantado: +1 de envido para el rival | `act` mazo | costumbre de mesa |

### Envido
| Regla | Dónde | Nota |
|---|---|---|
| Tantos: dos del mismo palo = 20 + sus valores (figuras valen 0); si no, la carta más alta | `tanto` | [R] |
| Solo en primera, antes de tirar tu carta, en tu turno | `envidoOpenFor` | [R] §18 |
| "El envido está primero": contestando un truco en primera se puede cantar envido | `envidoOpenFor` | [R] §11 |
| En equipos, canta y contesta el **pie** (el que reparte y el que corta) | `pies`, `envidoVoices` | [R] §17 (pie) |
| Envido 2, Real envido 3, Falta envido (lo que le falta al que va ganando); no querido 1 o lo querido antes | `envidoAcceptedPoints`, `envidoDeclinedPoints` | |
| Secuencias: envido, envido-envido, real, falta | `envidoNextOptions` | |
| Se cantan los tantos desde la mano; cada uno canta más o dice "son buenas" | `startDeclare`, `advanceDeclare` | |
| Se puede mentir el número; si al mostrar no coincide, pierde los puntos del envido | `actShow` | |
| El ganador tiene que mostrar: si no muestra y le reclaman, pierde los puntos del envido | `actShow`, `closeShow` | |
| Los puntos se anotan al terminar la mano (envido primero, después truco) | `finishHand` | |

### Trampa: dos cartas encimadas (carta quemada)
El reglamento no trata esta trampa. Se resolvió con definiciones del glosario de [R]:
- **"Carta jugada es la que se ha colocado sobre la mesa boca arriba"** y **"una vez jugada no se puede retirar"**.
- Por turno se juega **una** carta.

Por eso:
1. La carta **de abajo** es la que juega la ronda (los rivales no la ven hasta el final de la mano).
2. La carta **de arriba** ya quedó en la mesa y no se puede levantar, pero no es la jugada del turno:
   queda **quemada**. No juega ninguna ronda, se pierde, y se ve **claramente quemada** (oscura, con bordes
   carbonizados y cruzada sobre la otra).
3. Si al tramposo se le acaban las cartas, en las rondas siguientes **pasa sin carta** (vale -1).
4. Cualquier rival puede pedir **"mostrá las dos"**: se levanta la quemada y todos ven la de abajo. No hay puntos.

Antes (en Cadalado) la de arriba se jugaba sola en la ronda siguiente; se cambió a "quemada".

### Reglas de la mesa (configurables o decididas por el juego)
| Regla | Dónde |
|---|---|
| En equipos el truco recién se canta desde segunda (el anfitrión lo puede desactivar) | `trucoBlocked`, `cfg.trucoDesdeSegunda` |
| "Ayudas": mostrar quién gana cada ronda | `cfg.ayudas`, `viewFor` |
| Partida a 15 o a 30 (a 30 el anotador separa malas y buenas) | `TARGETS` en `config.js` |
| Irse al mazo y pedir "mostrá las dos" se puede en cualquier momento (no hace falta que sea tu turno) | `actionsFor` |
| Si pasan 15 s sin que el ganador muestre ni nadie reclame, los tantos valen | `TIMING.showWindow` |
| Señas: solo las ve quien te está mirando en ese momento | `TrucoRoom.deliverSena` |
| Los personajes no parpadean solos: los ojos cerrados son únicamente la seña "ciego" | `characters.js` |

## No implementadas (todavía)
- **Flor** (y contraflor, "con flor me achico", etc.). [R] §12.
- **Partidas de 3** (con gallo), de **8**, y **pica-pica** en 3 vs 3. [R] §3.
- **Chicos**: la partida termina al llegar a 15/30; no se juega "al mejor de dos chicos". [R] §2.
- Corte con mínimo de tres cartas por mitad, "golpear el mazo" sin cortar. [R] §17.
- Carta que cae boca arriba en el reparto (el que la recibe puede pedir nuevo reparto). [R] §17.
- Expresiones ambiguas ("quieto", "envido mi truco"…): el juego usa botones, no hay ambigüedad. [R] §16.
- Penalidades por hablar de más / señas indebidas en pica-pica.
