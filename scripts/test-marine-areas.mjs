import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import clipping from 'polygon-clipping';
const areas=JSON.parse(await readFile(new URL('../src/features/marine-map/official-areas.json',import.meta.url)));
const {features}=JSON.parse(await readFile(new URL('../public/data/marine-areas.geojson',import.meta.url)));
const coords=f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
const planarArea=multi=>multi.reduce((sum,p)=>sum+p.reduce((s,r,i)=>s+(i?-1:1)*Math.abs(r.slice(1).reduce((a,v,j)=>a+r[j][0]*v[1]-v[0]*r[j][1],0)/2),0),0);
test('published catalog has a boundary for each area and every zone has a source',()=>{
  assert.ok(areas.length>=29);
  assert.equal(new Set(areas.map(a=>a.id)).size,areas.length);
  assert.equal(new Set(features.map(f=>f.properties.id)).size,features.length);
  for(const a of areas){
    assert.equal(features.filter(f=>f.properties.id===a.id).length,1);
    assert.ok(a.bounds.every(Number.isFinite));
    for(const z of a.zones){assert.match(z.source_url,/^https:/); assert.ok(features.some(f=>f.properties.id===z.id&&f.properties.area_id===a.id));}
  }
  for(const f of features) for(const polygon of coords(f)) for(const ring of polygon){
    assert.ok(ring.length>=4); assert.deepEqual(ring[0],ring.at(-1));
    assert.ok(ring.every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x)<=180&&Math.abs(y)<=90));
  }
});
test('Porto Cesareo has two A sectors, two B sectors and C with no double classification',()=>{
  const area=areas.find(a=>a.id==='EUAP0950');
  assert.equal(area.area_km2,166.54);
  assert.deepEqual(area.zones.map(z=>z.zone).sort(),['A','A','B','B','C']);
  const outer=coords(features.find(f=>f.properties.id===area.id));
  const zones=features.filter(f=>f.properties.area_id===area.id&&f.properties.kind==='zone').map(coords);
  for(let i=0;i<zones.length;i++)for(let j=i+1;j<zones.length;j++)assert.ok(planarArea(clipping.intersection(zones[i],zones[j]))<1e-9);
  const union=clipping.union(...zones);
  assert.ok(planarArea(clipping.difference(outer,union))<1e-9);
  assert.ok(planarArea(clipping.difference(union,outer))<1e-9);
});
