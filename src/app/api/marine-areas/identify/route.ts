import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const p=request.nextUrl.searchParams;
  const lng=Number(p.get('lng')), lat=Number(p.get('lat')), zoom=Number(p.get('zoom'));
  if (!['lng','lat','zoom'].every(k=>p.has(k)&&p.get(k)!=='') || ![lng,lat,zoom].every(Number.isFinite) || Math.abs(lng)>180 || Math.abs(lat)>85 || zoom<0 || zoom>22)
    return NextResponse.json({error:'Coordinate non valide.'},{status:400});
  const x=lng*20037508.342789244/180;
  const y=Math.log(Math.tan((90+lat)*Math.PI/360))*20037508.342789244/Math.PI;
  const radius=156543.033928/2**zoom*128;
  const params=new URLSearchParams({service:'WMS',version:'1.3.0',request:'GetFeatureInfo',layers:'cddaareas,wdpaareas',query_layers:'cddaareas,wdpaareas',styles:'',crs:'EPSG:3857',bbox:[x-radius,y-radius,x+radius,y+radius].join(','),width:'256',height:'256',i:'128',j:'128',info_format:'application/json',feature_count:'10'});
  try {
    const response=await fetch(`https://ows.emodnet-humanactivities.eu/wms?${params}`,{signal:AbortSignal.timeout(12000),next:{revalidate:86400}});
    if(!response.ok) throw new Error('WMS unavailable');
    const data=await response.json();
    if(!Array.isArray(data.features)) throw new Error('Invalid WMS response');
    const text=(value:unknown)=>typeof value==='string'||typeof value==='number'?String(value).slice(0,300):'';
    const features=data.features.slice(0,10).map((f:{properties:Record<string,unknown>})=>{
      const props=Object.fromEntries(Object.entries(f.properties??{}).map(([key,value])=>[key.toLowerCase(),value]));
      return {name:text(props.name??props.orig_name??props.sitename)||'Area protetta',designation:text(props.desig_eng??props.desig??props.designation??props.designatio),category:text(props.iucn_cat??props.iucncatego),status:text(props.status??props.designated),country:text(props.iso3??props.country),source:'EMODnet / CDDA / WDPA'};
    });
    return NextResponse.json({features});
  } catch { return NextResponse.json({error:'Il servizio delle schede internazionali non risponde. Riprova tra poco.'},{status:503}); }
}
