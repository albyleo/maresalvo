import { NextResponse } from 'next/server';
import { coordinates, mergeForecast, parseForecast, WAVE_UNITS, OCEAN_UNITS, WEATHER_UNITS } from '@/features/weather/forecast';
import { cityCoordinates } from '@/features/weather/locations';

export async function GET(request: Request) {
  const query=new URL(request.url).searchParams;
  const city=query.get('mode')==='city';
  const point=(city?cityCoordinates:coordinates)(query.get('lat'),query.get('lng'));
  if (!point) return NextResponse.json({error:city?'Coordinate della città non valide.':'Scegli un punto nel Mediterraneo (30–46,5° N; 6° O–37° E).'}, {status:422});
  const apiKey=process.env.OPEN_METEO_API_KEY;
  const host=apiKey?'customer-':'';
  const specs=[
    {name:'Onde · Météo-France MFWAM',url:`https://${host}marine-api.open-meteo.com/v1/marine`,model:'meteofrance_wave',units:WAVE_UNITS},
    {name:'Correnti e temperatura marina · Copernicus SMOC/SST',url:`https://${host}marine-api.open-meteo.com/v1/marine`,model:'meteofrance_currents',units:OCEAN_UNITS},
    {name:'Atmosfera · ECMWF IFS',url:`https://${host}api.open-meteo.com/v1/forecast`,model:'ecmwf_ifs025',units:WEATHER_UNITS},
  ];
  const results=await Promise.allSettled(specs.map(async (spec,index)=>{
    if(city&&index<2) return null;
    const params=new URLSearchParams({latitude:String(point.latitude),longitude:String(point.longitude),hourly:Object.keys(spec.units).join(','),models:spec.model,forecast_days:'4',timeformat:'unixtime',timezone:'GMT',wind_speed_unit:'kn',cell_selection:city?'land':'sea'});
    if(apiKey) params.set('apikey',apiKey);
    const response=await fetch(`${spec.url}?${params}`, {next:{revalidate:1800},signal:AbortSignal.timeout(12000)});
    if(!response.ok) throw new Error('Provider unavailable');
    return parseForecast(await response.json(),spec.units);
  }));
  const values=results.map(r=>r.status==='fulfilled'?r.value:null);
  const hours=mergeForecast(values[0],values[1],values[2]);
  if(!hours.length || !hours.some(h=>[h.wave,h.current,h.seaTemperature,h.wind,h.airTemperature].some(v=>v!==null))) return NextResponse.json({error:'Previsioni temporaneamente non disponibili per questo punto. Riprova più tardi.'},{status:503});
  return NextResponse.json({...point,consultedAt:new Date().toISOString(),hours,
    unavailable:results.flatMap((r,i)=>r.status==='rejected'?[specs[i].name]:[]),
    grids:values.flatMap((p,i)=>p?[{source:specs[i].name,latitude:p.latitude,longitude:p.longitude}]:[]),
  },{headers:{'Cache-Control':'no-store'}});
}
