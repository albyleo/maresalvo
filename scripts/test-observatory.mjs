import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function compiled(path, replacements = {}) {
  let source = await readFile(new URL(path, import.meta.url), 'utf8');
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(`from '${from}'`, `from '${to}'`);
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}
const dataUrl = await compiled('../src/features/observatory/data.ts');
const protectedUrl = await compiled('../src/features/observatory/protected-areas.ts', {
  '../marine-map/config': await compiled('../src/features/marine-map/config.ts'),
  '../marine-map/zones': await compiled('../src/features/marine-map/zones.ts'),
});
const { syncProtectedLayers, protectedHit } = await import(protectedUrl);

test('AMP overlays load on demand, stay below observations and preserve environmental layers', () => {
  const sources = new Map([['observations', {}], ['satellite-0', { date: '2026-11-19' }]]);
  const layers = new Map([['satellite-0', { id: 'satellite-0' }], ['labels', { id: 'labels' }], ['observations', { id: 'observations' }]]);
  const order = [...layers.keys()];
  let sourceLoads = 0;
  const map = {
    getSource: id => sources.get(id),
    addSource: (id, source) => { assert.ok(!sources.has(id)); sources.set(id, source); sourceLoads++; },
    addLayer: (layer, before) => { assert.ok(order.includes(before)); layers.set(layer.id, structuredClone(layer)); order.splice(order.indexOf(before), 0, layer.id); },
    setLayoutProperty: (id, key, value) => { const layer = layers.get(id); (layer.layout ??= {})[key] = value; },
    setPaintProperty: (id, key, value) => { const layer = layers.get(id); (layer.paint ??= {})[key] = value; },
  };
  const satellite = sources.get('satellite-0');
  syncProtectedLayers(map, { enabled: false, zones: true, opacity: 0.2 });
  assert.equal(sourceLoads, 0);
  syncProtectedLayers(map, { enabled: true, zones: true, opacity: 0.2 });
  assert.equal(sourceLoads, 2);
  assert.equal(order.at(-1), 'observations');
  assert.ok(order.indexOf('observatory-amp-wms') > order.indexOf('satellite-0'));
  assert.equal(layers.get('observatory-amp-zones').paint['fill-opacity'], 0.2);
  syncProtectedLayers(map, { enabled: true, zones: false, opacity: 0 });
  assert.equal(layers.get('observatory-amp-zones').layout.visibility, 'none');
  assert.equal(layers.get('observatory-amp-zone-lines').layout.visibility, 'none');
  assert.equal(layers.get('observatory-amp-outlines').layout.visibility, 'visible');
  assert.equal(layers.get('observatory-amp-wms').paint['raster-opacity'], 0);
  syncProtectedLayers(map, { enabled: false, zones: true, opacity: 0.6 });
  for (const [id, layer] of layers) if (id.startsWith('observatory-amp-')) assert.equal(layer.layout.visibility, 'none');
  syncProtectedLayers(map, { enabled: true, zones: true, opacity: 0.3 });
  assert.equal(sourceLoads, 2);
  assert.equal(sources.get('satellite-0'), satellite);
  assert.equal(layers.get('observatory-amp-zones').layout.visibility, 'visible');
});

