-- Compartir partidas: un enlace (/repeticion/CLAVE) para que cualquiera vea la repetición y el análisis de una
-- partida terminada ("mirá el farol que metí"). Lo crea uno de los que jugaron, desde su lugar en la mesa: cada
-- jugador tiene a lo sumo un enlace por partida (si lo vuelve a pedir, recibe el mismo).
-- La clave es al azar y larga (no se puede adivinar ni recorrer). El enlace no lleva el id de la partida ni el de
-- ninguna cuenta: el Worker saca los ids de los asientos antes de mandarla (ver getShared en src/matches.js).
-- Lo leen y escriben solo el Worker (clave secreta): sin políticas, nadie más puede tocar la tabla.

create table public.match_shares (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{16,32}$'),
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seat smallint not null,
  created_at timestamptz not null default now(),
  unique (match_id, user_id)
);

alter table public.match_shares enable row level security;
