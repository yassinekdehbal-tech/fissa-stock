-- =============================================================
-- FISSA STOCK - commandes marketplace (suivi envois + encaissement)
--
-- Une vente en ligne (eBay, OVOKO, LeBonCoin…) devient une COMMANDE suivie
-- depuis FISSA STOCK : acheteur, montant, état du paiement (encaissé par la
-- marketplace), état de l'expédition (transporteur, n° de suivi).
-- La création d'une commande applique l'anti-survente (mark_piece_sold) :
-- stock à 0, mouvement `vente-marketplace`, délistage des autres canaux.
-- =============================================================

create type public.order_payment_status as enum ('pending', 'paid', 'refunded');
create type public.order_shipping_status as enum ('to_ship', 'shipped', 'delivered', 'cancelled');

create table public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  piece_id uuid references public.pieces(id) on delete set null,
  channel_id uuid references public.sales_channels(id) on delete set null,
  -- Identifiants côté plateforme (commande, ligne, annonce)
  external_order_id text,
  external_line_item_id text,
  external_listing_id text,
  ref text,
  name text,
  qty integer not null default 1,
  amount numeric(10,2) not null default 0,
  currency text not null default 'EUR',
  buyer_name text not null default '',
  buyer_address text not null default '',
  buyer_contact text not null default '',
  payment_status public.order_payment_status not null default 'pending',
  paid_at timestamptz,
  shipping_status public.order_shipping_status not null default 'to_ship',
  carrier text not null default '',
  tracking_number text not null default '',
  shipped_at timestamptz,
  delivered_at timestamptz,
  tracking_synced boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index marketplace_orders_external_key
  on public.marketplace_orders (org_id, channel_id, external_order_id, external_line_item_id)
  where external_order_id is not null;
create index idx_marketplace_orders_org_status on public.marketplace_orders (org_id, shipping_status, created_at desc);
create index idx_marketplace_orders_piece on public.marketplace_orders (piece_id);
alter table public.marketplace_orders enable row level security;

create policy mo_read on public.marketplace_orders for select to authenticated
  using (org_id = public.current_org_id());
create policy mo_insert on public.marketplace_orders for insert to authenticated
  with check (org_id = public.current_org_id() and (public.is_admin() or public.has_perm('vendeur')));
create policy mo_update on public.marketplace_orders for update to authenticated
  using (org_id = public.current_org_id() and (public.is_admin() or public.has_perm('vendeur')))
  with check (org_id = public.current_org_id() and (public.is_admin() or public.has_perm('vendeur')));
create policy mo_delete on public.marketplace_orders for delete to authenticated
  using (org_id = public.current_org_id() and public.is_admin());

create or replace function public.touch_marketplace_order()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;
create trigger marketplace_orders_touch before update on public.marketplace_orders
  for each row execute function public.touch_marketplace_order();

-- -------------------------------------------------------------
-- record_marketplace_sale : une vente sur un canal -> commande + anti-survente.
-- Appelée par le webhook / la synchro eBay (service_role) et par l'app
-- (vente saisie à la main pour un canal « manuel » : LeBonCoin, Facebook…).
-- Idempotente sur (canal, n° de commande, n° de ligne).
-- -------------------------------------------------------------
create or replace function public.record_marketplace_sale(
  p_piece uuid,
  p_channel channel_key,
  p_prix numeric default null,
  p_external_order_id text default null,
  p_external_line_item_id text default null,
  p_buyer_name text default '',
  p_buyer_address text default '',
  p_buyer_contact text default '',
  p_qty integer default 1,
  p_paid boolean default false,
  p_notes text default ''
)
returns uuid
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_piece public.pieces;
  v_channel public.sales_channels;
  v_order uuid;
  v_listing text;
begin
  select * into v_piece from public.pieces where id = p_piece;
  if not found then raise exception 'piece introuvable'; end if;
  if auth.uid() is not null then
    if v_piece.org_id <> public.current_org_id() then raise exception 'not authorized'; end if;
    if not (public.is_admin() or public.has_perm('vendeur')) then raise exception 'not authorized'; end if;
  end if;

  select * into v_channel from public.sales_channels
    where org_id = v_piece.org_id and key = p_channel limit 1;

  -- Déjà enregistrée (webhook rejoué, synchro répétée) : on renvoie la commande.
  if p_external_order_id is not null then
    select id into v_order from public.marketplace_orders
      where org_id = v_piece.org_id
        and channel_id is not distinct from v_channel.id
        and external_order_id = p_external_order_id
        and external_line_item_id is not distinct from p_external_line_item_id;
    if v_order is not null then
      update public.marketplace_orders
        set payment_status = case when p_paid and payment_status = 'pending' then 'paid' else payment_status end,
            paid_at = case when p_paid and paid_at is null then now() else paid_at end
        where id = v_order;
      return v_order;
    end if;
  end if;

  select external_id into v_listing from public.publications
    where piece_id = p_piece and channel_id = v_channel.id;

  -- Anti-survente : stock à 0, mouvement, délistage des autres canaux.
  perform public.mark_piece_sold(p_piece, p_channel, p_prix);

  insert into public.marketplace_orders (
    org_id, piece_id, channel_id, external_order_id, external_line_item_id, external_listing_id,
    ref, name, qty, amount, buyer_name, buyer_address, buyer_contact,
    payment_status, paid_at, notes
  ) values (
    v_piece.org_id, p_piece, v_channel.id, p_external_order_id, p_external_line_item_id, v_listing,
    v_piece.ref, v_piece.name, greatest(coalesce(p_qty, 1), 1),
    round(coalesce(p_prix, v_piece.price) * greatest(coalesce(p_qty, 1), 1), 2),
    coalesce(p_buyer_name, ''), coalesce(p_buyer_address, ''), coalesce(p_buyer_contact, ''),
    case when p_paid then 'paid'::order_payment_status else 'pending'::order_payment_status end,
    case when p_paid then now() else null end,
    coalesce(p_notes, '')
  ) returning id into v_order;
  return v_order;
end; $$;
revoke execute on function public.record_marketplace_sale(uuid, channel_key, numeric, text, text, text, text, text, integer, boolean, text) from public, anon;
grant execute on function public.record_marketplace_sale(uuid, channel_key, numeric, text, text, text, text, text, integer, boolean, text) to authenticated, service_role;

alter publication supabase_realtime add table public.marketplace_orders;
