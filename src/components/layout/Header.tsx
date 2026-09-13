"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, Waves } from "lucide-react";
import { APP_NAME, PUBLIC_NAV } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-[#061719]/75 px-5 py-3 backdrop-blur-xl">
          <Link href="/" className="flex items-center gap-2 group">
            <Waves className="h-7 w-7 text-[var(--color-aqua)] transition-transform group-hover:scale-110" />
            <span className="text-lg font-bold text-white tracking-tight">
              {APP_NAME}
            </span>
            <span className="hidden sm:inline text-xs text-white/40 font-normal ml-1">
              FIPSAS
            </span>
          </Link>

          <div className="hidden xl:flex items-center gap-1">
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-4 py-2 rounded-full text-sm transition-colors",
                  pathname === item.href
                    ? "text-[var(--color-aqua)] bg-white/5"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="hidden xl:flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Accedi
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="primary" size="sm">
                Area Pescatore
              </Button>
            </Link>
          </div>

          <button
            className="xl:hidden text-white p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </nav>

        {mobileOpen && (
          <div id="mobile-navigation" className="xl:hidden mt-2 rounded-2xl border border-white/10 bg-[var(--color-deep-blue)]/95 backdrop-blur-xl p-4 space-y-2">
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-4 py-3 rounded-xl text-white/80 hover:bg-white/5"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-2 flex flex-col gap-2">
              <Link href="/login" onClick={() => setMobileOpen(false)}>
                <Button variant="secondary" size="sm" className="w-full">
                  Accedi
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
