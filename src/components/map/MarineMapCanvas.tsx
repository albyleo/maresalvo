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
import { ZONE_STYLES } from "@/features/marine-map/zones";

interface Props {
  areas: MarineProtectedArea[];
  ghostNets: GhostNetReport[];
  aisVessels: AisVesselPoint[];
  layers: LayerToggles;
  selectedArea: MarineProtectedArea | null;
  onSelectArea: (area: MarineProtectedArea, zoneId?: string) => void;
  selectedZoneId?: string;
  onLayerError: (source: string) => void;
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
        attribution: 'EMODnet / EEA CDDA / UNEP-WCMC / IUCN WDPA',
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
        paint: { "raster-opacity": 0.4 },
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
  selectedZoneId,
  onLayerError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const loadedRef = useRef(false);
  const onSelectRef = useRef(onSelectArea);
  const areasRef = useRef(areas);
  const latestRef = useRef({ areas, ghostNets, aisVessels, layers });
  const errorRef = useRef(onLayerError);
  useEffect(() => {
    onSelectRef.current = onSelectArea;
    areasRef.current = areas;
    latestRef.current = { areas, ghostNets, aisVessels, layers };
    errorRef.current = onLayerError;
  }, [onSelectArea, onLayerError, areas, ghostNets, aisVessels, layers]);

  function emptyFC(): GeoJSON.FeatureCollection {
    return { type: "FeatureCollection", features: [] };
  }

