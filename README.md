# Companion GDR: inventario del gruppo

Un sito per te e i tuoi amici: il master crea armi, armature, cibo e oggetti (anche unici, come FrangiAlba), li assegna, e i giocatori se li scambiano. Ogni passaggio finisce nello storico del master e manda una notifica.

**Pacchetto 1**: libreria oggetti, inventari, passaggi di mano, storico, notifiche.
**Pacchetto 2**: schede personaggio per giocatori e NPC (caratteristiche, PF, CA, tiri salvezza, abilità), creazione guidata e salita di livello.
**Pacchetto 3**: attacchi calcolati, incantesimi, slot, concentrazione, riposi, risorse e tracker del turno. Privilegi di classe e il pulsante Importa sono i prossimi.

## Cosa c'è dentro

| File | A cosa serve |
|---|---|
| `index.html`, `style.css` e la cartella `js/` | il sito. Il codice è diviso in tanti file piccoli: vedi «Come è organizzato il codice» |
| `battle.html`, `battle.css`, `js/battle/` | la Battle map: mappe, segnalini, PF e iniziativa (vedi «Battle map») |
| `importa.html`, `js/import/` | la pagina del master per importare i listini Excel (vedi «Listini in Drakos») |
| `config.js` | l’unico file da modificare: URL e chiave del tuo Supabase |
| `supabase/schema.sql` | tabelle, permessi e regole di gioco, da eseguire una volta |
| `supabase/aggiornamento_unita.sql` | solo se avevi già eseguito una versione vecchia di `schema.sql` (vedi «Unità di misura») |
| `supabase/aggiornamento_schede.sql` | schede personaggio: da eseguire una volta, dopo `schema.sql` (vedi «Schede personaggio») |
| `supabase/aggiornamento_incantesimi.sql` | attacchi, incantesimi, slot, turno: da eseguire una volta, dopo `aggiornamento_schede.sql` |
| `supabase/aggiornamento_listino.sql` | monete in rame (Drakos), pesi grandi, elmi e protezioni, servizi, monete sulla scheda: da eseguire una volta, dopo `aggiornamento_incantesimi.sql` |
| `supabase/aggiornamento_equipaggiamento.sql` | elmo, protezioni degli arti e barda nell’equipaggiamento: da eseguire una volta, dopo `aggiornamento_listino.sql` |
| `supabase/aggiornamento_battle.sql` | Battle map: mappe, segnalini, PF, iniziativa e archivio delle immagini: da eseguire una volta, dopo `aggiornamento_png.sql` |
| `supabase/aggiornamento_png.sql` | eliminare gli NPC (archiviati se sono già nello storico): da eseguire una volta, dopo `aggiornamento_equipaggiamento.sql` |
| `supabase/aggiornamento_listino_standard.sql` | listino standard copiabile da ogni master (pulsante «Copia listino standard» in Libreria) e servizi visibili solo al master: da eseguire una volta, dopo `aggiornamento_battle.sql` |
| `supabase/prova_tre_account.sql` | facoltativo: prepara una campagna di prova con tre account (vedi sotto) |

## Messa online, passo per passo

**1. Supabase (il database)**
1. Crea un account gratuito su supabase.com e un nuovo progetto. Scegli una regione europea e annota la password del database (non ti servirà nel sito).
2. Nel progetto apri **SQL Editor**, incolla l’intero contenuto di `supabase/schema.sql` e premi **Run**. Deve finire senza errori.
3. Apri **Authentication → Sign In / Providers → Email** e, **solo per provare**, disattiva «Confirm email» (così ci si registra senza aspettare la posta). Puoi riattivarla dopo.
4. Apri **Project Settings → API** e copia due valori: **Project URL** e la chiave **anon public**.

**2. Il sito**
1. Apri `config.js` e incolla i due valori tra le virgolette. Non usare mai la chiave `service_role`.
2. Crea un repository su GitHub e carica `index.html`, `importa.html`, `style.css`, `config.js` e la cartella `js` (la cartella `supabase` è facoltativa).
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

## Schede personaggio

**Installazione**: nello SQL Editor di Supabase incolla `supabase/aggiornamento_schede.sql` ed esegui, una volta. Poi carica su GitHub i file nuovi: `index.html`, `style.css` e la cartella `js` (Add file → Upload files, stessi nomi). Dopo un minuto ricarica il sito con Ctrl+F5.

