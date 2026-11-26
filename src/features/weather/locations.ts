export interface WeatherLocation { id: number; name: string; label: string; lat: number; lng: number }

export function cityCoordinates(lat: string | null, lng: string | null) {
  if (!lat?.trim() || !lng?.trim()) return null;
  const latitude = Number(lat), longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude: Math.round(latitude * 100) / 100, longitude: Math.round(longitude * 100) / 100 };
}

export function parseLocations(value: unknown): WeatherLocation[] {
  if (!value || typeof value !== 'object' || 'error' in value) throw new Error('Invalid location response');
  const results = 'results' in value ? value.results : [];
  if (!Array.isArray(results)) throw new Error('Invalid locations');
  const seen = new Set<number>();
  return results.flatMap((item: unknown): WeatherLocation[] => {
    if (!item || typeof item !== 'object') return [];
    const p = item as Record<string, unknown>;
    if (typeof p.id !== 'number' || !Number.isSafeInteger(p.id) || seen.has(p.id) || typeof p.name !== 'string' || !p.name.trim() ||
      typeof p.latitude !== 'number' || typeof p.longitude !== 'number' || typeof p.feature_code !== 'string' || !p.feature_code.startsWith('PPL')) return [];
    const point = cityCoordinates(String(p.latitude), String(p.longitude));
    if (!point) return [];
    seen.add(p.id);
    const parts = [p.name, p.admin1, p.country].filter((part): part is string => typeof part === 'string' && Boolean(part.trim())).map(part => part.trim().slice(0, 120));
    return [{ id: p.id, name: p.name.trim().slice(0, 120), label: [...new Set(parts)].join(' · '), lat: point.latitude, lng: point.longitude }];
  }).slice(0, 10);
}
