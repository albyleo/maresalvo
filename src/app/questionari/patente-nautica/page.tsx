import Link from 'next/link';
import { NauticalStudy } from '@/features/certification/NauticalStudy';

export const metadata = { title: 'Preparazione patente nautica', description: '30 esercizi guidati per iniziare la preparazione alla patente nautica A a motore entro 12 miglia: obblighi, abbordi e calcoli di navigazione.' };

export default function NauticalStudyPage() {
  return <section className="mx-auto max-w-7xl px-6 pt-32 pb-24">
    <Link href="/questionari" className="text-sm text-sky-200 underline">← Tutti i percorsi</Link>
    <header className="mt-8 mb-10 max-w-4xl">
      <p className="section-kicker">Studio · Categoria A a motore entro 12 miglia</p>
      <h1 className="page-title text-4xl sm:text-6xl mt-4">Preparazione patente nautica</h1>
      <p className="mt-5 text-white/65">30 domande · 3 argomenti · Correzioni spiegate · Ripasso degli errori</p>
      <p className="mt-4 text-sm text-amber-100/80">Esercitazioni integrative, non esame ministeriale né corso abilitante. Non rilasciano una patente.</p>
    </header>
    <NauticalStudy/>
  </section>;
}
