import Link from "next/link";
import { Waves } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[var(--color-deep-blue)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Waves className="h-6 w-6 text-[var(--color-aqua)]" />
              <span className="text-lg font-bold text-white">{APP_NAME}</span>
            </div>
            <p className="text-white/50 text-sm leading-relaxed max-w-md">
              Piattaforma ufficiale FIPSAS per la gestione delle qualifiche in
              apnea, l&apos;emissione di certificati e autorizzazioni, e la
              consultazione delle aree marine protette italiane.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4 text-sm">Piattaforma</h4>
            <ul className="space-y-2 text-sm text-white/50">
              <li><Link href="/mappa" className="hover:text-[var(--color-aqua)] transition-colors">Mappa AMP</Link></li>
              <li><Link href="/verifica" className="hover:text-[var(--color-aqua)] transition-colors">Verifica Certificato</Link></li>
              <li><Link href="/qualifiche" className="hover:text-[var(--color-aqua)] transition-colors">Qualifiche Apnea</Link></li>
              <li><Link href="/login" className="hover:text-[var(--color-aqua)] transition-colors">Accedi</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4 text-sm">Risorse</h4>
            <ul className="space-y-2 text-sm text-white/50">
              <li>
                <a href="https://www.fipsas.it" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-aqua)] transition-colors">
                  FIPSAS.it
                </a>
              </li>
              <li>
                <a href="https://www.minambiente.it/pagina/aree-marine-protette" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-aqua)] transition-colors">
                  AMP — MASE
                </a>
              </li>
              <li>
                <a href="https://www.isprambiente.gov.it" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-aqua)] transition-colors">
                  ISPRA
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-white/30 text-xs">
            © {new Date().getFullYear()} {APP_NAME} — FIPSAS Federazione Italiana Pesca Sportiva e Attività Subacquee
          </p>
          <p className="text-white/20 text-xs">
            Dati AMP: fonti ISPRA/MASE — aggiornamento versionato
          </p>
        </div>
      </div>
    </footer>
  );
}
