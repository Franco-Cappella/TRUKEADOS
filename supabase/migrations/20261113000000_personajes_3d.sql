-- Personajes 3D (Volcho y Olcho) para theotrosman, regalados; queda puesto Volcho.
insert into public.inventory (user_id, item_id, price)
select id, item, 0 from public.profiles, (values ('volcho'), ('olcho')) as t(item)
where lower(username) = 'theotrosman'
on conflict (user_id, item_id) do nothing;

update public.profiles
set equipped = equipped || '{"personaje": "volcho"}'::jsonb
where lower(username) = 'theotrosman';
