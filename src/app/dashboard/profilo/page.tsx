import { getCurrentProfile } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export default async function ProfiloPage() {
  const profile = await getCurrentProfile();

  if (!profile) return null;

  const fields = [
    { label: "Nome", value: profile.first_name },
    { label: "Cognome", value: profile.last_name },
    { label: "Ruolo", value: ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] },
    { label: "Tessera FIPSAS", value: profile.fipsas_card_number ?? "—" },
    { label: "Codice fiscale", value: profile.fiscal_code ?? "—" },
    { label: "Telefono", value: profile.phone ?? "—" },
    { label: "Data di nascita", value: formatDate(profile.birth_date) },
    { label: "Città", value: profile.city ?? "—" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Il mio profilo</h1>

      <Card glass>
        <div className="flex items-center gap-4 mb-6">
          <div className="h-16 w-16 rounded-full bg-[var(--color-aqua)]/20 flex items-center justify-center text-xl font-bold text-[var(--color-aqua)]">
            {profile.first_name.charAt(0)}{profile.last_name.charAt(0)}
          </div>
          <div>
            <CardTitle className="mb-0">
              {profile.first_name} {profile.last_name}
            </CardTitle>
            <Badge variant="info">{ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS]}</Badge>
          </div>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map(({ label, value }) => (
            <div key={label} className="p-3 rounded-xl bg-white/5">
              <dt className="text-white/40 text-xs mb-1">{label}</dt>
              <dd className="text-white text-sm">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
