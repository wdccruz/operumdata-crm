import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CRM_TAG, eventHash, googleToPersonal, inWindow, meetingChange, meetingToEvent, readState, removedFromGoogle, signState, type FeedMeeting, type GoogleEvent } from './calendar.ts';
// Sincronização da agenda do CRM com o Google Agenda nos dois sentidos.
// Executada apenas no servidor. Segredos (configurar no Supabase, nunca no Vite nem no repositório):
// GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_STATE_SECRET, GOOGLE_SYNC_KEY, APP_URL.
const env=(k:string)=>Deno.env.get(k)||'';
const appUrl=env('APP_URL'), origin=appUrl?new URL(appUrl).origin:'';
const allowed=new Set([origin,...env('ALLOWED_ORIGINS').split(',').map(v=>v.trim()).filter(Boolean).map(v=>new URL(v).origin)].filter(Boolean));
const supabaseUrl=env('SUPABASE_URL'), redirectUri=`${supabaseUrl}/functions/v1/google-calendar`;
const API='https://www.googleapis.com/calendar/v3';
const SCOPES='openid email https://www.googleapis.com/auth/calendar.events';
const teamRoles=['admin','prospector','commercial'];
const server=()=>createClient(supabaseUrl,env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});

class GoogleError extends Error{constructor(public status:number,message:string){super(message)}}
async function google(token:string,path:string,init:RequestInit={}){
 const r=await fetch(path.startsWith('http')?path:API+path,{...init,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(init.headers||{})}});
 if(r.status===204)return {};
 const body=await r.json().catch(()=>({}));
 if(!r.ok)throw new GoogleError(r.status,body?.error?.message||body?.error_description||body?.error||`Google ${r.status}`);
 return body;
}
async function tokenRequest(params:Record<string,string>){
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env('GOOGLE_CLIENT_ID'),client_secret:env('GOOGLE_CLIENT_SECRET'),...params})});
 const body=await r.json().catch(()=>({}));
 if(!r.ok)throw new GoogleError(r.status,body.error_description||body.error||'Falha na autorização do Google');
 return body as {access_token:string;refresh_token?:string;id_token?:string};
}
const emailFromIdToken=(t?:string)=>{try{return t?JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).email as string:null}catch{return null}};

type Connection={user_id:string;refresh_token:string;calendar_id:string;sync_token:string|null};
type Summary={sent:number;updated:number;removed:number;fromGoogle:number;meetingsChanged:number};

// Google → CRM: alterações incrementais desde a última sincronização (syncToken).
async function pull(db:SupabaseClient,c:Connection,token:string,s:Summary){
 const cal=encodeURIComponent(c.calendar_id);
 let syncToken=c.sync_token, pageToken:string|undefined, next:string|undefined, pages=0;
 const base=()=>{const q=new URLSearchParams({singleEvents:'true',showDeleted:'true',maxResults:'2500'});if(syncToken)q.set('syncToken',syncToken);else q.set('timeMin',new Date(Date.now()-30*86400000).toISOString());return q};
 while(true){
  const q=base();if(pageToken)q.set('pageToken',pageToken);
  let page:{items?:GoogleEvent[];nextPageToken?:string;nextSyncToken?:string};
  try{page=await google(token,`/calendars/${cal}/events?${q}`)}catch(e){
   // Token de sincronização expirado: recomeça do zero e reconstrói os compromissos guardados.
   if(e instanceof GoogleError&&e.status===410&&syncToken){syncToken=null;pageToken=undefined;await db.from('calendar_events').delete().eq('user_id',c.user_id);continue}
   throw e;
  }
  const upserts=[], deletions:string[]=[];
  for(const e of page.items||[]){
   const crmId=e.extendedProperties?.private?.[CRM_TAG];
   if(crmId){
    const ch=meetingChange(e);
    const {data,error}=await db.rpc('google_apply_meeting_change',{p_user:c.user_id,p_meeting:crmId,p_starts_at:ch.starts_at||new Date().toISOString(),p_minutes:ch.minutes,p_cancelled:ch.cancelled});
    if(error)throw error; if(data)s.meetingsChanged++;
    continue;
   }
   const p=e.status==='cancelled'?undefined:googleToPersonal(e);
   if(!p||!inWindow(p))deletions.push(e.id);else upserts.push({...p,user_id:c.user_id,updated_at:new Date().toISOString()});
  }
  if(upserts.length){const{error}=await db.from('calendar_events').upsert(upserts,{onConflict:'user_id,google_event_id'});if(error)throw error;s.fromGoogle+=upserts.length}
  if(deletions.length){const{error}=await db.from('calendar_events').delete().eq('user_id',c.user_id).in('google_event_id',deletions);if(error)throw error}
  pageToken=page.nextPageToken; if(page.nextSyncToken)next=page.nextSyncToken;
  if(!pageToken||++pages>=40)break;
 }
 return next||syncToken;
}

