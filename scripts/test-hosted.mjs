import {createClient} from '@supabase/supabase-js';
import {readFile,unlink,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {randomBytes,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const runtime=join(homedir(),'.codex','tmp','operumdata-crm-runtime');
const appUrl=process.env.CRM_PUBLIC_URL||'http://127.0.0.1:5173/operumdata-crm/';
const appOrigin=new URL(appUrl).origin;
await mkdir('artifacts/homologacao',{recursive:true});
let siteRuntime={};
if(process.env.CRM_SITES_TEST==='1'){
 console.log('Ready for private Site test JSON on stdin (input hidden).');
 if(process.stdin.isTTY)process.stdin.setRawMode(true);
 const input=await new Promise(resolve=>{let value='';const onData=chunk=>{value+=chunk.toString();if(/[\r\n]/.test(value)){process.stdin.off('data',onData);process.stdin.pause();resolve(value.trim())}};process.stdin.on('data',onData);process.stdin.resume()});
 if(process.stdin.isTTY)process.stdin.setRawMode(false);
 siteRuntime=JSON.parse(input);
}
const serverKey=await readFile(join(runtime,'server-key.once'),'utf8');await unlink(join(runtime,'server-key.once'));
const values=Object.fromEntries((await readFile('.env.local','utf8')).split(/\r?\n/).filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)]}));
const url=values.VITE_SUPABASE_URL,key=values.VITE_SUPABASE_ANON_KEY;
const opts={auth:{persistSession:false,autoRefreshToken:false}};
const server=createClient(url,serverKey,opts), anon=createClient(url,key,opts);
const runId=randomUUID();const users=[];const created={companies:[],opportunities:[],contacts:[],activities:[],tasks:[],meetings:[]};let passed=0;
const log={project:'lpmzgbsvswnlxomaoyzj',started_at:new Date().toISOString(),checks:[],cleanup:false};
async function check(title,fn){await fn();passed++;log.checks.push({title,passed:true});console.log('OK '+title)}
function unwrap(r){if(r.error)throw new Error('Supabase: '+r.error.code+' '+r.error.message);return r.data}
async function insert(client,table,row){const data=unwrap(await client.from(table).insert(row).select().single());created[table]?.push(data.id);return data}
try{
 // Bootstrap opcional: somente e-mail fornecido no runtime, nunca no código.
 const ownerEmail=process.env.CRM_OWNER_EMAIL;
 if(ownerEmail){
 const listed=unwrap(await server.auth.admin.listUsers({page:1,perPage:1000}));let owner=listed.users.find(u=>u.email===ownerEmail);
 if(!owner){const invite=unwrap(await server.auth.admin.inviteUserByEmail(ownerEmail,{redirectTo:'http://127.0.0.1:5173/operumdata-crm/'}));owner=invite.user;console.log('Convite de administrador enviado ao proprietário indicado.');}
 unwrap(await server.from('profiles').upsert({id:owner.id,name:process.env.CRM_OWNER_NAME||'Administrador OperumData',role:'admin',active:true}));
 log.owner_admin_ready=true;
 }
 const previous=unwrap(await server.auth.admin.listUsers({page:1,perPage:1000}));
 for(const old of previous.users.filter(u=>u.user_metadata?.purpose==='crm-homologacao-descartavel'&&u.email?.startsWith('homologacao-')&&u.email.endsWith('@example.com'))){unwrap(await server.from('profiles').delete().eq('id',old.id));unwrap(await server.auth.admin.deleteUser(old.id));}
 await check('API pública não lê leads anonimamente',async()=>{const r=await anon.from('opportunities').select('id');assert.ok(r.error||r.data.length===0)});
 await check('cadastro público desabilitado no Auth',async()=>{const settings=await (await fetch(url+'/auth/v1/settings',{headers:{apikey:key}})).json();assert.equal(settings.disable_signup,true);const r=await anon.auth.signUp({email:`bloqueado-${runId}@example.com`,password:randomBytes(24).toString('base64url')});assert.ok(r.error);assert.ok(/disabled|not allowed|signup/i.test(r.error.message))});
 for(const role of ['admin','prospector','prospector']){
 const password=randomBytes(32).toString('base64url');const email=`homologacao-${role}-${users.length}-${runId}@example.com`;
 const {user}=unwrap(await server.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{purpose:'crm-homologacao-descartavel',run_id:runId}}));
 users.push({id:user.id,email,password});unwrap(await server.from('profiles').insert({id:user.id,name:'Homologação sintética '+role,role}));
 }
 const clients=users.map(()=>createClient(url,key,opts));for(let i=0;i<users.length;i++)unwrap(await clients[i].auth.signInWithPassword({email:users[i].email,password:users[i].password}));
 const [admin,a,b]=clients;const campaign=unwrap(await admin.from('campaigns').select('id').limit(1).single());
 await check('login real Supabase Auth de administrador e dois prospectores',async()=>{for(const c of clients)assert.ok(unwrap(await c.auth.getUser()).user.id)});
 await check('função de convites rejeita acesso anônimo e de prospectores',async()=>{
 const endpoint=url+'/functions/v1/manage-users';
 const unauth=await fetch(endpoint,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:'{}'});assert.equal(unauth.status,401);
 const token=(await a.auth.getSession()).data.session.access_token;const prospect=await fetch(endpoint,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});assert.equal(prospect.status,403);
 });
 await check('função valida JWT do administrador e CORS sem enviar convite de teste',async()=>{
 const endpoint=url+'/functions/v1/manage-users',token=(await admin.auth.getSession()).data.session.access_token;
 const response=await fetch(endpoint,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json',Origin:appOrigin},body:'{}'});assert.equal(response.status,400);assert.equal(response.headers.get('Access-Control-Allow-Origin'),appOrigin);
 });
 const company=await insert(a,'companies',{legal_name:'HOMOLOGAÇÃO SINTÉTICA — remover após teste '+runId,city:'Cidade de homologação',participants:5});
 const lead=await insert(a,'opportunities',{company_id:company.id,campaign_id:campaign.id,priority:4});
 const contact=await insert(a,'contacts',{company_id:company.id,name:'Decisor sintético de homologação'});
 await check('CRUD real: empresa, oportunidade e decisor persistidos',async()=>{assert.equal(unwrap(await a.from('contacts').select('id').eq('id',contact.id)).length,1)});
 await insert(a,'activities',{opportunity_id:lead.id,result:'Interessado',reached_decision_maker:true,notes:'Registro sintético de teste'});
 await insert(a,'tasks',{opportunity_id:lead.id,title:'Retorno sintético',due_at:new Date(Date.now()+86400000).toISOString()});
 await insert(a,'meetings',{opportunity_id:lead.id,contact_id:contact.id,starts_at:new Date(Date.now()+2*86400000).toISOString(),format:'Vídeo'});
 await check('API grava ligação, retorno e reunião',async()=>{for(const t of ['activities','tasks','meetings'])assert.equal(unwrap(await a.from(t).select('id').eq('opportunity_id',lead.id)).length,1)});
 await check('atualização comercial preserva histórico',async()=>{unwrap(await a.from('opportunities').update({stage:'Pré-qualificação',qualification:'Pronto para reunião'}).eq('id',lead.id));assert.ok(unwrap(await a.from('audit_log').select('id').eq('opportunity_id',lead.id)).length>=4)});
 await check('segundo agente não lê nem altera lead alheio',async()=>{for(const [t,col,id] of [['opportunities','id',lead.id],['companies','id',company.id],['contacts','id',contact.id],['activities','opportunity_id',lead.id],['tasks','opportunity_id',lead.id],['meetings','opportunity_id',lead.id]])assert.equal(unwrap(await b.from(t).select('id').eq(col,id)).length,0);const r=await b.from('opportunities').update({stage:'Negociação'}).eq('id',lead.id).select();assert.ok(r.error||r.data.length===0);const x=await b.from('activities').insert({opportunity_id:lead.id,result:'Interessado'});assert.ok(x.error)});
 await check('prospector não acessa contratos nem avaliações',async()=>{for(const t of ['contracts','evaluations','operations'])assert.equal(unwrap(await a.from(t).select('id')).length,0);const r=await a.from('contracts').insert({opportunity_id:lead.id,origin:'Teste',acquisition_owner:users[1].id});assert.ok(r.error)});
 await check('prospector não pode promover o próprio perfil',async()=>{await a.from('profiles').update({role:'admin'}).eq('id',users[1].id);assert.equal(unwrap(await server.from('profiles').select('role').eq('id',users[1].id).single()).role,'prospector')});
 await check('interface autentica e consulta dados reais sem API simulada',async()=>{
 const browser=await chromium.launch();try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 // Acesso técnico da hospedagem restrito a esta origem. Nunca enviar a chave
 // de Sites ao Supabase ou incluí-la no JavaScript da aplicação.
 if(siteRuntime.token)await page.route(appOrigin+'/**',route=>route.continue({headers:{...route.request().headers(),'OAI-Sites-Authorization':'Bearer '+siteRuntime.token}}));
 await page.goto(appUrl);await page.getByLabel('E-mail corporativo').fill(users[0].email);await page.getByLabel('Senha',{exact:true}).fill(users[0].password);await page.getByRole('button',{name:'Entrar no CRM'}).click();await page.getByRole('heading',{name:'Visão da operação'}).waitFor();await page.screenshot({path:'artifacts/homologacao/supabase-real-dashboard.png',fullPage:true});
 await page.getByRole('button',{name:'Leads',exact:true}).click();await page.getByRole('button',{name:company.legal_name,exact:true}).click();await page.getByRole('heading',{name:company.legal_name,exact:true}).waitFor();await page.reload();await page.getByRole('heading',{name:'Visão da operação'}).waitFor();
 }finally{await browser.close()}
 });
 await check('sair e entrar de novo mantém os leads no PostgreSQL',async()=>{unwrap(await a.auth.signOut());const reopened=createClient(url,key,opts);unwrap(await reopened.auth.signInWithPassword({email:users[1].email,password:users[1].password}));assert.equal(unwrap(await reopened.from('opportunities').select('id').eq('id',lead.id)).length,1);unwrap(await reopened.auth.signOut())});

}catch(e){console.error('FALHA: '+e.message);log.failure=e.message;process.exitCode=1}
finally{
 try{
 for(const table of ['meetings','tasks','activities','contacts','opportunities','companies'])if(created[table].length)unwrap(await server.from(table).delete().in('id',created[table]));
 // Manter o administrador proprietário garante a regra de último administrador.
 for(const u of users){unwrap(await server.from('profiles').delete().eq('id',u.id));unwrap(await server.auth.admin.deleteUser(u.id));}
 log.cleanup=true;console.log('Contas e registros sintéticos de homologação removidos.');
 }catch(e){log.cleanup_error=e.message;console.error('Limpeza de homologação pendente: '+e.message);process.exitCode=1}
 log.finished_at=new Date().toISOString();log.passed=passed;log.app_url=appUrl;await writeFile('artifacts/homologacao/supabase-hosted-verification.json',JSON.stringify(log,null,2));
 // Chave administrativa não é gravada novamente; variáveis públicas são as únicas do checkout.
 console.log(passed+' testes no Supabase hospedado passaram.');
}
