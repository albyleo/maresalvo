import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

const schema = z.object({ questionnaire_id: z.uuid(), answers: z.record(z.uuid(), z.number().int().min(0).max(999)) });
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Servizio non configurato.' }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Risposte non valide.' }, { status: 422 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Accedi per inviare il questionario.' }, { status: 401 });
  const { data, error } = await supabase.rpc('submit_questionnaire', { p_questionnaire_id: parsed.data.questionnaire_id, p_answers: parsed.data.answers });
  if (error) return NextResponse.json({ error: error.code === 'P0001' ? error.message : 'Invio non riuscito. Verifica lo storico prima di riprovare.' }, { status: 400 });
  return NextResponse.json({ id: data }, { status: 201 });
}
