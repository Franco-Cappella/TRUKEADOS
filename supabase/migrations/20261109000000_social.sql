-- Foto de perfil, récord de ELO (para premiar cada escalón nuevo una sola vez) y amigos.
-- El código funciona sin esto (sin foto, sin premios por ELO y sin amigos): se puede aplicar antes o después de
-- publicar. Lo escribe solo el Worker con la clave secreta.

-- avatar: imagen chica como data URL (la achica el navegador; el Worker valida tipo y tamaño)
alter table public.profiles add column if not exists avatar text check (char_length(avatar) <= 24000);
-- elo_peak: el ELO más alto que alcanzó en cualquier modo
alter table public.profiles add column if not exists elo_peak integer;

create index if not exists profiles_elo_1v1 on public.profiles (elo_1v1 desc) where games_1v1 > 0;
create index if not exists profiles_elo_2v2 on public.profiles (elo_2v2 desc) where games_2v2 > 0;
create index if not exists profiles_elo_3v3 on public.profiles (elo_3v3 desc) where games_3v3 > 0;

-- Una fila por pareja (user_a < user_b), quien mandó la solicitud y si ya la aceptaron.
create table if not exists public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create index if not exists friendships_user_b on public.friendships (user_b);

alter table public.friendships enable row level security;

create policy "Cada uno ve sus amistades" on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));
