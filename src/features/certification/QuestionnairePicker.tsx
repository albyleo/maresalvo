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
    <div className="rounded-2xl border border-white/10 bg-white/[.03] p-5 sm:p-9 max-w-3xl"><QuestionnaireForm key={selected.id} questionnaire={selected} questions={selected.questions} preview={preview} /></div>
  </div>;
  return <div className="grid md:grid-cols-3 gap-5">{items.map((item, index) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className="text-left group border border-white/15 rounded-2xl p-7 bg-white/[.025] hover:bg-white/[.06] transition-colors focus-visible:outline-2 focus-visible:outline-[#b7e5d5]">
    <div className="flex items-center justify-between mb-12"><span className="text-sm text-[#b7e5d5]">0{index + 1}</span><ArrowUpRight className="text-white/40 group-hover:text-white" size={21} /></div>
    <h2 className="text-2xl tracking-tight font-medium mb-4">{item.title}</h2><p className="text-white/55 text-sm leading-relaxed min-h-16">{item.description}</p>
    <p className="border-t border-white/10 mt-7 pt-5 text-xs text-white/55">{item.questions.length} domande · {item.pass_percent}% per superare</p>
  </button>)}</div>;
}
