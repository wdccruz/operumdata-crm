import {useEffect,useRef,useState,type ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import type {Row} from './db';
// Calendário da Agenda: visões Mês, Semana e Lista. Reuniões do CRM e compromissos do Google
// (estes só do próprio usuário, garantido pelo banco) aparecem juntos, com cores diferentes.
export type CalItem={id:string;kind:'meeting'|'google';start:Date;end:Date;allDay:boolean;title:string;sub?:string;row:Row;cancelled?:boolean};
export type CalView='month'|'week'|'list';
const DAY=86400000;
export const dayStart=(d:Date)=>{const x=new Date(d);x.setHours(0,0,0,0);return x};
export const addDays=(d:Date,n:number)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
export const weekStart=(d:Date)=>addDays(dayStart(d),-dayStart(d).getDay()); // semana começa no domingo, como no Google Agenda
export const sameDay=(a:Date,b:Date)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
// 6 semanas fixas, para a grade do mês não mudar de altura.
export function monthDays(ref:Date){const first=new Date(ref.getFullYear(),ref.getMonth(),1);const start=weekStart(first);return Array.from({length:42},(_,i)=>addDays(start,i))}
// Itens que tocam um dia (eventos de dia inteiro do Google terminam à meia-noite do dia seguinte).
export const onDay=(it:CalItem,d:Date)=>{const s=dayStart(d).getTime(),e=s+DAY;return it.start.getTime()<e&&(it.end.getTime()>s||(it.end.getTime()===it.start.getTime()&&it.start.getTime()>=s))};
// Colunas para eventos sobrepostos na visão Semana.
export function layoutDay(items:CalItem[]){
 const sorted=[...items].sort((a,b)=>a.start.getTime()-b.start.getTime()||b.end.getTime()-a.end.getTime());
 const out:{it:CalItem;col:number;cols:number}[]=[];let group:typeof out=[];let groupEnd=0;
 const close=()=>{const cols=Math.max(1,...group.map(g=>g.col+1));group.forEach(g=>g.cols=cols);out.push(...group);group=[]};
 for(const it of sorted){
  if(group.length&&it.start.getTime()>=groupEnd)close();
  const used=new Set(group.filter(g=>g.it.end.getTime()>it.start.getTime()).map(g=>g.col));let col=0;while(used.has(col))col++;
  group.push({it,col,cols:1});groupEnd=Math.max(groupEnd,it.end.getTime());
 }
 close();return out;
}
const cls=(...c:(string|false|undefined)[])=>c.filter(Boolean).join(' ');
const HOUR=48; // altura de uma hora na visão Semana (px)
const readView=(mobile:boolean):CalView=>{try{const v=localStorage.getItem('operum-agenda-view');if(v==='month'||v==='week'||v==='list')return v}catch{/* armazenamento indisponível */}return mobile?'week':'month'};

export function Calendar({items,canWrite,onOpen,onNew,renderList}:{items:CalItem[];canWrite:boolean;onOpen:(it:CalItem)=>void;onNew:(d:Date)=>void;renderList:()=>ReactNode}){
 const {t,i18n}=useTranslation();const lang=i18n.language;
 const mobile=typeof matchMedia==='function'&&matchMedia('(max-width:760px)').matches;
 const [view,setView]=useState<CalView>(()=>readView(mobile)),[ref,setRef]=useState(()=>dayStart(new Date()));
 useEffect(()=>{try{localStorage.setItem('operum-agenda-view',view)}catch{/* armazenamento indisponível */}},[view]);
 const today=dayStart(new Date());
 const days=view==='month'?monthDays(ref):Array.from({length:7},(_,i)=>addDays(weekStart(ref),i));
 const move=(n:number)=>setRef(view==='month'?new Date(ref.getFullYear(),ref.getMonth()+n,1):addDays(ref,7*n));
 const cap=(s:string)=>s.charAt(0).toUpperCase()+s.slice(1);
 const title=view==='month'?cap(ref.toLocaleDateString(lang,{month:'long',year:'numeric'})):`${days[0].toLocaleDateString(lang,{day:'numeric',month:'short'})} – ${days[6].toLocaleDateString(lang,{day:'numeric',month:'short',year:'numeric'})}`;
 const time=(d:Date)=>d.toLocaleTimeString(lang,{hour:'2-digit',minute:'2-digit'});
 const weekdays=days.slice(0,7).map(d=>d.toLocaleDateString(lang,{weekday:'short'}).replace('.',''));
 const label=(it:CalItem)=>`${it.allDay?t('Dia inteiro'):time(it.start)} · ${it.title}${it.kind==='google'?' · '+t('Google Agenda · só você vê'):''}`;
 const chip=(it:CalItem,compact=false)=><button key={it.id} type="button" className={cls('cal-item',it.kind,it.cancelled&&'cancelled')} title={label(it)} aria-label={label(it)} onClick={e=>{e.stopPropagation();onOpen(it)}}>{!compact&&!it.allDay&&<span>{time(it.start)}</span>}<b>{it.title}</b></button>;
 const scroller=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(view==='week'&&scroller.current)scroller.current.scrollTop=7*HOUR},[view]);
 return <div className="calendar">
  <div className="cal-toolbar">
   <div className="cal-nav">{view!=='list'&&<><button type="button" aria-label={t('Anterior')} onClick={()=>move(-1)}>‹</button><button type="button" onClick={()=>setRef(today)}>{t('Hoje')}</button><button type="button" aria-label={t('Próximo')} onClick={()=>move(1)}>›</button><h3 className="cal-title">{title}</h3></>}</div>
   <div className="cal-views" role="group" aria-label={t('Visualização')}>{(['month','week','list'] as CalView[]).map(v=><button type="button" key={v} aria-pressed={view===v} className={view===v?'active':''} onClick={()=>setView(v)}>{t({month:'Mês',week:'Semana',list:'Lista'}[v])}</button>)}</div>
  </div>
  <div className="cal-legend"><span className="cal-dot meeting"/>{t('Reunião do CRM')}<span className="cal-dot google"/>{t('Seu Google Agenda (só você vê)')}</div>
  {view==='list'&&renderList()}
  {view==='month'&&<div className="cal-month" role="grid">
   {weekdays.map(w=><div key={w} className="cal-weekday" role="columnheader">{w}</div>)}
   {days.map(d=>{const list=items.filter(it=>onDay(it,d)).sort((a,b)=>Number(b.allDay)-Number(a.allDay)||a.start.getTime()-b.start.getTime());const max=mobile?0:3;
    return <div key={d.toISOString()} role="gridcell" className={cls('cal-day',d.getMonth()!==ref.getMonth()&&'other',sameDay(d,today)&&'today',canWrite&&'writable')} onClick={()=>canWrite&&onNew(d)}>
     <button type="button" className="cal-daynum" aria-label={d.toLocaleDateString(lang,{dateStyle:'full'})} onClick={e=>{e.stopPropagation();setRef(d);setView('week')}}>{d.getDate()}</button>
     {mobile?<div className="cal-dots">{list.slice(0,4).map(it=><span key={it.id} className={`cal-dot ${it.kind}`}/>)}</div>:<>{list.slice(0,max).map(it=>chip(it))}{list.length>max&&<button type="button" className="cal-more" onClick={e=>{e.stopPropagation();setRef(d);setView('week')}}>{t('+{{n}} mais',{n:list.length-max})}</button>}</>}
    </div>})}
  </div>}
  {view==='week'&&<div className="cal-week">
   <div className="cal-week-head"><div/>{days.map(d=><button type="button" key={d.toISOString()} className={sameDay(d,today)?'today':''} onClick={()=>canWrite&&onNew(d)} disabled={!canWrite}><small>{d.toLocaleDateString(lang,{weekday:'short'}).replace('.','')}</small><b>{d.getDate()}</b></button>)}</div>
   <div className="cal-allday"><div className="cal-gutter"><small>{t('Dia inteiro')}</small></div>{days.map(d=><div key={d.toISOString()}>{items.filter(it=>it.allDay&&onDay(it,d)).map(it=>chip(it,true))}</div>)}</div>
   <div className="cal-hours" ref={scroller}>
    <div className="cal-gutter">{Array.from({length:24},(_,h)=><small key={h} style={{height:HOUR}}>{String(h).padStart(2,'0')}:00</small>)}</div>
    {days.map(d=>{const s=d.getTime();const placed=layoutDay(items.filter(it=>!it.allDay&&onDay(it,d)));
     return <div key={d.toISOString()} className={cls('cal-col',sameDay(d,today)&&'today')} style={{height:24*HOUR}} onClick={e=>{if(!canWrite)return;const y=e.nativeEvent.offsetY;const at=new Date(s+Math.floor(y/(HOUR/2))*30*60000);onNew(at)}}>
      {sameDay(d,today)&&<span className="cal-now" style={{top:(Date.now()-s)/3600000*HOUR}}/>}
      {placed.map(({it,col,cols})=>{const top=Math.max(0,(it.start.getTime()-s)/3600000*HOUR),bottom=Math.min(24*HOUR,(it.end.getTime()-s)/3600000*HOUR);
       return <button type="button" key={it.id} className={cls('cal-event',it.kind,it.cancelled&&'cancelled')} title={label(it)} aria-label={label(it)} style={{top,height:Math.max(20,bottom-top-2),left:`calc(${col*100/cols}% + 2px)`,width:`calc(${100/cols}% - 4px)`}} onClick={e=>{e.stopPropagation();onOpen(it)}}><small>{time(it.start)}</small><b>{it.title}</b>{it.sub&&<small>{it.sub}</small>}</button>})}
     </div>})}
   </div>
  </div>}
 </div>;
}
// Reuniões do CRM e compromissos do Google do próprio usuário, no formato do calendário.
export function calendarItems(meetings:Row[],events:Row[],uid:string|undefined,name:(id:string)=>string,t:(k:string)=>string):CalItem[]{
 return [
  ...meetings.map(m=>({id:'m'+m.id,kind:'meeting' as const,start:new Date(m.starts_at),end:new Date(new Date(m.starts_at).getTime()+m.duration_minutes*60000),allDay:false,title:name(m.opportunity_id),sub:t(m.status),row:m,cancelled:m.status==='Cancelada'})),
  ...events.filter(e=>e.user_id===uid).map(e=>({id:'g'+e.id,kind:'google' as const,start:new Date(e.starts_at),end:new Date(e.ends_at),allDay:!!e.all_day,title:e.title||t('(sem título)'),sub:e.location||undefined,row:e})),
 ];
}
