-- GIF de perfil: se guardan aparte para que los perfiles sigan siendo livianos. profiles.avatar apunta a /api/avatars/ID.
create table if not exists public.avatar_gifs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  data text not null,
  updated_at timestamptz not null default now()
);

alter table public.avatar_gifs enable row level security;
