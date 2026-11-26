import Link from 'next/link';
import { X } from 'lucide-react';
import { InfoDisclosure } from '@/components/ui/InfoDisclosure';
import { AreaGuidance } from '../marine-map/AreaGuidance';
import areas from '../marine-map/official-areas.json';
import sources from '../../../public/data/marine-sources.json';
import { ZONE_STYLES } from '../marine-map/zones';
import type { ProtectedAreaSelection } from './protected-areas';
import { displayDate } from './data';

export function ProtectedAreaDetails({ selection, onClose }: { selection: ProtectedAreaSelection; onClose: () => void }) {
  const area = areas.find(a => a.id === selection.areaId);
  return <section className="mb-6 border-b border-white/20 pb-6" aria-label="Area marina protetta selezionata" aria-live="polite">
    <div className="flex items-start justify-between gap-3">
      <h3 className="text-lg text-sky-100">{area?.name ?? 'Aree protette'}</h3>
      <button type="button" onClick={onClose} aria-label="Chiudi dettagli AMP" className="p-2"><X size={18}/></button>
    </div>
    {selection.message && <p className="mt-3 text-sm text-sky-100/70">{selection.message}</p>}
    {area && <>
      <p className="mt-2 text-sm text-sky-100">{selection.zone ? `Zona ${selection.zone} · ${ZONE_STYLES[selection.zone]?.title ?? 'Regime specifico'}` : 'Perimetro dell’area protetta'}</p>
      <InfoDisclosure key={`${area.id}-${selection.zone ?? ''}`} label="Info sull’area e sulle attività">
        <p>Cartografia locale acquisita il {displayDate(sources.retrieved_at)}. Le date dei dati ambientali sono indipendenti.</p>
        <AreaGuidance areaId={area.id} zone={selection.zone}/>
      </InfoDisclosure>
      <Link href={`/aree-marine/${area.slug}`} className="mt-3 inline-block text-sm text-sky-200 underline">Apri la scheda AMP →</Link>
    </>}
    {selection.features?.map((feature, index) => <div key={index} className="mt-3">
      <p className="text-sm">{feature.name}</p>
      <InfoDisclosure label="Info sull’area"><p>{[feature.designation, feature.country, feature.category && `Categoria IUCN ${feature.category}`].filter(Boolean).join(' · ')}</p><p>Fonte: EMODnet / CDDA / WDPA. La categoria IUCN non equivale alle zone A/B/C; verificare il regolamento locale.</p></InfoDisclosure>
    </div>)}
  </section>;
}
