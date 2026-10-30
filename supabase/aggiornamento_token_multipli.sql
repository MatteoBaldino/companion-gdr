-- =====================================================================
-- Aggiornamento: più token dello stesso personaggio sulla Battle map
--
-- QUANDO ESEGUIRLO
--   Una volta sola, DOPO aggiornamento_battle.sql. È un unico blocco: se qualcosa
--   va storto non cambia niente. Dopo averlo eseguito carica su GitHub i file nuovi.
--
-- COSA CAMBIA
--   aggiungi_segnalino   lo stesso PG o NPC può avere più token sulla stessa mappa
--                        (il secondo si chiama «Goblin 2», il terzo «Goblin 3»…).
--                        Il master aggiunge token di chiunque. Un giocatore solo del PROPRIO
--                        personaggio, solo se la mappa è in scena, fino a 10 per mappa.
--                        Gli NPC li aggiunge solo il master.
--   elimina_segnalino    oltre al master, un giocatore può togliere i token del proprio personaggio.
--   rinomina_segnalino   rinominare un token cambia solo il suo nome; solo il token che porta il nome
--                        del personaggio rinomina anche il personaggio (come prima).
--
-- NON CAMBIA
--   Nascondere un token resta solo del master (imposta_segnalino). I PF restano quelli della scheda:
--   tutti i token dello stesso personaggio mostrano gli stessi PF. L'iniziativa è di ogni token.
-- =====================================================================


