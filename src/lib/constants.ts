import type { AmpFishingStatus, NavItem, UserRole } from "@/types";

export const APP_NAME = "MareSalvo";
export const APP_DESCRIPTION =
  "Piattaforma FIPSAS per qualifiche apnea, certificati, autorizzazioni e aree marine protette italiane.";

export const FIPSAS_COLORS = {
  deepBlue: "#0B1D3A",
  ocean: "#1A5276",
  aqua: "#2EAFB8",
  seafoam: "#7FDBDA",
  sand: "#F5F0E8",
  coral: "#E07A5F",
} as const;

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  regional_committee: "Comitato Regionale",
  club_instructor: "Circolo / Istruttore",
  fisherman: "Pescatore",
  public_verifier: "Verifica Pubblica",
};

export const FISHING_STATUS_LABELS: Record<AmpFishingStatus, string> = {
  allowed: "Consentita",
  restricted: "Limitata",
  prohibited: "Vietata",
  seasonal: "Stagionale",
  unknown: "Da verificare",
};

export const FISHING_STATUS_COLORS: Record<AmpFishingStatus, string> = {
  allowed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  restricted: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  prohibited: "bg-red-500/20 text-red-300 border-red-500/30",
  seasonal: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  unknown: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

export const PUBLIC_NAV: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Mappa marina", href: "/mappa" },
  { label: "Segnala rete", href: "/segnala-rete" },
  { label: "Verifica Certificato", href: "/verifica" },
  { label: "Qualifiche", href: "/qualifiche" },
];

export const DASHBOARD_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Il mio profilo", href: "/dashboard/profilo" },
  { label: "Qualifiche e questionari", href: "/dashboard/qualifiche" },
  { label: "Certificati", href: "/dashboard/certificati" },
  { label: "Autorizzazioni", href: "/dashboard/autorizzazioni" },
];

export const ADMIN_NAV: NavItem[] = [
  { label: "Pannello", href: "/admin" },
  { label: "Pratiche", href: "/admin/pratiche" },
  { label: "Reti perse", href: "/admin/reti-perse" },
  { label: "Monitoraggio pesca", href: "/admin/monitoraggio" },
];

export const ADMIN_ROLES: UserRole[] = [
  "super_admin",
  "regional_committee",
  "club_instructor",
];

export const STATS_PLACEHOLDER = {
  fishermen: 12450,
  certificates: 8320,
  ampAreas: 29,
  clubs: 380,
};
