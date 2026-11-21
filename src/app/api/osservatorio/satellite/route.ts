import { NextResponse } from 'next/server';
import { capabilitiesUrl, legendUrl, parseSatelliteCapabilities, parseSatelliteLegend } from '@/features/observatory/satellite';
import { isSatelliteTheme } from '@/features/observatory/data';

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('theme') ?? 'chlorophyll';
  if (!isSatelliteTheme(id)) return NextResponse.json({ error: 'Livello satellitare non valido.' }, { status: 400 });
  try {
    const [response, legend] = await Promise.all([
      fetch(capabilitiesUrl(id), { next: { revalidate: 3600 }, signal: AbortSignal.timeout(12000) }),
      fetch(legendUrl(id), { next: { revalidate: 3600 }, signal: AbortSignal.timeout(12000) }),
    ]);
    if (!response.ok || !legend.ok) throw new Error('Satellite metadata unavailable');
    const data = parseSatelliteCapabilities(await response.text(), Date.now(), id);
    data.legend = parseSatelliteLegend(await legend.json(), id);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch {
    return NextResponse.json({ error: 'Non è possibile verificare osservazioni satellitari degli ultimi 7 giorni. Riprova tra poco o consulta la fonte ufficiale.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
