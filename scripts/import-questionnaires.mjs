import { readFile, writeFile } from 'node:fs/promises';
import { generateMarineQuestionnaires } from './import-marine-questionnaires.mjs';

const source = await readFile(new URL('../supabase/content/questionnaires-source-v2.txt', import.meta.url), 'utf8');
const matches = [...source.matchAll(/([123]\.(?:1[0-5]|[1-9]))(?=[A-ZÈ])/gu)];
if (matches.length !== 45) throw new Error(`Expected 45 questions, found ${matches.length}`);
const sections = [
  { title: 'Pesca sportiva con canna', description: 'Bolentino, traina, attrezzature e tutela delle risorse marine.' },
  { title: 'Pesca in apnea', description: 'Segnalazione, attrezzatura, comportamento e sicurezza in mare.' },
  { title: 'Pesca professionale con reti', description: 'Attrezzi da posta, tracciabilità e protezione della fauna marina.' },
];
// Three supplied answer labels abbreviate their corresponding option.
const answerAliases = {
  '2.9': { label: 'Consentito ma il fucile deve essere scarico', index: 2 },
  '3.3': { label: 'Con boe radarabili e luci lampeggianti', index: 1 },
  '3.6': { label: 'La specie bersaglio', index: 0 },
};
const catalog = sections.map((section, i) => ({
  ...section, id: `40000000-0000-4000-8000-00000000010${i + 1}`, version: 2, pass_percent: 80, is_demo: true, questions: [],
}));
const privateKeys = [];
for (let i = 0; i < matches.length; i++) {
  const match = matches[i];
  const [section, position] = match[1].split('.').map(Number);
  if (section !== Math.floor(i / 15) + 1 || position !== i % 15 + 1) throw new Error(`Unexpected question order: ${match[1]}`);
  const chunk = source.slice(match.index + match[0].length, matches[i + 1]?.index ?? source.length).replace(/Sezione [23]:[\s\S]*$/, '').replace(/Suggerimenti per l'implementazione[\s\S]*$/, '').trim();
  const parts = chunk.match(/^([\s\S]*?)(Scelta Multipla|Vero\/Falso)(\[[\s\S]*?\])([\s\S]*)$/);
  if (!parts) throw new Error(`Could not parse ${match[1]}`);
  const question = { id: `50000000-0000-4000-8000-${String(1000 + section * 100 + position).padStart(12, '0')}`, position, prompt: parts[1].trim(), options: JSON.parse(parts[3]) };
  const answerAndNotes = parts[4].trim();
  const alias = answerAliases[match[1]];
  const candidates = question.options.flatMap((option, index) => answerAndNotes.startsWith(option) ? [index] : []);
  let correct;
  if (alias) {
    if (!answerAndNotes.startsWith(alias.label) || !question.options[alias.index]?.startsWith(alias.label)) throw new Error(`Answer alias mismatch: ${match[1]}`);
    correct = alias.index;
  } else {
    if (candidates.length !== 1) throw new Error(`Ambiguous or missing supplied answer: ${match[1]}`);
    correct = candidates[0];
  }
  // Explicit editorial correction; original wording and supplied answer remain in the source file.
  if (match[1] === '1.9') {
    question.prompt = 'Qual è il periodo di chiusura per la pesca del pesce spada nel Mediterraneo previsto dall’articolo 10 del Regolamento (UE) 2019/1154?';
    question.options = ['Dal 1° gennaio al 31 marzo', 'Dal 1° giugno al 31 agosto', 'Nessun periodo di chiusura'];
    correct = 0;
  }
  if (!question.options[correct]) throw new Error(`Invalid answer key for ${match[1]}`);
  catalog[section - 1].questions.push(question);
  privateKeys.push({ question_id: question.id, correct_option: correct });
}
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
let sql = '-- Version 2: 45 training questions from the updated supplied source; not an official exam.\n-- Requires migrations 001 through 004. Run once, never rerun old migrations.\n-- New IDs preserve previous questions, answers, applications and certificates.\n-- Editorial correction 1.9: https://eur-lex.europa.eu/eli/reg/2019/1154/oj/eng (Article 10).\nBEGIN;\n';
for (const q of catalog) {
  sql += `INSERT INTO public.questionnaires (id, title, version, description, pass_percent, is_demo, is_active) VALUES (${quote(q.id)}, ${quote(q.title)}, ${q.version}, ${quote('Bozza formativa da validare. ' + q.description)}, 80, true, true);\n`;
  for (const question of q.questions) {
    sql += `INSERT INTO public.questionnaire_questions (id, questionnaire_id, position, prompt, options) VALUES (${quote(question.id)}, ${quote(q.id)}, ${question.position}, ${quote(question.prompt)}, ${quote(JSON.stringify(question.options))}::jsonb);\n`;
  }
}
for (const key of privateKeys) sql += `INSERT INTO public.questionnaire_answer_keys (question_id, correct_option) VALUES (${quote(key.question_id)}, ${key.correct_option});\n`;
sql += "UPDATE public.questionnaires SET is_active = false WHERE id IN ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000003');\nCOMMIT;\n";
await writeFile(new URL('../supabase/migrations/005_training_questionnaires_v2.sql', import.meta.url), sql);
// Publish educational answers separately for practice. Submitted assessments still
// use database grading; no client-provided score is trusted.
const practiceAnswers = Object.fromEntries(privateKeys.map(key => [key.question_id, key.correct_option]));
const marineCatalog = await generateMarineQuestionnaires(practiceAnswers);
await writeFile(new URL('../src/features/certification/catalog.json', import.meta.url), JSON.stringify([...catalog, ...marineCatalog], null, 2) + '\n');
await writeFile(new URL('../src/features/certification/practice-answers.json', import.meta.url), JSON.stringify(practiceAnswers, null, 2) + '\n');
console.log('Generated 3 version-2 training questionnaires, 45 questions, and migration 005.');
