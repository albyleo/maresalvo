import { MapExplorer } from "@/components/map/MapExplorer";
import {
  getMarineAreas,
  getGhostNets,
  getAisVessels,
} from "@/features/marine-map/data";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mappa marina 3D",
  description:
    "Mappa interattiva 3D: aree marine protette, profondità, simbologia nautica, reti perse, monitoraggio AIS e globo Earth 3D.",
};

export default async function MappaPage() {
  const [areas, ghostNets, aisVessels] = await Promise.all([
    getMarineAreas(),
    getGhostNets(),
    getAisVessels(),
  ]);

  return (
    <div className="pt-28 pb-12">
      <div className="mx-auto w-full px-2 sm:px-4 lg:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Mappa Marina 3D</h1>
          <p className="text-white/50 max-w-2xl">
            Scegli tra la <strong>Mappa marina</strong> (AMP, batimetria EMODnet,
            simbologia nautica, reti perse, AIS) e il globo <strong>Earth 3D</strong>{" "}
            fotorealistico. Perimetri EMODnet, zonazioni regionali e ricostruzioni
            documentate dai decreti. La copertura delle zone interne è parziale.
          </p>
        </div>
        <MapExplorer areas={areas} ghostNets={ghostNets} aisVessels={aisVessels} />
      </div>
    </div>
  );
}
