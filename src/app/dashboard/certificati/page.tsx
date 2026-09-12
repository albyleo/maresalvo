import Link from 'next/link';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { Card } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';
import type { Certificate } from '@/types';

export default async function DashboardCertificatiPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from('certificates').select('*').eq('profile_id', profile.id).neq('status', 'draft').order('issued_at', { ascending: false });
  return <div className="space-y-5"><h1 className="text-2xl font-bold">I miei certificati</h1>
    <p className="text-white/60">Scarica il documento PDF o apri la verifica pubblica. I documenti demo non sono qualifiche o permessi.</p>
    {error ? <Card>Impossibile caricare i certificati. Riprova più tardi.</Card> : !data?.length ? <Card>Nessun certificato emesso. <Link className="underline text-[var(--color-aqua)]" href="/dashboard/qualifiche">Inizia il questionario</Link>.</Card> : (data as Certificate[]).map(c => {
      // Server component: evaluate expiry at request time, after the authenticated database read.
      // eslint-disable-next-line react-hooks/purity
      const expired = c.status === 'issued' && c.expires_at && Date.parse(c.expires_at) <= Date.now();
      return <Card glass key={c.id}><h2 className="text-lg font-semibold">{c.title}</h2>
        <p className="text-sm text-white/60 mt-2">{c.serial_number} · {expired ? 'expired' : c.status} · Scadenza: {formatDate(c.expires_at)}</p>
        {c.certificate_type === 'demo_training' && <p className="text-amber-200 mt-2">DEMO — senza valore abilitante</p>}
        <div className="flex flex-wrap gap-5 mt-4"><a className="text-[var(--color-aqua)] underline" href={`/api/certificates/${c.id}/pdf`}>Scarica PDF con QR</a>
          <Link className="underline" href={`/verifica?code=${encodeURIComponent(c.verification_code)}`}>Verifica stato</Link></div>
      </Card>;
    })}
  </div>;
}
