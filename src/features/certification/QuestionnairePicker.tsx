"use client";

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
  return <div className="course-list">{items.map((item, index) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className="course-row group">
    <span className="course-number">0{index + 1}</span>
    <div className="course-copy"><div><h2 className="text-xl sm:text-2xl tracking-tight font-normal">{item.title}</h2><p className="mt-4 text-[11px] text-[#b7d6c9]">{item.questions.length} domande <span className="text-white/25 mx-2">/</span> {item.pass_percent}% per superare</p></div><p className="text-white/55 text-sm leading-relaxed max-w-md">{item.description}</p></div>
    <ArrowUpRight className="text-white/40 group-hover:text-[#b7d6c9] mt-1 transition-colors" size={21} />
  </button>)}</div>;
}
