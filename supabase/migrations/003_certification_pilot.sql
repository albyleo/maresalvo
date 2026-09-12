-- Apply after 001 and 002. Pilot content does not confer a fishing/sport permit.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'first_name', 'Nuovo'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'Utente'), 'fisherman');
  RETURN NEW;
END;
$$;

-- Role, membership, and activation changes require a trusted administrative channel.
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (first_name, last_name, birth_date, phone, address, city, province, postal_code, avatar_url)
  ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.can_review_profile(target uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles actor JOIN public.profiles applicant ON applicant.id = target
    WHERE actor.id = auth.uid() AND actor.is_active AND applicant.is_active AND (
      actor.role = 'super_admin' OR
      (actor.role = 'regional_committee' AND actor.region_id = applicant.region_id) OR
      (actor.role = 'club_instructor' AND actor.club_id = applicant.club_id)
    )
  );
$$;
DROP POLICY profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.can_review_profile(id));
DROP POLICY profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() AND public.get_user_role() IS NOT NULL)
  WITH CHECK (id = auth.uid());

DROP POLICY qualifications_select ON public.fisherman_qualifications;
DROP POLICY qualifications_insert ON public.fisherman_qualifications;
DROP POLICY qualifications_update ON public.fisherman_qualifications;
CREATE POLICY qualifications_select ON public.fisherman_qualifications FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.can_review_profile(profile_id));
-- Issuance is restricted to the transactional review function below.
REVOKE INSERT, UPDATE, DELETE ON public.fisherman_qualifications FROM anon, authenticated;
DROP POLICY certificates_select ON public.certificates;
DROP POLICY certificates_insert ON public.certificates;
CREATE POLICY certificates_select ON public.certificates FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.can_review_profile(profile_id));
REVOKE INSERT, UPDATE, DELETE ON public.certificates FROM anon, authenticated;
DROP POLICY medical_select ON public.medical_certificates;
DROP POLICY medical_insert ON public.medical_certificates;
CREATE POLICY medical_select ON public.medical_certificates FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.can_review_profile(profile_id));
CREATE POLICY medical_insert ON public.medical_certificates FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid() AND verified_by IS NULL AND verified_at IS NULL AND NOT is_valid);
ALTER TABLE public.medical_certificates ALTER COLUMN is_valid SET DEFAULT false;
DROP POLICY permits_select ON public.permit_requests;
DROP POLICY permits_insert ON public.permit_requests;
DROP POLICY permits_update ON public.permit_requests;
CREATE POLICY permits_select ON public.permit_requests FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.can_review_profile(profile_id));
CREATE POLICY permits_insert ON public.permit_requests FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid() AND status = 'draft' AND reviewed_by IS NULL AND reviewed_at IS NULL);
CREATE POLICY permits_update ON public.permit_requests FOR UPDATE TO authenticated
  USING (profile_id = auth.uid() AND status = 'draft') WITH CHECK (profile_id = auth.uid() AND status = 'draft');
REVOKE UPDATE ON public.permit_requests FROM anon, authenticated;
GRANT UPDATE (title, description, requested_area, start_date, end_date) ON public.permit_requests TO authenticated;
DROP POLICY authorizations_select ON public.authorizations;
CREATE POLICY authorizations_select ON public.authorizations FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.can_review_profile(profile_id));
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_staff_read ON public.audit_logs FOR SELECT USING (public.get_user_role() = 'super_admin');
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.regions, public.clubs, public.qualification_levels,
  public.amp_data_sources FROM anon, authenticated;

-- Public map reads exclude contact and assignment details, and only expose moderated reports.
DROP POLICY ghost_nets_select_public ON public.ghost_net_reports;
CREATE POLICY ghost_nets_select_public ON public.ghost_net_reports FOR SELECT USING (
  status IN ('verified', 'recovery_planned', 'recovered') OR reporter_id = auth.uid() OR public.is_admin_or_committee());
REVOKE SELECT ON public.ghost_net_reports FROM anon, authenticated;
GRANT SELECT (id, reporter_id, status, gear_type, lat, lng, depth_m, description, photo_url, reported_at, recovered_at)
  ON public.ghost_net_reports TO anon, authenticated;
DROP POLICY ghost_nets_insert_any ON public.ghost_net_reports;
CREATE POLICY ghost_nets_insert_any ON public.ghost_net_reports FOR INSERT WITH CHECK (
  status = 'reported' AND (reporter_id IS NULL OR reporter_id = auth.uid()) AND assigned_to IS NULL
  AND recovered_at IS NULL AND lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180
  AND (depth_m IS NULL OR depth_m >= 0));
DROP POLICY illegal_insert_any ON public.illegal_fishing_reports;
CREATE POLICY illegal_insert_any ON public.illegal_fishing_reports FOR INSERT WITH CHECK (
  source = 'citizen' AND status = 'open' AND (reporter_id IS NULL OR reporter_id = auth.uid())
  AND reviewed_by IS NULL AND reviewed_at IS NULL AND lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180);

