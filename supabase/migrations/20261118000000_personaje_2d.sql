-- Tu personaje dibujado (el creador de personaje): lo que eligió cada uno (piel, pelo, ropa, cara, bandera).
-- Lo valida cleanLook (config.js) antes de guardarlo. Sin esta columna, cada personaje sale de su nombre como antes.
alter table public.profiles add column if not exists look jsonb;
