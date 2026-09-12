import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Qualifiche Apnea",
  description: "Catalogo livelli qualifica apnea FIPSAS: da Apnea A a Apnea Pro.",
};

const LEVELS = [
  {
    code: "AP-A",
    name: "Apnea A — Base",
    description: "Introduzione alla pesca in apnea, sicurezza e regolamento base.",
    minAge: 14,
    validity: "24 mesi",
  },
  {
    code: "AP-B",
    name: "Apnea B — Intermedio",
    description: "Tecniche avanzate, gestione profondità e attrezzatura.",
    minAge: 16,
    validity: "24 mesi",
  },
  {
    code: "AP-C",
    name: "Apnea C — Avanzato",
    description: "Competizione e istruttoria di base.",
    minAge: 18,
    validity: "24 mesi",
  },
  {
    code: "AP-D",
    name: "Apnea D — Istruttore",
    description: "Abilitazione all'insegnamento e supervisione attività.",
    minAge: 21,
    validity: "36 mesi",
  },
  {
    code: "AP-PRO",
    name: "Apnea Pro — Competizione",
    description: "Qualifica agonistica nazionale.",
    minAge: 18,
    validity: "12 mesi",
  },
];

export default function QualifichePage() {
  return (
    <div className="pt-28 pb-16 px-4">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold text-white mb-2">Qualifiche Apnea FIPSAS</h1>
        <p className="text-white/50 mb-10 max-w-2xl">
          Percorso formativo ufficiale per la pesca in apnea. Ogni livello richiede
          esame, idoneità medica e rinnovo periodico.
        </p>

        <div className="space-y-4">
          {LEVELS.map((level, i) => (
            <Card key={level.code} glass>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant="info">{level.code}</Badge>
                    <CardTitle className="mb-0">{level.name}</CardTitle>
                  </div>
                  <CardDescription>{level.description}</CardDescription>
                </div>
                <div className="text-right text-xs text-white/40 shrink-0">
                  <p>Età min: {level.minAge}</p>
                  <p>Validità: {level.validity}</p>
                  <p className="mt-1 text-[var(--color-aqua)]">Step {i + 1}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
