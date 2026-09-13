-- Apply once after 005. Existing reports remain intact; new submissions require approval.
BEGIN;

CREATE TABLE public.ghost_net_reporters (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  granted_by uuid NOT NULL REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ghost_net_reporters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ghost_net_reporters FROM anon, authenticated;
GRANT SELECT ON public.ghost_net_reporters TO authenticated;
CREATE POLICY reporters_read ON public.ghost_net_reporters FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.get_user_role() = 'super_admin');

CREATE FUNCTION public.can_report_ghost_net() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active
    AND (p.role = 'super_admin' OR EXISTS (SELECT 1 FROM public.ghost_net_reporters r
      WHERE r.profile_id = p.id AND r.enabled)));
$$;

CREATE FUNCTION public.set_ghost_net_reporter(target uuid, enabled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.get_user_role() IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Operazione non consentita' USING ERRCODE = '42501';
  END IF;
  IF enabled IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target AND is_active) THEN
    RAISE EXCEPTION 'Profilo attivo richiesto' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.ghost_net_reporters(profile_id, enabled, granted_by)
    VALUES (target, enabled, auth.uid())
    ON CONFLICT (profile_id) DO UPDATE SET enabled = EXCLUDED.enabled, granted_by = auth.uid(), updated_at = now();
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,new_values)
    VALUES(auth.uid(),'ghost_net.permission','profile',target,jsonb_build_object('enabled',enabled));
END;
$$;

CREATE TABLE public.ghost_net_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.ghost_net_reports(id) ON DELETE CASCADE,
  observer_id uuid NOT NULL REFERENCES public.profiles(id),
  discovery_method text NOT NULL CHECK (discovery_method IN ('dive','snorkel','fishing','sonar','rov','other')),
  observed_at timestamptz NOT NULL,
  lat numeric(9,6) NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng numeric(9,6) NOT NULL CHECK (lng BETWEEN -180 AND 180),
  depth_m integer CHECK (depth_m BETWEEN 0 AND 12000),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 20 AND 2000),
  evidence_url text CHECK (evidence_url IS NULL OR (length(evidence_url) <= 2000 AND evidence_url ~ '^https://')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, observer_id)
);
CREATE INDEX ghost_observations_author_date ON public.ghost_net_observations(observer_id, created_at);
ALTER TABLE public.ghost_net_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ghost_net_observations FROM anon, authenticated;
GRANT SELECT ON public.ghost_net_observations TO authenticated;
CREATE POLICY observations_read ON public.ghost_net_observations FOR SELECT TO authenticated
  USING (observer_id = auth.uid() OR public.get_user_role() = 'super_admin');

-- Definer functions are the sole write path: clients cannot forge a reporter or a review status.
DROP POLICY ghost_nets_insert_any ON public.ghost_net_reports;
REVOKE INSERT, UPDATE, DELETE ON public.ghost_net_reports FROM anon, authenticated;

CREATE FUNCTION public.ghost_net_distance(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT 6371000 * 2 * asin(sqrt(least(1.0, greatest(0.0,
    power(sin(radians(lat2-lat1)/2),2) + cos(radians(lat1))*cos(radians(lat2))*power(sin(radians(lng2-lng1)/2),2)))));
$$;

CREATE FUNCTION public.nearby_ghost_nets(p_lat double precision, p_lng double precision) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.can_report_ghost_net() THEN
    RAISE EXCEPTION 'Account non abilitato alle segnalazioni' USING ERRCODE = '42501';
  END IF;
  IF p_lat IS NULL OR p_lng IS NULL OR NOT (p_lat BETWEEN -90 AND 90 AND p_lng BETWEEN -180 AND 180) THEN
    RAISE EXCEPTION 'Coordinate non valide' USING ERRCODE = '22023';
  END IF;
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb) FROM (
    SELECT r.id, r.gear_type, r.status, r.lat, r.lng, r.depth_m, r.description,
      round(public.ghost_net_distance(p_lat,p_lng,r.lat::float8,r.lng::float8)) AS distance_m,
      (SELECT count(DISTINCT person) FROM (
        SELECT r.reporter_id AS person UNION ALL SELECT o.observer_id FROM public.ghost_net_observations o WHERE o.report_id=r.id
      ) people) AS observer_count,
      (r.reporter_id = auth.uid() OR EXISTS (SELECT 1 FROM public.ghost_net_observations o WHERE o.report_id=r.id AND o.observer_id=auth.uid())) AS contributed
    FROM public.ghost_net_reports r
    WHERE r.status IN ('reported','verified','recovery_planned')
      AND public.ghost_net_distance(p_lat,p_lng,r.lat::float8,r.lng::float8) <= 250
    ORDER BY distance_m, r.id LIMIT 50
  ) n);
END;
$$;

