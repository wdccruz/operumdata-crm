import {test,expect} from '@playwright/test';
const uid='00000000-0000-0000-0000-000000000001';
test('fluxo comercial na interface e leitura após recarregar (API simulada)',async({page},testInfo)=>{
 const user={id:uid,email:'admin@example.invalid',app_metadata:{provider:'email'},user_metadata:{},aud:'authenticated',created_at:new Date().toISOString()};
 const tables:Record<string,any[]>={profiles:[{id:uid,name:'Admin sintético',role:'admin',active:true}],companies:[],contacts:[],opportunities:[],activities:[],tasks:[],meetings:[],categories:[{id:'cat',name:'Setor sintético',priority:1}],buyers:[{id:'buyer',name:'Praxis Robotics'}],campaigns:[{id:'campaign',buyer_id:'buyer',name:'Campanha sintética',active:true,meeting_minutes:30,starts_on:'2026-10-29'}],protocols:[{id:'protocol',campaign_id:'campaign',version:1,min_participants:5,praxis_approval_required:true}],evaluations:[],contracts:[],operations:[],audit_log:[]};
 await page.route('https://crm-test.supabase.co/**',async route=>{
 const request=route.request(),url=new URL(request.url());let body:any=[];
 if(url.pathname.includes('/auth/v1/token'))body={access_token:'synthetic-access-token',refresh_token:'synthetic-refresh-token',token_type:'bearer',expires_in:3600,user};
 else if(url.pathname.includes('/auth/v1/user'))body=user;
 else if(url.pathname.includes('/rest/v1/')){
 const table=url.pathname.split('/').pop()!;const rows=tables[table]||[];
 if(url.pathname.includes('/rpc/set_my_locale')){tables.profiles[0].locale=request.postDataJSON().p_locale;body=tables.profiles[0].locale;}
 else if(request.method()==='POST'){body={id:crypto.randomUUID(),owner_id:uid,actor_id:uid,created_at:new Date().toISOString(),occurred_at:new Date().toISOString(),stage:'Novo',...(table==='companies'?{commercial_status:'registered',operational_status:'not_started',strategic_importance:'not_assessed',prospecting_owner:uid,updated_at:new Date().toISOString()}:{}),...request.postDataJSON()};rows.push(body);}
 else if(request.method()==='PATCH'){const id=url.searchParams.get('id')?.replace('eq.','');body=rows.find(r=>r.id===id);Object.assign(body,request.postDataJSON());}
 else body=rows;
 }
 await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(body)});
 });
 await page.goto('./');await expect(page.getByRole('heading',{name:'Bom trabalho começa aqui.'})).toBeVisible();await page.getByLabel('E-mail corporativo').fill('admin@example.invalid');await page.getByLabel('Senha',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Entrar no CRM'}).click();await expect(page.getByRole('heading',{name:'Visão da operação'})).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('dashboard.png'),fullPage:true});
 await page.getByRole('button',{name:'Empresa',exact:true}).click();await page.getByLabel('Razão social').fill('Empresa de teste sintética');await page.getByLabel('Cidade',{exact:true}).fill('Cidade de teste');await page.getByLabel('Participantes disponíveis').fill('5');await page.getByRole('button',{name:'Salvar registro'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 // Empresa recém-cadastrada abre sua ficha e já integra Estabelecimentos, sem oportunidade nem contrato.
 await expect(page.getByRole('heading',{name:'Empresa de teste sintética'})).toBeVisible();await expect(page.getByText('Empresa cadastrada. Ela já integra a base de Estabelecimentos com status Cadastrada.')).toBeVisible();
 await page.getByRole('button',{name:/Voltar para/}).click();
 if(testInfo.project.name==='mobile')await page.getByRole('button',{name:'Menu',exact:true}).click();await page.getByRole('button',{name:'Estabelecimentos',exact:true}).click();
 const row=page.getByRole('row').filter({hasText:'Empresa de teste sintética'});await expect(row).toBeVisible();await expect(row.getByText('Cadastrada',{exact:true})).toBeVisible();await expect(row.getByText('Não iniciada',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Em estoque',exact:false}).first().click();await expect(page.getByRole('row').filter({hasText:'Empresa de teste sintética'})).toHaveCount(0);await page.getByRole('button',{name:/^Todas/}).click();
 await page.getByLabel('Pesquisar estabelecimentos').fill('teste sint');await page.getByRole('button',{name:'Empresa de teste sintética',exact:true}).click();
 await page.getByRole('button',{name:'Alterar status / classificação'}).click();await page.getByLabel('Status comercial',{exact:true}).selectOption({label:'Em estoque'});await page.getByLabel('Motivo da alteração de status').fill('Reserva para campanha futura');await page.getByLabel('Importância estratégica',{exact:true}).selectOption({label:'Alta'});await page.getByLabel('Justificativa da importância').fill('15 participantes e atividades recorrentes');
 await page.getByLabel('Status operacional',{exact:true}).selectOption({label:'Gravando'});await page.getByRole('button',{name:'Salvar registro'}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('confirme o início efetivo');
 await page.getByLabel('Status operacional',{exact:true}).selectOption({label:'Não iniciada'});await page.getByRole('button',{name:'Salvar registro'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(tables.companies[0]).toMatchObject({commercial_status:'stock',strategic_importance:'high',operational_status:'not_started',status_reason:'Reserva para campanha futura',importance_justification:'15 participantes e atividades recorrentes'});expect(tables.opportunities).toHaveLength(0);expect(tables.contracts).toHaveLength(0);
 await expect(page.getByText('15 participantes e atividades recorrentes')).toBeVisible();
 await page.getByRole('button',{name:'Criar oportunidade +'}).first().click();await expect(page.getByLabel('Empresa',{exact:true})).toHaveValue(tables.companies[0].id);await page.getByRole('button',{name:'Salvar registro'}).click();await expect(page.getByText('OPORTUNIDADE / P',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Contatos',exact:true}).click();await page.getByRole('button',{name:'Adicionar contato'}).click();await page.getByLabel('Nome',{exact:true}).fill('Decisor sintético');await page.getByLabel('Telefone',{exact:true}).fill('11999990000');await page.getByRole('button',{name:'Salvar registro'}).click();await expect(page.getByText('Decisor sintético',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Registrar ligação',exact:true}).click();await page.getByLabel('Resultado',{exact:true}).selectOption('Interessado');await page.getByLabel('Falou com o decisor').check();await page.getByRole('button',{name:'Salvar registro'}).click();
 await page.getByRole('button',{name:'Programar retorno'}).click();await page.getByLabel('Próxima ação',{exact:true}).fill('Retornar ao decisor');await page.getByLabel('Data de retorno').fill('2026-11-01T10:00');await page.getByRole('button',{name:'Salvar registro'}).click();await expect(page.getByText('Retornar ao decisor',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Reuniões',exact:true}).click();await page.getByRole('button',{name:'Agendar +',exact:true}).click();await page.getByLabel('Início',{exact:true}).fill('2026-11-02T11:00');await page.getByRole('button',{name:'Salvar registro'}).click();await expect(page.getByText('Agendada · Vídeo',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Elegibilidade',exact:true}).click();await page.getByRole('button',{name:'Nova avaliação'}).click();
 for(const label of ['Compatibilidade comercial preliminar','Empresa ativa','Atividade compatível','Ambiente profissional adequado','Trabalho fora de residências','Pelo menos dois tipos de tarefa','Autorização do estabelecimento','Condições de segurança','Elegibilidade técnica atestada pelo avaliador','Demanda ativa para a categoria confirmada','Aprovação individual formal da Praxis recebida'])await page.getByLabel(label,{exact:true}).check();
 await page.getByLabel('Referência da aprovação (e-mail / documento)',{exact:true}).fill('REF-SINTETICA');await page.getByLabel('Justificativa e pendências').fill('Avaliação de teste');await page.getByRole('button',{name:'Salvar registro'}).click();
 await page.getByRole('button',{name:'Contrato',exact:true}).click();await page.getByRole('button',{name:'Registrar / atualizar'}).click();await page.getByLabel('Data da assinatura efetiva').fill('2026-10-29');await page.getByLabel('Confirmo assinatura efetiva do contrato').check();await page.getByLabel('Número / referência',{exact:true}).fill('CONTRATO-SINTETICO');await page.getByLabel('Origem da oportunidade').fill('Teste de interface');await page.getByRole('button',{name:'Salvar registro'}).click();await expect(page.getByText('CONTRATO-SINTETICO',{exact:true})).toBeVisible();
 expect(tables.contracts[0].signature_confirmed).toBe(true);expect(tables.operations).toHaveLength(0);
 expect(tables.activities[0].result).toBe('Interessado');expect(tables.contacts).toHaveLength(1);expect(tables.tasks).toHaveLength(1);expect(tables.meetings).toHaveLength(1);
 await page.reload();await expect(page.getByRole('heading',{name:'Visão da operação'})).toBeVisible();
 if(testInfo.project.name==='mobile')await page.getByRole('button',{name:'Menu',exact:true}).click();await page.getByRole('button',{name:'Leads',exact:true}).click();await page.getByRole('button',{name:'Empresa de teste sintética',exact:true}).click();await expect(page.getByText('Retornar ao decisor',{exact:true})).toBeVisible();await page.screenshot({path:testInfo.outputPath('lead.png'),fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 // Idioma: troca para inglês, grava no perfil e persiste após recarregar.
 await page.getByRole('button',{name:'EN',exact:true}).click();await expect(page.getByRole('button',{name:'Open establishment'})).toBeVisible();await expect(page.getByRole('button',{name:'Summary',exact:true})).toBeVisible();expect(tables.profiles[0].locale).toBe('en-US');
 await page.reload();await expect(page.getByRole('heading',{name:'Operations overview'})).toBeVisible();await expect(page.getByText('Establishment network')).toBeVisible();
 if(testInfo.project.name==='mobile')await page.getByRole('button',{name:'Menu',exact:true}).click();await page.getByRole('button',{name:'Establishments',exact:true}).click();const enRow=page.getByRole('row').filter({hasText:'Empresa de teste sintética'});await expect(enRow.getByText('In stock',{exact:true})).toBeVisible();await expect(enRow.getByText('High',{exact:true})).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('establishments-en.png'),fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole('button',{name:'PT',exact:true}).click();await expect(page.getByRole('button',{name:/^Todas/})).toBeVisible();expect(tables.profiles[0].locale).toBe('pt-BR');
});

test('praxis_viewer: leitura integral em inglês, sem edição (API simulada)',async({page},testInfo)=>{
 const vid='00000000-0000-0000-0000-000000000005';
 const user={id:vid,email:'viewer@example.invalid',app_metadata:{provider:'email'},user_metadata:{},aud:'authenticated',created_at:new Date().toISOString()};
 const now=new Date().toISOString();
 const tables:Record<string,any[]>={profiles:[{id:vid,name:'Leitor sintético',role:'praxis_viewer',active:true,locale:'en-US'},{id:uid,name:'Admin sintético',role:'admin',active:true,locale:'pt-BR'}],companies:[{id:'c1',legal_name:'Empresa sintética Praxis',city:'Campinas',state:'SP',participants:15,commercial_status:'contracted',operational_status:'recording',recording_confirmed:true,recording_started_at:now,strategic_importance:'high',importance_justification:'Justificativa sintética',prospecting_owner:uid,created_at:now,updated_at:now,status_changed_at:now}],contacts:[],opportunities:[{id:'o1',company_id:'c1',campaign_id:'campaign',owner_id:uid,stage:'Contrato assinado',priority:1,created_at:now}],activities:[],tasks:[],meetings:[],categories:[],buyers:[{id:'buyer',name:'Praxis Robotics'}],campaigns:[{id:'campaign',buyer_id:'buyer',name:'Campanha sintética',active:true,meeting_minutes:30}],protocols:[],evaluations:[],contracts:[{id:'k1',opportunity_id:'o1',signature_confirmed:true,signed_on:'2026-10-29',reference:'CONTRATO-SINTETICO'}],operations:[],production:[{id:'p1',opportunity_id:'o1',campaign_id:'campaign',recorded_on:'2026-10-29',recorded_hours:4,accepted_hours:3}],audit_log:[],company_status_history:[{id:1,company_id:'c1',field:'commercial_status',old_value:'negotiating',new_value:'contracted',reason:'Contrato sintético',actor_id:uid,changed_at:now}]};
 const writes:string[]=[],rpcs:string[]=[];
 await page.route('https://crm-test.supabase.co/**',async route=>{
 const request=route.request(),url=new URL(request.url());let body:any=[];
 if(url.pathname.includes('/auth/v1/token'))body={access_token:'synthetic-access-token',refresh_token:'synthetic-refresh-token',token_type:'bearer',expires_in:3600,user};
 else if(url.pathname.includes('/auth/v1/user'))body=user;
 else if(url.pathname.includes('/rest/v1/rpc/')){rpcs.push(url.pathname.split('/').pop()!);body=true;}
 else if(url.pathname.includes('/rest/v1/')){if(['POST','PATCH','PUT','DELETE'].includes(request.method()))writes.push(request.method()+' '+url.pathname);body=tables[url.pathname.split('/').pop()!]||[];}
 await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(body)});
 });
 await page.goto('./');await page.getByLabel('E-mail corporativo').fill('viewer@example.invalid');await page.getByLabel('Senha',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Entrar no CRM'}).click();
 await expect(page.getByRole('heading',{name:'Operations overview'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Company',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Opportunity',exact:true})).toHaveCount(0);
 const network=page.locator('.metric-grid.network');await expect(network.getByRole('button',{name:/Recording/})).toContainText('1');await expect(network.getByRole('button',{name:/accepted hours/})).toContainText('3');await expect(page.getByText('Restricted')).toHaveCount(0);
 if(testInfo.project.name==='mobile')await page.getByRole('button',{name:'Menu',exact:true}).click();
 await expect(page.getByRole('button',{name:'Settings',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Contracts',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Reports',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Establishments',exact:true}).click();await page.getByRole('button',{name:'Empresa sintética Praxis',exact:true}).click();
 await expect(page.getByText('Justificativa sintética')).toBeVisible();await expect(page.getByText('Contrato sintético')).toBeVisible();await expect(page.getByRole('button',{name:'CONTRATO-SINTETICO'})).toBeVisible();
 await expect(page.getByRole('button',{name:/Change status/})).toHaveCount(0);await expect(page.getByRole('button',{name:'Edit data'})).toHaveCount(0);await expect(page.getByRole('button',{name:/Create opportunity/})).toHaveCount(0);
 await page.getByRole('button',{name:'Open opportunity ↗'}).click();await expect(page.getByRole('button',{name:'Contract',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/Log call/})).toHaveCount(0);await expect(page.getByRole('button',{name:'Edit company'})).toHaveCount(0);
 await page.getByRole('button',{name:'Contract',exact:true}).click();await expect(page.getByText('CONTRATO-SINTETICO')).toBeVisible();await expect(page.getByRole('button',{name:'Record / update'})).toHaveCount(0);
 await page.screenshot({path:testInfo.outputPath('viewer.png'),fullPage:true});
 expect(writes).toEqual([]);expect(rpcs.filter(r=>r==='record_access')).toHaveLength(1);
});
test('frontend publicado antes da migration V1.1 continua funcionando (API simulada)',async({page})=>{
 const user={id:uid,email:'admin@example.invalid',app_metadata:{provider:'email'},user_metadata:{},aud:'authenticated',created_at:new Date().toISOString()};
 const tables:Record<string,any[]>={profiles:[{id:uid,name:'Admin sintético',role:'admin',active:true}],companies:[{id:'c1',legal_name:'Empresa anterior à V1.1',created_at:'2026-10-29T10:00:00Z',prospecting_owner:uid}]};
 await page.route('https://crm-test.supabase.co/**',async route=>{
 const request=route.request(),url=new URL(request.url());
 if(url.pathname.includes('/auth/v1/token'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:'a',refresh_token:'r',token_type:'bearer',expires_in:3600,user})});
 if(url.pathname.includes('/auth/v1/user'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(user)});
 if(url.pathname.endsWith('/company_status_history'))return route.fulfill({status:404,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({code:'PGRST205',message:'Could not find the table'})});
 await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(tables[url.pathname.split('/').pop()!]||[])});
 });
 await page.goto('./');await page.getByLabel('E-mail corporativo').fill('admin@example.invalid');await page.getByLabel('Senha',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Entrar no CRM'}).click();
 await expect(page.getByRole('heading',{name:'Visão da operação'})).toBeVisible();await expect(page.getByText('Banco sem a migration V1.1',{exact:false})).toBeVisible();
 if(test.info().project.name==='mobile')await page.getByRole('button',{name:'Menu',exact:true}).click();await page.getByRole('button',{name:'Estabelecimentos',exact:true}).click();
 await expect(page.getByRole('row').filter({hasText:'Empresa anterior à V1.1'}).getByText('Cadastrada',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Empresa anterior à V1.1',exact:true}).click();await expect(page.getByRole('heading',{name:'Empresa anterior à V1.1'})).toBeVisible();await expect(page.getByText('Dados cadastrais')).toBeVisible();
 await page.getByRole('button',{name:/Voltar para/}).click();await page.getByRole('button',{name:'Ver ficha de Empresa anterior à V1.1'}).click();await expect(page.getByRole('heading',{name:'Empresa anterior à V1.1'})).toBeVisible();
 await page.getByRole('button',{name:/Voltar para/}).click();await page.getByRole('row').filter({hasText:'Empresa anterior à V1.1'}).getByRole('cell').nth(2).click();await expect(page.getByText('Dados cadastrais')).toBeVisible();
});

test('administrador consulta o registro de acessos (API simulada)',async({page})=>{
 const vid='00000000-0000-0000-0000-000000000005',now=new Date().toISOString();
 const user={id:uid,email:'admin@example.invalid',app_metadata:{provider:'email'},user_metadata:{},aud:'authenticated',created_at:now};
 const tables:Record<string,any[]>={profiles:[{id:uid,name:'Admin sintético',role:'admin',active:true,locale:'pt-BR'},{id:vid,name:'Leitor sintético',role:'praxis_viewer',active:true,locale:'en-US'}],access_log:[{id:2,user_id:vid,occurred_at:now,user_agent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'}]};
 const overview=[{user_id:vid,name:'Leitor sintético',role:'praxis_viewer',active:true,email:'leitor@example.invalid',last_sign_in_at:now,last_access_at:now,accesses_30d:3},{user_id:uid,name:'Admin sintético',role:'admin',active:true,email:'admin@example.invalid',last_sign_in_at:null,last_access_at:null,accesses_30d:0}];
 const rpcs:string[]=[];
 await page.route('https://crm-test.supabase.co/**',async route=>{
 const request=route.request(),url=new URL(request.url());let body:any=[];
 if(url.pathname.includes('/auth/v1/token'))body={access_token:'a',refresh_token:'r',token_type:'bearer',expires_in:3600,user};
 else if(url.pathname.includes('/auth/v1/user'))body=user;
 else if(url.pathname.includes('/rest/v1/rpc/')){const fn=url.pathname.split('/').pop()!;rpcs.push(fn);body=fn==='access_overview'?overview:true;}
 else if(url.pathname.includes('/rest/v1/'))body=tables[url.pathname.split('/').pop()!]||[];
 await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(body)});
 });
 await page.goto('./');await page.getByLabel('E-mail corporativo').fill('admin@example.invalid');await page.getByLabel('Senha',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Entrar no CRM'}).click();
 await expect(page.getByRole('heading',{name:'Visão da operação'})).toBeVisible();await expect.poll(()=>rpcs.filter(r=>r==='record_access').length).toBe(1);
 if(test.info().project.name==='mobile')await page.getByRole('button',{name:'Menu',exact:true}).click();await page.getByRole('button',{name:'Configurações',exact:true}).click();
 const row=page.getByRole('row').filter({hasText:'leitor@example.invalid'});await expect(row).toBeVisible();await expect(row.getByText('Praxis · somente leitura')).toBeVisible();await expect(row.getByRole('cell',{name:'3',exact:true})).toBeVisible();
 await expect(page.getByRole('row').filter({hasText:'admin@example.invalid'}).getByText('Nunca entrou')).toBeVisible();await expect(page.getByText('Chrome · Windows',{exact:false})).toBeVisible();
});
