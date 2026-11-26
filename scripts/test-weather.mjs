import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const moduleUrl=async (path,replacements={})=>{
  let source=await readFile(new URL(path,import.meta.url),'utf8');
  for(const [from,to] of Object.entries(replacements)) source=source.replaceAll(`from '${from}'`,`from '${to}'`);
  const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
};
const load=async path=>import(await moduleUrl(path));
const {coordinates,parseForecast,mergeForecast,WAVE_UNITS,OCEAN_UNITS,WEATHER_UNITS}=await load('../src/features/weather/forecast.ts');
const {cityCoordinates,parseLocations}=await load('../src/features/weather/locations.ts');
const {GUIDANCE,ACTIVITIES,areaRule}=await load('../src/features/marine-map/guidance.ts');
const start=Date.parse('2026-11-20T12:00:00Z')/1000;
function payload(units,times){return {latitude:40.25,longitude:17.9,hourly_units:{time:'unixtime',...units},hourly:{time:times,...Object.fromEntries(Object.keys(units).map(key=>[key,times.map(()=>1)]))}};}

test('city search preserves homonyms, rejects malformed coordinates and excludes non-populated places',()=>{
  const genoa={id:1,name:'Genova',admin1:'Liguria',country:'Italia',latitude:44.4056,longitude:8.9463,feature_code:'PPLA'};
  const result=parseLocations({results:[genoa,{...genoa,id:2,country:'Altro Paese'},genoa,{...genoa,id:3,latitude:91},{...genoa,id:4,feature_code:'MT'},{...genoa,id:5,longitude:'8.9'}]});
  assert.equal(result.length,2);
  assert.equal(result[0].label,'Genova · Liguria · Italia');
  assert.equal(result[0].lat,44.41);
  assert.notEqual(result[0].label,result[1].label);
  assert.deepEqual(parseLocations({}),[]);
  assert.throws(()=>parseLocations({error:true}));
  assert.throws(()=>parseLocations({results:{}}));
  assert.deepEqual(cityCoordinates('-33.8688','151.2093'),{latitude:-33.87,longitude:151.21});
  assert.equal(coordinates('-33.8688','151.2093'),null);
  for(const pair of [[null,null],['','0'],['NaN','0'],['91','0'],['0','181']])assert.equal(cityCoordinates(...pair),null);
});

test('forecast route separates city land cells from marine models and handles failures',async()=>{
  const {GET}=await import(await moduleUrl('../src/app/api/weather/route.ts',{
    'next/server':import.meta.resolve('next/server.js'),
    '@/features/weather/forecast':await moduleUrl('../src/features/weather/forecast.ts'),
    '@/features/weather/locations':await moduleUrl('../src/features/weather/locations.ts'),
  }));
  const original=globalThis.fetch;
  const calls=[];
  const time=Math.floor(Date.now()/3600000)*3600;
  try{
    globalThis.fetch=async url=>{
      const u=new URL(url);calls.push(u);
      const units=u.searchParams.get('models')==='meteofrance_wave'?WAVE_UNITS:u.searchParams.get('models')==='meteofrance_currents'?OCEAN_UNITS:WEATHER_UNITS;
      return Response.json(payload(units,[time,time+3600]));
    };
    let response=await GET(new Request('http://localhost/api/weather?mode=city&lat=-33.87&lng=151.21'));
    assert.equal(response.status,200);
    const city=await response.json();
    assert.equal(calls.length,1);assert.equal(calls[0].searchParams.get('cell_selection'),'land');
    assert.equal(city.hours[0].wave,null);assert.equal(city.hours[0].current,null);assert.equal(city.hours[0].wind,1);
    assert.deepEqual(city.unavailable,[]);assert.equal(city.grids.length,1);
    calls.length=0;
    response=await GET(new Request('http://localhost/api/weather?lat=40.25&lng=17.9'));
    assert.equal(response.status,200);assert.equal(calls.length,3);
    assert.ok(calls.every(u=>u.searchParams.get('cell_selection')==='sea'));
    calls.length=0;
    response=await GET(new Request('http://localhost/api/weather?mode=city&lat=91&lng=0'));
    assert.equal(response.status,422);assert.equal(calls.length,0);
    globalThis.fetch=async()=>{throw new Error('Offline');};
    response=await GET(new Request('http://localhost/api/weather?mode=city&lat=44&lng=8'));
    assert.equal(response.status,503);
  }finally{globalThis.fetch=original;}
});

