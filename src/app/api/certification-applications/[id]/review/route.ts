import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Servizio non configurato.' }, { status: 503 });
  const { id } = await params;
  const parsed = z.object({ approve: z.boolean(), notes: z.string().trim().max(1000) }).safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !parsed.success || (!parsed.data.approve && !parsed.data.notes))
    return NextResponse.json({ error: 'Decisione o motivazione non valida.' }, { status: 422 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
  const { data, error } = await supabase.rpc('review_certification', { p_application_id: id, p_approve: parsed.data.approve, p_notes: parsed.data.notes });
  if (error) return NextResponse.json({ error: error.code === 'P0001' ? error.message : 'Revisione non riuscita. Aggiorna la pagina.' }, { status: 400 });
  return NextResponse.json({ certificate_id: data });
}
