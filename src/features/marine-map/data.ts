import type {
  MarineProtectedArea,
  GhostNetReport,
  AisVesselPoint,
  IllegalFishingReport,
} from "@/types";

import officialAreas from './official-areas.json';

/** Published cartographic catalog, independent of CRM development seed data. */
export async function getMarineAreas(): Promise<MarineProtectedArea[]> {
  return officialAreas as MarineProtectedArea[];
}
/** Reti perse di esempio (sostituite dai dati Supabase quando configurato). */
export const SAMPLE_GHOST_NETS: GhostNetReport[] = [
  {
    id: "g1",
    reporter_id: null,
    status: "reported",
    gear_type: "net",
    lat: 44.31,
    lng: 9.22,
    depth_m: 18,
    description: "Rete da posta abbandonata su parete rocciosa.",
    photo_url: null,
    reported_at: "2026-06-20T09:30:00Z",
    recovered_at: null,
  },
  {
    id: "g2",
    reporter_id: null,
    status: "verified",
    gear_type: "trap",
    lat: 37.02,
    lng: 15.31,
    depth_m: 25,
    description: "Nassa con boa rotta, segnalata da diver locale.",
    photo_url: null,
    reported_at: "2026-06-15T14:10:00Z",
    recovered_at: null,
  },
  {
    id: "g3",
    reporter_id: null,
    status: "recovered",
    gear_type: "longline",
    lat: 40.73,
    lng: 17.79,
    depth_m: 12,
    description: "Palamito recuperato durante intervento del circolo.",
    photo_url: null,
    reported_at: "2026-05-30T07:45:00Z",
    recovered_at: "2026-06-10T11:00:00Z",
  },
];

export async function getGhostNets(): Promise<GhostNetReport[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return SAMPLE_GHOST_NETS;
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ghost_net_reports")
      .select("id,reporter_id,status,gear_type,lat,lng,depth_m,description,photo_url,reported_at,recovered_at")
      .order("reported_at", { ascending: false });
    if (error || !data?.length) return [];
    return data as GhostNetReport[];
  } catch {
    return [];
  }
}

/**
 * Posizioni AIS di esempio. In produzione questa funzione interroga
 * /api/ais (proxy verso Global Fishing Watch o feed AIS) e marca
 * is_fishing / in_protected_area tramite geofencing sulle AMP.
 */
export const SAMPLE_AIS: AisVesselPoint[] = [
  {
    mmsi: "247000000",
    name: "Demo Trawler 1",
    lat: 44.29,
    lng: 9.18,
    speed_kn: 2.1,
    course: 120,
    is_fishing: true,
    in_protected_area: true,
    timestamp: "2026-06-28T08:00:00Z",
  },
  {
    mmsi: "247000001",
    name: "Demo Vessel 2",
    lat: 37.05,
    lng: 15.28,
    speed_kn: 8.4,
    course: 45,
    is_fishing: false,
    in_protected_area: false,
    timestamp: "2026-06-28T08:00:00Z",
  },
];

export async function getAisVessels(): Promise<AisVesselPoint[]> {
  // Hook: collegare Global Fishing Watch / feed AIS via /api/ais.
  return SAMPLE_AIS;
}

export const SAMPLE_ILLEGAL_REPORTS: IllegalFishingReport[] = [
  {
    id: "i1",
    source: "ais_geofence",
    status: "open",
    area_id: "1",
    vessel_name: "Demo Trawler 1",
    mmsi: "247000000",
    lat: 44.29,
    lng: 9.18,
    description: "Imbarcazione AIS con comportamento di pesca dentro zona A.",
    detected_at: "2026-06-28T08:05:00Z",
  },
  {
    id: "i2",
    source: "citizen",
    status: "under_review",
    area_id: "4",
    vessel_name: null,
    mmsi: null,
    lat: 40.71,
    lng: 17.77,
    description: "Segnalazione cittadina: pesca subacquea notturna sospetta.",
    detected_at: "2026-06-27T22:40:00Z",
  },
];

export async function getIllegalReports(): Promise<IllegalFishingReport[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return SAMPLE_ILLEGAL_REPORTS;
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("illegal_fishing_reports")
      .select("*")
      .order("detected_at", { ascending: false });
    if (error || !data?.length) return SAMPLE_ILLEGAL_REPORTS;
    return data as IllegalFishingReport[];
  } catch {
    return SAMPLE_ILLEGAL_REPORTS;
  }
}
