import { createClient } from '@supabase/supabase-js';
import i18n from './i18n';
import {readAuthFlow} from './auth-flow';
export const inboundAuth = readAuthFlow(location.href);
export const initialAuthFlow = inboundAuth.passwordFlow;
export const configured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
export const db = createClient(import.meta.env.VITE_SUPABASE_URL || 'https://unconfigured.supabase.co', import.meta.env.VITE_SUPABASE_ANON_KEY || 'not-configured', { auth: { persistSession: true, storage: sessionStorage, detectSessionInUrl: true, autoRefreshToken: true } });
// Somente a sessão fica em sessionStorage. Todos os dados comerciais vêm do PostgreSQL.
export type Row = Record<string, any>;
export const tables = ['companies','contacts','opportunities','activities','tasks','meetings','categories','buyers','campaigns','protocols','evaluations','contracts','operations','production','profiles','audit_log','company_status_history','lead_reviews','calendar_events'] as const;
export type Store = Record<(typeof tables)[number], Row[]>;
export const emptyStore = Object.fromEntries(tables.map(t=>[t,[] as Row[]])) as Store;
// Tabela criada pela migration V1.1. Enquanto ela não estiver aplicada, a aplicação continua
// funcionando com o modelo anterior e avisa o administrador (sem dados simulados).
// lead_reviews (parecer da empresa) vem da migration 0010; antes dela a ficha mostra um aviso.
// calendar_events (compromissos do Google, só do próprio usuário) vem da migration 0011.
export const schema={v11:true,v12:true,v13:true};
const missing=(e:{code?:string})=>['PGRST205','42P01','PGRST202','42883'].includes(e.code||'');
export async function loadStore(): Promise<Store> {
 schema.v11=true;schema.v12=true;schema.v13=true;
 const results = await Promise.all(tables.map(async table=> {
  const rows:Row[]=[]; let from=0;
  while(true){ const {data,error}=await db.from(table).select('*').order(table==='audit_log'?'occurred_at':'id').range(from,from+499); if(error){ if(table==='company_status_history'&&missing(error)){schema.v11=false;break;} if(table==='lead_reviews'&&missing(error)){schema.v12=false;break;} if(table==='calendar_events'&&missing(error)){schema.v13=false;break;} throw error; } rows.push(...data); if(data.length<500) break; from+=500; }
  return [table,rows];
 }));
 return Object.fromEntries(results) as Store;
}
export async function save(table:string, values:Row, id?:string){ const query=id?db.from(table).update(values).eq('id',id):db.from(table).insert(values); const {data,error}=await query.select().single(); if(error)throw error; return data as Row; }
// Mensagens do banco (triggers) são chaves de tradução; mensagens desconhecidas são exibidas como recebidas.
export function errorText(error:unknown){ const e=error as {message?:string;code?:string}; const t=i18n.t.bind(i18n); if(e.code==='23505')return t('Já existe um registro com este CNPJ ou empresa nesta campanha.'); if(e.code==='42501')return t('Acesso negado. Confira seu perfil e a atribuição da oportunidade.'); if(e.code==='23514')return t('Dados incompatíveis com as regras do registro. Revise motivo, confirmação e campos obrigatórios.'); return e.message ? t(e.message) : t('Não foi possível concluir a operação.'); }
export async function saveLocale(locale:string){ const {error}=await db.rpc('set_my_locale',{p_locale:locale}); if(error&&!missing(error))throw error; return !error; }
// Registro de acessos (migration 0009). Falha silenciosa se a migration ainda não estiver aplicada.
export async function recordAccess(){ const {error}=await db.rpc('record_access',{p_user_agent:navigator.userAgent.slice(0,300)}); if(error&&!missing(error))console.warn('record_access',error.message); }
export type AccessData={overview:Row[];events:Row[];available:boolean};
export async function loadAccess():Promise<AccessData>{
 const [overview,events]=await Promise.all([db.rpc('access_overview'),db.from('access_log').select('*').order('occurred_at',{ascending:false}).limit(100)]);
 if((overview.error&&missing(overview.error))||(events.error&&missing(events.error)))return {overview:[],events:[],available:false};
 if(overview.error)throw overview.error; if(events.error)throw events.error;
 return {overview:overview.data as Row[],events:events.data as Row[],available:true};
}
// Totais da rede (somente contagens) para a empresa parceira, que não lê os demais cadastros.
export async function loadNetworkTotals():Promise<Row|undefined>{const{data,error}=await db.rpc('network_totals');if(error){if(missing(error))return undefined;throw error;}const r=Array.isArray(data)?data[0]:undefined;return r?Object.fromEntries(Object.entries(r).map(([k,v])=>[k,Number(v)])):undefined}
// O parecer não passa pelo bloqueio de somente leitura: autoria e empresa são definidas no servidor.
export async function saveReview(values:Row){const{error}=await db.from('lead_reviews').insert(values);if(error)throw error;}
// Google Agenda (migration 0011 + Edge Function google-calendar). Tokens nunca chegam ao navegador.
export type GoogleStatus={google_email:string|null;status:string;last_synced_at:string|null;last_error:string|null;connected_at:string}|null;
export async function loadGoogleStatus():Promise<GoogleStatus|undefined>{const{data,error}=await db.rpc('my_google_connection');if(error){if(missing(error))return undefined;throw error;}return (Array.isArray(data)?data[0]:null)||null}
export async function googleAction(action:'connect'|'sync'|'disconnect'):Promise<Row>{const{data,error}=await db.functions.invoke('google-calendar',{body:{action}});if(error){let message=error.message;try{const b=await (error as {context?:Response}).context?.json();if(b?.error)message=b.error}catch{/* resposta sem JSON */}throw new Error(message)}return data as Row}
