-- =============================================================
-- FISSA STOCK - RPC org-aware + facture conforme
-- Les fonctions SECURITY DEFINER verifient desormais que les
-- lignes touchees appartiennent a l'organisation de l'appelant,
-- et propagent org_id explicitement (les webhooks service_role
-- n'ont pas de auth.uid()).
-- =============================================================

create or replace function public.add_intervention_part(p_intervention uuid, p_piece uuid, p_qty integer, p_prix numeric default null::numeric)
returns uuid
language plpgsql security definer
set search_path to 'public'
as $function$
declare v_piece public.pieces; v_part uuid;
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;
  select * into v_piece from public.pieces where id = p_piece for update;
  if not found then raise exception 'piece introuvable'; end if;
  if v_piece.org_id <> public.current_org_id() then raise exception 'not authorized'; end if;
  if not exists (select 1 from public.interventions where id = p_intervention and org_id = v_piece.org_id) then
    raise exception 'intervention introuvable';
  end if;
  if v_piece.qty < p_qty then
    raise exception 'stock insuffisant pour % (dispo %, demandé %)', v_piece.ref, v_piece.qty, p_qty;
  end if;
  update public.pieces set qty = qty - p_qty where id = p_piece;
  insert into public.intervention_parts(intervention_id, piece_id, ref, name, qty, prix_unitaire, org_id)
  values (p_intervention, p_piece, v_piece.ref, v_piece.name, p_qty, coalesce(p_prix, v_piece.price), v_piece.org_id)
  returning id into v_part;
  insert into public.stock_movements(piece_id, ref, name, type, qty_delta, prix, intervention_id, user_id, org_id)
  values (p_piece, v_piece.ref, v_piece.name, 'sortie-chantier', -p_qty, coalesce(p_prix, v_piece.price), p_intervention, auth.uid(), v_piece.org_id);
  update public.interventions
    set estimated_total = coalesce((select sum(qty*prix_unitaire) from public.intervention_parts where intervention_id = p_intervention),0)
    where id = p_intervention;
  return v_part;
end; $function$;

create or replace function public.remove_intervention_part(p_part uuid)
returns void
language plpgsql security definer
set search_path to 'public'
as $function$
declare v_part public.intervention_parts;
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;
  select * into v_part from public.intervention_parts where id = p_part;
  if not found then raise exception 'ligne introuvable'; end if;
  if v_part.org_id <> public.current_org_id() then raise exception 'not authorized'; end if;
  if v_part.piece_id is not null then
    update public.pieces set qty = qty + v_part.qty where id = v_part.piece_id;
    insert into public.stock_movements(piece_id, ref, name, type, qty_delta, intervention_id, user_id, org_id)
    values (v_part.piece_id, v_part.ref, v_part.name, 'retour-chantier', v_part.qty, v_part.intervention_id, auth.uid(), v_part.org_id);
  end if;
  delete from public.intervention_parts where id = p_part;
  update public.interventions
    set estimated_total = coalesce((select sum(qty*prix_unitaire) from public.intervention_parts where intervention_id = v_part.intervention_id),0)
    where id = v_part.intervention_id;
end; $function$;

create or replace function public.adjust_intervention_part(p_part uuid, p_delta integer)
returns void
language plpgsql security definer
set search_path to 'public'
as $function$
declare
  v_part public.intervention_parts;
  v_avail integer;
  v_new_qty integer;
  v_return integer;
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;
  if p_delta = 0 then return; end if;
  select * into v_part from public.intervention_parts where id = p_part for update;
  if not found then raise exception 'ligne introuvable'; end if;
  if v_part.org_id <> public.current_org_id() then raise exception 'not authorized'; end if;

  if p_delta > 0 then
    if v_part.piece_id is not null then
      select qty into v_avail from public.pieces where id = v_part.piece_id for update;
      if v_avail < p_delta then
        raise exception 'stock insuffisant pour % (dispo %, demande %)', v_part.ref, v_avail, p_delta;
      end if;
      update public.pieces set qty = qty - p_delta where id = v_part.piece_id;
      insert into public.stock_movements(piece_id, ref, name, type, qty_delta, prix, intervention_id, user_id, org_id)
      values (v_part.piece_id, v_part.ref, v_part.name, 'sortie-chantier', -p_delta, v_part.prix_unitaire, v_part.intervention_id, auth.uid(), v_part.org_id);
    end if;
    update public.intervention_parts set qty = qty + p_delta where id = p_part;
  else
    v_new_qty := v_part.qty + p_delta;
    if v_new_qty < 0 then v_new_qty := 0; end if;
    v_return := v_part.qty - v_new_qty;
    if v_part.piece_id is not null and v_return > 0 then
      update public.pieces set qty = qty + v_return where id = v_part.piece_id;
      insert into public.stock_movements(piece_id, ref, name, type, qty_delta, intervention_id, user_id, org_id)
      values (v_part.piece_id, v_part.ref, v_part.name, 'retour-chantier', v_return, v_part.intervention_id, auth.uid(), v_part.org_id);
    end if;
    if v_new_qty = 0 then
      delete from public.intervention_parts where id = p_part;
    else
      update public.intervention_parts set qty = v_new_qty where id = p_part;
    end if;
  end if;

  update public.interventions
    set estimated_total = coalesce((select sum(qty*prix_unitaire) from public.intervention_parts where intervention_id = v_part.intervention_id),0)
    where id = v_part.intervention_id;
end; $function$;

create or replace function public.checkout_sale(p_items jsonb, p_payment payment_method default null::payment_method, p_discount numeric default 0, p_client text default null::text)
returns uuid
language plpgsql security definer
set search_path to 'public'
as $function$
declare
  v_sale uuid;
  v_item jsonb;
  v_piece public.pieces;
  v_qty integer;
  v_prix numeric;
  v_total numeric := 0;
  v_org uuid;
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;
  v_org := public.current_org_id();
  if v_org is null then raise exception 'not authorized'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'panier vide';
  end if;

  -- 1) Verifier tout le stock d'abord (echoue avant toute ecriture si insuffisant)
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_piece from public.pieces where id = (v_item->>'piece_id')::uuid for update;
    if not found then raise exception 'piece introuvable'; end if;
    if v_piece.org_id <> v_org then raise exception 'not authorized'; end if;
    v_qty := (v_item->>'qty')::integer;
    if v_qty is null or v_qty < 1 then raise exception 'quantite invalide pour %', v_piece.ref; end if;
    if v_piece.qty < v_qty then
      raise exception 'stock insuffisant pour % (dispo %, demande %)', v_piece.ref, v_piece.qty, v_qty;
    end if;
  end loop;

  insert into public.sales(payment, discount, client, user_id, total, org_id)
    values (p_payment, coalesce(p_discount, 0), p_client, auth.uid(), 0, v_org)
    returning id into v_sale;

  -- 2) Appliquer : lignes + decrement stock + mouvements
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_piece from public.pieces where id = (v_item->>'piece_id')::uuid for update;
    v_qty := (v_item->>'qty')::integer;
    v_prix := (v_item->>'prix')::numeric;
    update public.pieces set qty = qty - v_qty where id = v_piece.id;
    insert into public.sale_items(sale_id, piece_id, ref, name, qty, prix_unitaire, org_id)
      values (v_sale, v_piece.id, v_piece.ref, v_piece.name, v_qty, v_prix, v_org);
    insert into public.stock_movements(piece_id, ref, name, type, qty_delta, prix, user_id, org_id)
      values (v_piece.id, v_piece.ref, v_piece.name, 'vente-comptoir', -v_qty, v_prix, auth.uid(), v_org);
    v_total := v_total + v_qty * v_prix;
  end loop;

  v_total := v_total * (1 - coalesce(p_discount, 0) / 100);
  update public.sales set total = round(v_total, 2) where id = v_sale;
  return v_sale;
