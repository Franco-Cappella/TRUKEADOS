# Trukeados — alinear el juego con la marca

La marca sale del juego, pero el juego todavía tiene diferencias con algunos detalles que la marca decidió
distinto. Esta es la lista exacta para dejarlos iguales, y los cambios que quedaron para más adelante.

**Estado (2026-11-06, juego 1.5.3, commit `4766ecf`)**: el nombre ya está cambiado en el juego (1.5.1, con
`APP_NAME` en `config.js`), salvo el favicon. Lo demás sigue pendiente.

Prioridad: 🔴 nombre (antes de publicar la landing) · 🟡 coherencia visual · ⚪ cuando se pueda.

## 0. Decisiones cerradas

| Tema | Decisión | Cambio futuro |
|---|---|---|
| Nombre visible | **Trukeados** en todo lo que se muestra. | ✅ Hecho en 1.5.1, salvo el favicon (§1). |
| Nombre del Worker | Se había decidido mantener `truco3d`, pero el juego lo cambió a **`trukeados`** en 1.5.1. | Al desplegar, ver §5. |
| Botón principal | **Por ahora, oro solo en páginas.** El juego sigue con el botón principal blanco. | §4, cuando se quiera. |
| Paño como fondo | **Una sección entera por página** puede ir en `--pano-3`. En el juego, el paño sigue solo en la escena 3D. | — |

## 1. Nombre: "Truco 3D" → "Trukeados" ✅ (1.5.1)

El juego lo hizo en 1.5.1: el nombre del JS sale de `APP_NAME` (`config.js`), y en lo estático está en
`index.html`, `package.json` y `wrangler.jsonc`.

| Dónde | Estado |
|---|---|
| Título, descripción, encabezado del menú, título de la sala, compartir, paño, comentarios, `README.md`, `AGENTS.md`, `docs/REGLAS.md` | ✅ Hecho. El encabezado quedó en texto (`Truke<span>ados</span>`) con la bajada "Truco argentino en 3D, online, con señas de verdad."; el logo SVG queda como opción. |
| `package.json` / `wrangler.jsonc` (`name`) | ✅ Cambió a `trukeados` (ver §5 antes de desplegar). |
| `public/favicon.svg` | 🔴 Pendiente: sigue el favicon viejo (naipes marfil, trazo marrón). Cambiar por `brand/logo/icono-app.svg`. |

## 2. Coherencia visual 🟡

| Tema | Hoy en el juego | Marca | Qué hacer |
|---|---|---|---|
| Botón principal | `.btn.primary` blanco (`--text`) con texto negro | Oro (`--oro`) con texto `--accent-ink` en páginas | **Decidido: queda blanco en el juego por ahora.** Cuando se cambie, ver §4. |
| Fondo del menú | `radial-gradient(… var(--glow) …)` | Sin degradés | Excepción del juego, o reemplazar por `--bg` liso. Pendiente de decidir. |
| Comentarios viejos en `truco.css` | "raya de latón", "papelito marfil, letra de imprenta en cursiva" | La marca prohíbe latón, marfil e itálica (y el CSS ya no los usa) | Corregir los comentarios (líneas 96 y 161). |
| Tokens nuevos | No existen en el juego: `--surface-3`, `--espada-tinta`, `--basto-tinta`, `--copa-tinta`, `--pano*`, escala `--fs-*`, `--ease-out`, `--dur-*` | Están en `brand/tokens.css` | Copiar a `:root` de `truco.css` cuando se usen. `--team0` y `--team1` ya equivalen a espada y copa tinta. |
| Nombres de color | `--blue`, `--green`, `--yellow`, `--red` | `--espada`, `--basto`, `--oro`, `--copa` (con alias) | Sin urgencia: los alias mantienen los dos. |
| Estilo Canto | Globo y botón de canto en 700, ancho normal, sin mayúsculas | La marca agrega el estilo Canto (125 %, 900) para páginas | El juego queda como está; el estilo Canto es para momentos grandes en páginas. |
| Favicon | `favicon.svg` viejo | `icono-app.svg` | Ver §1. |

## 3. Para que la landing lleve más directo al juego ⚪

No hacen falta para publicar, pero mejoran el paso de la landing al juego:

