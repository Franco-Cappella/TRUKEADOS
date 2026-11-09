> **Migración pendiente de aplicar:** `supabase/migrations/20261109000000_social.sql` (foto de perfil, récord de ELO y amigos). Hasta aplicarla, el juego funciona pero esas tres cosas quedan apagadas.

# Cuentas

Sin cuenta no se juega. La sesión es de **Supabase Auth** (Google o mail y contraseña) y los perfiles viven en la
base de Supabase (proyecto `kvcmmwtptgpwnxjqlpxh`, Virginia/us-east-1).

## Cómo está armado

```
navegador                          Worker (Cloudflare)                     Supabase
public/js/auth.js  ── login ─────────────────────────────────────────────▶ Auth
                   ◀─ token (JWT) ──────────────────────────────────────────
api() / join {token} ─▶ src/auth.js: verifica el token con las claves
                        públicas del proyecto (JWKS)
                        lee/crea el perfil con la clave secreta ───────────▶ tabla profiles
```

- El navegador **no** habla con la base: solo con Supabase Auth para iniciar sesión. Todo lo demás pasa por el
  Worker, que usa la clave secreta. Por eso `profiles` tiene RLS activado y ninguna política de escritura.
- El jugador es el id de la cuenta (`auth.users.id`) y su nombre, el `username` del perfil. El servidor ignora lo
  que mande el navegador como identificador o nombre.
- `/api/config` le da al navegador la URL del proyecto y la clave publicable (son públicas).
- Primera vez: `/api/me` devuelve `profile: null` y el navegador muestra "¿Cómo te llaman en la mesa?". El
  nombre es único sin importar mayúsculas (`AUTH.usernameRe` en `config.js`).
- El token vence cada hora; `auth-js` lo renueva solo. Si el servidor lo rechaza (401 o `{t:'auth'}` por el
  WebSocket), el navegador vuelve a la pantalla de entrada.

## Configuración (una sola vez)

### 1. Base de datos
Aplicar `supabase/migrations/*.sql` en el proyecto (SQL Editor del panel o `supabase db push`). La de
`profiles` ya está aplicada (2026-11-07).

### 2. Claves en Cloudflare
- `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` van en `vars` de `wrangler.jsonc` (son públicas). La publicable
  está en **Project Settings → API Keys** (`sb_publishable_…`).
- La secreta (`sb_secret_…`, misma página) va como **secreto** del Worker: en Cloudflare, **Workers & Pages →
  trukeados → Settings → Variables and Secrets → Add → Secret**, nombre `SUPABASE_SECRET_KEY`. O con
  `npx wrangler secret put SUPABASE_SECRET_KEY`. Nunca en el repositorio.
- Para `npm run dev`: `.dev.vars` con `SUPABASE_SECRET_KEY` (ver `.dev.vars.example`).

### 3. Supabase Auth
En **Authentication → URL Configuration**:
- Site URL: `https://game.trukeados.com`
- Redirect URLs: `https://game.trukeados.com/**` y `http://localhost:8787/**`

**Google** (Authentication → Sign In / Providers → Google):
1. En Google Cloud Console, **APIs & Services → Credentials → Create credentials → OAuth client ID**, tipo
   "Web application".
2. Authorized JavaScript origins: `https://game.trukeados.com`.
3. Authorized redirect URI: la que muestra Supabase en esa pantalla
   (`https://kvcmmwtptgpwnxjqlpxh.supabase.co/auth/v1/callback`).
4. Pegar el Client ID y el Client Secret en Supabase y activar el proveedor.

**Mail y contraseña** (Authentication → Sign In / Providers → Email): viene activado. Con "Confirm email"
prendido, Supabase manda un mail para confirmar la cuenta; el servidor de mail que trae Supabase solo manda a las
direcciones del equipo del proyecto y muy pocos por hora. Para gente de verdad hace falta un SMTP propio
(Authentication → Emails → SMTP, por ejemplo Resend) o apagar "Confirm email" mientras tanto.

## Si no podés entrar

- **Entrás con mail y contraseña y el juego vuelve a la pantalla de entrada**, o aparece "No pudimos completar el
  pedido": Supabase Auth te deja entrar, pero el Worker no puede leer tu perfil. En los logs del Worker (`npx
  wrangler tail`, o Workers & Pages → trukeados → Logs) aparece `Supabase respondió 401`: la clave secreta
  (`SUPABASE_SECRET_KEY`) falta o ya no es la vigente. Copiá la de **Project Settings → API Keys → Secret keys** y
  cargala otra vez con `npx wrangler secret put SUPABASE_SECRET_KEY` (y en `.dev.vars` para `npm run dev`).
- **"Entrar con Google" te lleva a una página de Supabase que dice `provider is not enabled`**: el proveedor de
  Google no está activado. Se activa con el paso 3 de arriba.

## Partidas, ELO y monedas
- `matches` (una fila por partida, con el registro para rebobinarla) y `match_players` (una por persona).
- Al terminar, la sala llama a `record_match(m)` con la clave secreta: inserta la partida, suma el ELO (como
  diferencia, para no pisar otra partida simultánea) y las monedas. Solo `service_role` puede ejecutarla.
- `/api/matches` (tu historial, de a 20) y `/api/matches/ID` (una partida, solo si la jugaste).

## Tienda
- `inventory` (lo que compró cada uno) y `profiles.equipped` (lo que tiene puesto, `{ ranura: id }`).
- El catálogo y los precios están en el código (`COSMETICS`); `buy_item(uid, item, cost)` descuenta y anota en una
  transacción. `/api/shop`, `/api/shop/buy` y `/api/shop/equip`. La sala lee lo puesto al entrar cada jugador.
