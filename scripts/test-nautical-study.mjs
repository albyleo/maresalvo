import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const study = JSON.parse(await readFile(new URL('../src/features/certification/nautical-study.json', import.meta.url), 'utf8'));
const answer = id => { const q = study.questions.find(item => item.id === id); return q.options[q.answer]; };

test('study content has complete references, unique choices and stable question identities', () => {
  assert.equal(study.questions.length, 30);
  assert.equal(new Set(study.questions.map(q => q.id)).size, 30);
  for (const topic of study.topics) assert.equal(study.questions.filter(q => q.topic === topic.id).length, 10);
  for (const q of study.questions) {
    assert.equal(q.options.length, 3);
    assert.equal(new Set(q.options).size, 3);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 3);
    assert.ok(q.explanation.length > 20);
    assert.match(study.sources[q.source].url, /^https:\/\//);
  }
});

test('Italian licence obligations are not confused with the twelve-mile qualification limit', () => {
  assert.equal(answer('obblighi-01'), 'Oltre 6 miglia dalla costa.');
  assert.equal(answer('obblighi-02'), 'Superiore a 30 kW, circa 40,8 CV.');
  assert.match(answer('obblighi-03'), /cilindrata, tipo di motore, distanza e attività/);
  assert.equal(answer('obblighi-04'), 'Sì.');
  assert.equal(answer('obblighi-07'), 'No.');
  assert.equal(answer('obblighi-09'), 'No.');
});

test('worked navigation calculations use hours, nautical miles and knots consistently', () => {
  for (const [id, expected] of [
    ['calcoli-03', '3 miglia nautiche.'], ['calcoli-04', '1 ora e 30 minuti.'],
    ['calcoli-05', '12 nodi.'], ['calcoli-06', '1 ora.'],
    ['calcoli-07', '25 litri.'], ['calcoli-08', '4 ore.'], ['calcoli-09', '3 ore.'],
  ]) assert.equal(answer(id), expected);
});