| Cambio | Para qué |
|---|---|
| Aceptar `?nombre=` en el menú y guardarlo con `store.set(KEYS.name)` | Que el nombre escrito en la landing llegue puesto. |
| Aceptar `?modo=1v1\|2v2\|3v3&rapida=1` y `?practica=1` | Que "Partida rápida" y "Practicar con bots" de la landing salteen el menú. |
| Encabezado CORS en `GET /api/lobby` (solo el origen de la landing) | Mostrar "mesas jugándose ahora" en la landing. |

Cada uno es un cambio chico en `main.js` / `menu.js` / `src/index.js`, con su prueba.

## 4. Cambio futuro: botón principal en oro también en el juego

Hoy, en páginas, el botón principal es oro. En el juego es blanco. Si se pasa el juego a oro:

**Qué cambia**
- `public/css/truco.css`, líneas 90–91: `.btn.primary` pasa a `background: var(--oro); color: var(--accent-ink); border-color: var(--oro);`, y el hover a un oro más claro. Conviene agregar `--oro-hover` a `brand/tokens.css` antes (hoy la lámina usa `#f5cc4f` escrito a mano).
- Los 7 lugares del juego que usan `btn primary`:

| Archivo | Línea | Botón |
|---|---|---|
| `public/index.html` | 41 | Entrar (unirse con código) |
| `public/index.html` | 70 | Crear sala |
| `public/index.html` | 126 | Tirar (la carta elegida) |
| `public/index.html` | 141 | Enviar (chat) |
| `public/js/menu.js` | 85 | Sentarme (mesas públicas) |
| `public/js/room-client.js` | 797 | Empezar (sala de espera) |
| `public/js/room-client.js` | 818 | Revancha (fin de partida) |

**Qué mirar después**
- **La regla de proporción**: en el juego el oro aparecería varias veces a la vez (por ejemplo "Tirar" y "Entrar"). La marca dice menos de 3 % de oro en pantalla. Si en la mesa se ve demasiado, la alternativa es dejar oro solo en "Crear sala", "Empezar" y "Revancha", y el resto en blanco.
- **Contraste**: texto negro sobre oro da 11:1, así que alcanza.
- **Los cantos no cambian**: el botón de canto ya tiene su raya oro, y sigue igual.
- **Probar** el panel de acciones en 1280×720, 768×1024 y 375×812 (la misma vara que usa el juego).
- Después, actualizar `brand/COMPONENTES.md` (fila "Principal") y `brand/lamina.html`.

## 5. El Worker renombrado y el dominio propio

Desde 1.5.1 el Worker se llama `trukeados`: al desplegar, la dirección pasa a
`trukeados.<cuenta>.workers.dev`. El paso 1 ya está hecho; los demás son para el primer despliegue con el
nombre nuevo.

**Opción A: renombrar el Worker** (elegida por el juego en 1.5.1)
1. ✅ Cambiar `name` en `wrangler.jsonc` y en `package.json`.
2. Antes de desplegar, verificar en la documentación de Cloudflare que los Durable Objects (`TrucoRoom` y `Lobby`) se crean de cero en el Worker nuevo. Si es así, las salas en curso y la lista de mesas públicas arrancan vacías. Las salas son efímeras, pero conviene hacerlo sin partidas abiertas.
3. `npm run deploy` y probar: partida rápida, entrar con código, práctica con bots y una sala de dos personas.
4. Mantener el Worker viejo activo mientras los links compartidos se reemplazan. No conviene redirigirlo: las conexiones en vivo (WebSocket) no se redirigen bien, así que las salas se romperían.
5. Actualizar la dirección en la landing (`VITE_GAME_URL`), en el texto de deploy del `README.md`, y en el mensaje de WhatsApp si lo tiene.

**Opción B: dominio propio** (por ejemplo `trukeados.com.ar`)
- Se agrega como ruta personalizada del Worker. La dirección `workers.dev` sigue funcionando, así que los links viejos no se rompen.
- Hay que comprar el dominio y decidir cuál es el canónico. Es lo que D6 deja pendiente en `docs/landing/PLAN.md`.

## Cómo se usa este documento

Cuando se haga un cambio de esta lista, se marca la fila como hecha, se actualiza la fecha y el commit al
principio, y se corre `npm test` en el juego.
