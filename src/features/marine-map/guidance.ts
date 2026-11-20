/** Editorial summaries are separate from imported geometry and are never overwritten by marine:sync. */
export type Activity = 'fishing' | 'spearfishing' | 'anchoring' | 'swimming' | 'diving' | 'navigation';
export type Rule = { zones: string[]; activity: Activity; status: 'Vietato' | 'Regolamentato' | 'Su autorizzazione'; note: string; source: number };
type Source = { label: string; url: string; edition: string; consulted: string };
export type Guidance = { manager: string; sources: Source[]; rules: Rule[]; note?: string };
export const ACTIVITIES: Record<Activity,string> = { fishing:'Pesca sportiva', spearfishing:'Pesca subacquea', anchoring:'Ancoraggio', swimming:'Balneazione', diving:'Immersioni', navigation:'Navigazione' };
const source=(label:string,url:string,edition='Data di aggiornamento non dichiarata'):Source=>({label,url,edition,consulted:'2026-11-20'});
const rule=(zones:string[],activity:Activity,status:Rule['status'],note:string,source=0):Rule=>({zones,activity,status,note,source});
export const GUIDANCE: Record<string,Guidance> = {
  EUAP0554: {
    manager:'Azienda Speciale Parco di Porto Conte',
    sources:[source('Disciplinare attuativo · art. 15','https://www.algheroparks.it/media/2148/disciplinare_attuativo_amp_capo_caccia_2026_mase.pdf','2026')],
    rules:[rule(['A'],'fishing','Vietato','Non è prevista pesca sportiva nelle zone A.'),rule(['A','B','C'],'spearfishing','Vietato','Divieto esteso all’intera AMP.'),rule(['B','C'],'fishing','Su autorizzazione','Residenti e non residenti: autorizzazione, limiti di attrezzi e catture, logbook. Chiusura stagionale in un settore dal 1 settembre al 1 marzo: consultare la carta dell’art. 15.')],
  },
  EUAP0953: {
    manager:'Comune di Villasimius · AMP Capo Carbonara',
    sources:[source('Attività consentite · ente gestore','https://www.ampcapocarbonara.it/attivita-consentite.html')],
    rules:[rule(['A'],'fishing','Vietato','Pesca sportiva esclusa.'),rule(['A'],'swimming','Vietato','Balneazione esclusa dalla zona A.'),rule(['A','B','C','D'],'spearfishing','Vietato','Divieto in tutte le zone.'),rule(['B'],'fishing','Regolamentato','Riservata alle categorie ammesse dal regolamento, tra cui residenti e soggetti equiparati. Verificare requisiti e autorizzazioni.'),rule(['C','D'],'fishing','Regolamentato','Ammessa anche ai non residenti secondo regolamento e procedure del gestore.'),rule(['B'],'diving','Regolamentato','Immersioni guidate secondo le condizioni del gestore; immersioni individuali non consentite.')],
  },
  EUAP0951: {
    manager:'Comune di Cabras · AMP Penisola del Sinis – Isola di Mal di Ventre',
    sources:[source('Pesca sportiva e ricreativa · ente gestore','https://www.areamarinasinis.it/attivita-consentite/pesca-sportiva-ricreativa/','Pagina riferita al D.M. 28/04/2017, art. 26'),source('Ancoraggio · ente gestore','https://www.areamarinasinis.it/attivita-consentite/ancoraggio/')],
    rules:[rule(['A'],'fishing','Vietato','Pesca sportiva esclusa.'),rule(['B'],'fishing','Su autorizzazione','Riservata ai residenti nel Comune di Cabras, con limiti di orari, attrezzi e catture.'),rule(['C'],'fishing','Su autorizzazione','Si applicano limiti di orari, attrezzi e catture indicati dal gestore.'),rule(['A','B','C'],'spearfishing','Vietato','Divieto nell’intera AMP; il transito con attrezzatura richiede specifiche comunicazioni.'),rule(['A'],'anchoring','Vietato','Ancoraggio escluso.',1),rule(['B','C'],'anchoring','Regolamentato','Solo nelle aree individuate e su fondali compatibili; esclusi Posidonia e coralligeno. Verificare le disposizioni stagionali.',1)],
  },
  EUAP1233: {
    manager:'Area Marina Protetta Capo Milazzo',
    sources:[source('Zonazione e ancoraggio · ente gestore','https://www.ampcapomilazzo.it/it/zonazione')],
    rules:[rule(['A','Bs'],'anchoring','Vietato','Ancoraggio escluso nelle zone A e Bs.'),rule(['B','C'],'anchoring','Regolamentato','Solo negli spazi individuati su fondali inerti, sabbiosi o ciottolosi. Consultare anche le condizioni di manovra.')],
  },
  EUAP0552: {
    manager:'Ente Parco Nazionale dell’Asinara',
    sources:[source('Accesso e tutela marina · ente gestore','https://www.parcoasinara.org/visitare-il-parco/come-arrivare/')],
    rules:[rule(['A'],'navigation','Vietato','Accesso ordinario escluso; eccezioni per soccorso e attività scientifiche autorizzate.'),rule(['B'],'swimming','Regolamentato','Attività prevista secondo le disposizioni del Parco.'),rule(['B'],'diving','Regolamentato','Immersioni soggette alle disposizioni del Parco.')],
  },
  EUAP0952: {
    manager:'Consorzio di Gestione AMP Tavolara – Punta Coda Cavallo',
    sources:[source('Zonizzazione · ente gestore','https://www.amptavolara.com/territorio/zonizzazione','Pagina riferita al D.M. 299/2014'),source('Guida istituzionale · ente gestore','https://www.amptavolara.com/Cms_Data/Contents/amp_it/Folders/Documentazione/~contents/GS82WLAKUZLF5DQX/pieghevole-istituzionale-2022.pdf','2022 · documento storico')],
    rules:[rule(['B','C'],'anchoring','Regolamentato','Solo sui fondali e negli spazi individuati dal gestore; tutela di Posidonia e coralligeno.'),rule(['B','C'],'spearfishing','Vietato','Pesca subacquea esclusa.'),rule(['A','B'],'fishing','Vietato','Divieto riportato nella guida istituzionale 2022: verificare eventuali atti successivi.',1)],
    note:'La guida 2022 è una fonte storica: le autorizzazioni e le ordinanze successive vanno verificate con il gestore.',
  },
  EUAP0950: {
    manager:'Consorzio di Gestione Area Marina Protetta Porto Cesareo',
    sources:[source('Scheda dell’ente gestore su Parks.it e regolamento allegato','https://www.parks.it/riserva.marina.porto.cesareo/par.php','Regolamento pubblicato il 02/01/2010')],
    rules:[],
    note:'Perimetro e settori A/B/C disponibili. La sintesi delle attività è in verifica: consultare il regolamento e le ordinanze del Consorzio. Il solo colore della zona non indica un permesso di pesca.',
  },
};
export function areaRule(id:string,zone:string,activity:Activity):Rule|undefined {
  return GUIDANCE[id]?.rules.find(r=>r.zones.includes(zone)&&r.activity===activity);
}
