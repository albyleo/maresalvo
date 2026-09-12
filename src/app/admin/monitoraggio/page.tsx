import { Card, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getIllegalReports, getAisVessels } from "@/features/marine-map/data";
import { formatDate } from "@/lib/utils";
import type { IllegalReportStatus, IllegalReportSource } from "@/types";

const STATUS_LABEL: Record<IllegalReportStatus, string> = {
  open: "Aperta",
  under_review: "In revisione",
  forwarded: "Inoltrata all'autorità",
  dismissed: "Archiviata",
};

const STATUS_VARIANT: Record<IllegalReportStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  open: "danger",
  under_review: "warning",
  forwarded: "info",
  dismissed: "default",
};

const SOURCE_LABEL: Record<IllegalReportSource, string> = {
  ais_geofence: "AIS (geofencing AMP)",
  citizen: "Segnalazione cittadina",
  patrol: "Pattuglia",
};

export default async function AdminMonitoraggio() {
  const [reports, vessels] = await Promise.all([
    getIllegalReports(),
    getAisVessels(),
  ]);
  const alerts = vessels.filter((v) => v.is_fishing && v.in_protected_area);

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Monitoraggio pesca illegale</h2>

      <Card glass className="mb-6 border-amber-500/20">
        <CardDescription>
          <strong className="text-white/80">Nota operativa.</strong> Il sistema è
          uno strumento di <em>supporto e segnalazione</em>, non un accertamento
          sanzionatorio. Gli alert AIS evidenziano imbarcazioni che mostrano
          comportamento di pesca dentro un&apos;AMP; le imbarcazioni senza AIS
          (&quot;dark vessels&quot;) non sono rilevabili. Le segnalazioni validate
          vanno inoltrate alle autorità competenti (Capitaneria di Porto).
        </CardDescription>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card glass>
          <p className="text-white/40 text-xs">Alert AIS attivi (in AMP)</p>
          <p className="text-3xl font-bold text-red-300 mt-1">{alerts.length}</p>
        </Card>
        <Card glass>
          <p className="text-white/40 text-xs">Segnalazioni aperte</p>
          <p className="text-3xl font-bold text-amber-300 mt-1">
            {reports.filter((r) => r.status === "open").length}
          </p>
        </Card>
        <Card glass>
          <p className="text-white/40 text-xs">Imbarcazioni AIS tracciate</p>
          <p className="text-3xl font-bold text-white mt-1">{vessels.length}</p>
        </Card>
      </div>

      <Card glass className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/50 text-xs">
            <tr>
              <th className="text-left px-4 py-3">Fonte</th>
              <th className="text-left px-4 py-3">Imbarcazione / MMSI</th>
              <th className="text-left px-4 py-3">Posizione</th>
              <th className="text-left px-4 py-3">Rilevata</th>
              <th className="text-left px-4 py-3">Stato</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="px-4 py-3 text-white/80">{SOURCE_LABEL[r.source]}</td>
                <td className="px-4 py-3 text-white/60">
                  {r.vessel_name ?? "—"}
                  {r.mmsi && <span className="text-white/30 font-mono text-xs"> · {r.mmsi}</span>}
                </td>
                <td className="px-4 py-3 text-white/60 font-mono text-xs">
                  {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                </td>
                <td className="px-4 py-3 text-white/60">{formatDate(r.detected_at)}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
