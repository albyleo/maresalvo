# Meteo marino e fonti AMP

La pagina `/meteo` unisce il widget ufficiale Windy (campi animati) e il bollettino puntuale MareSalvo a 72 ore (Open-Meteo). Si seleziona un’AMP o si inseriscono coordinate: queste aggiornano il centro iniziale di Windy e il punto del bollettino. Spostamenti, selezioni e timeline interni all’iframe Windy NON sono sincronizzati con il bollettino; l’interfaccia lo dichiara. Le schede AMP e i punti delle reti collegano direttamente le previsioni locali. La mappa principale delle AMP e delle reti rimane indipendente.

Il widget meteo è subito interattivo, senza pulsante di attivazione o voce aggiuntiva nella cronologia. Il passaggio “Attiva mappa” resta soltanto nella homepage. Il widget mantiene la propria legenda, timeline, logo e collegamenti; nessun contenuto Windy viene estratto o ridistribuito dall’API MareSalvo. “Ricentra / ricarica” riapre la vista sul punto scelto, “Apri mappa” offre un’alternativa se il caricamento incorporato non riesce.

Viste rapide ottenute dal [configuratore ufficiale](https://embed.windy.com/config/map), verificato il 20/11/2026: `wind/ecmwf`, `waves/ecmwfWaves`, `currents/cmems`, `sst/ecmwfAnalysis`. Unità richieste: `metricWind=kt`, `metricTemp=°C`, `metricRain=mm`. I pulsanti sono comandi di apertura, non indicatori del layer attualmente scelto dentro il widget. Non è garantita la coincidenza dei valori con Open-Meteo: prodotti, risoluzioni, celle e aggiornamenti possono differire.

## Meteo e licenze

- Proxy server `/api/weather`: Open-Meteo Marine con modelli espliciti `meteofrance_wave` (MFWAM), `meteofrance_currents` (correnti e temperatura marina Copernicus via Météo-France), atmosfera `ecmwf_ifs025`.
- API gratuita per MareSalvo nell’ipotesi di progetto non commerciale, senza pubblicità o abbonamenti. [Termini Open-Meteo](https://open-meteo.com/en/terms), consultati il 20/11/2026: soglie 10.000 richieste/giorno, 5.000/ora, 600/minuto. Una previsione non in cache richiede tre richieste; IP condivisi del provider di hosting possono incidere sui limiti.
- Dati [CC BY 4.0 e attribuzione](https://open-meteo.com/en/licence): crediti visibili sotto le previsioni, con riferimenti ai prodotti Copernicus, ECMWF e Météo-France. Indicata la selezione/riformattazione dei dati.
- In caso di uso commerciale o aumento del volume, impostare `OPEN_METEO_API_KEY` **solo sul server** per passare agli endpoint customer. Non serve una chiave per partire con l’API gratuita; non aggiungere chiavi a Git.
- Widget Windy integrato per l’uso personale richiesto dal proprietario. Nessuna API key o sottoscrizione Windy. Prima di rendere pubblica l’integrazione per un’associazione/istituzione, verificare l’applicabilità dei [termini generali](https://account.windy.com/agreements/windy-general-terms-of-use) e delle condizioni per i widget al caso concreto. Questa implementazione non costituisce un’autorizzazione di Windy e non rende privata una pagina pubblicamente distribuita. Nessun acquisto o accordo accettato dall’agente.
- Riferimenti tecnici: [Marine API](https://open-meteo.com/en/docs/marine-weather-api), [citazione Copernicus](https://help.marine.copernicus.eu/en/articles/4444611-citing-copernicus-marine-products-and-services).

Coordinate arrotondate a 0,01°, cache delle risposte dei fornitori con rivalidazione dopo 30 minuti, timeout 12 secondi. Nessuna seconda cache HTTP della risposta pubblica. La cache Next può servire l’ultima risposta durante la rivalidazione; l’orario di consultazione non è il run del modello. I timestamp dei modelli sono uniti per valore, non per indice; unità validate, zero distinto da dato mancante. Correnti e vento in nodi. Orari visualizzati in Europe/Rome, anche con ora legale. Onde/vento indicano provenienza, correnti destinazione.

I modelli possono selezionare celle diverse e non descrivere accuratamente coste, porti o piccoli canali. Le celle effettive sono visibili nei dettagli. Il rettangolo geografico accettato comprende anche terraferma: scegliere un punto in mare; non viene simulato un risultato locale in assenza di dati.

## AMP ed EMODnet

`official-areas.json` e `public/data/marine-areas.geojson` sono il catalogo cartografico italiano (29 AMP, 45 settori, 7 AMP con zonazione al momento dell’implementazione), non l’intero Mediterraneo. Il WMS EMODnet aggiunge perimetri internazionali, senza uniformare la normativa locale. Edizione del perimetro e data di acquisizione sono distinte. Batimetria e perimetri non provano la presenza di reti.

`src/features/marine-map/guidance.ts` contiene sintesi curate separate dall’import cartografico. Ogni regola indica zona, attività, fonte, edizione e consultazione. Fonti consultate il 20/11/2026. Le date non sono aggiornate automaticamente al deploy. Documenti storici sono marcati come tali; mancanze mostrate come “Da verificare”, mai come attività consentite. Porto Cesareo: fonti del gestore collegate, ma sintesi normativa sospesa perché il PDF non era raggiungibile durante la verifica. Nessuna inferenza da una zona C a un permesso.

Per aggiornare: consultare gli atti dell’ente, modificare solo le sintesi supportate e la relativa data, poi `npm run test:marine`. `npm run marine:sync` aggiorna geometrie e manifest da EMODnet, Sardegna e Sicilia; non sovrascrive le sintesi. Blocca import incompleti, cali di copertura, duplicati e coordinate invalide prima di scrivere. Riesaminare i diff e i test prima del commit. Il catalogo mantiene l’ultima versione pubblicata se il download fallisce.

## Segnalazioni

Mappa pubblica: solo reti verificate, con recupero pianificato o recuperate. Nessun dato dimostrativo, identità del segnalatore o testo libero nel payload pubblico dell’app. Popup apribili anche al tocco, link a meteo e nuovo riscontro con coordinate precompilate. L’accesso diretto al database resta governato dalle policy Supabase esistenti: questa modifica non è una migrazione RLS.

Le segnalazioni da verificare e i riscontri vicini rimangono nel flusso autenticato per utenti abilitati. La vicinanza suggerisce un confronto, non una fusione automatica. Una persona conta una volta; nessuna percentuale di probabilità o verifica automatica. Lo staff decide.

## Deploy e verifica

Nessuna nuova migrazione SQL per queste modifiche. La precedente migrazione `006_ghost_net_observations.sql` resta necessaria per autorizzazioni e riscontri. Non rieseguire `001` su un database già inizializzato: l’eventuale disallineamento della cronologia Supabase/GitHub va risolto separatamente, senza reset dei dati.

1. `npm run check:release` (lint, test database/PDF, cartografia, parsing previsioni, build).
2. Aprire `/meteo`, cambiare località e coordinate, provare i quattro layer Windy e l’attivazione/uscita dalla mappa. Cambiare ora nel bollettino, controllare riepiloghi, grafici e tabella; i dati mancanti non diventano zeri. Provare coordinate invalide e riprovare dopo un errore di rete. Verificare separatamente le due timeline.
3. Aprire una scheda AMP dalla mappa; controllare fonti, date e stati mancanti.
4. Con due account abilitati, inviare riscontri per lo stesso attrezzo e verificare il conteggio; verificare la pubblicazione solo dopo revisione dello staff.
5. Commit, push e deploy a cura del proprietario del progetto. Configurare su Vercel le variabili Supabase già usate localmente; nessun account Copernicus/Windy richiesto da questa integrazione.
