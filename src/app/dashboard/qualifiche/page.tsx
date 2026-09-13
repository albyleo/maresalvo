import Link from 'next/link';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { Card } from '@/components/ui/Card';
import { QuestionnairePicker } from '@/features/certification/QuestionnairePicker';
import { APPLICATION_STATUS, type Application, type Question, type Questionnaire } from '@/features/certification/types';
import { formatDate } from '@/lib/utils';

export default async function DashboardQualifichePage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const [catalog, history] = await Promise.all([
    supabase.from('questionnaires').select('*').eq('is_active', true).order('version'),
    supabase.from('certification_applications').select('*').eq('profile_id', profile.id).order('submitted_at', { ascending: false }),
  ]);
  if (catalog.error || history.error) return <Card><h1 className="text-xl">Percorso non disponibile</h1><p className="mt-3">Il servizio questionari non è ancora pronto. Riprova più tardi.</p></Card>;
  const questionnaires = (catalog.data ?? []) as Questionnaire[];
  const applications = (history.data ?? []) as (Application & { questionnaire_id: string })[];
  const { data: questions, error } = questionnaires.length
    ? await supabase.from('questionnaire_questions').select('id,questionnaire_id,position,prompt,options').in('questionnaire_id', questionnaires.map(q => q.id)).order('position')
    : { data: [], error: null };
  if (error) return <Card>Impossibile caricare le domande. Riprova più tardi.</Card>;
  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">Qualifiche e questionari</h1>
    <p className="text-amber-200 bg-amber-300/10 border border-amber-300/20 p-4 rounded-xl">Ambiente pilota: i questionari e i certificati dimostrativi non sono qualifiche FIPSAS e non autorizzano alcuna attività sportiva o di pesca.</p>
    {applications.length > 0 && <section className="space-y-3"><h2 className="text-xl font-semibold">Le tue richieste</h2>
      {applications.map(a => <Card key={a.id} glass>
        <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{a.questionnaire_title}</h3><span>{APPLICATION_STATUS[a.status]}</span></div>
        <p className="text-sm text-white/60 mt-2">{formatDate(a.submitted_at)} · Versione {a.questionnaire_version} · {a.correct_answers}/{a.total_questions} risposte corrette ({a.score_percent}%)</p>
        {a.status === 'pending' && <p className="mt-2">Questionario superato. La richiesta attende la revisione dello staff.</p>}
        {a.review_notes && <p className="mt-2">Note dello staff: {a.review_notes}</p>}
        {a.certificate_id && <Link href="/dashboard/certificati" className="inline-block mt-3 text-[var(--color-aqua)] underline">Apri il certificato demo</Link>}
      </Card>)}
    </section>}
    {questionnaires.length === 0 && <Card>Nessun questionario disponibile al momento.</Card>}
    <QuestionnairePicker items={questionnaires.filter(q => !applications.some(a => a.questionnaire_id === q.id && ['pending', 'approved'].includes(a.status))).map(q => ({ ...q, questions: (questions ?? []).filter(item => item.questionnaire_id === q.id) as Question[] }))} />
  </div>;
}
