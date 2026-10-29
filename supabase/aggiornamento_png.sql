-- =====================================================================
-- Aggiornamento: eliminare gli NPC
--
-- QUANDO ESEGUIRLO
--   Una volta sola, DOPO aggiornamento_equipaggiamento.sql.
--
-- COSA CAMBIA
--   Finora un NPC si poteva solo aggiungere. Ora il master può eliminarlo.
--   [REGOLA] Lo storico non si modifica mai, quindi:
--     - un NPC mai comparso nello storico viene cancellato del tutto;
--     - un NPC già comparso nello storico viene ARCHIVATO: sparisce da tutte le
--       liste, ma lo storico continua a mostrarne il nome.
--   In entrambi i casi spariscono la sua scheda e il suo inventario. Gli oggetti
--   che aveva restano nella libreria e si possono riassegnare.
-- =====================================================================

alter table png add column archiviato boolean not null default false;

-- Elimina o archivia un NPC. Restituisce 'eliminato' oppure 'archiviato'.
create function elimina_png(p_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare v_camp bigint;
begin
  select campagna_id into v_camp from png where id = p_id;
  if not found or not e_master(v_camp) then raise exception 'NPC non trovato'; end if;

  delete from inventari where png_id = p_id;     -- gli oggetti restano nella libreria
  delete from schede    where png_id = p_id;     -- con i suoi incantesimi

  if exists (select 1 from trasferimenti where da_png_id = p_id or a_png_id = p_id) then
    update png set archiviato = true where id = p_id;
    return 'archiviato';
  end if;
  delete from png where id = p_id;
  return 'eliminato';
end $$;

-- [ATTENZIONE] Un NPC archiviato non può più ricevere oggetti (nemmeno annullando un vecchio
-- movimento): l'oggetto finirebbe in un inventario che nessuno vede.
create function _blocca_png_archiviato() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.png_id is not null and exists (select 1 from png where id = new.png_id and archiviato) then
    raise exception 'Questo NPC è stato eliminato: non può ricevere oggetti';
  end if;
  return new;
end $$;

create trigger inventari_png_archiviato
  before insert on inventari
  for each row execute function _blocca_png_archiviato();

notify pgrst, 'reload schema';
