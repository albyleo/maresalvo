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
}

export function MapExplorer({ areas, ghostNets = [], aisVessels = [] }: Props) {
  const [mode, setMode] = useState<Mode>("marine");

  return (
    <div>
      <div className="mb-4 inline-flex rounded-full border border-white/10 bg-[var(--color-deep-blue)]/80 p-1">
        <button
          onClick={() => setMode("marine")}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors",
            mode === "marine"
              ? "bg-[var(--color-aqua)] text-[var(--color-deep-blue)]"
              : "text-white/70 hover:text-white"
          )}
        >
          <MapIcon className="h-4 w-4" /> Mappa marina
        </button>
        <button
          onClick={() => setMode("earth")}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors",
            mode === "earth"
              ? "bg-[var(--color-aqua)] text-[var(--color-deep-blue)]"
              : "text-white/70 hover:text-white"
          )}
        >
          <Globe className="h-4 w-4" /> Earth 3D
        </button>
      </div>

      {mode === "marine" ? (
        <MarineMap areas={areas} ghostNets={ghostNets} aisVessels={aisVessels} fullScreen />
      ) : (
        <div className="h-[calc(100vh-8rem)] overflow-hidden rounded-2xl border border-white/10">
          <EarthGlobe areas={areas} />
        </div>
      )}
    </div>
  );
}
