-- =====================================================================
-- Aggiornamento: listini in Drakos (monete in rame), nuove categorie di
-- armatura, servizi, monete sulla scheda e importazione in blocco.
--
-- QUANDO ESEGUIRLO
--   Una volta sola, nello SQL Editor, DOPO aggiornamento_incantesimi.sql.
--   È un unico blocco: se qualcosa va storto non cambia niente.
--
-- COSA FA
--   1. Prezzi in rame (1 Ra, 100 Ra = 1 Ar, 10.000 Ra = 1 Or, 1.000.000 Ra = 1 Pt).
--   2. Pesi fino a 999.999 kg (le macchine d'assedio superano 1.000 kg).
--   3. Nuovi campi sugli oggetti: nome inglese, tipologia, unità, note di regola.
--   4. Armature: categorie "accessorio" (elmi, protezioni degli arti) e "bardatura".
--   5. Tabella dei servizi (taverne, alloggi, viaggi, svaghi).
--   6. Monete sulla scheda e peso di una moneta (modificabile).
--   7. Funzioni per importare molti oggetti o servizi in una volta e per svuotare la libreria.
--
-- NON TOCCA: oggetti, inventari, storico, schede e incantesimi già presenti.
-- Gli oggetti di prova restano come sono, con il prezzo "da definire".
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Nuove categorie di armatura
-- [ATTENZIONE] I nuovi valori si possono usare solo dopo la fine di questo
-- blocco: per questo qui sotto nessuna riga li usa, lo faranno le funzioni
-- quando le chiama il sito.
-- ---------------------------------------------------------------------
alter type categoria_armatura add value if not exists 'accessorio';  -- elmi, protezioni degli arti
alter type categoria_armatura add value if not exists 'bardatura';   -- CA della cavalcatura, non di chi la monta


-- ---------------------------------------------------------------------
-- 2. Oggetti: nuovi campi e pesi più grandi
-- ---------------------------------------------------------------------
alter table oggetti
  add column nome_en       text,                                   -- es. "Longsword" (il nome italiano resta in "nome")
  add column tipologia     text,                                   -- es. "Spade", "Pane e Cereali", "Illuminazione"
  add column unita         text,                                   -- a cosa si riferiscono prezzo e peso: "pagnotta", "boccale", "libbra"
  add column costo_rame    integer check (costo_rame >= 0),        -- [REGOLA] il prezzo è sempre salvato in rame
  add column regole_extra  text;                                   -- vantaggio/svantaggio e altre regole della casa, in testo

-- Peso in kg: da 999,999 a 999.999,999 (la Torre d'assedio pesa 4.400 kg).
alter table oggetti alter column peso type numeric(9,3);

comment on column oggetti.costo_rame is 'Prezzo in Drakos di Rame. 1 Ar = 100, 1 Or = 10.000, 1 Pt = 1.000.000.';


-- ---------------------------------------------------------------------
-- 3. Armature: regole degli accessori
-- ---------------------------------------------------------------------
alter table armature
  add column gruppo       text check (gruppo in ('arti')),         -- protezioni degli arti: tre pezzi indossati insieme danno +1 CA in totale
  add column include_elmo boolean not null default false;          -- l'armatura completa ha già l'elmo: un elmo separato non aggiunge CA


-- ---------------------------------------------------------------------
-- 4. Servizi: taverne, alloggi, viaggi, svaghi
--    Non si portano nello zaino: sono un listino prezzi della campagna.
-- ---------------------------------------------------------------------
create table servizi (
  id          bigint generated always as identity primary key,
  campagna_id bigint not null references campagne(id) on delete cascade,
  nome        text   not null check (length(trim(nome)) > 0),
  nome_en     text,
  tipologia   text,                                                -- "Taverne e Locande", "Alloggi", "Viaggi e Trasporti", "Svago e Relax"
  unita       text,                                                -- "a notte", "a persona", "pasto e boccale"
  costo_rame  integer not null check (costo_rame >= 0),
  descrizione text,
  created_at  timestamptz not null default now()
);
create unique index servizi_nome on servizi (campagna_id, lower(trim(nome)));

alter table servizi enable row level security;
-- Il listino lo leggono tutti i membri della campagna; le scritture passano dalle funzioni.
create policy servizi_lettura on servizi for select using (e_membro(campagna_id));


-- ---------------------------------------------------------------------
-- 5. Monete sulla scheda e peso di una moneta
-- ---------------------------------------------------------------------
alter table schede
  add column monete jsonb not null default '{"ra":0,"ar":0,"or":0,"pt":0}'   -- rame, argento, oro, platino
  check (jsonb_typeof(monete) = 'object');

-- [MODIFICA QUI] Peso di una moneta in kg. 0,01 = 50 monete per libbra (regola di D&D).
alter table campagne
  add column peso_moneta_kg numeric(6,4) not null default 0.01 check (peso_moneta_kg >= 0);


-- ---------------------------------------------------------------------
-- 6. salva_oggetto: versione con i campi nuovi
--    Uguale a quella di aggiornamento_unita.sql, più: nome_en, tipologia,
--    unita, costo_rame, regole_extra e i campi degli accessori.
--    (valore e valuta restano accettati, per gli oggetti di prova.)
-- ---------------------------------------------------------------------
create or replace function salva_oggetto(p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_camp bigint := (p->>'campagna_id')::bigint;
  v_id   bigint;
  v_cat  categoria_oggetto;
  v_d    jsonb := coalesce(p->'dettagli', '{}'::jsonb);
  v_seg  text  := nullif(trim(coalesce(p->>'segreto', '')), '');
begin
  if not e_master(v_camp) then raise exception 'Solo il master può salvare oggetti'; end if;
  if nullif(trim(coalesce(p->>'nome', '')), '') is null then
    raise exception 'Il nome è obbligatorio';
  end if;

  if nullif(p->>'id', '') is null then
    v_cat := (p->>'categoria')::categoria_oggetto;
    insert into oggetti (campagna_id, nome, nome_en, tipologia, unita, descrizione, categoria,
                         peso, valore, valuta, costo_rame, impilabile, bonus,
                         effetto_condizionale, regole_extra)
    values (v_camp, trim(p->>'nome'), nullif(trim(coalesce(p->>'nome_en', '')), ''),
            nullif(trim(coalesce(p->>'tipologia', '')), ''), nullif(trim(coalesce(p->>'unita', '')), ''),
            nullif(p->>'descrizione', ''), v_cat,
            nullif(p->>'peso', '')::numeric, nullif(p->>'valore', '')::integer,
            coalesce(nullif(p->>'valuta', ''), 'mo')::tipo_valuta,
            nullif(p->>'costo_rame', '')::integer,
            coalesce((p->>'impilabile')::boolean, false),
            nullif(p->>'bonus', ''), nullif(p->>'effetto_condizionale', ''),
            nullif(p->>'regole_extra', ''))
    returning id into v_id;
  else
    v_id := (p->>'id')::bigint;
    select categoria into v_cat from oggetti where id = v_id and campagna_id = v_camp;
    if not found then raise exception 'Oggetto non trovato'; end if;
    update oggetti set
      nome = trim(p->>'nome'),
      nome_en = nullif(trim(coalesce(p->>'nome_en', '')), ''),
      tipologia = nullif(trim(coalesce(p->>'tipologia', '')), ''),
      unita = nullif(trim(coalesce(p->>'unita', '')), ''),
      descrizione = nullif(p->>'descrizione', ''),
      peso = nullif(p->>'peso', '')::numeric,
      valore = nullif(p->>'valore', '')::integer,
      valuta = coalesce(nullif(p->>'valuta', ''), 'mo')::tipo_valuta,
      costo_rame = nullif(p->>'costo_rame', '')::integer,
      impilabile = coalesce((p->>'impilabile')::boolean, false),
      bonus = nullif(p->>'bonus', ''),
      effetto_condizionale = nullif(p->>'effetto_condizionale', ''),
      regole_extra = nullif(p->>'regole_extra', '')
    where id = v_id;
  end if;

  -- Proprietà nascosta (solo master finché non viene rivelata)
  if v_seg is null then
    delete from oggetti_segreti where oggetto_id = v_id;
  else
    insert into oggetti_segreti (oggetto_id, testo) values (v_id, v_seg)
    on conflict (oggetto_id) do update set
      testo = excluded.testo,
      rivelato = case when oggetti_segreti.testo = excluded.testo then oggetti_segreti.rivelato else false end;
  end if;

  -- Dati specifici della categoria
  if v_cat = 'arma' then
    insert into armi (oggetto_id, categoria_arma, modalita, danno, tipo_danno, danno_versatile,
                      proprieta, padronanza, gittata_normale, gittata_massima, munizioni_tipo,
                      bonus_attacco, equipaggio_richiesto, ricarica_turni, requisiti)
    values (v_id,
            coalesce(nullif(v_d->>'categoria_arma', ''), 'semplice')::categoria_arma,
            (v_d->>'modalita')::modalita_arma,
            trim(v_d->>'danno'), trim(v_d->>'tipo_danno'),
            nullif(v_d->>'danno_versatile', ''),
            array(select jsonb_array_elements_text(coalesce(v_d->'proprieta', '[]'::jsonb))),
            nullif(v_d->>'padronanza', ''),
            nullif(v_d->>'gittata_normale', '')::numeric,
            nullif(v_d->>'gittata_massima', '')::numeric,
            nullif(v_d->>'munizioni_tipo', ''),
            coalesce(nullif(v_d->>'bonus_attacco', '')::smallint, 0),
            nullif(v_d->>'equipaggio_richiesto', '')::smallint,
            nullif(v_d->>'ricarica_turni', '')::smallint,
            nullif(v_d->>'requisiti', ''))
    on conflict (oggetto_id) do update set
      (categoria_arma, modalita, danno, tipo_danno, danno_versatile, proprieta, padronanza,
       gittata_normale, gittata_massima, munizioni_tipo, bonus_attacco, equipaggio_richiesto,
       ricarica_turni, requisiti)
      = (excluded.categoria_arma, excluded.modalita, excluded.danno, excluded.tipo_danno,
         excluded.danno_versatile, excluded.proprieta, excluded.padronanza,
         excluded.gittata_normale, excluded.gittata_massima, excluded.munizioni_tipo,
         excluded.bonus_attacco, excluded.equipaggio_richiesto, excluded.ricarica_turni,
         excluded.requisiti);

  elsif v_cat = 'armatura' then
    insert into armature (oggetto_id, categoria_armatura, ca_base, usa_destrezza, max_destrezza,
                          forza_minima, svantaggio_furtivita, tempo_indossare, tempo_togliere,
                          requisiti, gruppo, include_elmo)
    values (v_id,
            (v_d->>'categoria_armatura')::categoria_armatura,
            (v_d->>'ca_base')::smallint,
            coalesce((v_d->>'usa_destrezza')::boolean, false),
            nullif(v_d->>'max_destrezza', '')::smallint,
            nullif(v_d->>'forza_minima', '')::smallint,
            coalesce((v_d->>'svantaggio_furtivita')::boolean, false),
            nullif(v_d->>'tempo_indossare', '')::smallint,
            nullif(v_d->>'tempo_togliere', '')::smallint,
            nullif(v_d->>'requisiti', ''),
            nullif(v_d->>'gruppo', ''),
            coalesce((v_d->>'include_elmo')::boolean, false))
    on conflict (oggetto_id) do update set
      (categoria_armatura, ca_base, usa_destrezza, max_destrezza, forza_minima,
       svantaggio_furtivita, tempo_indossare, tempo_togliere, requisiti, gruppo, include_elmo)
      = (excluded.categoria_armatura, excluded.ca_base, excluded.usa_destrezza,
         excluded.max_destrezza, excluded.forza_minima, excluded.svantaggio_furtivita,
         excluded.tempo_indossare, excluded.tempo_togliere, excluded.requisiti,
         excluded.gruppo, excluded.include_elmo);

  elsif v_cat = 'cibo' then
    insert into cibo (oggetto_id, effetto, razioni, deperibile_giorni)
    values (v_id, nullif(v_d->>'effetto', ''),
            coalesce(nullif(v_d->>'razioni', '')::smallint, 1),
            nullif(v_d->>'deperibile_giorni', '')::smallint)
    on conflict (oggetto_id) do update set
      (effetto, razioni, deperibile_giorni)
      = (excluded.effetto, excluded.razioni, excluded.deperibile_giorni);

  else
    insert into oggetti_vari (oggetto_id, effetto, utilizzi, requisiti, di_trama)
    values (v_id, nullif(v_d->>'effetto', ''),
            nullif(v_d->>'utilizzi', '')::smallint,
            nullif(v_d->>'requisiti', ''),
            coalesce((v_d->>'di_trama')::boolean, false))
    on conflict (oggetto_id) do update set
      (effetto, utilizzi, requisiti, di_trama)
      = (excluded.effetto, excluded.utilizzi, excluded.requisiti, excluded.di_trama);
  end if;

  return v_id;
end $$;


-- ---------------------------------------------------------------------
-- 7. Importazione in blocco (solo master)
--    Il sito la chiama a gruppi di circa 100 voci, per non superare i tempi
--    massimi di Supabase. Ogni voce è indipendente: se una ha un errore, le
--    altre vengono salvate lo stesso e l'errore torna nel risultato.
--    [REGOLA] Un nome già presente nella campagna (non archiviato) viene saltato,
--    così si può rilanciare l'importazione senza creare doppioni.
-- ---------------------------------------------------------------------
create function importa_oggetti(p_camp bigint, p_lista jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r      jsonb;
  v_ok   integer := 0;
  v_salt integer := 0;
  v_err  jsonb := '[]'::jsonb;
begin
  if not e_master(p_camp) then raise exception 'Solo il master può importare oggetti'; end if;
  if jsonb_typeof(p_lista) is distinct from 'array' then raise exception 'La lista non è valida'; end if;

  for r in select value from jsonb_array_elements(p_lista) loop
    begin
      if exists (select 1 from oggetti
                 where campagna_id = p_camp and not archiviato
                   and lower(trim(nome)) = lower(trim(coalesce(r->>'nome', '')))) then
        v_salt := v_salt + 1;
      else
        perform salva_oggetto((r - 'id') || jsonb_build_object('campagna_id', p_camp));
        v_ok := v_ok + 1;
      end if;
    exception when others then
      v_err := v_err || jsonb_build_array(jsonb_build_object('nome', r->>'nome', 'errore', sqlerrm));
    end;
  end loop;

  return jsonb_build_object('creati', v_ok, 'saltati', v_salt, 'errori', v_err);
end $$;

-- Svuota la libreria: elimina gli oggetti mai usati e archivia quelli già comparsi nello storico.
-- Serve per togliere gli oggetti di prova prima di importare i listini.
-- [ATTENZIONE] Toglie anche gli oggetti dagli inventari. Il sito chiede conferma.
create function svuota_libreria(p_camp bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint; v_el integer := 0; v_ar integer := 0;
begin
  if not e_master(p_camp) then raise exception 'Solo il master può svuotare la libreria'; end if;
  for v_id in select id from oggetti where campagna_id = p_camp and not archiviato loop
    if elimina_oggetto(v_id) = 'eliminato' then v_el := v_el + 1; else v_ar := v_ar + 1; end if;
  end loop;
  return jsonb_build_object('eliminati', v_el, 'archiviati', v_ar);
end $$;


-- ---------------------------------------------------------------------
-- 8. Servizi: salva, elimina, importa (solo master)
-- ---------------------------------------------------------------------
create function salva_servizio(p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_camp bigint := (p->>'campagna_id')::bigint;
  v_id   bigint := nullif(p->>'id', '')::bigint;
begin
  if not e_master(v_camp) then raise exception 'Solo il master può salvare i servizi'; end if;
  if nullif(trim(coalesce(p->>'nome', '')), '') is null then raise exception 'Il nome è obbligatorio'; end if;

  if v_id is null then
    insert into servizi (campagna_id, nome, nome_en, tipologia, unita, costo_rame, descrizione)
    values (v_camp, trim(p->>'nome'), nullif(trim(coalesce(p->>'nome_en', '')), ''),
            nullif(trim(coalesce(p->>'tipologia', '')), ''), nullif(trim(coalesce(p->>'unita', '')), ''),
            coalesce(nullif(p->>'costo_rame', '')::integer, 0), nullif(p->>'descrizione', ''))
    returning id into v_id;
  else
    update servizi set
      nome = trim(p->>'nome'),
      nome_en = nullif(trim(coalesce(p->>'nome_en', '')), ''),
      tipologia = nullif(trim(coalesce(p->>'tipologia', '')), ''),
      unita = nullif(trim(coalesce(p->>'unita', '')), ''),
      costo_rame = coalesce(nullif(p->>'costo_rame', '')::integer, 0),
      descrizione = nullif(p->>'descrizione', '')
    where id = v_id and campagna_id = v_camp;
    if not found then raise exception 'Servizio non trovato'; end if;
  end if;
  return v_id;
end $$;

create function elimina_servizio(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_camp bigint;
begin
  select campagna_id into v_camp from servizi where id = p_id;
  if not found or not e_master(v_camp) then raise exception 'Servizio non trovato'; end if;
  delete from servizi where id = p_id;
end $$;

create function importa_servizi(p_camp bigint, p_lista jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r      jsonb;
  v_ok   integer := 0;
  v_salt integer := 0;
  v_err  jsonb := '[]'::jsonb;
begin
  if not e_master(p_camp) then raise exception 'Solo il master può importare i servizi'; end if;
  if jsonb_typeof(p_lista) is distinct from 'array' then raise exception 'La lista non è valida'; end if;

  for r in select value from jsonb_array_elements(p_lista) loop
    begin
      if exists (select 1 from servizi
                 where campagna_id = p_camp and lower(trim(nome)) = lower(trim(coalesce(r->>'nome', '')))) then
        v_salt := v_salt + 1;
      else
        perform salva_servizio((r - 'id') || jsonb_build_object('campagna_id', p_camp));
        v_ok := v_ok + 1;
      end if;
    exception when others then
      v_err := v_err || jsonb_build_array(jsonb_build_object('nome', r->>'nome', 'errore', sqlerrm));
    end;
  end loop;

  return jsonb_build_object('creati', v_ok, 'saltati', v_salt, 'errori', v_err);
end $$;


-- ---------------------------------------------------------------------
-- 9. Monete e peso di una moneta
-- ---------------------------------------------------------------------
-- Cambia le monete di una scheda. Si passa solo ciò che cambia, per esempio {"or": 12, "ar": 40}.
-- Il giocatore tocca la propria scheda, il master tutte.
create function aggiorna_monete(p_id bigint, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_m jsonb;
  v_k text;
  v_n numeric;
begin
  if not puo_modificare_scheda(p_id) then raise exception 'Non puoi modificare questa scheda'; end if;
  if jsonb_typeof(p) is distinct from 'object' then raise exception 'Monete non valide'; end if;

  select monete into v_m from schede where id = p_id for update;
  foreach v_k in array array['ra', 'ar', 'or', 'pt'] loop
    if p ? v_k then
      v_n := (p->>v_k)::numeric;
      if v_n < 0 or v_n <> trunc(v_n) or v_n > 1000000000 then
        raise exception 'Le monete devono essere numeri interi da 0 in su';
      end if;
      v_m := jsonb_set(v_m, array[v_k], to_jsonb(v_n::bigint));
    end if;
  end loop;

  update schede set monete = v_m, updated_at = now() where id = p_id;
end $$;

create function imposta_peso_moneta(p_camp bigint, p_kg numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not e_master(p_camp) then raise exception 'Solo il master può cambiare questa impostazione'; end if;
  if p_kg is null or p_kg < 0 or p_kg > 9 then raise exception 'Peso non valido'; end if;
  update campagne set peso_moneta_kg = p_kg where id = p_camp;
end $$;


-- Fa rileggere subito a Supabase le nuove tabelle e funzioni.
notify pgrst, 'reload schema';
