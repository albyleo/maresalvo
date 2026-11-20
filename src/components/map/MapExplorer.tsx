"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Map as MapIcon, Globe } from "lucide-react";
import type {
  MarineProtectedArea,
  GhostNetReport,
  AisVesselPoint,
} from "@/types";
import { MarineMap } from "@/components/map/MarineMap";
import { cn } from "@/lib/utils";
import { MapInteractionGate } from './MapInteractionGate';

const EarthGlobe = dynamic(
  () => import("@/components/map/EarthGlobe").then((m) => m.EarthGlobe),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[var(--color-deep-blue)] animate-pulse flex items-center justify-center">
        <span className="text-white/40">Caricamento globo 3D...</span>
      </div>
    ),
  }
);

type Mode = "marine" | "earth";

interface Props {
  areas: MarineProtectedArea[];
  ghostNets?: GhostNetReport[];
  aisVessels?: AisVesselPoint[];
  activationRequired?: boolean;
}

export function MapExplorer({ areas, ghostNets = [], aisVessels = [], activationRequired = false }: Props) {
  const [mode, setMode] = useState<Mode>("marine");

  return (
    <div>
      <div aria-label="Tipo di mappa" className="mb-5 flex gap-6 border-b border-white/15">
        <button
          onClick={() => setMode("marine")}
          aria-pressed={mode === 'marine'}
          className={cn(
            "flex items-center gap-2 border-b-2 py-3 text-sm transition-colors",
            mode === "marine"
              ? "border-[var(--color-aqua)] text-[var(--color-aqua)]"
              : "border-transparent text-white/60 hover:text-white"
          )}
        >
          <MapIcon className="h-4 w-4" /> Mappa marina
        </button>
        <button
          onClick={() => setMode("earth")}
          aria-pressed={mode === 'earth'}
          className={cn(
            "flex items-center gap-2 border-b-2 py-3 text-sm transition-colors",
            mode === "earth"
              ? "border-[var(--color-aqua)] text-[var(--color-aqua)]"
              : "border-transparent text-white/60 hover:text-white"
          )}
        >
          <Globe className="h-4 w-4" /> Earth 3D
        </button>
      </div>

      {mode === "marine" ? (
        <MarineMap areas={areas} ghostNets={ghostNets} aisVessels={aisVessels} fullScreen activationRequired={activationRequired}/>
      ) : (
        <MapInteractionGate enabled={activationRequired} className="marine-map-shell marine-map-expanded relative overflow-hidden border-y border-white/10">
          <EarthGlobe areas={areas} />
        </MapInteractionGate>
      )}
    </div>
  );
}
