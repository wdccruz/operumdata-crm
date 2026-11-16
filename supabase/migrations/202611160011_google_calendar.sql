-- V1.3: Agenda do CRM sincronizada com o Google Agenda nos dois sentidos.
-- • Reuniões do CRM vão para o Google Agenda de cada usuário da equipe que conectar a conta
--   (somente as reuniões que esse usuário já pode ver no CRM).
-- • Eventos da agenda principal do Google entram no CRM como compromissos pessoais,
--   visíveis apenas ao próprio dono (nem administradores nem empresas parceiras os leem).
-- • Alterar horário ou excluir no Google uma reunião criada pelo CRM atualiza a reunião.
-- Tokens do Google ficam em tabela sem acesso pelo navegador; só a Edge Function (service_role) lê.
-- Migration incremental: nenhum registro existente é apagado.

-- 1. Conexão com o Google (uma por usuário). Sem nenhuma permissão para anon/authenticated.
create table public.google_connections(
 user_id uuid primary key references public.profiles on delete cascade,
 google_email text,
 refresh_token text not null,
 calendar_id text not null default 'primary',
 sync_token text,
 status text not null default 'active' check(status in ('active','error')),
 last_error text,
 last_synced_at timestamptz,
 sync_lock_until timestamptz, -- evita duas sincronizações simultâneas do mesmo usuário
 connected_at timestamptz not null default now()
);
alter table public.google_connections enable row level security;
revoke all on public.google_connections from public,anon,authenticated;
grant select,insert,update,delete on public.google_connections to service_role;

-- Situação da própria conexão, sem expor tokens.
create function public.my_google_connection() returns table(google_email text,status text,last_synced_at timestamptz,last_error text,connected_at timestamptz)
language sql stable security definer set search_path='' as $$
 select g.google_email,g.status,g.last_synced_at,g.last_error,g.connected_at from public.google_connections g where g.user_id=auth.uid() and private.writer() $$;
revoke all on function public.my_google_connection() from public;
do $$ begin if exists(select 1 from pg_roles where rolname='anon') then revoke all on function public.my_google_connection() from anon; end if; end $$;
grant execute on function public.my_google_connection() to authenticated;

-- 2. Compromissos vindos do Google: leitura exclusiva do dono; escrita só pelo servidor.
create table public.calendar_events(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles on delete cascade,
 google_event_id text not null,
 title text,
 location text,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 all_day boolean not null default false,
 html_link text check(html_link is null or html_link ~ '^https://'),
 updated_at timestamptz not null default now(),
 unique(user_id,google_event_id),
 check(ends_at>=starts_at)
);
create index calendar_events_user_idx on public.calendar_events(user_id,starts_at);
alter table public.calendar_events enable row level security;
create policy own_events_read on public.calendar_events for select to authenticated using(user_id=auth.uid() and private.writer());
-- Política restritiva: nenhuma outra política futura pode liberar eventos de outra pessoa.
create policy own_events_only on public.calendar_events as restrictive for select to authenticated using(user_id=auth.uid());
revoke all on public.calendar_events from public,anon,authenticated;
grant select on public.calendar_events to authenticated;
grant select,insert,update,delete on public.calendar_events to service_role;

-- 3. Vínculo reunião do CRM ↔ evento no Google de cada usuário conectado. Somente servidor.
create table public.meeting_google_events(
 meeting_id uuid not null references public.meetings on delete cascade,
 user_id uuid not null references public.profiles on delete cascade,
 google_event_id text not null,
 synced_hash text,
 synced_at timestamptz not null default now(),
 primary key(meeting_id,user_id),
 unique(user_id,google_event_id)
);
alter table public.meeting_google_events enable row level security;
revoke all on public.meeting_google_events from public,anon,authenticated;
grant select,insert,update,delete on public.meeting_google_events to service_role;

-- 4. Reuniões que um usuário da equipe pode ver (mesma regra de private.access_lead, para um usuário informado).
create function private.calendar_access(uid uuid,lid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select case when p.role='admin' then true
  when p.role in ('prospector','commercial') then exists(select 1 from public.opportunities o where o.id=lid and (o.owner_id=uid or (p.role='commercial' and o.commercial_id=uid)))
  else false end from public.profiles p where p.id=uid and p.active),false) $$;
revoke all on function private.calendar_access(uuid,uuid) from public;

