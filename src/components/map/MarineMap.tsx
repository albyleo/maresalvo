"use client";
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Search, Layers, X, ArrowLeft } from 'lucide-react';
import type { MarineProtectedArea, GhostNetReport, AisVesselPoint } from '@/types';
import { DEFAULT_LAYERS, type LayerToggles } from '@/features/marine-map/config';
import { ZONE_STYLES } from '@/features/marine-map/zones';
import { MapInteractionGate } from './MapInteractionGate';

const MapContainer = dynamic(() => import('./MarineMapCanvas').then(m => m.MarineMapCanvas), {
  ssr:false, loading:()=> <div className="h-full grid place-items-center bg-[#071e23] text-white/50">Caricamento mappa…</div>,
});
const LAYER_LABELS: Record<keyof LayerToggles,string> = {
  satellite:'Satellite (Esri)', bathymetry:'Profondità (batimetria)', seamarks:'Simbologia nautica',
  mpaOfficial:'AMP ufficiali (WMS)', ghostNets:'Reti perse a mare', ais:'Imbarcazioni (AIS)',
};
const SOURCE_LABELS: Record<string,string> = {'satellite':'Satellite','bathymetry':'Batimetria','seamarks':'Simbologia nautica','mpa-wms':'AMP WMS','amp-geometry':'Perimetri e zone'};

