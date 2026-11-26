import type { ForecastHour } from './forecast';
export function ForecastTrend({hours,selected,marine=true}:{hours:ForecastHour[];selected:number;marine?:boolean}) {
  return <div className={`grid gap-4 ${marine?'lg:grid-cols-2':''}`}>{([{key:'wind',label:'Vento a 10 m',unit:'kn',color:'#a7f3d0'},{key:'wave',label:'Altezza significativa onde',unit:'m',color:'#7dd3fc'}] as const).filter(metric=>marine||metric.key==='wind').map(metric=>{
    const values=hours.map(h=>h[metric.key]);
    const finite=values.filter((v):v is number=>v!==null);
    const max=Math.max(metric.key==='wave'?1:5,...finite)*1.15;
    const x=(i:number)=>38+i*510/Math.max(1,hours.length-1),y=(v:number)=>112-v/max*90;
    const path=values.map((v,i)=>v===null?'':`${i===0||values[i-1]===null?'M':'L'}${x(i)},${y(v)}`).join(' ');
    const selectedValue=values[selected];
    return <figure key={metric.key} className="border-t border-white/20 py-5 min-w-0"><figcaption className="flex justify-between text-xs text-white/60"><span>{metric.label}</span><span>{metric.unit} · 72 ore</span></figcaption>{finite.length?<svg viewBox="0 0 560 145" className="w-full mt-3" role="img" aria-label={`${metric.label}: andamento nelle prossime 72 ore; valori esatti nella tabella oraria`}>
      {[0,0.5,1].map(r=><g key={r}><line x1="38" x2="548" y1={y(max*r)} y2={y(max*r)} stroke="white" strokeOpacity=".1"/><text x="2" y={y(max*r)+3} fill="#94a3b8" fontSize="10">{(max*r).toLocaleString('it-IT',{maximumFractionDigits:1})}</text></g>)}
      <path d={path} fill="none" stroke={metric.color} strokeWidth="2.5" strokeLinejoin="round"/>
      <line x1={x(selected)} x2={x(selected)} y1="12" y2="115" stroke="white" strokeOpacity=".4" strokeDasharray="3 4"/>
      {selectedValue!==null&&selectedValue!==undefined&&<circle cx={x(selected)} cy={y(selectedValue)} r="4" fill={metric.color} stroke="#0b242e" strokeWidth="2"/>}
      {[0,24,48,71].filter(i=>i<hours.length).map(i=><text key={i} x={x(i)} y="138" textAnchor={i===0?'start':i===71?'end':'middle'} fill="#94a3b8" fontSize="10">+{i} h</text>)}
    </svg>:<p className="py-12 text-sm text-white/45">Dati non disponibili per questo punto.</p>}</figure>;
  })}</div>;
}
