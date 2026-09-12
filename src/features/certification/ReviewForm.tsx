"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export function ReviewForm({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState('');
  const [decision, setDecision] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/certification-applications/${applicationId}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approve: decision === 'approve', notes }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Revisione non riuscita.');
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Errore di rete. Riprova.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-3 mt-5">
    <label className="block">Decisione
      <select required value={decision} onChange={e => { setDecision(e.target.value); setConfirmed(false); }} className="block w-full bg-slate-900 border border-white/20 rounded-lg p-2 mt-1">
        <option value="">Seleziona…</option><option value="approve">Approva ed emetti certificato demo</option><option value="reject">Respingi</option>
      </select>
    </label>
    <label className="block">Note {decision === 'reject' ? '(obbligatorie)' : '(facoltative)'}
      <textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={1000} required={decision === 'reject'} rows={2} className="block w-full bg-white/5 border border-white/20 rounded-lg p-2 mt-1" />
    </label>
    <label className="flex gap-2 text-sm text-white/70"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Ho verificato la richiesta. Il documento dimostrativo non è una qualifica o un permesso.</label>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    <Button type="submit" disabled={busy || !confirmed || !decision}>{busy ? 'Salvataggio…' : 'Conferma revisione'}</Button>
  </form>;
}
