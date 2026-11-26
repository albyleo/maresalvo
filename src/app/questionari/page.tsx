import Link from 'next/link';
import catalog from '@/features/certification/catalog.json';
import practiceAnswers from '@/features/certification/practice-answers.json';
import { QuestionnairePicker } from '@/features/certification/QuestionnairePicker';

export const metadata = { title: 'Questionari', description: 'Percorsi formativi su pesca, apnea, nautica da diporto, kayak, SUP e snorkeling.' };
export default function QuestionnairesPage() {
  return <section className="pt-36 pb-24 px-6 max-w-7xl mx-auto min-h-[85svh]">
    <p className="section-kicker mb-5">Conoscere per proteggere</p><h1 className="page-title text-4xl sm:text-6xl mb-6">Il tuo prossimo passo,<br /><span className="text-[#b7d6c9]">prima di entrare in acqua.</span></h1>
    <p className="max-w-2xl text-white/60 leading-relaxed mb-6">Scegli un percorso e allenati: dopo ogni risposta vedrai subito la correzione. Nell’area personale puoi svolgere il questionario con valutazione finale e revisione dello staff.</p>
    <p className="text-sm text-amber-200/80 max-w-3xl mb-10">Bozza formativa da validare: i contenuti non sostituiscono i regolamenti vigenti. I certificati del progetto pilota non sono qualifiche, patenti nautiche o permessi e non abilitano alla conduzione di imbarcazioni.</p>
    <Link href="/questionari/patente-nautica" className="block border-y border-sky-200/30 py-7 mb-8 hover:bg-white/5">
      <span className="section-kicker">Preparazione teorica · Categoria A a motore entro 12 miglia</span>
      <h2 className="text-2xl mt-3">Patente nautica →</h2>
      <span className="block mt-3 text-sm text-white/65">30 esercizi con spiegazioni e ripasso degli errori · Accesso libero</span>
    </Link>
    <QuestionnairePicker items={catalog} preview practiceAnswers={practiceAnswers} />
    <p className="mt-10 text-sm text-white/55">Hai già un account? <Link href="/dashboard/qualifiche" className="text-[#b7e5d5] underline">Accedi al percorso con valutazione</Link>.</p>
  </section>;
}