- **Giocatori**: tab **Scheda**, con creazione guidata in 4 passi (identità, caratteristiche, competenze, riepilogo) oppure compilazione a mano. Specie, background e classe si scelgono da un menu a tendina; con «Altro…» si scrive una voce che non è in elenco (gli elenchi sono in `app.js`, cercando `SPECIE` e `BACKGROUND`). La scheda si può sempre modificare a mano.
- **Caratteristiche**: array standard, acquisto punti (27 punti), tiro 4d6 scartando il più basso, o valori liberi, più il bonus del background.
- **NPC del master** (i personaggi creati dal master; quelli dei giocatori sono i PG): tab **Schede**. Per ogngli NPC il master sceglie una scheda *semplificata* (CA, PF, velocità, tratti, azioni, grado di sfida) oppure *completa* come quella dei giocatori. I NPC sono gli stessi che hanno già un inventario.
- **Calcoli automatici**: modificatori, bonus competenza (dal livello), tiri salvezza, abilità con competenza o maestria, iniziativa, percezione passiva e **CA dall’equipaggiamento**: l’armatura e lo scudo che equipaggi nell’inventario entrano nel calcolo. Per CA particolari (e per i bonus magici, che sono testo libero) usa «Bonus alla CA» oppure una CA fissa.
- **In gioco**: pulsanti Danno e Cura (i PF temporanei assorbono per primi), PF temporanei, ispirazione.
- **Sali di livello**: aggiorna il livello e propone i PF in più (media del dado vita più Costituzione), che puoi correggere.
- **Chi vede cosa**: ogni giocatore vede e modifica solo la propria scheda. Il master vede e modifica tutte.
- **Unità**: la velocità è salvata in metri e segue l’interruttore Unità (9 m = 30 ft).
- **Dati delle classi**: dado vita, tiri salvezza e abilità tra cui scegliere delle dodici classi del manuale base sono suggerimenti scritti a mano nel sito: controllali sul tuo manuale. Tutto si può correggere dalla scheda.
- **Ancora da fare**: privilegi di classe, incantesimi e slot, azioni del turno.

## Attacchi, incantesimi, slot e turno

**Installazione**: nello SQL Editor incolla `supabase/aggiornamento_incantesimi.sql` ed esegui. Poi carica su GitHub `index.html`, `style.css` e la cartella `js`. Ricarica il sito con Ctrl+F5. Se il file SQL non è stato eseguito, il sito funziona lo stesso ma la sezione incantesimi mostra un avviso.

- **Attacchi** (nella scheda): le armi *equipaggiate* nell’inventario, il colpo senza armi, e gli incantesimi che attaccano o fanno fare un tiro salvezza. Per le armi il bonus è modificatore (Forza, Destrezza per le armi a distanza, il migliore se hanno «Accurata») più competenza se l’hai, più il «bonus per colpire» dell’oggetto, che vale anche per il danno. I trucchetti crescono ai livelli 5, 11 e 17.
- **Libreria degli incantesimi**: la vede tutta la campagna. Il master la gestisce dalla scheda **Incantesimi**; un giocatore aggiunge incantesimi alla propria scheda e può crearne di nuovi, che poi modifica solo lui (il master modifica tutto). Il riassunto scrivilo con parole tue.
- **Slot**: pallini da toccare per segnare uno slot usato o ripristinarlo. In **Modifica scheda** il pulsante *Suggerisci da classe e livello* propone gli slot per incantatori completi, mezzi incantatori e Warlock; tutti i valori si possono cambiare (sottoclassi incantatrici, multiclasse e oggetti vanno impostati a mano).
- **Lancio**: «Lancia» sceglie lo slot, lo segna, marca azione, azione bonus o reazione e imposta la concentrazione. Il rituale non usa slot. Il sito **avvisa ma non vieta**: azione già usata, due incantesimi nello stesso turno quando uno è a azione bonus, concentrazione che si perde.
- **Turno**: Azione, Azione bonus, Reazione, Movimento da toccare, e «Nuovo turno» che azzera.
- **Riposi**: lungo (PF al massimo, slot e risorse ripristinati, concentrazione e PF temporanei finiscono) e breve (risorse con recupero breve e slot del Warlock).
- **Risorse** (per esempio Channel Divinity): si scrivono in Modifica scheda, una per riga: `Channel Divinity | 2 | lungo`.
- **Concentrazione**: se subisci danno mentre sei concentrato, il sito ricorda la CD del tiro salvezza su Costituzione.
- **NPC**: tutto questo vale anche per gli NPC. Per quelli semplificati si impostano CD e bonus per colpire fissi.
- **Dati da controllare sul manuale**: tabelle degli slot, dadi vita, competenze con le armi. Sono a memoria e vanno verificati.

