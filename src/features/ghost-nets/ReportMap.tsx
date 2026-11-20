'use client';
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ESRI_SATELLITE_TILES } from '@/features/marine-map/config';
import type { NearbyNet, Position } from './types';

export default function ReportMap({ position, nearby, onPosition, enabled, purpose = 'net' }: {
  position: Position | null; nearby: NearbyNet[]; onPosition: (p: Position) => void; enabled: boolean; purpose?: 'net' | 'weather';
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const pin = useRef<maplibregl.Marker | null>(null);
  const onChange = useRef(onPosition);
  const canChoose = useRef(enabled);
  const [error, setError] = useState(false);
  useEffect(() => { onChange.current = onPosition; }, [onPosition]);
  useEffect(() => { canChoose.current = enabled; pin.current?.setDraggable(enabled); }, [enabled]);
  useEffect(() => {
    if (!container.current) return;
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({ container: container.current, center: [16,39], zoom: 5,
        style: { version: 8, sources: { satellite: { type: 'raster', tiles: ESRI_SATELLITE_TILES, tileSize: 256, attribution: 'Esri World Imagery' } },
          layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }] } });
    } catch { requestAnimationFrame(() => setError(true)); return; }
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    instance.on('error', () => setError(true));
    instance.on('click', event => {
      if (!canChoose.current) return;
      onChange.current({ lat: Number(event.lngLat.lat.toFixed(6)), lng: Number(event.lngLat.wrap().lng.toFixed(6)) });
    });
    const resize = new ResizeObserver(() => instance.resize());
    resize.observe(container.current);
    return () => { resize.disconnect(); pin.current?.remove(); pin.current = null; instance.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!map.current || !position) return;
    if (!pin.current) {
      pin.current = new maplibregl.Marker({ color: '#b7e5d5', draggable: enabled }).setLngLat([position.lng,position.lat]).addTo(map.current);
      pin.current.on('dragend', () => {
        if (!canChoose.current) return;
        const point = pin.current!.getLngLat().wrap();
        onChange.current({ lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) });
      });
    }
    pin.current.setLngLat([position.lng,position.lat]);
    map.current.easeTo({ center: [position.lng,position.lat], zoom: Math.max(purpose==='weather'?7:14,map.current.getZoom()), duration: 500 });
  }, [position, enabled, purpose]);
  useEffect(() => {
    if (!map.current) return;
    const markers = nearby.map(net => {
      const label = document.createElement('div');
      label.textContent = `${net.observer_count}`;
      label.className = 'grid place-items-center w-7 h-7 rounded-full bg-amber-300 text-slate-950 text-xs font-bold border-2 border-white shadow-lg';
      label.title = `${net.observer_count} osservatori · rete da confrontare nell’elenco`;
      label.style.pointerEvents = 'none';
      return new maplibregl.Marker({ element: label }).setLngLat([net.lng,net.lat]).addTo(map.current!);
    });
    return () => markers.forEach(marker => marker.remove());
  }, [nearby]);
  return <div>
    <div className="relative h-[55svh] min-h-[360px] overflow-hidden border-y border-white/15">
      <div ref={container} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-label={purpose==='weather'?'Scegli il punto per il meteo marino':'Mappa per localizzare una rete'} />
    </div>
    {error && <p className="mt-2 text-xs text-amber-200" role="status">Cartografia temporaneamente non disponibile: puoi inserire le coordinate nei campi sottostanti.</p>}
    <p className="mt-3 text-xs text-white/50">{purpose==='weather'?'Tocca un punto in mare, oppure trascina il segnaposto. Le previsioni si riferiscono alla cella del modello più vicina.':<>{enabled ? 'Tocca il punto del ritrovamento. Puoi anche trascinare il segnaposto verde.' : 'Esplora la zona. Per inserire un punto e inviare osservazioni serve un account abilitato.'} I punti ambra indicano segnalazioni vicine.</>}</p>
  </div>;
}
