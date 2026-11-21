import Link from 'next/link';

export function Footer() {
  return <footer className="site-footer border-t border-white/15 px-5 sm:px-8 py-12">
    <div className="max-w-[1600px] mx-auto grid gap-8 md:grid-cols-[1fr_auto] text-xs text-white/55">
      <div><Link href="/" className="text-2xl font-medium tracking-tight text-white">MareSalvo<span className="text-[var(--color-aqua)]">.</span></Link><p className="mt-3">Un progetto non profit per il Mediterraneo.</p></div>
      <nav aria-label="Link nel footer" className="flex flex-wrap md:items-end gap-x-6 gap-y-4">
        <Link href="/questionari" className="site-footer-link">Questionari</Link>
        <Link href="/meteo" className="site-footer-link">Meteo marino</Link>
        <Link href="/osservatorio" className="site-footer-link">Osservatorio</Link>
        <Link href="/segnala-rete" className="site-footer-link">Segnala una rete</Link>
        <Link href="/verifica" className="site-footer-link">Verifica certificato</Link>
        <a href="https://www.fipsas.it" target="_blank" rel="noreferrer" className="site-footer-link">FIPSAS ↗</a>
      </nav>
    </div>
  </footer>;
}
