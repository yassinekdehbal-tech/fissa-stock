-- Identification des pieces : code court manuscrit + codes emballage.
--
-- 1) short_code : code court (5 caracteres, alphabet sans ambiguite : pas de
--    0/O, 1/I/L) genere automatiquement a l'insertion. Le magasinier l'ecrit au
--    marqueur sur la piece quand une etiquette imprimee ne tiendrait pas
--    (piece d'occasion grasse, rouillee, trop petite) ou qu'aucune imprimante
--    n'est disponible. Unique par organisation.
-- 2) ean          : code-barres deja present sur l'emballage d'une piece neuve
--    (EAN-13 / UPC). Scanne au comptoir ou a la reception.
-- 3) supplier_ref : reference du fournisseur, telle qu'elle apparait sur son
--    site. Le vendeur la saisit pour savoir si la piece est en stock et ou elle
--    est rangee avant de la commander.

alter table public.pieces add column if not exists short_code   text;
alter table public.pieces add column if not exists ean          text;
alter table public.pieces add column if not exists supplier_ref text;

-- Generation d'un code court aleatoire, unique dans l'organisation donnee.
create or replace function public.gen_piece_short_code(p_org uuid)
returns text
language plpgsql
volatile
as $$
declare
  -- 31 symboles : chiffres 2-9 + lettres sans I, L, O (confusion avec 1 et 0)
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_len      constant int  := 5;
  v_code     text;
  v_i        int;
begin
  loop
    v_code := '';
    for v_i in 1..v_len loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.pieces where org_id = p_org and short_code = v_code
    );
  end loop;
  return v_code;
end;
$$;

-- Trigger : pose un code court si la ligne n'en a pas, normalise les codes saisis.
create or replace function public.pieces_set_codes()
returns trigger
language plpgsql
as $$
begin
  if new.short_code is null or btrim(new.short_code) = '' then
    new.short_code := public.gen_piece_short_code(new.org_id);
  else
    new.short_code := upper(regexp_replace(new.short_code, '[^0-9A-Za-z]', '', 'g'));
  end if;
  if new.ean is not null then
    new.ean := nullif(regexp_replace(new.ean, '[^0-9A-Za-z]', '', 'g'), '');
  end if;
  if new.supplier_ref is not null then
    new.supplier_ref := nullif(btrim(new.supplier_ref), '');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pieces_set_codes on public.pieces;
create trigger trg_pieces_set_codes
before insert or update of short_code, ean, supplier_ref on public.pieces
for each row execute function public.pieces_set_codes();

-- Rattrapage : les pieces existantes recoivent chacune un code court.
update public.pieces
set short_code = public.gen_piece_short_code(org_id)
where short_code is null or btrim(short_code) = '';

alter table public.pieces alter column short_code set not null;

create unique index if not exists pieces_org_short_code_key on public.pieces (org_id, short_code);
create index if not exists idx_pieces_org_ean          on public.pieces (org_id, ean)          where ean is not null;
create index if not exists idx_pieces_org_supplier_ref on public.pieces (org_id, supplier_ref) where supplier_ref is not null;
