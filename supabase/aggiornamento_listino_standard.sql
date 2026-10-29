-- =====================================================================
-- Aggiornamento: listino standard copiabile da ogni master e servizi
-- visibili solo al master.
--
-- QUANDO ESEGUIRLO
--   Una volta sola, nello SQL Editor di Supabase, DOPO tutti gli altri
--   file (l'ultimo eseguito è aggiornamento_battle.sql).
--   È un unico blocco: se qualcosa va storto non cambia niente.
--
-- COSA FA
--   1. Segna quale campagna contiene il LISTINO STANDARD (una sola).
--   2. I servizi (taverne, alloggi, viaggi, svaghi) li legge solo il master.
--      Gli oggetti erano già visibili solo al master e a chi li possiede.
--   3. Crea la funzione copia_listino_standard(campagna): copia nella
--      campagna del master gli oggetti (con armi, armature, cibo, oggetti
--      vari e segreti) e i servizi del listino standard.
--        - Salta le voci che la campagna ha già, anche se scritte con
--          maiuscole o spazi diversi: non tocca le modifiche del master.
--        - Si può rilanciare quando aggiungi voci al listino standard.
--        - Ogni master modifica poi la propria copia senza toccare le altre.
--
-- NON TOCCA: oggetti, inventari, storico, schede e PNG già presenti.
--
-- DOPO L'ESECUZIONE, per dare il listino a un master (esempio: campagna 2):
--   select copia_listino_standard(2);
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Quale campagna è il listino standard
-- ---------------------------------------------------------------------
alter table campagne
  add column if not exists listino_standard boolean not null default false;

-- Una sola campagna alla volta può essere il listino standard.
create unique index if not exists campagne_una_sola_standard
  on campagne ((true)) where listino_standard;


-- ---------------------------------------------------------------------
-- 2. I servizi li vede solo il master
-- ---------------------------------------------------------------------
drop policy if exists servizi_lettura on servizi;
create policy servizi_lettura on servizi
  for select using (e_master(campagna_id));


-- ---------------------------------------------------------------------
-- 3. Funzione di appoggio: elenco delle colonne da copiare di una tabella
--    (esclude le colonne indicate, quelle automatiche e quelle calcolate)
--    Uso interno: non è chiamabile dal sito.
-- ---------------------------------------------------------------------
create or replace function _colonne_copia(p_tabella text, p_escludi text[], p_prefisso text default '')
returns text
language sql
stable
security definer
set search_path = public
as $$
  select string_agg(p_prefisso || quote_ident(column_name::text), ', ' order by ordinal_position)
  from information_schema.columns
  where table_schema = 'public'
    and table_name = p_tabella
    and column_name::text <> all (p_escludi)
    and is_generated = 'NEVER'
    and is_identity = 'NO'
$$;

revoke all on function _colonne_copia(text, text[], text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 4. Copia del listino standard nella campagna del master
-- ---------------------------------------------------------------------
create or replace function copia_listino_standard(p_camp bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src        bigint;
  v_max        bigint;
  v_cols       text;
  v_t          text;
  v_ogg        integer := 0;
  v_ogg_salt   integer := 0;
  v_serv       integer := 0;
  v_serv_salt  integer := 0;
begin
  -- Solo il master di quella campagna (oppure chi lavora dallo SQL Editor).
  if not (e_master(p_camp) or session_user = 'postgres') then
    raise exception 'Solo il master può copiare il listino standard';
  end if;
  if not exists (select 1 from campagne where id = p_camp) then
    raise exception 'Campagna non trovata';
  end if;

  select id into v_src from campagne where listino_standard;
  if v_src is null then
    raise exception 'Nessuna campagna è stata scelta come listino standard';
  end if;
  if v_src = p_camp then
    raise exception 'Questa è la campagna del listino standard: non c''è nulla da copiare';
  end if;

  -- Due copie contemporanee nella stessa campagna creerebbero doppioni.
  perform pg_advisory_xact_lock(p_camp);

  -- ---------------- Oggetti ----------------
  -- Una voce per nome (la più vecchia), solo quelle non archiviate.
  drop table if exists pg_temp._sel;
  create temp table _sel on commit drop as
    select min(o.id) as old_id
    from oggetti o
    where o.campagna_id = v_src and not o.archiviato
    group by lower(trim(o.nome));

  -- Via quelle che la campagna ha già.
  delete from _sel s
  using oggetti o
  where o.id = s.old_id
    and exists (select 1 from oggetti d
                where d.campagna_id = p_camp and not d.archiviato
                  and lower(trim(d.nome)) = lower(trim(o.nome)));
  get diagnostics v_ogg_salt = row_count;

  select coalesce(max(id), 0) into v_max from oggetti;

  v_cols := _colonne_copia('oggetti', array['id', 'campagna_id', 'created_at']);
  execute format(
    'insert into oggetti (campagna_id, %s) select $1, %s from oggetti where id in (select old_id from _sel)',
    v_cols, v_cols) using p_camp;
  get diagnostics v_ogg = row_count;

  -- Collegamento vecchio id -> nuovo id (le copie hanno nomi tutti diversi).
  drop table if exists pg_temp._map;
  create temp table _map on commit drop as
    select s.old_id, n.id as new_id
    from _sel s
    join oggetti o on o.id = s.old_id
    join oggetti n on n.campagna_id = p_camp
                  and n.id > v_max
                  and lower(trim(n.nome)) = lower(trim(o.nome));

  -- Tabelle dei dettagli: stesse righe, collegate agli oggetti nuovi.
  foreach v_t in array array['armi', 'armature', 'cibo', 'oggetti_vari', 'oggetti_segreti'] loop
    v_cols := _colonne_copia(v_t, array['id', 'oggetto_id']);
    execute format(
      'insert into %I (oggetto_id, %s) select m.new_id, %s from %I t join _map m on m.old_id = t.oggetto_id',
      v_t, v_cols, _colonne_copia(v_t, array['id', 'oggetto_id'], 't.'), v_t);
  end loop;

  -- I segreti della copia partono da "non rivelati".
  update oggetti_segreti set rivelato = false
  where oggetto_id in (select new_id from _map);

  -- ---------------- Servizi ----------------
  drop table if exists pg_temp._sels;
  create temp table _sels on commit drop as
    select min(s.id) as old_id
    from servizi s
    where s.campagna_id = v_src
    group by lower(trim(s.nome));

  delete from _sels x
  using servizi s
  where s.id = x.old_id
    and exists (select 1 from servizi d
                where d.campagna_id = p_camp
                  and lower(trim(d.nome)) = lower(trim(s.nome)));
  get diagnostics v_serv_salt = row_count;

  v_cols := _colonne_copia('servizi', array['id', 'campagna_id', 'created_at']);
  execute format(
    'insert into servizi (campagna_id, %s) select $1, %s from servizi where id in (select old_id from _sels)',
    v_cols, v_cols) using p_camp;
  get diagnostics v_serv = row_count;

  return jsonb_build_object(
    'oggetti_creati',  v_ogg,
    'oggetti_saltati', v_ogg_salt,
    'servizi_creati',  v_serv,
    'servizi_saltati', v_serv_salt);
end $$;

revoke all on function copia_listino_standard(bigint) from public, anon;
grant execute on function copia_listino_standard(bigint) to authenticated;


-- ---------------------------------------------------------------------
-- 5. Scelta del listino standard
--    Qui: la campagna con id 1 (ProvaCampagna), quella dove hai già il
--    listino. Se vuoi un'altra campagna cambia il numero.
--    Si può cambiare più avanti con:
--      update campagne set listino_standard = false;
--      update campagne set listino_standard = true where id = NUMERO;
-- ---------------------------------------------------------------------
update campagne set listino_standard = false where listino_standard;
update campagne set listino_standard = true where id = 1;


notify pgrst, 'reload schema';
