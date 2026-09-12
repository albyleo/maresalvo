"use client";

import { useState } from "react";
import { MapPin, Crosshair, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import type { GearType } from "@/types";

const GEAR_OPTIONS: { value: GearType; label: string }[] = [
  { value: "net", label: "Rete" },
  { value: "longline", label: "Palamito" },
  { value: "trap", label: "Nassa" },
  { value: "rope", label: "Cima / cavo" },
  { value: "other", label: "Altro" },
];

export default function SegnalaRetePage() {
  const [gearType, setGearType] = useState<GearType>("net");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [depth, setDepth] = useState("");
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  function getLocation() {
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoError("Geolocalizzazione non disponibile su questo dispositivo.");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setGeoLoading(false);
      },
      () => {
        setGeoError("Impossibile ottenere la posizione. Inserisci le coordinate manualmente.");
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    if (Number.isNaN(latN) || Number.isNaN(lngN)) {
      setError("Inserisci coordinate valide (puoi usare il pulsante GPS).");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/ghost-nets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gear_type: gearType,
          lat: latN,
          lng: lngN,
          depth_m: depth ? parseInt(depth, 10) : null,
          description: description || null,
          contact_info: contact || null,
        }),
      });
      if (!res.ok) { const result = await res.json(); throw new Error(result.error || 'Errore invio'); }
      setDone(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Si è verificato un errore durante l'invio. Riprova.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="pt-28 pb-16 px-4">
        <div className="mx-auto max-w-lg">
          <Card glass className="text-center">
            <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
            <CardTitle>Segnalazione inviata</CardTitle>
            <CardDescription>
              Grazie. La tua segnalazione di rete persa è stata registrata e sarà
              verificata dallo staff. Contribuisci a un mare più pulito.
            </CardDescription>
            <Button
              variant="outline"
              className="mt-6"
              onClick={() => {
                setDone(false);
                setLat("");
                setLng("");
                setDepth("");
                setDescription("");
                setContact("");
              }}
            >
              Nuova segnalazione
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-28 pb-16 px-4">
      <div className="mx-auto max-w-lg">
        <div className="text-center mb-8">
          <MapPin className="h-12 w-12 text-[var(--color-aqua)] mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">
            Segnala una rete persa
          </h1>
          <p className="text-white/50">
            Hai trovato una rete fantasma, una nassa o un palamito abbandonato in
            mare? Segnalalo: aiuti il recupero e proteggi la fauna marina.
          </p>
        </div>

        <Card glass>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-white/70 text-sm mb-2">Tipo di attrezzo</label>
              <div className="grid grid-cols-3 gap-2">
                {GEAR_OPTIONS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setGearType(g.value)}
                    className={`px-3 py-2 rounded-lg text-xs border transition-colors ${
                      gearType === g.value
                        ? "bg-[var(--color-aqua)]/20 border-[var(--color-aqua)]/40 text-white"
                        : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-2">Posizione GPS</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Latitudine"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 outline-none focus:border-[var(--color-aqua)]/50"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Longitudine"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 outline-none focus:border-[var(--color-aqua)]/50"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={getLocation}
                disabled={geoLoading}
                className="w-full"
              >
                <Crosshair className="h-4 w-4" />
                {geoLoading ? "Rilevamento..." : "Usa la mia posizione"}
              </Button>
              {geoError && (
                <p className="text-amber-300 text-xs mt-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {geoError}
                </p>
              )}
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-2">
                Profondità stimata (m) — opzionale
              </label>
              <input
                type="number"
                min="0"
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-[var(--color-aqua)]/50"
              />
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-2">Descrizione</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Dimensioni, condizioni, riferimenti utili al recupero..."
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 outline-none focus:border-[var(--color-aqua)]/50 resize-none"
              />
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-2">
                Contatto (opzionale)
              </label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Email o telefono, se vuoi essere ricontattato"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 outline-none focus:border-[var(--color-aqua)]/50"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
              {submitting ? "Invio in corso..." : "Invia segnalazione"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
