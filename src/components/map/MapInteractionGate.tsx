"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

type Props = { children: ReactNode; className: string; enabled?: boolean };

/** Only storytelling pages need an explicit entry step before capturing gestures. */
export function MapInteractionGate({ enabled = true, ...props }: Props) {
  return enabled ? <GatedMap {...props}/> : <div className={props.className} data-interactive="true">{props.children}</div>;
}

function GatedMap({ children, className }: Props) {
  const [active, setActive] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const entry = useRef<HTMLButtonElement>(null);
  const exit = useRef<HTMLButtonElement>(null);
  const mobileHistory = useRef(false);
  const deactivate = (restoreFocus = false) => {
    if (mobileHistory.current && window.history.state?.mareSalvoMap) {
      mobileHistory.current = false;
      window.history.back();
    }
    setActive(false);
    if (restoreFocus) requestAnimationFrame(() => entry.current?.focus({ preventScroll: true }));
  };
  const activate = () => {
    if (window.matchMedia('(max-width: 640px), (pointer: coarse)').matches) {
      window.history.pushState({ ...window.history.state, mareSalvoMap: true }, '', window.location.href);
      mobileHistory.current = true;
    }
    setActive(true);
    root.current?.scrollIntoView({block:'start', behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  };
  useEffect(() => {
    const back = () => {
      if (!mobileHistory.current) return;
      mobileHistory.current = false;
      setActive(false);
      requestAnimationFrame(() => entry.current?.focus({ preventScroll: true }));
    };
    window.addEventListener('popstate', back);
    return () => {
      window.removeEventListener('popstate', back);
      if (mobileHistory.current && window.history.state?.mareSalvoMap) {
        const state = { ...window.history.state };
        delete state.mareSalvoMap;
        window.history.replaceState(state, '', window.location.href);
      }
    };
  }, []);
  useEffect(() => {
    const observer = new IntersectionObserver(([item]) => {
      if (!item.isIntersecting && !mobileHistory.current) setActive(false);
    });
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!active) return;
    exit.current?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (!mobileHistory.current && event.target instanceof Node && !root.current?.contains(event.target)) setActive(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [active]);
  return <div ref={root} className={`map-interaction-gate ${className}`} data-interactive={active}
    onKeyDown={event => { if (active && event.key === 'Escape') { event.stopPropagation(); deactivate(true); } }}>
    <div inert={!active} className="absolute inset-0" style={{ pointerEvents: active ? 'auto' : 'none' }}>{children}</div>
    {!active ? <div className="map-entry-overlay absolute inset-0 z-40 grid place-items-center">
      <button ref={entry} type="button" onClick={activate} className="rounded-sm border border-white/25 bg-[#b7d6c9] text-[#071e23] text-sm font-medium px-6 py-3 hover:bg-[#d2e6dd] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Attiva la mappa</button>
    </div> : <div className="absolute inset-0 pointer-events-none z-40">
      <div className="map-gesture-toolbar pointer-events-auto">
        <button ref={exit} type="button" aria-label="Esci dalla mappa" title="Torna alla pagina · Esc o Indietro" onClick={() => deactivate(true)} className="grid place-items-center w-11 h-11 border border-white/35 bg-[#071d35]/95 text-white hover:bg-[#164361] transition-colors focus-visible:outline-2 focus-visible:outline-white">
          <ArrowLeft size={20}/>
        </button>
      </div>
    </div>}
  </div>;
}
