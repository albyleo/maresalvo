import { MapExplorer } from "@/components/map/MapExplorer";
import {
  getMarineAreas,
  getPublicGhostNets,
  getAisVessels,
} from "@/features/marine-map/data";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mappa AMP",
  description:
    "Esplora le aree marine protette, le zone di tutela, la batimetria e le segnalazioni di reti perse nel Mediterraneo.",
};

export default async function MappaPage() {
  const [areas, ghostNets, aisVessels] = await Promise.all([
    getMarineAreas(),
    getPublicGhostNets(),
    getAisVessels(),
  ]);

  return (
    <div className="pt-28 pb-12">
      <div className="mx-auto w-full px-5 sm:px-8">
        <div className="mb-8">
          <p className="section-kicker mb-5">Atlante marino / Mediterraneo</p>
          <h1 className="page-title text-4xl sm:text-5xl text-white mb-4">Mappa AMP</h1>
          <p className="text-white/50 max-w-2xl">
            Esplora aree marine protette, batimetria EMODnet, simbologia nautica e reti perse.
            Perimetri EMODnet, zonazioni regionali e ricostruzioni
            documentate dai decreti. La copertura delle zone interne è parziale.
          </p>
        </div>
        <MapExplorer areas={areas} ghostNets={ghostNets} aisVessels={aisVessels} />
      </div>
    </div>
  );
}
