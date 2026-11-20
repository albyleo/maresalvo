"use client";
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Search, Layers, X, ArrowLeft, ChevronDown } from 'lucide-react';
import type { MarineProtectedArea, GhostNetReport, AisVesselPoint } from '@/types';
import { DEFAULT_LAYERS, type LayerToggles } from '@/features/marine-map/config';
import { ZONE_STYLES } from '@/features/marine-map/zones';
import { MapInteractionGate } from './MapInteractionGate';
import Link from 'next/link';
import { AreaGuidance } from '@/features/marine-map/AreaGuidance';
import sourceManifest from '../../../public/data/marine-sources.json';

const MapContainer = dynamic(() => import('./MarineMapCanvas').then(m => m.MarineMapCanvas), {
  ssr:false, loading:()=> <div className="h-full grid place-items-center bg-[#071e23] text-white/50">Caricamento mappa…</div>,
});
const LAYER_LABELS: Record<keyof LayerToggles,string> = {
  satellite:'Satellite (Esri)', bathymetry:'Profondità (batimetria)', seamarks:'Simbologia nautica',
  mpaOfficial:'AMP ufficiali (WMS)', ghostNets:'Reti perse a mare', ais:'Imbarcazioni (AIS)',
};
const SOURCE_LABELS: Record<string,string> = {'satellite':'Satellite','bathymetry':'Batimetria','seamarks':'Simbologia nautica','mpa-wms':'AMP WMS','amp-geometry':'Perimetri e zone'};

