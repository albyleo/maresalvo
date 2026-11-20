'use client';
import { useEffect, useState } from 'react';
import { ArrowUp, Waves, Wind, Thermometer, Navigation, RefreshCw, MapPin, Clock3, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Forecast, ForecastHour } from './forecast';
import { WeatherCredits } from './WeatherCredits';
import { WindyMap } from './WindyMap';
import { ForecastTrend } from './ForecastTrend';
import type { Position } from '@/features/ghost-nets/types';

const field='rounded-xl border border-white/15 bg-[#102c33] px-3 py-3 text-sm text-white min-w-0 focus:outline-2 focus:outline-emerald-200';
const number=(n:number|null,unit:string)=>n===null?'Non disponibile':`${n.toLocaleString('it-IT',{maximumFractionDigits:1})} ${unit}`;
const date=(time:number)=>new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(time*1000);
const coords=(point:Position)=>`${point.lat.toFixed(2)}° N · ${Math.abs(point.lng).toFixed(2)}° ${point.lng<0?'O':'E'}`;
function Direction({value,flow=false}:{value:number|null;flow?:boolean}) {
  return value===null?null:<span className="inline-flex items-center gap-1"><ArrowUp aria-hidden size={13} style={{transform:`rotate(${value}deg)`}}/>{flow?'verso':'da'} {Math.round(value)}°</span>;
}
function peak(hours:ForecastHour[],key:'wind'|'wave') {
  const values=hours.map(h=>h[key]).filter((v):v is number=>v!==null);
  return values.length?Math.max(...values):null;
}
export function WeatherDashboard({initial,places}:{initial:Position;places:{id:string;name:string;lat:number;lng:number}[]}) {
  const initialPlace=places.find(p=>Math.abs(p.lat-initial.lat)<.006&&Math.abs(p.lng-initial.lng)<.006);
  const [point,setPoint]=useState(initial),[lat,setLat]=useState(String(initial.lat)),[lng,setLng]=useState(String(initial.lng));
  const [placeId,setPlaceId]=useState(initialPlace?.id??'');
  const [result,setResult]=useState<{key:string;data:Forecast|null;error:string}|null>(null);
  const [selected,setSelected]=useState(0),[retry,setRetry]=useState(0),[inputError,setInputError]=useState('');
  const key=`${point.lat},${point.lng}`;
  const loading=result?.key!==key;
  const data=!loading?result?.data:null;
  const index=data?Math.min(selected,data.hours.length-1):0;
  const hour=data?.hours[index];
  const placeName=places.find(p=>p.id===placeId)?.name??'Punto in mare';
  function choose(p:Position,id='') {
    if(!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||p.lat<30||p.lat>46.5||p.lng< -6||p.lng>37){setInputError('Scegli un punto nel Mediterraneo.');return;}
    const next={lat:Math.round(p.lat*100)/100,lng:Math.round(p.lng*100)/100};
    setPoint(next);setLat(String(next.lat));setLng(String(next.lng));setPlaceId(id);setSelected(0);setInputError('');
  }
  function refresh(){setResult(null);setRetry(n=>n+1);}
  useEffect(()=>{
    const controller=new AbortController();
    const timer=setTimeout(async()=>{
      try {
        const response=await fetch(`/api/weather?lat=${point.lat}&lng=${point.lng}`,{signal:controller.signal});
        const body=await response.json();
        if(!response.ok) throw new Error(body.error||'Previsioni non disponibili.');
        if(!controller.signal.aborted) setResult({key,data:body,error:''});
      }catch(error){if(!controller.signal.aborted)setResult({key,data:null,error:error instanceof Error?error.message:'Connessione non disponibile.'});}
    },400);
    return()=>{clearTimeout(timer);controller.abort();};
  },[point,key,retry]);
  return <div className="space-y-6">
    <section aria-label="Località della previsione" className="border-y border-white/20 py-6">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr] items-end">
        <label className="text-xs text-white/60"><span className="flex items-center gap-2 mb-2"><MapPin size={14}/>Località / area marina</span><select aria-label="Località o area marina" className={`${field} w-full`} value={placeId} onChange={e=>{const p=places.find(p=>p.id===e.target.value);if(p)choose(p,p.id);}}><option value="">Coordinate personalizzate</option>{places.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <form onSubmit={e=>{e.preventDefault();if(!lat.trim()||!lng.trim()){setInputError('Inserisci entrambe le coordinate.');return;}choose({lat:Number(lat),lng:Number(lng)});}} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto] items-end gap-3">
          <label className="text-xs text-white/60">Latitudine<input className={`${field} mt-2 w-full`} type="number" step="any" min="30" max="46.5" required value={lat} onChange={e=>setLat(e.target.value)}/></label>
          <label className="text-xs text-white/60">Longitudine<input className={`${field} mt-2 w-full`} type="number" step="any" min="-6" max="37" required value={lng} onChange={e=>setLng(e.target.value)}/></label>
          <button className="col-span-2 sm:col-span-1 rounded-xl bg-emerald-200 text-slate-950 text-sm font-semibold px-5 py-3">Aggiorna punto</button>
        </form>
      </div>
      {inputError&&<p role="alert" className="text-sm text-amber-200 mt-3">{inputError}</p>}
      <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs text-white/50"><span className="text-emerald-100">{placeName} <span className="text-white/40 mx-1">/</span> {coords(point)}</span><span>Vento e correnti: nodi · onde: metri · temperatura: °C</span></div>
    </section>
    <WindyMap point={point}/>
    <section aria-label="Bollettino MareSalvo" aria-busy={loading} className="editorial-section mt-12! space-y-7">
      <div className="flex flex-wrap justify-between gap-4 items-start">
        <div><p className="text-[10px] uppercase tracking-[.2em] text-emerald-200 mb-2">Previsione puntuale · Open-Meteo</p><h2 className="text-2xl sm:text-3xl text-white tracking-tight">Bollettino marino</h2><p className="text-sm text-white/50 mt-2">{placeName} · {coords(point)}</p></div>
        <div className="flex items-center gap-3"><span className="inline-flex items-center gap-2 border-l border-white/20 pl-4 py-2 text-xs text-white/60"><Clock3 size={13}/>72 ore · ora italiana</span><button disabled={loading} aria-label="Aggiorna previsioni" className="rounded-lg border border-white/15 p-2.5 text-white/60 hover:text-white disabled:opacity-40" onClick={refresh}><RefreshCw size={16} className={loading?'animate-spin':''}/></button></div>
      </div>
      <p className="text-xs text-white/55 leading-relaxed border-l-2 border-sky-300/60 pl-3">La mappa è fornita da Windy; questo bollettino usa Open-Meteo con modelli ECMWF e Copernicus/Météo-France. Unità coerenti, ma celle, aggiornamenti e modelli possono differire. Gli orari dei due strumenti sono indipendenti.</p>
      {loading?<div role="status" className="py-12 text-center text-emerald-200 text-sm animate-pulse">Caricamento del bollettino per il punto selezionato…</div>:!data||!hour?<div className="rounded-xl bg-amber-200/5 border border-amber-200/20 p-6"><p role="alert" className="text-amber-200">{result?.error||'Nessun dato disponibile.'}</p><button className="mt-4 text-sm underline text-white" onClick={refresh}>Riprova</button></div>:<>
        {!!data.unavailable.length&&<p role="status" className="text-sm text-amber-200">Dati parziali: {data.unavailable.join('; ')} temporaneamente non disponibili.</p>}
        <div className="grid sm:grid-cols-3 gap-3">{[0,24,48].filter(start=>start<data.hours.length).map(start=>{
          const block=data.hours.slice(start,start+24);
          return <button type="button" key={start} onClick={()=>setSelected(start)} aria-pressed={index>=start&&index<start+24} className={`text-left border-b-2 py-5 px-3 transition-colors ${index>=start&&index<start+24?'border-emerald-200/50 bg-emerald-200/[.07]':'border-white/15 hover:bg-white/[.025]'}`}><span className="block text-xs text-white/50 mb-2">Da {date(block[0].time)} · {block.length} h</span><span className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/85"><span>Vento max <strong className="font-medium text-emerald-200">{number(peak(block,'wind'),'kn')}</strong></span><span>Onde max <strong className="font-medium text-sky-200">{number(peak(block,'wave'),'m')}</strong></span></span></button>;
        })}</div>
        <div className="border-b border-white/15 pb-6">
          <div className="flex justify-between items-center gap-3"><div><p className="text-[10px] uppercase tracking-widest text-white/45">Previsione valida per</p><h3 aria-live="polite" className="text-lg sm:text-xl text-white mt-1">{date(hour.time)}</h3></div><div className="flex gap-2"><button type="button" aria-label="Ora precedente" disabled={index===0} onClick={()=>setSelected(index-1)} className="border border-white/15 rounded-lg p-2 text-white disabled:opacity-25"><ChevronLeft size={16}/></button><button type="button" aria-label="Ora successiva" disabled={index===data.hours.length-1} onClick={()=>setSelected(index+1)} className="border border-white/15 rounded-lg p-2 text-white disabled:opacity-25"><ChevronRight size={16}/></button></div></div>
          <input aria-label="Ora del bollettino MareSalvo" aria-valuetext={date(hour.time)} className="block w-full mt-5 accent-emerald-300" type="range" min="0" max={data.hours.length-1} value={index} onChange={e=>setSelected(Number(e.target.value))}/>
          <div className="flex justify-between text-[10px] text-white/40 mt-2"><span>{date(data.hours[0].time)}</span><span>{date(data.hours.at(-1)!.time)}</span></div>
        </div>
        <div className="weather-metrics">
          <Metric icon={<Wind size={20}/>} title="Vento a 10 m" source="ECMWF IFS · Open-Meteo" value={number(hour.wind,'kn')} detail={<><Direction value={hour.windDirection}/><span>Raffiche {number(hour.gust,'kn')}</span></>}/>
          <Metric icon={<Waves size={20}/>} title="Altezza significativa onde" source="Météo-France MFWAM" value={number(hour.wave,'m')} detail={<><Direction value={hour.waveDirection}/><span>Periodo {number(hour.period,'s')}</span></>}/>
          <Metric icon={<Navigation size={20}/>} title="Corrente superficiale" source="Copernicus via Météo-France" value={number(hour.current,'kn')} detail={<Direction value={hour.currentDirection} flow/>}/>
          <Metric icon={<Thermometer size={20}/>} title="Temperatura del mare" source="Copernicus via Météo-France" value={number(hour.seaTemperature,'°C')} detail={<><span>Aria {number(hour.airTemperature,'°C')}</span><span>Pioggia {number(hour.rain,'mm')}</span></>}/>
        </div>
        <p className="text-xs text-white/45">Direzioni: onde e vento indicano la provenienza, correnti la destinazione. kn e kt indicano entrambi i nodi. Le onde singole possono superare l’altezza significativa.</p>
        <ForecastTrend hours={data.hours} selected={index}/>
        <details className="border-y border-white/15"><summary className="cursor-pointer px-4 py-4 text-sm text-white/80">Tabella previsioni · intervalli di 3 ore</summary><div tabIndex={0} role="region" aria-label="Tabella oraria scorrevole" className="overflow-x-auto px-2 pb-4 focus-visible:outline-2 focus-visible:outline-emerald-200"><table className="w-full text-sm whitespace-nowrap"><caption className="sr-only">Previsioni Open-Meteo per {placeName}. Seleziona un orario per aggiornare il bollettino.</caption><thead><tr className="text-white/45">{['Ora italiana','Vento · kn','Raffiche · kn','Onde · m','Periodo · s','Corrente · kn','Mare · °C','Pioggia · mm'].map(label=><th key={label} scope="col" className="text-left p-3 font-normal">{label}</th>)}</tr></thead><tbody>{data.hours.map((h,i)=>i%3===0?<tr key={h.time} className={`border-t border-white/10 text-white/80 ${index===i?'bg-emerald-200/10':''}`}><th scope="row" className="p-3 text-left font-normal"><button type="button" className="underline decoration-white/20 underline-offset-4 hover:text-emerald-200" onClick={()=>setSelected(i)}>{date(h.time)}</button></th>{(['wind','gust','wave','period','current','seaTemperature','rain'] as (keyof ForecastHour)[]).map(k=><td key={k} className="p-3 tabular-nums">{h[k]===null?'—':h[k]?.toLocaleString('it-IT',{maximumFractionDigits:1})}</td>)}</tr>:null)}</tbody></table></div></details>
        <details className="text-xs text-white/50"><summary className="cursor-pointer">Modelli, celle e aggiornamento dei dati</summary><p className="mt-3">Consultazione: {new Date(data.consultedAt).toLocaleString('it-IT',{timeZone:'Europe/Rome'})}. Cache dei fornitori rivalidata ogni 30 minuti; non è l’orario di emissione dei modelli.</p><ul className="mt-2 space-y-1">{data.grids.map(g=><li key={g.source}>{g.source}: {g.latitude.toFixed(3)}, {g.longitude.toFixed(3)}</li>)}</ul></details>
      </>}
    </section>
    <WeatherCredits/>
  </div>;
}
function Metric({icon,title,source,value,detail}:{icon:React.ReactNode;title:string;source:string;value:string;detail:React.ReactNode}) {
  return <div className="weather-metric flex flex-col"><div className="text-emerald-200 mb-4">{icon}</div><h3 className="text-xs text-white/60 min-h-8">{title}</h3><p className="text-3xl sm:text-4xl font-normal tracking-tight text-white mt-2 break-words tabular-nums">{value}</p><div className="flex flex-col gap-2 text-xs text-white/55 mt-3 min-h-10">{detail}</div><p className="text-[10px] text-white/35 mt-4 pt-3 border-t border-white/10">{source}</p></div>;
}
