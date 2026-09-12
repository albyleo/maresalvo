import { HeroSection } from "@/components/home/HeroSection";
import { StatsSection } from "@/components/home/StatsSection";
import { FeaturesSection } from "@/components/home/FeaturesSection";
import { ScrollDiveSection } from "@/components/home/ScrollDiveSection";
import { MarineMap } from "@/components/map/MarineMap";
import {
  getMarineAreas,
  getGhostNets,
  getAisVessels,
} from "@/features/marine-map/data";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ArrowRight } from "lucide-react";

export default async function HomePage() {
  const [areas, ghostNets, aisVessels] = await Promise.all([
    getMarineAreas(),
    getGhostNets(),
    getAisVessels(),
  ]);

  return (
    <>
      <HeroSection />
      <StatsSection />
      <ScrollDiveSection />
      <FeaturesSection />

      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">
                Aree Marine Protette
              </h2>
              <p className="text-white/50">
                Esplora le AMP italiane con dati da fonti ISPRA/MASE
              </p>
            </div>
            <Link href="/mappa">
              <Button variant="outline" size="sm">
                Mappa completa
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <MarineMap areas={areas} ghostNets={ghostNets} aisVessels={aisVessels} />
        </div>
      </section>

      <section className="py-24 bg-gradient-to-b from-transparent to-[var(--color-ocean)]/20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Verifica un certificato
          </h2>
          <p className="text-white/50 mb-8">
            Inserisci il codice QR o il numero seriale per verificare l&apos;autenticità
            di un certificato o autorizzazione FIPSAS.
          </p>
          <Link href="/verifica">
            <Button variant="primary" size="lg">
              Vai alla verifica
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
