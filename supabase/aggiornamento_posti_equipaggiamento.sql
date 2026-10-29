-- =====================================================================
-- aggiornamento_posti_equipaggiamento.sql
-- Le nove caselle dell'equipaggiamento: Elmo, Mantello, Torace, Guanti,
-- Pantaloni, Scarpe, Mano destra, Mano sinistra, A due mani.
--
-- Da eseguire UNA volta nello SQL Editor di Supabase, dopo
-- aggiornamento_listino_standard.sql. Non cancella e non cambia i dati:
-- aggiunge una colonna, aggiunge una funzione e riscrive «equipaggia»
-- tenendo tutte le sue regole. Si può rieseguire senza danni.
-- Esegui questo file PRIMA di caricare su GitHub i file del sito.
-- =====================================================================

-- 1) In quale casella sta ogni oggetto equipaggiato (vuoto = nessuna casella:
--    barda, altri oggetti o oggetti equipaggiati prima di questo aggiornamento).
alter table public.inventari add column if not exists posto text;
alter table public.inventari drop constraint if exists inventari_posto_valido;
alter table public.inventari add constraint inventari_posto_valido
  check (posto is null or posto in ('elmo','mantello','torace','guanti','pantaloni','scarpe','mano_dx','mano_sx','due_mani'));

