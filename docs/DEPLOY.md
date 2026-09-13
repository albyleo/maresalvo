# Pubblicazione di MareSalvo su Vercel

## Pubblicare subito la parte pubblica

Homepage, video, mappa e anteprima dei questionari funzionano senza Supabase.
La configurazione del CRM può essere completata successivamente. Questo non
abilita ancora accesso, invio delle risposte o rilascio dei certificati.

La repository è già collegata a Vercel. Prima del tuo commit/push:

```powershell
npm run check:release
git status --short
```

Includi codice, lockfile, migrazioni, cataloghi JSON, `public/data`, video ottimizzato
e poster. `.env.local`, `node_modules`, `.next` e gli asset generati `public/cesium`
sono esclusi da Git. Gli asset Cesium vengono ricreati da `npm ci` tramite postinstall.
Il video ottimizzato e i dati cartografici sono già pronti: non serve rigenerarli.

Configurazione del progetto Vercel: framework Next.js, cartella radice della
repository, installazione `npm ci`, build `npm run build`, output predefinito.
Il tuo push sul branch di produzione attiva il deploy della repository collegata.
Controlla l'esito del deploy prima di verificare il sito live.

## Attivare accesso e salvataggio dei questionari

Supabase conserva utenti, risposte, risultati, richieste e certificati. La mappa
pubblica usa i cataloghi cartografici inclusi nel progetto e servizi pubblici.

Apri il progetto Supabase e premi **Connect**: copia il **Project URL** e la chiave
pubblica publishable/anon. L'URL ha forma `https://<progetto>.supabase.co`.
Non è la stringa PostgreSQL e non contiene la password del database.
Fonte: https://supabase.com/docs/guides/api/creating-routes

Nelle variabili d'ambiente del progetto Vercel, per Production, inserisci:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://IL_TUO_PROGETTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=LA_TUA_CHIAVE_PUBBLICA
NEXT_PUBLIC_APP_URL=https://maresalvo.vercel.app
```

Le prime due devono appartenere allo stesso progetto. Dopo aver cambiato variabili
pubbliche, esegui un nuovo deploy. Il file `.env.local` configura solo il computer
locale; non aggiorna Vercel. Non servono password del database o service-role key.

In Supabase Authentication configura:

- Site URL: `https://maresalvo.vercel.app`
- Redirect URL: `https://maresalvo.vercel.app/api/auth/callback`

Esegui nel SQL Editor solo le migrazioni non ancora applicate, in ordine da 001 a
006. Incolla il **contenuto SQL**, non il percorso del file. Se 001–005 sono già
riuscite, esegui solamente `supabase/migrations/006_ghost_net_observations.sql`.
Non ripetere migrazioni già completate. La versione 2 comprende tre percorsi da
15 domande; il superamento richiede 12 risposte corrette e poi la revisione dello staff.

## Verifica dopo il deploy

1. Homepage: video e testi scorrono, poi appare la mappa.
2. Mappa: prima dell'attivazione lo scroll continua la pagina. Premi “Esplora la
   mappa”, prova zoom e trascinamento, poi premi Esc sul desktop oppure Indietro
   sul mobile (anche il comando indietro del browser). Ripeti sul
   globo Earth 3D e sul cellulare. Cambiando modalità la mappa torna bloccata.
3. Cerca Porto Cesareo e apri le schede A/B/C. Verifica l'anteprima dei tre questionari.
4. Dopo aver configurato Supabase: accedi con un utente di prova, invia un
   questionario, controlla il risultato con l'altro account staff. I certificati
   rimangono dimostrativi. Vedi `PILOT_SETUP.md` per assegnare il ruolo al revisore.
5. Reti: applica 006 e accedi come super_admin a `/admin/reti-perse`. Abilita il
   secondo account. Da `/segnala-rete`, seleziona un punto e invia un’osservazione.
   Con un account diverso, seleziona un punto vicino e associa la tua osservazione
   alla stessa rete. Il conteggio sale a due ma lo stato resta “Da verificare”.
   Controlla le prove nel pannello amministratore, aggiungi una motivazione e
   approva la rete. Solo allora compare sulla mappa per i visitatori anonimi.
   Usa dati reali per il sito pubblico; respingi eventuali segnalazioni di prova.

La ricerca mostra fino a 50 segnalazioni aperte entro 250 m, senza unirle
automaticamente. Ogni account abilitato può contribuire una volta per rete e
inviare al massimo 10 osservazioni in 24 ore. La vicinanza e il numero di account
non sono una probabilità scientifica né una verifica dell’identità degli autori.
Le prove sono link HTTPS facoltativi riservati allo staff, non caricamenti di file.
Il pannello mostra gli ultimi 200 report e fino a 1000 utenti attivi; per volumi
superiori sarà necessaria la paginazione. Le segnalazioni precedenti restano intatte.

Un build riuscito verifica il codice; non dimostra che le variabili Vercel,
le migrazioni remote e l'invio delle email siano configurati correttamente.
