"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Sezione "immersione" guidata dallo scroll (GSAP ScrollTrigger scrub).
 *
 * IMPORTANTE: usiamo position: sticky (CSS) per tenere fissa la scena durante
 * lo scroll, NON pin:true di ScrollTrigger. Il pin di GSAP avvolge l'elemento
 * in un "pin-spacer" spostando i nodi nel DOM: in React/Next questo rompe la
 * riconciliazione e provoca "Failed to execute removeChild" quando si cambia
 * pagina. Con sticky il DOM non viene mai spostato e lo scrub resta fluido.
 *
 * Stesso pattern usato per lo scrubbing di sequenze video frame-by-frame:
 * basta legare progress (0->1) all'indice del frame su un canvas.
 */
const STAGES = [
  { depth: "0 m", title: "Superficie", text: "Mappa marina e ricerca AMP." },
  { depth: "-10 m", title: "Batimetria", text: "Profondita reali da EMODnet." },
  { depth: "-25 m", title: "Aree protette", text: "Zonazione A/B/C e regolamenti." },
  { depth: "-40 m", title: "Fondale", text: "Reti perse e tutela dell'habitat." },
];

export function ScrollDiveSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const waterRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const depthRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 1,
        },
      });

      tl.to(
        waterRef.current,
        { background: "linear-gradient(to bottom, #0B1D3A 0%, #04060f 100%)", ease: "none" },
        0
      );

      tl.to(markerRef.current, { top: "85%", ease: "none" }, 0);

      const counter = { v: 0 };
      tl.to(
        counter,
        {
          v: 40,
          ease: "none",
          onUpdate: () => {
            if (depthRef.current)
              depthRef.current.textContent = `-${Math.round(counter.v)} m`;
          },
        },
        0
      );

      gsap.utils.toArray<HTMLElement>(".dive-stage").forEach((stage, i) => {
        tl.fromTo(
          stage,
          { opacity: 0, x: 60 },
          { opacity: 1, x: 0, duration: 0.5 },
          i * 0.9
        ).to(stage, { opacity: 0.25, duration: 0.4 }, i * 0.9 + 0.6);
      });

      gsap.utils.toArray<HTMLElement>(".bubble").forEach((b, i) => {
        gsap.to(b, {
          y: -200,
          opacity: 0,
          duration: 4 + i,
          repeat: -1,
          ease: "sine.in",
          delay: i * 0.7,
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative h-[300vh]">
      <div className="sticky top-0 h-screen overflow-hidden flex items-center">
        <div
          ref={waterRef}
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, #1A5276 0%, #0B1D3A 100%)" }}
        />

        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="bubble absolute rounded-full bg-white/20"
              style={{
                left: `${8 + i * 8}%`,
                bottom: `${10 + (i % 4) * 15}%`,
                width: `${4 + (i % 3) * 4}px`,
                height: `${4 + (i % 3) * 4}px`,
              }}
            />
          ))}
        </div>

        <div className="absolute left-8 top-0 bottom-0 w-px bg-white/15">
          <div
            ref={markerRef}
            className="absolute left-1/2 -translate-x-1/2"
            style={{ top: "8%" }}
          >
            <div className="h-3 w-3 rounded-full bg-[var(--color-aqua)] shadow-[0_0_12px_var(--color-aqua)]" />
            <span
              ref={depthRef}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-seafoam)] text-sm font-mono whitespace-nowrap"
            >
              0 m
            </span>
          </div>
        </div>

        <div className="relative z-10 mx-auto max-w-4xl px-6 w-full">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-12 text-center">
            Immergiti nei dati del mare
          </h2>
          <div className="space-y-6 max-w-md mx-auto">
            {STAGES.map((s) => (
              <div
                key={s.title}
                className="dive-stage flex items-center gap-4 p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10"
              >
                <span className="text-[var(--color-aqua)] font-mono text-sm w-14">
                  {s.depth}
                </span>
                <div>
                  <p className="text-white font-semibold">{s.title}</p>
                  <p className="text-white/50 text-sm">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