export function MarineMap({areas,ghostNets=[],aisVessels=[],fullScreen=false}: {
  areas:MarineProtectedArea[]; ghostNets?:GhostNetReport[]; aisVessels?:AisVesselPoint[]; fullScreen?:boolean;
}) {
  const [selectedArea,setSelectedArea]=useState<MarineProtectedArea|null>(null);
  const [selectedZoneId,setSelectedZoneId]=useState<string>();
  const [search,setSearch]=useState('');
  const [region,setRegion]=useState('');
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [layersOpen,setLayersOpen]=useState(false);
  const [layers,setLayers]=useState<LayerToggles>(DEFAULT_LAYERS);
  const [errors,setErrors]=useState<string[]>([]);
  const filtered=areas.filter(a=>(!region || a.region_name===region) && `${a.name} ${a.region_name}`.toLowerCase().includes(search.trim().toLowerCase()));
  const selectArea=(area:MarineProtectedArea,zoneId?:string)=>{setSelectedArea(area);setSelectedZoneId(zoneId);setSidebarOpen(true);setLayersOpen(false);};
  const selectedZone=selectedArea?.zones?.find(z=>z.id===selectedZoneId);

  return <MapInteractionGate className={`marine-map-shell relative overflow-hidden border border-white/10 rounded-2xl ${fullScreen?'marine-map-expanded':''}`}>
    <div className="absolute inset-0"><MapContainer areas={filtered} ghostNets={ghostNets} aisVessels={aisVessels} layers={layers}
      selectedArea={selectedArea} selectedZoneId={selectedZoneId} onSelectArea={selectArea}
      onLayerError={source=>{if(SOURCE_LABELS[source]) setErrors(previous=>previous.includes(source)?previous:[...previous,source]);}} /></div>
    <button type="button" aria-expanded={sidebarOpen} aria-controls="marine-area-panel" onClick={()=>{setSidebarOpen(!sidebarOpen);setLayersOpen(false);}}
      className="absolute top-4 left-4 z-20 rounded-xl bg-[#071e23]/95 border border-white/20 px-4 py-3 text-sm flex items-center gap-2"><Search size={16}/>Aree ({areas.length})</button>
    {sidebarOpen && <aside id="marine-area-panel" aria-label="Aree marine protette" className="marine-area-panel absolute z-30 left-3 top-3 bottom-12 rounded-xl border border-white/20 bg-[#071e23]/95 backdrop-blur-xl flex flex-col overflow-hidden">
      <div className="p-4 border-b border-white/10 flex justify-between items-center gap-3">
        {selectedArea ? <button type="button" onClick={()=>{setSelectedArea(null);setSelectedZoneId(undefined);}} className="text-sm flex gap-2 items-center"><ArrowLeft size={16}/>Tutte le aree</button>:<h3 className="font-medium">Esplora le AMP</h3>}
        <button type="button" aria-label="Chiudi pannello aree" onClick={()=>setSidebarOpen(false)} className="p-2"><X size={18}/></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {selectedArea ? <div className="space-y-5">
          <div><p className="text-xs text-white/50 mb-2">{selectedArea.region_name} · {selectedArea.area_km2?.toLocaleString('it-IT')} km²</p><h3 className="text-2xl tracking-tight">{selectedArea.name}</h3></div>
          <p className="text-sm leading-relaxed text-white/70">{selectedArea.description}</p>
          {!!selectedArea.zones?.length ? <div><h4 className="text-sm font-medium mb-3">Zone di tutela</h4><div className="space-y-2">{selectedArea.zones.map(zone=><button type="button" key={zone.id} onClick={()=>setSelectedZoneId(zone.id)} aria-pressed={selectedZoneId===zone.id}
            className={`w-full text-left rounded-lg border p-3 ${selectedZoneId===zone.id?'border-white/70 bg-white/10':'border-white/10'}`}>
            <span className="font-semibold text-sm" style={{color:ZONE_STYLES[zone.zone]?.color}}>Zona {zone.zone} · {ZONE_STYLES[zone.zone]?.title}</span><span className="block text-xs text-white/60 mt-1">{zone.name}</span>
          </button>)}</div></div>:<p className="text-sm text-sky-200 border border-sky-200/20 rounded-lg p-3">Perimetro disponibile. La suddivisione interna non è ancora disponibile nel catalogo: non dedurre le zone dal colore azzurro.</p>}
          {selectedZone && <div className="space-y-3 rounded-xl bg-white/5 p-4"><h4 className="font-medium">Zona {selectedZone.zone}</h4>
            <p className="text-sm text-white/80">{ZONE_STYLES[selectedZone.zone]?.description}</p>
            {selectedArea.id==='EUAP0950' && <p className="text-sm text-white/70">{selectedZone.zone==='A'?'Il decreto istitutivo vieta la pesca e la navigazione ordinaria.':'Il decreto distingue le attività consentite e vieta pesca subacquea e ancoraggio. Per pesca, navigazione e immersioni consultare anche regolamento e autorizzazioni vigenti.'}</p>}
            <p className="text-xs text-white/50">{selectedZone.notes}</p>
            <a className="text-xs text-[#7dd3fc] underline" href={selectedZone.source_url} target="_blank" rel="noopener noreferrer">{selectedZone.source_label} ↗</a>
          </div>}
          <p className="text-xs text-white/60">{selectedArea.fishing_notes}</p>
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
    <div className="absolute right-3 top-36 z-20">
      <button type="button" aria-expanded={layersOpen} onClick={()=>{setLayersOpen(!layersOpen);setSidebarOpen(false);}} className="flex items-center gap-2 p-3 rounded-xl bg-[#071e23]/95 border border-white/20 text-sm"><Layers size={16}/>Layer</button>
      {layersOpen && <div className="absolute right-0 mt-2 w-64 p-4 rounded-xl bg-[#071e23]/95 border border-white/20 space-y-4">{Object.entries(LAYER_LABELS).map(([key,label])=><label key={key} className="flex gap-3 text-sm items-center cursor-pointer"><input type="checkbox" checked={layers[key as keyof LayerToggles]} onChange={()=>setLayers(l=>({...l,[key]:!l[key as keyof LayerToggles]}))} className="accent-teal-400"/>{label}</label>)}<p className="text-xs text-white/50">AMP: perimetri internazionali WMS e zonazioni locali. AIS e reti di esempio restano dimostrativi.</p></div>}
    </div>
    {!sidebarOpen && <div className="absolute left-3 bottom-12 z-10 max-w-[calc(100%-24px)] rounded-xl bg-[#071e23]/95 border border-white/15 px-4 py-3 text-xs">
      <div className="flex flex-wrap gap-x-4 gap-y-2"><span className="text-sky-300">━ Perimetro AMP</span>{['A','B','C'].map(code=><span key={code} style={{color:ZONE_STYLES[code].color}}>● {code} · {ZONE_STYLES[code].title}</span>)}</div>
      <p className="text-white/50 mt-2">Tocca i poligoni per i dettagli. Zonazioni disponibili per {areas.filter(a=>a.zones?.length).length} AMP italiane.</p>
      {!!errors.length && <p role="status" className="text-amber-200 mt-2">Alcune tessere non sono state caricate: {errors.map(e=>SOURCE_LABELS[e]).join(', ')}.</p>}
    </div>}
  </MapInteractionGate>;
}
