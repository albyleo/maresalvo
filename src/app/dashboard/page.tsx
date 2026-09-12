import { getCurrentProfile } from "@/lib/supabase/server";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Award, FileCheck, MapPin, ClipboardList } from "lucide-react";
import Link from "next/link";

async function DashboardStatCard({
  icon: Icon,
  title,
  value,
  description,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  description: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card glass className="hover:border-[var(--color-aqua)]/30 transition-colors group h-full">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-[var(--color-aqua)]/10 group-hover:bg-[var(--color-aqua)]/20 transition-colors">
            <Icon className="h-5 w-5 text-[var(--color-aqua)]" />
          </div>
          <div>
            <p className="text-white/40 text-xs">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  const profile = await getCurrentProfile();

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">
        Bentornato, {profile?.first_name}
      </h1>
      <p className="text-white/50 mb-8">
        Panoramica del tuo profilo pescatore FIPSAS
      </p>
      <div className="flex flex-wrap gap-4 mb-6">
        <Link className="underline text-[var(--color-aqua)]" href="/dashboard/qualifiche">Inizia il questionario dimostrativo</Link>
        {profile && ['super_admin', 'regional_committee', 'club_instructor'].includes(profile.role) && <Link className="underline" href="/admin/pratiche">Apri la revisione staff</Link>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <DashboardStatCard
          icon={Award}
          title="Qualifiche"
          value="—"
          description="Visualizza livelli e scadenze"
          href="/dashboard/qualifiche"
        />
        <DashboardStatCard
          icon={FileCheck}
          title="Certificati"
          value="—"
          description="Scarica e verifica i tuoi certificati"
          href="/dashboard/certificati"
        />
        <DashboardStatCard
          icon={ClipboardList}
          title="Autorizzazioni"
          value="—"
          description="Richieste e permessi attivi"
          href="/dashboard/autorizzazioni"
        />
        <DashboardStatCard
          icon={MapPin}
          title="Mappa AMP"
          value="Mappa"
          description="Consulta le aree protette"
          href="/mappa"
        />
      </div>

      <Card glass>
        <CardTitle>Prossimi passi</CardTitle>
        <CardDescription className="mb-4">
          Completa il tuo profilo per accedere a tutte le funzionalità della piattaforma.
        </CardDescription>
        <ul className="space-y-2 text-sm text-white/60">
          <li>• Associa la tessera FIPSAS al profilo</li>
          <li>• Carica il certificato medico di idoneità</li>
          <li>• Verifica lo stato delle qualifiche apnea</li>
        </ul>
      </Card>
    </div>
  );
}
