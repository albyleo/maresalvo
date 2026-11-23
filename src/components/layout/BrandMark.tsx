/** A coastal seal: a stylised Mediterranean basin and a north star. */
export function BrandMark({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={className}>
    <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="1.25" opacity=".5"/>
    <path d="M8 25 12 19 18 18 21 21 24 20 26 24 29 23 31 25 36 23 40 26 35 30 30 29 27 32 21 29 16 30 12 27Z" fill="currentColor" opacity=".85"/>
    <path d="m27 8 1.3 3.7L32 13l-3.7 1.3L27 18l-1.3-3.7L22 13l3.7-1.3Z" fill="currentColor"/>
    <path d="M13 35c4-2 7 2 11 0s7 2 11 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>;
}
