/**
 * Configurazione layer cartografici marini.
 *
 * Le fonti sono servizi cartografici UFFICIALI / pubblici esposti via WMS/WMTS/XYZ,
 * così la mappa resta sempre aggiornata senza dover ospitare dataset statici.
 *
 * - Aree Marine Protette: MASE / ISPRA / EMODnet Human Activities (WMS/WFS)
 * - Batimetria (profondità): EMODnet Bathymetry (WMS/WMTS) + GEBCO (fallback globale)
 * - Satellite: Esri World Imagery (gratuito, nessuna key)
 * - Simbologia nautica: OpenSeaMap seamarks (XYZ)
 * - Terreno 3D del fondale: opzionale, richiede una sorgente terrain-RGB (es. MapTiler)
 *
 * NOTA: gli endpoint WMS pubblici possono cambiare. Sono centralizzati qui
 * per poterli aggiornare in un solo punto.
 */

export const MAP_CENTER: [number, number] = [12.5674, 41.8719]; // [lng, lat] Italia
export const MAP_INITIAL = {
  zoom: 5.4,
  pitch: 55, // inclinazione per la vista 3D
  bearing: -10,
};

/** Base oceanica raster (Esri Ocean) — leggera e gratuita per uso non commerciale. */
export const OCEAN_BASE_TILES = [
  "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
];
export const OCEAN_REFERENCE_TILES = [
  "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}",
];

/** Satellite (Esri World Imagery) — gratuito per uso non commerciale, nessuna key. */
export const ESRI_SATELLITE_TILES = [
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
];

/**
 * EMODnet Bathymetry — WMS profondità/rilievo del fondale (mari europei).
 * Layer "emodnet:mean_atlas_land" o "emodnet:mean_multicolour" per la visualizzazione colore-profondità.
 */
export const EMODNET_BATHYMETRY_WMS =
  "https://ows.emodnet-bathymetry.eu/wms" +
  "?service=WMS&request=GetMap&version=1.3.0" +
  "&layers=emodnet:mean_multicolour&styles=" +
  "&format=image/png&transparent=true" +
  "&crs=EPSG:3857&width=256&height=256&bbox={bbox-epsg-3857}";

/** OpenSeaMap — boe, secche, fari, simbologia nautica. */
export const OPENSEAMAP_SEAMARK_TILES = [
  "https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png",
];

/**
 * Aree Marine Protette — WMS ufficiale.
 * Sostituire con l'endpoint MASE/ISPRA definitivo quando disponibile;
 * EMODnet Human Activities espone un dataset MPA europeo utilizzabile da subito.
 */
export const MPA_WMS =
  "https://ows.emodnet-humanactivities.eu/wms" +
  "?service=WMS&request=GetMap&version=1.3.0" +
  "&layers=emodnet:mpa&styles=" +
  "&format=image/png&transparent=true" +
  "&crs=EPSG:3857&width=256&height=256&bbox={bbox-epsg-3857}";

/**
 * Terreno 3D opzionale (terrain-RGB). Richiede una chiave (es. MapTiler).
 * Se NEXT_PUBLIC_MAPTILER_KEY non è impostata, la mappa resta in 3D "prospettico"
 * senza rilievo reale del fondale.
 */
export function getTerrainTiles(): string | null {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (!key) return null;
  return `https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=${key}`;
}

/** Stato visualizzazione layer (toggle in UI). */
export interface LayerToggles {
  satellite: boolean; // basemap satellitare Esri
  bathymetry: boolean; // profondità EMODnet
  seamarks: boolean; // simbologia nautica OpenSeaMap
  mpaOfficial: boolean; // WMS AMP ufficiale
  ghostNets: boolean; // reti perse segnalate
  ais: boolean; // overlay imbarcazioni / pesca
}

export const DEFAULT_LAYERS: LayerToggles = {
  satellite: false,
  bathymetry: true,
  seamarks: false,
  mpaOfficial: false,
  ghostNets: true,
  ais: false,
};
