import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { NextResponse } from 'next/server';

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Verifica temporaneamente non disponibile.' }, { status: 503 });
  const { code } = await params;
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(code)) return NextResponse.json({ error: 'Codice non valido.' }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('verify_certificate', { p_code: code });
  if (error) return NextResponse.json({ error: 'Verifica temporaneamente non disponibile.' }, { status: 503 });
  if (!data?.length) return NextResponse.json({ error: 'Certificato non trovato.' }, { status: 404 });
  return NextResponse.json(data[0], { headers: { 'Cache-Control': 'no-store' } });
}
