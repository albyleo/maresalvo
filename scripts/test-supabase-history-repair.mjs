import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

test('manual history repair: reported state, preservation, idempotency and atomic rollback', async t => {
  const db = new PGlite({ extensions: { uuid_ossp, pgcrypto } });
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE SCHEMA extensions;
      CREATE TABLE auth.users(id uuid PRIMARY KEY, raw_user_meta_data jsonb);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;
      CREATE EXTENSION pgcrypto;
      CREATE SCHEMA supabase_migrations;
      CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY, statements text[], name text);`);
    for (const file of (await readdir(new URL('../supabase/migrations/', import.meta.url))).filter(n => n.endsWith('.sql')).sort()) {
      let sql = await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8');
      // PGlite lacks PostGIS: keep spatial column/index/trigger names for presence checks.
      // These columns use text and B-tree indexes locally. No spatial trigger is invoked.
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "postgis";/g, '')
        .replace(/GEOMETRY\((?:MultiPolygon|Point), 4326\)/gi, 'text')
        .replace(/GEOGRAPHY\(POINT, 4326\)/gi, 'text').replace(/USING GIST/g, '');
      await db.exec(sql);
    }
    const audit = await readFile(new URL('./diagnose-supabase-history.sql', import.meta.url), 'utf8');
    const repair = await readFile(new URL('./repair-supabase-history.sql', import.meta.url), 'utf8');
    const snapshot = async () => (await db.query(`SELECT jsonb_build_object(
      'questionnaires',(SELECT jsonb_agg(to_jsonb(q) ORDER BY id) FROM questionnaires q),
      'questions',(SELECT jsonb_agg(to_jsonb(q) ORDER BY id) FROM questionnaire_questions q),
      'keys',(SELECT jsonb_agg(to_jsonb(q) ORDER BY question_id) FROM questionnaire_answer_keys q),
      'history',(SELECT jsonb_agg(to_jsonb(q) ORDER BY version) FROM supabase_migrations.schema_migrations q)) AS data`)).rows[0].data;
    // Reproduce the exact missing-questionnaire pattern returned by the user's audit.
    const missing = `SELECT id FROM questionnaires WHERE id::text LIKE '41000000-%' OR id::text LIKE '42000000-%'
      OR id IN ('40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000003')`;
    await db.exec(`DELETE FROM questionnaire_answer_keys WHERE question_id IN (SELECT id FROM questionnaire_questions WHERE questionnaire_id IN (${missing}));
      DELETE FROM questionnaire_questions WHERE questionnaire_id IN (${missing});
      DELETE FROM questionnaires WHERE id IN (${missing});
      UPDATE questionnaires SET is_active=true WHERE id='10000000-0000-4000-8000-000000000001';
      INSERT INTO auth.users VALUES ('70000000-0000-4000-8000-000000000001','{"first_name":"Test","last_name":"Preserved"}');
      SELECT set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000001',false);
      SELECT submit_questionnaire('40000000-0000-4000-8000-000000000101',
        (SELECT jsonb_object_agg(q.id,k.correct_option) FROM questionnaire_questions q JOIN questionnaire_answer_keys k ON k.question_id=q.id
         WHERE q.questionnaire_id='40000000-0000-4000-8000-000000000101'));`);
    await t.test('fixture matches all eight reported failure counts', async () => {
      assert.deepEqual((await db.query(audit)).rows.map(r => r.controlli_non_superati), [0,0,0,4,3,0,3,9]);
    });
    const original = await snapshot();
    await t.test('different existing content prevents history writes and rolls back inserted seeds', async () => {
      await db.exec(`UPDATE questionnaire_questions SET prompt='Existing custom content' WHERE id='50000000-0000-4000-8000-000000001101'`);
      const custom = await snapshot();
      await assert.rejects(db.exec(repair), /Riparazione annullata/);
      await db.exec('ROLLBACK');
      assert.deepEqual(await snapshot(), custom);
      const oldPrompt = original.questions.find(q => q.id === '50000000-0000-4000-8000-000000001101').prompt;
      await db.query('UPDATE questionnaire_questions SET prompt=$1 WHERE id=$2', [oldPrompt, '50000000-0000-4000-8000-000000001101']);
    });
    await t.test('successful repair preserves profiles and previous applications', async () => {
      const profiles = (await db.query('SELECT * FROM profiles')).rows;
      const applications = (await db.query('SELECT * FROM certification_applications')).rows;
      await db.exec(repair);
      assert.ok((await db.query(audit)).rows.every(r => r.controlli_non_superati === 0));
      assert.deepEqual((await db.query('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version')).rows.map(r => r.version), ['001','002','003','004','005','006','007','008']);
      assert.deepEqual((await db.query('SELECT * FROM profiles')).rows, profiles);
      assert.deepEqual((await db.query('SELECT * FROM certification_applications')).rows, applications);
    });
    await t.test('running it twice leaves data and history unchanged', async () => {
      const before = await snapshot(); await db.exec(repair); assert.deepEqual(await snapshot(), before);
    });
    await t.test('structural mismatch blocks any change', async () => {
      await db.exec('DROP FUNCTION public.verify_certificate(text)');
      const before = await snapshot();
      await assert.rejects(db.exec(repair), /prerequisiti strutturali/);
      await db.exec('ROLLBACK'); assert.deepEqual(await snapshot(), before);
    });
  } finally { await db.close(); }
});
