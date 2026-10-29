import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const appUrl=Deno.env.get('APP_URL')!;
const primary=appUrl?new URL(appUrl).origin:'';
const allowed=new Set([primary,...(Deno.env.get('ALLOWED_ORIGINS')||'').split(',').filter(Boolean).map(v=>new URL(v.trim()).origin)]);
Deno.serve(async req=>{
 const origin=req.headers.get('Origin')||'';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':allowed.has(origin)?origin:primary,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
 const reply=(body:unknown,status:number)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return reply({error:'Método não permitido'},405);
 if(origin&&!allowed.has(origin))return reply({error:'Origem não autorizada'},403);
 if(!appUrl)return reply({error:'Configuração pendente'},503);
 const url=Deno.env.get('SUPABASE_URL')!;
 const server=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const claim=crypto.randomUUID();let activationId:string|undefined;
 try{
  const {token}=await req.json();
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))return reply({error:'Link inválido'},400);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(v=>v.toString(16).padStart(2,'0')).join('');
  const claimed=await server.rpc('claim_access_activation',{p_hash:hash,p_claim:claim});
  if(claimed.error)throw new Error('claim_failed');
  const activation=claimed.data?.[0];if(!activation)return reply({error:'Link utilizado, revogado ou indisponível'},410);
  activationId=activation.id;
  const profile=await server.from('profiles').select('role,active').eq('id',activation.user_id).single();
  if(profile.error||!profile.data.active||profile.data.role!=='praxis_viewer')return reply({error:'Acesso indisponível'},403);
  const account=await server.auth.admin.getUserById(activation.user_id);
  if(account.error||!account.data.user.email)throw new Error('account_failed');
  // Emite e verifica um OTP fresco somente após o clique explícito. Não envia e-mail.
  const link=await server.auth.admin.generateLink({type:'recovery',email:account.data.user.email,options:{redirectTo:appUrl}});
  if(link.error||link.data.user.id!==activation.user_id)throw new Error('link_failed');
  const verifier=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const verified=await verifier.auth.verifyOtp({token_hash:link.data.properties.hashed_token,type:'recovery'});
  if(verified.error||!verified.data.session||verified.data.user?.id!==activation.user_id)throw new Error('verification_failed');
  const done=await server.rpc('finish_access_activation',{p_id:activation.id,p_claim:claim});
  if(done.error||done.data!==true)throw new Error('finish_failed');
  return reply({session:{access_token:verified.data.session.access_token,refresh_token:verified.data.session.refresh_token}},200);
 }catch{return reply({error:'Não foi possível ativar o acesso'},503)}
 finally{if(activationId)await server.rpc('release_access_activation',{p_id:activationId,p_claim:claim});}
});
