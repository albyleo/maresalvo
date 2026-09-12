# MareSalvo certification pilot

This milestone implements registration, a sample questionnaire, database scoring,
staff review, demo certificate issuance, PDF download and public QR verification.
The sample is not FIPSAS-approved and confers no sport qualification or permit.
Official issuance is deliberately disabled in the database review function.

## Set up a new Supabase project

1. Create an empty development project. An EU region is a sensible default for this pilot.
2. In the project's connection/API settings, copy the project URL and public
   publishable key (or legacy anon key). Create `.env.local` in the repository:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

   No service-role key or database password is needed by this application workflow.
   Never put those secrets in a `NEXT_PUBLIC_` variable or send them in chat.
   `.env.local` is ignored by git. Restart the dev server after changing it.
3. Open the Supabase SQL editor and run these files in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_marine_monitoring.sql`
   - `supabase/migrations/003_certification_pilot.sql`

   Run all three before accepting signups. They are one-time migrations, not
   scripts to rerun against a populated database. The third migration seeds the
   test questionnaire. The old `supabase/seed.sql` is optional and contains
   illustrative qualification and map records; it is not required for this pilot.
4. In Authentication URL configuration, set the site URL to
   `http://localhost:3000` and allow the exact redirect
   `http://localhost:3000/api/auth/callback`. Keep email confirmation enabled.
   Delivery depends on the project's email-provider configuration and limits.
5. Run `npm run dev`. Register two separate accounts, confirm their email addresses,
   and sign in once: an applicant and a staff reviewer.
6. In the SQL editor, promote only your reviewer account using its exact email:

   ```sql
   UPDATE public.profiles
   SET role = 'super_admin'
   WHERE id = (
     SELECT id FROM auth.users WHERE email = 'YOUR_REVIEWER_EMAIL'
   );
   ```

   The reviewer must be a different account from the applicant. Normal signups
   always receive the fisherman role. Role/club/region assignments are trusted
   administration tasks, not editable profile fields. Regional and club reviewers
   can only review matching assigned applicants; super-admin can review across scopes.

## Pilot acceptance walkthrough

1. Applicant: open `/dashboard/qualifiche`. The sample answers are 1, 2, 2
   (option positions as shown). All three must be correct. Wrong answers create
   a failed attempt; up to five submissions per questionnaire are allowed in 24 hours.
2. A passing submission appears as `In revisione`, with no certificate issued yet.
3. Reviewer: open `/admin/pratiche`, examine the applicant and score, select a
   decision, acknowledge the demo status, then confirm. Rejection requires notes.
4. Applicant: open `/dashboard/certificati` and download the PDF. The live database
   generates one certificate per approved application, even if approval is retried.
5. Open the verification link or scan the QR. It resolves the specific certificate
   and displays issued, expired, or revoked status. The holder's name is snapshotted
   at issuance. Very long names or names unsupported by the PDF's Latin font are
   shown on the verification page instead of being altered in the PDF.
6. Local QR links work only on the computer running localhost. Before a shared
   pilot, configure a reachable HTTPS `NEXT_PUBLIC_APP_URL` and matching Supabase
   site/redirect URLs, then download fresh PDFs.

## Verification and limits

- `npm test` runs PostgreSQL/PGlite permission and transaction tests and PDF tests.
  PGlite simulates Supabase Auth roles/claims and omits PostGIS spatial types,
  indexes and geometry triggers from the original migrations. Migration 003 runs
  unchanged. Real Supabase Auth/email, PostgREST and PostGIS still need the walkthrough.
- `npx tsc --noEmit --incremental false` checks TypeScript.
- `npm run build` checks the production bundle; it may require access to font services.
- Demo PDFs are generated on demand, not uploaded to a public storage bucket.
- Public verification reveals holder identity only for a specific code/serial;
  the former enumerable verification view is inaccessible to API roles.
- Net-report contacts are excluded from public API projections, unmoderated reports
  are not anonymously readable, and submissions fail explicitly when unconfigured.
  The staff net-recovery workflow remains a later milestone.
- Approved questionnaire authoring, official eligibility/medical requirements,
  official certificates/permits, renewal/revocation UI, production abuse controls,
  and authoritative marine/SAR data are not part of this test milestone.

For a future approved questionnaire, publish a new immutable questionnaire/version
and corresponding answer keys through trusted administration. Do not modify a
questionnaire that applicants have already taken.
