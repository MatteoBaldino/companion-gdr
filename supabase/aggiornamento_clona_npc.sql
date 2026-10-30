-- =====================================================================
-- Aggiornamento: clonare un NPC / mostro per uno scontro
--
-- QUANDO ESEGUIRLO
--   Una volta sola, DOPO aggiornamento_battle.sql e aggiornamento_token_multipli.sql.
--   È un unico blocco: se qualcosa va storto non cambia niente.
--
-- COSA FA
--   clona_png        dal «+» accanto a un NPC già sulla mappa: crea «Goblin 2» (poi «Goblin 3»…)
--                    con una COPIA INDIPENDENTE: un nuovo NPC con la sua scheda (PF al massimo, turno
--                    azzerato), i suoi oggetti e i suoi incantesimi, e un token sulla mappa.
--                    Cambiare una copia non cambia l'originale, e viceversa.
--   elimina_clone    toglie una copia (con scheda, oggetti, token).
--   elimina_cloni    toglie tutte le copie della campagna: lo chiama «Nuovo scontro».
--   elimina_png      come prima, ma togliendo un NPC spariscono anche le sue copie.
--
-- Le copie si riconoscono dalla colonna nuova «clone_di» della tabella png.
-- Solo il master può clonare e togliere le copie.
-- =====================================================================


alter table png add column clone_di bigint references png(id) on delete cascade;
create index png_clone_di on png (clone_di);


-- ---------------------------------------------------------------------
-- Copia delle righe di una tabella, senza dover elencare le colonne:
-- si copiano tutte tranne «id» e quelle generate, cambiando solo quelle di p_nuovi.
-- Restituisce l'id della prima riga creata (0 se la tabella non ha «id»).
-- ---------------------------------------------------------------------
create function _copia_righe(p_tab text, p_col text, p_val bigint, p_nuovi jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_cols text; v_sel text; r record; v_ret text; v_id bigint;
begin
  for r in select column_name from information_schema.columns
            where table_schema = 'public' and table_name = p_tab
              and column_name <> 'id' and is_generated = 'NEVER' and identity_generation is null
            order by ordinal_position loop
    v_cols := concat_ws(', ', v_cols, quote_ident(r.column_name));
    v_sel  := concat_ws(', ', v_sel,
                case when p_nuovi ? r.column_name
                     then format('(jsonb_populate_record(null::%I, $2)).%I', p_tab, r.column_name)
                     else 't.' || quote_ident(r.column_name) end);
  end loop;
  v_ret := case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = p_tab and column_name = 'id')
                then 'id' else '0::bigint' end;
  execute format('with n as (insert into %I (%s) select %s from %I t where t.%I = $1 returning %s as x) select coalesce(min(x), 0) from n',
                 p_tab, v_cols, v_sel, p_tab, p_col, v_ret)
    into v_id using p_val, p_nuovi;
  return v_id;
end $$;


