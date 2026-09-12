-- MareSalvo — Monitoraggio marino: reti perse (ghost nets) + segnalazioni pesca illegale
-- Eseguire dopo 001_initial_schema.sql

-- Enum
CREATE TYPE ghost_net_status AS ENUM (
  'reported',
  'verified',
  'recovery_planned',
  'recovered',
  'rejected'
);

CREATE TYPE gear_type AS ENUM (
  'net',
  'longline',
  'trap',
  'rope',
  'other'
);

CREATE TYPE illegal_report_source AS ENUM (
  'ais_geofence',
  'citizen',
  'patrol'
);

CREATE TYPE illegal_report_status AS ENUM (
  'open',
  'under_review',
  'forwarded',
  'dismissed'
);

-- Reti perse a mare (crowd reporting GPS)
CREATE TABLE ghost_net_reports (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status       ghost_net_status NOT NULL DEFAULT 'reported',
  gear_type    gear_type NOT NULL DEFAULT 'net',
  lat          NUMERIC(9,6) NOT NULL,
  lng          NUMERIC(9,6) NOT NULL,
  geom         GEOGRAPHY(POINT, 4326),
  depth_m      INTEGER,
  description  TEXT,
  photo_url    TEXT,
  contact_info TEXT,
  assigned_to  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reported_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  recovered_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ghost_nets_status ON ghost_net_reports(status);
CREATE INDEX idx_ghost_nets_geom ON ghost_net_reports USING GIST(geom);

-- Popola geom da lat/lng automaticamente
CREATE OR REPLACE FUNCTION set_ghost_net_geom() RETURNS TRIGGER AS $$
BEGIN
  NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ghost_net_geom
  BEFORE INSERT OR UPDATE ON ghost_net_reports
  FOR EACH ROW EXECUTE FUNCTION set_ghost_net_geom();

-- Segnalazioni / alert pesca illegale
CREATE TABLE illegal_fishing_reports (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source      illegal_report_source NOT NULL DEFAULT 'citizen',
  status      illegal_report_status NOT NULL DEFAULT 'open',
  area_id     UUID REFERENCES marine_protected_areas(id) ON DELETE SET NULL,
  vessel_name VARCHAR(200),
  mmsi        VARCHAR(20),
  lat         NUMERIC(9,6) NOT NULL,
  lng         NUMERIC(9,6) NOT NULL,
  geom        GEOGRAPHY(POINT, 4326),
  description TEXT,
  photo_url   TEXT,
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_illegal_status ON illegal_fishing_reports(status);
CREATE INDEX idx_illegal_geom ON illegal_fishing_reports USING GIST(geom);

CREATE OR REPLACE FUNCTION set_illegal_geom() RETURNS TRIGGER AS $$
BEGIN
  NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_illegal_geom
  BEFORE INSERT OR UPDATE ON illegal_fishing_reports
  FOR EACH ROW EXECUTE FUNCTION set_illegal_geom();

-- RLS
ALTER TABLE ghost_net_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE illegal_fishing_reports ENABLE ROW LEVEL SECURITY;

-- Chiunque può creare una segnalazione (anche anonima/pubblica)
CREATE POLICY "ghost_nets_insert_any" ON ghost_net_reports
  FOR INSERT WITH CHECK (true);

-- Le segnalazioni verificate/recuperate sono pubblicamente leggibili sulla mappa
CREATE POLICY "ghost_nets_select_public" ON ghost_net_reports
  FOR SELECT USING (true);

CREATE POLICY "illegal_insert_any" ON illegal_fishing_reports
  FOR INSERT WITH CHECK (true);

-- Le segnalazioni di pesca illegale NON sono pubbliche: solo staff
CREATE POLICY "illegal_select_staff" ON illegal_fishing_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('super_admin', 'regional_committee', 'club_instructor')
    )
  );
