import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import clipping from 'polygon-clipping';

// Reproducible import of published geometries. No invented boundaries for missing zones.
const sources = {
  italy: 'https://ows.emodnet-humanactivities.eu/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=emodnet:cddaareas&outputFormat=application/json&srsName=EPSG:4326&count=1000&CQL_FILTER=cddacountr%3D%27IT%27',
  sardinia: 'https://webgis.regione.sardegna.it/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=dbu:areemarineprotette&outputFormat=application/json&srsName=EPSG:4326&count=1000',
  milazzo: 'https://map.sitr.regione.sicilia.it/orbs/rest/services/aree_protette/aree_marine_protette/MapServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson',
};
const cacheNames = { italy: 'maresalvo-italy-areas.json', sardinia: 'maresalvo-sardinia-zones.json', milazzo: 'maresalvo-sicily-0.json' };
const data = {};
for (const [key, url] of Object.entries(sources)) {
  if (process.argv.includes('--cached')) data[key] = JSON.parse(await readFile(join(tmpdir(), cacheNames[key]), 'utf8'));
  else {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`${key}: ${response.status}`);
    data[key] = await response.json();
  }
  if (!data[key].features?.length || data[key].numberMatched > data[key].features.length || data[key].exceededTransferLimit) throw new Error(`Incomplete source: ${key}`);
}
const sourcePage = 'https://emodnet.ec.europa.eu/en/human-activities';
const decree = 'https://www.gazzettaufficiale.it/atto/serie_generale/caricaDettaglioAtto/originario?atto.codiceRedazionale=098A1390&atto.dataPubblicazioneGazzetta=1998-02-24&elenco30giorni=false';
const regions = {
  Liguria: ['EUAP0948','EUAP0949','EUAP0911'], Puglia: ['EUAP0168','EUAP0950','EUAP0169'],
  Campania: ['EUAP0946','EUAP0917','EUAP1225','EUAP1228'], Calabria: ['EUAP0166'],
  Sicilia: ['EUAP0172','EUAP0171','EUAP0170','EUAP0555','EUAP0553','EUAP0512','EUAP1233'],
  Sardegna: ['EUAP0952','EUAP0951','EUAP0953','EUAP0554','EUAP0552','EUAP1230'],
  Lazio: ['EUAP0947','EUAP1172'], Abruzzo: ['EUAP1226'], Toscana: ['EUAP1227'],
  'Friuli-Venezia Giulia': ['EUAP0167'],
};
const bounds = geometry => {
  const points = geometry.coordinates.flat(geometry.type === 'MultiPolygon' ? 2 : 1);
  return points.reduce((b, [x,y]) => [Math.min(b[0],x),Math.min(b[1],y),Math.max(b[2],x),Math.max(b[3],y)], [Infinity,Infinity,-Infinity,-Infinity]);
};
const slugify = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const areas = [], features = [];
for (const f of data.italy.features.filter(f => f.properties.designatio === 'IT90')) {
  const p = f.properties, code = p.nationalid, box = bounds(f.geometry);
  const name = p.sitename.replace(/^(Area (naturale )?marina protetta|Riserva naturale marina) /i,'');
  const area = {
    id: code, name, slug: slugify(name), area_type: 'amp',
    region_name: Object.entries(regions).find(([,codes]) => codes.includes(code))?.[0] ?? 'Italia',
    managing_body: null, description: 'Area marina protetta. Il perimetro deriva dal catalogo nazionale CDDA pubblicato da EMODnet; i regimi di tutela dipendono dalle zone e dal regolamento locale.',
    regulation_url: null, fishing_status: 'unknown', fishing_notes: 'Le condizioni di pesca dipendono dalla zona, dalle autorizzazioni e dalle ordinanze dell’ente gestore.',
    seasonality: null, area_km2: p.sitearea / 100, centroid: {type:'Point',coordinates:[(box[0]+box[2])/2,(box[1]+box[3])/2]}, bounds: box,
    source_url: sourcePage, source_label:'EMODnet / EEA CDDA', source_date:p.versionid, zones:[],
  };
  areas.push(area);
  features.push({type:'Feature',geometry:f.geometry,properties:{area_id:code,name,kind:'boundary',zone:'',id:code}});
}
function addZone(areaId, id, zone, name, geometry, label, url, notes) {
  const area = areas.find(a => a.id === areaId);
  if (!area || !['A','B','Bs','C','D'].includes(zone)) throw new Error(`Unmapped zone ${id}`);
  area.zones.push({id,zone,name,source_label:label,source_url:url,notes});
  features.push({type:'Feature',geometry,properties:{id,area_id:areaId,name:area.name,kind:'zone',zone,zone_name:name}});
}
for (const f of data.sardinia.features) addZone(f.properties.codice.trim(), `sardinia-${f.id}`, f.properties.zona.trim(), f.properties.toponimo.trim(), f.geometry,
  'Regione Sardegna · dati indicativi', 'https://webgis.regione.sardegna.it/geoserver/ows?service=WFS&version=2.0.0&request=GetCapabilities', 'Zonazione pubblicata dal servizio regionale come dato indicativo; verificare il decreto e gli aggiornamenti dell’ente gestore.');
