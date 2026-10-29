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
 if(request.method()==='POST'){body={id:crypto.randomUUID(),owner_id:uid,actor_id:uid,created_at:new Date().toISOString(),occurred_at:new Date().toISOString(),stage:'Novo',...request.postDataJSON()};rows.push(body);}
 else if(request.method()==='PATCH'){const id=url.searchParams.get('id')?.replace('eq.','');body=rows.find(r=>r.id===id);Object.assign(body,request.postDataJSON());}
 else body=rows;
 }
 await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(body)});
 });
 await page.goto('./');await expect(page.getByRole('heading',{name:'Bom trabalho começa aqui.'})).toBeVisible();await page.getByLabel('E-mail corporativo').fill('admin@example.invalid');await page.getByLabel('Senha',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Entrar no CRM'}).click();await expect(page.getByRole('heading',{name:'Visão da operação'})).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('dashboard.png'),fullPage:true});
 await page.getByRole('button',{name:'Empresa',exact:true}).click();await page.getByLabel('Razão social').fill('Empresa de teste sintética');await page.getByLabel('Cidade',{exact:true}).fill('Cidade de teste');await page.getByLabel('Participantes disponíveis').fill('5');await page.getByRole('button',{name:'Salvar registro'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'Oportunidade',exact:true}).click();await page.getByLabel('Empresa',{exact:true}).selectOption({label:'Empresa de teste sintética'});await page.getByRole('button',{name:'Salvar registro'}).click();await expect(page.getByRole('heading',{name:'Empresa de teste sintética'})).toBeVisible();
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
});

