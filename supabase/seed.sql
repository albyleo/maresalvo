-- Seed dati iniziali FIPSAS Apnea Platform

INSERT INTO regions (code, name) VALUES
  ('ABR', 'Abruzzo'),
  ('BAS', 'Basilicata'),
  ('CAL', 'Calabria'),
  ('CAM', 'Campania'),
  ('EMR', 'Emilia-Romagna'),
  ('FVG', 'Friuli-Venezia Giulia'),
  ('LAZ', 'Lazio'),
  ('LIG', 'Liguria'),
  ('LOM', 'Lombardia'),
  ('MAR', 'Marche'),
  ('MOL', 'Molise'),
  ('PIE', 'Piemonte'),
  ('PUG', 'Puglia'),
  ('SAR', 'Sardegna'),
  ('SIC', 'Sicilia'),
  ('TOS', 'Toscana'),
  ('TAA', 'Trentino-Alto Adige'),
  ('UMB', 'Umbria'),
  ('VDA', 'Valle d''Aosta'),
  ('VEN', 'Veneto');

INSERT INTO qualification_levels (code, name, description, min_age, validity_months, sort_order) VALUES
  ('AP-A', 'Apnea A — Base', 'Introduzione alla pesca in apnea, sicurezza e regolamento base', 14, 24, 1),
  ('AP-B', 'Apnea B — Intermedio', 'Tecniche avanzate, gestione profondità e attrezzatura', 16, 24, 2),
  ('AP-C', 'Apnea C — Avanzato', 'Competizione e istruttoria di base', 18, 24, 3),
  ('AP-D', 'Apnea D — Istruttore', 'Abilitazione all''insegnamento e supervisione attività', 21, 36, 4),
  ('AP-PRO', 'Apnea Pro — Competizione', 'Qualifica agonistica nazionale', 18, 12, 5);

INSERT INTO amp_data_sources (name, provider, url, version_label) VALUES
  ('Aree Protette Marine ISPRA', 'ISPRA', 'https://www.isprambiente.gov.it', '2024'),
  ('Rete Natura 2000 — Zone marine', 'MASE/ISPRA', 'https://www.minambiente.it', '2024'),
  ('Portale AMP Italia', 'MASE', 'https://www.minambiente.it/pagina/aree-marine-protette', '2024');

-- Esempio AMP (senza geometria — da importare da GeoJSON ufficiale)
INSERT INTO marine_protected_areas (name, slug, area_type, region_name, managing_body, fishing_status, fishing_notes, description, regulation_url) VALUES
  (
    'Portofino',
    'portofino',
    'amp',
    'Liguria',
    'Ente Parco di Portofino',
    'prohibited',
    'Pesca sportiva e commerciale vietata nella zona A integrale',
    'Area Marina Protetta istituita nel 1999, tra le più note del Mediterraneo.',
    'https://www.portofinoamp.it'
  ),
  (
    'Plemmirio',
    'plemmirio',
    'amp',
    'Sicilia',
    'Assessorato Territorio e Ambiente Regione Sicilia',
    'restricted',
    'Zone A vietate; zone B con regolamentazione stagionale',
    'AMP istituita nel 2004, costa sud-est di Siracusa.',
    'https://www.regione.sicilia.it'
  ),
  (
    'Santuario Pelagos',
    'santuario-pelagos',
    'santuario',
    'Internazionale',
    'Accordo Italia-Francia-Monaco',
    'restricted',
    'Regolamentazione specifica per cetacei e attività umane',
    'Santuario internazionale per la protezione dei mammiferi marini nel Mediterraneo nord-occidentale.',
    'https://www.sanctuary.pelagos.org'
  ),
  (
    'Torre Guaceto',
    'torre-guaceto',
    'amp',
    'Puglia',
    'Consorzio di Gestione Torre Guaceto',
    'restricted',
    'Zone A integrali; zone B con limitazioni',
    'AMP in Puglia, istituita nel 1991, estesa nel 2000.',
    'https://www.riservatorreguaceto.it'
  ),
  (
    'Cinque Terre',
    'cinque-terre',
    'amp',
    'Liguria',
    'Ente Parco Nazionale Cinque Terre',
    'restricted',
    'Regolamentazione differenziata per zone A, B, C',
    'AMP istituita nel 1997 nel Parco Nazionale delle Cinque Terre.',
    'https://www.parconazionale5terre.it'
  );