-- Reuniões a enviar ao Google de um usuário: de 30 dias atrás em diante. Só o servidor chama.
create function public.google_meeting_feed(p_user uuid) returns table(id uuid,starts_at timestamptz,duration_minutes int,format text,url text,status text,company text,contact text)
language sql stable security definer set search_path='' as $$
 select m.id,m.starts_at,m.duration_minutes,m.format,m.url,m.status,coalesce(c.trade_name,c.legal_name),ct.name
 from public.meetings m join public.opportunities o on o.id=m.opportunity_id join public.companies c on c.id=o.company_id left join public.contacts ct on ct.id=m.contact_id
 where m.starts_at>now()-interval '30 days' and private.calendar_access(p_user,m.opportunity_id) $$;
revoke all on function public.google_meeting_feed(uuid) from public;
do $$ begin if exists(select 1 from pg_roles where rolname='anon') then revoke all on function public.google_meeting_feed(uuid) from anon,authenticated; end if; end $$;
grant execute on function public.google_meeting_feed(uuid) to service_role;

-- Alteração feita no Google numa reunião do CRM. Roda com a identidade do usuário para que
-- autoria e histórico (audit_log) registrem quem mudou. Só o servidor chama.
create function public.google_apply_meeting_change(p_user uuid,p_meeting uuid,p_starts_at timestamptz,p_minutes int,p_cancelled boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare m public.meetings;
begin
 select * into m from public.meetings where id=p_meeting;
 if m.id is null or not private.calendar_access(p_user,m.opportunity_id) then return false; end if;
 perform set_config('request.jwt.claim.sub',p_user::text,true);
 if p_cancelled then
  if m.status not in ('Cancelada','Realizada','Ausência') then update public.meetings set status='Cancelada' where id=p_meeting; return true; end if;
  return false;
 end if;
 if p_minutes>0 and (m.starts_at<>p_starts_at or m.duration_minutes<>p_minutes) then
  update public.meetings set starts_at=p_starts_at,duration_minutes=p_minutes where id=p_meeting; return true;
 end if;
 return false;
end $$;
revoke all on function public.google_apply_meeting_change(uuid,uuid,timestamptz,int,boolean) from public;
do $$ begin if exists(select 1 from pg_roles where rolname='anon') then revoke all on function public.google_apply_meeting_change(uuid,uuid,timestamptz,int,boolean) from anon,authenticated; end if; end $$;
grant execute on function public.google_apply_meeting_change(uuid,uuid,timestamptz,int,boolean) to service_role;

-- 5. Segredos gerados no próprio banco (Vault): assinatura do OAuth e chave do agendamento.
-- Ninguém precisa digitá-los; só a Edge Function (service_role) os lê por esta função.
create function public.google_secret(p_name text) returns text language plpgsql stable security definer set search_path='' as $$
declare v text;
begin
 if p_name not in ('google_state_secret','google_sync_key') or to_regclass('vault.decrypted_secrets') is null then return null; end if;
 execute 'select decrypted_secret from vault.decrypted_secrets where name=$1' into v using p_name;
 return v;
end $$;
revoke all on function public.google_secret(text) from public;
do $$ begin if exists(select 1 from pg_roles where rolname='anon') then revoke all on function public.google_secret(text) from anon,authenticated; end if; end $$;
grant execute on function public.google_secret(text) to service_role;

do $$ declare n text; begin
 if to_regclass('vault.secrets') is not null then
  foreach n in array array['google_state_secret','google_sync_key'] loop
   if not exists(select 1 from vault.secrets where name=n) then
    execute 'select vault.create_secret($1,$2)' using replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),n;
   end if;
  end loop;
 end if;
end $$;

-- 6. Sincronização automática a cada minuto (pg_cron + pg_net), só no Supabase hospedado.
-- URL do projeto (project_url) e chave da sincronização (google_sync_key) ficam no Vault,
-- nunca no repositório. Sem eles, a rotina não faz nada.
create function private.google_sync_tick() returns void language plpgsql security definer set search_path='' as $$
declare u text; k text;
begin
 if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then return; end if;
 execute 'select decrypted_secret from vault.decrypted_secrets where name=''project_url''' into u;
 execute 'select decrypted_secret from vault.decrypted_secrets where name=''google_sync_key''' into k;
 if u is null or k is null or not exists(select 1 from public.google_connections where status='active') then return; end if;
 execute 'select net.http_post(url:=$1,headers:=$2,body:=$3)' using u||'/functions/v1/google-calendar',jsonb_build_object('Content-Type','application/json','x-sync-key',k),'{"action":"cron"}'::jsonb;
end $$;
revoke all on function private.google_sync_tick() from public;

do $$ begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') and exists(select 1 from pg_available_extensions where name='pg_net') then
  create extension if not exists pg_net;
  create extension if not exists pg_cron;
  execute $c$select cron.schedule('google-calendar-sync','* * * * *','select private.google_sync_tick()')$c$;
 end if;
end $$;
