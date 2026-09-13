# Homepage and training questionnaires

## Homepage

- The 30-second `public/videos/tartaruga.mp4` is preserved.
- `npm run video:prepare` generates `tartaruga-scroll.mp4` (1280px, H.264,
  keyframe every 10 frames, faststart, no audio) and the initial poster.
- The prepared files are committed/deployed with the app. Video preparation is
  intentionally not part of the Vercel build.
- GSAP ScrollTrigger drives the entire film and the four text stages. Initial
  text is visible without an entrance animation. CSS sticky avoids DOM reparenting.
- `object-fit: cover` fills the entire viewport without letterboxing, cropping
  the frame centrally where the screen differs from 16:9. The scene uses `100dvh`
  to follow the visible viewport as mobile browser controls expand or collapse.
- Below 641px, `object-position: 40% center` shifts the film right relative
  to the original centered framing; desktop framing stays centered.
- Reduced motion and “Leggi senza animazioni” expose a static reading layout.
- The map with marine/3D globe selection and a compact footer finish the page.

## Activate the questionnaires in Supabase

Run `supabase/migrations/005_training_questionnaires_v2.sql` after 001–004 have
succeeded. If 004 has not been applied yet, run it first. Do not rerun completed
migrations. Version 2 adds three 15-question paths with new IDs and retires the
version-1 catalogs. Historical questions, answer keys, applications and
certificates are preserved; pending version-1 applications remain reviewable.

- `/questionari` is a public preview; it does not grade or save answers.
- `/dashboard/qualifiche` reads the active database catalog and submits answers
  to the existing protected scoring RPC. Required score is 80% (12/15).
- Question cards progress one at a time, then show an editable response summary.
- Answer keys remain outside the browser catalog and the client bundle. Notes and
  source answers remain in the original supplied text, not in the public preview.
- Generated files come from `npm run questionnaires:generate` and the supplied
  `supabase/content/questionnaires-source-v2.txt`. Generation writes migration
  005 and the public catalog; migration 004 and the original source remain intact.

## Editorial status

These are supplied training drafts, not a verified regulatory examination.
All three remain `is_demo = true`, so approval issues a demo certificate only.
Before official use, FIPSAS/content reviewers must validate jurisdiction, dates,
equipment limits, species rules, medical/safety language and professional-fishing
requirements. Publish reviewed content as a new version rather than changing a
questionnaire that people have already taken.

An explicit correction was made to question 1.9: Article 10 of Regulation (EU)
2019/1154 gives the Mediterranean swordfish closure as 1 January–31 March.
The supplied February–March/October–November answer was not retained in the active
question; the original text remains preserved for comparison.
Source: https://eur-lex.europa.eu/eli/reg/2019/1154/oj/eng

Other supplied answers remain provisional. Particular review priorities include
1.6 (rod/handline limits and per-person versus per-vessel scope), 2.3 (float versus
flag wording), 1.12 (catch marking), 3.3/3.8 (gear-marking and length rules),
3.7 (handling a turtle), 3.9 (logbook requirements) and 3.15 (VMS scope/exemptions).
The supplied changes include reordered apnea questions, the grouper minimum-size
question in place of the daily limit and the loaded-speargun question in place
of the sea-urchin question. Each section includes five additional questions.

## Checks

`node --test scripts/test-certification.mjs` executes the migration and verifies
the three catalogs, browser/database parity, supplied answer mappings, private
answer keys, 12/15 passing versus 11/15 failing, and preservation of version 1.
As before, PGlite omits PostGIS-only parts of the old migrations.

`node --env-file=.env.local scripts/check-supabase.mjs` checks the live verification
RPC without changing records or printing credentials. It does not replace a live
authenticated questionnaire/submission/staff-review acceptance test.

Git commit/push and the final Vercel release remain user-controlled. Include the
prepared video and poster in the commit. On Vercel, configure both public Supabase
variables and `NEXT_PUBLIC_APP_URL=https://maresalvo.vercel.app`; configure matching
Supabase Auth site/redirect URLs as described in PILOT_SETUP.md.
