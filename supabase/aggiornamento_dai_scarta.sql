-- =====================================================================
-- aggiornamento_dai_scarta.sql
-- Due cose per l'inventario:
--   1) «Scarta»: l'oggetto resta a terra, esce dall'inventario e il
--      movimento resta nello storico (come «Togli» del master).
--   2) «Dai» al master: un giocatore può dare un oggetto anche al master,
--      che poi lo passa a un NPC («Ricevuti dai giocatori», nella sezione
--      Personaggi).
--
-- Da eseguire UNA volta nello SQL Editor di Supabase. Non cambia i dati:
-- aggiunge una funzione e riscrive «trasferisci» togliendo il solo divieto
-- di dare al master. Si può rieseguire senza danni.
-- Esegui questo file PRIMA di caricare su GitHub i file del sito.
-- =====================================================================

-- 1) scarta: il master da qualunque inventario, il giocatore solo dal proprio.
create or replace function public.scarta(p_camp bigint, p_ogg bigint, p_qta integer, p_g bigint, p_p bigint)
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not e_master(p_camp) then
    if not e_membro(p_camp) then raise exception 'Non fai parte di questa campagna'; end if;
    if p_p is not null or p_g is distinct from mio_giocatore(p_camp) then
      raise exception 'Puoi scartare solo oggetti del tuo inventario';
    end if;
  end if;
  return _registra(p_camp, 'rimozione', p_ogg, p_qta, p_g, p_p, null, null, null, null);
end $function$;

revoke all on function public.scarta(bigint, bigint, integer, bigint, bigint) from public, anon;
grant execute on function public.scarta(bigint, bigint, integer, bigint, bigint) to authenticated;

-- 2) trasferisci: identica a prima, ma il giocatore può dare anche al master.
--    Restano i limiti: il giocatore dà solo dal proprio inventario e solo a
--    giocatori o al master (mai a un NPC); il master può tutto.
create or replace function public.trasferisci(p_camp bigint, p_ogg bigint, p_qta integer, da_g bigint, da_p bigint, a_g bigint, a_p bigint)
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not e_master(p_camp) then
    if not e_membro(p_camp) then raise exception 'Non fai parte di questa campagna'; end if;
    if da_g is distinct from mio_giocatore(p_camp) or da_p is not null
       or a_g is null or a_p is not null or a_g = da_g then
      raise exception 'Puoi dare oggetti solo dal tuo inventario ad altri giocatori o al master';
    end if;
  end if;
  return _registra(p_camp, 'trasferimento', p_ogg, p_qta, da_g, da_p, a_g, a_p, null, null);
end $function$;
