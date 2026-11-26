'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { WeatherLocation } from './locations';

export function CitySearch({ onSelect }: { onSelect: (location: WeatherLocation) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WeatherLocation[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setResults([]); setMessage('');
    if (query.trim().length < 2) { setBusy(false); setMessage('Scrivi almeno 2 caratteri.'); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/weather/locations?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.results)) throw new Error(data.error || 'Ricerca non disponibile.');
      if (controller.signal.aborted) return;
      setResults(data.results);
      setMessage(data.results.length ? 'Scegli una località dai risultati.' : 'Nessuna città trovata. Prova il nome completo o aggiungi il Paese.');
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Connessione non disponibile.');
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }

  return <div className="mb-6">
    <form onSubmit={search} role="search" aria-label="Ricerca città meteo">
      <label htmlFor="weather-city" className="mb-2 block text-xs text-white/60">Cerca una città</label>
      <div className="flex gap-2">
        <input id="weather-city" type="search" autoComplete="off" maxLength={100} value={query} placeholder="Es. Genova, Marsiglia, Barcellona" onChange={e => {
          request.current?.abort(); setQuery(e.target.value); setResults([]); setMessage(''); setBusy(false);
        }} className="min-w-0 flex-1 border border-white/20 bg-[#102c33] px-3 py-3 text-sm text-white focus:outline-2 focus:outline-emerald-200"/>
        <button type="submit" disabled={busy || query.trim().length < 2} className="flex items-center gap-2 bg-emerald-200 px-4 py-3 text-sm font-medium text-slate-950 disabled:opacity-40"><Search size={16} aria-hidden="true"/>{busy ? 'Cerco…' : 'Cerca'}</button>
      </div>
    </form>
    <p role="status" aria-live="polite" className="mt-2 text-xs text-white/60">{busy ? 'Ricerca delle città…' : message}</p>
    {results.length > 0 && <ul aria-label="Città trovate" className="mt-3 max-h-72 overflow-y-auto border-y border-white/20 divide-y divide-white/10">{results.map(location => <li key={location.id}>
      <button type="button" onClick={() => { request.current?.abort(); setQuery(location.name); setResults([]); setMessage(''); onSelect(location); }} className="block w-full px-3 py-3 text-left text-sm text-white hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-emerald-200">{location.label}</button>
    </li>)}</ul>}
  </div>;
}
