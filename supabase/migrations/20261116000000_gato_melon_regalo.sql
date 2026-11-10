-- El Gato Melón para trosman (y su otra cuenta, theotrosman) y NicoV, regalado.
insert into public.inventory (user_id, item_id, price)
select id, 'gato-melon', 0 from public.profiles
where lower(username) in ('trosman', 'theotrosman', 'nicov')
on conflict (user_id, item_id) do nothing;
