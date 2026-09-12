"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { Search, PanelLeftClose, Layers } from "lucide-react";
import type {
  MarineProtectedArea,
  AmpFishingStatus,
  GhostNetReport,
  AisVesselPoint,
} from "@/types";
import { FISHING_STATUS_LABELS, FISHING_STATUS_COLORS } from "@/lib/constants";
import { DEFAULT_LAYERS, type LayerToggles } from "@/features/marine-map/config";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

const MapContainer = dynamic(
  () => import("./MarineMapCanvas").then((m) => m.MarineMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[var(--color-ocean)]/20 animate-pulse flex items-center justify-center">
        <span className="text-white/40">Caricamento mappa 3D...</span>
      </div>
    ),
  }
);

interface MarineMapProps {
  areas: MarineProtectedArea[];
  ghostNets?: GhostNetReport[];
  aisVessels?: AisVesselPoint[];
  fullScreen?: boolean;
}

const LAYER_LABELS: Record<keyof LayerToggles, string> = {
  satellite: "Satellite (Esri)",
  bathymetry: "Profondità (batimetria)",
  seamarks: "Simbologia nautica",
  mpaOfficial: "AMP ufficiali (WMS)",
  ghostNets: "Reti perse a mare",
  ais: "Imbarcazioni (AIS)",
};

export function MarineMap({
  areas,
  ghostNets = [],
  aisVessels = [],
  fullScreen = false,
}: MarineMapProps) {
  const [selectedArea, setSelectedArea] = useState<MarineProtectedArea | null>(null);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [fishingFilter, setFishingFilter] = useState<AmpFishingStatus | "">("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [layers, setLayers] = useState<LayerToggles>(DEFAULT_LAYERS);
  const [layersOpen, setLayersOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const regions = [...new Set(areas.map((a) => a.region_name).filter(Boolean))] as string[];

  const filtered = areas.filter((area) => {
    const matchSearch =
      !search ||
      area.name.toLowerCase().includes(search.toLowerCase()) ||
      area.region_name?.toLowerCase().includes(search.toLowerCase());
    const matchRegion = !regionFilter || area.region_name === regionFilter;
    const matchFishing = !fishingFilter || area.fishing_status === fishingFilter;
    return matchSearch && matchRegion && matchFishing;
  });

  useEffect(() => {
    if (sidebarRef.current) {
      gsap.fromTo(
        sidebarRef.current,
        { x: -320, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.8, ease: "power3.out" }
      );
    }
  }, []);

  useEffect(() => {
    if (selectedArea && sidebarRef.current) {
      gsap.fromTo(
        ".area-detail",
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" }
      );
    }
  }, [selectedArea]);

  const toggleLayer = (key: keyof LayerToggles) =>
    setLayers((l) => ({ ...l, [key]: !l[key] }));

  return (
    <div
      className={cn(
        "relative flex overflow-hidden rounded-2xl border border-white/10",
        fullScreen ? "h-[calc(100vh-8rem)]" : "h-[600px]"
      )}
    >
      <div
        ref={sidebarRef}
        className={cn(
          "absolute left-0 top-0 bottom-0 z-[1000] w-80 bg-[var(--color-deep-blue)]/95 backdrop-blur-xl border-r border-white/10 flex flex-col transition-transform duration-300",
          !sidebarOpen && "-translate-x-full"
        )}
      >
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <Search className="h-4 w-4 text-white/40" />
            <input
              type="text"
              placeholder="Cerca area o regione..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-white text-sm placeholder:text-white/30 outline-none"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="flex-1 bg-white/5 text-white text-xs rounded-lg px-2 py-2 border border-white/10 outline-none"
            >
              <option value="">Tutte le regioni</option>
              {regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            <select
              value={fishingFilter}
              onChange={(e) => setFishingFilter(e.target.value as AmpFishingStatus | "")}
              className="flex-1 bg-white/5 text-white text-xs rounded-lg px-2 py-2 border border-white/10 outline-none"
            >
              <option value="">Pesca: tutte</option>
              {Object.entries(FISHING_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.map((area) => (
            <button
              key={area.id}
              onClick={() => setSelectedArea(area)}
              className={cn(
                "w-full text-left p-3 rounded-xl transition-colors",
                selectedArea?.id === area.id
                  ? "bg-[var(--color-aqua)]/20 border border-[var(--color-aqua)]/30"
                  : "hover:bg-white/5 border border-transparent"
              )}
            >
              <p className="text-white text-sm font-medium truncate">{area.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-white/40 text-xs">{area.region_name}</span>
                <Badge className={FISHING_STATUS_COLORS[area.fishing_status]}>
                  {FISHING_STATUS_LABELS[area.fishing_status]}
                </Badge>
              </div>
            </button>
          ))}

          {filtered.length === 0 && (
            <p className="text-white/30 text-sm text-center py-8">Nessuna area trovata</p>
          )}
        </div>

        {selectedArea && (
          <div className="area-detail p-4 border-t border-white/10">
            <h3 className="text-white font-semibold mb-2">{selectedArea.name}</h3>
            <p className="text-white/50 text-xs mb-3 line-clamp-3">
              {selectedArea.description}
            </p>
            {selectedArea.regulation_url && (
              <a
                href={selectedArea.regulation_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-aqua)] text-xs hover:underline"
              >
                Consulta regolamento →
              </a>
            )}
          </div>
        )}
      </div>

      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute left-0 top-4 z-[1001] ml-2 p-2 rounded-lg bg-[var(--color-deep-blue)]/90 border border-white/10 text-white/70 hover:text-white transition-transform"
        style={{ transform: sidebarOpen ? "translateX(320px)" : "translateX(0)" }}
        aria-label="Toggle sidebar"
      >
        <PanelLeftClose className="h-4 w-4" />
      </button>

      {/* Pannello layer */}
      <div className="absolute right-4 top-16 z-[1001]">
        <button
          onClick={() => setLayersOpen((o) => !o)}
          className="flex items-center gap-2 p-2 rounded-lg bg-[var(--color-deep-blue)]/90 border border-white/10 text-white/80 hover:text-white text-xs"
        >
          <Layers className="h-4 w-4" /> Layer
        </button>
        {layersOpen && (
          <div className="mt-2 w-56 p-3 rounded-xl bg-[var(--color-deep-blue)]/95 backdrop-blur-xl border border-white/10 space-y-2">
            {(Object.keys(LAYER_LABELS) as (keyof LayerToggles)[]).map((key) => (
              <label key={key} className="flex items-center gap-2 text-white/80 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={layers[key]}
                  onChange={() => toggleLayer(key)}
                  className="accent-[var(--color-aqua)]"
                />
                {LAYER_LABELS[key]}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 w-full">
        <MapContainer
          areas={filtered}
          ghostNets={ghostNets}
          aisVessels={aisVessels}
          layers={layers}
          selectedArea={selectedArea}
          onSelectArea={setSelectedArea}
        />
      </div>
    </div>
  );
}