// CRM → Google: cria, atualiza ou remove os eventos das reuniões que o usuário pode ver no CRM.
async function push(db:SupabaseClient,c:Connection,token:string,s:Summary){
 const cal=encodeURIComponent(c.calendar_id);
 const [{data:feed,error:fe},{data:links,error:le}]=await Promise.all([db.rpc('google_meeting_feed',{p_user:c.user_id}),db.from('meeting_google_events').select('*').eq('user_id',c.user_id)]);
 if(fe)throw fe; if(le)throw le;
 const byMeeting=new Map((links||[]).map(l=>[l.meeting_id,l]));
 for(const m of (feed||[]) as FeedMeeting[]){
  const link=byMeeting.get(m.id), gone=removedFromGoogle(m.status);
  const body=meetingToEvent(m,appUrl), hash=gone?'removed':await eventHash(body);
  if(link?.synced_hash===hash)continue;
  if(gone){
   if(link){try{await google(token,`/calendars/${cal}/events/${encodeURIComponent(link.google_event_id)}?sendUpdates=none`,{method:'DELETE'})}catch(e){if(!(e instanceof GoogleError&&[404,410].includes(e.status)))throw e}
    await db.from('meeting_google_events').update({synced_hash:hash,synced_at:new Date().toISOString()}).eq('meeting_id',m.id).eq('user_id',c.user_id);s.removed++}
   continue;
  }
  let id=link?.google_event_id;
  if(id&&link?.synced_hash!=='removed'){
   try{await google(token,`/calendars/${cal}/events/${encodeURIComponent(id)}?sendUpdates=none`,{method:'PATCH',body:JSON.stringify({...body,status:'confirmed'})});s.updated++}
   catch(e){if(e instanceof GoogleError&&[404,410].includes(e.status))id=undefined;else throw e}
  }else id=undefined;
  if(!id){const ev=await google(token,`/calendars/${cal}/events?sendUpdates=none`,{method:'POST',body:JSON.stringify(body)});id=ev.id;s.sent++}
  const {error}=await db.from('meeting_google_events').upsert({meeting_id:m.id,user_id:c.user_id,google_event_id:id,synced_hash:hash,synced_at:new Date().toISOString()},{onConflict:'meeting_id,user_id'});
  if(error)throw error;
 }
}

async function syncUser(db:SupabaseClient,userId:string):Promise<Summary|{busy:true}|{error:string}>{
 // Trava por usuário: evita que o agendamento e o botão "Sincronizar agora" rodem juntos.
 const now=new Date();
 const {data:claimed}=await db.from('google_connections').update({sync_lock_until:new Date(now.getTime()+120000).toISOString()})
  .eq('user_id',userId).or(`sync_lock_until.is.null,sync_lock_until.lt.${now.toISOString()}`).select('user_id,refresh_token,calendar_id,sync_token');
 const c=claimed?.[0] as Connection|undefined; if(!c)return {busy:true};
 const s:Summary={sent:0,updated:0,removed:0,fromGoogle:0,meetingsChanged:0};
 try{
  const {access_token}=await tokenRequest({grant_type:'refresh_token',refresh_token:c.refresh_token});
  const syncToken=await pull(db,c,access_token,s);
  await push(db,c,access_token,s);
  await db.from('google_connections').update({sync_token:syncToken,status:'active',last_error:null,last_synced_at:new Date().toISOString(),sync_lock_until:null}).eq('user_id',userId);
  return s;
 }catch(e){
  const msg=e instanceof GoogleError&&(e.status===400||e.status===401)&&/invalid_grant|revoked|expired/i.test(e.message)?'Autorização do Google expirada ou revogada. Conecte novamente.':String((e as Error).message||e).slice(0,300);
  await db.from('google_connections').update({status:'error',last_error:msg,sync_lock_until:null}).eq('user_id',userId);
  return {error:msg};
 }
}

