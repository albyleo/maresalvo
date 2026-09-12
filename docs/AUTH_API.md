# Autenticazione — Piano API MareSalvo FIPSAS

> Historical design document. For the implemented certification pilot, hardened
> role assignments and current setup, use [PILOT_SETUP.md](PILOT_SETUP.md) and
> migration `003_certification_pilot.sql`. The role in signup metadata is ignored;
> staff access is scoped and certificate issuance uses database RPCs.

## Panoramica

L'autenticazione usa **Supabase Auth** con sessioni cookie-based via `@supabase/ssr`. I ruoli applicativi vivono nella tabella `profiles`, collegata a `auth.users`.

## Ruoli

| Ruolo | Codice DB | Accesso |
|-------|-----------|---------|
| Super Admin nazionale | `super_admin` | Tutto, incluso pannello admin |
| Comitato regionale | `regional_committee` | Admin regionale, pratiche, certificati |
| Circolo / Istruttore | `club_instructor` | Qualifiche circolo, pratiche limitate |
| Pescatore | `fisherman` | Area personale, richieste |
| Verifica pubblica | `public_verifier` | Solo endpoint verifica (anonimo) |

## Flussi

### 1. Registrazione pescatore

```
POST Supabase Auth signUp
  → trigger DB handle_new_user()
  → INSERT profiles (role: fisherman)
  → redirect /dashboard
```

**Campi meta signup:**
- `first_name`, `last_name`, `role` (default: fisherman)

### 2. Login email/password

```
POST Supabase Auth signInWithPassword
  → cookie session impostato da middleware
  → redirect /dashboard (o ?redirect= param)
```

### 3. OAuth (fase 2 — opzionale)

Supabase supporta Google/Microsoft. Configurare in Supabase Dashboard → Authentication → Providers.

Callback URL Vercel:
```
https://tuodominio.vercel.app/api/auth/callback
```

### 4. Logout

```
POST /api/auth/signout
  → supabase.auth.signOut()
  → redirect /
```

### 5. Refresh sessione

Gestito automaticamente dal middleware (`src/middleware.ts`) su ogni richiesta protetta.

## Route protette

| Route | Ruoli ammessi |
|-------|---------------|
| `/dashboard/*` | Qualsiasi utente autenticato |
| `/admin/*` | `super_admin`, `regional_committee`, `club_instructor` |
| `/api/admin/*` | Stessi ruoli admin (fase 2) |

## API Routes implementate

### `GET /api/auth/callback`

Scambia il code OAuth/magic link per sessione.

**Query params:** `code`, `next` (default: `/dashboard`)

### `POST /api/auth/signout`

Termina la sessione corrente.

### `GET /api/certificates/verify/[code]`

Verifica pubblica certificato per codice QR o seriale.

**Response 200:**
```json
{
  "verification_code": "abc123...",
  "serial_number": "CERT-2026-XYZ",
  "title": "Apnea B — Intermedio",
  "certificate_type": "qualification",
  "status": "issued",
  "issued_at": "2026-01-15T00:00:00Z",
  "expires_at": "2028-01-15T00:00:00Z",
  "first_name": "Mario",
  "last_name": "Rossi",
  "qualification_level": "Apnea B — Intermedio"
}
```

**Response 404:** certificato non trovato o revocato.

### `GET /api/marine-areas`

Lista AMP attive (pubblico).

## API da implementare (Fase 2)

| Endpoint | Metodo | Auth | Descrizione |
|----------|--------|------|-------------|
| `/api/qualifications` | GET | fisherman+ | Lista qualifiche utente |
| `/api/qualifications` | POST | instructor+ | Assegna qualifica |
| `/api/certificates` | POST | instructor+ | Emetti certificato PDF |
| `/api/permits` | GET/POST | fisherman+ | CRUD richieste |
| `/api/permits/[id]/approve` | PATCH | committee+ | Approva pratica |
| `/api/admin/stats` | GET | admin | Dashboard KPI |

## Row Level Security (RLS)

Le policy PostgreSQL in `supabase/migrations/001_initial_schema.sql` garantiscono:

- Pescatore: legge/scrive solo i propri dati
- Staff: legge tutti i profili e pratiche del proprio ambito
- AMP: lettura pubblica
- Certificati: verifica via view `public_certificate_verification`

## Setup Supabase

1. Crea progetto su [supabase.com](https://supabase.com)
2. Esegui migration: `supabase/migrations/001_initial_schema.sql`
3. Esegui seed: `supabase/seed.sql`
4. Copia URL e anon key in `.env.local`
5. In Authentication → URL Configuration:
   - Site URL: `https://tuodominio.vercel.app`
   - Redirect URLs: `http://localhost:3000/**`, `https://tuodominio.vercel.app/**`

## Variabili ambiente Vercel

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY  (solo server-side, per job admin)
NEXT_PUBLIC_APP_URL
```

## Sicurezza

- **Mai** esporre `SUPABASE_SERVICE_ROLE_KEY` al client
- Validare ruolo lato server su ogni API admin (non fidarsi solo del middleware)
- Rate limiting su `/api/certificates/verify/*` (fase 2)
- Audit log su ogni emissione/revoca certificato