## Ordine degli SQL

Da eseguire nello SQL Editor, ognuno una sola volta, in questo ordine:
1. `schema.sql`
2. `aggiornamento_unita.sql` (solo se avevi un `schema.sql` vecchio)
3. `aggiornamento_schede.sql`
4. `aggiornamento_incantesimi.sql`
5. `aggiornamento_listino.sql`
6. `aggiornamento_equipaggiamento.sql`
7. `aggiornamento_png.sql`
8. `aggiornamento_battle.sql`
9. `aggiornamento_listino_standard.sql`

`prova_tre_account.sql` è facoltativo e sta fuori da quest’ordine. Se uno script dà errore non cambia niente: è un unico blocco.

## Listini in Drakos

**Monete.** I prezzi sono in Drakos e sono salvati in rame: 1 Ar = 100 Ra, 1 Or = 10.000 Ra, 1 Pt = 1.000.000 Ra. Il sito li mostra come «3 Ar 50 Ra».

**Listino standard.** Una campagna è segnata come «listino standard» (`campagne.listino_standard`, una sola). Ogni master può copiarne gli oggetti e i servizi nella propria campagna con **Copia listino standard** in Libreria: le voci che ha già restano com’erano e le modifiche valgono solo per la sua campagna. Per cambiare campagna standard, nello SQL Editor: `update campagne set listino_standard = false;` poi `update campagne set listino_standard = true where id = NUMERO;`.

**Attacco e CD degli incantesimi.** Si calcolano dalla caratteristica da incantatore scelta nella scheda. Se non è scelta, il sito la ricava dalla classe (Mago e Ladro Mistificatore Arcano: Intelligenza; Chierico, Druido e Ranger: Saggezza; Bardo, Stregone, Warlock e Paladino: Carisma). Se la classe non ha magia, nella tabella degli attacchi resta solo la scritta «attacco» e sotto Incantesimi compare l'invito a scegliere la caratteristica.

**Aggiungere un incantesimo alla scheda.** La finestra ha una tendina (si sceglie, non si scrive) con solo gli incantesimi delle classi del personaggio (letti dal campo Classi di ogni incantesimo; il Ladro Mistificatore Arcano e il Guerriero Cavaliere Mistico usano la lista del Mago). Se la scheda ha più classi, scritte nel campo Classe e separate da «/», «,» o «+», l'elenco le comprende tutte. Una casella permette di mostrare anche gli incantesimi di altre classi. Lo **Stato** (preparato, sempre preparato, non preparato) lo scegli tu. La **Fonte** si compila da sola con la prima classe del personaggio che ha quell'incantesimo in lista, finché non la scrivi tu (per un talento come Magic Initiate). Se la classe non ha magia o in libreria non ci sono incantesimi per quella classe, l'elenco mostra tutto.

**Equipaggiamento.** Nella scheda, tra Abilità e Monete, ci sono le caselle di ciò che il personaggio ha addosso: Armatura, Scudo, Elmo e le Armi, più (in «Altri slot») barda, protezioni degli arti e altri oggetti. Si tocca una casella e si sceglie tra gli oggetti dell'inventario, oppure si rimette l'oggetto nello zaino. Il database controlla che non ci siano due armature, due scudi o due elmi. Cambiare un'arma o lo scudo costa l'**Azione** del turno e, se è già usata, non si può. CA e attacchi usano ciò che è equipaggiato. Mano destra, sinistra, schiena e «a due mani» non ci sono ancora: richiedono di registrare dove sta ogni oggetto, con una modifica del database.

