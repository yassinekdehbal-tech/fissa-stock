-- =============================================================
-- FISSA STOCK - RLS par organisation
-- Remplace les politiques mono-societe (qual "true") par une
-- isolation stricte : chaque exploitant ne voit que ses donnees.
-- =============================================================

-- organizations : lecture par ses membres, edition par l'admin de l'org
create policy org_read on public.organizations for select to authenticated
  using (id = public.current_org_id());
create policy org_update_admin on public.organizations for update to authenticated
  using (id = public.current_org_id() and public.is_admin())
  with check (id = public.current_org_id() and public.is_admin());

-- sites
create policy sites_read on public.sites for select to authenticated
  using (org_id = public.current_org_id());
create policy sites_admin_write on public.sites for insert to authenticated
  with check (org_id = public.current_org_id() and public.is_admin());
create policy sites_admin_update on public.sites for update to authenticated
  using (org_id = public.current_org_id() and public.is_admin())
  with check (org_id = public.current_org_id() and public.is_admin());
create policy sites_admin_delete on public.sites for delete to authenticated
  using (org_id = public.current_org_id() and public.is_admin());

-- profiles : soi-meme, ou l'admin DE LA MEME organisation
drop policy profiles_select_self_or_admin on public.profiles;
drop policy profiles_update_self on public.profiles;
drop policy profiles_admin_all on public.profiles;
create policy profiles_select_self_or_admin on public.profiles for select
  using (id = auth.uid() or (public.is_admin() and org_id = public.current_org_id()));
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_all on public.profiles for all
  using (public.is_admin() and org_id = public.current_org_id())
  with check (public.is_admin() and org_id = public.current_org_id());

-- pieces (la policy anon pieces_read_public reste inchangee :
-- une seule boutique publique tant qu'il n'y a qu'un exploitant)
drop policy pieces_read_auth on public.pieces;
drop policy pieces_insert on public.pieces;
drop policy pieces_update on public.pieces;
drop policy pieces_delete on public.pieces;
create policy pieces_read_auth on public.pieces for select to authenticated
  using (org_id = public.current_org_id());
create policy pieces_insert on public.pieces for insert to authenticated
  with check (org_id = public.current_org_id());
create policy pieces_update on public.pieces for update to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
create policy pieces_delete on public.pieces for delete to authenticated
  using (public.is_admin() and org_id = public.current_org_id());

-- stock_movements
drop policy mov_read on public.stock_movements;
drop policy mov_insert on public.stock_movements;
drop policy mov_delete on public.stock_movements;
create policy mov_read on public.stock_movements for select to authenticated
  using (org_id = public.current_org_id());
create policy mov_insert on public.stock_movements for insert to authenticated
  with check (org_id = public.current_org_id());
create policy mov_delete on public.stock_movements for delete to authenticated
  using (public.is_admin() and org_id = public.current_org_id());

-- interventions
drop policy interv_read on public.interventions;
drop policy interv_insert on public.interventions;
drop policy interv_update on public.interventions;
drop policy interv_delete on public.interventions;
create policy interv_read on public.interventions for select to authenticated
  using (org_id = public.current_org_id());
create policy interv_insert on public.interventions for insert to authenticated
  with check (org_id = public.current_org_id());
create policy interv_update on public.interventions for update to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
create policy interv_delete on public.interventions for delete to authenticated
  using (public.is_admin() and org_id = public.current_org_id());

-- intervention_parts
drop policy iparts_all on public.intervention_parts;
create policy iparts_all on public.intervention_parts for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- invoices
drop policy inv_read on public.invoices;
drop policy inv_insert on public.invoices;
drop policy inv_update on public.invoices;
drop policy inv_delete on public.invoices;
create policy inv_read on public.invoices for select to authenticated
  using (org_id = public.current_org_id());
create policy inv_insert on public.invoices for insert to authenticated
  with check (org_id = public.current_org_id());
create policy inv_update on public.invoices for update to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
create policy inv_delete on public.invoices for delete to authenticated
  using (public.is_admin() and org_id = public.current_org_id());

-- invoice_lines
drop policy invl_all on public.invoice_lines;
create policy invl_all on public.invoice_lines for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- sales
drop policy sales_read on public.sales;
drop policy sales_insert on public.sales;
drop policy sales_delete on public.sales;
create policy sales_read on public.sales for select to authenticated
  using (org_id = public.current_org_id());
create policy sales_insert on public.sales for insert to authenticated
  with check (org_id = public.current_org_id());
create policy sales_delete on public.sales for delete to authenticated
  using (public.is_admin() and org_id = public.current_org_id());

-- sale_items
drop policy saleitems_all on public.sale_items;
create policy saleitems_all on public.sale_items for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- publications
drop policy pub_read on public.publications;
drop policy pub_insert on public.publications;
drop policy pub_update on public.publications;
drop policy pub_delete on public.publications;
create policy pub_read on public.publications for select to authenticated
  using (org_id = public.current_org_id());
create policy pub_insert on public.publications for insert to authenticated
  with check (org_id = public.current_org_id());
create policy pub_update on public.publications for update to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
create policy pub_delete on public.publications for delete to authenticated
  using (public.is_admin() and org_id = public.current_org_id());

-- sales_channels
drop policy chan_read on public.sales_channels;
drop policy chan_admin on public.sales_channels;
create policy chan_read on public.sales_channels for select to authenticated
  using (org_id = public.current_org_id());
create policy chan_admin on public.sales_channels for all to authenticated
  using (public.is_admin() and org_id = public.current_org_id())
  with check (public.is_admin() and org_id = public.current_org_id());
