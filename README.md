# Companion GDR: inventario del gruppo

Un sito per te e i tuoi amici: il master crea armi, armature, cibo e oggetti (anche unici, come FrangiAlba), li assegna, e i giocatori se li scambiano. Ogni passaggio finisce nello storico del master e manda una notifica.

Questo è il **primo pacchetto**: libreria oggetti, inventari, passaggi di mano, storico, notifiche. La scheda personaggio, il level up e gli incantesimi sono il passo successivo.

## Cosa c'è dentro

| File | A cosa serve |
|---|---|
| `index.html`, `style.css`, `app.js` | il sito |
| `config.js` | l’unico file da modificare: URL e chiave del tuo Supabase |
| `supabase/schema.sql` | tabelle, permessi e regole di gioco, da eseguire una volta |
| `supabase/aggiornamento_unita.sql` | solo se avevi già eseguito una versione vecchia di `schema.sql` (vedi «Unità di misura») |
| `supabase/prova_tre_account.sql` | facoltativo: prepara una campagna di prova con tre account (vedi sotto) |

## Messa online, passo per passo

**1. Supabase (il database)**
1. Crea un account gratuito su supabase.com e un nuovo progetto. Scegli una regione europea e annota la password del database (non ti servirà nel sito).
2. Nel progetto apri **SQL Editor**, incolla l’intero contenuto di `supabase/schema.sql` e premi **Run**. Deve finire senza errori.
3. Apri **Authentication → Sign In / Providers → Email** e, **solo per provare**, disattiva «Confirm email» (così ci si registra senza aspettare la posta). Puoi riattivarla dopo.
4. Apri **Project Settings → API** e copia due valori: **Project URL** e la chiave **anon public**.

**2. Il sito**
1. Apri `config.js` e incolla i due valori tra le virgolette. Non usare mai la chiave `service_role`.
2. Crea un repository su GitHub e carica `index.html`, `style.css`, `app.js`, `config.js` (la cartella `supabase` è facoltativa).
3. Nel repository: **Settings → Pages**, scegli il ramo `main` e la cartella `/ (root)`. Dopo un minuto il sito è online all’indirizzo che GitHub mostra.
4. In Supabase, **Authentication → URL Configuration**, imposta **Site URL** con quell’indirizzo.

**3. Prova**
1. Registrati, scegli «Crea una campagna»: sei il master. Dalla Libreria premi **Carica oggetti di esempio**.
2. Da un altro browser (o una finestra privata) registra un secondo account e usa «Entra con un codice». Il codice è nell’intestazione del master.
3. Assegna qualcosa al giocatore, poi guarda cosa vede lui, fai passare un oggetto a un altro giocatore, e infine annulla un movimento dallo Storico.

## Prova rapida con tre account (facoltativo)

1. Registra dal sito `testmaster@test.com`, `testgiocatore1@test.com` e `testgiocatore2@test.com`, tutte con password `123456` (servono almeno 6 caratteri). Le email non devono esistere davvero, ma «Confirm email» deve essere disattivato.
2. In Supabase apri **SQL Editor**, incolla `supabase/prova_tre_account.sql` ed esegui.
3. Accedi con i tre account in tre finestre (due delle quali private): troverai la «Campagna di prova» già pronta, con oggetti di esempio assegnati.

Finita la prova, cancella i tre account da Authentication → Users.

## Come funzionano le regole

- **Chi vede cosa**: un giocatore vede solo gli oggetti che ha nel proprio inventario. Lo storico lo vede solo il master. Queste regole sono nel database, non nel sito, quindi non si aggirano modificando la pagina.
- **Proprietà nascoste**: il testo che scrivi nel campo «Proprietà nascosta» (oggetti segreti o maledetti) lo legge solo il master, anche quando l’oggetto passa di mano. Il pulsante «Rivela ai giocatori» la mostra a chi lo possiede.
- **Passaggi**: se l’oggetto era equipaggiato, viene tolto in automatico a chi lo cede. Se chi riceve ha già lo stesso oggetto, le quantità si sommano. Gli oggetti non impilabili si spostano uno alla volta.
- **Equipaggiamento**: un’armatura e uno scudo per volta.
- **Storico**: non si modifica. Un errore si corregge con «Annulla», che registra un movimento inverso.
- **Eliminare**: un oggetto mai usato si cancella; uno già comparso nello storico viene archiviato.
- **Notifiche**: per un pezzo singolo «Hai ricevuto Spada lunga da Aldo», per una pila «Hai ricevuto 5× Razioni da viaggio da Aldo». Le proprietà nascoste non compaiono mai.

## Unità di misura

Il pulsante **Unità** nell’intestazione passa tra internazionali (kg, m) e americane (lb, ft). Vale per tutto il sito: pesi, gittate e anche i campi dei moduli (scrivi 3 lb o 1,5 kg, ognuno nella sua unità). La scelta si ricorda su quel dispositivo, quindi ogni giocatore ha la sua.

- Nel database tutto è salvato in kg e metri. La conversione è quella di D&D (1 lb = 0,5 kg; 5 ft = 1,5 m), così i valori restano tondi: 80/320 ft sono 24/96 m.
- I testi liberi (effetti, descrizioni) non si convertono: scrivi le misure nelle due unità, per esempio «15 m (50 ft)».
- **Se avevi già eseguito `schema.sql` prima di questo aggiornamento**, esegui anche `supabase/aggiornamento_unita.sql` nello SQL Editor: rende la gittata decimale (25 ft sono 7,5 m). Non tocca i dati. Se parti da zero, `schema.sql` basta.

## Cose da sapere

- **Effetti condizionali** (FrangiAlba: «di giorno +2 radianti») e **bonus da equipaggiato** sono per ora testo libero, mostrato sulla scheda dell’oggetto. Il calcolo automatico arriverà con la scheda personaggio.
- Le **armature** hanno CA, tetto alla Destrezza, Forza minima e tempi di vestizione, ma il sito non impedisce di cambiarle durante un combattimento.
- Le valute sono mr, ma, me, mo, mp.
- **Contenuti dei manuali**: gli esempi sono generici o inventati. Se aggiungi oggetti dai manuali, scrivili in parole tue e non incollare il testo del libro, soprattutto in un sito che altri possono raggiungere.
- **Registrazioni aperte**: chiunque conosca l’indirizzo può creare un account, ma senza il codice invito non vede nulla. Quando il gruppo è al completo puoi disattivare le nuove registrazioni in Supabase (Authentication → Sign In / Providers → «Allow new users to sign up»).
- Il piano gratuito di Supabase mette in pausa i progetti rimasti inattivi per circa una settimana: se capita, si riattiva dal pannello.
