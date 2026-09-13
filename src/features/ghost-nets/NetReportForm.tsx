'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { CheckCircle2, Crosshair, ShieldCheck } from 'lucide-react';
import { GEAR_LABELS, METHODS, STATUS_LABELS, type NearbyNet, type Position } from './types';
import type { GearType } from '@/types';

const ReportMap = dynamic(() => import('./ReportMap'), { ssr: false, loading: () => <div className="h-[55svh] min-h-[360px] rounded-2xl bg-white/5 animate-pulse"/> });
const input = 'mt-2 w-full rounded-xl border border-white/15 bg-[#0b242b] px-3 py-3 text-sm text-white focus:outline-2 focus:outline-emerald-200 disabled:opacity-40';

export function NetReportForm({ allowed, signedIn, unavailable }: { allowed: boolean; signedIn: boolean; unavailable: boolean }) {
  const [lat, setLat] = useState(''), [lng, setLng] = useState('');
  const [gear, setGear] = useState<GearType>('net');
  const [selection, setSelection] = useState('');
  const [search, setSearch] = useState<{ key: string; items: NearbyNet[]; error: string }>({ key: '', items: [], error: '' });
  const [retry, setRetry] = useState(0), [busy, setBusy] = useState(false), [geoBusy, setGeoBusy] = useState(false);
  const [error, setError] = useState(''), [done, setDone] = useState(false);
  const position = useMemo(() => lat.trim() && lng.trim() && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat))<=90 && Math.abs(Number(lng))<=180
    ? { lat: Number(lat), lng: Number(lng) } : null, [lat, lng]);
  const key = position ? `${position.lat},${position.lng}` : '';
  const nearby = search.key === key ? search.items : [];
  const searching = !!key && search.key !== key;
  const lookupError = search.key === key ? search.error : '';
  const selected = nearby.find(net => net.id === selection);
  const effectiveGear = selected?.gear_type ?? gear;
  useEffect(() => {
    if (!allowed || !position) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/ghost-nets?lat=${position.lat}&lng=${position.lng}`, { signal: controller.signal, cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Ricerca non disponibile.');
        if (!controller.signal.aborted) setSearch({ key, items: body, error: '' });
      } catch (err) {
        if (!controller.signal.aborted) setSearch({ key, items: [], error: err instanceof Error ? err.message : 'Ricerca non disponibile.' });
      }
    }, 450);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [allowed, position, key, retry]);
  function choosePosition(point: Position) {
    setLat(point.lat.toFixed(6)); setLng(point.lng.toFixed(6)); setSelection(''); setDone(false);
  }
  function locate() {
    setError('');
    if (!navigator.geolocation) { setError('GPS non disponibile. Inserisci le coordinate.'); return; }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(p => {
      choosePosition({ lat: p.coords.latitude, lng: p.coords.longitude }); setGeoBusy(false);
    }, () => { setGeoBusy(false); setError('Posizione non disponibile. Seleziona il punto sulla mappa o inserisci le coordinate.'); }, { enableHighAccuracy: true, timeout: 10000 });
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!allowed || !position || searching || lookupError || (nearby.length>0 && !selected && selection!=='new')) return;
    const form = event.currentTarget, values = new FormData(form);
    const observed = new Date(String(values.get('observed_at')));
    if (!Number.isFinite(observed.getTime()) || observed.getTime()>Date.now()) { setError('Inserisci una data di osservazione valida, non futura.'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/ghost-nets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        lat: position.lat, lng: position.lng, gear_type: effectiveGear, depth_m: values.get('depth') ? Number(values.get('depth')) : null,
        discovery_method: values.get('method'), observed_at: observed.toISOString(), description: values.get('description'),
        evidence_url: String(values.get('evidence') || '').trim() || null, report_id: selected?.id ?? null,
      }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Invio non riuscito.');
      setDone(true); form.reset(); setRetry(n => n+1); setSelection('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Invio non riuscito. Riprova.'); }
    finally { setBusy(false); }
  }
  return <div className="mt-9 grid gap-8 lg:grid-cols-[1.35fr_1fr] items-start">
    <div className="space-y-6">
      <ReportMap position={position} nearby={nearby} onPosition={choosePosition} enabled={allowed}/>
      {allowed && <div className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-medium text-white">1. Il punto del ritrovamento</h2>
          <button type="button" onClick={locate} disabled={geoBusy} className="inline-flex items-center gap-2 text-xs text-emerald-200 disabled:opacity-50"><Crosshair size={15}/>{geoBusy ? 'Ricerca posizione…' : 'Usa la mia posizione'}</button></div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <label className="text-xs text-white/60">Latitudine<input aria-label="Latitudine" type="number" min="-90" max="90" step="any" value={lat} onChange={e => { setLat(e.target.value); setSelection(''); setDone(false); }} className={input} placeholder="40.250000"/></label>
          <label className="text-xs text-white/60">Longitudine<input aria-label="Longitudine" type="number" min="-180" max="180" step="any" value={lng} onChange={e => { setLng(e.target.value); setSelection(''); setDone(false); }} className={input} placeholder="17.900000"/></label>
        </div>
        <p className="text-xs text-white/40 mt-3">Usa il GPS solo se ti trovi sul luogo del ritrovamento.</p>
        <div className="mt-5 text-sm" aria-live="polite">
          {!position ? <p className="text-white/50">Scegli un punto per cercare altre segnalazioni nella zona.</p> : searching ? <p className="text-emerald-200">Controllo delle segnalazioni vicine…</p> : lookupError ? <div className="text-amber-200">{lookupError} <button type="button" className="underline" onClick={() => setRetry(n => n+1)}>Riprova</button></div> : nearby.length===0 ? <p className="text-white/60">Nessuna segnalazione aperta entro 250 metri.</p> : <fieldset>
            <legend className="text-amber-200 mb-3">Ci sono {nearby.length} segnalazioni entro 250 m. È lo stesso attrezzo?</legend>
            <div className="space-y-2">{nearby.map(net => <label key={net.id} className={`block p-3 rounded-xl border cursor-pointer ${selected?.id===net.id ? 'border-emerald-200 bg-emerald-200/10' : 'border-white/15'} ${net.contributed ? 'opacity-50' : ''}`}>
              <span className="flex gap-2 items-start"><input className="mt-1 accent-emerald-300" type="radio" name="matching-net" checked={selection===net.id} disabled={net.contributed || busy} onChange={() => setSelection(net.id)}/><span className="min-w-0"><span className="text-white">{GEAR_LABELS[net.gear_type]} · {net.distance_m} m · {net.depth_m === null ? 'profondità ignota' : `${net.depth_m} m di profondità`}</span><span className="block text-xs text-white/50 mt-1">{net.observer_count} {net.observer_count===1 ? 'osservatore' : 'osservatori'} · {STATUS_LABELS[net.status]}</span><span className="block text-xs text-white/60 mt-2 break-words">{net.description}</span>{net.contributed && <span className="block text-xs mt-2">Hai già contribuito a questa segnalazione.</span>}</span></span>
            </label>)}<label className="flex gap-2 p-3 text-white/70"><input type="radio" name="matching-net" checked={selection==='new'} disabled={busy} onChange={() => setSelection('new')}/>È un altro attrezzo: crea una nuova segnalazione</label></div>
            <p className="text-xs text-white/40 mt-2">La vicinanza è solo un suggerimento: confronta posizione, profondità e descrizione.</p>
          </fieldset>}
        </div>
      </div>}
      <div className="flex gap-3 text-sm text-white/55"><ShieldCheck className="shrink-0 text-emerald-200" size={20}/><p>Ogni account conta una sola volta per rete. Più osservazioni aiutano la revisione: la conferma definitiva resta allo staff.</p></div>
    </div>
    <div className="rounded-2xl border border-white/10 bg-white/[.03] p-5 sm:p-7">
      {!allowed ? <div className="space-y-5"><ShieldCheck size={28} className="text-emerald-200"/><h2 className="text-xl font-medium text-white">Segnalazioni da utenti abilitati</h2><p className="text-sm leading-relaxed text-white/60">{unavailable ? 'Il servizio è in preparazione. Lo staff deve completare l’aggiornamento del database.' : signedIn ? 'Il tuo account non è ancora abilitato. Chiedi al referente del progetto di autorizzarti a inviare osservazioni.' : 'Accedi o crea un account. Lo staff potrà poi abilitarti a segnalare reti e contribuire alle segnalazioni esistenti.'}</p>{!signedIn && <div className="flex flex-wrap gap-4"><Link href="/login?redirect=/segnala-rete" className="rounded-xl bg-emerald-200 px-5 py-3 text-sm font-medium text-slate-950">Accedi</Link><Link href="/registrazione" className="py-3 text-sm text-white/70 underline">Crea un account</Link></div>}</div> : <>
        {done && <div role="status" className="flex gap-3 rounded-xl bg-emerald-200/10 border border-emerald-200/25 p-4 mb-5 text-emerald-100"><CheckCircle2 size={22} className="shrink-0"/><p className="text-sm">Osservazione salvata. Lo staff la confronterà con gli altri riscontri. La segnalazione non viene verificata automaticamente.</p></div>}
        <h2 className="font-medium text-white mb-5">2. {selected ? 'Aggiungi il tuo riscontro' : 'Documenta il ritrovamento'}</h2>
        <form onSubmit={submit} className="space-y-5">
          <fieldset disabled={busy} className="space-y-5">
            <label className="block text-sm text-white/65">Tipo di attrezzo<select className={input} value={effectiveGear} disabled={!!selected} onChange={e => setGear(e.target.value as GearType)}>{Object.entries(GEAR_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="block text-sm text-white/65">Come lo hai individuato?<select name="method" className={input} required defaultValue=""><option value="" disabled>Scegli il metodo</option>{Object.entries(METHODS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <div className="grid sm:grid-cols-2 gap-4"><label className="block min-w-0 text-sm text-white/65">Data e ora locali<input className={input} type="datetime-local" name="observed_at" required/></label><label className="block text-sm text-white/65">Profondità (m, facoltativa)<input className={input} type="number" name="depth" min="0" max="12000" step="1" placeholder="Es. 18"/></label></div>
            <label className="block text-sm text-white/65">Descrivi ciò che hai osservato<textarea className={input} name="description" required minLength={20} maxLength={2000} rows={4} placeholder="Aspetto, dimensioni, fondale, eventuali animali impigliati e dettagli che aiutino a riconoscere l’attrezzo…"/><span className="block mt-1 text-xs text-white/40">20–2000 caratteri. Per sonar e ROV indica anche come hai interpretato le immagini.</span></label>
            <label className="block text-sm text-white/65">Link a foto, video o traccia (facoltativo)<input className={input} type="url" pattern="https://.*" maxLength={2000} name="evidence" placeholder="https://…"/><span className="block mt-1 text-xs text-white/40">Visibile allo staff. Condividi un link accessibile, senza password o dati personali.</span></label>
            <label className="flex items-start gap-3 text-xs leading-relaxed text-white/65"><input type="checkbox" required className="mt-1 accent-emerald-300"/>Confermo che descrivo una mia osservazione e che ho confrontato eventuali segnalazioni vicine.</label>
          </fieldset>
          {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
          <button type="submit" disabled={busy || !position || searching || !!lookupError || (nearby.length>0 && !selected && selection!=='new') || !!selected?.contributed} className="w-full rounded-xl bg-emerald-200 text-slate-950 py-3.5 font-medium text-sm disabled:opacity-40 hover:bg-emerald-100 transition-colors">{busy ? 'Invio in corso…' : selected ? 'Invia osservazione sulla rete' : 'Invia nuova segnalazione'}</button>
          {!position && <p className="text-xs text-white/40">Seleziona prima la posizione sulla mappa o inserisci le coordinate.</p>}
        </form>
      </>}
    </div>
  </div>;
}

