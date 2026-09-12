"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Waves, AlertCircle } from "lucide-react";
import { isSupabaseConfigured } from '@/lib/supabase/config';

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!isSupabaseConfigured()) { setError('Registrazione non ancora disponibile. Configurazione del servizio in corso.'); setLoading(false); return; }
    try {
    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        data: {
          first_name: form.firstName,
          last_name: form.lastName,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (!data.session) { setConfirmationSent(true); setLoading(false); return; }
    router.push("/dashboard/qualifiche");
    router.refresh();
    } catch { setError('Registrazione non riuscita. Controlla la connessione e riprova.'); }
    finally { setLoading(false); }
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <Waves className="h-10 w-10 text-[var(--color-aqua)] mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-white">Registrati</h1>
        <p className="text-white/50 text-sm mt-2">
          Crea il tuo profilo pescatore FIPSAS
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {confirmationSent && <p role="status" className="text-emerald-200">Controlla la tua email e conferma l’indirizzo tramite il link ricevuto. Poi accedi per iniziare il questionario.</p>}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-white/60 text-sm mb-2">Nome</label>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              required
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-[var(--color-aqua)]/50"
            />
          </div>
          <div>
            <label className="block text-white/60 text-sm mb-2">Cognome</label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              required
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-[var(--color-aqua)]/50"
            />
          </div>
        </div>

        <div>
          <label className="block text-white/60 text-sm mb-2">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-[var(--color-aqua)]/50"
          />
        </div>

        <div>
          <label className="block text-white/60 text-sm mb-2">Password</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={8}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-[var(--color-aqua)]/50"
          />
        </div>

        <Button type="submit" variant="primary" className="w-full" disabled={loading || confirmationSent}>
          {loading ? "Registrazione..." : "Crea account"}
        </Button>
      </form>

      <p className="text-center text-white/40 text-sm mt-6">
        Hai già un account?{" "}
        <Link href="/login" className="text-[var(--color-aqua)] hover:underline">
          Accedi
        </Link>
      </p>
    </div>
  );
}
