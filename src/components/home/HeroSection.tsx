"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { ArrowRight, Shield, Map, Award } from "lucide-react";
import { Button } from "@/components/ui/Button";

gsap.registerPlugin(ScrollTrigger);

const FISH_PATHS = [
  "M 0,0 Q 30,-15 60,0 Q 90,15 120,0 L 110,5 Q 80,10 60,5 Q 40,0 10,5 Z",
  "M 0,0 Q 25,-10 50,0 Q 75,10 100,0 L 95,4 Q 70,8 50,4 Q 30,0 5,4 Z",
  "M 0,0 Q 20,-8 40,0 Q 60,8 80,0 L 75,3 Q 55,6 40,3 Q 25,0 5,3 Z",
];

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fishContainerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.from(overlayRef.current, { opacity: 0, duration: 1 })
        .from(titleRef.current, { y: 80, opacity: 0, duration: 1.2 }, "-=0.5")
        .from(subtitleRef.current, { y: 40, opacity: 0, duration: 1 }, "-=0.7")
        .from(ctaRef.current, { y: 30, opacity: 0, duration: 0.8 }, "-=0.5");

      if (videoRef.current) {
        gsap.to(videoRef.current, {
          scale: 1.08,
          duration: 20,
          ease: "none",
          repeat: -1,
          yoyo: true,
        });
      }

      const fishElements = fishContainerRef.current?.querySelectorAll(".fish");
      fishElements?.forEach((fish, i) => {
        gsap.to(fish, {
          x: `+=${200 + i * 80}`,
          y: `+=${(i % 2 === 0 ? 1 : -1) * 30}`,
          duration: 12 + i * 3,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });

        gsap.to(fish, {
          opacity: 0.15 + (i % 3) * 0.1,
          duration: 3 + i,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
      });

      gsap.to(".wave-layer", {
        x: -100,
        duration: 8,
        ease: "none",
        repeat: -1,
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          poster="/images/hero-poster.svg"
          className="absolute inset-0 w-full h-full object-cover scale-105"
        >
          <source src="/videos/ocean-hero.mp4" type="video/mp4" />
        </video>

        <div
          ref={overlayRef}
          className="absolute inset-0 bg-gradient-to-b from-[var(--color-deep-blue)]/70 via-[var(--color-ocean)]/50 to-[var(--color-deep-blue)]"
        />

        <div ref={fishContainerRef} className="absolute inset-0 pointer-events-none overflow-hidden">
          {FISH_PATHS.map((path, i) => (
            <svg
              key={i}
              className="fish absolute"
              style={{
                top: `${15 + i * 22}%`,
                left: `${-10 + i * 25}%`,
                width: `${80 + i * 20}px`,
                opacity: 0.2,
              }}
              viewBox="0 0 120 20"
            >
              <path d={path} fill="var(--color-seafoam)" />
            </svg>
          ))}
        </div>

        <svg
          className="wave-layer absolute bottom-0 left-0 w-[200%] h-32 opacity-10"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
        >
          <path
            d="M0,60 C360,120 720,0 1080,60 C1260,90 1380,30 1440,60 L1440,120 L0,120 Z"
            fill="var(--color-aqua)"
          />
        </svg>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center pt-32 pb-20">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm text-white/80 mb-8">
          <Shield className="h-4 w-4 text-[var(--color-aqua)]" />
          Piattaforma ufficiale FIPSAS — Pesca in Apnea
        </div>

        <h1
          ref={titleRef}
          className="text-4xl sm:text-5xl md:text-7xl font-bold text-white leading-tight tracking-tight mb-6"
        >
          Qualifica, certifica,
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-aqua)] to-[var(--color-seafoam)]">
            proteggi il mare
          </span>
        </h1>

        <p
          ref={subtitleRef}
          className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Gestione centralizzata delle qualifiche apnea, emissione certificati con
          verifica QR, autorizzazioni e mappa interattiva delle aree marine
          protette italiane.
        </p>

        <div ref={ctaRef} className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/dashboard">
            <Button variant="primary" size="lg">
              Area Pescatore
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link href="/mappa">
            <Button variant="secondary" size="lg">
              <Map className="h-5 w-5" />
              Esplora le AMP
            </Button>
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {[
            { icon: Award, label: "Qualifiche apnea", desc: "Livelli A → Pro" },
            { icon: Shield, label: "Certificati digitali", desc: "Verifica QR pubblica" },
            { icon: Map, label: "Mappe AMP", desc: "27+ aree protette" },
          ].map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="flex flex-col items-center p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10"
            >
              <Icon className="h-6 w-6 text-[var(--color-aqua)] mb-2" />
              <span className="text-white font-medium text-sm">{label}</span>
              <span className="text-white/40 text-xs">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
