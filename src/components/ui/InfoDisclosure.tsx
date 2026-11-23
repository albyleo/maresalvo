import type { ReactNode } from 'react';
import { ChevronDown, Info } from 'lucide-react';

export function InfoDisclosure({ children, label = 'Info' }: { children: ReactNode; label?: string }) {
  return <details className="info-disclosure group/info">
    <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 border border-white/20 px-3 py-2 text-sm text-sky-100 hover:border-sky-200/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-200 [&::-webkit-details-marker]:hidden">
      <Info size={16} aria-hidden="true"/>{label}
      <ChevronDown size={14} aria-hidden="true" className="transition-transform group-open/info:rotate-180 motion-reduce:transition-none"/>
    </summary>
    <div className="mt-4 space-y-3 text-sm leading-6 text-sky-100/75">{children}</div>
  </details>;
}
