# Database — Schema MareSalvo FIPSAS

## Diagramma relazioni

```
auth.users
    └── profiles (1:1)
            ├── fisherman_qualifications → qualification_levels
            ├── medical_certificates
            ├── certificates
            ├── permit_requests → authorizations
            └── notifications

clubs → regions
marine_protected_areas → amp_data_sources
audit_logs (standalone)
```

## Tabelle principali

### `profiles`
Estende `auth.users` con dati FIPSAS: ruolo, tessera, circolo, regione.

### `qualification_levels`
Catalogo livelli apnea (AP-A → AP-PRO). Seed incluso.

### `fisherman_qualifications`
Istanza qualifica per pescatore con stato, date esame/emissione/scadenza.

### `certificates`
Documenti emessi con:
- `serial_number` — univoco human-readable
- `verification_code` — per QR e verifica pubblica
- `qr_payload` — URL completo verifica
- `pdf_url` — storage Supabase/S3

### `permit_requests` + `authorizations`
Workflow richiesta → approvazione → permesso con scadenza.

### `marine_protected_areas`
Geometrie PostGIS (`geometry`, `centroid`), metadati pesca, link regolamento.
Campo `source_id` traccia la fonte dati (ISPRA/MASE) e `source_updated_at` la data aggiornamento.

### `audit_logs`
Tracciabilità compliance: chi ha fatto cosa, quando, su quale entità.

## Setup

### Opzione A — Supabase (consigliata)

```bash
# 1. Crea progetto Supabase
# 2. Abilita PostGIS: Database → Extensions → postgis
# 3. Esegui in SQL Editor:
#    - supabase/migrations/001_initial_schema.sql
#    - supabase/seed.sql
```

### Opzione B — Prisma

```bash
cp .env.example .env.local
# Configura DATABASE_URL
npx prisma db push
npx prisma generate
```

> Nota: Prisma schema non include geometrie PostGIS. Per AMP con poligoni usa Supabase SQL direttamente o raw queries.

## Import geometrie AMP

1. Scarica GeoJSON/WFS da ISPRA
2. Trasforma in SRID 4326
3. Import con:

```sql
INSERT INTO marine_protected_areas (name, slug, geometry, source_id, ...)
SELECT
  properties->>'name',
  lower(replace(properties->>'name', ' ', '-')),
  ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326),
  (SELECT id FROM amp_data_sources WHERE name LIKE '%ISPRA%'),
  ...
FROM staging_amp_import;
```

## Conteggio AMP

Il seed include 5 aree di esempio. Il conteggio ufficiale varia per fonte:
- ~27 AMP + 2 parchi sommersi + Santuario Pelagos (fonte divulgativa)
- ~26 AMP istituite (fonte istituzionale RAI/MASE)

L'app traccia `area_type` e `source_id` per gestire le discrepanze.

## Indici e performance

- GIST su `marine_protected_areas.geometry` per query spatial
- Indici su `verification_code`, `serial_number`, `status`
- View `public_certificate_verification` per lookup veloce senza join sensibili

## Backup

Supabase Pro: backup automatici giornalieri.
Per self-hosted: `pg_dump` schedulato + replica read-only per reportistica.
