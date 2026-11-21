import { NextResponse } from 'next/server';
import { CAPABILITIES_URL, parseSatelliteCapabilities } from '@/features/observatory/satellite';

export async function GET() {
  try {
    const response = await fetch(CAPABILITIES_URL, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('Satellite metadata unavailable');
    const data = parseSatelliteCapabilities(await response.text());
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch {
    return NextResponse.json({ error: 'Non è possibile verificare osservazioni satellitari degli ultimi 7 giorni. Riprova tra poco o consulta la fonte ufficiale.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
