"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, Waves } from "lucide-react";
import { APP_NAME, PUBLIC_NAV } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    if (!mobileOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [mobileOpen]);

  return (
    <header className="site-header fixed top-0 left-0 right-0 z-50" data-menu-open={mobileOpen}>
      <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
        <nav aria-label="Navigazione principale" className="flex min-h-20 items-center justify-between gap-4">
          <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 group">
            <Waves className="h-6 w-6 text-[var(--color-aqua)]" />
            <span className="text-lg font-medium text-white tracking-tight">
              {APP_NAME}
            </span>
            <span className="hidden sm:inline border-l border-white/35 pl-3 ml-2 text-[9px] tracking-[.12em] text-white/80 font-normal">
              FIPSAS
            </span>
          </Link>

          <div className="hidden xl:flex items-center gap-1">
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
                className={cn(
                  "px-3 py-2 border-b text-[13px] transition-colors",
                  pathname === item.href
                    ? "text-white border-sky-200"
                    : "text-white/90 border-transparent hover:text-white hover:border-white/60"
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login" onClick={() => setMobileOpen(false)} className="text-sm text-white border border-white/45 px-4 py-2.5 hover:bg-white/10 hover:border-white transition-colors">Login</Link>
          <button
            className="xl:hidden text-white p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          </div>
        </nav>

        {mobileOpen && (
          <div id="mobile-navigation" className="xl:hidden border-t border-white/15 pb-6 max-h-[calc(100dvh-80px)] overflow-y-auto">
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
                className={cn("block py-3 border-b border-white/10 text-base hover:text-[var(--color-aqua)]",pathname===item.href?'text-[var(--color-aqua)]':'text-white/80')}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
