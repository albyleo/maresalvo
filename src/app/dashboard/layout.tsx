import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DASHBOARD_NAV, ROLE_LABELS } from "@/lib/constants";
import { LogOut } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login?redirect=/dashboard");
  }

  return (
    <div className="pt-24 pb-12 min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <aside className="lg:col-span-1">
            <Card glass className="sticky top-28">
              <div className="mb-6">
                <p className="text-white font-semibold">
                  {profile.first_name} {profile.last_name}
                </p>
                <Badge variant="info" className="mt-2">
                  {ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS]}
                </Badge>
                {profile.fipsas_card_number && (
                  <p className="text-white/40 text-xs mt-2 font-mono">
                    Tessera: {profile.fipsas_card_number}
                  </p>
                )}
              </div>

              <nav className="space-y-1">
                {DASHBOARD_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <form action="/api/auth/signout" method="POST" className="mt-6 pt-6 border-t border-white/10">
                <button
                  type="submit"
                  className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors w-full px-3 py-2"
                >
                  <LogOut className="h-4 w-4" />
                  Esci
                </button>
              </form>
            </Card>
          </aside>

          <div className="lg:col-span-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
