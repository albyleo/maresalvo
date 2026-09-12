"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Award, FileCheck, MapPin, Users, Waves, AlertTriangle } from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";

gsap.registerPlugin(ScrollTrigger);

const FEATURES = [
  {
    icon: Award,
    title: "Motore qualifiche",
    description:
      "Anagrafica atleta, livelli apnea (A→Pro), visite mediche, idoneità e storico completo delle attività FIPSAS.",
  },
  {
    icon: FileCheck,
    title: "Certificati & QR",
    description:
      "Emissione PDF con seriale univoco e codice QR per verifica pubblica online — niente più invii via email.",
  },
  {
    icon: MapPin,
    title: "Mappa marina 3D",
    description:
      "MapLibre GL con batimetria EMODnet, AMP ufficiali ISPRA/MASE, simbologia nautica e filtri per regione e vincoli pesca.",
  },
  {
    icon: Users,
    title: "Workflow autorizzazioni",
    description:
      "Richiesta → verifica → approvazione → emissione permesso con scadenze, notifiche e audit trail completo.",
  },
  {
    icon: Waves,
    title: "Reti perse a mare",
    description:
      "Segnalazione geolocalizzata via GPS delle reti fantasma, con stato dal report al recupero e layer pubblico sulla mappa.",
  },
  {
    icon: AlertTriangle,
    title: "Monitoraggio pesca",
    description:
      "Overlay AIS e geofencing delle AMP per segnalare attività di pesca sospette, integrabile con Global Fishing Watch.",
  },
];

export function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".feature-card", {
        y: 60,
        opacity: 0,
        duration: 0.8,
        stagger: 0.12,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
          once: true,
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Tutto ciò che serve alla federazione
          </h2>
          <p className="text-white/50 max-w-2xl mx-auto">
            Dalla qualifica del pescatore alla consultazione delle aree protette,
            un unico ecosistema digitale per FIPSAS.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <Card key={title} glass className="feature-card group hover:border-[var(--color-aqua)]/30 transition-colors duration-500">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-[var(--color-aqua)]/10 group-hover:bg-[var(--color-aqua)]/20 transition-colors">
                  <Icon className="h-6 w-6 text-[var(--color-aqua)]" />
                </div>
                <div>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
