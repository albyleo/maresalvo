"use client";

import { useEffect, useRef } from "react";
import maplibregl, {
  Map as MlMap,
  GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type {
  MarineProtectedArea,
  GhostNetReport,
  AisVesselPoint,
} from "@/types";
import {
  MAP_CENTER,
  MAP_INITIAL,
  OCEAN_BASE_TILES,
  OCEAN_REFERENCE_TILES,
  ESRI_SATELLITE_TILES,
  EMODNET_BATHYMETRY_WMS,
  OPENSEAMAP_SEAMARK_TILES,
  MPA_WMS,
  getTerrainTiles,
  type LayerToggles,
} from "@/features/marine-map/config";
import { AREA_COORDS } from "@/features/marine-map/data";

interface Props {
  areas: MarineProtectedArea[];
  ghostNets: GhostNetReport[];
  aisVessels: AisVesselPoint[];
  layers: LayerToggles;
  selectedArea: MarineProtectedArea | null;
  onSelectArea: (area: MarineProtectedArea) => void;
}

/** Stile MapLibre di base (raster). I layer opzionali sono accesi/spenti via toggle. */
function buildStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      "ocean-base": {
        type: "raster",
        tiles: OCEAN_BASE_TILES,
        tileSize: 256,
        attribution: "Esri Ocean",
      },
      "ocean-ref": {
        type: "raster",
        tiles: OCEAN_REFERENCE_TILES,
        tileSize: 256,
      },
      satellite: {
        type: "raster",
        tiles: ESRI_SATELLITE_TILES,
        tileSize: 256,
        attribution: "Esri World Imagery",
      },
      bathymetry: {
        type: "raster",
        tiles: [EMODNET_BATHYMETRY_WMS],
        tileSize: 256,
        attribution: "EMODnet Bathymetry",
      },
      seamarks: {
        type: "raster",
        tiles: OPENSEAMAP_SEAMARK_TILES,
        tileSize: 256,
        attribution: "OpenSeaMap",
      },
      "mpa-wms": {
        type: "raster",
        tiles: [MPA_WMS],
        tileSize: 256,
        attribution: "EMODnet Human Activities / MASE",
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#0B1D3A" } },
      { id: "ocean-base", type: "raster", source: "ocean-base" },
      {
        id: "satellite",
        type: "raster",
        source: "satellite",
        layout: { visibility: "none" },
      },
      {
        id: "bathymetry",
        type: "raster",
        source: "bathymetry",
        layout: { visibility: "none" },
        paint: { "raster-opacity": 0.7 },
      },
      { id: "ocean-ref", type: "raster", source: "ocean-ref", paint: { "raster-opacity": 0.6 } },
      {
        id: "mpa-wms",
        type: "raster",
        source: "mpa-wms",
        layout: { visibility: "none" },
        paint: { "raster-opacity": 0.6 },
      },
      {
        id: "seamarks",
        type: "raster",
        source: "seamarks",
        layout: { visibility: "none" },
      },
    ],
  };
}

const GHOST_STATUS_COLOR: Record<string, string> = {
  reported: "#E07A5F",
  verified: "#F2C14E",
  recovery_planned: "#7FDBDA",
  recovered: "#3DD68C",
  rejected: "#6B7280",
};

