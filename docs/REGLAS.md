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
| Irse al mazo en equipo es un pedido (como rendirse): lo tienen que aceptar 2 de 2 (2 vs 2) o 2 de 3 (3 vs 3) de los que siguen en la mano; bots y ausentes cuentan como sí, y tocar "Irse al mazo" cuando ya lo pidió un compañero es decir que sí. Al equipo le llega "X quiere irse al mazo"; el pedido dura 15 s, es de esa mano (si la mano termina se cae) y si no sale hay que esperar 8 s para volver a pedirlo. Un bot no se lleva al mazo a un compañero persona conectado (juega otra cosa). En el duelo de pica-pica uno se va solo | `TrucoRoom.openVote` (`mazo`), `MAZO_NEED` | regla de la casa |
| Rendirse en equipo: lo tienen que aceptar 2 de 2 (2 vs 2) o 2 de 3 (3 vs 3); bots y ausentes cuentan como sí. El pedido dura 25 s y si no sale hay que esperar 1 min | `TrucoRoom.openVote` (`surrender`), `SURRENDER_NEED` | regla de la casa (como en otros juegos por equipos) |
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
| "Irse al mazo sin mostrar": no muestra (por ejemplo, porque mintió). Recién ahí (o cuando se le acaba el tiempo para mostrar) aparece "A ver esos tantos": los rivales tienen unos segundos (`TIMING.foldWindow`) para reclamar; si nadie reclama, los tantos valen | `actShow` (`nomostrar`), `TrucoRoom.onFold` | regla de la mesa |
| "En mesa": si el que ganó el envido ya tiró a la vista las cartas que forman lo que cantó, ya mostró (lo dice: "22 en mesa"). Al mostrar al final, las cartas de los tantos quedan boca arriba en la mesa | `enMesa`, `revealTanto` | |
| Consulta al compañero (en equipo): "¿tenés tantos?" / "¿le canto truco?", y la respuesta "Cantá", "Callado" (seguir sin cantarlo, que lo canten los otros; puede ser ir a la pesca) o "No tengo nada" (el que preguntó igual puede cantar si tiene). Una vez por mano cada cosa; se dice en voz alta | `TrucoRoom.startAsk`, `answerAsk`, `botAnswer`, `botAsks` | costumbre de mesa |
| "¿Queremos?" (en equipo, cuando te cantan truco, envido o flor): el que tiene que contestar le pregunta al compañero, una vez por canto. Contesta "No tengo nada", "Te hablan a vos", "Algo tengo" o "Estoy cargado". Los bots preguntan y contestan igual | `canAsk`, `botAnswer` |
| "¿Pongo o voy?" (en equipo, en primera): el que no es pie le pregunta al pie si "pone" (tira alta para ganar la ronda) o "va" (tira baja y mata el pie). Contesta solo el pie: "Poné" o "Vení". El bot pie dice "Vení" solo si le gana a lo que ya tiraron los rivales, y si lo dijo, mata él la primera | `TrucoRoom.canAsk` (`primera`), `answerers`, `botAnswer`, `saidVeni`, `chooseCard` | costumbre de mesa |
| Si el que ganó el envido jugó sus 3 cartas a la vista, ya mostró: si no tenía lo que cantó, el envido es del otro equipo (no hay fase de mostrar) | `endHand`, `allShown` | |
| Los puntos se anotan al terminar la mano (envido primero, después truco) | `finishHand` | |

### Cartas quemadas (regla de la mesa)
El reglamento no trata las cartas quemadas; esta es la regla que pidió el dueño del juego y la que usa el motor
(`BURNED_VALUE`, `playValue`):

- Una carta **quemada vale como un 4** (la más baja) en la ronda en que cuenta. **No cambia el envido**: los
  tantos se calculan siempre con las 3 cartas repartidas.
- Se quema:
  1. la carta **tapada** (boca abajo; solo se puede desde segunda);
  2. la carta tirada **fuera de turno** (solo en equipos: en 1 vs 1 hay que esperar al rival): es tu jugada de esa ronda (cuando te toca, se te saltea). No se puede
     con un canto sin contestar ni si ya jugaste en la ronda;
  3. la carta **de arriba de dos encimadas**, salvo que hayas matado vos con la de abajo (ver abajo).

### Trampa: dos cartas encimadas
1. Tirás dos cartas juntas en tu turno (en primera o segunda). La **de abajo** es tu jugada de esta ronda y
   los rivales no la ven hasta el final de la mano.