create or replace function aggiungi_segnalino(p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_camp   bigint := (p->>'campagna_id')::bigint;
  v_map    bigint := (p->>'mappa_id')::bigint;
  v_g      bigint := nullif(p->>'giocatore_id', '')::bigint;
  v_p      bigint := nullif(p->>'png_id', '')::bigint;
  v_nome   text   := nullif(left(trim(coalesce(p->>'nome', '')), 60), '');
  v_master boolean := e_master(v_camp);
  v_base   text;
  v_n      integer;
  v_id     bigint; v_pfa integer; v_pfm integer;
  v_max_pg constant integer := 10;      -- [MODIFICA QUI] token di un PG su una mappa, se li aggiunge il giocatore
begin
  if not v_master then
    if v_g is null or v_p is not null or v_g is distinct from mio_giocatore(v_camp) then
      raise exception 'Puoi aggiungere solo token del tuo personaggio';
    end if;
    if not exists (select 1 from battle_stato b where b.campagna_id = v_camp and b.visibile and b.mappa_id = v_map) then
      raise exception 'La mappa non è in scena';
    end if;
    if (select count(*) from segnalini where mappa_id = v_map and giocatore_id = v_g) >= v_max_pg then
      raise exception 'Hai già % token su questa mappa', v_max_pg;
    end if;
  end if;
  if not exists (select 1 from mappe where id = v_map and campagna_id = v_camp) then raise exception 'Mappa non trovata'; end if;
  if v_g is not null and v_p is not null then raise exception 'Un segnalino rappresenta una sola persona'; end if;
  -- [MODIFICA QUI] massimo di segnalini per mappa
  if (select count(*) from segnalini where mappa_id = v_map) >= 80 then raise exception 'Troppi segnalini su questa mappa (massimo 80)'; end if;

  if v_g is not null then
    select nome into v_base from giocatori where id = v_g and campagna_id = v_camp and ruolo = 'giocatore';
    if not found then raise exception 'Giocatore non valido'; end if;
  elsif v_p is not null then
    select nome into v_base from png where id = v_p and campagna_id = v_camp and not archiviato;
    if not found then raise exception 'NPC non valido'; end if;
  else
    v_base := v_nome;
    if v_base is null then raise exception 'Il segnalino ha bisogno di un nome'; end if;
  end if;

  -- Il nome del token: quello scelto da chi lo crea; altrimenti il nome del personaggio, con un numero
  -- se ce n'è già uno su questa mappa («Goblin 2», poi «Goblin 3»…: il primo numero libero).
  if v_nome is null then
    v_nome := v_base;
    if exists (select 1 from segnalini where mappa_id = v_map and giocatore_id is not distinct from v_g and png_id is not distinct from v_p) then
      v_n := 2;
      while exists (select 1 from segnalini where mappa_id = v_map and nome = left(v_base, 56) || ' ' || v_n) loop v_n := v_n + 1; end loop;
      v_nome := left(v_base, 56) || ' ' || v_n;
    end if;
  end if;

  insert into segnalini (campagna_id, mappa_id, giocatore_id, png_id, nome, x, y, taglia, nascosto)
  values (v_camp, v_map, v_g, v_p, v_nome,
          least(1, greatest(0, coalesce(nullif(p->>'x', '')::numeric, 0.5))),
          least(1, greatest(0, coalesce(nullif(p->>'y', '')::numeric, 0.5))),
          case when v_master then coalesce(nullif(p->>'taglia', '')::numeric, 1) else 1 end,
          case when v_master then coalesce((p->>'nascosto')::boolean, false) else false end)
  returning id into v_id;

  -- PF: dalla scheda del personaggio se c'è, altrimenti da quello che scrive il master (segnalini generici)
  select pf_attuali, pf_max into v_pfa, v_pfm from schede
   where (v_g is not null and giocatore_id = v_g) or (v_p is not null and png_id = v_p);
  if not found and v_master then
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


create or replace function elimina_segnalino(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare s segnalini%rowtype;
begin
  select * into s from segnalini where id = p_id;
  if not found then raise exception 'Segnalino non trovato'; end if;
  if not e_master(s.campagna_id) then
    if s.giocatore_id is null or s.giocatore_id is distinct from mio_giocatore(s.campagna_id) then
      raise exception 'Puoi togliere solo i token del tuo personaggio';
    end if;
    if not exists (select 1 from battle_stato b where b.campagna_id = s.campagna_id and b.visibile and b.mappa_id = s.mappa_id) then
      raise exception 'La mappa non è in scena';
    end if;
  end if;
  delete from segnalini where id = p_id;
  perform _bump_battle(s.campagna_id);
end $$;


-- Cambia il nome di un token. Se porta il nome del suo PG o NPC, cambia il nome del personaggio e di
-- tutti i token che lo portano. Se ha un nome suo («Goblin 2») cambia solo il nome di quel token.
create or replace function rinomina_segnalino(p_id bigint, p_nome text) returns void
language plpgsql security definer set search_path = public as $$
declare s segnalini%rowtype; v_nome text := left(trim(coalesce(p_nome, '')), 60); v_attuale text;
begin
  select * into s from segnalini where id = p_id;
  if not found then raise exception 'Segnalino non trovato'; end if;
  if v_nome = '' then raise exception 'Il nome non può essere vuoto'; end if;
  if not e_master(s.campagna_id) and (s.giocatore_id is null or s.giocatore_id is distinct from mio_giocatore(s.campagna_id)) then
    raise exception 'Puoi rinominare solo il tuo segnalino';
  end if;
  if s.giocatore_id is not null then select nome into v_attuale from giocatori where id = s.giocatore_id;
  elsif s.png_id is not null then select nome into v_attuale from png where id = s.png_id;
  end if;

  if v_attuale is not null and s.nome = v_attuale then
    if s.giocatore_id is not null then
      update giocatori set nome = v_nome where id = s.giocatore_id;
      update segnalini set nome = v_nome where giocatore_id = s.giocatore_id and nome = v_attuale;
    else
      update png set nome = v_nome where id = s.png_id;
      update segnalini set nome = v_nome where png_id = s.png_id and nome = v_attuale;
    end if;
  else
    update segnalini set nome = v_nome where id = p_id;
  end if;
end $$;

notify pgrst, 'reload schema';