**Tiri di dado.** Nella scheda completa ogni caratteristica, tiro salvezza, abilità e l'iniziativa si toccano per tirare; nella tabella degli attacchi il bonus per colpire e il danno sono pulsanti (armi, colpo senza armi, incantesimi). Il risultato compare nel riquadro dentro la scheda, sopra le due colonne, con i dadi dalla loro sagoma (se la scheda è lunga il riquadro viene portato in vista). «Prossimo tiro» sceglie Normale, Vantaggio o Svantaggio e dopo ogni d20 torna su Normale; con vantaggio o svantaggio il d20 scartato resta barrato. Un attacco con un'arma o a mani nude segna l'**Azione** del turno e, se è già usata, non parte: per liberarla si tocca la cella Azione. Gli attacchi degli incantesimi non la segnano, perché lo fa già «Lancia». Il 20 naturale di un attacco è un critico: il danno successivo di quell'arma raddoppia i dadi (non il modificatore). Per ora il tiro lo vede solo chi lo fa: la chat con i tiri condivisi e segreti verrà dopo.

**Monete sulla scheda.** Sopra l'inventario ci sono le quattro monete (Pt, Or, Ar, Ra), ognuna in una casella: scrivi il numero e premi Invio (o esci dal campo) e si salva. Sotto compare il totale. Il peso delle monete conta nel carico (peso di una moneta: `campagne.peso_moneta_kg`, 0,01 kg). Si salvano con la funzione `aggiorna_monete`: il giocatore tocca la sua scheda, il master tutte.

**Note di attacchi e oggetti.** Nella tabella degli attacchi la colonna Note è un tasto che si apre e si chiude e riporta le proprietà dell'arma, la padronanza, le munizioni, i requisiti, le regole speciali, il bonus e l'effetto condizionale; per gli incantesimi livello, tempo di lancio, concentrazione e rituale. Nell'inventario della scheda ogni oggetto ha un tasto Note che si apre e si chiude, con dentro i dettagli, le regole speciali, l'effetto condizionale, il bonus da equipaggiato e, se c'è, la descrizione. La proprietà nascosta la vede il master; il giocatore solo quando è stata rivelata.

