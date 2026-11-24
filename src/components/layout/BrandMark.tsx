import Image from 'next/image';

export function BrandMark({ className = '' }: { className?: string }) {
  return <Image src="/images/maiolica-logo-transparent.png" alt="" width={44} height={44}
    sizes="44px" className={`shrink-0 object-contain ${className}`} />;
}
