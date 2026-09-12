import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";
import { ADMIN_NAV, ADMIN_ROLES, ROLE_LABELS } from "@/lib/constants";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login?redirect=/admin");
  }

  if (!ADMIN_ROLES.includes(profile.role)) {
    redirect("/dashboard");
  }

  return (
    <div className="pt-24 pb-12 min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">Pannello Admin FIPSAS</h1>
          <Badge variant="warning">
            {ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS]}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <aside>
            <Card glass className="sticky top-28">
              <nav className="space-y-1">
                {ADMIN_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </Card>
          </aside>
          <div className="lg:col-span-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