**Turno.** Azione, Azione bonus e Reazione sono celle: verdi se libere, tratteggiate se usate, con scritto cosa le ha usate. Il Movimento mostra la distanza rimasta (nell'unità scelta, metri o piedi) e un campo per togliere o ridare distanza con − e +. «Nuovo turno» e i riposi liberano tutto.

**Peso trasportato.** Capacità = Forza × 7,5 kg. Gli stati sono una regola della casa: Leggero fino a Forza × 1,25 kg, Normale fino a Forza × 2,5, Appesantito fino a Forza × 5, Molto appesantito fino alla capacità. Il sito mostra l'etichetta e le soglie nella tendina, ma non applica ancora le penalità di velocità e di svantaggio.

**Importare i listini Excel** (solo il master):
1. Esegui `aggiornamento_listino.sql` e `aggiornamento_equipaggiamento.sql`, poi carica su GitHub i file nuovi.
2. In **Libreria** premi **Importa da Excel**.
3. Scegli i file (anche tutti insieme). Il tipo si riconosce dalle colonne, quindi il nome del file non conta.
4. Controlla l’anteprima e gli avvisi. Se in libreria ci sono solo oggetti di prova, spunta «svuota la libreria».
5. Premi **Importa**. Si salva a gruppi di 100. Se si interrompe, rilancialo: le voci già presenti vengono saltate.

**Come vengono lette le voci**
- Le munizioni e le armi senza danno (reti, bolas, scale) diventano **oggetti vari**, con l’effetto scritto in testo.
- Gli arieti sono armi da mischia con il numero di serventi.
- Vantaggio e svantaggio (anche quello al danno, regola della casa) sono scritti nelle **regole particolari** dell’oggetto: per ora il sito non li applica da solo.
- Pesi: 1 lb = 0,5 kg e 1 ft = 0,3 m, come nel resto del sito.
- Taverne, alloggi, viaggi e svaghi vanno nel **Listino prezzi**, che vede solo il master.

**Equipaggiamento e CA.** Si possono indossare insieme un’armatura, uno scudo, un elmo e quante protezioni degli arti vuoi. Tre protezioni insieme danno +1 CA in totale; l’armatura che include l’elmo non somma un elmo separato; la barda è della cavalcatura e non conta per chi la monta.

## Battle map

Si apre da **Battle map** nella testata del sito (pagina `battle.html`). Serve aver eseguito `supabase/aggiornamento_battle.sql`.

**Per il master**
- **Nuova mappa**: scegli un'immagine dal computer. Viene ridotta (lato massimo 2048 px, circa mezzo MB) e salvata nell'archivio privato. Massimo 10 mappe per campagna.
- **Mostra ai giocatori**: i giocatori vedono una sola mappa alla volta, quella «in scena», e solo dopo che l'hai mostrata. Le altre le prepari con calma.
- **Segnalini**: aggiungi un PG, un NPC o un segnalino generico (per mostri ripetuti, che puoi duplicare: Goblin 2, Goblin 3…). Trascinali per spostarli; tocca un segnalino per cambiare nome, PF, iniziativa, dimensione, e per **nasconderlo** ai giocatori.
- **PF**: li vedi tutti. Quelli dei PG li vedono tutti i giocatori; quelli di un NPC solo se spunti «Mostra i PF ai giocatori». Se il personaggio ha una scheda, i PF sono quelli della scheda.
- **Righello**: serve la scala. Premi **Calibra scala**, traccia una linea tra due punti di cui conosci la distanza e scrivi quanto è lunga. La scala si salva come larghezza della mappa.
- **Iniziativa**: scrivi l'iniziativa di ciascuno (o la scrive il giocatore per sé), poi **Turno successivo** passa al successivo e conta i round. **Nuovo scontro** azzera tutto.

**Per i giocatori**: vedono la mappa mostrata e i segnalini non nascosti, muovono solo il proprio, e dal proprio segnalino cambiano nome, PF attuali e iniziativa.

**Come è protetto**: chi vede cosa lo decide il database, non la pagina. Un segnalino nascosto, i PF di un NPC e le mappe non mostrate non arrivano proprio al browser dei giocatori.

**Tempo reale**: quando qualcuno sposta un segnalino, gli altri lo vedono subito. Se per qualche motivo il tempo reale non funzionasse, la pagina si rilegge da sola ogni 15 secondi.

## Come è organizzato il codice

Il sito non è più un unico file enorme: sono tanti file piccoli (mai oltre le 160 righe), ognuno con un commento in cima che dice cosa contiene. Per cambiare una cosa, trova qui sotto il file giusto.

**Regole da ricordare quando modifichi qualcosa**
- **L'ordine conta.** `index.html` carica i file uno dopo l'altro e ognuno usa le funzioni di quelli sopra. Un file nuovo va messo nella sezione giusta.
- **Cambia il numero `?v=` in `index.html`** (per esempio da `?v=5` a `?v=6`) quando modifichi un file: costringe il browser a riscaricarlo. Altrimenti serve Ctrl+F5.
- **Un nome di funzione o di variabile al livello principale deve essere unico in tutti i file**, perché tutti condividono lo stesso spazio.
- Nei commenti trovi tre etichette da cercare con Ctrl+F: `[MODIFICA QUI]` (valori che puoi voler cambiare), `[REGOLA]` (regole di gioco) e `[ATTENZIONE]` (parti che, se cambiate, rompono altro).

| File | Cosa contiene |
|---|---|
| `js/comune/base.js` | Controlla la configurazione (config.js), crea il collegamento a Supabase e contiene le funzioni di servizio: testo sicuro, conversioni kg/lb e m/ft, date. |
| `js/comune/costanti.js` | Categorie degli oggetti, tipi di armatura, monete Drakos (conversione da e verso il rame) ed elenco dei dati letti con ogni oggetto. |
| `js/comune/messaggi.js` | Messaggi a schermo, traduzione degli errori in italiano, chiamata alle funzioni del database ed esecuzione protetta delle azioni. |
| `js/comune/stato.js` | Lo stato condiviso del sito (utente, campagna, dati caricati, filtri) e la memoria di dove eri, per ritrovare la stessa pagina dopo un aggiornamento. |
| `js/app/avvio.js` | Avvio del sito, scelta della pagina da mostrare, accesso e registrazione, elenco delle campagne, ingresso in una campagna. |
| `js/app/struttura.js` | Struttura della pagina (testata e schede in alto), caricamento di tutti i dati da Supabase, aggiornamento ogni 20 secondi e disegno della sezione scelta. |
| `js/libreria/riga-oggetto.js` | Come si disegna un oggetto: dettagli di armi, armature, cibo e oggetti vari, prezzo in Drakos, regole e proprietà nascoste. |
| `js/libreria/elenco.js` | Libreria del master: ricerca, filtri per categoria e tipologia, elenco a pagine da 100 oggetti. |
| `js/listino/listino.js` | Listino prezzi di taverne, alloggi, viaggi e svaghi, visibile solo al master. |
| `js/personaggi/personaggi.js` | Sezione Personaggi del master: PG e NPC con i loro inventari, e creazione di un NPC. |
| `js/storico/storico.js` | Storico dei movimenti (solo master): chi ha dato cosa a chi, con possibilità di annullare. |
| `js/inventario/inventario.js` | Sezioni del giocatore: il suo inventario con il peso trasportato, e le notifiche. |
| `js/comune/finestre.js` | Finestre di dialogo e campi dei moduli (testo, area di testo, spunta, menu). |
| `js/libreria/modulo-oggetto.js` | Modulo per creare e modificare un oggetto: campi per categoria, prezzo in Drakos e preparazione dei dati da salvare. |
| `js/personaggi/destinatari.js` | Aiuti per assegnare, spostare e dare oggetti: elenco dei destinatari, quantità, ricerca nell'inventario e nella libreria. |
| `js/azioni/azioni-oggetti.js` | Cosa succede premendo un pulsante: accesso, campagne, libreria, assegnazioni, passaggi, storico, eliminazione di un NPC. Contiene anche i moduli di accesso e di creazione campagna. |
| `js/scheda/dati.js` | Dati fissi della scheda: caratteristiche, abilità e le dodici classi (dado vita, tiri salvezza, abilità). Da controllare sul manuale. |
| `js/scheda/menu-opzioni.js` | Menu a tendina con «Altro…» per specie, background e classe, con i relativi elenchi. |
| `js/scheda/calcoli.js` | Calcoli della scheda: modificatori, bonus competenza, CA con armatura, scudo, elmo e protezioni, abilità. |
| `js/scheda/vista.js` | Come si disegna la scheda personaggio e l'elenco delle schede del master. Nelle schede complete: caratteristiche e CA/PF in alto; a sinistra abilità, monete e inventario; a destra tiri salvezza, attacchi e incantesimi. |
| `js/scheda/salvataggio.js` | Salvataggio della scheda: preparazione dei dati e chiamata al database. |
| `js/scheda/modifica.js` | Modulo per modificare la scheda a mano (completa o semplificata). |
| `js/scheda/creazione.js` | Creazione guidata del personaggio in 4 passi: identità, caratteristiche, competenze, riepilogo. |
| `js/azioni/azioni-schede.js` | Pulsanti delle schede: aprire, creare, salire di livello, eliminare, danni e cure. |
| `js/scheda/dati-incantesimi.js` | Tabelle degli slot per livello, dati extra delle classi e calcoli per incantesimi e attacchi. Da controllare sul manuale. |
| `js/scheda/attacchi.js` | Tabella degli attacchi: armi equipaggiate e incantesimi, con bonus per colpire e danno. |
| `js/scheda/dadi.js` | I tiri di dado: prove, tiri salvezza, iniziativa, attacchi e danni, con i dadi dalla loro sagoma, vantaggio e svantaggio e il critico. Il risultato compare in un pannello sopra la scheda. |
| `js/scheda/equipaggiamento-scheda.js` | Zona Equipaggiamento della scheda: armatura, scudo, elmo, armi, protezioni degli arti, barda e altri oggetti; ogni casella si tocca per scegliere cosa equipaggiare tra gli oggetti dell'inventario. |
| `js/scheda/inventario-scheda.js` | Barra delle monete (spendi, incassa, correggi, con il resto dato da solo) e inventario con l'etichetta del peso (Leggero, Normale, Appesantito, Molto appesantito) e la tendina con le soglie. |
| `js/scheda/slot-turno.js` | Turno (azione, bonus, reazione, movimento), riposi, concentrazione, slot incantesimo e risorse. |
| `js/scheda/incantesimi-scheda.js` | Incantesimi sulla scheda: elenco per livello, preparati e lancio. |
| `js/scheda/gioco.js` | Stato di gioco: aggiornamento immediato di slot, turno e concentrazione, con gli avvisi sul lancio. |
| `js/incantesimi/libreria-incantesimi.js` | Libreria degli incantesimi del master e modulo per crearli e modificarli. |
| `js/scheda/campi-gioco.js` | Campi in più nel modulo della scheda (slot, risorse, armi) e riassunto degli slot nella creazione guidata. |
| `js/azioni/azioni-incantesimi.js` | Pulsanti di turno, slot, riposi, lancio, incantesimi e suggerimento degli slot. |
| `js/app/avvia.js` | Ultimo file: collega i clic e l'invio dei moduli alle azioni e fa partire il sito (solo se config.js è a posto). |
| `js/battle/stato.js` | Stato della pagina Battle (mappe, segnalini, PF, scena), caricamento da Supabase e regole su chi può muovere cosa. |
| `js/battle/realtime.js` | Aggiornamento in tempo reale: quando qualcuno sposta un segnalino o il master cambia la scena, tutti lo vedono subito. |
| `js/battle/immagini.js` | Caricamento delle mappe: riduzione dell'immagine, caricamento nell'archivio privato e registrazione nel database. |
| `js/battle/mappa.js` | Come si disegna la pagina: mappa, segnalini, barre dei PF e testi di aiuto. |
| `js/battle/trascina.js` | Spostare i segnalini con il mouse o con il dito; un tocco apre la finestra del segnalino. |
| `js/battle/righello.js` | Righello per misurare le distanze e calibrazione della scala della mappa. |
| `js/battle/barra.js` | Barra del master (mappe, scena, segnalini, scala) e barra semplificata del giocatore. |
| `js/battle/segnalino.js` | Finestre del segnalino e della mappa: nome, PF, iniziativa, dimensione, nascosto, duplica ed elimina. |
| `js/battle/iniziativa.js` | Pannello dell'iniziativa: ordine dei turni, round e pulsanti del master. |
| `js/battle/avvio.js` | Avvio della pagina Battle: accesso, scelta della campagna e collegamento dei pulsanti. |
| `js/import/listino.js`, `js/import/pagina.js` | Pagina `importa.html`: legge i listini Excel e li importa (non fanno parte del sito principale). |

## Come funzionano le regole

- **Chi vede cosa**: un giocatore vede solo gli oggetti che ha nel proprio inventario. Lo storico lo vede solo il master. Queste regole sono nel database, non nel sito, quindi non si aggirano modificando la pagina.
- **Proprietà nascoste**: il testo che scrivi nel campo «Proprietà nascosta» (oggetti segreti o maledetti) lo legge solo il master, anche quando l’oggetto passa di mano. Il pulsante «Rivela ai giocatori» la mostra a chi lo possiede.
- **Eliminare un NPC**: dalla tab Personaggi, pulsante Elimina. Spariscono la sua scheda e il suo inventario (gli oggetti restano nella libreria). Se l’NPC è già comparso nello storico viene archiviato invece di cancellato, così lo storico resta intatto.
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
- I prezzi sono in Drakos, salvati in rame: 1 Ar = 100 Ra, 1 Or = 100 Ar, 1 Pt = 100 Or. Gli oggetti di prova creati prima dell’aggiornamento mostrano «prezzo da definire».
- **Contenuti dei manuali**: gli esempi sono generici o inventati. Se aggiungi oggetti dai manuali, scrivili in parole tue e non incollare il testo del libro, soprattutto in un sito che altri possono raggiungere.
- **Registrazioni aperte**: chiunque conosca l’indirizzo può creare un account, ma senza il codice invito non vede nulla. Quando il gruppo è al completo puoi disattivare le nuove registrazioni in Supabase (Authentication → Sign In / Providers → «Allow new users to sign up»).
- Il piano gratuito di Supabase mette in pausa i progetti rimasti inattivi per circa una settimana: se capita, si riattiva dal pannello.
