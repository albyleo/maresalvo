"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Waves, Mail, Lock, AlertCircle } from "lucide-react";
import { isSupabaseConfigured } from '@/lib/supabase/config';

export function LoginForm({ destination = '/dashboard' }: { destination?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!isSupabaseConfigured()) { setError('Accesso non ancora disponibile. Configurazione del servizio in corso.'); setLoading(false); return; }
    try {
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Credenziali non valide. Riprova.");
      setLoading(false);
      return;
    }

    router.push(destination);
    router.refresh();
    } catch { setError('Connessione non disponibile. Riprova.'); }
    finally { setLoading(false); }
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <Waves className="h-10 w-10 text-[var(--color-aqua)] mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-white">Accedi</h1>
        <p className="text-white/50 text-sm mt-2">
          Area riservata pescatori e staff FIPSAS
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div>
          <label className="block text-white/60 text-sm mb-2">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-[var(--color-aqua)]/50 transition-colors"
              placeholder="nome@email.it"
            />
          </div>
        </div>

        <div>
          <label className="block text-white/60 text-sm mb-2">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-[var(--color-aqua)]/50 transition-colors"
              placeholder="••••••••"
            />
          </div>
        </div>

        <Button type="submit" variant="primary" className="w-full" disabled={loading}>
          {loading ? "Accesso in corso..." : "Accedi"}
        </Button>
      </form>

      <p className="text-center text-white/40 text-sm mt-6">
        Non hai un account?{" "}
        <Link href="/registrazione" className="text-[var(--color-aqua)] hover:underline">
          Registrati
        </Link>
      </p>
    </div>
  );
}
