import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Executada apenas no servidor. Nunca inserir esta chave no Vite.
const origin = Deno.env.get('APP_URL')!;
const cors = {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(req.method!=='POST')return reply({error:'Método não permitido'},405);
 if(!origin)return reply({error:'APP_URL não configurada'},503);
 const authorization=req.headers.get('Authorization');if(!authorization)return reply({error:'Autenticação obrigatória'},401);
 const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}}});
 const {data:{user},error}=await client.auth.getUser();if(error||!user)return reply({error:'Sessão inválida'},401);
 const {data:profile}=await client.from('profiles').select('role,active').eq('id',user.id).single();if(!profile?.active||profile.role!=='admin')return reply({error:'Administrador obrigatório'},403);
 try{
 const body=await req.json();
 if(body.action!=='invite'||!['admin','commercial','prospector'].includes(body.role)||!body.name?.trim()||!/^\S+@\S+\.\S+$/.test(body.email||''))return reply({error:'Dados de convite inválidos'},400);
 const server=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await server.auth.admin.inviteUserByEmail(body.email,{redirectTo:origin});if(error)return reply({error:error.message},400);
 const {error:insertError}=await client.from('profiles').insert({id:data.user.id,name:body.name.trim(),role:body.role});
 if(insertError){await server.auth.admin.deleteUser(data.user.id);return reply({error:'Perfil não criado. Convite invalidado; tente novamente.'},500)}
 return reply({ok:true});
 }catch{return reply({error:'Não foi possível processar o convite'},400)}
});

