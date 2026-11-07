# Cambios

## 1.10.2 — consultas que tienen sentido y chat más corto
- "¿Le canto truco?" solo aparece si tu equipo puede cantar o subir el truco en esa mano (no si lo tienen los
  rivales, ni si ya está en vale cuatro, ni en primera cuando se canta desde segunda) y todavía no tiraste en esa
  ronda. "¿Tienen tantos?" ya era solo para el pie.
- El chat de la derecha ya no ocupa todo el alto: como mucho 400 px.

## 1.10.1 — consulta sin trabas, tu mano no tapa tus cartas y tests de la sala
- **Arreglado**: si le consultabas al compañero bot justo cuando le tocaba, jugaba primero y te contestaba después.
  Ahora contesta y recién después juega.
- "¿Tienen tantos?" solo lo puede preguntar el que canta el envido del equipo (el pie), mientras todavía puede.
- **Tus cartas tiradas** quedan más hacia el centro y a la izquierda: la mano (que se dibuja encima de todo) ya no
  las tapa.
- **Tests de la sala**: `test/sala.test.js` corre la sala de punta a punta en Node con Cloudflare, Supabase y el reloj
  de mentira (`test/helpers/`): partidas 2v2 con bots hasta el final, consultas en los dos sentidos, señas,
  desconexión y vuelta, y que la partida no se trabe aunque los bots fallen.

## 1.10.0 — tienda y personalización
- **Tienda** (pestaña del menú): con las monedas que ganás jugando comprás ropa, gorro, anteojos, algo para tener
  delante en la mesa (mate, cafecito, porrón, fernet), paños y dorsos de mazo. Nada se compra con plata. El precio
  lo pone el servidor y la compra es una transacción (`buy_item`).
- **Personalizar**: elegís lo que tenés puesto, con una vista previa. Los demás lo ven en la partida: tu personaje
  vestido y lo tuyo sobre el paño; el paño y el mazo, en las mesas donde sos anfitrión.

## 1.9.0 — historial, rebobinado, ELO y análisis
- **Todas las partidas quedan en el historial** (pestaña Historial): resultado, rivales, ELO y monedas. La sala
  graba el estado al repartir cada mano y cada jugada (`src/recorder.js`); al terminar va a Supabase en una sola
  transacción (`record_match`).
- **Rebobinar** (`/partida/ID`, solo para los que jugaron): mano por mano y paso por paso (◀ ▶, flechas del
  teclado), con las cartas de todos, lo que se jugó en cada ronda, los cantos y el tanteador.
- **Análisis** al estilo ajedrez: "Analizar mis jugadas" evalúa cada decisión tuya con lo que veías en ese momento
  (la misma evaluación de los bots, sin faroles ni ruido) y la califica: la mejor, buena, imprecisión, error o
  error grave, con lo que convenía y cuánto perdiste. Precisión de la partida y "tu jugada más cara". Corre en
  un Web Worker.
- **ELO por modo**: solo entre personas (sin bots). En equipo se usa el promedio de cada equipo; las primeras 10
  partidas mueven más. Al terminar, el cartel muestra cuánto ELO y cuántas monedas ganaste.
- **Monedas**: 10 por partida terminada y 10 más si ganás (la mitad contra bots).

## 1.8.5 — "No tengo nada"
- A la consulta del compañero también se puede contestar **No tengo nada**, que no es lo mismo que "Callado". Si un
  bot pregunta y le dicen "no tengo nada", lo toma en cuenta pero decide él: si tiene, canta igual. Los bots con
  poco contestan casi siempre "no tengo nada" (a veces solo "callado").

## 1.8.4 — consultarle al compañero
- En equipo, botones **¿Tienen tantos?** y **¿Le canto truco?**: tu compañero te contesta **Cantá** o **Callado**
  (seguir jugando sin cantarlo, que lo canten los otros: a veces va a la pesca). Si te consultan a vos, aparecen los
  botones para contestar. Se dice en voz alta, con globo, y los rivales lo escuchan.
- Los bots también consultan: el pie bot te pregunta por los tantos o el truco antes de decidir, espera tu respuesta
  (hasta 7 s) y la usa: "Cantá" cuenta como que tenés; "Callado" hace que no lo cante él. Entre bots también se
  consultan, menos seguido. Un bot con muchísimo a veces contesta "callado" para ir a la pesca.

