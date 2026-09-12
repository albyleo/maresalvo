import { NextResponse } from "next/server";
import { getAisVessels } from "@/features/marine-map/data";

/**
 * Proxy AIS / monitoraggio attività di pesca.
 *
 * In produzione questa route interroga un feed AIS o l'API Global Fishing Watch
 * (https://globalfishingwatch.org/our-apis/) usando GFW_API_TOKEN, poi esegue il
 * geofencing dei punti contro i poligoni delle AMP per marcare `in_protected_area`.
 *
 * GFW richiede registrazione (gratuita per uso non commerciale). Finché il token
 * non è configurato, vengono restituiti dati di esempio.
 */
export async function GET() {
  const token = process.env.GFW_API_TOKEN;

  if (!token) {
    const vessels = await getAisVessels();
    return NextResponse.json({ source: "sample", vessels });
  }

  // TODO: chiamata reale a Global Fishing Watch + geofencing AMP.
  // const res = await fetch("https://gateway.api.globalfishingwatch.org/v3/...", {
  //   headers: { Authorization: `Bearer ${token}` },
  // });
  const vessels = await getAisVessels();
  return NextResponse.json({ source: "gfw-stub", vessels });
}
