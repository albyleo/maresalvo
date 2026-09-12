import { Card, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getGhostNets } from "@/features/marine-map/data";
import { formatDate } from "@/lib/utils";
import type { GhostNetStatus } from "@/types";

const STATUS_LABEL: Record<GhostNetStatus, string> = {
  reported: "Segnalata",
  verified: "Verificata",
  recovery_planned: "Recupero pianificato",
  recovered: "Recuperata",
  rejected: "Respinta",
};

const STATUS_VARIANT: Record<GhostNetStatus, "default" | "success" | "warning"> = {
  reported: "warning",
  verified: "default",
  recovery_planned: "default",
  recovered: "success",
  rejected: "default",
};

const GEAR_LABEL: Record<string, string> = {
  net: "Rete",
  longline: "Palamito",
  trap: "Nassa",
  rope: "Cima",
  other: "Altro",
};

export default async function AdminRetiPerse() {
  const reports = await getGhostNets();
  const open = reports.filter((r) => r.status === "reported").length;
  const recovered = reports.filter((r) => r.status === "recovered").length;

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Reti perse a mare</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card glass>
          <p className="text-white/40 text-xs">Totale segnalazioni</p>
          <p className="text-3xl font-bold text-white mt-1">{reports.length}</p>
        </Card>
        <Card glass>
          <p className="text-white/40 text-xs">Da verificare</p>
          <p className="text-3xl font-bold text-amber-300 mt-1">{open}</p>
        </Card>
        <Card glass>
          <p className="text-white/40 text-xs">Recuperate</p>
          <p className="text-3xl font-bold text-emerald-300 mt-1">{recovered}</p>
        </Card>
      </div>

      <Card glass className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/50 text-xs">
            <tr>
              <th className="text-left px-4 py-3">Attrezzo</th>
              <th className="text-left px-4 py-3">Posizione</th>
              <th className="text-left px-4 py-3">Prof.</th>
              <th className="text-left px-4 py-3">Segnalata</th>
              <th className="text-left px-4 py-3">Stato</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="px-4 py-3 text-white">{GEAR_LABEL[r.gear_type]}</td>
                <td className="px-4 py-3 text-white/60 font-mono text-xs">
                  {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                </td>
                <td className="px-4 py-3 text-white/60">{r.depth_m ?? "—"} m</td>
                <td className="px-4 py-3 text-white/60">{formatDate(r.reported_at)}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[r.status]}>
                    {STATUS_LABEL[r.status]}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <CardDescription className="mt-4">
        Workflow: segnalazione (pubblica o pescatore) → verifica staff →
        pianificazione recupero → recupero. Le segnalazioni verificate appaiono
        sul layer pubblico della mappa marina.
      </CardDescription>
    </div>
  );
}