CREATE TABLE public.questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  description text NOT NULL,
  pass_percent integer NOT NULL CHECK (pass_percent BETWEEN 1 AND 100),
  is_demo boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT false,
  UNIQUE (title, version)
);
CREATE TABLE public.questionnaire_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id uuid NOT NULL REFERENCES public.questionnaires(id),
  position integer NOT NULL,
  prompt text NOT NULL,
  options jsonb NOT NULL CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) >= 2),
  UNIQUE (questionnaire_id, position)
);
CREATE TABLE public.questionnaire_answer_keys (
  question_id uuid PRIMARY KEY REFERENCES public.questionnaire_questions(id),
  correct_option integer NOT NULL CHECK (correct_option >= 0)
);
CREATE TABLE public.certification_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  questionnaire_id uuid NOT NULL REFERENCES public.questionnaires(id),
  questionnaire_title text NOT NULL,
  questionnaire_version integer NOT NULL,
  is_demo boolean NOT NULL,
  answers jsonb NOT NULL,
  correct_answers integer NOT NULL,
  total_questions integer NOT NULL,
  score_percent integer NOT NULL,
  status text NOT NULL CHECK (status IN ('failed', 'pending', 'approved', 'rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  review_notes text,
  certificate_id uuid UNIQUE REFERENCES public.certificates(id)
);
CREATE UNIQUE INDEX one_open_certification ON public.certification_applications(profile_id, questionnaire_id)
  WHERE status IN ('pending', 'approved');
CREATE INDEX certification_queue ON public.certification_applications(status, submitted_at);
ALTER TABLE public.questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_answer_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certification_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY questionnaires_read ON public.questionnaires FOR SELECT TO authenticated USING (is_active);
CREATE POLICY questions_read ON public.questionnaire_questions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.questionnaires q WHERE q.id = questionnaire_id AND q.is_active));
CREATE POLICY applications_read ON public.certification_applications FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.can_review_profile(profile_id));
REVOKE ALL ON public.questionnaire_answer_keys FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.questionnaires, public.questionnaire_questions,
  public.certification_applications FROM anon, authenticated;
GRANT SELECT ON public.questionnaires, public.questionnaire_questions, public.certification_applications TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_questionnaire(p_questionnaire_id uuid, p_answers jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  q public.questionnaires; question record; selected integer; correct integer := 0;
  total integer := 0; score integer; result uuid; owner_id uuid := auth.uid();
BEGIN
  IF public.get_user_role() IS NULL THEN RAISE EXCEPTION 'Account attivo richiesto'; END IF;
  -- Serialize submissions per applicant, including retry limit and pending checks.
  PERFORM 1 FROM public.profiles WHERE id = owner_id FOR UPDATE;
  SELECT * INTO q FROM public.questionnaires WHERE id = p_questionnaire_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Questionario non disponibile'; END IF;
  IF jsonb_typeof(p_answers) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Risposte non valide'; END IF;
  IF EXISTS (SELECT 1 FROM public.certification_applications WHERE profile_id = owner_id
    AND questionnaire_id = q.id AND status IN ('pending', 'approved')) THEN
    RAISE EXCEPTION 'Esiste già una richiesta in revisione o approvata';
  END IF;
  IF (SELECT count(*) FROM public.certification_applications WHERE profile_id = owner_id
    AND questionnaire_id = q.id AND submitted_at > now() - interval '1 day') >= 5 THEN
    RAISE EXCEPTION 'Limite di 5 tentativi in 24 ore raggiunto';
  END IF;
  FOR question IN SELECT item.*, key.correct_option FROM public.questionnaire_questions item
    LEFT JOIN public.questionnaire_answer_keys key ON key.question_id = item.id
    WHERE item.questionnaire_id = q.id LOOP
    IF question.correct_option IS NULL OR question.correct_option >= jsonb_array_length(question.options) THEN
      RAISE EXCEPTION 'Configurazione questionario incompleta';
    END IF;
    IF jsonb_typeof(p_answers -> question.id::text) IS DISTINCT FROM 'number'
      OR (p_answers ->> question.id::text) !~ '^[0-9]{1,3}$' THEN
      RAISE EXCEPTION 'Rispondi a tutte le domande';
    END IF;
    selected := (p_answers ->> question.id::text)::integer;
    IF selected >= jsonb_array_length(question.options) THEN RAISE EXCEPTION 'Opzione non valida'; END IF;
    total := total + 1;
    IF selected = question.correct_option THEN correct := correct + 1; END IF;
  END LOOP;
  IF total = 0 OR (SELECT count(*) FROM jsonb_object_keys(p_answers)) <> total THEN
    RAISE EXCEPTION 'Risposte non valide';
  END IF;
  score := floor(100.0 * correct / total);
  INSERT INTO public.certification_applications (profile_id, questionnaire_id, questionnaire_title,
    questionnaire_version, is_demo, answers, correct_answers, total_questions, score_percent, status)
  VALUES (owner_id, q.id, q.title, q.version, q.is_demo, p_answers, correct, total, score,
    CASE WHEN score >= q.pass_percent THEN 'pending' ELSE 'failed' END) RETURNING id INTO result;
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id)
    VALUES (owner_id, 'questionnaire.submitted', 'certification_application', result);
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_certification(p_application_id uuid, p_approve boolean, p_notes text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.certification_applications; cert uuid; code text; serial text;
BEGIN
  SELECT * INTO a FROM public.certification_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_review_profile(a.profile_id) OR a.profile_id = auth.uid() THEN
    RAISE EXCEPTION 'Revisione non consentita';
  END IF;
  IF p_approve IS NULL THEN RAISE EXCEPTION 'Decisione richiesta'; END IF;
  IF a.status <> 'pending' THEN RAISE EXCEPTION 'Richiesta già elaborata'; END IF;
  IF length(COALESCE(p_notes, '')) > 1000 OR (NOT p_approve AND length(trim(COALESCE(p_notes, ''))) = 0) THEN
    RAISE EXCEPTION 'Inserisci una motivazione valida (massimo 1000 caratteri)';
  END IF;
  -- Only the non-official pilot is enabled until approved content and requirements exist.
  IF p_approve AND NOT a.is_demo THEN RAISE EXCEPTION 'Emissione ufficiale non ancora abilitata'; END IF;
  IF p_approve THEN
    code := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    serial := 'DEMO-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 24));
    INSERT INTO public.certificates (serial_number, verification_code, profile_id, certificate_type,
      title, status, issued_at, expires_at, issued_by, qr_payload, metadata)
    VALUES (serial, code, a.profile_id, 'demo_training', a.questionnaire_title, 'issued', now(),
      now() + interval '1 year', auth.uid(), '/verifica?code=' || code,
      jsonb_build_object('is_demo', true, 'application_id', a.id, 'questionnaire_version', a.questionnaire_version,
        'holder_first_name', (SELECT first_name FROM public.profiles WHERE id = a.profile_id),
        'holder_last_name', (SELECT last_name FROM public.profiles WHERE id = a.profile_id)))
      RETURNING id INTO cert;
  END IF;
  UPDATE public.certification_applications SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    reviewed_by = auth.uid(), reviewed_at = now(), review_notes = trim(p_notes), certificate_id = cert WHERE id = a.id;
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_values)
    VALUES (auth.uid(), CASE WHEN p_approve THEN 'certificate.issued' ELSE 'application.rejected' END,
      'certification_application', a.id, jsonb_build_object('certificate_id', cert, 'notes', p_notes));
  RETURN cert;
