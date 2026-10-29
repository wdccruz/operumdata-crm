import { createClient } from '@supabase/supabase-js';
import i18n from './i18n';
export const initialAuthFlow = location.hash.includes("type=invite") || location.hash.includes("type=recovery");
export const configured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
export const db = createClient(import.meta.env.VITE_SUPABASE_URL || 'https://unconfigured.supabase.co', import.meta.env.VITE_SUPABASE_ANON_KEY || 'not-configured', { auth: { persistSession: true, storage: sessionStorage, detectSessionInUrl: true, autoRefreshToken: true } });
// Somente a sessão fica em sessionStorage. Todos os dados comerciais vêm do PostgreSQL.
export type Row = Record<string, any>;
export const tables = ['companies','contacts','opportunities','activities','tasks','meetings','categories','buyers','campaigns','protocols','evaluations','contracts','operations','production','profiles','audit_log','company_status_history'] as const;
export type Store = Record<(typeof tables)[number], Row[]>;
export const emptyStore = Object.fromEntries(tables.map(t=>[t,[] as Row[]])) as Store;
// Tabela criada pela migration V1.1. Enquanto ela não estiver aplicada, a aplicação continua
// funcionando com o modelo anterior e avisa o administrador (sem dados simulados).
export const schema={v11:true};
const missing=(e:{code?:string})=>['PGRST205','42P01','PGRST202','42883'].includes(e.code||'');
export async function loadStore(): Promise<Store> {
 schema.v11=true;
 const results = await Promise.all(tables.map(async table=> {
  const rows:Row[]=[]; let from=0;
  while(true){ const {data,error}=await db.from(table).select('*').order(table==='audit_log'?'occurred_at':'id').range(from,from+499); if(error){ if(table==='company_status_history'&&missing(error)){schema.v11=false;break;} throw error; } rows.push(...data); if(data.length<500) break; from+=500; }
  return [table,rows];
 }));
 return Object.fromEntries(results) as Store;
}
export async function save(table:string, values:Row, id?:string){ const query=id?db.from(table).update(values).eq('id',id):db.from(table).insert(values); const {data,error}=await query.select().single(); if(error)throw error; return data as Row; }
// Mensagens do banco (triggers) são chaves de tradução; mensagens desconhecidas são exibidas como recebidas.
export function errorText(error:unknown){ const e=error as {message?:string;code?:string}; const t=i18n.t.bind(i18n); if(e.code==='23505')return t('Já existe um registro com este CNPJ ou empresa nesta campanha.'); if(e.code==='42501')return t('Acesso negado. Confira seu perfil e a atribuição da oportunidade.'); if(e.code==='23514')return t('Dados incompatíveis com as regras do registro. Revise motivo, confirmação e campos obrigatórios.'); return e.message ? t(e.message) : t('Não foi possível concluir a operação.'); }
export async function saveLocale(locale:string){ const {error}=await db.rpc('set_my_locale',{p_locale:locale}); if(error&&!missing(error))throw error; return !error; }
