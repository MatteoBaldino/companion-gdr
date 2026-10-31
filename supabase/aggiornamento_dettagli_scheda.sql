-- =====================================================================
-- aggiornamento_dettagli_scheda.sql
-- La parte descrittiva della scheda:
--   - testi liberi: Tratti caratteriali, Ideali, Legami, Difetti;
--   - Privilegi e tratti: un elenco di voci {n: nome, t: descrizione, d: dado extra};
--   - Altre competenze e Linguaggi: due elenchi di etichette.
--
-- Da eseguire UNA volta nello SQL Editor di Supabase. Non cambia i dati
-- esistenti e non tocca «salva_scheda»: aggiunge una colonna e una funzione.
-- Si può rieseguire senza danni.
-- Esegui questo file PRIMA di caricare su GitHub i file del sito.
--
-- Chi può scrivere: il proprietario della scheda e il master (le schede degli
-- NPC solo il master). I testi sono al massimo di 4000 caratteri ciascuno;
-- gli elenchi hanno un massimo di voci (privilegi 40, competenze 60, linguaggi 30).
-- =====================================================================

alter table public.schede add column if not exists dettagli jsonb not null default '{}'::jsonb;

create or replace function public.salva_dettagli_scheda(p_id bigint, p_dettagli jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_s schede%rowtype;
  v_k text;
  v_max int;
begin
  select * into v_s from schede where id = p_id for update;
  if not found then raise exception 'Scheda non trovata'; end if;
  if not (e_master(v_s.campagna_id)
          or exists (select 1 from giocatori g where g.id = v_s.giocatore_id and g.user_id = auth.uid())) then
    raise exception 'Non puoi modificare questa scheda';
  end if;
  if p_dettagli is null or jsonb_typeof(p_dettagli) <> 'object' then
    raise exception 'Dati non validi';
  end if;
  -- gli elenchi: devono essere liste, con un massimo di voci e di lunghezza
  foreach v_k in array array['privilegi', 'competenze', 'linguaggi'] loop
    if p_dettagli ? v_k then
      v_max := case v_k when 'privilegi' then 40 when 'competenze' then 60 else 30 end;
      if jsonb_typeof(p_dettagli -> v_k) <> 'array'
         or jsonb_array_length(p_dettagli -> v_k) > v_max
         or length((p_dettagli -> v_k)::text) > 8000 then
        raise exception 'Elenco non valido: %', v_k;
      end if;
    end if;
  end loop;
  -- si accettano solo i quattro testi e i tre elenchi previsti
  update schede
     set dettagli = coalesce(dettagli, '{}'::jsonb)
           || coalesce(
                (select jsonb_object_agg(t.k, left(t.v, 4000))
                   from jsonb_each_text(p_dettagli - 'privilegi' - 'competenze' - 'linguaggi') as t(k, v)
                  where t.k in ('caratteri', 'ideali', 'legami', 'difetti')),
                '{}'::jsonb)
           || coalesce(
                (select jsonb_object_agg(k, p_dettagli -> k)
                   from unnest(array['privilegi', 'competenze', 'linguaggi']) as k
                  where p_dettagli ? k),
                '{}'::jsonb)
   where id = p_id;
end $function$;

revoke all on function public.salva_dettagli_scheda(bigint, jsonb) from public, anon;
grant execute on function public.salva_dettagli_scheda(bigint, jsonb) to authenticated;
