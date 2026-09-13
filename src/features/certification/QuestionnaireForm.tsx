"use client";

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { Question, Questionnaire } from './types';

export function QuestionnaireForm({ questionnaire, questions, preview = false }: { questionnaire: Questionnaire; questions: Question[]; preview?: boolean }) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const question = questions[step];
  const complete = questions.length > 0 && questions.every(q => answers[q.id] !== undefined);
  const changeStep = (next: number) => { setStep(next); headingRef.current?.focus(); };
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (preview || !complete || busy || submitted) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/questionnaires/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionnaire_id: questionnaire.id, answers }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Invio non riuscito.');
      setSubmitted(true);
      setMessage('Risposte registrate. L’esito è disponibile nello storico delle richieste.');
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Invio non riuscito. Riprova.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-7">
    <div><p className="story-eyebrow mb-3">{preview ? 'ANTEPRIMA DEL PERCORSO' : 'IL TUO PERCORSO'}</p>
      <h2 ref={headingRef} tabIndex={-1} className="text-2xl sm:text-3xl font-medium tracking-tight outline-none">{questionnaire.title}</h2>
      <p className="text-white/55 text-sm mt-3">{questions.length} domande · Soglia {questionnaire.pass_percent}% · Versione {questionnaire.version}</p>
    </div>
    <div>
      <div className="flex justify-between text-xs text-white/55 mb-3"><span>{question ? `Domanda ${step + 1} di ${questions.length}` : 'Riepilogo delle risposte'}</span><span>{Object.keys(answers).length}/{questions.length} completate</span></div>
      <progress aria-label="Domande completate" value={Object.keys(answers).length} max={questions.length || 1} className="quiz-progress" />
    </div>
    {question ? <fieldset key={question.id} disabled={busy || submitted} className="space-y-3">
      <legend className="text-lg sm:text-xl leading-relaxed mb-6">{question.prompt}</legend>
      {question.options.map((option, index) => <label key={index} className={`quiz-option ${answers[question.id] === index ? 'quiz-option-selected' : ''}`}>
        <input type="radio" name={question.id} checked={answers[question.id] === index} onChange={() => setAnswers({ ...answers, [question.id]: index })} />
        <span className="quiz-option-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span><span className="flex-1">{option}</span>
        {answers[question.id] === index && <Check size={18} aria-hidden="true" />}
      </label>)}
    </fieldset> : <div className="space-y-3">{questions.map((q, index) => <button key={q.id} type="button" onClick={() => changeStep(index)} disabled={busy || submitted} className="block w-full text-left border-b border-white/10 pb-4">
      <span className="text-sm text-white/60">{index + 1}. {q.prompt}</span><span className="block mt-2 text-[#c0e4d9]">{q.options[answers[q.id]] ?? 'Risposta mancante'} <span className="text-xs underline ml-2">Modifica</span></span>
    </button>)}</div>}
    {message && <p role="status" className="text-sm text-amber-200">{message}</p>}
    <div className="flex flex-wrap items-center justify-between gap-4 pt-3">
      <Button type="button" variant="ghost" disabled={step === 0 || busy} onClick={() => changeStep(step - 1)}><ArrowLeft size={16} />Indietro</Button>
      {question ? <Button type="button" disabled={answers[question.id] === undefined} onClick={() => changeStep(step + 1)}>{step === questions.length - 1 ? 'Rivedi le risposte' : 'Prossima domanda'}<ArrowRight size={16} /></Button>
        : preview ? <Link href="/registrazione" className="story-link !mt-0">Registrati per salvare il risultato <ArrowRight size={16} /></Link>
        : submitted ? <Button type="button" variant="outline" onClick={() => { setSubmitted(false); setAnswers({}); setMessage(''); changeStep(0); }}>Nuovo tentativo</Button>
        : <Button type="submit" disabled={busy || !complete}>{busy ? 'Invio…' : 'Invia per la valutazione'}</Button>}
    </div>
    <p className="text-xs text-white/45">{preview ? 'Questa anteprima non invia né salva le risposte. Accedi all’area personale per il percorso con valutazione.' : 'Valutazione sul server. Il superamento richiede comunque la revisione dello staff; massimo 5 tentativi in 24 ore.'}</p>
  </form>;
}
