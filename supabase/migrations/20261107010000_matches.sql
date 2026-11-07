-- Historial de partidas, ELO y monedas.
-- matches: una fila por partida terminada, con todo lo necesario para rebobinarla (log: el estado al repartir
-- cada mano y cada jugada, ver public/js/replay.js). match_players: una fila por persona (no bots), para listar
-- el historial de cada uno y saber cuánto ELO y cuántas monedas ganó.
-- Lo escribe solo el Worker (clave secreta) con record_match(), que anota todo junto en una transacción.

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  room_code text not null,
  mode text not null check (mode in ('1v1', '2v2', '3v3')),
  target smallint not null,
  options jsonb not null default '{}',
  rated boolean not null default false,
  winner_team smallint not null check (winner_team in (0, 1)),
  score smallint[] not null,
  hands smallint not null,
  seats jsonb not null, -- [{ name, uid, bot }] por asiento (equipo = asiento % 2)
  log jsonb not null,
  started_at timestamptz not null,
  ended_at timestamptz not null default now()
);

create table public.match_players (
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seat smallint not null,
  team smallint not null,
  won boolean not null,
  elo_before integer,
  elo_after integer,
  coins integer not null default 0,
  ended_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

create index match_players_user_ended on public.match_players (user_id, ended_at desc);

alter table public.matches enable row level security;
alter table public.match_players enable row level security;

create policy "Cada uno ve sus partidas" on public.match_players
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Cada uno ve las partidas que jugó" on public.matches
  for select to authenticated
  using (exists (select 1 from public.match_players mp where mp.match_id = id and mp.user_id = (select auth.uid())));

-- Anota una partida terminada. m = { room_code, mode, target, options, rated, winner_team, score, hands, seats,
-- log, started_at, players: [{ user_id, seat, team, won, elo_before, elo_delta, coins }] }.
-- El ELO se suma como diferencia (elo_delta) para no pisar otra partida que termine al mismo tiempo.
create function public.record_match(m jsonb) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  mid uuid;
  p jsonb;
  md text := m->>'mode';
  rated boolean := coalesce((m->>'rated')::boolean, false);
  d integer;
  g integer;
begin
  insert into public.matches (room_code, mode, target, options, rated, winner_team, score, hands, seats, log, started_at)
  values (
    m->>'room_code', md, (m->>'target')::smallint, coalesce(m->'options', '{}'), rated,
    (m->>'winner_team')::smallint,
    array(select jsonb_array_elements_text(m->'score')::smallint),
    (m->>'hands')::smallint, m->'seats', m->'log', (m->>'started_at')::timestamptz
  )
  returning id into mid;

  for p in select * from jsonb_array_elements(m->'players') loop
    d := case when rated then coalesce((p->>'elo_delta')::integer, 0) else 0 end;
    g := case when rated then 1 else 0 end;
    update public.profiles set
      elo_1v1 = elo_1v1 + case when md = '1v1' then d else 0 end,
      elo_2v2 = elo_2v2 + case when md = '2v2' then d else 0 end,
      elo_3v3 = elo_3v3 + case when md = '3v3' then d else 0 end,
      games_1v1 = games_1v1 + case when md = '1v1' then g else 0 end,
      games_2v2 = games_2v2 + case when md = '2v2' then g else 0 end,
      games_3v3 = games_3v3 + case when md = '3v3' then g else 0 end,
      coins = coins + greatest(coalesce((p->>'coins')::integer, 0), 0)
    where id = (p->>'user_id')::uuid;

    insert into public.match_players (match_id, user_id, seat, team, won, elo_before, elo_after, coins)
    values (
      mid, (p->>'user_id')::uuid, (p->>'seat')::smallint, (p->>'team')::smallint, (p->>'won')::boolean,
      case when rated then (p->>'elo_before')::integer end,
      case when rated then (p->>'elo_before')::integer + d end,
      greatest(coalesce((p->>'coins')::integer, 0), 0)
    );
  end loop;
  return mid;
end;
$$;

revoke execute on function public.record_match(jsonb) from public, anon, authenticated;
grant execute on function public.record_match(jsonb) to service_role;
