-- =====================================================================
-- Aggiornamento: Battle map (mappe, segnalini, PF, iniziativa)
--
-- QUANDO ESEGUIRLO
--   Una volta sola, DOPO aggiornamento_png.sql. È un unico blocco: se qualcosa
--   va storto non cambia niente.
--
-- COSA AGGIUNGE
--   mappe           le immagini delle mappe (il file sta nell'archivio privato «mappe»)
--   battle_stato    quale mappa è «in scena», se i giocatori la vedono, di chi è il turno
--   segnalini       i segnalini sulle mappe (PG, NPC o generici come «Goblin 2»)
--   segnalini_pf    i punti ferita mostrati sul segnalino
--
-- CHI VEDE COSA (regole nel database, non nella pagina: non si aggirano)
--   Il master vede tutto.
--   Un giocatore vede UNA sola mappa: quella in scena, e solo se il master la ha mostrata.
--   Un giocatore vede i segnalini di quella mappa, tranne quelli nascosti.
--   I PF di un PG li vedono tutti; quelli di un NPC solo se il master lo decide.
--   Un giocatore sposta soltanto il proprio segnalino.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tabelle
-- ---------------------------------------------------------------------
create table mappe (
  id              bigint generated always as identity primary key,
  campagna_id     bigint not null references campagne(id) on delete cascade,
  nome            text   not null check (length(trim(nome)) > 0),
  percorso        text   not null unique,                      -- es. 7/3f2a….webp, nell'archivio «mappe»
  larghezza_px    integer not null check (larghezza_px > 0),
  altezza_px      integer not null check (altezza_px > 0),
  larghezza_m     numeric(8,2) check (larghezza_m > 0),        -- SCALA: quanto è larga la mappa in metri (vuoto = non calibrata)
  scala_segnalini numeric(5,4) not null default 0.04 check (scala_segnalini between 0.01 and 0.2),  -- diametro di un segnalino medio, in frazione della larghezza
  created_at      timestamptz not null default now()
);
create index mappe_campagna on mappe (campagna_id);

create table battle_stato (
  campagna_id        bigint primary key references campagne(id) on delete cascade,
  mappa_id           bigint references mappe(id) on delete set null,   -- la mappa «in scena»
  visibile           boolean not null default false,                    -- i giocatori la vedono?
  turno_segnalino_id bigint,                                            -- di chi è il turno (chiave estera sotto)
  round              smallint not null default 1,
  versione           bigint not null default 1                          -- sale quando qualcosa sparisce ai giocatori (vedi sotto)
);

create table segnalini (
  id           bigint generated always as identity primary key,
  campagna_id  bigint not null references campagne(id) on delete cascade,
  mappa_id     bigint not null references mappe(id) on delete cascade,
  giocatore_id bigint references giocatori(id) on delete cascade,
  png_id       bigint references png(id) on delete cascade,
  nome         text   not null check (length(trim(nome)) between 1 and 60),
  x            numeric(8,6) not null default 0.5 check (x between 0 and 1),   -- posizione in frazione della mappa:
  y            numeric(8,6) not null default 0.5 check (y between 0 and 1),   -- vale su qualsiasi schermo
  taglia       numeric(3,1) not null default 1 check (taglia between 0.5 and 4),  -- 0,5 piccolo, 1 medio, 2 grande, 3 enorme
  nascosto     boolean not null default false,
  iniziativa   smallint,
  created_at   timestamptz not null default now(),
  check (giocatore_id is null or png_id is null)                      -- collegato a un PG, a un NPC o a nessuno (generico)
);
create index segnalini_mappa on segnalini (mappa_id);
create index segnalini_campagna on segnalini (campagna_id);

alter table battle_stato
  add constraint battle_stato_turno foreign key (turno_segnalino_id) references segnalini(id) on delete set null;

-- I PF di un segnalino stanno in una tabella a parte, per poterli nascondere ai giocatori con una regola.
create table segnalini_pf (
  segnalino_id       bigint primary key references segnalini(id) on delete cascade,
  campagna_id        bigint not null references campagne(id) on delete cascade,
  pf_att             smallint not null default 0 check (pf_att >= 0),
  pf_max             smallint not null default 0 check (pf_max >= 0),
  visibile_giocatori boolean  not null default false,
  check (pf_att <= pf_max)
);


-- ---------------------------------------------------------------------
-- 2. Chi può leggere. Le scritture passano solo dalle funzioni più sotto.
-- ---------------------------------------------------------------------
alter table mappe         enable row level security;
alter table battle_stato  enable row level security;
alter table segnalini     enable row level security;
alter table segnalini_pf  enable row level security;

create policy battle_stato_lettura on battle_stato for select using (e_membro(campagna_id));

-- Il giocatore vede solo la mappa in scena, e solo se è visibile.
create policy mappe_lettura on mappe for select using (
  e_master(campagna_id)
  or exists (select 1 from battle_stato s
             where s.campagna_id = mappe.campagna_id and s.visibile and s.mappa_id = mappe.id and e_membro(mappe.campagna_id))
);

-- Il giocatore vede i segnalini non nascosti della mappa in scena.
create policy segnalini_lettura on segnalini for select using (
  e_master(campagna_id)
  or (not nascosto and exists (select 1 from battle_stato s
        where s.campagna_id = segnalini.campagna_id and s.visibile and s.mappa_id = segnalini.mappa_id and e_membro(segnalini.campagna_id)))
);

-- I PF li vede il master; i giocatori solo se il master li ha resi visibili (e il segnalino lo vedono).
create policy segnalini_pf_lettura on segnalini_pf for select using (
  e_master(campagna_id)
  or (visibile_giocatori and exists (select 1 from segnalini s where s.id = segnalini_pf.segnalino_id))
);


-- ---------------------------------------------------------------------
-- 3. Archivio privato delle immagini delle mappe
--    Il file si chiama  <id campagna>/<codice>.webp
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mappe', 'mappe', false, 5242880, array['image/webp', 'image/jpeg', 'image/png'])    -- [MODIFICA QUI] massimo 5 MB a file
on conflict (id) do nothing;

-- Dal percorso ricava l'id della campagna (vuoto se il percorso non comincia con un numero).
create function _campagna_da_percorso(p_nome text) returns bigint
language sql immutable as $$
  select case when split_part(p_nome, '/', 1) ~ '^[0-9]{1,18}$' then split_part(p_nome, '/', 1)::bigint end
$$;

-- Il master legge i file della sua campagna; un giocatore solo il file della mappa in scena (se visibile).
create policy archivio_mappe_lettura on storage.objects for select to authenticated using (
  bucket_id = 'mappe' and (
    e_master(_campagna_da_percorso(name))
    or exists (select 1 from mappe m join battle_stato s on s.mappa_id = m.id and s.visibile
               where m.percorso = storage.objects.name and e_membro(m.campagna_id))
  )
);
create policy archivio_mappe_inserimento on storage.objects for insert to authenticated
  with check (bucket_id = 'mappe' and e_master(_campagna_da_percorso(name)));
create policy archivio_mappe_modifica on storage.objects for update to authenticated
  using (bucket_id = 'mappe' and e_master(_campagna_da_percorso(name)))
  with check (bucket_id = 'mappe' and e_master(_campagna_da_percorso(name)));
create policy archivio_mappe_eliminazione on storage.objects for delete to authenticated
  using (bucket_id = 'mappe' and e_master(_campagna_da_percorso(name)));


-- ---------------------------------------------------------------------
-- 4. Aggiornamento in tempo reale
--    [ATTENZIONE] Un segnalino che diventa nascosto non manda nessun avviso ai giocatori
--    (non possono più leggerlo, quindi il sistema non glielo dice). Per questo ogni cambiamento
--    che fa sparire qualcosa aumenta «versione»: i giocatori vedono cambiare battle_stato e si
--    rileggono tutto.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table battle_stato'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table segnalini';    exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table segnalini_pf'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table mappe';        exception when duplicate_object then null; end;
  end if;
end $$;

create function _bump_battle(p_camp bigint) returns void
language sql security definer set search_path = public as $$
  insert into battle_stato (campagna_id) values (p_camp)
  on conflict (campagna_id) do update set versione = battle_stato.versione + 1
$$;


-- ---------------------------------------------------------------------
-- 5. Mappe (solo master)
-- ---------------------------------------------------------------------
-- Crea o modifica una mappa. Dopo aver caricato il file nell'archivio, il sito la registra qui.
create function salva_mappa(p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_camp bigint := (p->>'campagna_id')::bigint;
  v_id   bigint := nullif(p->>'id', '')::bigint;
  v_perc text   := nullif(trim(coalesce(p->>'percorso', '')), '');
begin
  if not e_master(v_camp) then raise exception 'Solo il master può gestire le mappe'; end if;
  if nullif(trim(coalesce(p->>'nome', '')), '') is null then raise exception 'La mappa ha bisogno di un nome'; end if;

  if v_id is null then
    -- [MODIFICA QUI] massimo di mappe per campagna: protegge lo spazio gratuito dell'archivio
    if (select count(*) from mappe where campagna_id = v_camp) >= 10 then
      raise exception 'Hai già 10 mappe: eliminane una prima di aggiungerne un’altra';
    end if;
    if v_perc is null or _campagna_da_percorso(v_perc) is distinct from v_camp then
      raise exception 'Il file non appartiene a questa campagna';
    end if;
    insert into mappe (campagna_id, nome, percorso, larghezza_px, altezza_px, larghezza_m, scala_segnalini)
    values (v_camp, trim(p->>'nome'), v_perc, (p->>'larghezza_px')::integer, (p->>'altezza_px')::integer,
            nullif(p->>'larghezza_m', '')::numeric, coalesce(nullif(p->>'scala_segnalini', '')::numeric, 0.04))
    returning id into v_id;
  else
    update mappe set
      nome = trim(p->>'nome'),
      -- [REGOLA] La scala si cambia solo se viene indicata: rinominare una mappa non la cancella (per toglierla si passa vuota).
      larghezza_m = case when p ? 'larghezza_m' then nullif(p->>'larghezza_m', '')::numeric else larghezza_m end,
      scala_segnalini = coalesce(nullif(p->>'scala_segnalini', '')::numeric, scala_segnalini)
    where id = v_id and campagna_id = v_camp;
    if not found then raise exception 'Mappa non trovata'; end if;
  end if;
  return v_id;
end $$;

-- Elimina la mappa e i suoi segnalini. Restituisce il percorso del file, che il sito toglie dall'archivio.
create function elimina_mappa(p_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare v_camp bigint; v_perc text;
begin
  select campagna_id, percorso into v_camp, v_perc from mappe where id = p_id;
  if not found or not e_master(v_camp) then raise exception 'Mappa non trovata'; end if;
  update battle_stato set visibile = false, turno_segnalino_id = null, round = 1 where campagna_id = v_camp and mappa_id = p_id;
  delete from mappe where id = p_id;      -- i segnalini spariscono con lei
  perform _bump_battle(v_camp);
  return v_perc;
end $$;

-- Mette una mappa «in scena» e decide se i giocatori la vedono. p_mappa vuoto = nessuna mappa.
create function imposta_scena(p_camp bigint, p_mappa bigint, p_visibile boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_att bigint;
begin
  if not e_master(p_camp) then raise exception 'Solo il master può cambiare la scena'; end if;
  if p_mappa is not null and not exists (select 1 from mappe where id = p_mappa and campagna_id = p_camp) then
    raise exception 'Mappa non trovata';
  end if;
  select mappa_id into v_att from battle_stato where campagna_id = p_camp;
  insert into battle_stato (campagna_id, mappa_id, visibile) values (p_camp, p_mappa, coalesce(p_visibile, false) and p_mappa is not null)
  on conflict (campagna_id) do update set
    mappa_id = excluded.mappa_id,
    visibile = excluded.visibile,
    -- cambiando mappa il turno riparte da zero
    turno_segnalino_id = case when battle_stato.mappa_id is distinct from excluded.mappa_id then null else battle_stato.turno_segnalino_id end,
    round = case when battle_stato.mappa_id is distinct from excluded.mappa_id then 1 else battle_stato.round end,
    versione = battle_stato.versione + 1;
end $$;


-- ---------------------------------------------------------------------
-- 6. Segnalini
-- ---------------------------------------------------------------------
-- Aggiunge un segnalino (solo master). Se è collegato a un PG o a un NPC prende nome e PF dalla sua scheda.
create function aggiungi_segnalino(p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_camp bigint := (p->>'campagna_id')::bigint;
  v_map  bigint := (p->>'mappa_id')::bigint;
  v_g    bigint := nullif(p->>'giocatore_id', '')::bigint;
  v_p    bigint := nullif(p->>'png_id', '')::bigint;
  v_nome text   := nullif(trim(coalesce(p->>'nome', '')), '');
  v_id   bigint; v_pfa integer; v_pfm integer;
begin
  if not e_master(v_camp) then raise exception 'Solo il master può aggiungere segnalini'; end if;
  if not exists (select 1 from mappe where id = v_map and campagna_id = v_camp) then raise exception 'Mappa non trovata'; end if;
  if v_g is not null and v_p is not null then raise exception 'Un segnalino rappresenta una sola persona'; end if;
  -- [MODIFICA QUI] massimo di segnalini per mappa
  if (select count(*) from segnalini where mappa_id = v_map) >= 80 then raise exception 'Troppi segnalini su questa mappa (massimo 80)'; end if;

  if v_g is not null then
    select nome into v_nome from giocatori where id = v_g and campagna_id = v_camp and ruolo = 'giocatore';
    if not found then raise exception 'Giocatore non valido'; end if;
  elsif v_p is not null then
    select nome into v_nome from png where id = v_p and campagna_id = v_camp and not archiviato;
    if not found then raise exception 'NPC non valido'; end if;
  elsif v_nome is null then
    raise exception 'Il segnalino ha bisogno di un nome';
  end if;

  if (v_g is not null or v_p is not null) and exists (
       select 1 from segnalini where mappa_id = v_map
         and giocatore_id is not distinct from v_g and png_id is not distinct from v_p) then
    raise exception 'Questo personaggio è già sulla mappa';
  end if;

  insert into segnalini (campagna_id, mappa_id, giocatore_id, png_id, nome, x, y, taglia, nascosto)
  values (v_camp, v_map, v_g, v_p, left(v_nome, 60),
          least(1, greatest(0, coalesce(nullif(p->>'x', '')::numeric, 0.5))),
          least(1, greatest(0, coalesce(nullif(p->>'y', '')::numeric, 0.5))),
          coalesce(nullif(p->>'taglia', '')::numeric, 1), coalesce((p->>'nascosto')::boolean, false))
  returning id into v_id;

  -- PF: dalla scheda del personaggio se c'è, altrimenti da quello che scrive il master (segnalini generici)
  select pf_attuali, pf_max into v_pfa, v_pfm from schede
   where (v_g is not null and giocatore_id = v_g) or (v_p is not null and png_id = v_p);
  if not found then
    v_pfm := nullif(p->>'pf_max', '')::integer;
    v_pfa := coalesce(nullif(p->>'pf_att', '')::integer, v_pfm);
  end if;
  if v_pfm is not null then
    insert into segnalini_pf (segnalino_id, campagna_id, pf_att, pf_max, visibile_giocatori)
    values (v_id, v_camp, least(coalesce(v_pfa, v_pfm), v_pfm), v_pfm, v_g is not null);     -- i PF dei PG sono visibili, quelli degli altri no
  end if;
  perform _bump_battle(v_camp);
  return v_id;
end $$;

-- Mette sulla mappa tutti i PG che non ci sono ancora, in fila in basso. Restituisce quanti ne ha aggiunti.
create function aggiungi_pg_alla_mappa(p_camp bigint, p_mappa bigint) returns integer
language plpgsql security definer set search_path = public as $$
declare g record; n integer := 0;
begin
  if not e_master(p_camp) then raise exception 'Solo il master può aggiungere segnalini'; end if;
  for g in select id from giocatori where campagna_id = p_camp and ruolo = 'giocatore'
             and not exists (select 1 from segnalini s where s.mappa_id = p_mappa and s.giocatore_id = giocatori.id)
           order by id loop
    perform aggiungi_segnalino(jsonb_build_object('campagna_id', p_camp, 'mappa_id', p_mappa, 'giocatore_id', g.id,
                                                  'x', 0.12 + 0.09 * (n % 8), 'y', 0.88 - 0.08 * (n / 8)));
    n := n + 1;
  end loop;
  return n;
end $$;

-- Cambia le impostazioni di un segnalino (solo master). Si passa solo ciò che cambia:
--   { "nascosto": true, "taglia": 2, "visibile_pf": true }
create function imposta_segnalino(p_id bigint, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare s segnalini%rowtype; v_cambia boolean := false;
begin
  select * into s from segnalini where id = p_id;
  if not found or not e_master(s.campagna_id) then raise exception 'Segnalino non trovato'; end if;
  if p ? 'nascosto' then update segnalini set nascosto = (p->>'nascosto')::boolean where id = p_id; v_cambia := true; end if;
  if p ? 'taglia' then update segnalini set taglia = (p->>'taglia')::numeric where id = p_id; end if;
  if p ? 'visibile_pf' then
    update segnalini_pf set visibile_giocatori = (p->>'visibile_pf')::boolean where segnalino_id = p_id;
    if not found then raise exception 'Questo segnalino non ha punti ferita'; end if;
    v_cambia := true;
  end if;
  if v_cambia then perform _bump_battle(s.campagna_id); end if;
end $$;

-- Sposta un segnalino. Il master qualsiasi, un giocatore solo il proprio (e solo se la mappa è in scena).
create function muovi_segnalino(p_id bigint, p_x numeric, p_y numeric) returns void
language plpgsql security definer set search_path = public as $$
declare s segnalini%rowtype;
begin
  select * into s from segnalini where id = p_id;
  if not found then raise exception 'Segnalino non trovato'; end if;
  if not e_master(s.campagna_id) then
    if s.giocatore_id is null or s.giocatore_id is distinct from mio_giocatore(s.campagna_id) then
      raise exception 'Puoi muovere solo il tuo segnalino';
    end if;
    if not exists (select 1 from battle_stato b where b.campagna_id = s.campagna_id and b.visibile and b.mappa_id = s.mappa_id) then
      raise exception 'La mappa non è in scena';
    end if;
  end if;
  if p_x is null or p_y is null or p_x < 0 or p_x > 1 or p_y < 0 or p_y > 1 then raise exception 'Posizione non valida'; end if;
  update segnalini set x = p_x, y = p_y where id = p_id;
end $$;

create function elimina_segnalino(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_camp bigint;
begin
  select campagna_id into v_camp from segnalini where id = p_id;
  if not found or not e_master(v_camp) then raise exception 'Segnalino non trovato'; end if;
  delete from segnalini where id = p_id;
  perform _bump_battle(v_camp);
end $$;

-- Cambia il nome dal segnalino. Se rappresenta un PG o un NPC cambia il nome del personaggio, ovunque.
create function rinomina_segnalino(p_id bigint, p_nome text) returns void
language plpgsql security definer set search_path = public as $$
declare s segnalini%rowtype; v_nome text := left(trim(coalesce(p_nome, '')), 60);
begin
  select * into s from segnalini where id = p_id;
  if not found then raise exception 'Segnalino non trovato'; end if;
  if v_nome = '' then raise exception 'Il nome non può essere vuoto'; end if;
  if not e_master(s.campagna_id) and (s.giocatore_id is null or s.giocatore_id is distinct from mio_giocatore(s.campagna_id)) then
    raise exception 'Puoi rinominare solo il tuo segnalino';
  end if;
  if s.giocatore_id is not null then
    update giocatori set nome = v_nome where id = s.giocatore_id;
    update segnalini set nome = v_nome where giocatore_id = s.giocatore_id;
  elsif s.png_id is not null then
    update png set nome = v_nome where id = s.png_id;
    update segnalini set nome = v_nome where png_id = s.png_id;
  else
    update segnalini set nome = v_nome where id = p_id;
  end if;
end $$;

-- Cambia i PF dal segnalino. Se il personaggio ha una scheda, cambia quella (e tutti i suoi segnalini si aggiornano).
-- Un giocatore può cambiare solo i PF attuali del proprio segnalino; il massimo lo cambia il master.
create function imposta_pf_segnalino(p_id bigint, p_att integer, p_max integer) returns void
language plpgsql security definer set search_path = public as $$
declare s segnalini%rowtype; v_master boolean; v_sch schede%rowtype; v_max integer;
begin
  select * into s from segnalini where id = p_id;
  if not found then raise exception 'Segnalino non trovato'; end if;
  v_master := e_master(s.campagna_id);
  if not v_master and (s.giocatore_id is null or s.giocatore_id is distinct from mio_giocatore(s.campagna_id)) then
    raise exception 'Puoi cambiare solo i PF del tuo segnalino';
  end if;
  if p_att is null or p_att < 0 then raise exception 'I PF devono essere un numero da 0 in su'; end if;
  if p_max is not null and not v_master then raise exception 'Solo il master cambia i PF massimi'; end if;
  if p_max is not null and p_max < 0 then raise exception 'I PF massimi devono essere da 0 in su'; end if;

  select * into v_sch from schede where (s.giocatore_id is not null and giocatore_id = s.giocatore_id)
                                     or (s.png_id is not null and png_id = s.png_id);
  if found then
    v_max := coalesce(p_max, v_sch.pf_max);
    update schede set pf_max = v_max, pf_attuali = least(p_att, v_max), updated_at = now() where id = v_sch.id;   -- un trigger aggiorna i segnalini
    insert into segnalini_pf (segnalino_id, campagna_id, pf_att, pf_max, visibile_giocatori)
    values (s.id, s.campagna_id, least(p_att, v_max), v_max, s.giocatore_id is not null)
    on conflict (segnalino_id) do nothing;
  else
    select pf_max into v_max from segnalini_pf where segnalino_id = s.id;
    v_max := coalesce(p_max, v_max, p_att);
    insert into segnalini_pf (segnalino_id, campagna_id, pf_att, pf_max, visibile_giocatori)
    values (s.id, s.campagna_id, least(p_att, v_max), v_max, s.giocatore_id is not null)
    on conflict (segnalino_id) do update set pf_max = excluded.pf_max, pf_att = least(excluded.pf_att, excluded.pf_max);
  end if;
end $$;

-- Quando cambiano i PF di una scheda, i segnalini di quel personaggio si aggiornano da soli.
create function _sync_pf_scheda() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update segnalini_pf p set pf_att = least(new.pf_attuali, new.pf_max), pf_max = new.pf_max
  from segnalini s
  where s.id = p.segnalino_id
    and ((new.giocatore_id is not null and s.giocatore_id = new.giocatore_id)
      or (new.png_id is not null and s.png_id = new.png_id));
  return new;
end $$;

create trigger schede_pf_segnalini
  after update of pf_attuali, pf_max on schede
  for each row execute function _sync_pf_scheda();


-- ---------------------------------------------------------------------
-- 7. Iniziativa e turni
-- ---------------------------------------------------------------------
-- Imposta l'iniziativa di un segnalino (vuoto = la toglie). Il master qualsiasi, un giocatore il proprio.
create function imposta_iniziativa(p_id bigint, p_valore integer) returns void
language plpgsql security definer set search_path = public as $$
declare s segnalini%rowtype;
begin
  select * into s from segnalini where id = p_id;
  if not found then raise exception 'Segnalino non trovato'; end if;
  if not e_master(s.campagna_id) and (s.giocatore_id is null or s.giocatore_id is distinct from mio_giocatore(s.campagna_id)) then
    raise exception 'Puoi impostare solo la tua iniziativa';
  end if;
  if p_valore is not null and (p_valore < -20 or p_valore > 99) then raise exception 'Iniziativa non valida'; end if;
  update segnalini set iniziativa = p_valore where id = p_id;
end $$;

-- Passa al turno successivo (solo master). L'ordine è dall'iniziativa più alta alla più bassa;
-- quando si ricomincia da capo il round aumenta di uno.
create function prossimo_turno(p_camp bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_st battle_stato%rowtype; v_ordine bigint[]; v_idx integer; v_next bigint; v_round smallint;
begin
  if not e_master(p_camp) then raise exception 'Solo il master gestisce i turni'; end if;
  select * into v_st from battle_stato where campagna_id = p_camp for update;
  if not found or v_st.mappa_id is null then raise exception 'Nessuna mappa in scena'; end if;
  select array_agg(id order by iniziativa desc, id) into v_ordine
    from segnalini where mappa_id = v_st.mappa_id and iniziativa is not null;
  if v_ordine is null then raise exception 'Nessun segnalino ha l’iniziativa'; end if;

  v_idx := array_position(v_ordine, v_st.turno_segnalino_id);
  if v_idx is null then
    v_next := v_ordine[1]; v_round := greatest(v_st.round, 1);
  elsif v_idx = array_length(v_ordine, 1) then
    v_next := v_ordine[1]; v_round := v_st.round + 1;
  else
    v_next := v_ordine[v_idx + 1]; v_round := v_st.round;
  end if;
  update battle_stato set turno_segnalino_id = v_next, round = v_round where campagna_id = p_camp;
end $$;

-- Inizia un nuovo scontro: toglie il turno e le iniziative dei segnalini della mappa in scena (solo master).
create function nuovo_combattimento(p_camp bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_map bigint;
begin
  if not e_master(p_camp) then raise exception 'Solo il master gestisce i turni'; end if;
  select mappa_id into v_map from battle_stato where campagna_id = p_camp;
  update segnalini set iniziativa = null where mappa_id = v_map;
  update battle_stato set turno_segnalino_id = null, round = 1 where campagna_id = p_camp;
end $$;


-- ---------------------------------------------------------------------
-- 8. Eliminare un NPC toglie anche i suoi segnalini
--    (stessa funzione di aggiornamento_png.sql, con una riga in più)
-- ---------------------------------------------------------------------
create or replace function elimina_png(p_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare v_camp bigint;
begin
  select campagna_id into v_camp from png where id = p_id;
  if not found or not e_master(v_camp) then raise exception 'NPC non trovato'; end if;

  delete from segnalini where png_id = p_id;     -- NUOVO: sparisce anche dalle mappe
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
