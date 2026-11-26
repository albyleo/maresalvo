export type SatelliteId = 'chlorophyll' | 'coastal-chlorophyll' | 'turbidity' | 'suspended-matter';
export type SurveyId = 'beach' | 'micro' | 'seafloor' | 'chemicals' | 'discharges' | 'turbidity-samples' | 'suspended-matter-samples';
export type ThemeId = SatelliteId | SurveyId;
export interface Measurement { name: string; value: number; unit: string; qualifier?: string; definition?: string }
export interface Observation {
  id: string; title: string; observedAt: string; method: string; details: string;
  originator: string; sourceUrl: string; measurements: Measurement[];
  country?: string; bottles?: number | null; substance?: string; matrix?: string;
  region?: string; provider?: string;
}
export interface ObservationFeature {
  type: 'Feature'; id: string; geometry: { type: 'Point'; coordinates: [number, number] }; properties: Observation;
}
export interface SurveyMetadata {
  edition: string; verifiedAt: string; observedFrom: string; observedTo: string;
  year: string; count: number; sourceUrl: string; sha256: string;
  years?: string[]; sources?: { provider: string; sourceUrl: string; count: number; verifiedAt?: string; license?: string; syncStatus?: string; lastAttemptAt?: string; syncWarning?: string }[];
  regionalCoverage?: { region: string; sourceUrl: string; status: string; reviewedAt: string; count: number; stations: number; years: string[] }[];
}
export interface SurveyData { type: 'FeatureCollection'; metadata: SurveyMetadata; features: ObservationFeature[] }
export type SurveyManifest = Record<SurveyId, SurveyMetadata>;
export interface SatelliteLegend { colors: string[]; min: number; max: number }
export interface SatelliteData { id: SatelliteId; observedAt: string; dates: string[]; checkedAt: string; layer: string; unit: string; legend?: SatelliteLegend }

const COASTAL_DATASET = 'OCEANCOLOUR_MED_BGC_HR_L3_NRT_009_205/cmems_obs_oc_med_bgc_tur-spm-chl_nrt_l3-hr-mosaic_P1D-m_202107';
const COASTAL_URL = 'https://data.marine.copernicus.eu/product/OCEANCOLOUR_MED_BGC_HR_L3_NRT_009_205/description';
export const SATELLITES = {
  chlorophyll: { layer: 'OCEANCOLOUR_MED_BGC_L3_NRT_009_141/cmems_obs-oc_med_bgc-plankton_nrt_l3-multi-1km_P1D_202211/CHL',
    sourceUnit: 'milligram m^-3', unit: 'mg/m³', resolution: '~1 km', style: 'cmap:algae,logScale,range:0.03/30', range: '0,03–30', maxzoom: 10 },
  'coastal-chlorophyll': { layer: `${COASTAL_DATASET}/CHL`, sourceUnit: 'mg m-3', unit: 'mg/m³', resolution: '100 m · fascia costiera',
    style: 'cmap:algae,logScale,range:0.03/30', range: '0,03–30', maxzoom: 12 },
  turbidity: { layer: `${COASTAL_DATASET}/TUR`, sourceUnit: 'FNU', unit: 'FNU', resolution: '100 m · fascia costiera',
    style: 'cmap:solar,logScale,range:0.1/100', range: '0,1–100', maxzoom: 12 },
  'suspended-matter': { layer: `${COASTAL_DATASET}/SPM`, sourceUnit: 'g m-3', unit: 'g/m³', resolution: '100 m · fascia costiera',
    style: 'cmap:matter,logScale,range:0.1/100', range: '0,1–100', maxzoom: 12 },
} as const;
export function isSatelliteTheme(id: string): id is SatelliteId { return Object.hasOwn(SATELLITES, id); }

