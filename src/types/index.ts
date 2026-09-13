export type UserRole =
  | "super_admin"
  | "regional_committee"
  | "club_instructor"
  | "fisherman"
  | "public_verifier";

export type QualificationStatus =
  | "pending"
  | "active"
  | "expired"
  | "suspended"
  | "revoked";

export type CertificateStatus = "draft" | "issued" | "revoked" | "expired";

export type PermitStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "expired"
  | "revoked";

export type PermitType =
  | "competition"
  | "training"
  | "special_event"
  | "amp_access"
  | "other";

export type AmpAreaType =
  | "amp"
  | "parco_sommerso"
  | "santuario"
  | "riserva"
  | "zone_informativa";

export type AmpFishingStatus =
  | "allowed"
  | "restricted"
  | "prohibited"
  | "seasonal"
  | "unknown";

export interface Profile {
  id: string;
  role: UserRole;
  club_id: string | null;
  region_id: string | null;
  first_name: string;
  last_name: string;
  fiscal_code: string | null;
  birth_date: string | null;
  phone: string | null;
  fipsas_card_number: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QualificationLevel {
  id: string;
  code: string;
  name: string;
  description: string | null;
  min_age: number | null;
  validity_months: number;
  sort_order: number;
}

export interface FishermanQualification {
  id: string;
  profile_id: string;
  level_id: string;
  status: QualificationStatus;
  issued_at: string | null;
  expires_at: string | null;
  exam_date: string | null;
  exam_location: string | null;
  level?: QualificationLevel;
}

export interface Certificate {
  id: string;
  serial_number: string;
  verification_code: string;
  profile_id: string;
  certificate_type: string;
  title: string;
  status: CertificateStatus;
  issued_at: string | null;
  expires_at: string | null;
  pdf_url: string | null;
}

export interface PermitRequest {
  id: string;
  request_number: string;
  profile_id: string;
  permit_type: PermitType;
  status: PermitStatus;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  submitted_at: string | null;
}

export interface MarineProtectedArea {
  id: string;
  name: string;
  slug: string;
  area_type: AmpAreaType;
  region_name: string | null;
  managing_body: string | null;
  description: string | null;
  regulation_url: string | null;
  fishing_status: AmpFishingStatus;
  fishing_notes: string | null;
  seasonality: string | null;
  area_km2: number | null;
  geometry?: GeoJSON.MultiPolygon | GeoJSON.Polygon;
  centroid?: GeoJSON.Point;
  bounds?: [number, number, number, number];
  source_url?: string;
  source_label?: string;
  source_date?: string;
  zones?: MarineZone[];
}

export interface MarineZone {
  id: string;
  zone: string;
  name: string;
  source_url: string;
  source_label: string;
  notes: string;
}

// --- Segnalazione reti perse a mare (ghost nets) ---
export type GhostNetStatus =
  | "reported" // segnalata
  | "verified" // verificata da admin/circolo
  | "recovery_planned" // recupero pianificato
  | "recovered" // recuperata
  | "rejected"; // segnalazione non valida

export type GearType =
  | "net" // rete
  | "longline" // palamito
  | "trap" // nassa
  | "rope" // cima/cavo
  | "other";

export interface GhostNetReport {
  id: string;
  reporter_id: string | null; // null = segnalazione anonima/pubblica
  status: GhostNetStatus;
  gear_type: GearType;
  lat: number;
  lng: number;
  depth_m: number | null;
  description: string | null;
  photo_url: string | null;
  reported_at: string;
  recovered_at: string | null;
}

// --- Monitoraggio attività di pesca / segnalazioni illecite (AIS + cittadini) ---
export type IllegalReportSource = "ais_geofence" | "citizen" | "patrol";
export type IllegalReportStatus =
  | "open"
  | "under_review"
  | "forwarded" // inoltrata all'autorità competente
  | "dismissed";

export interface IllegalFishingReport {
  id: string;
  source: IllegalReportSource;
  status: IllegalReportStatus;
  area_id: string | null; // AMP coinvolta
  vessel_name: string | null;
  mmsi: string | null; // identificativo AIS
  lat: number;
  lng: number;
  description: string | null;
  detected_at: string;
}

/** Punto AIS/posizione imbarcazione (overlay live, es. Global Fishing Watch). */
export interface AisVesselPoint {
  mmsi: string;
  name: string | null;
  lat: number;
  lng: number;
  speed_kn: number | null;
  course: number | null;
  is_fishing: boolean;
  in_protected_area: boolean;
  timestamp: string;
}

export interface CertificateVerification {
  verification_code: string;
  serial_number: string;
  title: string;
  certificate_type: string;
  status: CertificateStatus;
  issued_at: string | null;
  expires_at: string | null;
  first_name: string;
  last_name: string;
  qualification_level: string | null;
}

export interface NavItem {
  label: string;
  href: string;
  roles?: UserRole[];
}
