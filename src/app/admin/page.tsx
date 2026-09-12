import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function AdminPage() {
  const supabase = await createClient();
  const [pending, approved, rejected] = await Promise.all(
    ['pending', 'approved', 'rejected'].map(status => supabase.from('certification_applications').select('id', { count: 'exact', head: true }).eq('status', status))
  );
  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-8">Dashboard amministrativa</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Pratiche in attesa", value: pending.error ? '—' : String(pending.count ?? 0) },
          { label: "Richieste approvate", value: approved.error ? '—' : String(approved.count ?? 0) },
          { label: "Richieste respinte", value: rejected.error ? '—' : String(rejected.count ?? 0) },
        ].map((stat) => (
          <Card key={stat.label} glass>
            <p className="text-white/40 text-xs">{stat.label}</p>
            <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
          </Card>
        ))}
      </div>

      <Card glass>
        <CardTitle>Workflow operativo</CardTitle>
        <CardDescription className="mt-2">
          Questionario dimostrativo → valutazione automatica → revisione staff →
          certificato demo PDF + QR → verifica pubblica online. I conteggi rispettano il tuo ambito di accesso.
        </CardDescription>
        <Link className="inline-block mt-4 text-[var(--color-aqua)] underline" href="/admin/pratiche">Apri le richieste</Link>
      </Card>
    </div>
  );
}
