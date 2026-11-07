# Landing de Trukeados — plan

Qué está decidido, qué falta y en qué orden se trabaja. La landing es **inmersiva**: la arma la skill
`web-inmersiva` del hub `design-studio`, en el nivel 3 (mundo de scroll). El contrato de la landing (brief,
mapa de secciones, biblia de estilo y estudios) vive en el proyecto de la landing:
`repository/truco3D-landing/docs/CONTRATO.md`.

Catálogo de ideas de secciones: [SECCIONES.md](SECCIONES.md). Qué hace el juego: [../JUEGO.md](../JUEGO.md).
Sistema de diseño: [../../DESIGN.md](../../DESIGN.md).

## Objetivo

Que alguien que llega por un link (WhatsApp, redes, búsqueda) **sienta que entra al bar**, entienda qué
tiene de distinto el juego (señas con la cara, primera persona, trampa) y llegue **al juego en un clic**.
Medida de éxito: clics en "Jugar ahora" y "Practicar con bots" sobre visitas.

## Decidido

| # | Decisión | Detalle |
|---|---|---|
| D1 | **La landing no es parte del juego** | Proyecto aparte, `repository/truco3D-landing`, con su propio git y su propio deploy. Su único trabajo es llevar al juego (`VITE_GAME_URL`). |
| D2 | **Stack de `web-inmersiva`** | React 19 + Vite + TypeScript, React Three Fiber 9.8 + drei 10.7 + three 0.186, GSAP 3.15 (ScrollTrigger, SplitText) + Lenis 1.3, maath, zustand, Archivo autoalojada. Los recursos del juego se copian con `npm run sync`. |
| D3 | **Marca** | Trukeados, con el brandkit de [../../brand/](../../brand/). |
| D4 | **Hilo** | "Te están mirando": las señas son el diferencial. |
| D5 | **Nivel 3: mundo de scroll** | Cambia lo que se había decidido antes (una cara como primera pantalla, sin 3D): se pidió una landing muy inmersiva. El bar del juego es el mundo, el scroll mueve la cámara y el recorrido termina sentado en tu silla, que es la misma vista del juego. |
| D6 | **URL del juego** | El Worker ya se llama `trukeados` (juego 1.5.1). El dominio propio queda para después ([../../brand/ALINEACION.md](../../brand/ALINEACION.md) §5). |

La regla del juego de no tener build ni frameworks sigue valiendo para el juego. La landing es otro proyecto.

## Falta decidir

| # | Decisión | Estado |
|---|---|---|
| D7 | **Estudio de dirección** | **Decidido (2026-11-06)**: A como mundo, con los primeros planos de C para las señas y la vista cenital de B para la trampa. Contrato aprobado. |
| D8 | **URL pública del juego** | `TODO(contenido)`: la pasa la persona más adelante. Mientras tanto, `http://localhost:8787`. |
| D9 | **Medición** | Recomendado: Cloudflare Web Analytics (sin cookies). |
| D10 | **Cambios chicos en el juego** | Al menos `?nombre=`, para que el nombre escrito en la landing llegue puesto ([../../brand/ALINEACION.md](../../brand/ALINEACION.md) §3). |

La dirección que se había sorteado con `design-taste-frontend` ("la frase es la composición") queda
reemplazada por el mundo de scroll. Su idea, la cara de un personaje en el lugar de una palabra, puede volver
como detalle de la sección de señas.

## Composición (v1)

Siete momentos, una idea y un encuadre de cámara por sección (el detalle está en el contrato):

1. **Inicio**: el bar desde la puerta. "Truco de verdad." CTA "Jugar ahora".
2. **A ciegas**: "Online, nadie te mira a la cara."
3. **Señas**: primer plano de una cara que hace las 11 señas.
4. **Mirada**: "Solo la ve quien te está mirando." La cámara orbita la mesa.
5. **Trampa**: la carta quemada sobre el paño.
6. **Mesas**: 1 vs 1, 2 vs 2, 3 vs 3; a 15 o a 30; con flor o sin flor, como quiera la sala.
7. **Sentate**: la vista de tu silla. Escribís tu nombre y aparece tu cara (la misma que en el juego). CTA final.

Más el pie con créditos, la imagen para compartir, los metadatos y el favicon.

**v2**: mesas en vivo (necesita CORS en el juego), calculadora de envido, jerarquía de cartas, glosario y sonido opcional.

## Fases (`web-inmersiva`, con revisión en cada una)

| Fase | Qué sale | Skills | Estado |
|---|---|---|---|
| **0. Marca** | Brandkit completo | `brandkit` | ✅ hecho |
| **1. Brief y nivel** | Brief completo, nivel 3 con su motivo | `web-inmersiva` | ✅ en el contrato |
| **2. Contrato** | Mapa de secciones, biblia de estilo, 3 estudios | `web-inmersiva` | ✅ aprobado |
| **3. Base** | Estructura (`content/`, `scroll/`, `state/`, `three/`, `ui/`), tokens, Lenis + GSAP | `web-inmersiva` | ✅ hecho |
| **4. Esqueleto HTML** | Las 7 secciones con su texto real; se lee y funciona sin 3D ni animación | `web-inmersiva` | ✅ hecho |
| **5. Director y escena gris** | Tiempos, encuadres, ida y vuelta del scroll | `web-inmersiva` | ✅ en revisión |
| **6. Escenas definitivas** | El bar, las señas, la mirada, la trampa, las mesas, la silla | `web-inmersiva` | pendiente |
| **7. Efectos y respaldos** | Postprocesado en el nivel alto, versión sin 3D, movimiento reducido, interfaz | `web-inmersiva`, `emil-design-eng` (botones, campo del nombre) | pendiente |
| **8. Verificación y entrega** | Build, recorrido en 390, 768 y 1440, Lighthouse móvil, metadatos, deploy | `web-inmersiva`, `impeccable` (audit), `vercel-react-best-practices` | pendiente |

Las dos auditorías del cierre son regla del hub para toda tarea de interfaz en React.

## Presupuestos (de `web-inmersiva`)

| Métrica | Límite |
|---|---|
| JS inicial, sin el 3D | ≤ 150 KB gzip |
| Paquete 3D (cargado aparte) | ≤ 350 KB gzip |
| Recursos 3D | ≤ 8 MB en total, ≤ 2 MB para la primera escena |
| Draw calls / triángulos | ≤ 150 / ≤ 500 k (nivel bajo: 80 / 200 k) |
| FPS | 60 en notebook, 30 o más en un celular medio |
| Core Web Vitals (móvil) | LCP < 2,5 s, CLS < 0,1, INP < 200 ms |

Además, todo lo de [../../brand/PAGINAS.md](../../brand/PAGINAS.md): el título y la CTA son HTML desde el
primer pintado, el texto sobre la escena va sobre sombra neutra, sonido apagado y textos honestos.

## Siguiente paso

Revisar la fase 5 (recorrido de cámara con escena gris; la coreografía de cada sección está en el contrato).
Después, la fase 6: el bar de verdad en lugar de las cajas grises.

Decidido en la fase 5 (2026-11-06): en celular los títulos de sección pueden ocupar tres líneas, y la última
sección lleva el texto abajo, como la primera, para que la vista del juego quede entera.
