import Link from 'next/link';

export function Footer() {
  return <footer className="bg-[#061719] border-t border-white/10 px-6 py-7">
    <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between gap-5 text-xs text-white/55">
      <p><Link href="/" className="font-semibold text-white mr-3">MareSalvo</Link>Un progetto non profit per il Mediterraneo.</p>
      <nav aria-label="Link nel footer" className="flex flex-wrap gap-x-5 gap-y-3">
        <Link href="/questionari" className="hover:text-white">Questionari</Link>
        <Link href="/segnala-rete" className="hover:text-white">Segnala una rete</Link>
        <Link href="/verifica" className="hover:text-white">Verifica certificato</Link>
        <a href="https://www.fipsas.it" target="_blank" rel="noreferrer" className="hover:text-white">FIPSAS ↗</a>
      </nav>
    </div>
  </footer>;
}
