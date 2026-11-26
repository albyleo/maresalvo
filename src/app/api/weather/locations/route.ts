import { NextResponse } from 'next/server';
import { parseLocations } from '@/features/weather/locations';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length < 2 || query.length > 100) return NextResponse.json({ error: 'Inserisci da 2 a 100 caratteri.' }, { status: 422 });
  const key = process.env.OPEN_METEO_API_KEY;
  const params = new URLSearchParams({ name: query, count: '20', language: 'it', format: 'json' });
  if (key) params.set('apikey', key);
  try {
    const response = await fetch(`https://${key ? 'customer-' : ''}geocoding-api.open-meteo.com/v1/search?${params}`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Location service unavailable');
    return NextResponse.json({ results: parseLocations(await response.json()) });
  } catch {
    return NextResponse.json({ error: 'Ricerca delle città temporaneamente non disponibile. Riprova tra poco.' }, { status: 503 });
  }
}