end; $function$;

-- mark_piece_sold est aussi appele par le webhook marketplace
-- (service_role, pas de auth.uid()) : l'org vient de la piece.
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
    set status = case when sc.key = p_channel then 'sold' else 'delisted' end,
        updated_at = now()
  from public.sales_channels sc
  where pub.channel_id = sc.id and pub.piece_id = p_piece;
end; $function$;

-- =============================================================
-- Facture conforme : creation en base avec numero sequentiel.
-- Les prix stockes (pieces, main d'oeuvre) sont TTC ; la TVA
-- (taux normal 20 %) est decomposee sur le total.
-- p_labor : [{"label": "...", "qty": 1, "prix_ttc": 50}]
-- Idempotent : si l'intervention a deja une facture, la retourne.
-- =============================================================
create or replace function public.create_invoice_for_intervention(p_intervention uuid, p_labor jsonb default '[]'::jsonb)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $function$
declare
  v_interv public.interventions;
  v_inv public.invoices;
  v_part record;
  v_line jsonb;
  v_total_ttc numeric := 0;
  v_total_ht numeric;
  v_qty numeric;
  v_prix numeric;
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;
  select * into v_interv from public.interventions where id = p_intervention for update;
  if not found then raise exception 'intervention introuvable'; end if;
  if v_interv.org_id <> public.current_org_id() then raise exception 'not authorized'; end if;

  -- deja facturee : renvoyer la facture existante (pas de doublon)
  if v_interv.invoice_id is not null then
    select * into v_inv from public.invoices where id = v_interv.invoice_id;
    if found then
      return jsonb_build_object(
        'id', v_inv.id, 'number', v_inv.number, 'date_issued', v_inv.date_issued,
        'total_ht', v_inv.total_ht, 'total_tva', v_inv.total_tva, 'total_ttc', v_inv.total_ttc,
        'existing', true);
    end if;
  end if;

  insert into public.invoices (type, status, intervention_id, client_name, client_phone, client_email, created_by, org_id)
  values ('facture', 'envoye', p_intervention, coalesce(v_interv.client_name,''), coalesce(v_interv.client_phone,''), coalesce(v_interv.client_email,''), auth.uid(), v_interv.org_id)
  returning * into v_inv;

  -- lignes pieces (prix stockes TTC -> HT = TTC / 1.20)
  for v_part in
    select * from public.intervention_parts where intervention_id = p_intervention
  loop
    insert into public.invoice_lines (invoice_id, label, kind, piece_id, qty, unit_price_ht, tva_rate, org_id)
    values (v_inv.id, coalesce(v_part.ref,'') || ' ' || coalesce(v_part.name,''), 'piece', v_part.piece_id,
            v_part.qty, round(v_part.prix_unitaire / 1.20, 4), 20.00, v_interv.org_id);
    v_total_ttc := v_total_ttc + v_part.qty * v_part.prix_unitaire;
  end loop;

  -- lignes main d'oeuvre
  for v_line in select * from jsonb_array_elements(coalesce(p_labor, '[]'::jsonb)) loop
    v_qty := coalesce((v_line->>'qty')::numeric, 1);
    v_prix := coalesce((v_line->>'prix_ttc')::numeric, 0);
    if v_prix > 0 then
      insert into public.invoice_lines (invoice_id, label, kind, qty, unit_price_ht, tva_rate, org_id)
      values (v_inv.id, coalesce(v_line->>'label', 'Main d''oeuvre'), 'main-oeuvre', v_qty, round(v_prix / 1.20, 4), 20.00, v_interv.org_id);
      v_total_ttc := v_total_ttc + v_qty * v_prix;
    end if;
  end loop;

  v_total_ttc := round(v_total_ttc, 2);
  v_total_ht := round(v_total_ttc / 1.20, 2);

  update public.invoices
    set total_ttc = v_total_ttc,
        total_ht = v_total_ht,
        total_tva = v_total_ttc - v_total_ht,
        tva_rate = 20.00
    where id = v_inv.id
    returning * into v_inv;

  update public.interventions set invoice_id = v_inv.id where id = p_intervention;

  return jsonb_build_object(
    'id', v_inv.id, 'number', v_inv.number, 'date_issued', v_inv.date_issued,
    'total_ht', v_inv.total_ht, 'total_tva', v_inv.total_tva, 'total_ttc', v_inv.total_ttc,
    'existing', false);
end; $function$;