2. La **de arriba** ya está en la mesa y no se puede levantar ([R] glosario: "una vez jugada no se puede
   retirar"): es tu jugada de la **ronda siguiente**. Cuando te toca, se juega sola.
   - Si **mataste vos con la de abajo**, la de arriba **vale normal**: la ronda siguiente la empezás vos, así que cae
     en tu turno. Ej.: sos el último en primera, matás con la de abajo y ya dejás la de segunda arriba.
   - Si no, **se quema** (vale un 4): perdiste la ronda, fue parda o **mató tu compañero** (la siguiente la empieza él:
     la de arriba cayó fuera de tu turno), aunque seas mano.
3. Mientras dura la ronda en que la tiraste **parece una carta normal para todos, también para vos** (para que la trampa sirva) y queda
   casi alineada con la de abajo. **Al terminar esa ronda se ve quemada** (si se quemó), así en la siguiente
   los rivales se dan cuenta. Los eventos de la encimada (`double`, y la jugada automática `auto` con `burned`) se filtran igual en `viewFor`: los rivales no los reciben, y a quien la tiró le avisa "se jugó sola tu carta de arriba".
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
| Si ganaste el envido y te vas al mazo con "me voy y muestro", los tantos quedan mostrados (no hay que tocar "Mostrar") | `endHand` (engine.js) |
| En 3 vs 3 las señas se le hacen al pie: los bots pie no hacen señas y los demás miran a su pie para hacerlas | `TrucoRoom.botSenas` |
| Terminada la mano (por ejemplo, después de un no quiero), cualquiera puede mostrar las cartas que no tiró ("mostrá lo que tenías"). También al irse al mazo ("me voy y muestro"). No cambia ningún punto | `engine.js` `lucir`, `mazo {show}` |
| Si no estás (pestaña oculta o desconectado) y te toca cantar los tantos, a los 10 s se cantan solos: lo que tenés o "son buenas" | `TIMING.autoTanto`, `honestTanto` |
| La revancha arranca cuando la aceptan todos los de la mesa | `TrucoRoom.tryRematch` |
| Los personajes no parpadean solos: los ojos cerrados son únicamente la seña "ciego" | `characters.js` |
| En la charla de los bots, decir "truco" (en cualquier momento) o "envido" (si sos pie) en una frase es cantarlo, o subirlo: solo las frases de canto nombran el canto. Para hablar del tema dicen "el segundo" (truco) o "el primero", "los tantos" o "los puntos" (envido), y al no querer el envido no lo nombran | `talk.js` (`BOT_TALK`, `ASK_TALK`); test en `bots.test.js` |
| Invitado por un amigo a una mesa normal: no se sienta solo. Elige si va con el que lo invitó (su equipo) o con el otro equipo; si el lugar de su equipo está ocupado, solo le queda el otro. En partida rápida no cambia | `openSeat` (truco-room.js), `inviteChoiceHtml` (room-client.js); test en `mesas-en-juego.test.js` |

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

### Pica-pica (opción de la sala, solo 3 vs 3)
Desde que un equipo llega a 5 hasta que a alguno le faltan 5 o menos (a 30: hasta las 10 buenas; a 15: de 5 a 10)
se alterna una mano **redonda** y una de **pica-pica** (`PICA_PICA` en `config.js`, `picaDue` en `engine.js`).
- En la de pica-pica cada uno juega **mano a mano contra el de enfrente** (asiento + 3): tres duelos, uno detrás del
  otro (`picaDuel`, `h.duel`). Reparte el mismo en los tres; es mano el primero a su derecha, después el
  segundo, después el tercero. Los puntos de cada duelo son del equipo. Después viene una redonda y el mazo pasa.
- En el duelo se reparte solo a los dos; los demás miran (para el motor están "al mazo"). Cada uno canta su
  envido, el truco se canta desde primera (aunque la mesa juegue "truco desde segunda"), no se puede tirar fuera
  de turno y no hay consultas al compañero.
- La **falta envido** (y la contraflor al resto) vale **6** fija. [R] §3; fuente de la falta: laps4.com.

## Pendientes

- Corte con mínimo de tres cartas por mitad, "golpear el mazo" sin cortar. [R] §17.
- Carta que cae boca arriba en el reparto (el que la recibe puede pedir nuevo reparto). [R] §17.
- Penalidades por hablar de más / señas indebidas en pica-pica (el juego no deja consultar al compañero en el duelo).
- Pica-pica simultáneo: acá los tres duelos se juegan uno detrás del otro.
