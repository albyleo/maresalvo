"use client";

import { useState } from "react";
import { Search, Shield, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { CertificateVerification } from "@/types";
import { formatDate } from "@/lib/utils";

export default function VerificationForm({ initialCode = '', initialResult = null, initialError = '' }: { initialCode?: string; initialResult?: CertificateVerification | null; initialError?: string }) {
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CertificateVerification | null>(initialResult);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(initialError);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setResult(null);
    setNotFound(false);
    setError('');

    try {
      const res = await fetch(`/api/certificates/verify/${encodeURIComponent(code.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      } else if (res.status === 404) {
        setNotFound(true);
      } else {
        setError('Verifica non disponibile. Riprova più tardi.');
      }
    } catch {
      setError('Connessione non disponibile. Riprova.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pt-28 pb-16 px-4">
      <div className="mx-auto max-w-lg">
        <div className="text-center mb-10">
          <Shield className="h-12 w-12 text-[var(--color-aqua)] mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">
            Verifica Certificato
          </h1>
          <p className="text-white/50">
            Inserisci il codice QR o il numero seriale del certificato FIPSAS
          </p>
        </div>

        <form onSubmit={handleVerify} className="flex gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Codice verifica o seriale..."
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-[var(--color-aqua)]/50"
            />
          </div>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? "..." : "Verifica"}
          </Button>
        </form>

        {error && <p role="alert" className="text-amber-200 mb-4">{error}</p>}
        {notFound && (
          <Card glass className="text-center">
            <XCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <CardTitle>Certificato non trovato</CardTitle>
            <CardDescription>
              Il codice inserito non corrisponde a nessun certificato emesso.
              Verifica di aver inserito il codice corretto.
            </CardDescription>
          </Card>
        )}

        {result && (
          <Card glass>
            <div className="flex items-center gap-3 mb-4">
              {result.status === 'issued' ? <CheckCircle className="h-8 w-8 text-emerald-400" /> : <XCircle className="h-8 w-8 text-red-400" />}
              <div>
                <CardTitle>{result.status === 'issued' ? (result.certificate_type === 'demo_training' ? 'Certificato demo emesso' : 'Certificato valido') : result.status === 'expired' ? 'Certificato scaduto' : 'Certificato revocato'}</CardTitle>
                <Badge variant={result.status === 'issued' ? 'success' : 'warning'}>{result.status}</Badge>
              </div>
            </div>

            {result.certificate_type === 'demo_training' && <p className="text-amber-200 mb-4">Documento dimostrativo. Non è una qualifica FIPSAS e non autorizza la pesca o altre attività sportive.</p>}
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-white/40">Seriale</dt>
                <dd className="text-white font-mono">{result.serial_number}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/40">Intestatario</dt>
                <dd className="text-white">{result.first_name} {result.last_name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/40">Titolo</dt>
                <dd className="text-white">{result.title}</dd>
              </div>
              {result.qualification_level && (
                <div className="flex justify-between">
                  <dt className="text-white/40">Livello</dt>
                  <dd className="text-white">{result.qualification_level}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-white/40">Emesso il</dt>
                <dd className="text-white">{formatDate(result.issued_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/40">Scadenza</dt>
                <dd className="text-white">{formatDate(result.expires_at)}</dd>
              </div>
            </dl>
          </Card>
        )}
      </div>
    </div>
  );
}