for (const f of data.milazzo.features) addZone('EUAP1233', `milazzo-${f.properties.OBJECTID_1}`, f.properties.zona, `Capo Milazzo · zona ${f.properties.zona}`, f.geometry,
  'Regione Siciliana · SITR', 'https://www.sitr.regione.sicilia.it/download/tematismi/parchi-riserve-e-aree-marine-protette/', 'Cartografia regionale informativa; fa fede il decreto di approvazione.');

// Porto Cesareo: decimal-minute vertices transcribed from DM 12/12/1997 art. 4.
// Clip against the published coastal perimeter; C is the remainder, not an overlapping fill.
const porto = areas.find(a => a.id === 'EUAP0950');
const outer = features.find(f => f.properties.area_id === porto.id).geometry;
const outerCoords = outer.type === 'Polygon' ? [outer.coordinates] : outer.coordinates;
const ring = pairs => { const coords = pairs.map(([lat,lon]) => [17+lon/60,40+lat/60]); return [[...coords,coords[0]]]; };
const portoParts = [
  ['A','Torre Sant’Isidoro – Casa Giorgella',[[13,55.38],[13,54.89],[11.48,54.89],[11.48,55.19]]],
  ['A','Penisola della Strea',[[14.18,54.45],[14.15,54.22],[14.66,53.44],[14.90,53.73]]],
  ['B','Settore Punta Prosciutto',[[14.32,43.40],[11.44,45.91],[16.10,45.91],[16.10,44.82]]],
  ['B','Settore Torre Sant’Isidoro',[[13,54.89],[11.48,54.89],[11.48,51.81],[13,51.81]]],
];
const exclusions=[];
for (const [i,[zone,name,points]] of portoParts.entries()) {
  const geometry = {type:'MultiPolygon',coordinates:clipping.intersection(outerCoords,ring(points))};
  if (!geometry.coordinates.length) throw new Error(`Empty Porto Cesareo zone ${name}`);
  exclusions.push(geometry.coordinates);
  addZone(porto.id,`porto-${i}`,zone,name,geometry,'Ricostruzione da DM 12/12/1997',decree,'Elaborazione delle coordinate del decreto con costa CDDA: rappresentazione indicativa, non rilievo nautico.');
}
addZone(porto.id,'porto-c','C','Restante area della riserva',{type:'MultiPolygon',coordinates:clipping.difference(outerCoords,...exclusions)},'Ricostruzione da DM 12/12/1997',decree,'Area residua dopo l’esclusione delle zone A e B. Verificare regolamento e ordinanze vigenti.');
porto.regulation_url = 'https://www.gazzettaufficiale.it/eli/gu/2010/01/02/1/sg/pdf';
porto.description = 'AMP lungo circa 32 km di costa tra Punta Prosciutto e Torre Inserraglio. Comprende due settori A, due settori B e la restante zona C. Superficie dichiarata: 166,54 km².';
porto.managing_body = 'Consorzio di gestione AMP Porto Cesareo';
porto.fishing_status = 'restricted';
areas.sort((a,b) => a.name.localeCompare(b.name,'it'));
await mkdir(new URL('../public/data/',import.meta.url),{recursive:true});
await writeFile(new URL('../public/data/marine-areas.geojson',import.meta.url),JSON.stringify({type:'FeatureCollection',features}));
await writeFile(new URL('../src/features/marine-map/official-areas.json',import.meta.url),JSON.stringify(areas,null,2)+'\n');
await writeFile(new URL('../public/data/marine-sources.json',import.meta.url),JSON.stringify({retrieved_at:new Date().toISOString(),sources,area_count:areas.length,zone_count:features.length-areas.length,coverage:'Italian IT90 marine protected areas in the CDDA source; partial internal zoning. WMS supplies additional international boundaries.'},null,2)+'\n');
console.log(`${areas.length} areas, ${features.length-areas.length} zones, ${areas.filter(a=>a.zones.length).length} zoned areas.`);
