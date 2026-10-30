-- =====================================================================
-- Aggiornamento: tiri di dado condivisi (sopra la mappa e nella cronologia)
--
-- QUANDO ESEGUIRLO
--   Una volta sola, DOPO aggiornamento_battle.sql. È un unico blocco: se qualcosa
--   va storto non cambia niente. Dopo averlo eseguito carica su GitHub i file nuovi.
--
-- COSA AGGIUNGE
--   tiri            ogni tiro fatto dalla scheda o dai «Dadi»: chi, cosa, i dadi usciti
--   registra_tiro   salva un tiro (la pagina usa solo questa funzione per scrivere)
--   mostra_tiro     il master rivela a tutti un tiro nascosto
--   cancella_tiri   il master svuota la cronologia
--
-- CHI VEDE COSA (regole nel database, non nella pagina: non si aggirano)
--   «tutti»    lo vedono tutti i membri della campagna.
--   «master»   lo vedono il master e chi ha tirato (un tiro nascosto richiesto dal master).
--   «segreto»  lo vede solo il master: chi ha tirato non vede il risultato.
--   Il master vede sempre tutto. Un tiro nascosto diventa visibile a tutti quando il master lo mostra.
--   Si conservano gli ultimi 300 tiri di ogni campagna.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tabella
-- ---------------------------------------------------------------------
create table tiri (
  id           bigint generated always as identity primary key,
  campagna_id  bigint not null references campagne(id) on delete cascade,
  giocatore_id bigint references giocatori(id) on delete set null,   -- l'iscrizione di chi ha tirato
  da_master    boolean  not null default false,
  autore       text     not null check (char_length(autore) between 1 and 60),
  titolo       text     not null check (char_length(titolo) between 1 and 120),
  dadi         jsonb    not null default '[]'::jsonb,                -- [{ "s": 20, "v": 14, "scarto": true }]
  bonus        smallint not null default 0,
  fisso        smallint not null default 0,
  totale       integer  not null,
  esito        text     not null default '' check (esito in ('', 'crit', 'fail')),
  vant         text     not null default 'n' check (vant in ('n', 'v', 's')),
  doppio       boolean  not null default false,
  vis          text     not null default 'tutti' check (vis in ('tutti', 'master', 'segreto')),
  rivelato     boolean  not null default false,
  creato       timestamptz not null default now()
);
create index tiri_campagna_idx on tiri (campagna_id, id desc);


-- ---------------------------------------------------------------------
-- 2. Chi può leggere. Le scritture passano solo dalle funzioni più sotto.
-- ---------------------------------------------------------------------
alter table tiri enable row level security;

create policy tiri_lettura on tiri for select using (
  e_master(campagna_id)
  or (e_membro(campagna_id) and (
        vis = 'tutti'
        or rivelato
        or (vis = 'master' and exists (select 1 from giocatori g where g.id = tiri.giocatore_id and g.user_id = auth.uid()))
  ))
);


-- ---------------------------------------------------------------------
-- 3. Aggiornamento in tempo reale
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table tiri'; exception when duplicate_object then null; end;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 4. Funzioni
-- ---------------------------------------------------------------------
-- Salva un tiro. p = { campagna_id, nome, titolo, dadi:[{s,v,scarto}], bonus, fisso, esito, vant, doppio, vis }
-- Il totale lo calcola il database sommando i dadi non scartati.
create function registra_tiro(p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_camp  bigint := (p->>'campagna_id')::bigint;
  v_me    giocatori%rowtype;
  v_vis   text := coalesce(p->>'vis', 'tutti');
  v_dadi  jsonb := coalesce(p->'dadi', '[]'::jsonb);
  v_bonus int := coalesce((p->>'bonus')::int, 0);
  v_fisso int := coalesce((p->>'fisso')::int, 0);
  v_tot   int;
  v_esito text := coalesce(p->>'esito', '');
  v_vant  text := coalesce(p->>'vant', 'n');
  v_nome  text;
  v_id    bigint;
  d       jsonb;
  v_s     int;
  v_v     int;
begin
  select * into v_me from giocatori where campagna_id = v_camp and user_id = auth.uid() order by id limit 1;
  if not found then raise exception 'Non fai parte di questa campagna'; end if;
  if v_vis not in ('tutti', 'master', 'segreto') then raise exception 'Visibilità non valida'; end if;
  if v_esito not in ('', 'crit', 'fail') then v_esito := ''; end if;
  if v_vant not in ('n', 'v', 's') then v_vant := 'n'; end if;
  if jsonb_typeof(v_dadi) <> 'array' or jsonb_array_length(v_dadi) > 40 then raise exception 'Dadi non validi'; end if;
  if v_bonus not between -100 and 100 or v_fisso not between -1000 and 1000 then raise exception 'Modificatore non valido'; end if;
  if coalesce(trim(p->>'titolo'), '') = '' then raise exception 'Manca la descrizione del tiro'; end if;

  v_tot := v_bonus + v_fisso;
  for d in select * from jsonb_array_elements(v_dadi) loop
    v_s := (d->>'s')::int; v_v := (d->>'v')::int;
    -- s = 3 è il dado Fudge (valori -1, 0, +1); gli altri vanno da 1 al numero di facce
    if v_s is null or v_v is null or v_s not in (3, 4, 6, 8, 10, 12, 20, 100)
       or (v_s = 3 and v_v not between -1 and 1) or (v_s <> 3 and v_v not between 1 and v_s) then
      raise exception 'Dado non valido';
    end if;
    if not coalesce((d->>'scarto')::boolean, false) then v_tot := v_tot + v_v; end if;
  end loop;

  -- Un giocatore firma con il nome del proprio personaggio; il master può firmare con il nome dell'NPC che sta usando.
  v_nome := case when e_master(v_camp) then coalesce(nullif(left(trim(p->>'nome'), 60), ''), 'Master') else left(v_me.nome, 60) end;

  insert into tiri (campagna_id, giocatore_id, da_master, autore, titolo, dadi, bonus, fisso, totale, esito, vant, doppio, vis)
  values (v_camp, v_me.id, e_master(v_camp), v_nome, left(trim(p->>'titolo'), 120), v_dadi, v_bonus, v_fisso, v_tot,
          v_esito, v_vant, coalesce((p->>'doppio')::boolean, false), v_vis)
  returning id into v_id;

  -- Si tengono gli ultimi 300 tiri della campagna.
  delete from tiri where campagna_id = v_camp
    and id not in (select id from tiri where campagna_id = v_camp order by id desc limit 300);
  return v_id;
end $$;

-- Il master rivela a tutti un tiro nascosto.
create function mostra_tiro(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_camp bigint;
begin
  select campagna_id into v_camp from tiri where id = p_id;
  if v_camp is null then raise exception 'Tiro non trovato'; end if;
  if not e_master(v_camp) then raise exception 'Solo il master può mostrare un tiro'; end if;
  update tiri set rivelato = true where id = p_id;
end $$;

-- Il master svuota la cronologia dei tiri.
create function cancella_tiri(p_camp bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not e_master(p_camp) then raise exception 'Solo il master può cancellare la cronologia'; end if;
  delete from tiri where campagna_id = p_camp;
end $$;
