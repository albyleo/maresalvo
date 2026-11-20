import { OceanStory } from "@/components/home/OceanStory";
import { MapExplorer } from "@/components/map/MapExplorer";
import {
  getMarineAreas,
  getPublicGhostNets,
  getAisVessels,
} from "@/features/marine-map/data";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ArrowRight } from "lucide-react";

export default async function HomePage() {
  const [areas, ghostNets, aisVessels] = await Promise.all([
    getMarineAreas(),
    getPublicGhostNets(),
    getAisVessels(),
  ]);

  return (
    <>
      <OceanStory />

      <section id="mappa" className="home-map-section scroll-mt-24">
        <div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
            <div>
              <p className="section-kicker mb-5">Atlante marino / Mediterraneo</p>
              <h2 className="page-title text-3xl sm:text-5xl text-white mb-5">
                Un mare di cui prendersi cura.
              </h2>
              <p className="text-white/55 max-w-2xl text-sm leading-relaxed">
                Esplora i perimetri delle AMP e le zonazioni disponibili. Consulta le fonti e il regolamento dell’ente gestore nelle schede delle aree.
              </p>
            </div>
            <Link href="/mappa">
              <Button variant="outline" size="sm">
                Mappa AMP completa
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <MapExplorer areas={areas} ghostNets={ghostNets} aisVessels={aisVessels} activationRequired />
        </div>
      </section>

    </>
  );
}
