# Mappa marina 3D — architettura e dati

La mappa usa **MapLibre GL JS** (vettoriale/raster, WebGL) con vista 3D inclinata.
Tutta la configurazione dei layer è in `src/features/marine-map/config.ts`.

## Due modalità (selettore)

`components/map/MapExplorer.tsx` offre uno switch tra:

- **Mappa marina** — MapLibre GL (AMP, batimetria, satellite Esri, nautica, reti perse, AIS).
- **Earth 3D** — `components/map/EarthGlobe.tsx`, globo Cesium con Google Photorealistic
  3D Tiles (fallback satellite Esri). Caricato solo client-side (`dynamic`, `ssr:false`).

### Earth 3D (Cesium)

- Asset statici serviti da `/cesium` (copiati da `scripts/copy-cesium.mjs` in `postinstall`).
- `NEXT_PUBLIC_GOOGLE_MAPS_KEY` → Google Photorealistic 3D Tiles (Map Tiles API + billing).
- `NEXT_PUBLIC_CESIUM_ION_TOKEN` → terreno mondiale e geocoder (opzionale).
- Senza chiavi: fallback a Esri World Imagery sul globo Cesium.
- Il 3D fotorealistico mostra la superficie, non il fondale (per il fondale: batimetria).

## Componenti

- `components/map/MarineMap.tsx` — wrapper: sidebar ricerca/filtri AMP, pannello toggle layer, animazioni GSAP. Riceve `areas`, `ghostNets`, `aisVessels`.
- `components/map/MarineMapCanvas.tsx` — istanza MapLibre (caricata client-side via `next/dynamic`, `ssr:false`). Costruisce lo stile, gestisce sorgenti GeoJSON dinamiche, popup, `flyTo` e visibilità layer.
- `features/marine-map/config.ts` — endpoint WMS/WMTS/XYZ e default toggle.
- `features/marine-map/data.ts` — fetch AMP, reti perse e AIS (da Supabase o dati di esempio).

## Layer

| Layer | Tipo MapLibre | Fonte | Default |
|-------|---------------|-------|---------|
| Base oceanica | raster | Esri Ocean | on |
| Batimetria | raster (WMS) | EMODnet Bathymetry | on |
| Simbologia nautica | raster (XYZ) | OpenSeaMap | off |
| AMP ufficiali | raster (WMS) | EMODnet HA / MASE | off |
| AMP (punti+label) | geojson circle/symbol | dati app | on |
| Reti perse | geojson circle | dati app | on |
| AIS | geojson circle | `/api/ais` | off |

## Profondità (batimetria)

`EMODNET_BATHYMETRY_WMS` punta al WMS EMODnet (`emodnet:mean_multicolour`),
reso come layer raster semitrasparente sopra la base. In alternativa GEBCO per copertura globale.

## Terreno 3D del fondale

Opzionale: se `NEXT_PUBLIC_MAPTILER_KEY` è presente, viene aggiunta una sorgente
`raster-dem` (terrain-RGB) e attivato `map.setTerrain(...)`. Senza chiave la mappa
resta in 3D prospettico (pitch/bearing) ma senza rilievo reale.

## AIS / monitoraggio pesca

`/api/ais` è un proxy: senza `GFW_API_TOKEN` restituisce dati di esempio; con token
va collegato a Global Fishing Watch e al geofencing dei punti contro i poligoni AMP
(marcando `in_protected_area`). I punti che pescano dentro un'AMP vengono evidenziati
in rosso ed elencati in `/admin/monitoraggio`.

## Reti perse (ghost nets)

`/segnala-rete` cattura la posizione via `navigator.geolocation`, invia a
`POST /api/ghost-nets` (validazione zod). Le segnalazioni compaiono sul layer pubblico
e in `/admin/reti-perse` con workflow report → verifica → recupero.

## Sostituire i poligoni AMP reali

Per i perimetri reali (non solo i centroidi di esempio):
1. scaricare il GeoJSON/WFS ufficiale ISPRA/MASE;
2. importarlo in `marine_protected_areas.geometry` (colonna PostGIS);
3. aggiungere una sorgente `geojson`/vector-tiles e un layer `fill`/`line` nello stile.
