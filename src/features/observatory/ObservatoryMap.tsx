'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { satelliteTileUrl, type ObservationFeature } from './data';

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export default function ObservatoryMap({ features, satellite, onSelect, onStatus, resetKey }: {
  features: ObservationFeature[]; satellite: { layer: string; date: string; style: string; maxzoom: number }[];
  onSelect: (features: ObservationFeature[]) => void;
  onStatus: (status: 'loading' | 'ready' | 'error') => void; resetKey: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const latest = useRef({ features, satellite, onSelect, onStatus });
  useEffect(() => { latest.current = { features, satellite, onSelect, onStatus }; }, [features, satellite, onSelect, onStatus]);

  useEffect(() => {
    if (!container.current) return;
    let map: maplibregl.Map;
    const status = (value: 'loading' | 'ready' | 'error') => latest.current.onStatus(value);
    try {
      map = new maplibregl.Map({
        container: container.current, center: [15, 38], zoom: 4, minZoom: 2.5, maxZoom: 12,
        cooperativeGestures: true, attributionControl: false,
        locale: {
          'NavigationControl.ZoomIn': 'Ingrandisci', 'NavigationControl.ZoomOut': 'Riduci',
          'CooperativeGesturesHandler.WindowsHelpText': 'Usa Ctrl + rotellina per ingrandire la mappa',
          'CooperativeGesturesHandler.MacHelpText': 'Usa ⌘ + rotellina per ingrandire la mappa',
          'CooperativeGesturesHandler.MobileHelpText': 'Usa due dita per spostare la mappa',
        },
        style: { version: 8, sources: {
          ocean: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 10, attribution: 'Basemap © Esri, GEBCO, NOAA' },
          labels: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 10 },
          observations: { type: 'geojson', data: EMPTY },
        }, layers: [
          { id: 'background', type: 'background', paint: { 'background-color': '#0b2e42' } },
          { id: 'ocean', type: 'raster', source: 'ocean', paint: { 'raster-opacity': 0.85 } },
          { id: 'labels', type: 'raster', source: 'labels' },
          { id: 'observations', type: 'circle', source: 'observations', paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 5, 9, 8], 'circle-color': '#087d8b',
            'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5, 'circle-opacity': 0.9,
          } },
        ] },
      });
    } catch { status('error'); return; }
    mapRef.current = map;
    let sourceFailed = false;
    let ready = false;
    let userMoved = false;
    let lastWidth = container.current.clientWidth;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    map.on('error', () => { sourceFailed = true; status('error'); });
    map.on('idle', () => { if (!sourceFailed) status('ready'); });
    const update = () => {
      if (!ready) return;
      const current = latest.current;
      sourceFailed = false;
      status('loading');
      (map.getSource('observations') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: current.features });
      for (const id of ['satellite-0', 'satellite-1']) {
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
      }
      current.satellite.forEach((raster, index) => {
        const id = `satellite-${index}`;
        map.addSource(id, { type: 'raster', tiles: [satelliteTileUrl(raster.layer, raster.date, raster.style)],
          tileSize: 256, maxzoom: raster.maxzoom, bounds: [-6, 30, 37, 46], attribution: 'Dati © Copernicus Marine Service' });
        map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': 1, 'raster-fade-duration': 0 } }, 'labels');
      });
    };
    map.on('load', () => {
      ready = true;
      map.fitBounds([[-5.7, 30], [36.5, 46]], { padding: 30, duration: 0 });
      update();
    });
    map.on('observatory:update', update);
    map.on('click', 'observations', event => {
      const ids = new Set(event.features?.map(f => String(f.id ?? f.properties.id)));
      const selected = latest.current.features.filter(f => ids.has(f.id));
      if (selected.length) latest.current.onSelect(selected.sort((a, b) => b.properties.observedAt.localeCompare(a.properties.observedAt)));
    });
    map.on('mouseenter', 'observations', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'observations', () => { map.getCanvas().style.cursor = ''; });
    map.on('movestart', event => { if (event.originalEvent) userMoved = true; });
    const resize = new ResizeObserver(() => {
      map.resize();
      const width = container.current?.clientWidth ?? lastWidth;
      if (ready && !userMoved && Math.abs(width - lastWidth) > 40) map.fitBounds([[-5.7, 30], [36.5, 46]], { padding: 30, duration: 0 });
      lastWidth = width;
    });
    resize.observe(container.current);
    return () => { resize.disconnect(); map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => { mapRef.current?.fire('observatory:update'); }, [features, satellite]);
  useEffect(() => {
    if (resetKey) mapRef.current?.fitBounds([[-5.7, 30], [36.5, 46]], { padding: 30, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450 });
  }, [resetKey]);
  return <div ref={container} className="observatory-map" aria-label="Mappa ambientale del Mediterraneo" />;
}