export const THEMES: { id: ThemeId; label: string; subtitle: string; description: string; note: string; source: string; url: string }[] = [
  { id: 'micro', label: 'Microplastiche', subtitle: 'Campioni di microlitter',
    description: 'Campionamenti superficiali EMODnet e ARPA, distribuiti da ISPRA. È mantenuta l’ultima campagna disponibile per fonte e regione, con la data di ciascun prelievo.',
    note: 'Le unità restano quelle originali: conteggi per frazione nei dati EMODnet, oggetti/m² nei dati ARPA. Non sono direttamente confrontabili. Microlitter e plastica non sono sinonimi; nessuna superficie è interpolata tra i campioni.',
    source: 'EMODnet · ISPRA / ARPA', url: 'https://strategiamarina.isprambiente.it/sic-sistema-informativo-centralizzato/' },
  { id: 'chemicals', label: 'Metalli e pesticidi', subtitle: 'Analisi di laboratorio',
    description: 'Misure dell’ultima campagna disponibile, selezionabili per sostanza e matrice. Acqua, sedimento e organismi conservano unità e definizioni distinte.',
    note: 'Il simbolo < indica un valore sotto il limite dichiarato: la scheda distingue rilevazione e quantificazione. Acqua, sedimento e biota, così come peso secco e umido, richiedono confronti separati. Non sono applicate soglie di sicurezza o interpolazioni tra stazioni.',
    source: 'EMODnet · ISPRA / ARPA', url: 'https://strategiamarina.isprambiente.it/sic-sistema-informativo-centralizzato/' },
  { id: 'discharges', label: 'Scarichi costieri', subtitle: 'Infrastrutture censite',
    description: 'Punti di scarico operativi censiti in acque costiere nell’ultima edizione pubblica EEA integrata. Sono escluse acque interne e punti fuori dall’area di studio.',
    note: 'Il censimento descrive infrastrutture: non misura la portata attuale, la dispersione o la qualità microbiologica e non identifica scarichi illeciti.',
    source: 'EEA · Waterbase UWWTD', url: 'https://www.eea.europa.eu/en/datahub/datahubitem-view/21874828-fa7a-4e7e-8a0a-52ec7d92f99f' },
  { id: 'beach', label: 'Rifiuti spiaggiati', subtitle: 'Monitoraggio dei rifiuti',
    description: 'Ultimo rilievo per spiaggia nelle campagne integrate: raccolta mediterranea EMODnet e monitoraggi regionali ARPA pubblicati da ISPRA. Anni e coperture possono differire; i filtri permettono di selezionare fonte, regione e anno.',
    note: 'Il filtro bottiglie include solo categorie specifiche: esclude tappi e categorie miste. Zero significa conteggio nullo; un dato mancante resta non disponibile.',
    source: 'EMODnet · ISPRA / ARPA', url: 'https://strategiamarina.isprambiente.it/sic-sistema-informativo-centralizzato/' },
  { id: 'seafloor', label: 'Rifiuti sul fondale', subtitle: 'Campagne scientifiche',
    description: 'Posizioni iniziali delle trainate scientifiche nell’ultima campagna disponibile. I codici delle categorie e le unità originali accompagnano ogni osservazione.',
    note: 'La copertura è discontinua. Questi rilievi non rappresentano tutte le reti abbandonate e non indicano la posizione attuale di un singolo oggetto.',
    source: 'EMODnet Chemistry · OGS', url: 'https://doi.org/10.13120/daf1f1d1-2346-485a-8ecd-5d923cb71400' },
  { id: 'turbidity', label: 'Torbidità', subtitle: 'Satellite · dettaglio a 100 m',
    description: 'Stima della torbidità dell’acqua nella fascia di circa 20 km dalla costa. La scala mostra la diffusione della luce associata alle particelle presenti in acqua.',
    note: 'Una torbidità elevata può avere cause naturali o antropiche. Il colore non identifica scarichi, plastica o batteri. Le aree trasparenti non hanno una stima valida per la data selezionata.',
    source: 'Copernicus Marine · Sentinel-2', url: COASTAL_URL },
  { id: 'suspended-matter', label: 'Materiale sospeso', subtitle: 'Satellite · dettaglio a 100 m',
    description: 'Stima della concentrazione di materiale particolato sospeso nella fascia di circa 20 km dalla costa. I valori in g/m³ equivalgono numericamente a mg/L.',
    note: 'Le particelle possono comprendere sedimenti e materiale organico. La misura non quantifica plastica né identifica la sorgente. Le aree trasparenti non hanno una stima valida per la data selezionata.',
    source: 'Copernicus Marine · Sentinel-2', url: COASTAL_URL },
  { id: 'chlorophyll', label: 'Clorofilla', subtitle: 'Osservazioni satellitari',
    description: 'Il colore del mare racconta la presenza di fitoplancton. Clorofilla superficiale del bacino a circa 1 km, con dettaglio Sentinel-2 a 100 m nella fascia costiera. I due prodotti condividono data e scala cromatica; il dettaglio costiero si sovrappone dove disponibile, senza interpolare le zone mancanti.',
    note: 'Le aree trasparenti possono essere prive di osservazioni valide, anche per nuvole. La clorofilla non identifica specie tossiche e non determina la balneabilità.',
    source: 'Copernicus Marine', url: 'https://data.marine.copernicus.eu/product/OCEANCOLOUR_MED_BGC_L3_NRT_009_141/description' },
];

