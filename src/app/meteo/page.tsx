import { InfoDisclosure } from '@/components/ui/InfoDisclosure';
import { WeatherDashboard } from '@/features/weather/WeatherDashboard';
import { coordinates } from '@/features/weather/forecast';
import { getMarineAreas } from '@/features/marine-map/data';
export const metadata={title:'Meteo marino',description:'Previsioni per il Mediterraneo: onde, correnti, temperatura del mare e vento. Dati Copernicus Marine e ECMWF tramite Open-Meteo.'};
export default async function MeteoPage({searchParams}:{searchParams:Promise<{lat?:string;lng?:string}>}) {
  const query=await searchParams;
  const point=coordinates(query.lat??null,query.lng??null)??{latitude:40.25,longitude:17.9};
  const areas=await getMarineAreas();
  const places=areas.filter(a=>a.centroid).map(a=>({id:a.id,name:a.name,lat:a.centroid!.coordinates[1],lng:a.centroid!.coordinates[0]}));
  return <div className="pt-28 pb-16 px-4 sm:px-8 max-w-[1600px] mx-auto"><header className="flex flex-wrap justify-between items-end gap-5 mb-10"><div><p className="section-kicker">MareSalvo · Mediterraneo</p><h1 className="page-title text-4xl sm:text-6xl text-white mt-4">Meteo marino</h1><div className="mt-4"><InfoDisclosure><p className="text-sm sm:text-base text-white/55 max-w-2xl mt-3">Una vista d’insieme sul mare, un bollettino per il tuo punto. Esplora vento, onde e correnti e confronta le prossime 72 ore.</p></InfoDisclosure></div></div><p className="text-[10px] uppercase tracking-widest text-white/40">Mappa Windy <span className="mx-2 text-emerald-200/50">/</span> Previsioni Open-Meteo</p></header><WeatherDashboard key={`${point.latitude},${point.longitude}`} initial={{lat:point.latitude,lng:point.longitude}} places={places}/></div>;
}