async function callback(url:URL){
 const back=(result:string)=>Response.redirect(`${appUrl}${appUrl.includes('?')?'&':'?'}google=${result}`,302);
 if(!appUrl)return new Response('APP_URL não configurada',{status:503});
 const user=await readState(env('GOOGLE_STATE_SECRET'),url.searchParams.get('state')||'');
 const code=url.searchParams.get('code');
 if(!user||!code)return back('erro');
 try{
  const t=await tokenRequest({grant_type:'authorization_code',code,redirect_uri:redirectUri});
  if(!t.refresh_token)return back('erro');
  const db=server();
  const {data:p}=await db.from('profiles').select('role,active').eq('id',user).single();
  if(!p?.active||!teamRoles.includes(p.role))return back('erro');
  const {error}=await db.from('google_connections').upsert({user_id:user,google_email:emailFromIdToken(t.id_token),refresh_token:t.refresh_token,calendar_id:'primary',sync_token:null,status:'active',last_error:null,sync_lock_until:null,connected_at:new Date().toISOString()},{onConflict:'user_id'});
  if(error)return back('erro');
  await db.from('calendar_events').delete().eq('user_id',user);
  await syncUser(db,user);
  return back('conectado');
 }catch{return back('erro')}
}

Deno.serve(async req=>{
 const url=new URL(req.url);
 if(req.method==='GET')return callback(url);
 const requested=req.headers.get('Origin')||'';
 const cors={'Access-Control-Allow-Origin':allowed.has(requested)?requested:origin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(req.method!=='POST')return reply({error:'Método não permitido'},405);
 if(!appUrl||!env('GOOGLE_CLIENT_ID')||!env('GOOGLE_CLIENT_SECRET')||!env('GOOGLE_STATE_SECRET'))return reply({error:'Integração com o Google ainda não configurada'},503);
 let body:{action?:string}={};try{body=await req.json()}catch{return reply({error:'Requisição inválida'},400)}
 const db=server();

 // Agendamento (pg_cron): chave própria, comparada no servidor.
 if(body.action==='cron'){
  const key=env('GOOGLE_SYNC_KEY');
  if(!key||req.headers.get('x-sync-key')!==key)return reply({error:'Não autorizado'},401);
  const {data}=await db.from('google_connections').select('user_id').eq('status','active');
  const results=[];for(const c of data||[])results.push(await syncUser(db,c.user_id));
  return reply({ok:true,users:results.length});
 }

 if(requested&&!allowed.has(requested))return reply({error:'Origem não autorizada'},403);
 const authorization=req.headers.get('Authorization');if(!authorization)return reply({error:'Autenticação obrigatória'},401);
 const client=createClient(supabaseUrl,env('SUPABASE_ANON_KEY'),{global:{headers:{Authorization:authorization}}});
 const {data:{user},error}=await client.auth.getUser();if(error||!user)return reply({error:'Sessão inválida'},401);
 const {data:profile}=await client.from('profiles').select('role,active').eq('id',user.id).single();
 if(!profile?.active||!teamRoles.includes(profile.role))return reply({error:'Disponível somente para a equipe OperumData'},403);

 if(body.action==='connect'){
  const q=new URLSearchParams({client_id:env('GOOGLE_CLIENT_ID'),redirect_uri:redirectUri,response_type:'code',scope:SCOPES,access_type:'offline',prompt:'consent',include_granted_scopes:'true',state:await signState(env('GOOGLE_STATE_SECRET'),user.id)});
  return reply({url:`https://accounts.google.com/o/oauth2/v2/auth?${q}`});
 }
 if(body.action==='sync'){
  const r=await syncUser(db,user.id);
  return 'error' in r?reply(r,502):reply({ok:true,...r});
 }
 if(body.action==='disconnect'){
  const {data:c}=await db.from('google_connections').select('refresh_token,calendar_id').eq('user_id',user.id).maybeSingle();
  if(c){
   // Remove do Google os eventos criados pelo CRM e revoga o acesso. Compromissos do Google ficam intactos.
   try{
    const {access_token}=await tokenRequest({grant_type:'refresh_token',refresh_token:c.refresh_token});
    const {data:links}=await db.from('meeting_google_events').select('google_event_id,synced_hash').eq('user_id',user.id);
    for(const l of links||[])if(l.synced_hash!=='removed')await google(access_token,`/calendars/${encodeURIComponent(c.calendar_id)}/events/${encodeURIComponent(l.google_event_id)}?sendUpdates=none`,{method:'DELETE'}).catch(()=>{});
    await fetch('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:c.refresh_token})});
   }catch{/* autorização já revogada no Google: segue removendo os dados locais */}
  }
  await db.from('meeting_google_events').delete().eq('user_id',user.id);
  await db.from('calendar_events').delete().eq('user_id',user.id);
  await db.from('google_connections').delete().eq('user_id',user.id);
  return reply({ok:true});
 }
 return reply({error:'Ação inválida'},400);
});