export function MarineMapCanvas({
  areas,
  ghostNets,
  aisVessels,
  layers,
  selectedArea,
  onSelectArea,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const loadedRef = useRef(false);
  const onSelectRef = useRef(onSelectArea);
  const areasRef = useRef(areas);
  useEffect(() => {
    onSelectRef.current = onSelectArea;
    areasRef.current = areas;
  }, [onSelectArea, areas]);

  function emptyFC(): GeoJSON.FeatureCollection {
    return { type: "FeatureCollection", features: [] };
  }

  function syncData() {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

    (map.getSource("amp-points") as GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: areas
        .filter((a) => AREA_COORDS[a.slug])
        .map((a) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: AREA_COORDS[a.slug] },
          properties: { slug: a.slug, name: a.name, fishing: a.fishing_status },
        })),
    });

    (map.getSource("ghost-nets") as GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: ghostNets.map((g) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [g.lng, g.lat] },
        properties: {
          gear_type: g.gear_type,
          status: g.status,
          depth_m: g.depth_m,
          color: GHOST_STATUS_COLOR[g.status] ?? "#E07A5F",
        },
      })),
    });

    (map.getSource("ais") as GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: aisVessels.map((v) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [v.lng, v.lat] },
        properties: {
          name: v.name,
          mmsi: v.mmsi,
          alert: v.is_fishing && v.in_protected_area,
        },
      })),
    });
  }

  function syncLayerVisibility() {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const set = (id: string, on: boolean) =>
      map.getLayer(id) && map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    set("satellite", layers.satellite);
    set("bathymetry", layers.bathymetry);
    set("seamarks", layers.seamarks);
    set("mpa-wms", layers.mpaOfficial);
    set("ghost-nets", layers.ghostNets);
    set("ais", layers.ais);
  }

  // Init mappa
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(),
      center: MAP_CENTER,
      zoom: MAP_INITIAL.zoom,
      pitch: MAP_INITIAL.pitch,
      bearing: MAP_INITIAL.bearing,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", () => {
      // Terreno 3D del fondale (opzionale, richiede chiave)
      const terrainUrl = getTerrainTiles();
      if (terrainUrl) {
        map.addSource("terrain", {
          type: "raster-dem",
          tiles: [terrainUrl],
          tileSize: 256,
        });
        map.setTerrain({ source: "terrain", exaggeration: 1.2 });
      }

      // Sorgenti GeoJSON dinamiche
      map.addSource("amp-points", { type: "geojson", data: emptyFC() });
      map.addSource("ghost-nets", { type: "geojson", data: emptyFC() });
      map.addSource("ais", { type: "geojson", data: emptyFC() });

      // AMP — cerchi
      map.addLayer({
        id: "amp-points",
        type: "circle",
        source: "amp-points",
        paint: {
          "circle-radius": 7,
          "circle-color": "#2EAFB8",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
          "circle-opacity": 0.9,
        },
      });
      map.addLayer({
        id: "amp-labels",
        type: "symbol",
        source: "amp-points",
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
        },
        paint: { "text-color": "#ffffff", "text-halo-color": "#0B1D3A", "text-halo-width": 1.4 },
      });

      // Reti perse
      map.addLayer({
        id: "ghost-nets",
        type: "circle",
        source: "ghost-nets",
        paint: {
          "circle-radius": 6,
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#0B1D3A",
          "circle-stroke-width": 1.5,
        },
      });

      // AIS — imbarcazioni (rosse se pescano dentro AMP)
      map.addLayer({
        id: "ais",
        type: "circle",
        source: "ais",
        paint: {
          "circle-radius": 5,
          "circle-color": ["case", ["get", "alert"], "#ef4444", "#9CA3AF"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
        },
      });

      // Click su AMP
      map.on("click", "amp-points", (e) => {
        const slug = e.features?.[0]?.properties?.slug as string | undefined;
        const area = areasRef.current.find((a) => a.slug === slug);
        if (area) onSelectRef.current(area);
      });
      map.on("mouseenter", "amp-points", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "amp-points", () => (map.getCanvas().style.cursor = ""));

      // Popup reti perse
      const popup = new maplibregl.Popup({ closeButton: false, offset: 12 });
      map.on("mouseenter", "ghost-nets", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const p = e.features?.[0]?.properties as Record<string, string>;
        const lngLat = (e.features?.[0]?.geometry as GeoJSON.Point).coordinates as [number, number];
        popup
          .setLngLat(lngLat)
          .setHTML(
            `<div style="font-size:12px"><strong>Rete segnalata</strong><br/>${p.gear_type} · ${p.status}<br/>Prof. ${p.depth_m || "?"} m</div>`
          )
          .addTo(map);
      });
      map.on("mouseleave", "ghost-nets", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      loadedRef.current = true;
      syncData();
      syncLayerVisibility();
    });

    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync su cambio dati
  useEffect(() => {
    syncData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areas, ghostNets, aisVessels]);

  // Re-sync su cambio toggle
  useEffect(() => {
    syncLayerVisibility();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers]);

  // flyTo su area selezionata
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedArea) return;
    const coords = AREA_COORDS[selectedArea.slug];
    if (coords) {
      map.flyTo({ center: coords, zoom: 10, pitch: 60, duration: 1800, essential: true });
    }
  }, [selectedArea]);

  return <div ref={containerRef} className="w-full h-full" />;
}
