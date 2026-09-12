-- FIPSAS Apnea Platform — Schema iniziale PostgreSQL/Supabase
-- Eseguire in Supabase SQL Editor o via CLI: supabase db push

-- Estensioni
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Enum types
CREATE TYPE user_role AS ENUM (
  'super_admin',
  'regional_committee',
  'club_instructor',
  'fisherman',
  'public_verifier'
);

CREATE TYPE qualification_status AS ENUM (
  'pending',
  'active',
  'expired',
  'suspended',
  'revoked'
);

CREATE TYPE certificate_status AS ENUM (
  'draft',
  'issued',
  'revoked',
  'expired'
);

CREATE TYPE permit_status AS ENUM (
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'expired',
  'revoked'
);

CREATE TYPE permit_type AS ENUM (
  'competition',
  'training',
  'special_event',
  'amp_access',
  'other'
);

CREATE TYPE amp_area_type AS ENUM (
  'amp',
  'parco_sommerso',
  'santuario',
  'riserva',
  'zone_informativa'
);

CREATE TYPE amp_fishing_status AS ENUM (
  'allowed',
  'restricted',
  'prohibited',
  'seasonal',
  'unknown'
);

-- Regioni italiane (riferimento FIPSAS)
CREATE TABLE regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(3) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Circoli / sezioni
CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region_id UUID NOT NULL REFERENCES regions(id),
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  city VARCHAR(100),
  province VARCHAR(5),
  email VARCHAR(255),
  phone VARCHAR(30),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profili utente (collegati a auth.users di Supabase)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'fisherman',
  club_id UUID REFERENCES clubs(id),
  region_id UUID REFERENCES regions(id),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR NOT NULL,
  fiscal_code VARCHAR(16),
  birth_date DATE,
  phone VARCHAR(30),
  address TEXT,
  city VARCHAR(100),
  province VARCHAR(5),
  postal_code VARCHAR(10),
  fipsas_card_number VARCHAR(30) UNIQUE,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Catalogo livelli qualifica apnea FIPSAS
CREATE TABLE qualification_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  min_age INTEGER,
  validity_months INTEGER NOT NULL DEFAULT 24,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Qualifiche assegnate ai pescatori
CREATE TABLE fisherman_qualifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  level_id UUID NOT NULL REFERENCES qualification_levels(id),
  status qualification_status NOT NULL DEFAULT 'pending',
  issued_at DATE,
  expires_at DATE,
  issued_by UUID REFERENCES profiles(id),
  exam_date DATE,
  exam_location VARCHAR(200),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, level_id, issued_at)
);

-- Certificati medici / idoneità
CREATE TABLE medical_certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_name VARCHAR(200),
  issued_at DATE NOT NULL,
  expires_at DATE NOT NULL,
  document_url TEXT,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  is_valid BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Certificati FIPSAS emessi (PDF + QR)
CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  serial_number VARCHAR(30) NOT NULL UNIQUE,
  verification_code VARCHAR(64) NOT NULL UNIQUE,
  profile_id UUID NOT NULL REFERENCES profiles(id),
  qualification_id UUID REFERENCES fisherman_qualifications(id),
  certificate_type VARCHAR(50) NOT NULL DEFAULT 'qualification',
  title VARCHAR(200) NOT NULL,
  status certificate_status NOT NULL DEFAULT 'draft',
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  issued_by UUID REFERENCES profiles(id),
  pdf_url TEXT,
  qr_payload TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Richieste autorizzazione
CREATE TABLE permit_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_number VARCHAR(30) NOT NULL UNIQUE,
  profile_id UUID NOT NULL REFERENCES profiles(id),
  permit_type permit_type NOT NULL,
  status permit_status NOT NULL DEFAULT 'draft',
  title VARCHAR(200) NOT NULL,
  description TEXT,
  requested_area TEXT,
  start_date DATE,
  end_date DATE,
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Autorizzazioni approvate
CREATE TABLE authorizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  permit_request_id UUID NOT NULL REFERENCES permit_requests(id),
  authorization_number VARCHAR(30) NOT NULL UNIQUE,
  verification_code VARCHAR(64) NOT NULL UNIQUE,
  profile_id UUID NOT NULL REFERENCES profiles(id),
  permit_type permit_type NOT NULL,
  title VARCHAR(200) NOT NULL,
  conditions TEXT,
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  approved_by UUID REFERENCES profiles(id),
  pdf_url TEXT,
  qr_payload TEXT NOT NULL,
  status permit_status NOT NULL DEFAULT 'approved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fonti dati AMP (ISPRA, MASE, ecc.)
CREATE TABLE amp_data_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  url TEXT,
  wms_url TEXT,
  wfs_url TEXT,
  last_synced_at TIMESTAMPTZ,
  version_label VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Aree marine protette
