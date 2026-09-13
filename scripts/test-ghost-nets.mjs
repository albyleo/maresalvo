import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

test('authorized ghost-net observations and staff review (real PostgreSQL)', async t => {
  const db = new PGlite({ extensions: { uuid_ossp, pgcrypto } });
  const alice='60000000-0000-4000-8000-000000000001', bob='60000000-0000-4000-8000-000000000002', admin='60000000-0000-4000-8000-000000000003';
  const as = async (id, role='authenticated') => {
    await db.exec('RESET ROLE'); await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id??'']); await db.exec(`SET ROLE ${role}`);
  };
  const submit = (id=null, overrides={}) => {
    const p={ gear:'net', lat:40.25, lng:17.9, depth:20, method:'dive', date:'2026-01-01T12:00:00Z', description:'Rete incastrata sulle rocce, lunga circa venti metri.', evidence:'https://example.org/prova.jpg', ...overrides };
    return db.query('SELECT public.submit_ghost_net_observation($1,$2,$3,$4,$5,$6,$7,$8,$9) AS id',[p.gear,p.lat,p.lng,p.depth,p.method,p.date,p.description,p.evidence,id]);
  };
  const nearby = async () => (await db.query('SELECT public.nearby_ghost_nets(40.25,17.9) AS items')).rows[0].items;
  let reportId;
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE SCHEMA extensions;
      CREATE TABLE auth.users(id uuid PRIMARY KEY, raw_user_meta_data jsonb);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;
      CREATE EXTENSION pgcrypto;`);
    for (const filename of ['001_initial_schema.sql','002_marine_monitoring.sql','003_certification_pilot.sql','004_training_questionnaires.sql','005_training_questionnaires_v2.sql','006_ghost_net_observations.sql']) {
      let sql=await readFile(new URL(`../supabase/migrations/${filename}`,import.meta.url),'utf8');
      // PGlite lacks PostGIS. Only the original geometry columns/indexes/triggers are substituted.
      if (/^00[12]/.test(filename)) sql=sql.replace(/CREATE EXTENSION IF NOT EXISTS "postgis";/g,'')
        .replace(/GEOMETRY\((?:MultiPolygon|Point), 4326\)/gi,'text').replace(/GEOGRAPHY\(POINT, 4326\)/gi,'text')
        .replace(/CREATE INDEX[^;]+USING GIST[^;]+;/g,'').replace(/CREATE TRIGGER trg_(?:ghost_net|illegal)_geom[\s\S]+?;/g,'');
      await db.exec(sql);
    }
    for(const id of [alice,bob,admin]) await db.query('INSERT INTO auth.users VALUES($1, $2)',[id,'{}']);
    await db.query("UPDATE public.profiles SET role='super_admin' WHERE id=$1",[admin]);
    await t.test('anonymous and unapproved accounts cannot submit, confirm or enumerate nearby reports',async()=>{
      await as(null,'anon'); await assert.rejects(submit(),/permission denied/); await assert.rejects(nearby(),/permission denied/);
      await assert.rejects(db.query("INSERT INTO public.ghost_net_reports(lat,lng) VALUES(40,17)"),/permission denied/);
      await as(alice); await assert.rejects(submit(),/non abilitato/); await assert.rejects(nearby(),/non abilitato/);
      await assert.rejects(db.query('SELECT public.set_ghost_net_reporter($1,true)',[alice]),/non consentita/);
      await assert.rejects(db.query('INSERT INTO public.ghost_net_reporters(profile_id,granted_by) VALUES($1,$1)',[alice]),/permission denied/);
      await as(admin); for(const id of [alice,bob]) await db.query('SELECT public.set_ghost_net_reporter($1,true)',[id]);
    });
    await t.test('database validates discovery, date, position, evidence and detail; direct writes stay blocked',async()=>{
      await as(alice);
      for(const change of [{method:'rumour'},{lat:91},{description:'short'},{date:'2999-01-01'},{depth:-1},{evidence:'javascript:alert(1)'},{gear:null}]) await assert.rejects(submit(null,change),/non validi/);
      await assert.rejects(db.query('INSERT INTO public.ghost_net_reports(reporter_id,lat,lng) VALUES($1,40,17)',[alice]),/permission denied/);
      reportId=(await submit()).rows[0].id;
      const items=await nearby(); assert.equal(items.length,1); assert.equal(items[0].observer_count,1); assert.equal(items[0].contributed,true); assert.equal(items[0].status,'reported');
      assert.equal(items[0].evidence_url,undefined); assert.equal(items[0].reporter_id,undefined);
    });
    await t.test('self-confirmation and repeat confirmations cannot inflate observer count',async()=>{
      await assert.rejects(submit(reportId),/già contribuito/);
      await as(bob); await submit(reportId,{method:'sonar'});
      await assert.rejects(submit(reportId),/già contribuito/);
      const items=await nearby(); assert.equal(items[0].observer_count,2); assert.equal(items[0].status,'reported');
      assert.equal((await db.query('SELECT * FROM public.ghost_net_observations')).rows.length,1);
      await assert.rejects(db.query("UPDATE public.ghost_net_reports SET status='verified'"),/permission denied/);
      await assert.rejects(db.query('SELECT public.review_ghost_net($1,\'verified\',\'Prova verificata\')',[reportId]),/non consentita/);
    });
    await t.test('distant or different gear cannot confirm; guests cannot see unreviewed reports or evidence',async()=>{
      await as(admin); await assert.rejects(submit(reportId,{lat:41}),/non compatibile/); await assert.rejects(submit(reportId,{gear:'trap'}),/non compatibile/);
      await as(null,'anon'); assert.equal((await db.query('SELECT id FROM public.ghost_net_reports')).rows.length,0);
      await assert.rejects(db.query('SELECT * FROM public.ghost_net_observations'),/permission denied/);
      await assert.rejects(db.query('SELECT review_notes FROM public.ghost_net_reports'),/permission denied/);
    });
    await t.test('staff reviews evidence and explicitly publishes or rejects, with an audit trail',async()=>{
      await as(admin); const queue=(await db.query('SELECT public.ghost_net_review_queue() AS items')).rows[0].items;
      assert.equal(queue[0].observations.length,2); assert.equal(queue[0].observer_count,2);
      await assert.rejects(db.query("SELECT public.review_ghost_net($1,'verified','')",[reportId]),/Motivazione/);
      await db.query("SELECT public.review_ghost_net($1,'verified','Verificata con immersione staff')",[reportId]);
      await as(null,'anon'); assert.equal((await db.query('SELECT id FROM public.ghost_net_reports')).rows.length,1);
      await as(admin); await db.query("SELECT public.review_ghost_net($1,'rejected','Segnalazione errata dopo controllo')",[reportId]);
      await assert.rejects(submit(reportId),/non compatibile/);
      assert.equal((await db.query("SELECT id FROM public.audit_logs WHERE action='ghost_net.review'")).rows.length,2);
      await as(null,'anon'); assert.equal((await db.query('SELECT id FROM public.ghost_net_reports')).rows.length,0);
    });
    await t.test('revoked or inactive reporters lose access immediately',async()=>{
      await as(admin); await db.query('SELECT public.set_ghost_net_reporter($1,false)',[alice]);
      await as(alice); await assert.rejects(submit(),/non abilitato/); await assert.rejects(nearby(),/non abilitato/);
      await db.exec('RESET ROLE'); await db.query('UPDATE public.profiles SET is_active=false WHERE id=$1',[bob]);
      await as(bob); await assert.rejects(submit(),/non abilitato/);
    });
    await t.test('daily observation limit prevents repeated submissions by the same account',async()=>{
      await as(admin);
      for(let i=0;i<10;i++) await submit(null,{lat:39+i/100});
      await assert.rejects(submit(),/10 osservazioni/);
    });
  } finally { await db.close(); }
});
