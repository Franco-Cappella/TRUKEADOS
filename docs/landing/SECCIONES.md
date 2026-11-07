# Landing de Trukeados — catálogo de secciones

Todas las secciones que se podrían hacer, con qué skill del hub `design-studio` se arma cada una y qué
activos del juego se reutilizan. No es la landing final: es el menú del que se elige.
El plan de trabajo y las decisiones están en [PLAN.md](PLAN.md); lo que hace el juego, en
[../JUEGO.md](../JUEGO.md).

**Leyenda**
- **Prioridad**: 🟢 núcleo (sin esto no hay landing) · 🟡 recomendada · ⚪ extra.
- **Esfuerzo**: S (horas) · M (1–2 días) · L (3+ días).
- **Skills**: el orden importa (la primera manda). Todas cierran con `impeccable` (audit).
- ⚠️ = necesita tocar el juego o el servidor, no solo la landing.

---

## Idea fuerza (el hilo de toda la página)

> **"Te están mirando."**

El diferencial real del juego es que las señas se hacen con la cara y solo las ve quien te mira en ese
momento. La landing se puede contar entera desde ahí: vos llegás a un bar, te sentás, alguien te
guiña un ojo, ¿lo viste? La mirada es la mecánica, la narrativa y el recurso visual (ojos, cabezas que
giran, la cámara que va de un personaje a otro).

Alternativas de hilo, por si no convence:
- **"Sentate"**: la página es el camino desde la puerta del bar hasta tu silla.
- **"Una mano"**: la página entera es una mano de truco, del reparto al "quiero vale cuatro".
- **"Truco de verdad"**: lo tradicional (palitos, voz, señas, trampa) contra los truco de app genéricos.

---

## 0. Barra superior 🟢 · S
- Logo (wordmark "Trukeados"), anclas *Cómo se juega · Señas · Mesas en vivo*, CTA **Jugar** siempre visible.
- Detalle: el CTA pasa a amarillo oro (`--accent`) cuando el hero sale de pantalla.
- **Skills**: `design-taste-frontend` → `emil-design-eng` (transición del CTA).

## 1. Hero 🟢 · M–L
Tres direcciones posibles (elegir una):

**1A. "Sentate" — la escena viva.** El bar real del juego (`TableScene`) de fondo, la cámara gira lenta
por la mesa y frena en un personaje que te guiña el ojo. Título enorme, CTA **Jugar ahora** +
secundario **Practicar con bots**. Póster estático primero (LCP) y la escena carga después.
- Activos: `scene.js`, `characters.js`, cartas. **Skills**: `web-inmersiva` → `design-taste-frontend`.

**1B. "Te están mirando" — una cara gigante.** Un solo personaje en primer plano, recortado, mirando a
la cámara. Cada 3 s hace una seña distinta y aparece abajo, chico, qué significa
("Levantó las cejas: ancho de espada"). El cursor mueve hacia dónde mira.
- Activos: `drawCharacter`, `SENAS`. **Skills**: `design-taste-frontend` → `emil-design-eng`.

**1C. "Los cuatro machos" — el abanico.** Ancho de espada, ancho de basto, 7 de espada y 7 de oro en
abanico. Al hacer scroll se abren, giran y se apoyan en el paño; aparece el título.
- Activos: cartas WebP. **Skills**: `web-inmersiva` (o GSAP solo) → `emil-design-eng`.

Copy de ejemplo: **"Truco con señas de verdad."** / *"En 3D, online y gratis. Sin cuenta, sin instalar.
Sentate y jugá."*

## 2. "Te están mirando" — la mecánica de las señas 🟢 · L
La sección estrella. Scroll con la vista fija (*sticky*) en tres actos:
1. Vos mirás a tu compañero: te hace una seña (guiño → ancho de basto). La ves.
2. La cámara gira al rival: él estaba mirando a tu compañero. **También la vio.**
3. Texto: *"El servidor solo le manda tu seña a quien te está mirando. Si te cazan, te cazaron."*
- Diagrama opcional de miradas (flechas entre asientos vistas desde arriba).
- **Skills**: `web-inmersiva` → `imagegen-frontend-web` (referencia previa) → `impeccable`.

## 3. Diccionario de señas (interactivo) 🟢 · M
Grilla de las 11 señas. Cada tarjeta: la cara en reposo; al pasar el mouse o tocar, el personaje hace
el gesto y se da vuelta la carta que representa. En celular, deslizable.
- Variante juego: **"¿Qué te dijo?"**: aparece una cara haciendo una seña y elegís entre 3 cartas.
  Cinco aciertos → "Ya estás para la mesa" + CTA. Muy compartible.
