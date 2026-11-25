'use client';

import { InfoDisclosure } from '@/components/ui/InfoDisclosure';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LocateFixed, RefreshCw, X } from 'lucide-react';
import { displayDate, satelliteView, surveyForTheme, filterObservations, isSatelliteRecent, isSatelliteTheme, SATELLITES, THEMES, type ObservationFeature,
  type SatelliteId, type SatelliteData, type SurveyData, type SurveyManifest, type ThemeId } from './data';

const Map = dynamic(() => import('./ObservatoryMap'), { ssr: false,
  loading: () => <div className="observatory-map flex items-center justify-center text-sky-100/70">Caricamento mappa…</div> });
const NO_FEATURES: ObservationFeature[] = [];
const numberFormat = new Intl.NumberFormat('it-IT', { maximumSignificantDigits: 6 });

export function Observatory({ manifest }: { manifest: SurveyManifest }) {
  const [theme, setTheme] = useState<ThemeId>('chlorophyll');
  const [survey, setSurvey] = useState<{ id: ThemeId; data: SurveyData } | null>(null);
  const [surveyError, setSurveyError] = useState<{ id: ThemeId; message: string } | null>(null);
  const [satelliteResult, setSatellite] = useState<Partial<Record<SatelliteId, SatelliteData>>>({});
  const [satelliteFailure, setSatelliteError] = useState<{ id: ThemeId; message: string } | null>(null);
  const [date, setDate] = useState('');
  const [bottles, setBottles] = useState(false);
  const [substance, setSubstance] = useState('');
  const [matrix, setMatrix] = useState('');
  const [region, setRegion] = useState('');
  const [provider, setProvider] = useState('');
  const [year, setYear] = useState('');
  const [fieldMeasurements, setFieldMeasurements] = useState(false);
  const [visibleRows, setVisibleRows] = useState(100);
  const [selection, setSelection] = useState<ObservationFeature[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const definition = THEMES.find(t => t.id === theme)!;
  const surveyId = surveyForTheme(theme, fieldMeasurements);
  const satelliteTheme = surveyId === null;
  const config = isSatelliteTheme(theme) ? SATELLITES[theme] : null;
  const satellite = satelliteTheme && isSatelliteTheme(theme) ? satelliteResult[theme] ?? (theme === 'chlorophyll' ? satelliteResult['coastal-chlorophyll'] : null) : null;
  const satelliteError = satelliteFailure?.id === theme ? satelliteFailure.message : '';
  const meta = surveyId ? manifest[surveyId] : null;
  const dataset = survey?.id === surveyId ? survey.data : null;

  useEffect(() => {
    if (!surveyId) return;
    const controller = new AbortController();
    fetch(`/data/observatory/${surveyId}.json`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Dati non disponibili. Riprova tra poco.');
      const data: SurveyData = await response.json();
      if (data.type !== 'FeatureCollection' || !Array.isArray(data.features) || !data.metadata?.year) throw new Error('La raccolta non è leggibile.');
      if (!controller.signal.aborted) { setSurvey({ id: surveyId, data }); setSurveyError(null); }
    }).catch(error => { if (!controller.signal.aborted) setSurveyError({ id: surveyId, message: error.message }); });
    return () => controller.abort();
  }, [surveyId, attempt]);

  useEffect(() => {
    if (!satelliteTheme || !isSatelliteTheme(theme)) return;
    const controller = new AbortController();
    const refresh = async () => {
      const ids: SatelliteId[] = theme === 'chlorophyll' ? ['chlorophyll', 'coastal-chlorophyll'] : [theme];
      const results = await Promise.allSettled(ids.map(async id => {
        const response = await fetch(`/api/osservatorio/satellite?v=3&theme=${encodeURIComponent(id)}`, { signal: controller.signal });
        const data: SatelliteData & { error?: string } = await response.json();
        const expected = SATELLITES[id];
        const [min, max] = expected.style.split('range:')[1].split('/').map(Number);
        if (!response.ok || !data.legend || data.legend.min !== min || data.legend.max !== max || data.id !== id || data.unit !== expected.unit || data.layer !== expected.layer || !isSatelliteRecent(data.observedAt)) throw new Error(data.error || 'Nessuna osservazione satellitare recente verificabile.');
        return data;
      }));
      if (controller.signal.aborted) return;
      const available: Partial<Record<SatelliteId, SatelliteData>> = {};
      for (const result of results) if (result.status === 'fulfilled') available[result.value.id] = result.value;
      setSatellite(available);
      setSatelliteError(Object.keys(available).length ? null : { id: theme, message: 'Nessuna osservazione satellitare recente verificabile. Riprova o consulta la fonte ufficiale.' });
    };
    void refresh();
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 300000);
    window.addEventListener('focus', refresh);
    return () => { controller.abort(); clearInterval(interval); window.removeEventListener('focus', refresh); };
  }, [theme, satelliteTheme, attempt]);

  const features = useMemo(() => dataset ? filterObservations(dataset.features, {
    bottles: theme === 'beach' && bottles, substance: theme === 'chemicals' ? substance : '', matrix: theme === 'chemicals' ? matrix : '',
    region, provider, year,
  }) : NO_FEATURES, [dataset, theme, bottles, substance, matrix, region, provider, year]);
  const substances = useMemo(() => [...new Set(dataset?.features.map(f => f.properties.substance).filter((s): s is string => !!s))].sort(), [dataset]);
  const regions = useMemo(() => [...new Set(dataset?.features.map(f => f.properties.region).filter((s): s is string => !!s))].sort(), [dataset]);
  const providers = useMemo(() => [...new Set(dataset?.features.map(f => f.properties.provider).filter((s): s is string => !!s))].sort(), [dataset]);
  const { dates: availableDates, date: satelliteDate, rasters: raster } = useMemo(
    () => satelliteView(satelliteTheme ? theme : 'beach', satelliteResult, date), [theme, satelliteTheme, satelliteResult, date]);
  const selected = selection.find(f => f.id === selectedId) ?? selection[0];
  const error = satelliteTheme ? satelliteError : surveyError?.id === surveyId ? surveyError.message : '';
  const loading = !error && (satelliteTheme ? !satellite : !dataset);
  const select = useCallback((items: ObservationFeature[]) => { setSelection(items); setSelectedId(items[0].id); }, []);
  const clearSelection = () => { setSelection([]); setSelectedId(''); };
  const resetFilters = () => { setRegion(''); setProvider(''); setYear(''); setSubstance(''); setMatrix(''); setVisibleRows(100); clearSelection(); };
  const choose = (id: ThemeId) => { setTheme(id); setFieldMeasurements(false); setDate(''); resetFilters(); setSurveyError(null); setMapStatus('loading'); };

  return <>
    <nav aria-label="Temi dell’osservatorio" className="observatory-themes">
      {THEMES.map(item => <button key={item.id} type="button" aria-pressed={theme === item.id} onClick={() => choose(item.id)}>{item.label}</button>)}
    </nav>

    <section aria-label={definition.label} className="observatory-workspace">
      <div className="observatory-map-column">
        <div className="observatory-map-heading">
          <div><p className="text-sm text-sky-100/60">{fieldMeasurements ? 'Campionamenti ARPAV · Veneto' : definition.subtitle}</p><h2 className="mt-1 text-2xl text-white">{definition.label}</h2></div>
          <div className="text-right text-sm"><span className="block text-sky-100/60">{satelliteTheme ? 'Osservazione satellitare' : 'Campagna disponibile'}</span>
            <strong className="font-medium text-white">{satelliteTheme ? satelliteDate ? displayDate(satelliteDate) : 'Data in verifica' : meta?.year}</strong></div>
        </div>
        <div className="observatory-map-stage">
          <Map key={attempt} features={features} satellite={raster} onSelect={select} onStatus={setMapStatus} resetKey={resetKey}/>
          <button type="button" className="observatory-map-reset" aria-label="Inquadra il Mediterraneo" title="Inquadra il Mediterraneo" onClick={() => setResetKey(k => k + 1)}><LocateFixed size={20}/></button>
          {(loading || error || mapStatus === 'error') && <div className="observatory-map-message" role="status">
            {loading ? 'Caricamento delle osservazioni…' : error || 'Alcuni livelli cartografici non sono disponibili. Le schede dei dati restano consultabili.'}
            {!loading && <button type="button" onClick={() => { setSurveyError(null); setSatelliteError(null); setAttempt(n => n + 1); setResetKey(n => n + 1); }} className="mt-3 flex items-center gap-2 underline underline-offset-4"><RefreshCw size={16}/>Riprova</button>}
          </div>}
          {!loading && !error && !satelliteTheme && !features.length && <div className="observatory-map-message" role="status">Nessuna osservazione per questi filtri nell’ultima campagna disponibile.</div>}
        </div>
        <div className="observatory-map-caption">
          <span>{satelliteTheme ? `${definition.label} · ${config?.unit} · ${theme === 'chlorophyll' ? '~1 km + 100 m costiero' : config?.resolution}` : `${features.length} osservazioni visualizzate · seleziona un punto`}</span>
          <a href={fieldMeasurements ? meta?.sourceUrl : definition.url} target="_blank" rel="noreferrer">{fieldMeasurements ? 'ARPAV · Open Data' : definition.source}</a>
        </div>
      </div>

      <aside className="observatory-detail" aria-label="Dati e dettagli">
        <div className="observatory-filters">
          {(theme === 'turbidity' || theme === 'suspended-matter') && <label>Tipo di osservazione<select value={fieldMeasurements ? 'samples' : 'satellite'} onChange={e => { setFieldMeasurements(e.target.value === 'samples'); resetFilters(); setSurveyError(null); }}><option value="satellite">Satellite · Copernicus</option><option value="samples">Misure in mare · ARPAV</option></select></label>}
          {satelliteTheme && satellite && <label>Data dell’osservazione<select value={satelliteDate} onChange={e => setDate(e.target.value)}>{availableDates.map(d => <option key={d} value={d}>{displayDate(d)}{d === availableDates[0] ? ' · ultima disponibile' : ''}</option>)}</select></label>}
          {!satelliteTheme && dataset && <>
            {providers.length > 1 && <label>Fonte<select value={provider} onChange={e => { setProvider(e.target.value); clearSelection(); }}><option value="">Tutte le fonti</option>{providers.map(p => <option key={p}>{p}</option>)}</select></label>}
            {regions.length > 0 && <label>Regione italiana<select value={region} onChange={e => { setRegion(e.target.value); clearSelection(); }}><option value="">Tutto il Mediterraneo</option>{regions.map(r => <option key={r}>{r}</option>)}</select></label>}
            {(meta?.years?.length ?? 0) > 1 && <label>Anno della campagna<select value={year} onChange={e => { setYear(e.target.value); clearSelection(); }}><option value="">Ultime campagne per fonte</option>{meta?.years?.map(y => <option key={y}>{y}</option>)}</select></label>}
          </>}
          {theme === 'beach' && <label>Tipologia<select value={bottles ? 'bottles' : 'all'} onChange={e => { setBottles(e.target.value === 'bottles'); clearSelection(); }}><option value="all">Tutti i rifiuti censiti</option><option value="bottles">Bottiglie · categorie specifiche</option></select></label>}
          {theme === 'chemicals' && <><label>Sostanza<select value={substance} onChange={e => { setSubstance(e.target.value); clearSelection(); }}><option value="">Tutte le sostanze</option>{substances.map(s => <option key={s}>{s}</option>)}</select></label>
            <label>Matrice<select value={matrix} onChange={e => { setMatrix(e.target.value); clearSelection(); }}><option value="">Tutte le matrici</option><option value="acqua">Acqua</option><option value="sedimento">Sedimento</option><option value="organismi">Organismi</option></select></label></>}
        </div>
        {theme === 'chlorophyll' && satelliteDate && <div className="mb-5 space-y-2 text-xs text-sky-100/75" aria-live="polite">
          {(['chlorophyll', 'coastal-chlorophyll'] as const).map(id => <p key={id}>{id === 'chlorophyll' ? 'Bacino · ~1 km' : 'Costa · 100 m'}: {satelliteResult[id]?.dates.includes(satelliteDate) ? displayDate(satelliteDate) : 'non disponibile per questa data'}</p>)}
        </div>}
        {selected ? <div className="observatory-selection" aria-live="polite">
          <div className="flex items-start justify-between gap-3"><h3 className="text-xl text-white">{selected.properties.title}</h3><button type="button" onClick={clearSelection} aria-label="Chiudi dettagli" className="p-2"><X size={20}/></button></div>
          {selection.length > 1 && <label className="mt-3 block text-sm">{selection.length} osservazioni in questo punto<select value={selected.id} onChange={e => setSelectedId(e.target.value)}>{selection.map((f, i) => <option key={f.id} value={f.id}>{displayDate(f.properties.observedAt)} · {f.properties.measurements[0]?.name ?? f.properties.title} · {i + 1}</option>)}</select></label>}
          <p className="mt-3 text-sm text-[var(--color-aqua)]">{displayDate(selected.properties.observedAt)} · {selected.properties.method}</p>
          <InfoDisclosure key={selected.id} label="Info sull’osservazione"><p>{selected.properties.details}</p></InfoDisclosure>
          <div className="observatory-measurements">{selected.properties.measurements.filter(m => !bottles || theme !== 'beach' || m.name.startsWith('Bottiglie')).map((m, i) => <div key={i}>
            <p className="text-sm text-sky-100/80">{m.name}</p><p className="mt-1 text-xl text-white">{m.qualifier}{numberFormat.format(m.value)} <span className="text-sm text-sky-100/60">{m.unit}</span></p>
            {m.definition && <details className="mt-2 text-xs text-sky-100/60"><summary>Definizione della misura</summary><p className="mt-2">{m.definition}</p></details>}
          </div>)}</div>
          <p className="mt-4 text-xs text-sky-100/60">{selected.properties.originator}</p>
          <a className="mt-3 inline-block text-sm underline underline-offset-4" href={selected.properties.sourceUrl} target="_blank" rel="noreferrer">Consulta la raccolta originale</a>
        </div> : <div className="observatory-explanation">

          {satelliteTheme && satellite && config && <div className="mt-5"><p className="mb-2 text-sm text-sky-100/70">Scala logaritmica · {config.unit} · {config.range}</p>
            {satellite.legend && <div role="img" aria-label={`Scala ${definition.label}: ${config.range} ${config.unit}`}>
              <div className="h-4 w-full border border-white/20" style={{ background: `linear-gradient(to right, ${satellite.legend.colors.join(',')})` }}/>
              <div className="mt-2 flex justify-between text-sm tabular-nums text-sky-100/80">{[satellite.legend.min, Math.sqrt(satellite.legend.min * satellite.legend.max), satellite.legend.max].map(value => <span key={value}>{new Intl.NumberFormat('it-IT', { maximumSignificantDigits: 3 }).format(value)}</span>)}</div>
            </div>}
            </div>}
          {!satelliteTheme && <p className="mt-5 flex items-center gap-2 text-sm text-sky-100/75"><span className="h-3 w-3 shrink-0 rounded-full border border-white bg-[#087d8b]"/>Punto di osservazione · colore senza soglie di rischio</p>}
        </div>}
        <InfoDisclosure key={`${theme}-${fieldMeasurements}`} label="Info sul livello">{fieldMeasurements ? <><p>Misure costiere ARPAV dell’ultima campagna pubblicata. I punti indicano prelievi o misure con sonda, con date indipendenti dal satellite.</p><p>{theme === 'turbidity' ? 'Torbidità in FTU: misura effettiva più vicina alla superficie, entro 1 m, per stazione e giorno. Le FTU non sono convertite nelle FNU del prodotto satellitare.' : 'Solidi sospesi in mg/L misurati su campioni d’acqua; le profondità restano indicate nelle schede.'} Nessuna interpolazione o soglia di rischio.</p></> : <><p>{definition.description}</p><p>{definition.note}</p></>}{theme === 'chlorophyll' && <a className="underline" href="https://data.marine.copernicus.eu/product/OCEANCOLOUR_MED_BGC_HR_L3_NRT_009_205/description" target="_blank" rel="noreferrer">Fonte del dettaglio costiero · Copernicus Marine</a>}{satelliteTheme && <p>I valori oltre gli estremi usano il colore limite. La scala non indica soglie di rischio.</p>}</InfoDisclosure>
      </aside>
    </section>

    {dataset && <details className="observatory-data-list"><summary>Esplora le osservazioni anche senza mappa ({features.length})</summary>
      <div className="observatory-table-scroll"><table><thead><tr><th>Luogo / stazione</th><th>Data</th><th>Misura</th><th>Valore</th><th>Dettagli</th></tr></thead><tbody>{features.slice(0, visibleRows).map(f => {
        const measurement = theme === 'beach' && bottles ? f.properties.measurements.find(m => m.name.startsWith('Bottiglie')) : f.properties.measurements[0];
        return <tr key={f.id}><td>{f.properties.title}</td><td>{displayDate(f.properties.observedAt)}</td><td>{measurement?.name ?? 'Infrastruttura censita'}</td>
          <td>{measurement ? `${measurement.qualifier ?? ''}${numberFormat.format(measurement.value)} ${measurement.unit}` : '—'}</td>
          <td><button type="button" onClick={() => { select([f]); document.querySelector('.observatory-detail')?.scrollIntoView({ block: 'start', behavior: 'instant' }); }}>Apri<span className="sr-only"> {f.properties.title} del {displayDate(f.properties.observedAt)}</span></button></td></tr>;
      })}</tbody></table></div>
      {features.length > visibleRows && <button type="button" onClick={() => setVisibleRows(n => n + 100)} className="mt-4 underline underline-offset-4">Mostra altre osservazioni ({visibleRows} di {features.length})</button>}
    </details>}

    <div className="observatory-provenance">
      {meta && <p className="text-sm text-sky-100/65">{meta.edition} · {displayDate(meta.observedFrom)} – {displayDate(meta.observedTo)} · Verificata il {displayDate(meta.verifiedAt)}</p>}
      <InfoDisclosure label="Info sulla copertura"><p>Le aree senza osservazioni non indicano assenza di inquinamento. La copertura dipende dalle campagne e dalle condizioni di acquisizione.</p><p>Il servizio verifica l’ultima data pubblicata da Copernicus. Sono visualizzabili soltanto osservazioni satellitari degli ultimi 7 giorni.</p></InfoDisclosure>
    </div>
    <details className="observatory-sources"><summary>Info · Fonti e attribuzioni</summary><div className="grid gap-5 pt-5 md:grid-cols-2">
      <p>Campionamenti: EMODnet Chemistry, OGS e istituti originatori indicati nelle schede. Raccolte unrestricted 2026, CC BY 4.0. Data and metadata are provided by EMODnet Chemistry under the support of DG MARE, CINEA/2024/OP/0006. Nessuna superficie stimata tra i campioni.</p>
      <p>Monitoraggi italiani: <a href="https://strategiamarina.isprambiente.it/sic-sistema-informativo-centralizzato/" target="_blank" rel="noreferrer" className="underline">SIC ISPRA · dati ARPA</a>, archivio 2024–2026; l’anno del contenitore non è la data della misura. Selezione delle ultime campagne per regione e matrice, con esclusione dei record incompleti o incoerenti. Elaborazione MareSalvo: normalizzazione, filtri e georeferenziazione. <a href="https://www.isprambiente.gov.it/it/note-legali" target="_blank" rel="noreferrer" className="underline">Condizioni ISPRA</a>.</p>
      <p>Torbidità e solidi sospesi misurati: <a href="https://opendata.arpa.veneto.it/" target="_blank" rel="noreferrer" className="underline">ARPAV Open Data</a>, licenza CC BY. Coordinate convertite da Gauss-Boaga Ovest; unità e date originali conservate. L’aggiornamento dei campionamenti richiede una nuova importazione verificata.</p>
      <p>Satellite: Copernicus Marine Service, prodotti OCEANCOLOUR_MED_BGC_L3_NRT_009_141 (bacino) e OCEANCOLOUR_MED_BGC_HR_L3_NRT_009_205 (fascia costiera). Clorofilla, torbidità e materiale sospeso hanno date e scale indipendenti. Scarichi: EEA Waterbase UWWTD, edizione pubblica 2026, periodo 2022–2023. I dati EEA sono limitati all’area di studio costiera mediterranea e ai paesi presenti nella raccolta.</p>
      <p>Rifiuti galleggianti: l’archivio satellitare 2015–2021 è escluso da questa vista aggiornata. Non è disponibile qui un flusso validato di nuove rilevazioni.</p>
      <p>Petrolio: nessun livello operativo è pubblicato. Il servizio EMSA CleanSeaNet ha accesso riservato; una rilevazione SAR richiede validazione.</p>
    </div></details>
  </>;
}
