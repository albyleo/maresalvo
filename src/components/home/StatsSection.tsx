"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { STATS_PLACEHOLDER } from "@/lib/constants";

gsap.registerPlugin(ScrollTrigger);

interface StatItemProps {
  value: number;
  label: string;
  suffix?: string;
}

function AnimatedStat({ value, label, suffix = "" }: StatItemProps) {
  const numRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = numRef.current;
    if (!el) return;

    const obj = { val: 0 };
    gsap.to(obj, {
      val: value,
      duration: 2.5,
      ease: "power2.out",
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        once: true,
      },
      onUpdate: () => {
        el.textContent = Math.round(obj.val).toLocaleString("it-IT") + suffix;
      },
    });
  }, [value, suffix]);

  return (
    <div className="text-center">
      <span
        ref={numRef}
        className="block text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-[var(--color-aqua)]"
      >
        0
      </span>
      <span className="text-white/50 text-sm mt-2 block">{label}</span>
    </div>
  );
}

export function StatsSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".stat-item", {
        y: 40,
        opacity: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
          once: true,
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="py-24 bg-[var(--color-ocean)]/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="stat-item">
            <AnimatedStat value={STATS_PLACEHOLDER.fishermen} label="Pescatori registrati" />
          </div>
          <div className="stat-item">
            <AnimatedStat value={STATS_PLACEHOLDER.certificates} label="Certificati emessi" />
          </div>
          <div className="stat-item">
            <AnimatedStat value={STATS_PLACEHOLDER.ampAreas} label="AMP censite" suffix="+" />
          </div>
          <div className="stat-item">
            <AnimatedStat value={STATS_PLACEHOLDER.clubs} label="Circoli affiliati" />
          </div>
        </div>
      </div>
    </section>
  );
}
