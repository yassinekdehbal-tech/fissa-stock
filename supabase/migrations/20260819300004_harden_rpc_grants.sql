-- Durcissement : les RPC metier ne sont pas appelables par le role anon.
-- (Ils refuseraient de toute facon sans auth.uid(), mais autant fermer la porte.)
revoke execute on function public.create_invoice_for_intervention(uuid, jsonb) from anon;
revoke execute on function public.current_org_id() from anon;
revoke execute on function public.add_intervention_part(uuid, uuid, integer, numeric) from anon;
revoke execute on function public.remove_intervention_part(uuid) from anon;
revoke execute on function public.adjust_intervention_part(uuid, integer) from anon;
revoke execute on function public.checkout_sale(jsonb, payment_method, numeric, text) from anon;
revoke execute on function public.mark_piece_sold(uuid, channel_key, numeric) from anon;
