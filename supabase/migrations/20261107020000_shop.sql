-- Tienda y personalización: lo que compró cada uno (inventory) y lo que tiene puesto (profiles.equipped,
-- { ranura: id }). El catálogo y los precios están en el código (COSMETICS en public/js/config.js); el Worker
-- valida y llama a buy_item, que descuenta las monedas y anota la compra en una sola transacción.

alter table public.profiles add column equipped jsonb not null default '{}';

create table public.inventory (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null,
  price integer not null check (price >= 0),
  bought_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.inventory enable row level security;

create policy "Cada uno ve lo suyo" on public.inventory
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Compra: si ya lo tiene o no le alcanza, no hace nada y devuelve el motivo. { ok, coins } o { error }.
create function public.buy_item(uid uuid, item text, cost integer) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  have integer;
begin
  if cost < 0 then
    return jsonb_build_object('error', 'Precio inválido');
  end if;
  select coins into have from public.profiles where id = uid for update;
  if have is null then
    return jsonb_build_object('error', 'No hay perfil');
  end if;
  if exists (select 1 from public.inventory where user_id = uid and item_id = item) then
    return jsonb_build_object('error', 'Ya lo tenés');
  end if;
  if have < cost then
    return jsonb_build_object('error', 'No te alcanzan las monedas');
  end if;
  update public.profiles set coins = coins - cost where id = uid;
  insert into public.inventory (user_id, item_id, price) values (uid, item, cost);
  return jsonb_build_object('ok', true, 'coins', have - cost);
end;
$$;

revoke execute on function public.buy_item(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.buy_item(uuid, text, integer) to service_role;
