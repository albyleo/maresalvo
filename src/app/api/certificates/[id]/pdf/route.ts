import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createCertificatePdf } from '@/features/certification/pdf';

export const runtime = 'nodejs';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Servizio non configurato.' }, { status: 503 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'ID non valido.' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
  const { data: c, error } = await supabase.from('certificates').select('*,holder:profiles!certificates_profile_id_fkey(first_name,last_name)').eq('id', id).neq('status', 'draft').maybeSingle();
  if (error) return NextResponse.json({ error: 'Download non disponibile.' }, { status: 503 });
  if (!c || c.certificate_type !== 'demo_training') return NextResponse.json({ error: 'Documento non disponibile.' }, { status: 404 });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return NextResponse.json({ error: 'Indirizzo di verifica non configurato.' }, { status: 503 });
  try {
    const verificationUrl = new URL(`/verifica?code=${encodeURIComponent(c.verification_code)}`, appUrl).toString();
    const status = c.status === 'issued' && c.expires_at && Date.parse(c.expires_at) <= Date.now() ? 'expired' : c.status;
    const holder = `${c.metadata?.holder_first_name ?? c.holder.first_name} ${c.metadata?.holder_last_name ?? c.holder.last_name}`;
    const pdf = await createCertificatePdf({ serial: c.serial_number, title: c.title, holder, issuedAt: c.issued_at, expiresAt: c.expires_at, status, verificationUrl });
    return new Response(Buffer.from(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${c.serial_number.replace(/[^a-zA-Z0-9-]/g, '')}.pdf"`, 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Generazione PDF non riuscita. Riprova.' }, { status: 503 });
  }
}
