"use client";

import { useEffect, useRef, useState } from "react";
import type { MarineProtectedArea } from "@/types";
import { AREA_COORDS } from "@/features/marine-map/data";

/**
 * Globo 3D fotorealistico (Cesium).
 *
 * - Con NEXT_PUBLIC_GOOGLE_MAPS_KEY usa i Google Photorealistic 3D Tiles
 *   (la mesh 3D di Google Earth).
 * - Senza chiave Google fa fallback al satellite Esri World Imagery sul globo Cesium.
 * - NEXT_PUBLIC_CESIUM_ION_TOKEN (opzionale) abilita terreno mondiale e geocoder.
 *
 * Gli asset statici di Cesium sono serviti da /cesium (copiati da scripts/copy-cesium.mjs
 * durante `npm install`). Il componente va montato solo lato client (ssr: false).
 */
interface Props {
  areas?: MarineProtectedArea[];
}

export function EarthGlobe({ areas = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [usingGoogle, setUsingGoogle] = useState(false);

  useEffect(() => {
    let destroyed = false;

    (async () => {
      try {
        // Base URL degli asset statici PRIMA di importare Cesium.
        (window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = "/cesium";
        const Cesium = await import("cesium");
        await import("cesium/Build/Cesium/Widgets/widgets.css");

        if (destroyed || !containerRef.current) return;

        const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
        if (ionToken) Cesium.Ion.defaultAccessToken = ionToken;

        const viewer = new Cesium.Viewer(containerRef.current, {
          baseLayer: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          geocoder: Boolean(ionToken),
          baseLayerPicker: false,
          infoBox: true,
          selectionIndicator: true,
        });
        viewerRef.current = viewer;
        viewer.scene.globe.showGroundAtmosphere = true;

        const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
        if (googleKey) {
          try {
            Cesium.GoogleMaps.defaultApiKey = googleKey;
            const tileset = await Cesium.createGooglePhotorealistic3DTileset();
            if (destroyed) return;
            viewer.scene.primitives.add(tileset);
            // I tile Google includono il terreno: nasconde il globo di base.
            viewer.scene.globe.show = false;
            setUsingGoogle(true);
          } catch {
            await addEsri(Cesium, viewer);
          }
        } else {
          await addEsri(Cesium, viewer);
        }

        if (destroyed) return;

        // Marker AMP
        for (const a of areas) {
          const c = AREA_COORDS[a.slug];
          if (!c) continue;
          viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(c[0], c[1]),
            point: {
              pixelSize: 12,
              color: Cesium.Color.fromCssColorString("#2EAFB8"),
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            label: {
              text: a.name,
              font: "13px sans-serif",
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.fromCssColorString("#0B1D3A"),
              outlineWidth: 3,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new Cesium.Cartesian2(0, -18),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          });
        }

        // Inquadra l'Italia
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(12.5, 41.0, 1_600_000),
          duration: 2,
        });
      } catch (e) {
        setError(
          "Impossibile inizializzare il globo 3D. Verifica che gli asset Cesium siano in /cesium (npm install)."
        );
        console.error("[EarthGlobe]", e);
      }
    })();

    return () => {
      destroyed = true;
      try {
        viewerRef.current?.destroy?.();
      } catch {
        /* noop */
      }
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute bottom-2 right-2 z-10 rounded-md bg-[var(--color-deep-blue)]/80 px-2 py-1 text-[10px] text-white/70">
        {usingGoogle ? "Google Photorealistic 3D" : "Satellite Esri (fallback)"}
      </div>
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-deep-blue)]/90 p-6 text-center text-sm text-white/80">
          {error}
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function addEsri(Cesium: typeof import("cesium"), viewer: any) {
  const esri = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
    "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer"
  );
  viewer.imageryLayers.addImageryProvider(esri);
}
