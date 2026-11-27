"use client";
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {useEffect} from 'react';
export function Navigation(){const path=usePathname(),router=useRouter();useEffect(()=>{if(path!='/instagram')return;const t=setInterval(()=>{if(document.visibilityState==='visible')router.refresh()},900000);return()=>clearInterval(t)},[path,router]);return <aside className="hub-nav"><strong>vitta.</strong><small>MARKETING HUB 2.5.4</small>{[['/','Visão geral'],['/instagram','Instagram'],['/publicacoes','Publicações'],['/leads','Leads orgânicos'],['/atendimento','Pós-atendimento'],['/campanhas','Campanhas'],['/acoes','Ações realizadas']].map(([href,label])=><Link key={href} href={href} className={path===href?'active':''}>{label}</Link>)}</aside>}
