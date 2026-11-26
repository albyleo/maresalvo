"use client";

import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { Question, Questionnaire } from './types';

/** Educational practice only: never submits answers or creates an application. */
export function QuestionnairePractice({ questionnaire, questions, answerKeys }: {
  questionnaire: Questionnaire; questions: Question[]; answerKeys: Record<string, number>;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const question = questions[step];
  const answered = question && answers[question.id] !== undefined;
  const correct = answered && answers[question.id] === answerKeys[question.id];
  const score = questions.filter(q => answers[q.id] !== undefined && answers[q.id] === answerKeys[q.id]).length;
  const changeStep = (next: number) => { setStep(next); heading.current?.focus(); };

  if (!questionnaire.is_demo || !questions.length || questions.some(q => !Number.isInteger(answerKeys[q.id]) || !q.options[answerKeys[q.id]])) {
    return <p role="status">Allenamento non disponibile per questa versione del percorso.</p>;
  }

  return <section className="space-y-7" aria-label="Allenamento con correzione immediata">
    <div>
      <p className="story-eyebrow mb-3">ALLENAMENTO</p>
      <h2 ref={heading} tabIndex={-1} className="text-2xl sm:text-3xl font-medium tracking-tight outline-none">{questionnaire.title}</h2>
      <p className="text-sm text-white/60 mt-3">Scegli una risposta per vedere subito la correzione. Ogni domanda conta al primo tentativo.</p>
    </div>
    <div>
      <div className="flex justify-between gap-3 text-xs text-white/55 mb-3"><span>{question ? `Domanda ${step + 1} di ${questions.length}` : 'Risultato dell’allenamento'}</span><span>{Object.keys(answers).length}/{questions.length} completate</span></div>
      <progress aria-label="Domande completate" value={Object.keys(answers).length} max={questions.length} className="quiz-progress" />
    </div>
    {question ? <>
      <fieldset key={question.id} className="space-y-3" aria-describedby="practice-feedback">
        <legend className="text-lg sm:text-xl leading-relaxed mb-6">{question.prompt}</legend>
        {question.options.map((option, index) => {
          const selected = answers[question.id] === index;
          const rightOption = answered && index === answerKeys[question.id];
          return <label key={index} className={`quiz-option ${rightOption ? 'quiz-option-correct' : selected ? 'quiz-option-incorrect' : ''}`}>
            <input type="radio" name={question.id} checked={selected} aria-disabled={Boolean(answered)} onChange={() => setAnswers(previous => previous[question.id] === undefined ? { ...previous, [question.id]: index } : previous)} />
            <span className="quiz-option-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
            <span className="flex-1">{option}{rightOption && <span className="block text-xs mt-1">Risposta corretta</span>}{selected && !rightOption && <span className="block text-xs mt-1">La tua risposta · Errata</span>}</span>
            {rightOption ? <Check size={18} aria-hidden="true" /> : selected ? <X size={18} aria-hidden="true" /> : null}
          </label>;
        })}
      </fieldset>
      <div id="practice-feedback" role="status" aria-live="polite" aria-atomic="true">
        {answered && <div className={`border-l-2 pl-4 text-sm leading-relaxed ${correct ? 'border-emerald-200 text-emerald-100' : 'border-amber-200 text-amber-100'}`}>
          <p className="font-medium">{correct ? 'Risposta corretta.' : 'Risposta errata.'}</p>
          {!correct && <p className="mt-2">Risposta corretta: {question.options[answerKeys[question.id]]}</p>}
        </div>}
      </div>
    </> : <div className="space-y-5">
      <p className="text-3xl text-[#b7e5d5]">{score}/{questions.length} risposte corrette</p>
      <div className="space-y-3">{questions.map((q, index) => <button key={q.id} type="button" onClick={() => changeStep(index)} className="block w-full text-left border-b border-white/15 py-3">
        <span>{index + 1}. {q.prompt}</span>
        <span className={`block text-sm mt-2 ${answers[q.id] === answerKeys[q.id] ? 'text-emerald-100' : 'text-amber-100'}`}>{answers[q.id] === answerKeys[q.id] ? 'Corretta' : 'Errata'} · Rivedi</span>
      </button>)}</div>
    </div>}
    <div className="flex flex-wrap justify-between gap-4">
      <Button type="button" variant="ghost" disabled={step === 0} onClick={() => changeStep(step - 1)}><ArrowLeft size={16} />Indietro</Button>
      {question ? <Button type="button" disabled={!answered} onClick={() => changeStep(step + 1)}>{step === questions.length - 1 ? 'Vedi il risultato' : 'Prossima domanda'}<ArrowRight size={16} /></Button>
        : <Button type="button" onClick={() => { setAnswers({}); changeStep(0); }}>Ricomincia l’allenamento</Button>}
    </div>
    <p className="text-xs text-white/50">Allenamento libero: il risultato non viene salvato e non genera richieste o certificati. La valutazione con revisione dello staff è disponibile nell’area personale.</p>
  </section>;
}