export function displayDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(date)) return date;
  const value = new Date(date.slice(0, 10) + 'T00:00:00Z');
  return Number.isNaN(value.getTime()) ? 'Data non disponibile' : new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(value);
}

export function filterObservations(features: ObservationFeature[], filters: { bottles: boolean; substance: string; matrix: string; region?: string; provider?: string; year?: string }) {
  return features.filter(f => (!filters.bottles || typeof f.properties.bottles === 'number')
    && (!filters.substance || f.properties.substance === filters.substance)
    && (!filters.matrix || f.properties.matrix === filters.matrix)
    && (!filters.region || f.properties.region === filters.region)
    && (!filters.provider || f.properties.provider === filters.provider)
    && (!filters.year || f.properties.observedAt.startsWith(filters.year)));
}

export function surveyForTheme(theme: ThemeId, fieldMeasurements: boolean): SurveyId | null {
  if (fieldMeasurements && (theme === 'turbidity' || theme === 'suspended-matter')) return `${theme}-samples`;
  return isSatelliteTheme(theme) ? null : theme;
}

export function isSatelliteRecent(date: string, now = Date.now()) {
  const timestamp = Date.parse(date);
  return Number.isFinite(timestamp) && timestamp <= now && timestamp >= now - 7 * 86400000;
}

export function satelliteTileUrl(layer: string, date: string, style: string = SATELLITES.chlorophyll.style) {
  const query = new URLSearchParams({ service: 'WMTS', version: '1.0.0', request: 'GetTile', layer,
    tilematrixset: 'EPSG:3857', time: date, style, format: 'image/png' });
  return `https://wmts.marine.copernicus.eu/teroWmts?${query}&tilematrix={z}&tilerow={y}&tilecol={x}`;
}

/** Overlay only observations for the same day, with coastal pixels above the basin. */
export function satelliteView(theme: ThemeId, data: Partial<Record<SatelliteId, SatelliteData>>, requestedDate: string) {
  const ids: SatelliteId[] = theme === 'chlorophyll' ? ['chlorophyll', 'coastal-chlorophyll'] : isSatelliteTheme(theme) ? [theme] : [];
  const dates = [...new Set(ids.flatMap(id => data[id]?.dates ?? []))].sort().reverse();
  const commonDate = theme === 'chlorophyll' ? dates.find(d => ids.every(id => data[id]?.dates.includes(d))) : undefined;
  const date = dates.includes(requestedDate) ? requestedDate : commonDate ?? dates[0];
  const rasters = ids.flatMap(id => {
    const item = data[id];
    return item && date && item.dates.includes(date) ? [{ layer: item.layer, date, style: SATELLITES[id].style, maxzoom: SATELLITES[id].maxzoom }] : [];
  });
  return { dates, date, rasters };
}