test('city lookup route validates input and encodes searches without changing upstream parameters',async()=>{
  const {GET}=await import(await moduleUrl('../src/app/api/weather/locations/route.ts',{
    'next/server':import.meta.resolve('next/server.js'),
    '@/features/weather/locations':await moduleUrl('../src/features/weather/locations.ts'),
  }));
  const original=globalThis.fetch;
  let called=0;
  try{
    globalThis.fetch=async url=>{
      called++;
      const u=new URL(url);
      assert.equal(u.searchParams.get('name'),'Genova &count=100');
      assert.equal(u.searchParams.get('count'),'20');assert.equal(u.searchParams.get('language'),'it');
      return Response.json({});
    };
    assert.equal((await GET(new Request('http://localhost/api/weather/locations?q=a'))).status,422);
    assert.equal(called,0);
    const response=await GET(new Request('http://localhost/api/weather/locations?q=Genova%20%26count%3D100'));
    assert.deepEqual(await response.json(),{results:[]});assert.equal(called,1);
    globalThis.fetch=async()=>new Response('',{status:429});
    assert.equal((await GET(new Request('http://localhost/api/weather/locations?q=Genova'))).status,503);
  }finally{globalThis.fetch=original;}
});
test('invalid/empty/out-of-region coordinates are rejected and valid requests share rounded cache points',()=>{
  for(const [lat,lng] of [[null,null],['',''],[' ','17'],['NaN','17'],['Infinity','17'],['29','17'],['40','38']])assert.equal(coordinates(lat,lng),null);
  assert.deepEqual(coordinates('40.254','17.904'),{latitude:40.25,longitude:17.9});
});
test('provider schema and units prevent mislabelled current speeds and time',()=>{
  const p=payload(OCEAN_UNITS,[start]);
  assert.equal(parseForecast(p,OCEAN_UNITS),p);
  p.hourly_units.ocean_current_velocity='km/h';assert.throws(()=>parseForecast(p,OCEAN_UNITS));
  p.hourly_units.ocean_current_velocity='kn';p.hourly.time=[start,start];assert.throws(()=>parseForecast(p,OCEAN_UNITS));
  p.hourly.time=[start];p.hourly.sea_surface_temperature=[Infinity];assert.throws(()=>parseForecast(p,OCEAN_UNITS));
  p.hourly.sea_surface_temperature=[];assert.throws(()=>parseForecast(p,OCEAN_UNITS));
});
test('forecast aligns different model timestamps, retains zero and never fills missing values with calm seas',()=>{
  const waves=payload(WAVE_UNITS,[start,start+3600]);waves.hourly.wave_height=[0,null];
  const ocean=payload(OCEAN_UNITS,[start+3600,start+7200]);ocean.hourly.sea_surface_temperature=[19,20];
  const rows=mergeForecast(parseForecast(waves,WAVE_UNITS),parseForecast(ocean,OCEAN_UNITS),null,start*1000);
  assert.equal(rows[0].wave,0);assert.equal(rows[0].seaTemperature,null);assert.equal(rows[1].wave,null);assert.equal(rows[1].seaTemperature,19);assert.equal(rows[2].seaTemperature,20);assert.equal(rows[2].wind,null);
  assert.deepEqual(mergeForecast(null,null,null),[]);
});
test('forecast contains precisely 72 hourly slots across DST or non-hour retrieval time',()=>{
  const waves=payload(WAVE_UNITS,Array.from({length:100},(_,i)=>start+(i-3)*3600));
  const rows=mergeForecast(waves,null,null,start*1000+1800000);
  assert.equal(rows.length,72);assert.equal(rows[0].time,start);assert.equal(rows.at(-1).time,start+71*3600);
});
test('area-specific rules have explicit provenance and cannot turn missing guidance into permission',async()=>{
  const areas=JSON.parse(await readFile(new URL('../src/features/marine-map/official-areas.json',import.meta.url)));
  for(const [id,guide] of Object.entries(GUIDANCE)) {
    const area=areas.find(a=>a.id===id);assert.ok(area);
    const pairs=new Set();
    for(const r of guide.rules){
      assert.ok(ACTIVITIES[r.activity]);assert.ok(guide.sources[r.source]);
      for(const zone of r.zones){assert.ok(area.zones.some(z=>z.zone===zone));const key=`${zone}:${r.activity}`;assert.ok(!pairs.has(key));pairs.add(key);}
    }
    for(const source of guide.sources){assert.match(source.url,/^https:\/\//);assert.match(source.consulted,/^\d{4}-\d{2}-\d{2}$/);assert.ok(source.edition);}
  }
  assert.equal(areaRule('unknown','C','fishing'),undefined);
  assert.equal(areaRule('EUAP0950','C','fishing'),undefined);
  assert.match(areaRule('EUAP0951','B','fishing').note,/residenti/);
});
