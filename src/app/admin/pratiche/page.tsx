import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { Card } from '@/components/ui/Card';
import { ReviewForm } from '@/features/certification/ReviewForm';
import { APPLICATION_STATUS, type Application } from '@/features/certification/types';
import { formatDate } from '@/lib/utils';

export default async function ApplicationsPage() {
  const actor = await getCurrentProfile();
  if (!actor) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from('certification_applications')
    .select('*, applicant:profiles!certification_applications_profile_id_fkey(first_name,last_name)')
    .order('submitted_at', { ascending: false }).limit(100);
  const applications = (data ?? []) as (Application & { applicant: { first_name: string; last_name: string } | null })[];
  return <div className="space-y-5"><h1 className="text-2xl font-bold">Revisione richieste</h1>
    <p className="text-white/60">Ultime 100 richieste accessibili al tuo ruolo. L’approvazione emette un certificato dimostrativo, senza valore di qualifica o permesso.</p>
    {error ? <Card>Impossibile caricare le richieste. Verifica la configurazione del servizio.</Card> : applications.length === 0 ? <Card>Nessuna richiesta da visualizzare.</Card> : applications.map(a => <Card glass key={a.id}>
      <div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">{a.applicant?.first_name} {a.applicant?.last_name}</h2><span>{APPLICATION_STATUS[a.status]}</span></div>
      <p className="mt-2">{a.questionnaire_title} · v{a.questionnaire_version}</p>
      <p className="text-sm text-white/60 mt-2">{formatDate(a.submitted_at)} · {a.correct_answers}/{a.total_questions} risposte corrette · {a.score_percent}%</p>
      {a.review_notes && <p className="mt-2">Note: {a.review_notes}</p>}
      {a.status === 'pending' && (a.profile_id === actor.id ? <p className="mt-3 text-amber-200">La tua richiesta deve essere esaminata da un altro membro dello staff.</p> : <ReviewForm applicationId={a.id} />)}
    </Card>)}
  </div>;
}
