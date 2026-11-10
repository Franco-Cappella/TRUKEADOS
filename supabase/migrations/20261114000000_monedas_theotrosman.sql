-- 100.000 monedas de regalo para theotrosman.
update public.profiles
set coins = coins + 100000
where lower(username) = 'theotrosman';
