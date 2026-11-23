'use client';

import { useRef, useState } from 'react';
import { InfoDisclosure } from '@/components/ui/InfoDisclosure';
import data from './nautical-study.json';

type StudyQuestion = typeof data.questions[number];
const sources: Record<string, { label: string; url: string }> = data.sources;

export function NauticalStudy() {
  const [topic, setTopic] = useState('all');
  const [retryIds, setRetryIds] = useState<string[] | null>(null);
  const [round, setRound] = useState(0);
  const questions = data.questions.filter(q => (topic === 'all' || q.topic === topic) && (!retryIds || retryIds.includes(q.id)));
  return <div className="space-y-8">
    <nav aria-label="Argomenti patente nautica" className="flex flex-wrap gap-2">
      {[{ id: 'all', label: 'Tutti gli argomenti' }, ...data.topics].map(item => <button key={item.id} type="button" aria-pressed={topic === item.id} onClick={() => { setTopic(item.id); setRetryIds(null); setRound(r => r + 1); }}
        className={`min-h-11 border px-4 py-3 text-sm ${topic === item.id ? 'border-sky-200 text-sky-100 bg-sky-200/10' : 'border-white/20 text-white/65'}`}>{item.label}</button>)}
    </nav>
    <Session key={`${topic}-${round}`} questions={questions} onRetry={ids => { setRetryIds(ids); setRound(r => r + 1); }}/>
    <InfoDisclosure label="Info · Programma e fonti">
      <p>Esercitazioni originali di MareSalvo orientate alla categoria A a motore entro 12 miglia. Non sono quesiti ministeriali riprodotti né una simulazione completa d’esame. Non coprono tutto il programma: restano da approfondire, tra gli altri, motori, meteorologia, segnalamento, sicurezza ed esercizi sulla carta nautica, oltre alla pratica.</p>
      <p>La categoria A senza limiti, l’integrazione vela e la categoria D1 richiedono percorsi specifici. Le condizioni per navigare dipendono anche dall’unità e dalle regole locali.</p>
      <p>Riferimenti consultati il 23 novembre 2026. Per le COLREG si usano le regole internazionali, non le disposizioni statunitensi sulle acque interne.</p>
      <ul className="space-y-2">{Object.values(sources).map(source => <li key={source.url}><a className="underline underline-offset-4" href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a></li>)}</ul>
    </InfoDisclosure>
  </div>;
}

function Session({ questions, onRetry }: { questions: StudyQuestion[]; onRetry: (ids: string[] | null) => void }) {
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const heading = useRef<HTMLHeadingElement>(null);
  const question = questions[step];
  const checked = question && answers[question.id] !== undefined;
  const wrong = questions.filter(q => answers[q.id] !== q.answer);
  const next = () => { setChoice(null); setStep(s => s + 1); heading.current?.focus(); };
  return <section className="editorial-section max-w-3xl space-y-6" aria-label="Esercitazione nautica">
    <div className="flex flex-wrap justify-between gap-3 text-xs text-white/60"><span>Allenamento guidato · senza timer</span><span>{Object.keys(answers).length}/{questions.length} risposte verificate</span></div>
    <progress aria-label="Avanzamento esercitazione" className="quiz-progress" max={questions.length} value={Object.keys(answers).length}/>
    <h2 ref={heading} tabIndex={-1} className="text-2xl outline-none">{question ? `Domanda ${step + 1} di ${questions.length}` : 'Risultato dell’esercitazione'}</h2>
    {question ? <>
      <fieldset disabled={checked} className="space-y-3">
        <legend className="text-lg leading-relaxed mb-5">{question.prompt}</legend>
        {question.options.map((option, index) => <label key={index} className={`quiz-option ${choice === index ? 'quiz-option-selected' : ''}`}>
          <input type="radio" name={question.id} checked={choice === index} onChange={() => setChoice(index)}/>
          <span className="quiz-option-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span><span>{option}</span>
        </label>)}
      </fieldset>
      {checked && <div role="status" className="border-l-2 border-sky-200 pl-4 space-y-3 text-sm leading-relaxed">
        <p className="font-medium text-sky-100">{answers[question.id] === question.answer ? 'Risposta corretta.' : 'Risposta da rivedere.'}</p>
        <p>Risposta corretta: {question.options[question.answer]}</p><p className="text-white/70">{question.explanation}</p>
        <a className="inline-block underline text-sky-200" href={sources[question.source].url} target="_blank" rel="noreferrer">{sources[question.source].label} ↗</a>
      </div>}
      {checked ? <button type="button" className="min-h-11 border border-sky-200 px-5 py-3 text-sky-100" onClick={next}>{step === questions.length - 1 ? 'Vedi il risultato' : 'Prossima domanda'}</button>
        : <button type="button" disabled={choice === null} className="min-h-11 bg-sky-200 px-5 py-3 text-slate-950 disabled:opacity-40" onClick={() => { if (choice !== null) setAnswers(previous => ({ ...previous, [question.id]: choice })); }}>Verifica risposta</button>}
    </> : <>
      <p className="text-3xl text-sky-100">{questions.length - wrong.length}/{questions.length} risposte corrette</p>
      <p className="text-sm text-white/60">Questo risultato riguarda soltanto gli argomenti esercitati e non attesta la preparazione completa all’esame. Non viene salvato nel profilo e non genera certificati.</p>
      {wrong.length > 0 && <div className="space-y-3"><h3 className="text-lg">Argomenti da ripassare</h3>{wrong.map(q => <InfoDisclosure key={q.id} label={`Info · ${q.id}`}><p>{q.prompt}</p><p>{q.options[q.answer]}</p><p>{q.explanation}</p></InfoDisclosure>)}</div>}
      <div className="flex flex-wrap gap-3">{wrong.length > 0 && <button type="button" onClick={() => onRetry(wrong.map(q => q.id))} className="min-h-11 bg-sky-200 px-5 py-3 text-slate-950">Ripeti gli errori ({wrong.length})</button>}<button type="button" onClick={() => onRetry(null)} className="min-h-11 border border-white/30 px-5 py-3">Ricomincia l’argomento</button></div>
    </>}
  </section>;
}
