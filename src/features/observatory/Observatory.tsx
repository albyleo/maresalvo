'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, LocateFixed, RefreshCw, X } from 'lucide-react';
import { displayDate, filterObservations, isSatelliteRecent, SATELLITE_STYLE, THEMES, type ObservationFeature,
  type SatelliteData, type SurveyData, type SurveyManifest, type ThemeId } from './data';

const Map = dynamic(() => import('./ObservatoryMap'), { ssr: false,
  loading: () => <div className="observatory-map flex items-center justify-center text-sky-100/70">Caricamento mappa…</div> });
const NO_FEATURES: ObservationFeature[] = [];
const numberFormat = new Intl.NumberFormat('it-IT', { maximumSignificantDigits: 6 });

export function Observatory({ manifest }: { manifest: SurveyManifest }) {
  const [theme, setTheme] = useState<ThemeId>('chlorophyll');
  const [survey, setSurvey] = useState<{ id: ThemeId; data: SurveyData } | null>(null);
  const [surveyError, setSurveyError] = useState<{ id: ThemeId; message: string } | null>(null);
  const [satellite, setSatellite] = useState<SatelliteData | null>(null);
  const [satelliteError, setSatelliteError] = useState('');
  const [date, setDate] = useState('');
  const [bottles, setBottles] = useState(false);
  const [substance, setSubstance] = useState('Mercurio totale');
  const [matrix, setMatrix] = useState('acqua');
  const [selection, setSelection] = useState<ObservationFeature[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const definition = THEMES.find(t => t.id === theme)!;
  const meta = theme === 'chlorophyll' ? null : manifest[theme];
  const dataset = survey?.id === theme ? survey.data : null;

  useEffect(() => {
    if (theme === 'chlorophyll') return;
    const controller = new AbortController();
    fetch(`/data/observatory/${theme}.json`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Dati non disponibili. Riprova tra poco.');
      const data: SurveyData = await response.json();
      if (data.type !== 'FeatureCollection' || !Array.isArray(data.features) || !data.metadata?.year) throw new Error('La raccolta non è leggibile.');
      if (!controller.signal.aborted) { setSurvey({ id: theme, data }); setSurveyError(null); }
    }).catch(error => { if (!controller.signal.aborted) setSurveyError({ id: theme, message: error.message }); });
    return () => controller.abort();
  }, [theme, attempt]);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch('/api/osservatorio/satellite', { signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !isSatelliteRecent(data.observedAt)) throw new Error(data.error || 'Nessuna osservazione satellitare recente verificabile.');
        if (!controller.signal.aborted) { setSatellite(data); setSatelliteError(''); }
      } catch (error) {
        if (!controller.signal.aborted) { setSatellite(null); setSatelliteError(error instanceof Error ? error.message : 'Fonte temporaneamente non disponibile.'); }
      }
    };
    void refresh();
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 300000);
    window.addEventListener('focus', refresh);
    return () => { controller.abort(); clearInterval(interval); window.removeEventListener('focus', refresh); };
  }, [attempt]);

  const features = useMemo(() => dataset ? filterObservations(dataset.features, {
    bottles: theme === 'beach' && bottles, substance: theme === 'chemicals' ? substance : '', matrix: theme === 'chemicals' ? matrix : '',
  }) : NO_FEATURES, [dataset, theme, bottles, substance, matrix]);
  const substances = useMemo(() => [...new Set(dataset?.features.map(f => f.properties.substance).filter((s): s is string => !!s))].sort(), [dataset]);
  const satelliteDate = satellite?.dates.includes(date) ? date : satellite?.observedAt;
  const raster = useMemo(() => theme === 'chlorophyll' && satellite && satelliteDate ? { layer: satellite.layer, date: satelliteDate } : null, [theme, satellite, satelliteDate]);
  const selected = selection.find(f => f.id === selectedId) ?? selection[0];
  const error = theme === 'chlorophyll' ? satelliteError : surveyError?.id === theme ? surveyError.message : '';
  const loading = !error && (theme === 'chlorophyll' ? !satellite : !dataset);
  const select = useCallback((items: ObservationFeature[]) => { setSelection(items); setSelectedId(items[0].id); }, []);
  const clearSelection = () => { setSelection([]); setSelectedId(''); };
  const choose = (id: ThemeId) => { setTheme(id); clearSelection(); setSurveyError(null); setMapStatus('loading'); };

  return <>
    <nav aria-label="Temi dell’osservatorio" className="observatory-themes">
      {THEMES.map(item => <button key={item.id} type="button" aria-pressed={theme === item.id} onClick={() => choose(item.id)}>{item.label}</button>)}
    </nav>

    <section aria-label={definition.label} className="observatory-workspace">
      <div className="observatory-map-column">
        <div className="observatory-map-heading">
          <div><p className="text-sm text-sky-100/60">{definition.subtitle}</p><h2 className="mt-1 text-2xl text-white">{definition.label}</h2></div>
          <div className="text-right text-sm"><span className="block text-sky-100/60">{theme === 'chlorophyll' ? 'Osservazione satellitare' : 'Campagna disponibile'}</span>
            <strong className="font-medium text-white">{theme === 'chlorophyll' ? satelliteDate ? displayDate(satelliteDate) : 'Data in verifica' : meta?.year}</strong></div>
        </div>
        <div className="observatory-map-stage">
          <Map key={attempt} features={features} satellite={raster} onSelect={select} onStatus={setMapStatus} resetKey={resetKey}/>
          <button type="button" className="observatory-map-reset" aria-label="Inquadra il Mediterraneo" title="Inquadra il Mediterraneo" onClick={() => setResetKey(k => k + 1)}><LocateFixed size={20}/></button>
          {(loading || error || mapStatus === 'error') && <div className="observatory-map-message" role="status">
            {loading ? 'Caricamento delle osservazioni…' : error || 'Alcuni livelli cartografici non sono disponibili. Le schede dei dati restano consultabili.'}
            {!loading && <button type="button" onClick={() => { setSurveyError(null); setSatelliteError(''); setAttempt(n => n + 1); setResetKey(n => n + 1); }} className="mt-3 flex items-center gap-2 underline underline-offset-4"><RefreshCw size={16}/>Riprova</button>}
          </div>}
          {!loading && !error && theme !== 'chlorophyll' && !features.length && <div className="observatory-map-message" role="status">Nessuna osservazione per questi filtri nell’ultima campagna disponibile.</div>}
        </div>
        <div className="observatory-map-caption">
          <span>{theme === 'chlorophyll' ? 'Clorofilla · mg/m³ · risoluzione ~1 km' : `${features.length} osservazioni visualizzate · seleziona un punto`}</span>
          <a href={definition.url} target="_blank" rel="noreferrer">{definition.source}</a>
        </div>
      </div>

      <aside className="observatory-detail" aria-label="Dati e dettagli">
        <div className="observatory-filters">
          {theme === 'chlorophyll' && satellite && <label>Data dell’osservazione<select value={satelliteDate} onChange={e => setDate(e.target.value)}>{satellite.dates.map(d => <option key={d} value={d}>{displayDate(d)}{d === satellite.observedAt ? ' · ultima disponibile' : ''}</option>)}</select></label>}
          {theme === 'beach' && <label>Tipologia<select value={bottles ? 'bottles' : 'all'} onChange={e => { setBottles(e.target.value === 'bottles'); clearSelection(); }}><option value="all">Tutti i rifiuti censiti</option><option value="bottles">Bottiglie · categorie specifiche</option></select></label>}
          {theme === 'chemicals' && <><label>Sostanza<select value={substance} onChange={e => { setSubstance(e.target.value); clearSelection(); }}>{substances.map(s => <option key={s}>{s}</option>)}</select></label>
            <label>Matrice<select value={matrix} onChange={e => { setMatrix(e.target.value); clearSelection(); }}><option value="acqua">Acqua</option><option value="sedimento">Sedimento</option><option value="organismi">Organismi</option></select></label></>}
        </div>
        {selected ? <div className="observatory-selection" aria-live="polite">
          <div className="flex items-start justify-between gap-3"><h3 className="text-xl text-white">{selected.properties.title}</h3><button type="button" onClick={clearSelection} aria-label="Chiudi dettagli" className="p-2"><X size={20}/></button></div>
          {selection.length > 1 && <label className="mt-3 block text-sm">{selection.length} osservazioni in questo punto<select value={selected.id} onChange={e => setSelectedId(e.target.value)}>{selection.map((f, i) => <option key={f.id} value={f.id}>{displayDate(f.properties.observedAt)} · {f.properties.measurements[0]?.name ?? f.properties.title} · {i + 1}</option>)}</select></label>}
          <p className="mt-3 text-sm text-[var(--color-aqua)]">{displayDate(selected.properties.observedAt)} · {selected.properties.method}</p>
          <p className="mt-3 text-sm text-sky-100/70">{selected.properties.details}</p>
          <div className="observatory-measurements">{selected.properties.measurements.filter(m => !bottles || theme !== 'beach' || m.name.startsWith('Bottiglie')).map((m, i) => <div key={i}>
            <p className="text-sm text-sky-100/80">{m.name}</p><p className="mt-1 text-xl text-white">{m.qualifier}{numberFormat.format(m.value)} <span className="text-sm text-sky-100/60">{m.unit}</span></p>
            {m.definition && <details className="mt-2 text-xs text-sky-100/60"><summary>Definizione della misura</summary><p className="mt-2">{m.definition}</p></details>}
          </div>)}</div>
          <p className="mt-4 text-xs text-sky-100/60">{selected.properties.originator}</p>
          <a className="mt-3 inline-block text-sm underline underline-offset-4" href={selected.properties.sourceUrl} target="_blank" rel="noreferrer">Consulta la raccolta originale</a>
        </div> : <div className="observatory-explanation">
          <h3 className="text-lg text-white">Cosa mostra la mappa</h3><p className="mt-3 text-sm leading-6 text-sky-100/75">{definition.description}</p>
          {theme === 'chlorophyll' && satellite && <div className="mt-5"><p className="mb-2 text-sm text-sky-100/70">Scala logaritmica · mg/m³</p>
            {/* Provider-generated legend uses exactly the same style as the map. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="observatory-legend" alt="Scala della clorofilla da 0,03 a 10 mg per metro cubo" src={`https://wmts.marine.copernicus.eu/teroWmts?SERVICE=WMTS&REQUEST=GetLegend&LAYER=${encodeURIComponent(satellite.layer)}&STYLE=${encodeURIComponent(SATELLITE_STYLE)}&FORMAT=image/svg%2Bxml`}/>
            <p className="mt-2 text-xs text-sky-100/60">I valori oltre gli estremi usano il colore limite.</p></div>}
          {theme !== 'chlorophyll' && <p className="mt-5 flex items-center gap-2 text-sm text-sky-100/75"><span className="h-3 w-3 shrink-0 rounded-full border border-white bg-[#087d8b]"/>Punto di osservazione · colore senza soglie di rischio</p>}
        </div>}
        <div className="observatory-note"><Info size={17} className="shrink-0 mt-1"/><p>{definition.note}</p></div>
      </aside>
    </section>

    {dataset && <details className="observatory-data-list"><summary>Esplora le osservazioni anche senza mappa ({features.length})</summary>
      <div className="observatory-table-scroll"><table><thead><tr><th>Luogo / stazione</th><th>Data</th><th>Misura</th><th>Valore</th><th>Dettagli</th></tr></thead><tbody>{features.map(f => {
        const measurement = theme === 'beach' && bottles ? f.properties.measurements.find(m => m.name.startsWith('Bottiglie')) : f.properties.measurements[0];
        return <tr key={f.id}><td>{f.properties.title}</td><td>{displayDate(f.properties.observedAt)}</td><td>{measurement?.name ?? 'Infrastruttura censita'}</td>
          <td>{measurement ? `${measurement.qualifier ?? ''}${numberFormat.format(measurement.value)} ${measurement.unit}` : '—'}</td>
          <td><button type="button" onClick={() => { select([f]); document.querySelector('.observatory-detail')?.scrollIntoView({ block: 'start', behavior: 'instant' }); }}>Apri<span className="sr-only"> {f.properties.title} del {displayDate(f.properties.observedAt)}</span></button></td></tr>;
      })}</tbody></table></div>
    </details>}

    <div className="observatory-provenance">
      <div><h3 className="text-base text-white">La data fa parte del dato</h3><p className="mt-2 text-sm text-sky-100/65">{meta ? `${meta.edition}. Osservazioni mostrate: ${displayDate(meta.observedFrom)}${meta.observedFrom === meta.observedTo ? '' : ` – ${displayDate(meta.observedTo)}`}. Raccolta verificata il ${displayDate(meta.verifiedAt)}.` : 'Il servizio verifica l’ultima data pubblicata da Copernicus. Sono visualizzabili soltanto osservazioni degli ultimi 7 giorni.'}</p></div>
      <p className="text-sm text-sky-100/65">Le aree senza osservazioni non indicano assenza di inquinamento. La copertura dipende dalle campagne e dalle condizioni di acquisizione.</p>
    </div>
    <details className="observatory-sources"><summary>Fonti, attribuzioni e copertura</summary><div className="grid gap-5 pt-5 md:grid-cols-2">
      <p>Campionamenti: EMODnet Chemistry, OGS e istituti originatori indicati nelle schede. Raccolte unrestricted 2026, CC BY 4.0. Data and metadata are provided by EMODnet Chemistry under the support of DG MARE, CINEA/2024/OP/0006. Selezione dell’ultimo anno regionale, senza ricostruire superfici stimate.</p>
      <p>Clorofilla: Copernicus Marine Service, prodotto OCEANCOLOUR_MED_BGC_L3_NRT_009_141. Scarichi: EEA Waterbase UWWTD, edizione pubblica 2026, periodo 2022–2023. I dati EEA sono limitati all’area di studio costiera mediterranea e ai paesi presenti nella raccolta.</p>
      <p>Rifiuti galleggianti: l’archivio satellitare 2015–2021 è escluso da questa vista aggiornata. Non è disponibile qui un flusso validato di nuove rilevazioni.</p>
      <p>Petrolio: nessun livello operativo è pubblicato. Il servizio EMSA CleanSeaNet ha accesso riservato; una rilevazione SAR richiede validazione.</p>
    </div></details>
  </>;
}
