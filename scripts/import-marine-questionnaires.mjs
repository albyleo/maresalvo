import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export async function generateMarineQuestionnaires() {
  const source = JSON.parse(await readFile(new URL('../supabase/content/marine-activities-v2.json', import.meta.url), 'utf8'));
  const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
  const catalog = [];
  const references = {};
  let sql = '-- New educational marine activities. Version 2. Requires migrations 001–007.\n-- Demo only: no boating licence, sporting qualification or permit is issued.\n-- Existing questionnaires, attempts and certificates are preserved.\nBEGIN;\n';
  for (const { sourceIds, questions, ...course } of source.courses) {
    const refs = sourceIds.map(id => source.sources[id]);
    if (refs.some(ref => !ref?.url?.startsWith('https://'))) throw new Error('Missing official reference');
    references[course.id] = { reviewedAt: source.reviewedAt, sources: refs };
    catalog.push({ ...course, questions: questions.map(({ correct_option, source: sourceId, ...question }) => {
      if (!Number.isInteger(correct_option) || !question.options[correct_option] || !source.sources[sourceId]) throw new Error(`Invalid question: ${question.id}`);
      return question;
    }) });
    sql += `INSERT INTO public.questionnaires (id,title,version,description,pass_percent,is_demo,is_active) VALUES (${quote(course.id)},${quote(course.title)},${course.version},${quote(course.description)},${course.pass_percent},true,true);\n`;
    for (const question of questions) {
      sql += `-- Source: ${source.sources[question.source].url}\n`;
      sql += `INSERT INTO public.questionnaire_questions (id,questionnaire_id,position,prompt,options) VALUES (${quote(question.id)},${quote(course.id)},${question.position},${quote(question.prompt)},${quote(JSON.stringify(question.options))}::jsonb);\n`;
      sql += `INSERT INTO public.questionnaire_answer_keys (question_id,correct_option) VALUES (${quote(question.id)},${question.correct_option});\n`;
    }
  }
  await writeFile(new URL('../supabase/migrations/008_marine_activity_questionnaires_v2.sql', import.meta.url), sql + "UPDATE public.questionnaires SET is_active = false WHERE id IN ('41000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000003');\nCOMMIT;\n");
  await writeFile(new URL('../src/features/certification/course-sources.json', import.meta.url), JSON.stringify(references, null, 2) + '\n');
  return catalog;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const additions = await generateMarineQuestionnaires();
  const destination = new URL('../src/features/certification/catalog.json', import.meta.url);
  const existing = JSON.parse(await readFile(destination, 'utf8'));
  const ids = new Set(additions.map(item => item.id));
  await writeFile(destination, JSON.stringify([...existing.filter(item => !ids.has(item.id) && !item.id.startsWith('41000000')), ...additions], null, 2) + '\n');
  console.log('Added 3 marine activity courses, 30 questions and migration 008.');
}
