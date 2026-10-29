import type { Row, Store } from './db';
export const stages=['Novo','Tentando contato','Contato estabelecido','Pré-qualificação','Reunião agendada','Reunião realizada','Negociação','Aguardando análise da Praxis','Contrato em formalização','Contrato assinado','Perdido'];
export const qualifications=['Pronto para reunião','Contato futuro','Informações pendentes','Não elegível','Sem interesse'];
export const callResults=['Não atendeu','Ocupado','Número inválido','Decisor ausente','Solicitou retorno','Informações pendentes','Interessado','Reunião agendada','Sem interesse','Não elegível'];
export const operationStages=['Aguardando preparação','Preparação em andamento','Aguardando recursos da Praxis','Aguardando aprovação','Implantação agendada','Implantação em andamento','Implantação concluída','Ativação confirmada','Gravações em andamento','Suspenso','Encerrado'];
export const criteria: Record<string,string>={company_active:'Empresa ativa',compatible_activity:'Atividade compatível',professional_environment:'Ambiente profissional adequado',outside_home:'Trabalho fora de residências',two_tasks:'Pelo menos dois tipos de tarefa',authorization:'Autorização do estabelecimento',presentation_video:'Vídeo de apresentação por referência',safety:'Condições de segurança'};
export const digits=(value:string)=>value.replace(/\D/g,'');
export function validCnpj(value:string){ const s=digits(value); if(!s)return true; if(s.length!==14 || /^(\d)\1+$/.test(s))return false; const check=(n:number)=> {let sum=0;let weight=n-7;for(let i=0;i<n;i++){sum+=Number(s[i])*weight--;if(weight<2)weight=9;}const r=sum%11;return r<2?0:11-r;};return check(12)===Number(s[12])&&check(13)===Number(s[13]); }
export function participantBand(n?:number){ return n==null?'Não informado':n<=2?'1–2':n<=4?'3–4':n<=20?'5–20':n<=40?'21–40':'41 ou mais'; }
export function possibleDuplicates(rows:Row[],candidate:Row){return rows.filter(c=>c.id!==candidate.id&&((candidate.cnpj&&c.cnpj===digits(candidate.cnpj))||(candidate.phone&&digits(c.phone||'')===digits(candidate.phone))||c.legal_name?.trim().toLocaleLowerCase()===candidate.legal_name?.trim().toLocaleLowerCase()));}
export function metrics(s:Store,ids:Set<string>,from='',to=''){
 const within=(v:string)=>Boolean(v)&&(!from||v.slice(0,10)>=from)&&(!to||v.slice(0,10)<=to);
 const leads=s.opportunities.filter(o=>ids.has(o.id)); const activity=s.activities.filter(a=>ids.has(a.opportunity_id)&&within(a.occurred_at)); const calls=activity.filter(a=>a.kind==='Ligação');
 const contacted=new Set(activity.filter(a=>a.kind!=='Observação').map(a=>a.opportunity_id));const decision=new Set(calls.filter(a=>a.reached_decision_maker).map(a=>a.opportunity_id));
 const qualified=leads.filter(l=>within(l.qualified_at)); const meetings=s.meetings.filter(m=>ids.has(m.opportunity_id)&&within(m.starts_at)); const scheduled=meetings.filter(m=>m.status!=='Cancelada'); const held=meetings.filter(m=>m.status==='Realizada');
 const contracts=s.contracts.filter(c=>ids.has(c.opportunity_id)&&c.signature_confirmed&&within(c.signed_on)); const active=s.operations.filter(o=>ids.has(o.opportunity_id)&&within(o.first_recording_at));
 const counts=[leads.filter(l=>within(l.created_at)).length,contacted.size,calls.length,decision.size,qualified.length,scheduled.length,held.length,contracts.length,s.operations.filter(o=>ids.has(o.opportunity_id)&&!o.first_recording_at&&o.status!=='Encerrado').length,active.length,s.tasks.filter(t=>ids.has(t.opportunity_id)&&!t.done&&new Date(t.due_at)<new Date()).length,s.meetings.filter(m=>ids.has(m.opportunity_id)&&['Agendada','Confirmada'].includes(m.status)&&new Date(m.starts_at)>=new Date()&&new Date(m.starts_at).getTime()<Date.now()+7*86400000).length];
 // Conversões por coorte de oportunidades: os eventos podem ter múltiplas tentativas/reuniões.
 const cohort=leads.filter(l=>within(l.created_at));const sets=[contacted,decision,new Set(qualified.map(x=>x.id)),new Set(scheduled.map(x=>x.opportunity_id)),new Set(held.map(x=>x.opportunity_id)),new Set(contracts.map(x=>x.opportunity_id)),new Set(active.map(x=>x.opportunity_id))];
 const conversion=sets.slice(0,-1).map((set,i)=>{const base=cohort.filter(l=>set.has(l.id));return base.length?`${Math.round(base.filter(l=>sets[i+1].has(l.id)).length/base.length*100)}%`:'—';});
 return {counts,conversion};
}
export function safeCsv(value:unknown){const s=String(value??'');return /^[=+\-@\t\r]/.test(s)?`'${s}`:s;}
export function googleEvent(m:Row,company:string){const start=new Date(m.starts_at);const compact=(d:Date)=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');return 'https://calendar.google.com/calendar/render?'+new URLSearchParams({action:'TEMPLATE',text:`OperumData — ${company}`,dates:`${compact(start)}/${compact(new Date(start.getTime()+m.duration_minutes*60000))}`,details:m.url||'Reunião comercial'});}
// ===== V1.1 — Estabelecimentos. Códigos estáveis no banco; rótulos são chaves de tradução. =====
export const commercialStatuses:[string,string][]=[['registered','Cadastrada'],['potential','Potencial'],['prospecting','Em prospecção'],['qualifying','Em qualificação'],['negotiating','Em negociação'],['awaiting_praxis','Aguardando Praxis'],['stock','Em estoque'],['contracted','Contratada'],['discarded','Descartada']];
export const operationalStatuses:[string,string][]=[['not_started','Não iniciada'],['awaiting_deployment','Aguardando implantação'],['deploying','Em implantação'],['recording','Gravando'],['paused','Pausada'],['ended','Encerrada']];
export const importanceLevels:[string,string][]=[['high','Alta'],['medium','Média'],['low','Baixa'],['not_assessed','Não avaliada']];
export const statusFields:Record<string,[string,string][]>={commercial_status:commercialStatuses,operational_status:operationalStatuses,strategic_importance:importanceLevels};
export const codeLabel=(list:[string,string][],code?:string)=>list.find(([c])=>c===code)?.[1]??code??'—';
export const participantBands=['1–2','3–4','5–20','21–40','41 ou mais','Não informado'];
// Filtros rápidos: "Todas" exibe toda a base, inclusive estoque e descartadas.
export const quickFilters:[string,string,(c:Row)=>boolean][]=[['all','Todas',()=>true],['potential','Potenciais',c=>c.commercial_status==='potential'],['prospecting','Em prospecção',c=>c.commercial_status==='prospecting'],['stock','Em estoque',c=>c.commercial_status==='stock'],['contracted','Contratadas',c=>c.commercial_status==='contracted'],['recording','Gravando',c=>c.operational_status==='recording'],['paused','Pausadas',c=>c.operational_status==='paused'],['discarded','Descartadas',c=>c.commercial_status==='discarded']];
/** Próxima ação do estabelecimento: a mais próxima entre a ação da empresa e as tarefas abertas das suas oportunidades. */
export function companyNext(s:Store,c:Row):{title:string;due_at?:string}|undefined{
 const opp=new Set(s.opportunities.filter(o=>o.company_id===c.id).map(o=>o.id));
 const items=[...(c.next_action?[{title:c.next_action,due_at:c.next_action_at||undefined}]:[]),...s.tasks.filter(t=>opp.has(t.opportunity_id)&&!t.done).map(t=>({title:t.title,due_at:t.due_at}))];
 return items.sort((a,b)=>(a.due_at||'9999').localeCompare(b.due_at||'9999'))[0];
}
export type EstablishmentFilter={quick?:string;search?:string;city?:string;state?:string;category?:string;importance?:string;owner?:string;band?:string};
export function filterEstablishments(s:Store,f:EstablishmentFilter){
 const q=(f.search||'').trim().toLocaleLowerCase(),qd=digits(q),quick=quickFilters.find(([k])=>k===(f.quick||'all'))?.[2]||(()=>true);
 return s.companies.filter(c=>{
  if(!quick(c))return false;
  if(q){const names=[c.legal_name,c.trade_name].join(' ').toLocaleLowerCase();const nums=[c.cnpj,c.phone,c.whatsapp,...s.contacts.filter(x=>x.company_id===c.id).flatMap(x=>[x.phone,x.whatsapp])].map(v=>digits(v||''));if(!names.includes(q)&&!(qd.length>=3&&nums.some(n=>n.includes(qd))))return false;}
  return (!f.city||c.city===f.city)&&(!f.state||c.state===f.state)&&(!f.category||c.category_id===f.category)&&(!f.importance||(c.strategic_importance||'not_assessed')===f.importance)&&(!f.owner||c.prospecting_owner===f.owner)&&(!f.band||participantBand(c.participants??undefined)===f.band);
 }).sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||'')));
}
/** Indicadores da rede: posição atual de registros reais, sem depender de oportunidade ou contrato. */
export function networkMetrics(companies:Row[]){
 const n=(p:(c:Row)=>boolean)=>companies.filter(p).length;
 return {total:companies.length,potential:n(c=>c.commercial_status==='potential'),stock:n(c=>c.commercial_status==='stock'),contracted:n(c=>c.commercial_status==='contracted'),recording:n(c=>c.operational_status==='recording'),paused:n(c=>c.operational_status==='paused'),high:n(c=>c.strategic_importance==='high')};
}
/** Horas aceitas: somente valores efetivamente aceitos, nunca estimados. */
export function acceptedHours(s:Store,ids:Set<string>,from='',to=''){return s.production.filter(p=>ids.has(p.opportunity_id)&&p.accepted_hours!=null&&(!from||p.recorded_on>=from)&&(!to||p.recorded_on<=to)).reduce((sum,p)=>sum+Number(p.accepted_hours),0)}
