import {useTranslation} from 'react-i18next';
import type {GoogleStatus,Row} from './db';
// Painel da conexão com o Google Agenda (somente equipe OperumData).
export function GooglePanel({status,busy,date,onConnect,onSync,onDisconnect}:{status:GoogleStatus|undefined;busy:boolean;date:(v?:string)=>string;onConnect:()=>void;onSync:()=>void;onDisconnect:()=>void}){
 const {t}=useTranslation();
 if(status===undefined)return <section className="panel"><h2>{t('Google Agenda')}</h2><p className="muted">{t('Sincronização com o Google disponível após aplicar a migration 202611160011_google_calendar.sql no Supabase.')}</p></section>;
 return <section className="panel google-panel"><header><h2>{t('Google Agenda')}</h2>{status&&<span className="badge">{status.status==='active'?t('CONECTADO'):t('ATENÇÃO')}</span>}</header>
  {!status?<><p>{t('Conecte sua conta para enviar as reuniões do CRM ao Google Agenda (e ao celular) e trazer seus compromissos do Google para cá.')}</p><p className="muted">{t('Seus compromissos do Google aparecem somente para você. Ninguém mais da equipe, nem as empresas parceiras, consegue vê-los.')}</p><button className="primary" disabled={busy} onClick={onConnect}>{busy?t('Abrindo o Google…'):t('Conectar Google Agenda')}</button></>
  :<><p>{t('Conectado como {{email}}',{email:status.google_email||t('conta Google')})} · {t('Última sincronização: {{d}}',{d:date(status.last_synced_at||undefined)})}</p>
   {status.status!=='active'&&<p className="error" role="alert">{status.last_error?t(status.last_error):t('A última sincronização falhou.')}</p>}
   <p className="muted">{t('Sincroniza automaticamente a cada minuto, nos dois sentidos. Alterar o horário ou excluir no Google uma reunião do CRM atualiza a reunião aqui.')}</p>
   <div className="actions"><button disabled={busy} onClick={onSync}>{busy?t('Sincronizando…'):t('Sincronizar agora')}</button><button disabled={busy} onClick={onDisconnect}>{t('Desconectar')}</button></div></>}
 </section>;
}
// Compromisso vindo do Google: visível só ao dono (garantido pelo banco).
export function PersonalEvent({e,date}:{e:Row;date:(v?:string)=>string}){
 const {t,i18n}=useTranslation();
 const day=(v:string)=>new Date(v).toLocaleDateString(i18n.language,{dateStyle:'short'});
 return <div className="record personal-event"><div><b>{e.all_day?`${day(e.starts_at)} · ${t('Dia inteiro')}`:date(e.starts_at)} · {e.title||t('(sem título)')}</b><p>{t('Google Agenda · só você vê')}{e.location?` · ${e.location}`:''}</p></div>{e.html_link&&<div className="actions"><a href={e.html_link} target="_blank" rel="noreferrer">{t('Abrir no Google ↗')}</a></div>}</div>;
}
