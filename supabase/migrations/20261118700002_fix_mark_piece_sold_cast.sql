-- =============================================================
-- FISSA STOCK - correctif anti-survente
--
-- `mark_piece_sold` échouait à l'exécution : le CASE 'sold' / 'delisted'
-- produisait un text alors que `publications.status` est l'énumération
-- `publication_status` (erreur 42804). Le délistage automatique des autres
-- canaux ne pouvait donc jamais aboutir. On caste explicitement.
-- =============================================================
create or replace function public.mark_piece_sold(p_piece uuid, p_channel channel_key default null::channel_key, p_prix numeric default null::numeric)
returns void
language plpgsql security definer
set search_path to 'public'
as $function$
declare v_piece public.pieces;
begin
  select * into v_piece from public.pieces where id = p_piece for update;
  if not found then raise exception 'piece introuvable'; end if;
  if auth.uid() is not null and v_piece.org_id <> public.current_org_id() then
    raise exception 'not authorized';
  end if;
  if v_piece.qty > 0 then
    update public.pieces set qty = 0 where id = p_piece;
    insert into public.stock_movements(piece_id, ref, name, type, qty_delta, prix, channel, user_id, org_id)
    values (p_piece, v_piece.ref, v_piece.name, 'vente-marketplace', -v_piece.qty, coalesce(p_prix, v_piece.price), p_channel, auth.uid(), v_piece.org_id);
  end if;
  -- anti-survente : la piece vendue passe 'sold' sur son canal, 'delisted' ailleurs
  update public.publications pub
    set status = case when sc.key = p_channel then 'sold'::publication_status else 'delisted'::publication_status end,
        updated_at = now()
  from public.sales_channels sc
  where pub.channel_id = sc.id and pub.piece_id = p_piece;
end; $function$;
