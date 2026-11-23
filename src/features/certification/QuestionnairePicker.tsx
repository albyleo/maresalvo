"use client";

import { InfoDisclosure } from '@/components/ui/InfoDisclosure';
import references from './course-sources.json';
import { useState } from 'react';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { QuestionnaireForm } from './QuestionnaireForm';
import type { Question, Questionnaire } from './types';

export function QuestionnairePicker({ items, preview = false }: { items: (Questionnaire & { questions: Question[] })[]; preview?: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find(q => q.id === selectedId);
  if (selected) return <div>
    <button type="button" onClick={() => setSelectedId(null)} className="flex gap-2 items-center text-sm text-white/60 mb-7 hover:text-white"><ArrowLeft size={16} />Tutti i percorsi</button>
    <div className="editorial-section max-w-3xl"><QuestionnaireForm key={selected.id} questionnaire={selected} questions={selected.questions} preview={preview} /></div>
  </div>;
  return <div className="course-list">{items.map((item, index) => {
    const reference = (references as Record<string, { reviewedAt: string; sources: { label: string; url: string }[] }>)[item.id];
    return <article key={item.id} className="course-row group">
      <span className="course-number">{String(index + 1).padStart(2, '0')}</span>
      <div className="min-w-0 space-y-4">
        <button type="button" onClick={() => setSelectedId(item.id)} className="text-left hover:text-[#b7d6c9] focus-visible:outline-2 focus-visible:outline-offset-4">
          <h2 className="text-xl sm:text-2xl tracking-tight font-normal">{item.title}</h2>
          <span className="mt-3 block text-[11px] text-[#b7d6c9]">{item.questions.length} domande · Soglia {item.pass_percent}% · Apri percorso</span>
        </button>
        <InfoDisclosure label="Info sul percorso">
          <p>{item.description}</p>
          {reference && <><p>Domande originali di MareSalvo basate sulle fonti indicate. Materiale formativo da validare; non è un questionario ufficiale d’esame. Le guide estere offrono indicazioni generali di sicurezza, non regole italiane.</p>
            <p>Fonti consultate il {reference.reviewedAt.split('-').reverse().join('/')}</p>
            <ul className="space-y-2">{reference.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">{source.label} ↗</a></li>)}</ul></>}
        </InfoDisclosure>
      </div>
      <button type="button" onClick={() => setSelectedId(item.id)} aria-label={`Apri ${item.title}`} className="p-2 text-white/60 hover:text-[#b7d6c9]"><ArrowUpRight size={21}/></button>
    </article>;
  })}</div>;
}
