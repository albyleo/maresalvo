import Link from 'next/link';
import catalog from '@/features/certification/catalog.json';
import { QuestionnairePicker } from '@/features/certification/QuestionnairePicker';

export const metadata = { title: 'Questionari', description: 'Tre percorsi formativi: pesca sportiva con canna, pesca in apnea e pesca professionale con reti.' };
export default function QuestionnairesPage() {
  return <section className="pt-36 pb-24 px-6 max-w-7xl mx-auto min-h-[85svh]">
    <p className="section-kicker mb-5">Conoscere per proteggere</p><h1 className="page-title text-4xl sm:text-6xl mb-6">Il tuo prossimo passo,<br /><span className="text-[#b7d6c9]">prima di entrare in acqua.</span></h1>
    <p className="max-w-2xl text-white/60 leading-relaxed mb-6">Scegli un percorso ed esplora le domande. Nell’area personale puoi inviare le risposte, ricevere la valutazione e seguire la revisione dello staff.</p>
    <p className="text-sm text-amber-200/80 max-w-3xl mb-10">Bozza formativa da validare: i contenuti non sostituiscono i regolamenti vigenti. I certificati del progetto pilota non sono qualifiche o permessi.</p>
    <QuestionnairePicker items={catalog} preview />
    <p className="mt-10 text-sm text-white/55">Hai già un account? <Link href="/dashboard/qualifiche" className="text-[#b7e5d5] underline">Accedi al percorso con valutazione</Link>.</p>
  </section>;
}
