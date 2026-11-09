-- La baraja pixel art para theotrosman, regalada y puesta.
insert into public.inventory (user_id, item_id, price)
select id, 'baraja-pixel', 0 from public.profiles where lower(username) = 'theotrosman'
on conflict (user_id, item_id) do nothing;

update public.profiles
set equipped = equipped || '{"baraja": "baraja-pixel"}'::jsonb
where lower(username) = 'theotrosman';