- Activos: `drawFace` (`hud.js`), `SENAS` (`config.js`), cartas.
- **Skills**: `ui-ux-pro-max` (componente) → `emil-design-eng` (flip, timing) → `impeccable`.

## 4. La trampa: dos encimadas 🟡 · M
Una carta cae sobre otra en el paño. La de arriba se oscurece y se le carbonizan los bordes (la textura
real `burnTex`). Botón rojo copa **"¡Mostrá las dos!"** → se levanta la quemada y aparece la de abajo.
Copy: *"Acá se puede hacer trampa. Y te pueden cazar."*
- Activos: `burnTex`, `CARD` de `theme.js`, cartas. **Skills**: `emil-design-eng` → `web-inmersiva`.

## 5. Mentir el envido — calculadora de tantos 🟡 · M
Elegís 3 cartas de un mazo en pantalla → se calcula el tanto con el motor real (`tanto()` de
`engine.js`). Después: *"¿Cantás 33?"* — y te muestra qué pasa si mentís y te piden mostrar.
Enseña la regla jugando y muestra que el motor es serio.
- Activos: `engine.js` (`tanto`, `rank`), cartas. **Skills**: `ui-ux-pro-max` → `emil-design-eng`.

## 6. Jerarquía de cartas 🟡 · S–M
Las 14 escalas de la jerarquía, de ancho de espada al 4, como una escalera de cartas. Variante
interactiva **"¿Quién gana?"**: dos cartas al azar, tocás la que gana, y se explica. Ideal para quien
juega poco.
- Activos: `rank()`, cartas. **Skills**: `design-taste-frontend` → `emil-design-eng`.

## 7. Una mano completa (scroll narrativo) ⚪ · L
La página "juega" una mano mientras bajás: mezcla, corte, reparto, "¡Envido!", "¡Quiero!", tantos,
"¡Truco!", "¡Quiero retruco!", la última carta, los palitos que se suman. Cada paso, una línea de texto
y un globo de canto (con la voz del juego si el sonido está activado).
- Es la versión más ambiciosa; puede reemplazar a las secciones 4–6 si se hace.
- Activos: `dealAnim`, `TIMING`, `say()`, `palitos()`. **Skills**: `web-inmersiva` → `emil-design-eng`.

