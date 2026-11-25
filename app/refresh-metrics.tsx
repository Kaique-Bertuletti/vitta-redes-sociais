'use client';
import {useTransition} from 'react';
import {useRouter} from 'next/navigation';
export function RefreshMetrics(){const router=useRouter();const [pending,startTransition]=useTransition();return <button className="metric-refresh" type="button" disabled={pending} onClick={()=>startTransition(()=>router.refresh())}>{pending?'Atualizando…':'↻ Atualizar agora'}</button>}
