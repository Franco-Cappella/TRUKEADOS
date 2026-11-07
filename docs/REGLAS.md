# Reglas del truco en Trukeados

Truco argentino para 1 vs 1, 2 vs 2 y 3 vs 3; la flor y la muestra son opcionales de la sala. Este documento dice qué reglas aplica el
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
| Carta tapada: solo desde segunda, y se quema (vale como un 4) | `act` play, `playValue` | ver "Cartas quemadas" |
| La segunda y la tercera ronda las empieza quien ganó la anterior (en parda, la mano) | `resolveRound` | [R] glosario: "en las bazas segunda y tercera, el mano es el que ha ganado la baza anterior" |
| Gana la mano quien gana dos rondas: ganar primera y perder segunda **no** termina la mano, se juega tercera | `handWinner` | [R] "El truco": "para ganar el truco hay que ganar dos de ellas" |
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
| Se cantan los tantos desde la mano; cada uno canta más o dice "son buenas". Al que va ganando con su equipo se lo saltea, pero si después el otro equipo canta más, le vuelve a tocar | `startDeclare`, `advanceDeclare` | |
| Se puede mentir el número; si al mostrar no coincide, pierde los puntos del envido | `actShow` | |
| El ganador tiene que mostrar: si no muestra y le reclaman, pierde los puntos del envido. Puede mostrar aunque se haya ido al mazo en el truco | `actShow`, `closeShow` | |
| "Irse al mazo sin mostrar": no muestra (por ejemplo, porque mintió). Los rivales tienen unos segundos (`TIMING.foldWindow`) para reclamar; si nadie reclama, los tantos valen | `actShow` (`nomostrar`), `TrucoRoom.onFold` | regla de la mesa |
| "En mesa": si el que ganó el envido ya tiró a la vista las cartas que forman lo que cantó, ya mostró (lo dice: "22 en mesa"). Al mostrar al final, las cartas de los tantos quedan boca arriba en la mesa | `enMesa`, `revealTanto` | |
| Consulta al compañero (en equipo): "¿tienen tantos?" / "¿le canto truco?", y la respuesta "Cantá" o "Callado" (seguir sin cantarlo, que lo canten los otros; puede ser ir a la pesca). Una vez por mano cada cosa; se dice en voz alta | `TrucoRoom.startAsk`, `answerAsk`, `botAnswer`, `botAsks` | costumbre de mesa |
| Si el que ganó el envido jugó sus 3 cartas a la vista, ya mostró: si no tenía lo que cantó, el envido es del otro equipo (no hay fase de mostrar) | `endHand`, `allShown` | |
| Los puntos se anotan al terminar la mano (envido primero, después truco) | `finishHand` | |

### Cartas quemadas (regla de la mesa)
El reglamento no trata las cartas quemadas; esta es la regla que pidió el dueño del juego y la que usa el motor
(`BURNED_VALUE`, `playValue`):

- Una carta **quemada vale como un 4** (la más baja) en la ronda en que cuenta. **No cambia el envido**: los
  tantos se calculan siempre con las 3 cartas repartidas.
- Se quema:
  1. la carta **tapada** (boca abajo; solo se puede desde segunda);
  2. la carta tirada **fuera de turno**: es tu jugada de esa ronda (cuando te toca, se te saltea). No se puede
     con un canto sin contestar ni si ya jugaste en la ronda;
  3. la carta **de arriba de dos encimadas**, salvo que la de abajo haya matado (ver abajo).

### Trampa: dos cartas encimadas
1. Tirás dos cartas juntas en tu turno (en primera o segunda). La **de abajo** es tu jugada de esta ronda y
   los rivales no la ven hasta el final de la mano.
2. La **de arriba** ya está en la mesa y no se puede levantar ([R] glosario: "una vez jugada no se puede
   retirar"): es tu jugada de la **ronda siguiente**. Cuando te toca, se juega sola.
   - Si **la de abajo mató** (ganaste vos la ronda, así que arrancás la siguiente), la de arriba **vale
     normal**: era tu turno de jugarla. Ej.: sos el último en primera, matás con la de abajo y ya dejás la
     de segunda arriba.
   - Si no, **se quema** (vale un 4): la tiraste antes de que te tocara. También si mató tu compañero o si
     fue parda, aunque seas mano.
3. Mientras dura la ronda en que la tiraste **parece una carta normal para todos, también para vos** (para que la trampa sirva) y queda
   casi alineada con la de abajo. **Al terminar esa ronda se ve quemada** (si se quemó), así en la siguiente
   los rivales se dan cuenta.
4. Cualquier rival puede pedir **"mostrá las dos"**: se levanta la de arriba y todos ven la de abajo. No hay
   puntos de por medio.

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
- Pedir flor al final de la mano (no hace falta: la flor es obligatoria y el juego la detecta sola). [R] §12.
- **Partidas de 3** (con gallo), de **8**, y **pica-pica** en 3 vs 3. [R] §3.
- **Chicos**: la partida termina al llegar a 15/30; no se juega "al mejor de dos chicos". [R] §2.
- Corte con mínimo de tres cartas por mitad, "golpear el mazo" sin cortar. [R] §17.
- Carta que cae boca arriba en el reparto (el que la recibe puede pedir nuevo reparto). [R] §17.
- Expresiones ambiguas ("quieto", "envido mi truco"…): el juego usa botones, no hay ambigüedad. [R] §16.
- Penalidades por hablar de más / señas indebidas en pica-pica.

### Flor (opción de la sala)
Tres del mismo palo (con muestra, las piezas sirven de cualquier palo). Obligatoria: en primera, antes de tirar
(o contestando envido/truco). Anula el envido. Sin flor rival: 3 por flor. Con flor rival: con flor quiero (gana la
mejor, 3), me achico (3 al que cantó), contraflor (6; no quiero = 3) y contraflor al resto (falta; no quiero = lo
anterior). No se puede mentir: el motor calcula los valores (`cards.js` `flor`, `engine.js` `actFlor`). [R] §12.

### Muestra (opción de la sala)
Después de repartir se da vuelta una carta. Piezas: 2, 4, 5, 11 y 10 de ese palo, por encima del ancho de espada;
si la muestra es pieza, el 12 toma su lugar. Envido: 20 + pieza (10, 9, 8, 7, 7) + la carta más alta de las otras;
con dos piezas, 20 + las dos. (`cards.js` `piezaOf`, `rank`, `tanto`). Fuente: pagat.com/put/truco_ur.html.

### No permitir trampas (opción de la sala)
Sin dos encimadas ni mentir en el envido (no hay fase de mostrar) y se ve quién ganó cada ronda.
