import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";

export default function DashboardAutorizzazioniPage() {
  return (
    <div>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Autorizzazioni</h1>
          <p className="text-white/50">
            Richiedi e gestisci permessi per attività e gare
          </p>
        </div>
        <Button variant="primary" size="sm" disabled>
          <Plus className="h-4 w-4" />
          Nuova richiesta
        </Button>
      </div>

      <Card glass className="text-center py-12">
        <CardTitle>Nessuna autorizzazione</CardTitle>
        <CardDescription className="mt-2">
          Workflow: richiesta → verifica staff → approvazione → emissione PDF con QR.
        </CardDescription>
      </Card>
    </div>
  );
}