export function MarineMap({areas,ghostNets=[],aisVessels=[],fullScreen=false,activationRequired=false}: {
  areas:MarineProtectedArea[]; ghostNets?:GhostNetReport[]; aisVessels?:AisVesselPoint[]; fullScreen?:boolean; activationRequired?:boolean;
}) {
  const [selectedArea,setSelectedArea]=useState<MarineProtectedArea|null>(null);
  const [selectedZoneId,setSelectedZoneId]=useState<string>();
  const [search,setSearch]=useState('');
  const [region,setRegion]=useState('');
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [layersOpen,setLayersOpen]=useState(false);
  const [layers,setLayers]=useState<LayerToggles>(DEFAULT_LAYERS);
  const [errors,setErrors]=useState<string[]>([]);
  const areasButton = useRef<HTMLButtonElement>(null);
  const layersButton = useRef<HTMLButtonElement>(null);
  const panelClose = useRef<HTMLButtonElement>(null);
  const layout = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sidebarOpen && !layersOpen) return;
    panelClose.current?.focus({preventScroll:true});
    const shell = layout.current?.closest<HTMLElement>('.marine-map-shell');
    if (!shell || document.fullscreenElement) return;
    const align = () => {
      const bounds = shell.getBoundingClientRect();
      const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 80;
      if (bounds.top < headerBottom + 8 || bounds.bottom > window.innerHeight - 8) {
        shell.scrollIntoView({block:'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
      }
    };
    align();
    let width = shell.clientWidth;
    const resize = new ResizeObserver(() => {
      if (shell.clientWidth !== width) { width = shell.clientWidth; align(); }
    });
    resize.observe(shell);
    return () => resize.disconnect();
  }, [sidebarOpen, layersOpen, selectedArea?.id]);
  const closePanel = () => {
    const trigger = layersOpen ? layersButton : areasButton;
    setSidebarOpen(false); setLayersOpen(false);
    requestAnimationFrame(() => trigger.current?.focus({preventScroll:true}));
  };
  const filtered=areas.filter(a=>(!region || a.region_name===region) && `${a.name} ${a.region_name}`.toLowerCase().includes(search.trim().toLowerCase()));
  const selectArea=(area:MarineProtectedArea,zoneId?:string)=>{setSelectedArea(area);setSelectedZoneId(zoneId);setSidebarOpen(true);setLayersOpen(false);};
  const selectedZone=selectedArea?.zones?.find(z=>z.id===selectedZoneId);

  return <MapInteractionGate enabled={activationRequired} className={`marine-map-shell relative overflow-hidden border-y border-white/15 ${fullScreen?'marine-map-expanded':''}`}>
    <div ref={layout} className="marine-map-layout" data-panel-open={sidebarOpen || layersOpen}
      onKeyDown={event => { if (event.key === 'Escape' && (sidebarOpen || layersOpen)) { event.stopPropagation(); closePanel(); } }}>
      <div className="marine-map-stage">
        <div className="absolute inset-0"><MapContainer areas={filtered} ghostNets={ghostNets} aisVessels={aisVessels} layers={layers}
          selectedArea={selectedArea} selectedZoneId={selectedZoneId} onSelectArea={selectArea}
          onLayerError={source=>{if(SOURCE_LABELS[source]) setErrors(previous=>previous.includes(source)?previous:[...previous,source]);}} /></div>
        <div className="marine-map-tools absolute top-3 left-3 z-20 flex gap-2">
          <button ref={areasButton} type="button" aria-expanded={sidebarOpen} aria-controls="marine-area-panel" onClick={()=>{setSidebarOpen(!sidebarOpen);setLayersOpen(false);}}
            className="marine-tool-button"><Search size={16}/>Aree ({areas.length})</button>
          <button ref={layersButton} type="button" aria-expanded={layersOpen} aria-controls="marine-layers-panel" onClick={()=>{setLayersOpen(!layersOpen);setSidebarOpen(false);}}
            className="marine-tool-button"><Layers size={16}/>Layer</button>
        </div>
    {!sidebarOpen && !layersOpen && <div className="marine-map-legend absolute left-3 z-10 max-w-[calc(100%-24px)] bg-[#0b2942]/95 border border-white/15 text-xs">
      <details className="group">
        <summary className="flex items-center justify-between gap-5 min-h-11 px-3 text-white/85 list-none [&::-webkit-details-marker]:hidden">Legenda<ChevronDown size={14} className="transition-transform group-open:rotate-180"/></summary>
        <div className="grid gap-2 px-3 pb-3 border-t border-white/10 pt-3"><span className="text-sky-300">━ Perimetro AMP</span>{['A','B','C'].map(code=><span key={code} style={{color:ZONE_STYLES[code].color}}>● {code} · {ZONE_STYLES[code].title}</span>)}</div>
      </details>
      {!!errors.length && <p role="status" className="text-amber-200 px-3 pb-3 max-w-64">Alcune tessere non sono state caricate: {errors.map(e=>SOURCE_LABELS[e]).join(', ')}.</p>}
    </div>}
      </div>
    {sidebarOpen && <aside id="marine-area-panel" aria-label="Aree marine protette" className="marine-map-panel">
      <div className="marine-panel-header">
        {selectedArea ? <button type="button" onClick={()=>{setSelectedArea(null);setSelectedZoneId(undefined);}} className="text-sm flex gap-2 items-center"><ArrowLeft size={16}/>Tutte le aree</button>:<h3 className="font-medium">Esplora le AMP</h3>}
        <button ref={panelClose} type="button" aria-label="Chiudi pannello aree" onClick={closePanel} className="marine-panel-close"><X size={18}/></button>
      </div>
      <div key={selectedArea?.id ?? 'catalog'} className="marine-panel-body" tabIndex={0} role="region" aria-label="Contenuto aree marine protette">
        {selectedArea ? <div className="space-y-5">
          <div><p className="text-xs text-white/50 mb-2">{selectedArea.region_name} · {selectedArea.area_km2?.toLocaleString('it-IT')} km²</p><h3 className="text-2xl tracking-tight">{selectedArea.name}</h3></div>
          <p className="text-sm leading-relaxed text-white/70">{selectedArea.description}</p>
          {!!selectedArea.zones?.length ? <div><h4 className="text-sm font-medium mb-3">Zone di tutela</h4><div className="space-y-2">{selectedArea.zones.map(zone=><button type="button" key={zone.id} onClick={()=>setSelectedZoneId(zone.id)} aria-pressed={selectedZoneId===zone.id}
            className={`w-full text-left rounded-lg border p-3 ${selectedZoneId===zone.id?'border-white/70 bg-white/10':'border-white/10'}`}>
            <span className="font-semibold text-sm" style={{color:ZONE_STYLES[zone.zone]?.color}}>Zona {zone.zone} · {ZONE_STYLES[zone.zone]?.title}</span><span className="block text-xs text-white/60 mt-1">{zone.name}</span>
          </button>)}</div></div>:<p className="text-sm text-sky-200 border border-sky-200/20 rounded-lg p-3">Perimetro disponibile. La suddivisione interna non è ancora disponibile nel catalogo: non dedurre le zone dal colore azzurro.</p>}
          {selectedZone && <div className="space-y-3 rounded-xl bg-white/5 p-4"><h4 className="font-medium">Zona {selectedZone.zone}</h4>
            <p className="text-xs text-white/50">{selectedZone.notes}</p>
            <a className="text-xs text-[#7dd3fc] underline" href={selectedZone.source_url} target="_blank" rel="noopener noreferrer">{selectedZone.source_label} ↗</a>
          </div>}
          <AreaGuidance areaId={selectedArea.id} zone={selectedZone?.zone}/>
          <Link className="block text-sm text-emerald-200 underline" href={`/aree-marine/${selectedArea.slug}`}>Apri la scheda completa →</Link>
          {selectedArea.centroid&&<Link className="block text-sm text-sky-200 underline" href={`/meteo?lat=${selectedArea.centroid.coordinates[1]}&lng=${selectedArea.centroid.coordinates[0]}`}>Onde, correnti e temperatura in quest’area →</Link>}
          {selectedArea.regulation_url && <a className="block text-sm text-[#7dd3fc] underline" href={selectedArea.regulation_url} target="_blank" rel="noopener noreferrer">Consulta il regolamento ↗</a>}
          <p className="text-xs text-white/45">Perimetro: <a href={selectedArea.source_url} target="_blank" rel="noopener noreferrer" className="underline">{selectedArea.source_label}</a> · versione {selectedArea.source_date}. Le ordinanze possono essere più recenti della cartografia.</p>
        </div>:<>
          <label className="flex items-center gap-2 rounded-lg border border-white/15 p-3 mb-3"><Search size={16}/><input aria-label="Cerca area o regione" placeholder="Cerca area o regione…" value={search} onChange={e=>setSearch(e.target.value)} className="w-full min-w-0 bg-transparent text-sm outline-none"/></label>
          <select aria-label="Filtra per regione" value={region} onChange={e=>setRegion(e.target.value)} className="w-full rounded-lg bg-[#102c33] border border-white/15 p-3 text-sm mb-4"><option value="">Tutte le regioni</option>{[...new Set(areas.map(a=>a.region_name))].sort().map(r=><option key={r} value={r??''}>{r}</option>)}</select>
          <p className="text-xs text-white/50 mb-3">{filtered.length} AMP nel catalogo italiano · tocca un’area</p>
          {filtered.map(area=><button type="button" key={area.id} onClick={()=>selectArea(area)} className="w-full p-3 text-left border-b border-white/10 hover:bg-white/5 rounded-lg"><span className="block text-sm font-medium">{area.name}</span><span className="block mt-1 text-xs text-white/50">{area.region_name} · {area.zones?.length?'Zonazione disponibile':'Perimetro'}</span></button>)}
          {!filtered.length && <p className="text-sm text-white/60 py-5">Nessuna area trovata.</p>}
        </>}
      </div>
    </aside>}
      {layersOpen && <aside id="marine-layers-panel" aria-label="Layer e fonti cartografiche" className="marine-map-panel">
        <div className="marine-panel-header"><h3 className="font-medium">Layer e fonti</h3><button ref={panelClose} type="button" aria-label="Chiudi pannello layer" onClick={closePanel} className="marine-panel-close"><X size={18}/></button></div>
        <div className="marine-panel-body space-y-5" tabIndex={0} role="region" aria-label="Contenuto layer e fonti">{Object.entries(LAYER_LABELS).map(([key,label])=><label key={key} className="flex gap-3 text-sm items-center cursor-pointer"><input type="checkbox" checked={layers[key as keyof LayerToggles]} onChange={()=>setLayers(l=>({...l,[key]:!l[key as keyof LayerToggles]}))} className="accent-teal-400"/>{label}</label>)}<p className="text-xs text-white/50">Reti: solo segnalazioni verificate, in recupero o recuperate. Le posizioni AIS sono dimostrative.</p><details className="text-xs text-white/60"><summary className="cursor-pointer text-sky-200">Fonti e copertura EMODnet</summary><p className="mt-3">Batimetria EMODnet; perimetri europei WMS. Catalogo locale: {areas.length} AMP italiane, zonazione parziale. Importato il {sourceManifest.retrieved_at.slice(0,10).split('-').reverse().join('/')}; l’edizione dei confini è indicata in ogni scheda.</p><a href="/data/marine-sources.json" target="_blank" rel="noopener noreferrer" className="block underline mt-2">Provenienza dei dati cartografici ↗</a><p className="mt-2">I perimetri WMS non descrivono le attività consentite. La batimetria non localizza automaticamente le reti.</p></details></div>
      </aside>}
    </div>
  </MapInteractionGate>;
}
