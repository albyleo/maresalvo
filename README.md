# MareSalvo — Piattaforma FIPSAS Apnea

## Certification pilot

The first executable pilot covers registration → sample questionnaire → staff review →
demo certificate PDF + QR verification. See [pilot setup](docs/PILOT_SETUP.md) for the
three database migrations, public environment variables and two-account acceptance test.
The sample content is not FIPSAS-approved and does not issue a fishing or sport permit.
Other feature descriptions below include planned and demonstration functionality.

Webapp moderna per la gestione delle qualifiche in apnea, certificati digitali con verifica QR, autorizzazioni e mappa marina 3D interattiva: aree marine protette italiane, batimetria (profondità), monitoraggio della pesca illegale (AIS) e segnalazione GPS delle reti perse.

## Stack

| Layer | Tecnologia |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Animazioni | GSAP + ScrollTrigger (hero video + dive scroll-scrub) |
| Mappe 2D/3D | MapLibre GL JS — batimetria EMODnet, AMP WMS, OpenSeaMap, satellite Esri, AIS |
| Globo Earth 3D | Cesium + Google Photorealistic 3D Tiles (fallback satellite Esri) |
| Auth & DB | Supabase (PostgreSQL + PostGIS + RLS) |
| ORM (opz.) | Prisma |
| Deploy | Vercel |
| Repo | GitHub |

## Funzionalità principali

- **Qualifiche apnea**: livelli A→Pro, esami, validità, rinnovi.
- **Certificati & autorizzazioni**: emissione con seriale univoco e verifica QR pubblica.
- **Mappa marina 3D** (MapLibre GL): AMP ufficiali, batimetria/profondità (EMODnet), simbologia nautica (OpenSeaMap), satellite Esri, toggle layer, vista inclinata 3D con terreno opzionale.
- **Selettore mappa**: switch tra "Mappa marina" (MapLibre) e "Earth 3D" — globo fotorealistico tipo Google Earth (Cesium + Google Photorealistic 3D Tiles, fallback satellite Esri senza chiave).
- **Reti perse a mare**: segnalazione pubblica geolocalizzata via GPS (`/segnala-rete`) con workflow report→verifica→recupero.
- **Monitoraggio pesca illegale**: overlay AIS + geofencing AMP (hook Global Fishing Watch), segnalazioni cittadine. Strumento di supporto/segnalazione, non sanzionatorio.

## Struttura cartelle

```
maresalvo/
├── src/
│   ├── app/                    # App Router Next.js
│   │   ├── page.tsx            # Homepage con hero GSAP + dive scroll
│   │   ├── mappa/              # Mappa marina 3D full-screen
│   │   ├── segnala-rete/       # Segnalazione GPS reti perse (pubblico)
│   │   ├── verifica/           # Verifica certificato QR
│   │   ├── qualifiche/         # Catalogo livelli
│   │   ├── login/              # Auth
│   │   ├── dashboard/          # Area pescatore
│   │   ├── admin/              # Pannello FIPSAS (+ reti-perse, monitoraggio)
│   │   └── api/                # API routes (ghost-nets, ais, ...)
│   ├── components/
│   │   ├── ui/                 # Button, Card, Badge
│   │   ├── layout/             # Header, Footer
│   │   ├── home/               # Hero, Stats, Features, ScrollDive (GSAP)
│   │   └── map/                # MarineMap + MapLibre GL canvas
│   ├── features/
│   │   ├── auth/               # LoginForm, RegisterForm
│   │   └── marine-map/         # config layer + data (AMP, reti, AIS)
│   ├── lib/
│   │   ├── supabase/           # Client, server, middleware
│   │   ├── constants.ts
│   │   └── utils.ts
│   └── types/
├── supabase/
│   ├── migrations/             # Schema SQL completo
│   └── seed.sql                # Dati iniziali
├── prisma/
│   └── schema.prisma           # Schema alternativo
├── docs/
│   ├── AUTH_API.md             # Piano autenticazione
│   └── DATABASE.md             # Documentazione schema
└── public/
    ├── images/                 # Poster hero
    ├── videos/                 # Video mare (aggiungere ocean-hero.mp4)
    └── geo/                    # GeoJSON AMP
```

## Quick start

```bash
# Clone e install
git clone https://github.com/tuo-user/maresalvo.git
cd maresalvo
# (se aggiorni un checkout esistente: rm -rf node_modules)
npm install   # installa anche maplibre-gl e qrcode

# Configura ambiente
cp .env.example .env.local
# Compila NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY

# Avvia dev server
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000)

## Setup Supabase

1. Crea progetto su [supabase.com](https://supabase.com)
2. Abilita estensione **PostGIS**
3. Esegui `supabase/migrations/001_initial_schema.sql`
4. Esegui `supabase/migrations/002_marine_monitoring.sql` (reti perse + monitoraggio pesca)
5. Esegui `supabase/migrations/003_certification_pilot.sql` prima di accettare registrazioni
6. Il seed storico `supabase/seed.sql` è facoltativo e contiene dati illustrativi
7. Copia URL progetto e chiave pubblica in `.env.local`; segui `docs/PILOT_SETUP.md`

Vedi [docs/AUTH_API.md](docs/AUTH_API.md) per il piano autenticazione completo.
Vedi [docs/DATABASE.md](docs/DATABASE.md) per lo schema database.
Vedi [docs/MARINE_MAP.md](docs/MARINE_MAP.md) per la mappa marina e l'Earth 3D.

## Earth 3D (Cesium / Google)

La modalità **Earth 3D** usa Cesium. Gli asset statici di Cesium vengono copiati in
`public/cesium` automaticamente da `npm install` (script `postinstall`).

- **Senza chiavi**: il globo funziona subito con il satellite **Esri World Imagery**.
- **Tipo Google Earth**: imposta `NEXT_PUBLIC_GOOGLE_MAPS_KEY` (Google Maps Platform,
  *Map Tiles API* abilitata + fatturazione attiva) per i **Photorealistic 3D Tiles**.
- **Terreno mondiale/geocoder**: imposta `NEXT_PUBLIC_CESIUM_ION_TOKEN` (Cesium ion, gratuito).

> Nota: il 3D fotorealistico mostra la **superficie** (coste, città), non il fondale.
> Il rilievo del fondale viene dai modelli batimetrici (EMODnet/GEBCO) nella mappa marina.
> Non esiste un archivio fotografico globale "storico" del fondale: i satelliti vedono
> solo l'acqua bassa costiera; il resto è sempre modellato.

## Deploy Vercel +
