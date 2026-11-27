import {identity,reply as deniedReply} from '../_shared/security';
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
type Media = {is_shared_to_feed?:boolean;id:string;caption?:string;media_type?:string;media_product_type?:string;media_url?:string;thumbnail_url?:string;permalink?:string;timestamp?:string};
type GraphPage = {data?:Media[];paging?:{next?:string;cursors?:{after?:string}};error?:{code?:number}};
export async function GET(req:Request){
 if(!await identity(req))return deniedReply({error:"Acesso não autorizado"},401);
 const token=(process.env.VERCEL_ENV==='preview'?process.env.INSTAGRAM_PREVIEW_ACCESS_TOKEN:process.env.INSTAGRAM_ACCESS_TOKEN)?.trim();
 const account=process.env.INSTAGRAM_ACCOUNT_ID?.trim();
 const headers={'Cache-Control':'private, no-store'};
 if(!token||!account||!/^\d+$/.test(account))return NextResponse.json({error:'Credencial do Instagram não configurada.'},{status:503,headers});
 const items=new Map<string,Media>(); let after:string|undefined; const seen=new Set<string>(); let complete=false; let feedField=true;
 try{
  for(let page=0;page<100;page++){
   const url=new URL(`https://graph.facebook.com/v27.0/${account}/media`);
   url.searchParams.set('fields','id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp');if(feedField)url.searchParams.set('fields',url.searchParams.get('fields')+',is_shared_to_feed');url.searchParams.set('limit','100');if(after)url.searchParams.set('after',after);
   let res=await fetch(url,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(8000)});let j:GraphPage=await res.json();
   if(feedField&&j.error?.code===100){feedField=false;url.searchParams.set('fields',url.searchParams.get('fields')!.replace(',is_shared_to_feed',''));res=await fetch(url,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(8000)});j=await res.json();}
   if(!res.ok||j.error||!Array.isArray(j.data))throw new Error(`Meta recusou a consulta (HTTP ${res.status}, código ${j.error?.code??'—'}).`);
   for(const m of j.data)if(m.id&&m.timestamp)items.set(m.id,{id:m.id,is_shared_to_feed:typeof m.is_shared_to_feed==='boolean'?m.is_shared_to_feed:undefined,caption:m.caption,media_type:m.media_type,media_product_type:m.media_product_type,media_url:m.media_type==='IMAGE'||m.media_type==='CAROUSEL_ALBUM'?m.media_url:undefined,thumbnail_url:m.thumbnail_url,permalink:m.permalink,timestamp:m.timestamp});
   if(!j.paging?.next){complete=true;break;}after=j.paging.cursors?.after;if(!after||seen.has(after))break;seen.add(after);
  }
  return NextResponse.json({items:[...items.values()],complete,updatedAt:new Date().toISOString()},{headers});
 }catch(e){return NextResponse.json({error:e instanceof Error&&e.message.startsWith('Meta recusou')?e.message:'Não foi possível consultar o Instagram. Tente novamente.'},{status:502,headers});}
}