## 1.8.3 — bots con memoria y a prueba de fallas
- **Memoria de situaciones**: los bots guardan lo que calcularon en cada situación (por el valor de las cartas: dos
  cuatros juegan igual). Cuando vuelven a una, suman a lo que ya sabían y, después de juntar 160 manos imaginadas,
  deciden directo sin simular. Se comparte entre salas y se guarda en el Lobby. En 3.000 partidas de prueba, el 44%
  de las decisiones ya salían de memoria, con la mitad del tiempo y la misma fuerza (gana el 50% contra el bot sin
  memoria).
- **No se traba en producción**: si un bot falla o elige una jugada inválida, juega una de respaldo; si falla la
  alarma de la sala, se registra y se vuelve a programar. Medido: una decisión tarda 1 a 3 ms (13 ms en el peor
  caso con el servidor recién arrancado).
- **Tus dos encimadas**: en tu pantalla la carta de arriba queda corrida, así ves que abajo hay otra. Los demás
  las siguen viendo alineadas.

## 1.8.2 — frases de los bots que tienen sentido
- "Primera para nosotros" (y "segunda", "tercera") solo en la ronda que nombra; antes salía al ganar cualquier ronda.
- Cuando un rival tira una carta brava, la frase nombra esa carta ("Uh, el siete bravo") o es genérica; antes decía
  "sacó el ancho" aunque fuera un 7.
- "¡Eso es truco!" solo si la mano se jugó por truco; "compañero" solo en equipo; "Parda, esto se pone bueno" no
  en tercera (ya terminó).

## 1.8.1 — "30 en mesa" y bots que leen las señas
- **Mostrar los tantos**: el que muestra dice "30 en mesa" (globo y voz) y tira a la mesa, boca arriba, las cartas
  de sus tantos que le quedaban en la mano (las tapadas se dan vuelta). Ya no aparece el cartelito con las cartas.
  Si no tenía lo que cantó, un rival le dice "¡Cantaste 33!" y el envido va para el otro equipo.
- **En mesa durante la mano**: si el que ganó el envido ya tiró a la vista las cartas de sus tantos, lo dice en ese
  momento ("22 en mesa") y después no tiene que mostrar.
- **No mostraste**: el rival que reclama dice "¡No mostraste!" en vez del cartelito.
- **Los bots leen las señas**: las de su compañero siempre y las de un rival si justo lo estaban mirando. Con eso
  imaginan mejor las manos (si te guiñó, tenés el ancho de basto; "30 o más" pesa los tantos) y deciden qué cantar,
  querer y tirar con lo que tiene el equipo.

## 1.8.0 — cuentas y menú nuevo
- **Sin cuenta no se juega.** Se entra con Google o con mail y contraseña (Supabase Auth). La primera vez se elige
  el nombre, que es único y es el que aparece en la mesa y en el ranking. Si te pasan `/sala/CÓDIGO` sin sesión,
  entrás y volvés a esa sala.
- El servidor ya no cree en el `pid` ni el nombre que manda el navegador: los saca del token de la sesión
  (`src/auth.js`) al crear salas, en la partida rápida y al entrar por WebSocket (`join {token}`).
- **Menú con pestañas**: Jugar, Mesas (todas las públicas), Historial, Tienda y Personalizar (estas tres,
  próximamente) y Perfil (ELO de cada modo, cerrar sesión). Arriba, tu usuario y tus monedas.
- Base de datos en Supabase: tabla `profiles` (nombre, monedas, ELO y partidas por modo). Ver `docs/CUENTAS.md`.

## 1.7.5 — tantos en equipo, tantos a la vista y desconexiones
- **Arreglado**: en equipo, al que le tocaba cantar los tantos cuando su equipo ya iba ganando se lo salteaba y, si
  después el rival cantaba más, no le volvía a tocar (un bot con 33 perdió contra 32). Ahora le vuelve a tocar.
- **Tantos a la vista**: si el que ganó el envido jugó sus 3 cartas a la vista, ya mostró. Si no tenía lo que
  cantó, los puntos del envido van para el otro equipo (antes podía irse sin mostrar aunque se vieran).
