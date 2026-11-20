import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMarineAreas } from '@/features/marine-map/data';
import { AreaGuidance } from '@/features/marine-map/AreaGuidance';
import { ZONE_STYLES } from '@/features/marine-map/zones';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;
  const area=(await getMarineAreas()).find(a=>a.slug===slug);
  return {title:area?`${area.name} · Zone e attività`:'Area marina'};
}
export default async function AreaPage({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;
  const area=(await getMarineAreas()).find(a=>a.slug===slug);
  if(!area) notFound();
  const zones=[...new Set(area.zones?.map(z=>z.zone)??[])].sort((a,b)=>['A','B','Bs','C','D'].indexOf(a)-['A','B','Bs','C','D'].indexOf(b));
  return <article className="mx-auto max-w-6xl px-4 sm:px-8 pt-28 pb-20 text-white">
    <Link href="/mappa" className="text-sm text-emerald-200">← Esplora la mappa</Link>
    <p className="mt-8 text-xs uppercase tracking-widest text-white/50">{area.region_name} · {area.area_km2?.toLocaleString('it-IT')} km²</p>
    <h1 className="mt-3 text-3xl sm:text-5xl tracking-tight">{area.name}</h1>
    <p className="mt-5 max-w-3xl text-white/65">{area.description}</p>
    <div className="mt-6 flex flex-wrap gap-4">{area.centroid&&<Link href={`/meteo?lat=${area.centroid.coordinates[1]}&lng=${area.centroid.coordinates[0]}`} className="rounded-xl bg-emerald-200 px-5 py-3 text-sm font-medium text-slate-950">Meteo marino nell’area →</Link>}<Link href="/segnala-rete" className="rounded-xl border border-white/20 px-5 py-3 text-sm">Segnala un attrezzo abbandonato →</Link></div>
    <div className="mt-8 border-y border-white/15 py-5 text-xs text-white/55"><p>Perimetro: <a href={area.source_url} target="_blank" rel="noopener noreferrer" className="underline">{area.source_label}</a> · edizione {area.source_date}.</p><p className="mt-2">Cartografia indicativa: la data dei confini è distinta dall’aggiornamento delle regole. Verifica delimitazioni e ordinanze con l’ente gestore.</p></div>
    {zones.length?<><nav aria-label="Zone dell’area" className="my-8 flex flex-wrap gap-3">{zones.map(z=><a key={z} href={`#zona-${z}`} className="rounded-lg border border-white/20 px-4 py-2 text-sm" style={{color:ZONE_STYLES[z]?.color}}>Zona {z}</a>)}</nav><div className="grid gap-6 md:grid-cols-2">{zones.map(z=><section id={`zona-${z}`} key={z} className="scroll-mt-24"><h2 className="text-xl mb-3" style={{color:ZONE_STYLES[z]?.color}}>Zona {z} · {ZONE_STYLES[z]?.title}</h2><AreaGuidance areaId={area.id} zone={z}/><details className="text-xs text-white/50 mt-3"><summary className="cursor-pointer">Fonti della geometria</summary>{area.zones?.filter(zone=>zone.zone===z).map(zone=><p key={zone.id} className="mt-2"><a className="underline" href={zone.source_url} target="_blank" rel="noopener noreferrer">{zone.name} · {zone.source_label}</a> — {zone.notes}</p>)}</details></section>)}</div></>:<div className="mt-8"><p className="mb-4 text-white/60">Zonazione interna non disponibile nel catalogo. Nessuna attività viene dedotta dal solo perimetro.</p><AreaGuidance areaId={area.id}/></div>}
  </article>;
}
