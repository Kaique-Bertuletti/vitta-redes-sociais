import {identity,reply,sameOrigin,sb} from '../_shared/security';
export const dynamic='force-dynamic';
const stages=['A verificar','Lead recebido','Encaminhado ao corretor','Em atendimento','Sem retorno do cliente','Visita agendada','Visita realizada','Em negociação','Venda realizada','Venda perdida','Sem atendimento'];
const fields='id,name,phone,email,development,source,status,broker,captured_at,notes,sale_value,created_at';
export async function GET(req:Request){
 const u=await identity(req);if(!u||!['admin','marketing'].includes(u.role))return reply({error:'Acesso restrito à equipe autorizada.'},403);
 try{const rows=await sb('/rest/v1/organic_leads?select='+fields+'&order=created_at.desc&limit=1000');return reply({rows});}catch{return reply({error:'Não foi possível consultar os leads.'},503)}
}
async function save(req:Request,edit:boolean){
 if(!sameOrigin(req))return reply({error:'Origem inválida'},403);
 const u=await identity(req);if(!u||!['admin','marketing'].includes(u.role))return reply({error:'Sem permissão'},403);
 let raw:unknown;try{const t=await req.text();if(t.length>20000)return reply({error:'Dados muito extensos'},413);raw=JSON.parse(t)}catch{return reply({error:'Dados inválidos'},400)}
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return reply({error:'Dados inválidos'},400);
 const x=raw as Record<string,unknown>;
 const str=(k:string,max:number)=>typeof x[k]==='string'&&String(x[k]).length<=max?String(x[k]).trim():null;
 const name=str('name',200),phone=str('phone',40),development=str('development',200),status=str('status',80),email=str('email',254),broker=str('broker',200),notes=str('notes',4000),date=str('captured_at',40);
 if(!name||!phone||!development||!status||!stages.includes(status)||!/^\+?[\d ()-]{8,30}$/.test(phone)||phone.replace(/\D/g,'').length<8||phone.replace(/\D/g,'').length>15||email===null||broker===null||notes===null||date===null||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date)))))return reply({error:'Confira os campos obrigatórios e os formatos.'},400);
 const digits=phone.replace(/\D/g,'');const normalized=phone.startsWith('+')?'+'+digits:(digits.length===10||digits.length===11)?'+55'+digits:'+'+digits;
 const sale=x.sale_value===null||x.sale_value===''?null:typeof x.sale_value==='number'?x.sale_value:NaN;
 if(sale!==null&&(!Number.isFinite(sale)||sale<0||sale>999999999999))return reply({error:'Valor de venda inválido'},400);
 const id=str('id',36);if(edit&&(!id||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))return reply({error:'Identificador inválido'},400);
 const body={name,phone:normalized,email:email||null,development,status,broker:broker||null,notes:notes||null,captured_at:date?date+'T12:00:00-03:00':null,sale_value:status==='Venda realizada'?sale:null,source:'Instagram orgânico'};
 try{const rows=await sb('/rest/v1/organic_leads'+(edit?'?id=eq.'+id:''),{method:edit?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});return rows?.length?reply({ok:true}):reply({error:'Registro não encontrado'},404)}catch(e){return reply({error:e instanceof Error&&e.message.endsWith('409')?'Já existe um lead com esse telefone e empreendimento.':'Não foi possível salvar.'},e instanceof Error&&e.message.endsWith('409')?409:503)}
}
export async function POST(req:Request){return save(req,false)}
export async function PATCH(req:Request){return save(req,true)}
