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
const { satelliteView, isSatelliteRecent, isSatelliteTheme, SATELLITES, satelliteTileUrl, filterObservations } = await import(dataUrl);
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
test('published collections retain source/date/unit and only one campaign, with unique ids and no contact fields', async () => {
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
      assert.ok(f.properties.observedAt.startsWith(meta.year));
      assert.match(f.properties.sourceUrl, /^https:\/\//);
      for (const m of f.properties.measurements) { assert.ok(Number.isFinite(m.value) && m.value >= 0); assert.ok(m.unit); }
      if (key === 'chemicals') assert.ok(['1', '2', '6'].includes(f.properties.quality));
    }
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
