"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Hand } from 'lucide-react';

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
      <div className="border-y border-white/25 bg-[#071e23]/95 px-7 py-6 text-center mx-5 max-w-sm">
        <button ref={entry} type="button" onClick={activate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#b7e5d5] text-[#071e23] font-medium px-5 py-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"><Hand size={18}/>Attiva mappa</button>
        <p className="mt-3 text-sm text-white/70">Scorri per continuare la pagina. Attiva la mappa per spostarti e usare lo zoom.</p>
      </div>
    </div> : <div className="absolute inset-0 pointer-events-none z-40">
      <div className="map-gesture-toolbar w-fit mx-auto rounded-sm bg-[#071e23]/80 backdrop-blur-md border border-white/15 pointer-events-auto">
        <button ref={exit} type="button" aria-label="Esci dalla mappa" onClick={() => deactivate(true)} className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-white/85 hover:bg-white/10 transition-colors focus-visible:outline-2 focus-visible:outline-white rounded-sm">
          <span className="map-exit-desktop items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300"/>Mappa attiva<span className="text-white/30">·</span><kbd className="rounded border border-white/25 px-1.5 py-0.5 text-[10px]">esc</kbd> per uscire</span>
          <span className="map-exit-mobile items-center gap-2"><ArrowLeft size={15}/>Indietro<span className="text-white/40">alla pagina</span></span>
        </button>
      </div>
    </div>}
  </div>;
}
