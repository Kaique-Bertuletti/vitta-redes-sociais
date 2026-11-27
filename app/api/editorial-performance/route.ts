import {identity,reply as deniedReply} from '../_shared/security';
export const dynamic='force-dynamic';
export const maxDuration=30;
const base='https://graph.facebook.com/v27.0/';
const metrics=['views','reach','likes','comments','shares','saved','total_interactions'];
type Row=Record<string,unknown>;
const num=(x:unknown):number|null=>typeof x==='number'&&Number.isFinite(x)?x:null;
export async function GET(req:Request){
 if(!await identity(req))return deniedReply({error:"Acesso não autorizado"},401);
 const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
 if(process.env.VERCEL_ENV==='production')return reply({error:'Somente Preview.'},403);
 const token=process.env.INSTAGRAM_PREVIEW_ACCESS_TOKEN?.trim(), account=process.env.INSTAGRAM_ACCOUNT_ID?.trim();
 const id=new URL(req.url).searchParams.get('id')||'';
 if(!token||!account)return reply({error:'Credencial Instagram Preview indisponível.'},503);
 if(!/^\d{1,30}$/.test(id))return reply({error:'ID inválido.'},400);
 async function graph(path:string,params:Record<string,string>){const url=new URL(base+path);for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(6500)});const j=await r.json();if(!r.ok||j.error)throw Error(`Meta: ${j.error?.code??r.status}`);return j;}
 try{
  const info=await graph(id,{fields:'id,username,owner,media_product_type,media_type,permalink'});
  if(String(info.owner?.id??info.owner)!==account&&String(info.username??'').toLowerCase()!=='vittaemsaopaulo')return reply({error:'Não foi possível confirmar a propriedade da mídia.'},403);
  const organic:Record<string,number|null>=Object.fromEntries(metrics.map(k=>[k,null]));const total:Record<string,number|null>={views:null,likes:null,comments:null,shares:null,saved:null};const notes:string[]=[];
  const results=await Promise.allSettled([
   graph(id,{fields:'total_views_count,total_like_count,total_comments_count,shares_count,saved_count'}),
   info.media_product_type==='AD'?Promise.resolve(null):graph(id+'/insights',{metric:metrics.join(',')})
  ]);
  if(results[0].status==='fulfilled'){const j=results[0].value;for(const [key,field] of Object.entries({views:'total_views_count',likes:'total_like_count',comments:'total_comments_count',shares:'shares_count',saved:'saved_count'}))total[key]=num(j[field]);}else notes.push('Campos gerais indisponíveis.');
  function read(j:{data?:Row[]}|null){for(const x of j?.data??[]){const key=String(x.name);if(metrics.includes(key)){const values=x.values as {value?:unknown}[]|undefined;organic[key]=num(values?.[0]?.value);}}}
  if(results[1].status==='fulfilled')read(results[1].value);else {
   // A single unsupported metric can reject the whole request; retry separately.
   const fallback=await Promise.allSettled(metrics.map(metric=>graph(id+'/insights',{metric})));for(const f of fallback)if(f.status==='fulfilled')read(f.value);notes.push('Alguns insights podem estar indisponíveis para este formato.');
  }
  if(info.media_product_type==='AD')notes.push('Objeto publicitário: insights orgânicos não consultados.');
  return reply({id,product:info.media_product_type,organic,total,notes,updatedAt:new Date().toISOString()});
 }catch{return reply({error:'Não foi possível consultar ou confirmar acesso à publicação.'},502);}
}
