import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { NetReportForm } from '@/features/ghost-nets/NetReportForm';

export const dynamic = 'force-dynamic';
export default async function SegnalaRetePage({searchParams}:{searchParams:Promise<{lat?:string;lng?:string}>}) {
  const query=await searchParams;
  const lat=Number(query.lat),lng=Number(query.lng);
  const initial=query.lat?.trim()&&query.lng?.trim()&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?{lat,lng}:undefined;
  const profile = await getCurrentProfile();
  let allowed = false, unavailable = false;
  if (profile) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('can_report_ghost_net');
    allowed = data === true; unavailable = !!error;
  }
  return <div className="pt-28 pb-16 px-4 sm:px-8 mx-auto max-w-7xl">
    <p className="section-kicker mb-5">Osservare · documentare · proteggere</p>
    <h1 className="page-title text-3xl sm:text-5xl text-white">Una rete segnalata, un mare più libero.</h1>
    <p className="mt-5 max-w-2xl text-white/60">Localizza un attrezzo abbandonato e racconta come lo hai individuato. Le osservazioni di persone diverse aiutano lo staff a valutare le segnalazioni e organizzare le verifiche.</p>
    <NetReportForm key={initial?`${lat},${lng}`:'empty'} initial={initial} allowed={allowed} signedIn={!!profile} unavailable={unavailable}/>
  </div>;
}