END;
$$;

-- Prevent enumeration of the former public view; verify a specific opaque code instead.
REVOKE ALL ON public.public_certificate_verification FROM anon, authenticated;
CREATE OR REPLACE FUNCTION public.verify_certificate(p_code text)
RETURNS TABLE (verification_code varchar, serial_number varchar, title varchar, certificate_type varchar,
  status public.certificate_status, issued_at timestamptz, expires_at timestamptz,
  first_name varchar, last_name varchar, qualification_level varchar)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT c.verification_code, c.serial_number, c.title, c.certificate_type,
    CASE WHEN c.status = 'issued' AND c.expires_at <= now() THEN 'expired'::public.certificate_status ELSE c.status END,
    c.issued_at, c.expires_at, COALESCE(c.metadata->>'holder_first_name', p.first_name)::varchar,
    COALESCE(c.metadata->>'holder_last_name', p.last_name)::varchar, NULL::varchar
  FROM public.certificates c JOIN public.profiles p ON p.id = c.profile_id
  WHERE length(p_code) BETWEEN 8 AND 64 AND (c.verification_code = p_code OR c.serial_number = p_code)
    AND c.status <> 'draft' LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.submit_questionnaire(uuid, jsonb), public.review_certification(uuid, boolean, text),
  public.verify_certificate(text), public.can_review_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_questionnaire(uuid, jsonb), public.review_certification(uuid, boolean, text),
  public.can_review_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated;

-- Deliberately trivial test content: these questions are not a FIPSAS examination.
INSERT INTO public.questionnaires (id, title, version, description, pass_percent, is_demo, is_active)
VALUES ('10000000-0000-4000-8000-000000000001', 'MareSalvo — percorso dimostrativo', 1,
  'Prova tecnica del percorso di registrazione, questionario e revisione. Non costituisce qualifica o permesso.', 100, true, true);
INSERT INTO public.questionnaire_questions (id, questionnaire_id, position, prompt, options) VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 1,
   'Questo questionario è una prova tecnica o un esame ufficiale?', '["Una prova tecnica", "Un esame ufficiale FIPSAS"]'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 2,
   'Dopo il superamento, chi deve esaminare la richiesta?', '["Nessuno", "Un membro autorizzato dello staff"]'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 3,
   'Il certificato dimostrativo autorizza la pesca?', '["Sì", "No, non è un permesso"]');
INSERT INTO public.questionnaire_answer_keys VALUES
  ('20000000-0000-4000-8000-000000000001', 0),
  ('20000000-0000-4000-8000-000000000002', 1),
  ('20000000-0000-4000-8000-000000000003', 1);
COMMIT;
