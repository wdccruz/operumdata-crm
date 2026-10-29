import { createClient } from '@supabase/supabase-js';
export const initialAuthFlow = location.hash.includes("type=invite") || location.hash.includes("type=recovery");
export const configured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
export const db = createClient(import.meta.env.VITE_SUPABASE_URL || 'https://unconfigured.supabase.co', import.meta.env.VITE_SUPABASE_ANON_KEY || 'not-configured', { auth: { persistSession: true, storage: sessionStorage, detectSessionInUrl: true, autoRefreshToken: true } });
// Somente a sessão fica em sessionStorage. Todos os dados comerciais vêm do PostgreSQL.
export type Row = Record<string, any>;
export const tables = ['companies','contacts','opportunities','activities','tasks','meetings','categories','buyers','campaigns','protocols','evaluations','contracts','operations','profiles','audit_log'] as const;
export type Store = Record<(typeof tables)[number], Row[]>;
export const emptyStore = Object.fromEntries(tables.map(t=>[t,[] as Row[]])) as Store;
export async function loadStore(): Promise<Store> {
 const results = await Promise.all(tables.map(async table=> {
  const rows:Row[]=[]; let from=0;
  while(true){ const {data,error}=await db.from(table).select('*').order(table==='audit_log'?'occurred_at':'id').range(from,from+499); if(error)throw error; rows.push(...data); if(data.length<500) break; from+=500; }
  return [table,rows];
 }));
 return Object.fromEntries(results) as Store;
}
export async function save(table:string, values:Row, id?:string){ const query=id?db.from(table).update(values).eq('id',id):db.from(table).insert(values); const {data,error}=await query.select().single(); if(error)throw error; return data as Row; }
export function errorText(error:unknown){ const e=error as {message?:string;code?:string}; if(e.code==='23505')return 'Já existe um registro com este CNPJ ou empresa nesta campanha.'; if(e.code==='42501')return 'Acesso negado. Confira seu perfil e a atribuição da oportunidade.'; return e.message || 'Não foi possível concluir a operação.'; }