-- 2) equipaggia: identica a prima (permessi, un solo scudo, un solo elmo,
--    una sola armatura, una sola barda, il cibo non si equipaggia),
--    con in più: la casella si azzera quando equipaggi o rimetti nello zaino.
create or replace function public.equipaggia(p_inv bigint, p_eq boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_i     inventari%rowtype;
  v_o     oggetti%rowtype;
  v_a     armature%rowtype;
  v_posto text;
begin
  select * into v_i from inventari where id = p_inv for update;
  if not found then raise exception 'Oggetto non trovato nell’inventario'; end if;
  if not (e_master(v_i.campagna_id)
          or exists (select 1 from giocatori g where g.id = v_i.giocatore_id and g.user_id = auth.uid())) then
    raise exception 'Non puoi modificare questo inventario';
  end if;
  select * into v_o from oggetti where id = v_i.oggetto_id;
  if v_o.categoria = 'cibo' then raise exception 'Il cibo non si equipaggia'; end if;

  if p_eq and v_o.categoria = 'armatura' then
    select * into v_a from armature where oggetto_id = v_o.id;
    v_posto := _posto_armatura(v_a.categoria_armatura, v_a.gruppo);

    -- Le protezioni degli arti non hanno limite: si controllano solo gli altri posti.
    if v_posto <> 'arti' and exists (
         select 1
         from inventari i2 join armature a2 on a2.oggetto_id = i2.oggetto_id
         where i2.equipaggiato and i2.id <> v_i.id
           and i2.giocatore_id is not distinct from v_i.giocatore_id
           and i2.png_id is not distinct from v_i.png_id
           and _posto_armatura(a2.categoria_armatura, a2.gruppo) = v_posto) then
      raise exception '%', case v_posto
        when 'scudo' then 'Hai già uno scudo equipaggiato'
        when 'elmo'  then 'Hai già un elmo equipaggiato'
        when 'barda' then 'Hai già una barda equipaggiata'
        else 'Hai già un’armatura equipaggiata' end;
    end if;
  end if;
  update inventari set equipaggiato = p_eq, posto = null where id = p_inv;
end $function$;

-- 3) equipaggia_posto: equipaggia un oggetto in una casella precisa.
--    Libera da sola chi occupa già quella casella; «a due mani» libera
--    entrambe le mani, e una mano libera «a due mani». Poi applica le
--    regole di «equipaggia»: se non vanno bene (per esempio due scudi)
--    non cambia niente.
create or replace function public.equipaggia_posto(p_inv bigint, p_posto text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_i inventari%rowtype;
begin
  if p_posto is null or p_posto not in ('elmo','mantello','torace','guanti','pantaloni','scarpe','mano_dx','mano_sx','due_mani') then
    raise exception 'Casella non valida';
  end if;
  select * into v_i from inventari where id = p_inv for update;
  if not found then raise exception 'Oggetto non trovato nell’inventario'; end if;
  if not (e_master(v_i.campagna_id)
          or exists (select 1 from giocatori g where g.id = v_i.giocatore_id and g.user_id = auth.uid())) then
    raise exception 'Non puoi modificare questo inventario';
  end if;

  update inventari
     set equipaggiato = false, posto = null
   where id <> v_i.id
     and equipaggiato
     and giocatore_id is not distinct from v_i.giocatore_id
     and png_id is not distinct from v_i.png_id
     and posto = any (case p_posto
           when 'due_mani' then array['mano_dx','mano_sx','due_mani']
           when 'mano_dx'  then array['mano_dx','due_mani']
           when 'mano_sx'  then array['mano_sx','due_mani']
           else array[p_posto] end);

  perform public.equipaggia(p_inv, true);
  update inventari set posto = p_posto where id = p_inv;
end $function$;

revoke all on function public.equipaggia_posto(bigint, text) from public, anon;
grant execute on function public.equipaggia_posto(bigint, text) to authenticated;

-- 4) Una volta sola: mette nella loro casella gli oggetti già equipaggiati.
--    Le armi prima di tutto (la prima va nella mano destra, la seconda e lo
--    scudo nella sinistra; un'arma a due mani prende «a due mani»).
--    Quello che non trova posto resta equipaggiato e finisce in «Altri slot».
do $$
declare
  r        record;
  v_slot   text;
  v_posto  text;
begin
  for r in
    select i.id, i.giocatore_id, i.png_id, o.categoria, o.nome,
           a.categoria_armatura as cat_arm, a.gruppo,
           coalesce((select bool_or(lower(p) = 'a due mani')
                     from armi w, unnest(w.proprieta) p
                     where w.oggetto_id = o.id), false) as due_mani
    from inventari i
    join oggetti o on o.id = i.oggetto_id
    left join armature a on a.oggetto_id = o.id
    where i.equipaggiato and i.posto is null
    order by (o.categoria = 'arma') desc, i.id
  loop
    v_slot := case
      when r.categoria = 'arma' then 'mano'
      when r.categoria = 'armatura' and r.cat_arm = 'scudo' then 'mano'
      when r.categoria = 'armatura' and r.cat_arm in ('leggera','media','pesante') then 'torace'
      when r.categoria = 'armatura' and r.cat_arm = 'accessorio' and r.gruppo = 'arti' then
        case when r.nome ilike '%guant%' then 'guanti'
             when r.nome ilike '%pantalon%' or r.nome ilike '%gambal%' or r.nome ilike '%schinier%' then 'pantaloni'
             when r.nome ilike '%scarp%' or r.nome ilike '%stival%' or r.nome ilike '%calzatur%' then 'scarpe'
             else null end
      when r.categoria = 'armatura' and r.cat_arm = 'accessorio' then
        case when r.nome ilike '%mantell%' or r.nome ilike '%cappa%' then 'mantello' else 'elmo' end
      when r.categoria = 'vario' and (r.nome ilike '%mantell%' or r.nome ilike '%cappa%') then 'mantello'
      else null end;
    continue when v_slot is null;

    v_posto := null;
    if v_slot = 'mano' then
      if r.due_mani then
        if not exists (select 1 from inventari x where x.equipaggiato and x.id <> r.id
                         and x.giocatore_id is not distinct from r.giocatore_id and x.png_id is not distinct from r.png_id
                         and x.posto in ('mano_dx','mano_sx','due_mani')) then v_posto := 'due_mani'; end if;
      elsif not exists (select 1 from inventari x where x.equipaggiato and x.id <> r.id
                          and x.giocatore_id is not distinct from r.giocatore_id and x.png_id is not distinct from r.png_id
                          and x.posto in ('mano_dx','due_mani')) then v_posto := 'mano_dx';
      elsif not exists (select 1 from inventari x where x.equipaggiato and x.id <> r.id
                          and x.giocatore_id is not distinct from r.giocatore_id and x.png_id is not distinct from r.png_id
                          and x.posto in ('mano_sx','due_mani')) then v_posto := 'mano_sx';
      end if;
    elsif not exists (select 1 from inventari x where x.equipaggiato and x.id <> r.id
                        and x.giocatore_id is not distinct from r.giocatore_id and x.png_id is not distinct from r.png_id
                        and x.posto = v_slot) then
      v_posto := v_slot;
    end if;

    if v_posto is not null then update inventari set posto = v_posto where id = r.id; end if;
  end loop;
end $$;
