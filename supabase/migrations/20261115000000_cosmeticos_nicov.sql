-- Todos los cosméticos de la tienda (los de hoy) para NicoV, regalados.
insert into public.inventory (user_id, item_id, price)
select p.id, t.item, 0
from public.profiles p, (values ('volcho'), ('olcho'), ('remera-celeste'), ('chomba-verde'), ('pulover-bordo'), ('saco-negro'), ('boina'), ('gorra'), ('lentes'), ('mate'), ('cafe'), ('porron'), ('fernet'), ('pano-azul'), ('pano-bordo'), ('pano-negro'), ('dorso-azul'), ('dorso-verde'), ('dorso-negro'), ('baraja-pixel')) as t(item)
where lower(p.username) = 'nicov'
on conflict (user_id, item_id) do nothing;
