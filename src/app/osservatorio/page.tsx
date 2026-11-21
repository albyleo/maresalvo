import type { Metadata } from 'next';
import { Observatory } from '@/features/observatory/Observatory';
import manifest from '../../../public/data/observatory/manifest.json';

export const metadata: Metadata = {
  title: 'Osservatorio del Mediterraneo',
  description: 'Clorofilla, torbidità e materiale sospeso da satellite. Ultime campagne su rifiuti, microplastiche, contaminanti e scarichi costieri, con fonti e date.',
};

export default function ObservatoryPage() {
  return <div className="observatory-page mx-auto max-w-[1600px] px-4 pb-16 pt-28 sm:px-8">
    <header className="mb-9 max-w-4xl">
      <p className="section-kicker">MareSalvo · Dati ambientali</p>
      <h1 className="page-title mt-4 text-4xl text-white sm:text-6xl">Osservatorio del Mediterraneo</h1>
      <p className="mt-4 max-w-2xl text-base text-sky-100/70">Uno sguardo sul mare, a partire dai dati. Osservazioni satellitari recenti e ultime campagne disponibili, con la loro data e la loro fonte.</p>
    </header>
    <Observatory manifest={manifest}/>
  </div>;
}
