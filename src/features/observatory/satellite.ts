import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { isSatelliteRecent, type SatelliteData } from './data';

export const CAPABILITIES_URL = 'https://wmts.marine.copernicus.eu/teroWmts/OCEANCOLOUR_MED_BGC_L3_NRT_009_141/cmems_obs-oc_med_bgc-plankton_nrt_l3-multi-1km_P1D_202211?request=GetCapabilities&service=WMTS';

export function parseSatelliteCapabilities(xml: string, now = Date.now()): SatelliteData {
  if (xml.length > 1000000 || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('Invalid capabilities');
  const parser = new XMLParser({ removeNSPrefix: true, parseTagValue: false, ignoreAttributes: false, processEntities: false });
  const root = parser.parse(xml);
  const raw = root.Capabilities?.Contents?.Layer;
  const layers = Array.isArray(raw) ? raw : [raw];
  const layer = layers.find(l => typeof l?.Identifier === 'string' && l.Identifier.endsWith('/CHL'));
  if (!layer || !layer.Identifier.startsWith('OCEANCOLOUR_MED_BGC_L3_NRT_009_141/')) throw new Error('Missing chlorophyll');
  const dimensions = Array.isArray(layer.Dimension) ? layer.Dimension : [layer.Dimension];
  const time = dimensions.find((d: { Identifier?: string }) => d?.Identifier === 'time');
  const latest = time?.Default;
  if (typeof latest !== 'string' || !isSatelliteRecent(latest, now)) throw new Error('No recent satellite observations');
  const unit = layer.Metadata?.VariableInformation?.Unit;
  if (unit !== 'milligram m^-3') throw new Error('Unexpected chlorophyll unit');
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
  return { layer: layer.Identifier, observedAt: new Date(latest).toISOString(), dates: [...dates].sort().reverse(), checkedAt: new Date(now).toISOString(), unit: 'mg/m³' };
}