test('AMP selection prefers a specific zone over an overlapping perimeter', () => {
  const perimeter = { properties: { kind: 'boundary', area_id: 'EUAP0950' } };
  const zone = { properties: { kind: 'zone', area_id: 'EUAP0950', zone: 'A' } };
  assert.equal(protectedHit([perimeter, zone]), zone);
  assert.equal(protectedHit([perimeter]), perimeter);
  assert.equal(protectedHit([]), undefined);
});
const { surveyForTheme, satelliteView, isSatelliteRecent, isSatelliteTheme, SATELLITES, satelliteTileUrl, filterObservations } = await import(dataUrl);
const { parseSatelliteCapabilities, parseSatelliteLegend } = await import(await compiled('../src/features/observatory/satellite.ts', {
  './data': dataUrl, 'fast-xml-parser': import.meta.resolve('fast-xml-parser'),
}));
const now = Date.parse('2026-11-20T12:00:00Z');
const layer = 'OCEANCOLOUR_MED_BGC_L3_NRT_009_141/cmems_obs-oc_med_bgc-plankton_nrt_l3-multi-1km_P1D_202211/CHL';
function capabilities(date = '2026-11-19T00:00:00Z', unit = 'milligram m^-3') {
  return `<Capabilities><Contents><Layer><ows:Identifier>${layer}</ows:Identifier><Dimension><ows:Identifier>time</ows:Identifier><Default>${date}</Default><Value>2026-11-06T00:00:00.000000000Z/${date}/P1D</Value></Dimension><ows:Metadata><VariableInformation><Unit>${unit}</Unit></VariableInformation></ows:Metadata></Layer></Contents></Capabilities>`;
}
test('satellite date is observation time, never retrieval time; stale/future data are rejected', () => {
  const parsed = parseSatelliteCapabilities(capabilities(), now);
  assert.equal(parsed.observedAt, '2026-11-19T00:00:00.000Z');
  assert.equal(parsed.checkedAt, '2026-11-20T12:00:00.000Z');
  assert.ok(parsed.dates.every(d => isSatelliteRecent(d, now)));
  assert.throws(() => parseSatelliteCapabilities(capabilities('2026-11-01T00:00:00Z'), now));
  assert.throws(() => parseSatelliteCapabilities(capabilities('2026-11-21T00:00:00Z'), now));
  assert.throws(() => parseSatelliteCapabilities(capabilities('2026-11-19T00:00:00Z', 'wrong'), now));
  assert.throws(() => parseSatelliteCapabilities('<!DOCTYPE x><x/>', now));
  assert.throws(() => parseSatelliteCapabilities('<ServiceException>Unavailable</ServiceException>', now));
});
test('satellite tiles pin the verified date, projection and chlorophyll style', () => {
  const url = new URL(satelliteTileUrl(layer, '2026-11-19T00:00:00Z'));
  assert.equal(url.searchParams.get('time'), '2026-11-19T00:00:00Z');
  assert.equal(url.searchParams.get('tilematrixset'), 'EPSG:3857');
  assert.equal(url.searchParams.get('tilematrix'), '{z}');
  assert.equal(url.searchParams.get('style'), 'cmap:algae,logScale,range:0.03/30');
});
test('coastal variables keep independent dates, units and styles and never fall back to another layer', () => {
  const ids = ['coastal-chlorophyll', 'turbidity', 'suspended-matter'];
  const xml = '<Capabilities><Contents>' + ids.map((id, i) => capabilities(`2026-11-${19-i}T00:00:00Z`, SATELLITES[id].sourceUnit)
    .replace(layer, SATELLITES[id].layer).replace('<Capabilities><Contents>', '').replace('</Contents></Capabilities>', '')).join('') + '</Contents></Capabilities>';
  for (const [i, id] of ids.entries()) {
    const config = SATELLITES[id];
    const parsed = parseSatelliteCapabilities(xml, now, id);
    assert.equal(parsed.id, id);
    assert.equal(parsed.layer, config.layer);
    assert.equal(parsed.unit, config.unit);
    assert.equal(parsed.observedAt, `2026-11-${19-i}T00:00:00.000Z`);
    const url = new URL(satelliteTileUrl(parsed.layer, parsed.observedAt, config.style));
    assert.equal(url.searchParams.get('style'), config.style);
    assert.equal(url.searchParams.get('layer'), config.layer);
    assert.equal(url.searchParams.get('time'), parsed.observedAt);
    assert.throws(() => parseSatelliteCapabilities(capabilities(), now, id));
    assert.throws(() => parseSatelliteCapabilities(capabilities('2026-11-19T00:00:00Z', 'wrong').replace(layer, config.layer), now, id));
    assert.throws(() => parseSatelliteCapabilities(capabilities('2026-11-01T00:00:00Z', config.sourceUnit).replace(layer, config.layer), now, id));
  }
  assert.equal(new Set(ids.map(id => SATELLITES[id].style)).size, 3);
  assert.equal(isSatelliteTheme('turbidity'), true);
  assert.equal(isSatelliteTheme('__proto__'), false);
  assert.equal(isSatelliteTheme('beach'), false);
});
test('missing bottles stay missing, zero remains a real observation, chemical matrices stay separate', () => {
  const f = p => ({ properties: p });
  const all = [f({ bottles: 0 }), f({ bottles: null }), f({}), f({ bottles: 2 })];
  assert.deepEqual(filterObservations(all, { bottles: true, substance: '', matrix: '' }), [all[0], all[3]]);
  const chemical = [f({ substance: 'Mercurio totale', matrix: 'acqua' }), f({ substance: 'Mercurio totale', matrix: 'sedimento' })];
  assert.deepEqual(filterObservations(chemical, { bottles: false, substance: 'Mercurio totale', matrix: 'acqua' }), [chemical[0]]);
});
test('legend rejects silent provider style fallbacks and malformed colors', () => {
  for (const [id, config] of Object.entries(SATELLITES)) {
    const [valueMin, valueMax] = config.style.split('range:')[1].split('/').map(Number);
    const continuous = { valueMin, valueMax, variableId: config.layer.split('/').at(-1), cmapName: config.style.split(',')[0].slice(5),
      logScale: true, clamp: true, cmap: { colorMap: [[0, 20, 40], [200, 240, 255]] } };
    assert.deepEqual(parseSatelliteLegend({ continuous }, id), { min: valueMin, max: valueMax, colors: ['rgb(0,20,40)', 'rgb(200,240,255)'] });
    for (const invalid of [{ logScale: false }, { cmapName: 'invalid' }, { valueMin: -1 }, { variableId: 'wrong' }, { cmap: { colorMap: [[999, 0, 0], [0, 0, 0]] } }]) {
      assert.throws(() => parseSatelliteLegend({ continuous: { ...continuous, ...invalid } }, id));
    }
  }
});
test('published collections retain source/date/unit and declared campaigns, with unique ids and no contact fields', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/data/observatory/manifest.json', import.meta.url), 'utf8'));
  for (const [key, meta] of Object.entries(manifest)) {
    const raw = await readFile(new URL(`../public/data/observatory/${key}.json`, import.meta.url), 'utf8');
    const data = JSON.parse(raw);
    assert.equal(data.features.length, meta.count);
    assert.equal(new Set(data.features.map(f => f.id)).size, meta.count, `duplicate ids: ${key}`);
    assert.doesNotMatch(raw, /Surveyor|FillingMail|FillingPhone|FillingName/);
    for (const f of data.features) {
      assert.equal(f.geometry.type, 'Point');
      assert.ok(f.geometry.coordinates.every(Number.isFinite));
      assert.ok((meta.years ?? [meta.year]).some(y => f.properties.observedAt.startsWith(y)));
      assert.match(f.properties.sourceUrl, /^https:\/\//);
      for (const m of f.properties.measurements) { assert.ok(Number.isFinite(m.value) && m.value >= 0); assert.ok(m.unit); }
      if (key === 'chemicals') assert.ok(['1', '2', '6', 'provider'].includes(f.properties.quality));
      if (f.properties.provider === 'ISPRA / ARPA') {
        assert.ok(f.properties.region);
        assert.match(f.properties.sourceUrl, /^https:\/\/strategiamarina\.isprambiente\.it\//);
        assert.ok(f.properties.sourceArchive.endsWith('.zip'));
      }
    }
  }
});

test('regional campaigns can be filtered independently without dropping older sources globally', () => {
  const features = [
    { properties: { provider: 'EMODnet', observedAt: '2023-07-04' } },
    { properties: { provider: 'ISPRA / ARPA', region: 'Puglia', observedAt: '2024-10-10' } },
    { properties: { provider: 'ISPRA / ARPA', region: 'Veneto', observedAt: '2024-06-10' } },
  ];
  const filters = { bottles: false, substance: '', matrix: '' };
  assert.equal(filterObservations(features, filters).length, 3);
  assert.deepEqual(filterObservations(features, { ...filters, region: 'Puglia' }), [features[1]]);
  assert.deepEqual(filterObservations(features, { ...filters, year: '2023' }), [features[0]]);
  assert.deepEqual(filterObservations(features, { ...filters, provider: 'ISPRA / ARPA', region: 'Veneto' }), [features[2]]);
});

test('field measurements use independent collections and never replace a satellite variable silently', () => {
  assert.equal(surveyForTheme('turbidity', false), null);
  assert.equal(surveyForTheme('turbidity', true), 'turbidity-samples');
  assert.equal(surveyForTheme('suspended-matter', true), 'suspended-matter-samples');
  assert.equal(surveyForTheme('chlorophyll', true), null);
  assert.equal(surveyForTheme('beach', false), 'beach');
});

test('Italian coverage includes all coastal regions overall and field units remain explicit', async () => {
  const report = JSON.parse(await readFile(new URL('../public/data/observatory/italian-sources.json', import.meta.url), 'utf8'));
  assert.equal(new Set(Object.values(report.ispra.coverage).flatMap(c => Object.keys(c))).size, 15);
  for (const id of ['turbidity-samples', 'suspended-matter-samples']) {
    const data = JSON.parse(await readFile(new URL(`../public/data/observatory/${id}.json`, import.meta.url), 'utf8'));
    assert.ok(data.features.length > 0);
    for (const f of data.features) {
      assert.equal(f.properties.measurements[0].unit, id === 'suspended-matter-samples' ? 'mg/L' : f.properties.region === 'Lazio' ? 'NTU' : 'FTU');
      const [lon, lat] = f.geometry.coordinates;
      assert.ok(lon > 9 && lon < 16 && lat > 39 && lat < 46);
      if (id === 'turbidity-samples' && f.properties.depth !== undefined) assert.ok(f.properties.depth <= 1);
    }
    const regions = [...new Set(data.features.map(f => f.properties.region))].sort();
    assert.deepEqual(regions, id === 'turbidity-samples' ? ['Campania', 'Lazio', 'Veneto'] : ['Abruzzo', 'Toscana', 'Veneto']);
    assert.equal(data.metadata.regionalCoverage.length, 15);
    assert.equal(data.metadata.regionalCoverage.reduce((n, r) => n + r.count, 0), data.features.length);
    assert.equal(new Set(data.features.map(f => f.id)).size, data.features.length);
    assert.deepEqual(data.metadata.years, [...new Set(data.features.map(f => f.properties.observedAt.slice(0, 4)))].sort().reverse());
  }
});

test('combined chlorophyll uses one date and scale, coastal overlay last, and handles partial outages', () => {
  const basin = { layer: SATELLITES.chlorophyll.layer, dates: ['2026-11-20', '2026-11-19'] };
  const coast = { layer: SATELLITES['coastal-chlorophyll'].layer, dates: ['2026-11-19', '2026-11-18'] };
  const data = { chlorophyll: basin, 'coastal-chlorophyll': coast };
  const combined = satelliteView('chlorophyll', data, '');
  assert.equal(combined.date, '2026-11-19');
  assert.deepEqual(combined.rasters.map(r => r.layer), [basin.layer, coast.layer]);
  assert.equal(new Set(combined.rasters.map(r => r.style)).size, 1);
  assert.equal(satelliteView('chlorophyll', data, '2026-11-20').rasters.length, 1);
  assert.equal(satelliteView('chlorophyll', { 'coastal-chlorophyll': coast }, '').rasters[0].layer, coast.layer);
  assert.deepEqual(satelliteView('chlorophyll', {}, '').rasters, []);
  assert.deepEqual(satelliteView('beach', data, '').rasters, []);
});
