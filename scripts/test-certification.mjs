import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

// Real PostgreSQL execution with Supabase roles/auth.uid simulated. PGlite has
// no PostGIS: only spatial types, indexes and geometry triggers in 001/002 are
// omitted. The certification migration (003), grants, RLS and RPCs run unchanged.
test('certification workflow and database permissions', async t => {
  const db = new PGlite({ extensions: { uuid_ossp, pgcrypto } });
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE SCHEMA extensions;
      CREATE TABLE auth.users(id uuid PRIMARY KEY, raw_user_meta_data jsonb);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
      CREATE EXTENSION pgcrypto;
    `);
    for (const filename of ['001_initial_schema.sql', '002_marine_monitoring.sql', '003_certification_pilot.sql']) {
      let sql = await readFile(new URL(`../supabase/migrations/${filename}`, import.meta.url), 'utf8');
      if (!filename.startsWith('003')) sql = sql
        .replace(/CREATE EXTENSION IF NOT EXISTS "postgis";/g, '')
        .replace(/GEOMETRY\((?:MultiPolygon|Point), 4326\)/gi, 'text')
        .replace(/GEOGRAPHY\(POINT, 4326\)/gi, 'text')
        .replace(/CREATE INDEX[^;]+USING GIST[^;]+;/g, '')
        .replace(/CREATE TRIGGER trg_(?:ghost_net|illegal)_geom[\s\S]+?;/g, '');
      await db.exec(sql);
    }
    const alice = '30000000-0000-4000-8000-000000000001';
    const bob = '30000000-0000-4000-8000-000000000002';
    const admin = '30000000-0000-4000-8000-000000000003';
    const instructor = '30000000-0000-4000-8000-000000000004';
    const q = '10000000-0000-4000-8000-000000000001';
    const answers = Object.fromEntries([0, 1, 1].map((answer, i) => [`20000000-0000-4000-8000-00000000000${i + 1}`, answer]));
    for (const [id, name] of [[alice, 'Alice'], [bob, 'Bob'], [admin, 'Staff'], [instructor, 'Instructor']]) {
      await db.query('INSERT INTO auth.users VALUES ($1, $2)', [id, JSON.stringify({ first_name: name, last_name: 'Test', role: 'super_admin' })]);
    }
    const as = async (id, role = 'authenticated') => {
      await db.exec('RESET ROLE');
      await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
      await db.exec(`SET ROLE ${role}`);
    };
    const root = () => db.exec('RESET ROLE');
    const submit = (value = answers) => db.query('SELECT public.submit_questionnaire($1, $2) AS id', [q, JSON.stringify(value)]);
    const review = (id, approve = true, notes = '') => db.query('SELECT public.review_certification($1, $2, $3) AS id', [id, approve, notes]);
    let applicationId, certificateId, code;
    await t.test('signup ignores malicious admin metadata', async () => {
      const { rows } = await db.query('SELECT role FROM public.profiles');
      assert.ok(rows.every(row => row.role === 'fisherman'));
      await db.query("UPDATE public.profiles SET role = 'super_admin' WHERE id = $1", [admin]);
      await db.query("UPDATE public.profiles SET role = 'club_instructor' WHERE id = $1", [instructor]);
    });
    await t.test('applicant cannot change role or read answer keys', async () => {
      await as(alice);
      await assert.rejects(db.query("UPDATE public.profiles SET role = 'super_admin' WHERE id = $1", [alice]), /permission denied/);
      await assert.rejects(db.query('SELECT * FROM public.questionnaire_answer_keys'), /permission denied/);
      await db.query("UPDATE public.profiles SET phone = '123' WHERE id = $1", [alice]);
    });
    await t.test('anonymous submissions cannot invoke the questionnaire RPC', async () => {
      await as(null, 'anon'); await assert.rejects(submit(), /permission denied/);
    });
    await t.test('incomplete, additional, out-of-range and string answers are rejected', async () => {
      await as(alice);
      await assert.rejects(submit({}), /Rispondi/);
      await assert.rejects(submit({ ...answers, extra: 0 }), /Risposte non valide/);
      await assert.rejects(submit({ ...answers, [Object.keys(answers)[0]]: 99 }), /Opzione non valida/);
      await assert.rejects(submit({ ...answers, [Object.keys(answers)[0]]: '0' }), /Rispondi/);
    });
    await t.test('failed attempt creates no certificate; passing attempt awaits review', async () => {
      await submit(Object.fromEntries(Object.keys(answers).map(key => [key, 0])));
      const failed = await db.query("SELECT status, score_percent FROM public.certification_applications");
      assert.deepEqual(failed.rows[0], { status: 'failed', score_percent: 33 });
      const result = await submit(); applicationId = result.rows[0].id;
      const { rows } = await db.query('SELECT status, score_percent, certificate_id FROM public.certification_applications WHERE id = $1', [applicationId]);
      assert.deepEqual(rows[0], { status: 'pending', score_percent: 100, certificate_id: null });
      await assert.rejects(submit(), /già una richiesta/);
    });
    await t.test('applicant cannot approve or forge certificates/applications', async () => {
      await assert.rejects(review(applicationId), /non consentita/);
      await assert.rejects(db.query("UPDATE public.certification_applications SET status = 'approved'"), /permission denied/);
      await assert.rejects(db.query('INSERT INTO public.certificates (title) VALUES (\'Forged\')'), /permission denied/);
    });
    await t.test('other applicant and unassigned instructor cannot read or approve', async () => {
      for (const id of [bob, instructor]) {
        await as(id);
        assert.equal((await db.query('SELECT * FROM public.certification_applications')).rows.length, 0);
        await assert.rejects(review(applicationId), /non consentita/);
      }
    });
    await t.test('staff approval atomically issues one certificate with audit entry', async () => {
      await as(admin); certificateId = (await review(applicationId)).rows[0].id;
      const { rows } = await db.query('SELECT * FROM public.certificates WHERE id = $1', [certificateId]);
      assert.equal(rows[0].certificate_type, 'demo_training'); assert.equal(rows[0].status, 'issued');
      assert.match(rows[0].serial_number, /^DEMO-/); code = rows[0].verification_code;
      assert.equal(code.length, 64);
      assert.equal((await db.query("SELECT * FROM public.audit_logs WHERE action = 'certificate.issued'")).rows.length, 1);
      await assert.rejects(review(applicationId), /già elaborata/);
    });
    await t.test('issued identity is preserved when the applicant edits their profile', async () => {
      await as(alice);
      await db.query("UPDATE public.profiles SET first_name = 'Changed' WHERE id = $1", [alice]);
      const { rows } = await db.query('SELECT * FROM public.verify_certificate($1)', [code]);
      assert.equal(rows[0].first_name, 'Alice');
    });
    await t.test('public can verify one code but cannot enumerate certificates', async () => {
      await as(null, 'anon');
      assert.equal((await db.query('SELECT * FROM public.verify_certificate($1)', [code])).rows[0].status, 'issued');
      assert.equal((await db.query("SELECT * FROM public.verify_certificate('invalid123')")).rows.length, 0);
      assert.equal((await db.query('SELECT * FROM public.certificates')).rows.length, 0);
      await assert.rejects(db.query('SELECT * FROM public.public_certificate_verification'), /permission denied/);
    });
    await t.test('expired and revoked states are reported accurately', async () => {
      await root(); await db.query("UPDATE public.certificates SET expires_at = now() - interval '1 day' WHERE id = $1", [certificateId]);
      await as(null, 'anon'); assert.equal((await db.query('SELECT * FROM public.verify_certificate($1)', [code])).rows[0].status, 'expired');
      await root(); await db.query("UPDATE public.certificates SET status = 'revoked' WHERE id = $1", [certificateId]);
      await as(null, 'anon'); assert.equal((await db.query('SELECT * FROM public.verify_certificate($1)', [code])).rows[0].status, 'revoked');
    });
    await t.test('rejection requires notes and permits resubmission; retry limit enforced', async () => {
      await as(bob); const id = (await submit()).rows[0].id;
      await as(admin); await assert.rejects(review(id, false), /motivazione/);
      await review(id, false, 'Ripetere la prova');
      await as(bob);
      for (let i = 0; i < 4; i++) await submit(Object.fromEntries(Object.keys(answers).map(key => [key, 0])));
      await assert.rejects(submit(), /5 tentativi/);
    });
    await t.test('staff cannot approve own request; inactive accounts cannot submit', async () => {
      await as(admin); const id = (await submit()).rows[0].id;
      await assert.rejects(review(id), /non consentita/);
      await root(); await db.query('UPDATE public.profiles SET is_active = false WHERE id = $1', [bob]);
      await as(bob); await assert.rejects(submit(), /Account attivo/);
    });
    await t.test('net contact information is private and unreviewed reports are hidden', async () => {
      await as(null, 'anon');
      await db.query("INSERT INTO public.ghost_net_reports(lat,lng,contact_info) VALUES (40,15,'private@example.test')");
      assert.equal((await db.query('SELECT id, status FROM public.ghost_net_reports')).rows.length, 0);
      await assert.rejects(db.query('SELECT contact_info FROM public.ghost_net_reports'), /permission denied/);
      await assert.rejects(db.query("INSERT INTO public.ghost_net_reports(lat,lng,status) VALUES (40,15,'verified')"), /row-level security/);
    });
    await t.test('migration 004 adds three 10-question training paths without exposing answer keys', async () => {
      await root();
      await db.exec(await readFile(new URL('../supabase/migrations/004_training_questionnaires.sql', import.meta.url), 'utf8'));
      const { rows: catalog } = await db.query('SELECT id FROM public.questionnaires WHERE is_active ORDER BY id');
      for (const item of catalog) item.questions = (await db.query('SELECT id, prompt, options FROM public.questionnaire_questions WHERE questionnaire_id = $1 ORDER BY position', [item.id])).rows;
      assert.equal(catalog.length, 3);
      const active = await db.query('SELECT id FROM public.questionnaires WHERE is_active');
      assert.equal(active.rows.length, 3);
      for (const item of catalog) {
        assert.equal(item.questions.length, 10);
        assert.ok(item.questions.every(question => !('correct_option' in question)));
        const keys = await db.query('SELECT k.question_id, k.correct_option FROM public.questionnaire_answer_keys k JOIN public.questionnaire_questions q ON q.id = k.question_id WHERE q.questionnaire_id = $1 ORDER BY q.position', [item.id]);
        const submission = Object.fromEntries(keys.rows.map(k => [k.question_id, k.correct_option]));
        // Eight correct answers meet the configured 80% threshold.
        for (const question of item.questions.slice(-2)) submission[question.id] = (submission[question.id] + 1) % question.options.length;
        await as(alice);
        const result = await db.query('SELECT public.submit_questionnaire($1, $2) AS id', [item.id, JSON.stringify(submission)]);
        const scored = await db.query('SELECT score_percent, status FROM public.certification_applications WHERE id = $1', [result.rows[0].id]);
        assert.deepEqual(scored.rows[0], { score_percent: 80, status: 'pending' });
        await assert.rejects(db.query('SELECT * FROM public.questionnaire_answer_keys'), /permission denied/);
        await root();
      }
      const swordfish = catalog[0].questions[8];
      assert.match(swordfish.options[0], /gennaio.*marzo/);
    });
    await t.test('migration 005 versions the catalog and preserves previous questions and results', async () => {
      await root();
      const oldQuestions = (await db.query('SELECT * FROM public.questionnaire_questions ORDER BY id')).rows;
      const oldKeys = (await db.query('SELECT * FROM public.questionnaire_answer_keys ORDER BY question_id')).rows;
      const oldApplications = (await db.query('SELECT * FROM public.certification_applications ORDER BY id')).rows;
      const oldCertificates = (await db.query('SELECT * FROM public.certificates ORDER BY id')).rows;
      await db.exec(await readFile(new URL('../supabase/migrations/005_training_questionnaires_v2.sql', import.meta.url), 'utf8'));
      assert.deepEqual((await db.query('SELECT * FROM public.questionnaire_questions WHERE id = ANY($1::uuid[]) ORDER BY id', [oldQuestions.map(q => q.id)])).rows, oldQuestions);
      assert.deepEqual((await db.query('SELECT * FROM public.questionnaire_answer_keys WHERE question_id = ANY($1::uuid[]) ORDER BY question_id', [oldKeys.map(k => k.question_id)])).rows, oldKeys);
      assert.deepEqual((await db.query('SELECT * FROM public.certification_applications ORDER BY id')).rows, oldApplications);
      assert.deepEqual((await db.query('SELECT * FROM public.certificates ORDER BY id')).rows, oldCertificates);
      const catalog = JSON.parse(await readFile(new URL('../src/features/certification/catalog.json', import.meta.url), 'utf8')).filter(item => item.version === 2);
      assert.equal(catalog.length, 3);
      assert.deepEqual((await db.query('SELECT id, version, is_demo, pass_percent FROM public.questionnaires WHERE is_active ORDER BY id')).rows,
        catalog.map(({ id }) => ({ id, version: 2, is_demo: true, pass_percent: 80 })));
      const expectedKeys = [
        [1,0,0,1,1,1,1,0,0,0,1,0,1,1,1],
        [2,1,0,1,1,1,1,1,2,1,1,1,1,0,1],
        [2,1,1,0,1,0,1,1,0,1,1,1,1,2,1],
      ];
      for (const [index, item] of catalog.entries()) {
        assert.equal(item.questions.length, 15);
        assert.deepEqual(Object.keys(item).sort(), ['title', 'description', 'id', 'version', 'pass_percent', 'is_demo', 'questions'].sort());
        for (const question of item.questions) assert.deepEqual(Object.keys(question).sort(), ['id', 'position', 'prompt', 'options'].sort());
        const { rows } = await db.query('SELECT id, position, prompt, options FROM public.questionnaire_questions WHERE questionnaire_id = $1 ORDER BY position', [item.id]);
        assert.deepEqual(rows, item.questions);
        const keys = (await db.query('SELECT k.correct_option FROM public.questionnaire_answer_keys k JOIN public.questionnaire_questions q ON q.id = k.question_id WHERE q.questionnaire_id = $1 ORDER BY q.position', [item.id])).rows;
        assert.deepEqual(keys.map(k => k.correct_option), expectedKeys[index]);
      }
      await as(alice);
      await assert.rejects(db.query('SELECT public.submit_questionnaire($1, $2)', ['40000000-0000-4000-8000-000000000001', '{}']), /non disponibile/);
      // A pending version-1 result can still be reviewed after its catalog retires.
      const pending = oldApplications.find(a => a.profile_id === alice && a.questionnaire_version === 1 && a.status === 'pending');
      assert.ok(pending);
      await as(admin);
      const issued = (await review(pending.id)).rows[0].id;
      assert.equal((await db.query('SELECT metadata FROM public.certificates WHERE id = $1', [issued])).rows[0].metadata.questionnaire_version, 1);
    });
    await t.test('version 2 rejects incomplete answers, fails at 11/15 and passes at 12/15', async () => {
      const catalog = JSON.parse(await readFile(new URL('../src/features/certification/catalog.json', import.meta.url), 'utf8')).filter(item => item.version === 2);
      for (const item of catalog) {
        await root();
        const keys = (await db.query('SELECT k.question_id, k.correct_option FROM public.questionnaire_answer_keys k JOIN public.questionnaire_questions q ON q.id = k.question_id WHERE q.questionnaire_id = $1', [item.id])).rows;
        const correct = Object.fromEntries(keys.map(k => [k.question_id, k.correct_option]));
        await as(alice);
        const incomplete = { ...correct }; delete incomplete[item.questions[14].id];
        await assert.rejects(db.query('SELECT public.submit_questionnaire($1, $2)', [item.id, JSON.stringify(incomplete)]), /tutte le domande/);
        for (const [wrongCount, score, status] of [[4, 73, 'failed'], [3, 80, 'pending']]) {
          const submission = { ...correct };
          for (const question of item.questions.slice(-wrongCount)) submission[question.id] = (submission[question.id] + 1) % question.options.length;
          const result = await db.query('SELECT public.submit_questionnaire($1, $2) AS id', [item.id, JSON.stringify(submission)]);
          const scored = await db.query('SELECT score_percent, status, total_questions, questionnaire_version FROM public.certification_applications WHERE id = $1', [result.rows[0].id]);
          assert.deepEqual(scored.rows[0], { score_percent: score, status, total_questions: 15, questionnaire_version: 2 });
        }
        await assert.rejects(db.query('SELECT * FROM public.questionnaire_answer_keys'), /permission denied/);
      }
    });
    await t.test('marine courses preserve history, match the public catalog and score only on the server', async () => {
      await root();
      const previous = (await db.query('SELECT * FROM public.certification_applications ORDER BY id')).rows;
      await db.exec(await readFile(new URL('../supabase/migrations/007_marine_activity_questionnaires.sql', import.meta.url), 'utf8'));
      assert.deepEqual((await db.query('SELECT * FROM public.certification_applications ORDER BY id')).rows, previous);
      assert.equal((await db.query('SELECT id FROM public.questionnaires WHERE is_active')).rows.length, 6);
      const catalog = JSON.parse(await readFile(new URL('../src/features/certification/catalog.json', import.meta.url), 'utf8'));
      assert.equal(catalog.length, 6);
      for (const item of catalog.filter(q => q.id.startsWith('41000000'))) {
        await root();
        assert.equal(item.questions.length, 10);
        assert.equal(item.is_demo, true);
        assert.deepEqual((await db.query('SELECT id,position,prompt,options FROM public.questionnaire_questions WHERE questionnaire_id = $1 ORDER BY position', [item.id])).rows, item.questions);
        for (const question of item.questions) assert.deepEqual(Object.keys(question).sort(), ['id','position','prompt','options'].sort());
        const keys = (await db.query('SELECT k.question_id,k.correct_option FROM public.questionnaire_answer_keys k JOIN public.questionnaire_questions q ON q.id=k.question_id WHERE q.questionnaire_id=$1', [item.id])).rows;
        assert.equal(keys.length, 10);
        await as(alice);
        await assert.rejects(db.query('SELECT * FROM public.questionnaire_answer_keys'), /permission denied/);
        for (const [wrong, status, score] of [[3, 'failed', 70], [2, 'pending', 80]]) {
          const answers = Object.fromEntries(keys.map(k => [k.question_id,k.correct_option]));
          for (const question of item.questions.slice(-wrong)) answers[question.id] = (answers[question.id]+1)%question.options.length;
          const result = await db.query('SELECT public.submit_questionnaire($1,$2) AS id', [item.id, JSON.stringify(answers)]);
          assert.deepEqual((await db.query('SELECT status,score_percent,is_demo,certificate_id FROM public.certification_applications WHERE id=$1', [result.rows[0].id])).rows[0], { status,score_percent:score,is_demo:true,certificate_id:null });
        }
      }
    });
  } finally { await db.close(); }
});