CREATE TABLE marine_protected_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id VARCHAR(100),
  source_id UUID REFERENCES amp_data_sources(id),
  name VARCHAR(300) NOT NULL,
  slug VARCHAR(300) NOT NULL UNIQUE,
  area_type amp_area_type NOT NULL DEFAULT 'amp',
  region_name VARCHAR(100),
  managing_body VARCHAR(200),
  description TEXT,
  regulation_url TEXT,
  fishing_status amp_fishing_status NOT NULL DEFAULT 'unknown',
  fishing_notes TEXT,
  seasonality TEXT,
  area_km2 DECIMAL(12, 4),
  geometry GEOMETRY(MultiPolygon, 4326),
  centroid GEOMETRY(Point, 4326),
  properties JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Log audit per compliance
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES profiles(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifiche
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  type VARCHAR(50) NOT NULL DEFAULT 'info',
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indici
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_club ON profiles(club_id);
CREATE INDEX idx_profiles_fipsas_card ON profiles(fipsas_card_number);
CREATE INDEX idx_qualifications_profile ON fisherman_qualifications(profile_id);
CREATE INDEX idx_qualifications_status ON fisherman_qualifications(status);
CREATE INDEX idx_certificates_profile ON certificates(profile_id);
CREATE INDEX idx_certificates_verification ON certificates(verification_code);
CREATE INDEX idx_permit_requests_profile ON permit_requests(profile_id);
CREATE INDEX idx_permit_requests_status ON permit_requests(status);
CREATE INDEX idx_authorizations_profile ON authorizations(profile_id);
CREATE INDEX idx_mpa_geometry ON marine_protected_areas USING GIST(geometry);
CREATE INDEX idx_mpa_region ON marine_protected_areas(region_name);
CREATE INDEX idx_mpa_type ON marine_protected_areas(area_type);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_notifications_profile ON notifications(profile_id, is_read);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_clubs_updated_at BEFORE UPDATE ON clubs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_fisherman_qualifications_updated_at BEFORE UPDATE ON fisherman_qualifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_certificates_updated_at BEFORE UPDATE ON certificates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_permit_requests_updated_at BEFORE UPDATE ON permit_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_authorizations_updated_at BEFORE UPDATE ON authorizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_marine_protected_areas_updated_at BEFORE UPDATE ON marine_protected_areas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fisherman_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE permit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE marine_protected_areas ENABLE ROW LEVEL SECURITY;

-- Helper: ruolo utente corrente
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin_or_committee()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() IN ('super_admin', 'regional_committee', 'club_instructor');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS Policies

-- Profiles: utente vede il proprio profilo; admin vedono tutti
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT USING (id = auth.uid() OR is_admin_or_committee());

CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE USING (id = auth.uid() OR get_user_role() = 'super_admin');

-- Qualifiche: pescatore vede le proprie; staff vede tutte
CREATE POLICY qualifications_select ON fisherman_qualifications
  FOR SELECT USING (
    profile_id = auth.uid() OR is_admin_or_committee()
  );

CREATE POLICY qualifications_insert ON fisherman_qualifications
  FOR INSERT WITH CHECK (is_admin_or_committee());

CREATE POLICY qualifications_update ON fisherman_qualifications
  FOR UPDATE USING (is_admin_or_committee());

-- Certificati medici
CREATE POLICY medical_select ON medical_certificates
  FOR SELECT USING (profile_id = auth.uid() OR is_admin_or_committee());

CREATE POLICY medical_insert ON medical_certificates
  FOR INSERT WITH CHECK (profile_id = auth.uid() OR is_admin_or_committee());

-- Certificati emessi
CREATE POLICY certificates_select ON certificates
  FOR SELECT USING (profile_id = auth.uid() OR is_admin_or_committee());

CREATE POLICY certificates_insert ON certificates
  FOR INSERT WITH CHECK (is_admin_or_committee());

-- Richieste permessi
CREATE POLICY permits_select ON permit_requests
  FOR SELECT USING (profile_id = auth.uid() OR is_admin_or_committee());

CREATE POLICY permits_insert ON permit_requests
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY permits_update ON permit_requests
  FOR UPDATE USING (profile_id = auth.uid() OR is_admin_or_committee());

-- Autorizzazioni
CREATE POLICY authorizations_select ON authorizations
  FOR SELECT USING (profile_id = auth.uid() OR is_admin_or_committee());

-- AMP: lettura pubblica
CREATE POLICY mpa_public_read ON marine_protected_areas
  FOR SELECT USING (is_active = TRUE);

-- Notifiche
CREATE POLICY notifications_select ON notifications
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY notifications_update ON notifications
  FOR UPDATE USING (profile_id = auth.uid());

-- Funzione: crea profilo al signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, first_name, last_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'Nuovo'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'Utente'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'fisherman')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Funzione: genera codice verifica
CREATE OR REPLACE FUNCTION generate_verification_code()
RETURNS TEXT AS $$
  SELECT replace(gen_random_uuid()::text, '-', '');
$$ LANGUAGE sql;

-- Vista pubblica verifica certificato (senza dati sensibili)
CREATE VIEW public_certificate_verification AS
SELECT
  c.verification_code,
  c.serial_number,
  c.title,
  c.certificate_type,
  c.status,
  c.issued_at,
  c.expires_at,
  p.first_name,
  p.last_name,
  ql.name AS qualification_level
FROM certificates c
JOIN profiles p ON p.id = c.profile_id
LEFT JOIN fisherman_qualifications fq ON fq.id = c.qualification_id
LEFT JOIN qualification_levels ql ON ql.id = fq.level_id
WHERE c.status = 'issued';
