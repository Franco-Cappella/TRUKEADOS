-- Perfil de cada jugador: el nombre en la mesa (único, sin importar mayúsculas), las monedas de la tienda y el
-- ELO de cada modo. Lo escribe solo el Worker con la clave secreta; el navegador no toca la base directo.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (char_length(username) between 3 and 20),
  coins integer not null default 0 check (coins >= 0),
  elo_1v1 integer not null default 1200,
  elo_2v2 integer not null default 1200,
  elo_3v3 integer not null default 1200,
  games_1v1 integer not null default 0,
  games_2v2 integer not null default 0,
  games_3v3 integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index profiles_username_key on public.profiles (lower(username));

-- Sin políticas para anon: nadie lee ni escribe desde el navegador. Cada uno puede leer su propia fila
-- (por si más adelante el cliente consulta directo).
alter table public.profiles enable row level security;

create policy "Cada uno lee su perfil" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);