  function syncData() {
    const { areas, ghostNets, aisVessels } = latestRef.current;
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

    (map.getSource("amp-points") as GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: areas
        .filter((a) => a.centroid)
        .map((a) => ({
          type: "Feature",
          geometry: a.centroid!,
          properties: { slug: a.slug, name: a.name, fishing: a.fishing_status },
        })),
    });
    for (const id of ['amp-boundaries', 'amp-outlines', 'amp-zones', 'amp-zone-lines', 'amp-zone-labels']) {
      if (map.getLayer(id)) map.setFilter(id, ['all', ['==', ['get', 'kind'], id.startsWith('amp-zone') ? 'zone' : 'boundary'], ['in', ['get', 'area_id'], ['literal', areas.map(a => a.id)]]]);
    }

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
    const { layers } = latestRef.current;
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const set = (id: string, on: boolean) =>
      map.getLayer(id) && map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    set("satellite", layers.satellite);
    set("bathymetry", layers.bathymetry);
    set("seamarks", layers.seamarks);
    set("mpa-wms", layers.mpaOfficial);
    for (const id of ['amp-boundaries','amp-outlines','amp-zones','amp-zone-lines','amp-zone-labels','amp-selection','amp-zone-selection','amp-points','amp-labels']) set(id, layers.mpaOfficial);
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
    map.on('error', (event) => { if ('sourceId' in event && typeof event.sourceId === 'string') errorRef.current(event.sourceId); });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    map.addControl(new maplibregl.FullscreenControl({container:containerRef.current.closest('.marine-map-shell') as HTMLElement}), 'top-right');
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(containerRef.current);
    let identifyRequest: AbortController | undefined;
    const identifyPopup = new maplibregl.Popup({maxWidth:'320px',className:'marine-identify-popup'});

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
      map.addSource('amp-geometry', { type:'geojson', data:'/data/marine-areas.geojson', attribution:'EMODnet / EEA CDDA · Regione Sardegna · Regione Siciliana · DM Porto Cesareo 12/12/1997' });
      const zoneColor: maplibregl.ExpressionSpecification = ['match', ['get','zone'], 'A', ZONE_STYLES.A.color, 'B', ZONE_STYLES.B.color, 'Bs', ZONE_STYLES.Bs.color, 'C', ZONE_STYLES.C.color, 'D', ZONE_STYLES.D.color, '#38bdf8'];
      const boundaryFilter: maplibregl.FilterSpecification = ['==', ['get','kind'], 'boundary'];
      const zoneFilter: maplibregl.FilterSpecification = ['==', ['get','kind'], 'zone'];
      map.addLayer({id:'amp-boundaries',type:'fill',source:'amp-geometry',filter:boundaryFilter,paint:{'fill-color':'#38bdf8','fill-opacity':0.12}});
      map.addLayer({id:'amp-outlines',type:'line',source:'amp-geometry',filter:boundaryFilter,paint:{'line-color':'#7dd3fc','line-width':2}});
      map.addLayer({id:'amp-zones',type:'fill',source:'amp-geometry',filter:zoneFilter,paint:{'fill-color':zoneColor,'fill-opacity':0.35}});
      map.addLayer({id:'amp-zone-lines',type:'line',source:'amp-geometry',filter:zoneFilter,layout:{'line-sort-key':['match',['get','zone'],'C',0,'D',1,'B',2,'Bs',3,4]},paint:{'line-color':zoneColor,'line-width':2.5}});
      map.addLayer({id:'amp-zone-labels',type:'symbol',source:'amp-geometry',filter:zoneFilter,minzoom:10,layout:{'text-field':['concat','Zona ',['get','zone']],'text-size':13},paint:{'text-color':'#fff','text-halo-color':'#071e23','text-halo-width':2}});
      map.addLayer({id:'amp-selection',type:'line',source:'amp-geometry',filter:['==',['get','id'],''],paint:{'line-color':'#fff','line-width':4}});
      map.addLayer({id:'amp-zone-selection',type:'line',source:'amp-geometry',filter:['==',['get','id'],''],paint:{'line-color':'#fff','line-width':4,'line-dasharray':[2,1]}});

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
      map.on('click', (event) => {
        const hits = map.queryRenderedFeatures(event.point, {layers:['amp-zones','amp-boundaries']});
        const hit = hits.find(f => f.properties.kind === 'zone') ?? hits[0];
        if (!hit) {
          if (!latestRef.current.layers.mpaOfficial || map.queryRenderedFeatures(event.point,{layers:['amp-points']}).length) return;
          identifyRequest?.abort();
          const controller=new AbortController(); identifyRequest=controller;
          const content=document.createElement('div'); content.textContent='Ricerca area protetta…';
          identifyPopup.setLngLat(event.lngLat).setDOMContent(content).addTo(map);
          const params=new URLSearchParams({lng:event.lngLat.lng.toFixed(6),lat:event.lngLat.lat.toFixed(6),zoom:map.getZoom().toFixed(2)});
          fetch(`/api/marine-areas/identify?${params}`,{signal:controller.signal}).then(async response=>{
            const result=await response.json(); if(controller.signal.aborted)return;
            content.replaceChildren();
            if(!response.ok) {content.textContent=result.error;return;}
            if(!result.features.length) {content.textContent='Nessuna scheda trovata qui. Non implica assenza di vincoli.';return;}
            for(const item of result.features) {
              const title=document.createElement('strong'); title.textContent=item.name;
              const detail=document.createElement('p'); detail.textContent=[item.designation,item.country,item.category?`Categoria IUCN ${item.category}`:''].filter(Boolean).join(' · ');
              content.append(title,detail);
            }
            const note=document.createElement('p');note.textContent='Fonte: EMODnet / CDDA / WDPA. La categoria IUCN non equivale alle zone A/B/C; consultare il regolamento locale.';content.append(note);
          }).catch(()=>{if(!controller.signal.aborted)content.textContent='Scheda non disponibile. Riprova tra poco.';});
          return;
        }
        identifyRequest?.abort(); identifyPopup.remove();
        const area = areasRef.current.find(a => a.id === hit.properties.area_id);
        if (area) onSelectRef.current(area, hit.properties.kind === 'zone' ? hit.properties.id : undefined);
      });
      for (const id of ['amp-zones','amp-boundaries']) {
        map.on('mouseenter',id,()=>{map.getCanvas().style.cursor='pointer';});
        map.on('mouseleave',id,()=>{map.getCanvas().style.cursor='';});
      }
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
        const content = document.createElement('div');
        content.style.color = '#102c33';
        content.textContent = `Rete segnalata · ${p.gear_type} · ${p.status} · Prof. ${p.depth_m || '?'} m`;
        popup.setLngLat(lngLat).setDOMContent(content).addTo(map);
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
      resize.disconnect();
      identifyRequest?.abort(); identifyPopup.remove();
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  // Re-sync su cambio dati
  useEffect(() => {
    syncData();
  }, [areas, ghostNets, aisVessels]);

  // Re-sync su cambio toggle
  useEffect(() => {
    syncLayerVisibility();
  }, [layers]);

  // flyTo su area selezionata
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer('amp-selection')) map.setFilter('amp-selection', ['==',['get','id'],selectedArea?.id ?? '']);
    if (!selectedArea) return;
    if (selectedArea.bounds) map.fitBounds(selectedArea.bounds, {padding: window.innerWidth > 640 ? {top:70,bottom:70,left:390,right:80} : 45, pitch:0, duration:900, maxZoom:13});
    else if (selectedArea.centroid) map.flyTo({center:selectedArea.centroid.coordinates as [number,number],zoom:10,pitch:0,duration:900});
  }, [selectedArea]);

  useEffect(() => {
    const map=mapRef.current;
    if (map?.getLayer('amp-zone-selection')) map.setFilter('amp-zone-selection',['==',['get','id'],selectedZoneId ?? '']);
  },[selectedZoneId]);

  return <div ref={containerRef} className="w-full h-full" />;
}
