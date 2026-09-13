import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('permission'), target: z.string().uuid(), enabled: z.boolean() }),
  z.object({ action: z.literal('review'), id: z.string().uuid(), status: z.enum(['reported','verified','recovery_planned','recovered','rejected']), notes: z.string().trim().min(10).max(2000) }),
]);
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
  if (profile.role !== 'super_admin') return NextResponse.json({ error: 'Operazione riservata agli amministratori.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dati non validi. La motivazione richiede almeno 10 caratteri.' }, { status: 422 });
  const supabase = await createClient(), data = parsed.data;
  const { error } = data.action === 'permission'
    ? await supabase.rpc('set_ghost_net_reporter', { target: data.target, enabled: data.enabled })
    : await supabase.rpc('review_ghost_net', { p_report_id: data.id, p_status: data.status, p_notes: data.notes });
  if (error) return NextResponse.json({ error: ['42501','22023'].includes(error.code) ? error.message : 'Operazione non disponibile. Verifica la migrazione 006.' }, { status: error.code === '42501' ? 403 : 503 });
  return NextResponse.json({ ok: true });
}