CREATE FUNCTION public.submit_ghost_net_observation(
  p_gear public.gear_type, p_lat numeric, p_lng numeric, p_depth integer,
  p_method text, p_observed_at timestamptz, p_description text,
  p_evidence_url text DEFAULT NULL, p_report_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target uuid; existing public.ghost_net_reports;
BEGIN
  IF NOT public.can_report_ghost_net() THEN
    RAISE EXCEPTION 'Account non abilitato alle segnalazioni' USING ERRCODE = '42501';
  END IF;
  -- Serialize submissions by account so the daily limit also holds for concurrent requests.
  PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
  IF p_gear IS NULL OR p_lat IS NULL OR p_lng IS NULL OR NOT (p_lat BETWEEN -90 AND 90 AND p_lng BETWEEN -180 AND 180)
    OR (p_depth IS NOT NULL AND (p_depth < 0 OR p_depth > 12000))
    OR p_method IS NULL OR p_method NOT IN ('dive','snorkel','fishing','sonar','rov','other')
    OR p_observed_at IS NULL OR p_observed_at > now() OR p_observed_at < '2000-01-01'::timestamptz
    OR p_description IS NULL OR length(btrim(p_description)) NOT BETWEEN 20 AND 2000
    OR (p_evidence_url IS NOT NULL AND (length(p_evidence_url)>2000 OR p_evidence_url !~ '^https://')) THEN
    RAISE EXCEPTION 'Dati osservazione non validi' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.ghost_net_observations WHERE observer_id=auth.uid() AND created_at>now()-interval '24 hours') >= 10 THEN
    RAISE EXCEPTION 'Limite di 10 osservazioni in 24 ore raggiunto' USING ERRCODE = 'P0001';
  END IF;
  IF p_report_id IS NULL THEN
    INSERT INTO public.ghost_net_reports(reporter_id, gear_type, lat, lng, depth_m, description)
    VALUES (auth.uid(), p_gear, p_lat, p_lng, p_depth, btrim(p_description)) RETURNING id INTO target;
  ELSE
    SELECT * INTO existing FROM public.ghost_net_reports WHERE id=p_report_id FOR UPDATE;
    IF NOT FOUND OR existing.status NOT IN ('reported','verified','recovery_planned')
      OR existing.gear_type <> p_gear
      OR public.ghost_net_distance(p_lat::float8,p_lng::float8,existing.lat::float8,existing.lng::float8)>250 THEN
      RAISE EXCEPTION 'Segnalazione non compatibile o non più aperta' USING ERRCODE = '22023';
    END IF;
    IF existing.reporter_id=auth.uid() OR EXISTS (SELECT 1 FROM public.ghost_net_observations WHERE report_id=p_report_id AND observer_id=auth.uid()) THEN
      RAISE EXCEPTION 'Hai già contribuito a questa segnalazione' USING ERRCODE = '23505';
    END IF;
    target := p_report_id;
  END IF;
  INSERT INTO public.ghost_net_observations(report_id, observer_id, discovery_method, observed_at, lat, lng, depth_m, description, evidence_url)
    VALUES (target, auth.uid(), p_method, p_observed_at, p_lat, p_lng, p_depth, btrim(p_description), nullif(btrim(p_evidence_url),''));
  RETURN target;
END;
$$;

ALTER TABLE public.ghost_net_reports ADD COLUMN review_notes text;
ALTER TABLE public.ghost_net_reports ADD COLUMN reviewed_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.ghost_net_reports ADD COLUMN reviewed_at timestamptz;

CREATE FUNCTION public.review_ghost_net(p_report_id uuid, p_status public.ghost_net_status, p_notes text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE previous_status public.ghost_net_status;
BEGIN
  IF public.get_user_role() IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Operazione non consentita' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_notes IS NULL OR length(btrim(p_notes)) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'Motivazione richiesta (10–2000 caratteri)' USING ERRCODE = '22023';
  END IF;
  SELECT status INTO previous_status FROM public.ghost_net_reports WHERE id=p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Segnalazione non trovata' USING ERRCODE = '22023'; END IF;
  UPDATE public.ghost_net_reports SET status=p_status, review_notes=btrim(p_notes), reviewed_by=auth.uid(), reviewed_at=now(),
    updated_at=now(), recovered_at=CASE WHEN p_status='recovered' THEN coalesce(recovered_at,now()) ELSE NULL END
    WHERE id=p_report_id;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,old_values,new_values)
    VALUES(auth.uid(),'ghost_net.review','ghost_net',p_report_id,jsonb_build_object('status',previous_status),jsonb_build_object('status',p_status,'notes',btrim(p_notes)));
END;
$$;

-- Staff-only projection includes evidence; public map reads retain their existing column restrictions.
CREATE FUNCTION public.ghost_net_review_queue() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.get_user_role() IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Operazione non consentita' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb) FROM (
    SELECT r.id,r.gear_type,r.status,r.lat,r.lng,r.depth_m,r.description,r.review_notes,
      (SELECT count(DISTINCT person) FROM (SELECT r.reporter_id AS person UNION ALL
        SELECT o.observer_id FROM public.ghost_net_observations o WHERE o.report_id=r.id) people) AS observer_count,
      (SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'method',o.discovery_method,'observed_at',o.observed_at,
        'description',o.description,'evidence_url',o.evidence_url,'lat',o.lat,'lng',o.lng,'depth_m',o.depth_m) ORDER BY o.created_at), '[]'::jsonb)
        FROM public.ghost_net_observations o WHERE o.report_id=r.id) AS observations
    FROM public.ghost_net_reports r ORDER BY r.reported_at DESC LIMIT 200
  ) n);
END;
$$;

REVOKE ALL ON FUNCTION public.can_report_ghost_net(), public.set_ghost_net_reporter(uuid,boolean),
  public.nearby_ghost_nets(double precision,double precision),
  public.submit_ghost_net_observation(public.gear_type,numeric,numeric,integer,text,timestamptz,text,text,uuid),
  public.review_ghost_net(uuid,public.ghost_net_status,text), public.ghost_net_review_queue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_report_ghost_net(), public.set_ghost_net_reporter(uuid,boolean),
  public.nearby_ghost_nets(double precision,double precision),
  public.submit_ghost_net_observation(public.gear_type,numeric,numeric,integer,text,timestamptz,text,text,uuid),
  public.review_ghost_net(uuid,public.ghost_net_status,text), public.ghost_net_review_queue() TO authenticated;
COMMIT;
