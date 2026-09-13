'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GEAR_LABELS, METHODS, STATUS_LABELS, type ReviewNet } from './types';

type Reporter = { id: string; first_name: string; last_name: string; enabled: boolean };
const field = 'rounded-lg border border-white/20 bg-[#0b242b] text-white text-sm px-3 py-2';
export function NetAdmin({ people, reports }: { people: Reporter[]; reports: ReviewNet[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [filter, setFilter] = useState('');
  async function save(body: object) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/ghost-nets/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Operazione non riuscita.');
      setMessage('Modifica salvata.'); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Operazione non riuscita.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-7">
    <div><h2 className="text-2xl font-semibold text-white">Reti perse a mare</h2><p className="text-sm text-white/55 mt-3">Abilita gli osservatori e confronta i loro riscontri. Più account segnalanti aiutano a stabilire le priorità; nessun numero di conferme rende automaticamente verificata una rete.</p></div>
    {message && <p role="status" className="rounded-xl border border-emerald-200/25 bg-emerald-200/10 p-4 text-sm text-emerald-100">{message}</p>}
    <section className="rounded-2xl border border-white/10 p-5 bg-white/[.03]">
      <h3 className="font-medium text-white">Utenti abilitati alle segnalazioni</h3>
      <p className="text-xs text-white/50 mt-2">Gli amministratori attivi sono già abilitati. Per gli altri account, assegna o revoca l’accesso qui.</p>
      <input className={`${field} w-full mt-4`} value={filter} onChange={e => setFilter(e.target.value)} placeholder="Cerca nome o identificativo" aria-label="Cerca utenti"/>
      <div className="max-h-72 overflow-y-auto mt-3 divide-y divide-white/10">{people.filter(person => `${person.first_name} ${person.last_name} ${person.id}`.toLowerCase().includes(filter.toLowerCase())).map(person => <div key={person.id} className="flex gap-3 items-center justify-between py-3"><div className="min-w-0"><p className="text-sm text-white">{person.first_name} {person.last_name}</p><p className="text-[10px] text-white/40 break-all">{person.id}</p></div><button disabled={busy} onClick={() => save({ action: 'permission', target: person.id, enabled: !person.enabled })} className={`${field} shrink-0 disabled:opacity-40`}>{person.enabled ? 'Revoca accesso' : 'Abilita'}</button></div>)}</div>
      {people.length===0 && <p className="text-sm text-white/50 mt-4">Nessun altro account attivo registrato.</p>}
    </section>
    <section className="space-y-4"><h3 className="text-lg text-white">Ultime segnalazioni ({reports.length}, massimo 200)</h3>
      {reports.length===0 && <p className="text-white/50 text-sm">Non sono ancora arrivate segnalazioni.</p>}
      {[...reports].sort((a,b) => Number(b.status==='reported')-Number(a.status==='reported') || b.observer_count-a.observer_count).map(report => <article key={report.id} className="rounded-2xl border border-white/15 p-5 bg-white/[.03]">
        <div className="flex flex-wrap justify-between gap-3"><h4 className="text-white font-medium">{GEAR_LABELS[report.gear_type]} · {report.observer_count} {report.observer_count===1 ? 'osservatore' : 'osservatori'}</h4><span className="text-xs text-amber-200">{STATUS_LABELS[report.status]}</span></div>
        <p className="text-xs text-white/50 mt-2">{report.lat}, {report.lng} · profondità {report.depth_m ?? 'ignota'}{report.depth_m!==null && ' m'}</p>
        <p className="text-sm text-white/65 mt-3 break-words">{report.description}</p>
        <details className="mt-4"><summary className="text-sm text-emerald-200 cursor-pointer">Osservazioni e prove ({report.observations.length})</summary><div className="space-y-3 mt-3">{report.observations.map(observation => <div key={observation.id} className="rounded-xl p-3 bg-black/15"><p className="text-xs text-white/50">{METHODS[observation.method]} · {new Date(observation.observed_at).toLocaleString('it-IT')} · {observation.lat}, {observation.lng} · profondità {observation.depth_m ?? 'ignota'}{observation.depth_m !== null && ' m'}</p><p className="text-sm text-white/75 mt-2 whitespace-pre-wrap break-words">{observation.description}</p>{observation.evidence_url?.startsWith('https://') && <a className="inline-block text-xs text-emerald-200 underline mt-2" href={observation.evidence_url} target="_blank" rel="noopener noreferrer">Apri prova allegata</a>}</div>)}</div></details>
        <form className="mt-4 space-y-3" onSubmit={event => { event.preventDefault(); const values = new FormData(event.currentTarget); void save({ action: 'review', id: report.id, status: values.get('status'), notes: values.get('notes') }); }}>
          <label className="block text-xs text-white/55">Esito della revisione<select name="status" aria-label="Esito della revisione" className={`${field} block w-full mt-2`} defaultValue={report.status}>{Object.entries(STATUS_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="block text-xs text-white/55">Motivazione e verifica effettuata<textarea name="notes" className={`${field} block w-full mt-2`} minLength={10} maxLength={2000} required defaultValue={report.review_notes ?? ''} rows={2}/></label>
          <button disabled={busy} className="rounded-lg bg-emerald-200 text-slate-950 px-4 py-2 text-sm font-medium disabled:opacity-40">Salva revisione</button>
        </form>
      </article>)}
    </section>
  </div>;
}

