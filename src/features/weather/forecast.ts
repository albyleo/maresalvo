/** Pure validation/normalisation shared by the route and offline tests. Times are UTC Unix seconds. */
export type ForecastHour = { time: number; wave: number | null; waveDirection: number | null; period: number | null; current: number | null; currentDirection: number | null; seaTemperature: number | null; airTemperature: number | null; wind: number | null; windDirection: number | null; gust: number | null; rain: number | null };
export type Forecast = { latitude: number; longitude: number; consultedAt: string; hours: ForecastHour[]; unavailable: string[]; grids: { source: string; latitude: number; longitude: number }[] };
type Payload = { latitude: number; longitude: number; hourly: Record<string, (number | null)[]>; hourly_units: Record<string,string> };
export function coordinates(lat: string | null, lng: string | null) {
  if (!lat?.trim() || !lng?.trim()) return null;
  const latitude = Number(lat), longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude<30 || latitude>46.5 || longitude< -6 || longitude>37) return null;
  return { latitude: Math.round(latitude*100)/100, longitude: Math.round(longitude*100)/100 };
}
export function parseForecast(value: unknown, units: Record<string,string>): Payload {
  if (!value || typeof value!=='object') throw new Error('Invalid forecast');
  const p=value as Payload;
  if (!Number.isFinite(p.latitude) || !Number.isFinite(p.longitude) || !Array.isArray(p.hourly?.time) || !p.hourly.time.length || p.hourly_units?.time!=='unixtime') throw new Error('Missing forecast time');
  if (!p.hourly.time.every((t,i) => typeof t==='number' && Number.isFinite(t) && (i===0 || t>p.hourly.time[i-1]!))) throw new Error('Unordered forecast');
  for (const [key,unit] of Object.entries(units)) {
    const values=p.hourly[key];
    if (p.hourly_units[key]!==unit || !Array.isArray(values) || values.length!==p.hourly.time.length || !values.every(v=>v===null || (typeof v==='number' && Number.isFinite(v)))) throw new Error('Invalid forecast units or values');
  }
  return p;
}
export const WAVE_UNITS = { wave_height:'m', wave_direction:'°', wave_period:'s' };
export const OCEAN_UNITS = { ocean_current_velocity:'kn', ocean_current_direction:'°', sea_surface_temperature:'°C' };
export const WEATHER_UNITS = { temperature_2m:'°C', wind_speed_10m:'kn', wind_direction_10m:'°', wind_gusts_10m:'kn', precipitation:'mm' };
export function mergeForecast(waves: Payload | null, ocean: Payload | null, weather: Payload | null, now = Date.now()): ForecastHour[] {
  const maps = [waves,ocean,weather].map(p => new Map(p?.hourly.time.map((t,i)=>[t,i]) ?? []));
  const times=[...new Set([waves,ocean,weather].flatMap(p=>p?.hourly.time as number[] ?? []))].sort((a,b)=>a-b);
  const field=(p: Payload|null,index: number,key:string,time:number) => { const i=maps[index].get(time); return p && i!==undefined ? p.hourly[key]?.[i] ?? null : null; };
  return times.filter(time=>time>=Math.floor(now/3600000)*3600 && time<(Math.floor(now/3600000)+72)*3600).map(time=>({ time,
    wave:field(waves,0,'wave_height',time), waveDirection:field(waves,0,'wave_direction',time), period:field(waves,0,'wave_period',time),
    current:field(ocean,1,'ocean_current_velocity',time), currentDirection:field(ocean,1,'ocean_current_direction',time), seaTemperature:field(ocean,1,'sea_surface_temperature',time),
    airTemperature:field(weather,2,'temperature_2m',time), wind:field(weather,2,'wind_speed_10m',time), windDirection:field(weather,2,'wind_direction_10m',time), gust:field(weather,2,'wind_gusts_10m',time), rain:field(weather,2,'precipitation',time),
  }));
}
