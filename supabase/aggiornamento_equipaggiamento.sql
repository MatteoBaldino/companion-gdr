-- =====================================================================
-- Aggiornamento: equipaggiamento con elmi, protezioni degli arti e bardature
--
-- QUANDO ESEGUIRLO
--   Una volta sola, DOPO aggiornamento_listino.sql.
--
-- COSA CAMBIA
--   Prima la funzione "equipaggia" conosceva solo due posti: un'armatura e uno
--   scudo. Un elmo o un bracciale sarebbero stati scambiati per un'armatura e
--   avrebbero bloccato la cotta di maglia. Ora i posti sono cinque.
--
--   [REGOLA] Posti e limiti (modificali qui sotto se la tua casa gioca diversamente):
--     corpo   leggera, media o pesante ........ 1 alla volta
--     scudo ................................... 1 alla volta
--     elmo    accessorio senza gruppo ......... 1 alla volta
--     arti    accessorio del gruppo "arti" .... quanti vuoi (tre pezzi danno +1 CA in totale)
--     barda   bardatura (per la cavalcatura) .. 1 alla volta
-- =====================================================================

-- A quale posto appartiene un pezzo di armatura.
create function _posto_armatura(p_cat categoria_armatura, p_gruppo text) returns text
language sql immutable as $$
  select case
    when p_cat = 'scudo'      then 'scudo'
    when p_cat = 'bardatura'  then 'barda'
    when p_cat = 'accessorio' then case when p_gruppo = 'arti' then 'arti' else 'elmo' end
    else 'corpo'
  end
$$;

create or replace function equipaggia(p_inv bigint, p_eq boolean) returns void
language plpgsql security definer set search_path = public as $$
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
  update inventari set equipaggiato = p_eq where id = p_inv;
end $$;

notify pgrst, 'reload schema';
