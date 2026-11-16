// Regras puras da sincronização com o Google Agenda (sem dependências; testadas com Vitest).
export const TIME_ZONE = 'America/Sao_Paulo';
export const CRM_TAG = 'crmMeetingId';

export type FeedMeeting = {id:string;starts_at:string;duration_minutes:number;format:string;url:string|null;status:string;company:string;contact:string|null};
export type GoogleEvent = {id:string;status?:string;summary?:string;location?:string;htmlLink?:string;
 start?:{dateTime?:string;date?:string};end?:{dateTime?:string;date?:string};
 extendedProperties?:{private?:Record<string,string>}};

// Status do CRM que não devem ocupar a agenda do Google.
export const removedFromGoogle = (status:string) => status==='Cancelada';

// Evento enviado ao Google. Só dados de agenda: resultado e próxima ação ficam no CRM.
export function meetingToEvent(m:FeedMeeting, appUrl:string){
 const start=new Date(m.starts_at), end=new Date(start.getTime()+m.duration_minutes*60000);
 const lines=[m.contact?`Decisor: ${m.contact}`:'',`Formato: ${m.format}`,m.url?`Link: ${m.url}`:'',`Status no CRM: ${m.status}`].filter(Boolean);
 return {
  summary:`Reunião · ${m.company}`,
  description:`${lines.join('\n')}\n\nCriado pelo CRM OperumData: ${appUrl}`,
  location:m.format==='Vídeo'&&m.url?m.url:undefined,
  start:{dateTime:start.toISOString(),timeZone:TIME_ZONE},
  end:{dateTime:end.toISOString(),timeZone:TIME_ZONE},
  extendedProperties:{private:{[CRM_TAG]:m.id}},
  reminders:{useDefault:true},
 };
}

// Impressão digital do que foi enviado; muda só quando algo relevante muda.
export async function eventHash(value:unknown){
 const bytes=new TextEncoder().encode(JSON.stringify(value));
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

// Dia inteiro: o Google informa só a data; vale o fuso de Brasília (sem horário de verão desde 2019).
const dayStart=(d:string)=>new Date(`${d}T00:00:00-03:00`).toISOString();

export type PersonalEvent = {google_event_id:string;title:string|null;location:string|null;starts_at:string;ends_at:string;all_day:boolean;html_link:string|null};
export function googleToPersonal(e:GoogleEvent):PersonalEvent|undefined{
 const s=e.start?.dateTime?new Date(e.start.dateTime).toISOString():e.start?.date?dayStart(e.start.date):undefined;
 const en=e.end?.dateTime?new Date(e.end.dateTime).toISOString():e.end?.date?dayStart(e.end.date):undefined;
 if(!s||!en)return undefined;
 return {google_event_id:e.id,title:e.summary?.slice(0,500)||null,location:e.location?.slice(0,500)||null,starts_at:s,ends_at:en<s?s:en,all_day:!e.start?.dateTime,
  html_link:e.htmlLink?.startsWith('https://')?e.htmlLink:null};
}

// Alteração feita no Google numa reunião criada pelo CRM: novo início e duração em minutos.
export function meetingChange(e:GoogleEvent){
 const cancelled=e.status==='cancelled';
 const start=e.start?.dateTime, end=e.end?.dateTime;
 if(cancelled||!start||!end)return {cancelled,starts_at:start?new Date(start).toISOString():null,minutes:0};
 const minutes=Math.round((new Date(end).getTime()-new Date(start).getTime())/60000);
 return {cancelled,starts_at:new Date(start).toISOString(),minutes};
}

// Janela guardada no CRM: 30 dias para trás e 400 dias para frente.
export function inWindow(p:PersonalEvent,now=Date.now()){
 return new Date(p.ends_at).getTime()>=now-30*86400000 && new Date(p.starts_at).getTime()<=now+400*86400000;
}

// Estado assinado do OAuth: identifica o usuário e expira em 10 minutos.
const b64=(b:ArrayBuffer|Uint8Array)=>btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array?b:new Uint8Array(b)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function hmac(secret:string,data:string){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return b64(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(data)));
}
export async function signState(secret:string,user:string,now=Date.now()){
 const body=b64(new TextEncoder().encode(JSON.stringify({u:user,e:now+600000,n:crypto.randomUUID()})));
 return `${body}.${await hmac(secret,body)}`;
}
export async function readState(secret:string,state:string,now=Date.now()):Promise<string|undefined>{
 const [body,sig]=state.split('.');
 if(!body||!sig||sig!==await hmac(secret,body))return undefined;
 try{const v=JSON.parse(atob(body.replace(/-/g,'+').replace(/_/g,'/')));return typeof v.u==='string'&&v.e>now?v.u:undefined}catch{return undefined}
}
