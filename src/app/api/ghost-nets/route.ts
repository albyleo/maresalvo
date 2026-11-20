import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPublicGhostNets } from '@/features/marine-map/data';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

const reportSchema = z.object({
  gear_type: z.enum(['net','longline','trap','rope','other']),
  lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180),
  depth_m: z.number().int().min(0).max(12000).nullable(),
  discovery_method: z.enum(['dive','snorkel','fishing','sonar','rov','other']),
  observed_at: z.string().datetime({ offset: true }),
  description: z.string().trim().min(20).max(2000),
  evidence_url: z.string().url().max(2000).startsWith('https://').nullable(),
  report_id: z.string().uuid().nullable(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!url.searchParams.has('lat')) return NextResponse.json(await getPublicGhostNets(), { headers: { 'Cache-Control': 'private, no-store' } });
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Servizio non configurato.' }, { status: 503 });
  const lat = Number(url.searchParams.get('lat')), lng = Number(url.searchParams.get('lng'));
  if (!url.searchParams.get('lat') || !url.searchParams.get('lng') || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat)>90 || Math.abs(lng)>180)
    return NextResponse.json({ error: 'Coordinate non valide.' }, { status: 422 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Accedi per continuare.' }, { status: 401 });
  const { data, error } = await supabase.rpc('nearby_ghost_nets', { p_lat: lat, p_lng: lng });
  if (error) return NextResponse.json({ error: error.code === '42501' ? 'Account non abilitato.' : 'Ricerca non disponibile. Riprova più tardi.' }, { status: error.code === '42501' ? 403 : 503 });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Servizio non configurato. Nessun dato salvato.' }, { status: 503 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Accedi per inviare una segnalazione.' }, { status: 401 });
  const { data: allowed, error: permissionError } = await supabase.rpc('can_report_ghost_net');
  if (permissionError) return NextResponse.json({ error: 'Segnalazioni in preparazione. Nessun dato salvato.' }, { status: 503 });
  if (!allowed) return NextResponse.json({ error: 'Il tuo account deve essere abilitato dallo staff.' }, { status: 403 });
  const parsed = reportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Controlla coordinate, data e descrizione (almeno 20 caratteri).' }, { status: 422 });
  const value = parsed.data;
  const { data, error } = await supabase.rpc('submit_ghost_net_observation', {
    p_gear: value.gear_type, p_lat: value.lat, p_lng: value.lng, p_depth: value.depth_m,
    p_method: value.discovery_method, p_observed_at: value.observed_at, p_description: value.description,
    p_evidence_url: value.evidence_url, p_report_id: value.report_id,
  });
  if (error) {
    const known = ['23505','22023','42501','P0001'].includes(error.code);
    return NextResponse.json({ error: known ? error.message : 'Salvataggio non riuscito. Nessun dato salvato.' },
      { status: error.code === '23505' ? 409 : error.code === '42501' ? 403 : error.code === 'P0001' ? 429 : known ? 422 : 503 });
  }
  return NextResponse.json({ ok: true, id: data }, { status: 201 });
}
