// Hooks de carga para correr src/truco-room.js en Node (ver room-harness.mjs): reemplaza lo que solo existe en
// Cloudflare ('cloudflare:workers') y lo que habla con Supabase (cuentas e historial) por versiones de prueba.
const STUBS = {
  'cloudflare:workers': 'workers.mjs',
  './auth.js': 'auth.mjs',
  './matches.js': 'matches.mjs',
};

export function resolve(specifier, context, next) {
  const stub = STUBS[specifier];
  if (stub && (specifier.startsWith('cloudflare:') || context.parentURL?.includes('/src/'))) {
    return { url: new URL('./stubs/' + stub, import.meta.url).href, shortCircuit: true };
  }
  return next(specifier, context);
}
