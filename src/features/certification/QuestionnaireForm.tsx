"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import type { Question, Questionnaire } from './types';

export function QuestionnaireForm({ questionnaire, questions }: { questionnaire: Questionnaire; questions: Question[] }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/questionnaires/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionnaire_id: questionnaire.id, answers }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Invio non riuscito.');
      setSubmitted(true);
      setMessage('Risposte registrate. Consulta l’esito nello storico delle richieste.');
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Invio non riuscito. Riprova.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-6">
    <h2 className="text-xl font-semibold">{questionnaire.title}</h2>
    <p className="text-white/60">{questionnaire.description}</p>
    <p className="text-sm text-white/60">Versione {questionnaire.version} · Soglia {questionnaire.pass_percent}% · Massimo 5 tentativi in 24 ore.</p>
    {questions.map((question) => <fieldset key={question.id} disabled={busy || submitted} className="space-y-3 border-t border-white/10 pt-5">
      <legend className="font-medium pt-4">{question.position}. {question.prompt}</legend>
      {question.options.map((option, index) => <label key={index} className="flex items-start gap-3 p-3 rounded-lg bg-white/5 cursor-pointer">
        <input type="radio" name={question.id} required checked={answers[question.id] === index}
          onChange={() => setAnswers({ ...answers, [question.id]: index })} className="mt-1" />
        <span>{option}</span>
      </label>)}
    </fieldset>)}
    {message && <p role="status" className="text-sm text-amber-200">{message}</p>}
    <Button type="submit" disabled={busy || submitted || questions.length === 0}>{busy ? 'Invio…' : submitted ? 'Risposte inviate' : 'Invia per la valutazione'}</Button>
  </form>;
}