- **Desconexiones**: el cartel del que se cortó dice "desconectado · bot en 32 s" y después "juega el bot". En
  el chat se avisa cuando se desconecta, cuando empieza a jugar el bot en su lugar y cuando vuelve.

## 1.7.4 — dos encimadas: aviso de qué jugaste
- Al cerrarse la ronda en que tiraste dos encimadas, te avisa (solo a vos) con qué carta jugaste de verdad: en la
  mesa la de arriba tapa a la de abajo y parecía que habías jugado esa. Si mataste: "Mataste primera con el 3
  de espada (el de abajo). Arrancás segunda y el 12 de copa de arriba juega solo y vale." Si no, que se quema.

## 1.7.3 — tantos más claros y ayuda que se cierra abajo
- **Tus tantos**: tres botones claros: **Cantar mis N**, **Son buenas** y **Cantar otro número**. Recién al tocar
  el último te pregunta cuánto, con − / + (salta los números que no existen en el envido y arranca en el mínimo
  para ganar) y **Volver**. El estado dice "Cantaron 25 y vos tenés 27".
- El globo del canto ("¡Envido!") sale siempre, aunque el bot lo diga con una frase: con la voz apagada igual
  sabés qué cantaron. Lo que no se repite es la voz.
- La ayuda (?) tiene un botón **Entendido** al final para cerrarla sin volver arriba.

## 1.7.2 — tu altura y el nombre de las cartas
- **Tu cámara a la altura de los demás**: los ojos estaban a 1,24 m y los de los personajes a ~1,47 m (te sentías
  enano). Ahora `EYE_Y` es 1,46 y la vista arranca un poco más inclinada hacia la mesa.
- **Pasá el mouse por una carta de la mesa** y aparece su nombre ("6 de espada", "ancho de basto · quemada"). En
  el celular, tocala.

## 1.7.1 — ritmo de los bots
- Los bots **esperan a que se termine de decir** el último canto o frase antes de jugar, piensan más (1,3 a 2,3 s)
  y hacen una pausa al cerrarse cada ronda o el envido (`TIMING.roundPause`). La pausa entre manos es más larga.
- Cuando jugás vos, se corta lo que se estaba diciendo y lo tuyo se dice al instante (antes esperaba en la cola).

## 1.7.0 — bots que aprenden, farolean y hacen trampa
- **Bots mucho más difíciles**: cada decisión sale de imaginar muchos repartos posibles de las cartas que no ven
  (Monte Carlo) y jugarlos hasta el final. Eligen qué carta tirar, cuándo cantar y cuándo querer según los puntos
  que esperan ganar, medidos por cuánto cambia la chance de ganar la partida.
- **Aprenden de cada persona**: después de cada mano se entrena un modelo (regresiones logísticas en `brain.js`)
  con lo que hizo cada uno y las cartas que tenía de verdad: cuándo canta truco o envido, cuándo quiere, cuánto
  miente y cuánto reclama. Se guarda en el Lobby por jugador, más uno global para los que no conoce.
- **Farolean** cuando el modelo dice que el rival se va a achicar, y desconfían de los que farolean seguido.
- **Trampas** (solo en mesas que las permiten): a veces espían las cartas de los rivales, el que reparte se acomoda
  una carta buena, mienten en el envido y se van sin mostrar, y tiran dos encimadas. Hacen más trampa si van
  perdiendo por mucho. Le reclaman más a quien suele mentir.
