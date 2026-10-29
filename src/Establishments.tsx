import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {Row,Store} from './db';
import {commercialStatuses,operationalStatuses,importanceLevels,statusFields,codeLabel,quickFilters,participantBands,participantBand,companyNext,filterEstablishments,digits,type EstablishmentFilter} from './domain';

type Common={s:Store;person:(id:string)=>string;date:(v?:string)=>string};
const ufs=(rows:Row[],key:string)=>[...new Set<string>(rows.map(r=>r[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
export function StatusBadge({list,code,kind}:{list:[string,string][];code?:string;kind?:string}){const{t}=useTranslation();return <span className={'badge status-'+(kind||'')+' code-'+(code||'none')}>{t(codeLabel(list,code))}</span>}

export function EstablishmentList({s,person,date,filter,setFilter,onOpen}:Common&{filter:EstablishmentFilter;setFilter:(f:EstablishmentFilter)=>void;onOpen:(id:string)=>void}){
 const {t}=useTranslation();const[offset,setOffset]=useState(0);
 const rows=filterEstablishments(s,filter),set=(patch:EstablishmentFilter)=>{setFilter({...filter,...patch});setOffset(0)};
 const selects:[keyof EstablishmentFilter,string,{value:string;label:string}[]][]=[
  ['city','Cidade',ufs(s.companies,'city').map(v=>({value:v,label:v}))],
  ['state','Estado',ufs(s.companies,'state').map(v=>({value:v,label:v}))],
  ['category','Setor',s.categories.map(c=>({value:c.id,label:c.name}))],
  ['importance','Importância',importanceLevels.map(([v,l])=>({value:v,label:t(l)}))],
  ['owner','Responsável',s.profiles.map(p=>({value:p.id,label:p.name}))],
  ['band','Participantes',participantBands.map(v=>({value:v,label:t(v)}))]];
 return <>
  <div className="quick-filters" role="group" aria-label={t('Filtros rápidos')}>{quickFilters.map(([key,label,test])=><button key={key} aria-pressed={(filter.quick||'all')===key} className={(filter.quick||'all')===key?'chip active':'chip'} onClick={()=>set({quick:key})}>{t(label)}<span>{s.companies.filter(test).length}</span></button>)}</div>
  <div className="filters"><input className="search" placeholder={t('Nome, CNPJ ou telefone…')} aria-label={t('Pesquisar estabelecimentos')} value={filter.search||''} onChange={e=>set({search:e.target.value})}/>{selects.map(([key,label,opts])=><select key={key} aria-label={t(label)} value={filter[key]||''} onChange={e=>set({[key]:e.target.value})}><option value="">{t('{{label}} · todos',{label:t(label)})}</option>{opts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>)}{Object.entries(filter).some(([k,v])=>k!=='quick'&&v)&&<button onClick={()=>{setFilter({quick:filter.quick});setOffset(0)}}>{t('Limpar filtros')}</button>}</div>
  <section className="panel no-padding"><div className="table-wrap"><table><thead><tr>{['Empresa','Setor','Cidade/UF','Participantes','Status comercial','Status operacional','Importância','Responsável','Última atualização','Próxima ação'].map(h=><th key={h}>{t(h)}</th>)}</tr></thead><tbody>{rows.slice(offset,offset+25).map(c=>{const next=companyNext(s,c);return <tr key={c.id}><td><button className="text-button" onClick={()=>onOpen(c.id)}>{c.trade_name||c.legal_name}</button>{c.trade_name&&<small>{c.legal_name}</small>}</td><td>{s.categories.find(x=>x.id===c.category_id)?.name||'—'}</td><td>{[c.city,c.state].filter(Boolean).join(' / ')||'—'}</td><td>{c.participants??'—'}</td><td><StatusBadge list={commercialStatuses} code={c.commercial_status||'registered'} kind="commercial"/></td><td><StatusBadge list={operationalStatuses} code={c.operational_status||'not_started'} kind="operational"/></td><td><StatusBadge list={importanceLevels} code={c.strategic_importance||'not_assessed'} kind="importance"/></td><td>{person(c.prospecting_owner)}</td><td>{date(c.updated_at||c.created_at)}</td><td>{next?.title||t('Não definida')}<small className={next?.due_at&&new Date(next.due_at)<new Date()?'accent':''}>{date(next?.due_at)}</small></td></tr>})}</tbody></table></div>
  {!rows.length&&<div className="empty"><span>—</span><p>{s.companies.length?t('Nenhum estabelecimento corresponde aos filtros.'):t('Nenhuma empresa cadastrada. Use + Empresa para iniciar a base.')}</p></div>}
  <footer><span>{t('{{n}} estabelecimentos',{n:rows.length})}</span><button disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-25))}>{t('Anterior')}</button><span>{rows.length?offset+1:0}–{Math.min(offset+25,rows.length)} / {rows.length}</span><button disabled={offset+25>=rows.length} onClick={()=>setOffset(offset+25)}>{t('Próxima')}</button></footer></section>
 </>;
}

type DetailProps=Common&{company:Row;canWrite:boolean;full:boolean;onBack:()=>void;backLabel:string;onEdit:()=>void;onClassify:(preset?:Row)=>void;onNewLead:()=>void;onOpenLead:(id:string,tab?:string)=>void;onContact:(contact?:Row)=>void};
export function EstablishmentDetail({s,company:c,person,date,canWrite,full,onBack,backLabel,onEdit,onClassify,onNewLead,onOpenLead,onContact}:DetailProps){
 const {t}=useTranslation();
 const opps=s.opportunities.filter(o=>o.company_id===c.id),ids=new Set(opps.map(o=>o.id));
 const contracts=s.contracts.filter(x=>ids.has(x.opportunity_id)),signed=contracts.some(x=>x.signature_confirmed&&x.signed_on);
 const recordingOp=s.operations.filter(x=>ids.has(x.opportunity_id)&&x.first_recording_at).sort((a,b)=>a.first_recording_at.localeCompare(b.first_recording_at))[0];
 const calls=s.activities.filter(a=>ids.has(a.opportunity_id)).sort((a,b)=>b.occurred_at.localeCompare(a.occurred_at));
 const meetings=s.meetings.filter(m=>ids.has(m.opportunity_id)).sort((a,b)=>b.starts_at.localeCompare(a.starts_at));
 const tasks=s.tasks.filter(x=>ids.has(x.opportunity_id)&&!x.done).sort((a,b)=>a.due_at.localeCompare(b.due_at));
 const history=s.company_status_history.filter(h=>h.company_id===c.id).sort((a,b)=>b.changed_at.localeCompare(a.changed_at));
 const audit=s.audit_log.filter(a=>a.company_id===c.id).sort((a,b)=>b.occurred_at.localeCompare(a.occurred_at));
 const next=companyNext(s,c),yes=(v:unknown)=>v?t('Sim'):t('Não');
 const campaign=(id:string)=>s.campaigns.find(x=>x.id===id)?.name||'—';
 const dl=(values:[string,unknown][])=><dl>{values.map(([k,v])=><div key={k}><dt>{t(k)}</dt><dd>{v===null||v===undefined||v===''?'—':String(v)}</dd></div>)}</dl>;
 return <>
  <button className="back" onClick={onBack}>← {backLabel}</button>
  <div className="page-heading"><div><div className="eyebrow">{t('ESTABELECIMENTO')} / {t(codeLabel(commercialStatuses,c.commercial_status||'registered')).toUpperCase()}</div><h1>{c.trade_name||c.legal_name}</h1><p>{c.city||t('Cidade não informada')} · {c.state||t('UF')} · {t('Participantes: {{band}}',{band:t(participantBand(c.participants??undefined))})}</p></div>{canWrite&&<div className="actions"><button onClick={onEdit}>{t('Editar dados')}</button><button onClick={()=>onNewLead()}>{t('Criar oportunidade +')}</button><button className="primary" onClick={()=>onClassify()}>{t('Alterar status / classificação')}</button></div>}</div>
  <div className="next-action"><span>{t('PRÓXIMA AÇÃO')}</span><strong>{next?.title||t('Defina o próximo passo')}</strong><span>{date(next?.due_at)}</span>{canWrite&&<button onClick={()=>onClassify()}>{t('Definir próxima ação')}</button>}</div>
  {canWrite&&signed&&c.commercial_status!=='contracted'&&<p className="callout hint">{t('Há contrato com assinatura efetiva registrado. O status comercial ainda não é Contratada.')} <button onClick={()=>onClassify({commercial_status:'contracted'})}>{t('Marcar como Contratada')}</button></p>}
  {canWrite&&full&&recordingOp&&c.operational_status!=='recording'&&<p className="callout hint">{t('A operação registra primeira gravação em {{d}}. Confirme o início efetivo para marcar como Gravando.',{d:date(recordingOp.first_recording_at)})} <button onClick={()=>onClassify({operational_status:'recording',recording_started_at:recordingOp.first_recording_at})}>{t('Revisar status operacional')}</button></p>}
  <div className="detail-grid">
   <section className="panel"><h2>{t('Classificação')}</h2>
    <div className="status-row"><div><small>{t('Status comercial')}</small><StatusBadge list={commercialStatuses} code={c.commercial_status||'registered'} kind="commercial"/></div><div><small>{t('Status operacional')}</small><StatusBadge list={operationalStatuses} code={c.operational_status||'not_started'} kind="operational"/></div><div><small>{t('Importância estratégica')}</small><StatusBadge list={importanceLevels} code={c.strategic_importance||'not_assessed'} kind="importance"/></div></div>
    {dl([['Justificativa da importância',c.importance_justification],['Pendências',c.pending_items],['Último motivo de status',c.status_reason],['Início efetivo das gravações',c.recording_started_at?date(c.recording_started_at):null],['Última alteração de status',date(c.status_changed_at)],['Responsável',person(c.prospecting_owner)]])}
   </section>
   <section className="panel"><h2>{t('Dados cadastrais')}</h2>{dl([['Razão social',c.legal_name],['Nome fantasia',c.trade_name],['CNPJ',c.cnpj],['Atividade econômica',c.economic_activity],['Setor',s.categories.find(x=>x.id===c.category_id)?.name],['Endereço',c.address],['Cidade/UF',[c.city,c.state].filter(Boolean).join(' / ')],['Localização',c.location],['Telefone comercial',c.phone],['WhatsApp',c.whatsapp],['Site',c.website],['Redes sociais',c.social],['Fonte do lead',c.source],['Data da identificação',c.identified_on]])}</section>
   <section className="panel"><h2>{t('Perfil operacional')}</h2>{dl([['Atividades executadas',c.activities],['Tipos de tarefa',c.task_types],['Participantes disponíveis',c.participants],['Trabalhadores estimados',c.workers],['Recorrência',c.recurrence],['Ambiente de trabalho',c.environment],['Operação móvel',yes(c.mobile)],['Equipamentos de proteção',c.protective_equipment],['Compatibilidade preliminar',c.preliminary_fit],['Autorização de terceiros',c.third_party_authorization],['Restrições',c.restrictions],['Observações',c.notes],['Referências de documentos',c.document_refs]])}</section>
   <section className="panel"><header><h2>{t('Contatos')}</h2>{canWrite&&<button onClick={()=>onContact()}>{t('Adicionar contato +')}</button>}</header>{s.contacts.filter(x=>x.company_id===c.id).map(x=><div className="record" key={x.id}><div><b>{x.name}</b><p>{[x.position,x.email,x.phone].filter(Boolean).join(' · ')}</p><small>{x.best_time} {x.notes}</small></div><div className="actions">{x.phone&&<a href={`tel:${digits(x.phone)}`}>{t('Ligar')}</a>}{canWrite&&<button onClick={()=>onContact(x)}>{t('Editar')}</button>}</div></div>)}{!s.contacts.some(x=>x.company_id===c.id)&&<p className="muted">{t('Nenhum contato cadastrado.')}</p>}</section>
  </div>
  <section className="panel"><header><h2>{t('Relacionamento')}</h2>{canWrite&&<button onClick={()=>onNewLead()}>{t('Criar oportunidade +')}</button>}</header>
   <h3>{t('Oportunidades')}</h3>{opps.map(o=><div className="record" key={o.id}><div><button className="text-button" onClick={()=>onOpenLead(o.id)}>{campaign(o.campaign_id)}</button><p>{t(o.stage)} · P{o.priority} · {person(o.owner_id)}</p></div><button onClick={()=>onOpenLead(o.id)}>{t('Abrir oportunidade ↗')}</button></div>)}{!opps.length&&<p className="muted">{t('Sem oportunidade comercial. A empresa permanece na base de estabelecimentos.')}</p>}
   {full&&<><h3>{t('Contratos')}</h3>{contracts.map(x=><div className="record" key={x.id}><div><button className="text-button" onClick={()=>onOpenLead(x.opportunity_id,'Contrato')}>{x.reference||t('Sem referência')}</button><p>{x.signature_confirmed?t('Assinado em {{d}}',{d:x.signed_on}):t('Em formalização')}</p></div></div>)}{!contracts.length&&<p className="muted">{t('Nenhum contrato.')}</p>}</>}
   <h3>{t('Próximas ações')}</h3>{tasks.map(x=><div className="record" key={x.id}><div><b>{x.title}</b><p>{date(x.due_at)}</p></div><button onClick={()=>onOpenLead(x.opportunity_id,'Tarefas')}>{t('Abrir')}</button></div>)}{c.next_action&&<div className="record"><div><b>{c.next_action}</b><p>{date(c.next_action_at)} · {t('Ação do estabelecimento')}</p></div></div>}{!tasks.length&&!c.next_action&&<p className="muted">{t('Nenhuma ação pendente.')}</p>}
   <h3>{t('Reuniões')}</h3>{meetings.map(m=><div className="record" key={m.id}><div><b>{date(m.starts_at)}</b><p>{t(m.status)} · {t(m.format)} · {m.outcome}</p></div><button onClick={()=>onOpenLead(m.opportunity_id,'Reuniões')}>{t('Abrir')}</button></div>)}{!meetings.length&&<p className="muted">{t('Nenhuma reunião.')}</p>}
   <h3>{t('Ligações e interações')}</h3>{calls.slice(0,10).map(a=><div className="record" key={a.id}><div><b>{t(a.result)}</b><p>{a.notes}</p><small>{date(a.occurred_at)} · {person(a.actor_id)}</small></div></div>)}{!calls.length&&<p className="muted">{t('Nenhuma interação registrada.')}</p>}
  </section>
  <section className="panel"><h2>{t('Histórico')}</h2>
   <div className="record"><div><b>{t('Cadastro criado')}</b><p>{date(c.created_at)}</p></div></div>
   {history.map(h=>{const list=statusFields[h.field]||[];return <div className="record" key={h.id}><div><b>{t({commercial_status:'Status comercial',operational_status:'Status operacional',strategic_importance:'Importância estratégica'}[h.field as string]||h.field)}: {h.old_value?t(codeLabel(list,h.old_value))+' → ':''}{t(codeLabel(list,h.new_value))}</b>{h.reason&&<p>{h.reason}</p>}<small>{date(h.changed_at)} · {h.actor_id?person(h.actor_id):t('Sistema')}</small></div></div>})}
   <details><summary>{t('Trilha de auditoria completa ({{n}})',{n:audit.length})}</summary>{audit.map(a=><details key={a.id} className="record"><summary>{date(a.occurred_at)} · {a.entity} · {a.action} · {a.actor_id?person(a.actor_id):t('Sistema')}</summary><pre>{JSON.stringify({before:a.before_data,after:a.after_data},null,2)}</pre></details>)}</details>
  </section>
 </>;
}
