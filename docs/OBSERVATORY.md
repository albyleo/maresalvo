# Osservatorio del Mediterraneo

Route pubblica `/osservatorio`, MapLibre, senza login o nuove migrazioni Supabase.
Un'unica mappa carica solo il tema attivo. Le schede e la tabella rimangono
consultabili anche in caso di errore cartografico. Nessun archivio satellitare
2015–2021 o allarme petrolio sperimentale viene pubblicato.

## Criterio di aggiornamento concordato

- Campionamenti: ultima campagna regionale nella più recente raccolta integrata,
  anno sempre visibile. Non si usa l'anno del file come data di osservazione.
- Clorofilla: data effettiva dal GetCapabilities Copernicus, limite massimo 7 giorni.
  Metadati verificati dal server con cache di un'ora; controllo client ogni 5 minuti
  mentre la pagina è visibile e al ritorno sulla finestra. Data esplicita in ogni
  richiesta di tile. Nessun ripiego silenzioso su una vecchia immagine.
- Le raccolte annuali sono snapshot verificati, **non feed live**. La data di verifica
  è pubblicata. Aggiornarli con lo script, controllare il diff, poi eseguire il normale
  commit/deploy. Il sito non modifica la repository autonomamente.

## Aggiornare i campionamenti

Python 3 e `openpyxl` sono necessari solo per la sincronizzazione, non su Vercel.
Dipendenze import: `python -m pip install -r scripts/observatory-requirements.txt`.

```
npm run observatory:sync
npm run test:observatory
```

Per rielaborare file già scaricati: `python scripts/sync-observatory.py --offline`.
Le fonti con edizione sono fissate in `SOURCES` nello script: prima di una nuova
edizione verificare il catalogo ufficiale e aggiornare URL, etichette e parser.
Non provare semplicemente un anno futuro nel nome del file.

Gli archivi originali restano in `output/observatory` (ignorata da Git).
Gli estratti pubblici sono in `public/data/observatory`, con manifest, date e SHA256
dei file originali. I JSON pubblici vanno inclusi nel commit. Nessuna credenziale
è richiesta per le fonti di questa versione.

## Metodo e limiti

- Spiagge: raccolta mediterranea OGS 2026; ultima campagna MSFD, ultimo rilievo per
  spiaggia. Quantità normalizzata per 100 m soltanto con lunghezza valida. Bottiglie:
  elenco esatto di categorie; tappi, frammenti e categorie miste sono esclusi.
- Microlitter: ODV globale 2026, ritaglio dell'area mediterranea prima di selezionare
  l'ultimo anno. Conservate frazioni campionate, forma, dimensione e materiale;
  conteggi senza inventare concentrazioni. Flag qualità 1 e 2.
- Fondali: CSV mediterraneo 2026, posizione iniziale delle trainate, categorie e
  unità originali, ultimo anno disponibile. Non sono geolocalizzazioni di singole reti.
- Contaminanti: sei tabelle ODV trasposte 2026. Solo metalli e pesticidi selezionati,
  anno più recente regionale, matrici separate, nomi P01 e unità originali. Flag 1/2
  accettati, flag 6 indicato con `<` (sotto limite di rilevazione), altri esclusi.
  Nessuna media tra matrici/profondità, nessuna soglia sanitaria.
- Scarichi: EEA Waterbase, edizione pubblica marzo 2026, periodo 2022–2023.
  Solo `CW`, stato 1. Sono infrastrutture censite, senza portate o impatto attuale.
- L'area di studio usa un inviluppo costiero con esclusione delle coste atlantiche,
  Mar Nero e Marmara. Non è un confine marino legale o ecologico. La copertura
  dipende dalle fonti e non è uniforme tra paesi; nessun dato non significa zero.
- I contatti dei rilevatori presenti nei file originali non vengono esportati.

## Fonti e accesso

- EMODnet Chemistry: https://emodnet.ec.europa.eu/en/chemistry
- Clorofilla: https://data.marine.copernicus.eu/product/OCEANCOLOUR_MED_BGC_L3_NRT_009_141/services
- WMTS: https://help.marine.copernicus.eu/en/articles/6478168-how-to-use-the-copernicus-marine-web-map-tile-service-wmts
- Scarichi: https://www.eea.europa.eu/en/datahub/datahubitem-view/21874828-fa7a-4e7e-8a0a-52ec7d92f99f

I servizi satellitari pubblici WMTS consentono questa visualizzazione senza
account; l'eventuale download massivo futuro con Toolbox ha requisiti distinti.
Attribuzioni e collegamenti alle raccolte sono visibili nell'interfaccia.

## Verifica

`npm run test:observatory` verifica date, freschezza, errori dei metadati, filtri,
unità, provenienza e integrità degli estratti. `npm run check:release` include
questi controlli insieme ai test esistenti e alla build.