- **Hablan en el chat** con frases de mesa ("Truco, y no me hagas perder tiempo", "Me mataste", "¿Y si te digo
  que no tenía nada?") según la chance de ganar que calcularon, sin delatarse.
- **Charlan mucho más**: más de 200 frases de mesa (`talk.js`). Chicanean cuando cantás, festejan el macho y el
  siete bravo, se burlan si te vas al mazo o no querés, te apuran si tardás, felicitan o retan al compañero, y
  a veces se contestan entre ellos. Farolean más seguido (`BOT.aggro`).
- **Charla en orden**: cuando un bot canta o contesta con una frase, la frase dice el canto de verdad ("Sin miedo al
  éxito: retruco") y reemplaza al "¡Retruco!" de siempre, así no se repite. Las reacciones de los demás salen un
  momento después de lo que las provocó, para que se lea como una conversación.
- **La charla se calla si la mesa sigue**: si jugás, cantás o alguien tira una carta antes de que un bot diga su
  frase, la frase ya no se dice (y la que estaba diciendo se corta). Los cantos se dicen siempre y antes que la
  charla. Una frase que no llegó a decirse en 4 s se descarta (`hush` y la cola de `say` en audio.js).
- **Los mensajes del chat se dicen en voz alta** (con la voz activada) y salen en un globo arriba del que lo
  escribió, bots incluidos. Cada asiento tiene su tono de voz, también en los cantos.
- El botón para irse sin mostrar los tantos ahora dice solo **Irme al mazo** (y a los rivales no se les avisa que
  no mostró): se tienen que dar cuenta solos. "Mostrar mis cartas" e "Irme al mazo" tienen el mismo color.
- **El compañero bot contesta los cantos** por el equipo si no contestás en unos segundos.
- **Dos encimadas que matan**: si la de abajo gana la ronda, la de arriba **no se quema**: vale normal, porque
  arrancás vos la siguiente. Si no mata (perdés, mata tu compañero o es parda, aunque seas mano), se quema.
  Los bots también lo usan cuando juegan últimos y matan.
- Contra los bots de antes, en 1 vs 1: 50 % sin aprender, ~62 % aprendiendo, ~77 % con trampas.
- Tests nuevos en `test/bots.test.js`.


## 1.6.0 — menú y sala de espera nuevos
- **Menú de inicio** en una sola tarjeta y sin scroll: tu nombre con tu inicial, **Armar una mesa** (las reglas se
  eligen adentro), código de 4 números para entrar, y filas iguales de **Partida rápida** y **Practicar** por modo.
  Las mesas públicas aparecen solo si hay, y nada más las que entran en pantalla.
- **Sala de espera** rediseñada: el código bien grande (se copia con un toque), equipos con avatares, botón
  **Salir**, y las reglas (modo, puntos, pública/privada, flor, muestra, trampas, truco desde segunda) detrás de
  **Reglas**. Un solo botón de empezar ("Empezar con N bots"). Entra en pantalla sin scroll, también en celular.
- El anfitrión **arrastra** jugadores y bots a otro lugar para cambiarlos de equipo (mensaje `move {from, to}`).
- **Códigos de sala de 4 números**. Una sala vacía e inactiva hace 3 h (`ROOM_REUSE_MS`) libera su código.
- Se sacó WhatsApp de la sala (queda Compartir / Copiar enlace).
- **Seña del tres** animada: el labio entra y sale de los dientes (`SENA_BITE_MS`), en la mesa y en el espejo.
- El consejo del zoom aparece al empezar la partida, no en la sala de espera.
- Limpieza: `modeLabel` e `initial` compartidos, copiar al portapapeles avisa si falla, arrastre en su propia
  función, y se podaron estilos y exports sin uso.


## 1.5.3 — el pie en "Mirar a"
- En 2 vs 2 y 3 vs 3, la lista "Mirar a" marca quién es **pie** en cada mano (se actualiza sola).
- Arreglado: al empezar llenando con bots podían salir dos bots con el mismo nombre.


## 1.5.2 — señas del dos y del ancho falso
- **Dos**: ahora es un beso evidente (labios grandes, rojos y hacia adelante, con arrugas alrededor), dibujado
  por encima del bigote para que se vea siempre.
- **Ancho falso**: boca abierta (antes, la punta de la lengua), como dice el reglamento ("abrir un poco la
  boca").
- Colores de la boca en `theme.js` (`FACE`).


## 1.5.1 — ahora se llama Trukeados
- Nueva marca **Trukeados**: título, encabezado, descripción, paño de la mesa, compartir, `package.json` y
  `wrangler.jsonc`. El nombre del JS está en un solo lugar: `APP_NAME` en `config.js`.
- Se sacó "Sin flor." de la descripción (la flor ahora es una opción de la sala).


## 1.5.0 — flor, muestra y mesa sin trampas
- Opciones de sala nuevas (lista única en `config.js` `ROOM_OPTIONS`): **flor**, **muestra** y **no permitir
  trampas** (reemplaza "mostrar quién ganó cada ronda"). Reglas en `docs/REGLAS.md`.
- `cards.js`: valor de las cartas (jerarquía, envido, flor, muestra) separado del motor.
- Bots que cantan y contestan flor y entienden la muestra. Tests nuevos en `test/opciones.test.js`.
- Probado en el navegador: cantar y contestar flor (también en celular), muestra en mesa y anotador, mesa sin
  trampas. Arreglado: el estado decía "Tocá una carta" cuando había que cantar la flor.


## 1.4.1 — reparto sincronizado y quemada a destiempo
- **"Esperá que terminen de repartir" en primera**: en la primera mano de una sala el cliente no animaba el
  reparto y dejaba tirar mientras el servidor seguía repartiendo; la jugada se rechazaba y la carta volvía a la
  mano (también pasaba con la carta quemada fuera de turno). Ahora el servidor manda `dealLeft` (ms de reparto
  que faltan) y el cliente no muestra botones hasta que terminan la animación y el reparto del servidor.
- **Dos encimadas**: la de arriba se ve quemada recién al pasar a la ronda siguiente, para todos (antes el
  que la tiraba la veía quemada en el momento).
- Test nuevo: fuera de turno en 2 vs 2 (se saltea el turno y la carta no vuelve a la mano).


## 1.4.0 — irse sin mostrar y campo de visión más amplio
- **Irse al mazo sin mostrar** los tantos (para hacerse el boludo o tapar que mentiste): los rivales tienen
  6 s para reclamar (`TIMING.foldWindow`); si nadie reclama, los puntos valen. Los bots rivales pueden reclamar.
- **Mostrar después de irse al mazo**: antes, si ganabas el envido y te ibas al mazo en el truco, no aparecía
  el botón para mostrar. Ahora sí.
- Mentir y mostrar sigue costando el envido aunque tengas más que el rival (test nuevo).
- **Campo de visión** 70° (antes 62°; 84° en vertical): se ve más mesa. La mano se acerca lo justo para
  verse del mismo tamaño (`FOV` y `HAND_DESIGN_FOV` en `scene.js`).


## 1.3.0 — cartas quemadas, panel sin scroll y mesa legible
- **Cartas quemadas** (regla de la mesa): valen como un 4 en la ronda en que cuentan; el envido no cambia.
  Se quema la tapada, la que tirás **fuera de turno** (se puede: es tu jugada de esa ronda) y la de arriba de
  dos encimadas.
- **Dos encimadas**: la de arriba es tu jugada quemada de la ronda siguiente (se juega sola). Durante la
  ronda parece una carta normal y queda casi alineada; al terminar la ronda se ve quemada y aparece el aviso
  para pedir "mostrá las dos". Ya no se avisa a todos en el momento.
- **Panel sin scroll**: grilla fija (cantos 2×2, carta elegida en una fila de 3); en celular todo en una
  grilla de 4 columnas. "Mirar a" ya no scrollea: en pantallas angostas se esconde. Los avisos repetidos no
  se apilan.
- **Mesa legible**: menos luz de la lámpara y exposición más baja (`LIGHT` en `theme.js`) y cartas de la
  mesa 30 % más grandes.
- Tests: quemada = 4, fuera de turno, tapada, dos encimadas en dos rondas, quién empieza cada ronda en
  2 vs 2 / 3 vs 3, y que ganar primera y perder segunda lleva a tercera (reglamento).


## 1.2.0 — interfaz despejada, respuesta inmediata y movimiento suave
- **Botones sin amontonarse**: las acciones pasaron a un panel abajo a la derecha (con el estado como
  título) y se acomodan en una grilla; el centro de abajo queda libre para tu mano. "Mirar a" pasó a una fila
  arriba al centro y el anotador arriba a la izquierda (más compacto). En celular el panel va abajo a todo el
  ancho, con filas de botones deslizables, y la mano sube sola lo justo para no quedar tapada
  (`scene.setBottomInset`). Probado sin solapamientos en 1280×720, 1038×515, 768×1024 y 375×812.
- **Sin delay**: al tirar una carta o cantar, la carta vuela y el globo aparece al instante
  (`RoomClient.predict`); el estado del servidor después lo confirma o lo corrige. Tocar de nuevo la carta
  elegida la tira. Los botones solo se rehacen si cambian (antes se recreaban en cada actualización y un
  clic podía perderse).
- **Movimiento suave**: la cámara sigue un objetivo con amortiguación independiente de los FPS (arrastrar,
  teclado, rueda y "mirar a"), las cabezas de los personajes giran con la misma técnica, y las cartas se tiran
  y se reparten con curvas que arrancan rápido y se asientan.
- Ritmo: los bots piensan 0,65–1,3 s (antes 0,9–1,8 s) y la pausa entre manos bajó de 5,2 a 4,2 s.


## 1.1.0 — tipografía y paleta
- Tipografía única: **Archivo** (Omnibus-Type, Buenos Aires; Google Fonts, OFL), variable en peso y ancho.
  Ancho normal para textos y botones; angosta (`font-stretch: var(--narrow)`) para rótulos. Se sacaron
  Barlow, Barlow Condensed y Alegreya (y todas las itálicas). En canvas se usa `FONT` de `theme.js`.
- Paleta básica: grises neutros + los cuatro palos de la baraja (`--blue` espada, `--green` basto,
  `--yellow` oro, `--red` copa). El amarillo es el único acento. Se sacaron el marfil, el latón y los marrones
  de la interfaz. Variables renombradas: `--bg`, `--surface`, `--line`, `--text`, `--accent`…
- `theme.js`: `FONT` y `SUIT_COLORS`; anotador y textos del paño en blanco neutro.

## 1.0.0 — separado de Cadalado.com

Traído desde la rama `truco` de `Arkhram-Organization/Cadalado.com` (solo el truco, sin el ajedrez).

### Arreglos
- **Botones más grandes**: tamaños nuevos en variables de `:root` (`--btn-font`, `--btn-pad`, `--btn-min-h`,
  `--btn-call-font`); también menús, selector de mirada, frases del chat y versión móvil.
- **Mazo partido después de cortar**: al terminar la animación del corte las dos mitades del modelo 3D
  quedaban desplazadas (el último cuadro de la animación no las volvía a su lugar). Ahora `resetDeck()` las
  deja alineadas al terminar cada etapa y al ubicar el mazo.
- **Parpadeo automático eliminado**: los personajes ya no cierran los ojos solos; los ojos cerrados son
  únicamente la seña "ciego".
- **"No te toca" cuando sí te tocaba**: un doble clic (o un clic con el estado viejo) mandaba la respuesta dos
  veces; la segunda daba error. Ahora los botones se bloquean hasta que llega el estado nuevo, y si un canto ya
  se contestó el mensaje es "Ya se contestó".
- **Cantar fuera de turno**: el que tenía el quiero podía cantar retruco aunque no fuera su turno, y el pie
  podía cantar envido antes de que le tocara. Según el reglamento se canta "en su turno": ahora el motor solo
  permite abrir truco/envido en tu turno (contestar sigue siendo inmediato).
- **Dos cartas encimadas**: la carta de arriba queda **quemada** (no juega ninguna ronda) y se ve claramente
  quemada en la mesa. Antes se jugaba sola en la ronda siguiente. Ver `docs/REGLAS.md`.
- El reparto ya no se queda trabado si la pestaña estuvo oculta.

### Refactor
- Todo en la raíz: `/` es el menú y `/sala/CÓDIGO` la partida (antes `/truco/...`).
- `public/js/config.js`: constantes compartidas servidor/cliente (modos, tiempos, rutas, señas, bots). El
  tiempo de reparto del servidor y la animación del cliente salen de los mismos números.
- `public/js/theme.js`: colores de la escena 3D, cartas, anotador y paletas de personajes; `mix()` e `INK`
  compartidos (antes duplicados en `characters.js` y `hands.js`).
- `truco.css`: colores sueltos pasados a variables.
- `main.js` (1160 líneas) partido en `dom.js`, `audio.js`, `hud.js`, `menu.js`, `room-client.js` y `main.js`.
- Código muerto eliminado: `h.pre`, `h.stacked`, `h.falseAccuse`, `autoPre`, `cheater`, `onReorder`,
  `choosingTopId`, parpadeo, `isHumanSeated`, función `isAway` duplicada, nombres de truco repetidos.
- Lobby y Worker solo con las rutas del truco (`/api/rooms`, `/api/quick`, `/api/lobby`).
- Tests nuevos: cantar fuera de turno, doble respuesta, carta quemada y jugar sin cartas.
