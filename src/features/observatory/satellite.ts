import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { isSatelliteRecent, SATELLITES, type SatelliteData, type SatelliteId, type SatelliteLegend } from './data';

export function legendUrl(id: SatelliteId) {
  return `https://wmts.marine.copernicus.eu/teroWmts?${new URLSearchParams({ SERVICE: 'WMTS', REQUEST: 'GetLegend',
    LAYER: SATELLITES[id].layer, STYLE: SATELLITES[id].style, FORMAT: 'application/json' })}`;
}

export function parseSatelliteLegend(value: unknown, id: SatelliteId): SatelliteLegend {
  const continuous = (value as { continuous?: { logScale?: boolean; clamp?: boolean; valueMin?: number; valueMax?: number;
    variableId?: string; cmapName?: string; cmap?: { colorMap?: unknown } } })?.continuous;
  const config = SATELLITES[id];
  const [min, max] = config.style.split('range:')[1].split('/').map(Number);
  if (!continuous || continuous.logScale !== true || continuous.clamp !== true || continuous.valueMin !== min || continuous.valueMax !== max
    || continuous.variableId !== config.layer.split('/').at(-1) || continuous.cmapName !== config.style.split(',')[0].slice(5)) throw new Error('Unexpected legend style');
  const colors = continuous.cmap?.colorMap;
  if (!Array.isArray(colors) || colors.length < 2 || colors.length > 1024 || !colors.every(rgb => Array.isArray(rgb) && rgb.length === 3
    && rgb.every(c => Number.isInteger(c) && c >= 0 && c <= 255))) throw new Error('Invalid legend colors');
  return { min, max, colors: colors.map(rgb => `rgb(${rgb.join(',')})`) };
}

export function capabilitiesUrl(id: SatelliteId) {
  const dataset = SATELLITES[id].layer.slice(0, SATELLITES[id].layer.lastIndexOf('/'));
  return `https://wmts.marine.copernicus.eu/teroWmts/${dataset}?request=GetCapabilities&service=WMTS`;
}

export function parseSatelliteCapabilities(xml: string, now = Date.now(), id: SatelliteId = 'chlorophyll'): SatelliteData {
  const config = SATELLITES[id];
  if (xml.length > 1000000 || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('Invalid capabilities');
  const parser = new XMLParser({ removeNSPrefix: true, parseTagValue: false, ignoreAttributes: false, processEntities: false });
  const root = parser.parse(xml);
  const raw = root.Capabilities?.Contents?.Layer;
  const layers = Array.isArray(raw) ? raw : [raw];
  const layer = layers.find(l => l?.Identifier === config.layer);
  if (!layer) throw new Error('Missing satellite variable');
  const dimensions = Array.isArray(layer.Dimension) ? layer.Dimension : [layer.Dimension];
  const time = dimensions.find((d: { Identifier?: string }) => d?.Identifier === 'time');
  const latest = time?.Default;
  if (typeof latest !== 'string' || !isSatelliteRecent(latest, now)) throw new Error('No recent satellite observations');
  const unit = layer.Metadata?.VariableInformation?.Unit;
  if (unit !== config.sourceUnit) throw new Error('Unexpected satellite unit');
  const ranges = Array.isArray(time.Value) ? time.Value : [time.Value];
  const dates = new Set<string>();
  for (const range of ranges) {
    if (typeof range !== 'string') continue;
    const [from, to, step] = range.split('/');
    if (!to) {
      if (isSatelliteRecent(from, now)) dates.add(new Date(from).toISOString());
    } else if (step === 'P1D') {
      const start = Math.max(Date.parse(from), Date.parse(latest) - 6 * 86400000);
      for (let t = start; t <= Math.min(Date.parse(to), Date.parse(latest)); t += 86400000) {
        if (isSatelliteRecent(new Date(t).toISOString(), now)) dates.add(new Date(t).toISOString());
      }
    }
  }
  dates.add(new Date(latest).toISOString());
  return { id, layer: layer.Identifier, observedAt: new Date(latest).toISOString(), dates: [...dates].sort().reverse(), checkedAt: new Date(now).toISOString(), unit: config.unit };
}