-- Toglie un NPC copia con tutto quello che ha (come elimina_png, ma senza chiedere il permesso: la chiamano le funzioni sotto).
create function _toglie_png(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from segnalini where png_id = p_id;
  delete from inventari where png_id = p_id;
  delete from schede    where png_id = p_id;
  if exists (select 1 from trasferimenti where da_png_id = p_id or a_png_id = p_id) then
    update png set archiviato = true where id = p_id;          -- ha uno storico di passaggi: resta archiviato
  else
    delete from png where id = p_id;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- Clonare
-- ---------------------------------------------------------------------
-- Restituisce l'id del nuovo token. Si clona sempre dall'originale, anche se si preme «+» su una copia.
create function clona_png(p_png bigint, p_mappa bigint, p_x numeric, p_y numeric) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_o png%rowtype; v_camp bigint; v_orig bigint; v_base text; v_n integer := 2; v_nome text;
  v_new bigint; v_sch schede%rowtype; v_new_sch bigint; v_taglia numeric := 1; v_tok bigint;
begin
  select * into v_o from png where id = p_png and not archiviato;
  if not found or not e_master(v_o.campagna_id) then raise exception 'NPC non trovato'; end if;
  v_camp := v_o.campagna_id;
  if not exists (select 1 from mappe where id = p_mappa and campagna_id = v_camp) then raise exception 'Mappa non trovata'; end if;
  v_orig := coalesce(v_o.clone_di, v_o.id);
  select nome into v_base from png where id = v_orig;

  -- il primo numero libero: «Goblin 2», «Goblin 3»…
  while exists (select 1 from png where campagna_id = v_camp and not archiviato and nome = left(v_base, 56) || ' ' || v_n)
     or exists (select 1 from segnalini where mappa_id = p_mappa and nome = left(v_base, 56) || ' ' || v_n) loop
    v_n := v_n + 1;
  end loop;
  v_nome := left(v_base, 56) || ' ' || v_n;

  -- 1. l'NPC
  v_new := _copia_righe('png', 'id', v_orig, jsonb_build_object('nome', v_nome, 'clone_di', v_orig, 'archiviato', false));

  -- 2. la scheda: PF al massimo e turno da capo; poi gli oggetti e gli incantesimi
  select * into v_sch from schede where png_id = v_orig;
  if found then
    v_new_sch := _copia_righe('schede', 'png_id', v_orig,
                   jsonb_build_object('png_id', v_new, 'pf_attuali', v_sch.pf_max, 'pf_temp', 0, 'turno', '{}'::jsonb));
    perform _copia_righe('scheda_incantesimi', 'scheda_id', v_sch.id, jsonb_build_object('scheda_id', v_new_sch));
  end if;
  perform _copia_righe('inventari', 'png_id', v_orig, jsonb_build_object('png_id', v_new));

  -- 3. il token, della stessa dimensione dell'originale
  select taglia into v_taglia from segnalini where png_id = v_orig and mappa_id = p_mappa order by id limit 1;
  v_tok := aggiungi_segnalino(jsonb_build_object('campagna_id', v_camp, 'mappa_id', p_mappa, 'png_id', v_new,
                              'x', p_x, 'y', p_y, 'taglia', coalesce(v_taglia, 1)));
  return v_tok;
end $$;


-- ---------------------------------------------------------------------
-- Togliere le copie
-- ---------------------------------------------------------------------
create function elimina_clone(p_png bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_o png%rowtype;
begin
  select * into v_o from png where id = p_png;
  if not found or not e_master(v_o.campagna_id) then raise exception 'NPC non trovato'; end if;
  if v_o.clone_di is null then raise exception 'Non è una copia: usa «Elimina scheda» dalla scheda dell''NPC'; end if;
  perform _toglie_png(p_png);
  perform _bump_battle(v_o.campagna_id);
end $$;

-- Toglie tutte le copie della campagna. Restituisce quante.
create function elimina_cloni(p_camp bigint) returns integer
language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_n integer := 0;
begin
  if not e_master(p_camp) then raise exception 'Solo il master può togliere le copie'; end if;
  for v_id in select id from png where campagna_id = p_camp and clone_di is not null and not archiviato loop
    perform _toglie_png(v_id); v_n := v_n + 1;
  end loop;
  perform _bump_battle(p_camp);
  return v_n;
end $$;


-- ---------------------------------------------------------------------
-- Eliminare un NPC toglie anche le sue copie
--    (stessa funzione di aggiornamento_battle.sql, con il giro sulle copie in più)
-- ---------------------------------------------------------------------
create or replace function elimina_png(p_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare v_camp bigint; v_c bigint;
begin
  select campagna_id into v_camp from png where id = p_id;
  if not found or not e_master(v_camp) then raise exception 'NPC non trovato'; end if;

  for v_c in select id from png where clone_di = p_id loop     -- NUOVO: spariscono anche le copie
    perform _toglie_png(v_c);
  end loop;

  delete from segnalini where png_id = p_id;     -- sparisce anche dalle mappe
  delete from inventari where png_id = p_id;     -- gli oggetti restano nella libreria
  delete from schede    where png_id = p_id;     -- con i suoi incantesimi

  if exists (select 1 from trasferimenti where da_png_id = p_id or a_png_id = p_id) then
    update png set archiviato = true where id = p_id;
    return 'archiviato';
  end if;
  delete from png where id = p_id;
  return 'eliminato';
end $$;

notify pgrst, 'reload schema';
