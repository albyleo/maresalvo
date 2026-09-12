import { LoginForm } from "@/features/auth/LoginForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accedi",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="min-h-[80vh] flex items-center justify-center pt-24 pb-12 px-4">
      <div className="w-full max-w-md">
        {error === 'confirmation' && <p role="alert" className="text-amber-200 mb-6">Il link di conferma non è valido o è scaduto. Se hai già confermato l’indirizzo, accedi qui sotto.</p>}
        <LoginForm />
      </div>
    </div>
  );
}
