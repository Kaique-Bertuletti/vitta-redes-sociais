export const dynamic='force-dynamic';
export const maxDuration=60;
const base='https://graph.facebook.com/v27.0/';
// Escopo inicial autorizado: somente as oito campanhas monitoradas da conta Auge Panamby.
const ids=['120252688952160104','120252688877340104','120252688840280104','120252688774750104','120252688727880104','120252688708470104','120252688671230104','120252673269370104'];
type Row=Record<string,unknown>;
const num=(x:unknown)=>((typeof x==='number'||typeof x==='string'&&x.trim()!=='')&&Number.isFinite(Number(x)))?Number(x):null;
export async function GET(){
 const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
 if(process.env.VERCEL_ENV==='production')return reply({error:'Somente Preview.'},403);
 const token=process.env.META_ADS_ACCESS_TOKEN?.trim(),account=process.env.META_AD_ACCOUNT_ID?.trim();
 if(!token||account!=='act_1580176816346003')return reply({error:'Conta Auge Panamby não configurada.'},503);
 async function graph(path:string,params:Record<string,string>){const u=new URL(base+path);for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);const r=await fetch(u,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(7000)});const j=await r.json();if(!r.ok||j.error)throw Error('Meta recusou a consulta');return j;}
 async function pages(path:string,params:Record<string,string>){const out:Row[]=[];let after='';for(let i=0;i<5;i++){const j=await graph(path,{...params,...(after?{after}:{})});if(!Array.isArray(j.data))throw Error('Resposta inválida');out.push(...j.data);if(!j.paging?.next)return out;const next=j.paging?.cursors?.after;if(!next||next===after)throw Error('Paginação incompleta');after=next;}throw Error('Paginação incompleta');}
 const settled=await Promise.allSettled(ids.map(async campaign=>{
  const c=await graph(campaign,{fields:'account_id,name'});if(String(c.account_id)!==account.slice(4))throw Error('Conta divergente');
  const ads=await pages(campaign+'/ads',{fields:'id,name,creative{effective_instagram_media_id,source_instagram_media_id,instagram_permalink_url}',limit:'100'}).catch(()=>pages(campaign+'/ads',{fields:'id,name,creative{effective_instagram_media_id,instagram_permalink_url}',limit:'100'}));
  let insights:Row[]=[];let available=true;try{insights=await pages(campaign+'/insights',{level:'ad',fields:'ad_id,spend,reach,impressions,instagram_profile_follow,instagram_profile_visits,date_start,date_stop',date_preset:'maximum',limit:'100'});}catch{available=false;}
  return {available,rows:ads.map(a=>{const cr=(a.creative??{}) as Row;const s=insights.find(x=>String(x.ad_id)===String(a.id));return {adId:String(a.id),campaign,name:String(a.name??c.name??'Anúncio'),effectiveId:typeof cr.effective_instagram_media_id==='string'?cr.effective_instagram_media_id:null,sourceId:typeof cr.source_instagram_media_id==='string'?cr.source_instagram_media_id:null,permalink:typeof cr.instagram_permalink_url==='string'?cr.instagram_permalink_url:null,spend:num(s?.spend),reach:num(s?.reach),impressions:num(s?.impressions),followers:num(s?.instagram_profile_follow),visits:num(s?.instagram_profile_visits),start:s?.date_start??null,stop:s?.date_stop??null};})};
 }));
 const ok=settled.flatMap(s=>s.status==='fulfilled'?[s.value]:[]);
 if(!ok.length)return reply({error:'Não foi possível consultar as campanhas monitoradas.'},502);
 return reply({rows:ok.flatMap(x=>x.rows),complete:ok.length===ids.length&&ok.every(x=>x.available),updatedAt:new Date().toISOString()});
}
