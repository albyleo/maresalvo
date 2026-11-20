import { ACTIVITIES, GUIDANCE, areaRule, type Activity } from './guidance';
export function AreaGuidance({areaId,zone}:{areaId:string;zone?:string}) {
  const guide=GUIDANCE[areaId];
  return <section className="border-t border-white/20 py-5 space-y-4" aria-label="Attività e fonti ufficiali">
    <div><h4 className="font-medium">Attività {zone?`in zona ${zone}`:'e fonti'}</h4><p className="mt-2 text-xs text-white/60">{guide?.manager??'Ente gestore e regole locali da verificare.'}</p></div>
    {guide?.note&&<p className="text-xs leading-relaxed text-amber-100/80">{guide.note}</p>}
    {zone?<dl className="space-y-3">{(Object.keys(ACTIVITIES) as Activity[]).map(activity=>{
      const rule=areaRule(areaId,zone,activity);
      const ref=rule&&guide.sources[rule.source];
      return <div key={activity} className="border-t border-white/10 pt-3"><dt className="flex flex-wrap justify-between gap-2 text-sm"><span>{ACTIVITIES[activity]}</span><span className={rule?.status==='Vietato'?'text-rose-300':rule?'text-amber-200':'text-white/45'}>{rule?.status??'Da verificare'}</span></dt><dd className="text-xs text-white/60 mt-1 leading-relaxed">{rule?.note??'Nessuna sintesi validata in questa scheda. Chiedere al gestore.'}{ref&&<a href={ref.url} target="_blank" rel="noopener noreferrer" className="block text-sky-200 underline mt-1">Fonte: {ref.label} ↗</a>}</dd></div>;
    })}</dl>:<p className="text-xs text-white/60">Seleziona una zona per leggere la sintesi delle attività. Le regole cambiano da un’AMP all’altra.</p>}
    {guide&&<details className="text-xs"><summary className="cursor-pointer text-sky-200">Fonti e date di aggiornamento</summary><ul className="mt-3 space-y-3">{guide.sources.map(ref=><li key={ref.url}><a href={ref.url} target="_blank" rel="noopener noreferrer" className="underline">{ref.label} ↗</a><p className="text-white/55 mt-1">Edizione: {ref.edition}. Consultata: {ref.consulted.split('-').reverse().join('/')}.</p></li>)}</ul></details>}
    <p className="text-xs leading-relaxed text-white/45">Sintesi informativa, non autorizzazione. Ordinanze locali e stagionali possono introdurre ulteriori limiti. La data di consultazione non certifica l’assenza di atti successivi.</p>
  </section>;
}
