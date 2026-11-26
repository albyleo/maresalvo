import type { Map, ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import { MPA_WMS } from '../marine-map/config';
import { ZONE_STYLES } from '../marine-map/zones';

export interface ProtectedLayers { enabled: boolean; zones: boolean; opacity: number }
export interface ProtectedAreaSelection {
  areaId?: string;
  zone?: string;
  features?: { name: string; designation: string; country: string; category: string }[];
  message?: string;
}
export const PROTECTED_SOURCES = ['observatory-amp-wms', 'observatory-amp-geometry'];
export const PROTECTED_HIT_LAYERS = ['observatory-amp-zones', 'observatory-amp-boundaries'];
const zoneColor: ExpressionSpecification = ['match', ['get', 'zone'],
  'A', ZONE_STYLES.A.color, 'B', ZONE_STYLES.B.color, 'Bs', ZONE_STYLES.Bs.color,
  'C', ZONE_STYLES.C.color, 'D', ZONE_STYLES.D.color, '#38bdf8'];
const layers: LayerSpecification[] = [
  { id: 'observatory-amp-wms', type: 'raster', source: PROTECTED_SOURCES[0], paint: { 'raster-fade-duration': 0 } },
  { id: 'observatory-amp-boundaries', type: 'fill', source: PROTECTED_SOURCES[1], filter: ['==', ['get', 'kind'], 'boundary'], paint: { 'fill-color': '#38bdf8' } },
  { id: 'observatory-amp-outline-halo', type: 'line', source: PROTECTED_SOURCES[1], filter: ['==', ['get', 'kind'], 'boundary'], paint: { 'line-color': '#062737', 'line-width': 4 } },
  { id: 'observatory-amp-outlines', type: 'line', source: PROTECTED_SOURCES[1], filter: ['==', ['get', 'kind'], 'boundary'], paint: { 'line-color': '#bae6fd', 'line-width': 2 } },
  { id: 'observatory-amp-zones', type: 'fill', source: PROTECTED_SOURCES[1], filter: ['==', ['get', 'kind'], 'zone'], paint: { 'fill-color': zoneColor } },
  { id: 'observatory-amp-zone-lines', type: 'line', source: PROTECTED_SOURCES[1], filter: ['==', ['get', 'kind'], 'zone'], paint: { 'line-color': zoneColor, 'line-width': 2 } },
];

/** Keep protection overlays above satellite imagery and below sampling points.
 * Sources are requested only on first activation; toggles never recreate rasters. */
export function syncProtectedLayers(map: Map, options: ProtectedLayers) {
  if (!options.enabled && !map.getSource(PROTECTED_SOURCES[0])) return;
  if (!map.getSource(PROTECTED_SOURCES[0])) {
    map.addSource(PROTECTED_SOURCES[0], { type: 'raster', tiles: [MPA_WMS], tileSize: 256,
      attribution: 'AMP: EMODnet / EEA CDDA / UNEP-WCMC / IUCN WDPA' });
    map.addSource(PROTECTED_SOURCES[1], { type: 'geojson', data: '/data/marine-areas.geojson',
      attribution: 'Zone AMP: Regione Sardegna · Regione Siciliana · DM Porto Cesareo 12/12/1997' });
    for (const layer of layers) map.addLayer(layer, 'observations');
  }
  const opacity = Math.max(0, Math.min(0.6, options.opacity));
  for (const layer of layers) {
    const isZone = layer.id === 'observatory-amp-zones' || layer.id === 'observatory-amp-zone-lines';
    map.setLayoutProperty(layer.id, 'visibility', options.enabled && (!isZone || options.zones) ? 'visible' : 'none');
    if (layer.type === 'fill') map.setPaintProperty(layer.id, 'fill-opacity', opacity);
    if (layer.type === 'raster') map.setPaintProperty(layer.id, 'raster-opacity', opacity);
  }
}

/** Points take precedence over polygons when both occupy the clicked pixel. */
export function protectedHit(features: { properties: Record<string, unknown> }[]) {
  return features.find(f => f.properties.kind === 'zone') ?? features.find(f => f.properties.kind === 'boundary');
}