## 8. Modos: 1 vs 1, 2 vs 2, 3 vs 3 🟢 · S
Tres mesas vistas desde arriba (diagramas limpios, asientos alternados por color de equipo), con el
**pie** marcado en las de equipo y una línea por modo ("mano a mano", "con compañero", "pica… no, eso
todavía no"). Toque el modo y queda elegido para el CTA.
- **Skills**: `design-taste-frontend` → `ui-ux-pro-max`.

## 9. Mesas en vivo 🟡 · M
Datos reales de `GET /api/lobby`: *"Ahora: 3 mesas esperando gente y 5 jugándose."* Tarjetas con
modo, puntos, jugadores y tanteador ("Van 12 a 9") con botones **Sentarme** / **Mirar**.
Si no hay nadie: *"No hay mesas abiertas. Abrí la primera"* (nunca mostrar un cero triste sin salida).
- Se refresca cada 10–15 s solo si la sección está en pantalla.
- **Skills**: `ui-ux-pro-max` → `impeccable` (estados vacíos y de error).

## 10. "Escribí tu nombre y mirá tu cara" 🟡 · S–M
`lookFor(nombre, asiento)` genera siempre la misma cara para el mismo nombre. Un campo de texto → tu
personaje aparece y te saluda (o hace una seña al azar). Botón "Así me ven en la mesa → Jugar". El nombre
se guarda con la misma clave que usa el menú, así llegás al juego con el nombre puesto.
Gancho viral barato: "mirá qué cara me tocó".
- Activos: `characters.js`, `dom.js` (`store`, `KEYS`). **Skills**: `emil-design-eng` → `ui-ux-pro-max`.

## 11. Los del barrio (bots) ⚪ · S
Retratos de los bots (Tito, Coca, El Ruso, Chacho, Pocha, Beto, Nené, Cacho, Mirta, Pirulo, Tota, Rulo)
generados con el mismo dibujante. Copy honesto sobre cómo juegan: *"Farolean de vez en cuando. Alguno
hasta te tira dos encimadas. Y si no mostrás los tantos, te reclaman."*
Ojo: no inventar personalidades distintas que el juego no tiene, o hacerlo explícitamente como chiste.
- **Skills**: `design-taste-frontend`.

## 12. Cómo arrancar en 3 pasos 🟢 · S
1. Poné tu nombre. 2. Mandá el link por WhatsApp (o partida rápida). 3. A jugar.
Con mini capturas reales. Opcional: botón "Compartir por WhatsApp" directo.
- **Skills**: `design-taste-frontend` → `impeccable` (claridad).

## 13. Reglas en corto + glosario rioplatense 🟡 · S
Acordeones: truco/retruco/vale cuatro, envido/real/falta, pardas, al mazo, tapada. Glosario con
humor: *parda, pie, mano, son buenas, las viejas (27), las perdedoras (29), irse al mazo, ciego*.
Link a las reglas completas. La flor, la muestra y la mesa sin trampas, como opciones de la sala.
- **Skills**: `ui-ux-pro-max` → `impeccable` (lectura, accesibilidad del acordeón).

## 14. El anotador como hilo ⚪ · S
El anotador de palitos (`palitos()`) como indicador de avance de la página: cada sección suma un
palito; al final, el quinto cruza el cuadrado. Detalle que nadie pide y todos recuerdan.
- **Skills**: `emil-design-eng`.

## 15. Sonido (opcional, apagado por defecto) ⚪ · S
Interruptor "Con sonido": la carta suena al caer en el paño y la voz canta "¡Truco!" en el hero o en la
sección 7. Respeta que el navegador exige un gesto antes de sonar.
- Activos: `audio.js` (`flick`, `say`). **Skills**: `emil-design-eng`.

## 16. Funciona en el celular 🟡 · S
Teléfono con una captura (o video corto) de la partida en 375×812: panel a todo el ancho, la mano
arriba. *"En el bondi también."*
- **Skills**: `imagegen-frontend-web` (mockup de referencia) → `design-taste-frontend`.

## 17. Lo que tiene / lo que no 🟡 · S
Tabla honesta: ✅ 3D, señas, trampa, voz, salas privadas, espectador, bots, flor y muestra (opcionales) ·
❌ cuenta, descargas.
- **Skills**: `design-taste-frontend`.

## 18. Preguntas frecuentes 🟢 · S
¿Es gratis? ¿Necesito cuenta? ¿Tiene flor? ¿Anda en el celu? ¿Qué pasa si se me corta internet?
(40 s y juega un bot por vos) ¿Puedo mirar sin jugar? ¿Se puede hacer trampa? (sí, una, y te pueden cazar; la sala puede no permitirla)
- **Skills**: `ui-ux-pro-max` → `impeccable`.

## 19. CTA final 🟢 · S–M
La mesa vista desde tu silla, vacía, la lámpara encendida. **"La mesa está servida."**
Botones: **Partida rápida** (1v1 / 2v2 / 3v3) · **Crear sala** · **Practicar con bots**. Directo al
juego, sin pasos intermedios.
- **Skills**: `design-taste-frontend` → `emil-design-eng`.

## 20. Pie y créditos 🟢 · S
Créditos obligatorios: cartas "Naipes Libres" (Basquetteur, CC BY-SA 3.0, vectorizadas por gjenkins20),
Three.js (MIT), Archivo (Omnibus-Type, OFL). Link al repositorio si es público. Hecho en Argentina.

---

## Fuera de la página (pero del mismo lanzamiento)

| Idea | Prioridad | Skills / herramientas |
|---|---|---|
| **Logo y brand board** (no existe; hoy solo hay favicon) | 🟢 | `brandkit` |
| **Imagen para compartir (OG)** general y una por seña (para que el link en WhatsApp se vea bien) | 🟢 | `brandkit` / `imagegen-frontend-web`; Canva (conector) para variantes |
| **Página 404 "Me fui al mazo"** | ⚪ | `design-taste-frontend` |
| **Kit de prensa** (logo, capturas, descripción corta) | ⚪ | `brandkit` |
| **Tráiler de 15–30 s** para redes (grabado del juego) | ⚪ | Canva (conector, video) |
| **Página de reglas completa** linda (hoy es un .md) | 🟡 | `ui-ux-pro-max` → `impeccable` |
| **Novedades** a partir de `CHANGELOG.md` | ⚪ | `documentation-and-adrs` |

## Ideas que necesitan tocar el juego ⚠️

Quedan anotadas, no entran en la landing sin una decisión aparte.
- **Contador de partidas jugadas** ("ya se jugaron 12.430 manos"): el servidor no lo cuenta hoy.
- **Desafío diario** / ranking: no hay cuentas ni persistencia de jugadores.
- **Entrar a la mesa desde la landing sin recargar** (que la escena del hero sea literalmente la sala):
  posible porque es el mismo código, pero obliga a rehacer las rutas `/` y `/sala/CÓDIGO`.
- **Personalizar tu personaje** (más allá de que salga del nombre).
