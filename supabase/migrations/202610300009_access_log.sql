-- Registro de acessos ao CRM. Cada abertura do CRM com sessão válida grava um acesso
-- (no máximo um a cada 30 minutos por usuário). Somente o administrador consulta.
create table public.access_log(
 id bigint generated always as identity primary key,
 user_id uuid not null references public.profiles(id),
 occurred_at timestamptz not null default now(),
 user_agent text check(user_agent is null or length(user_agent)<=300)
);
create index access_log_user_idx on public.access_log(user_id,occurred_at desc);
create index access_log_time_idx on public.access_log(occurred_at desc);
alter table public.access_log enable row level security;
create policy access_log_admin_read on public.access_log for select to authenticated using(private.admin());
-- Sem INSERT/UPDATE/DELETE pelo cliente: a gravação ocorre somente pela função abaixo,
-- sempre com o usuário autenticado (não é possível registrar acesso em nome de outro).
revoke all on public.access_log from public,anon,authenticated;
grant select on public.access_log to authenticated;
grant select,insert,update,delete on public.access_log to service_role;
grant usage,select on sequence public.access_log_id_seq to service_role;

create function public.record_access(p_user_agent text default null) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if private.role() is null then return false; end if;
 if exists(select 1 from public.access_log where user_id=auth.uid() and occurred_at>now()-interval '30 minutes') then return false; end if;
 insert into public.access_log(user_id,user_agent) values(auth.uid(),left(p_user_agent,300));
 return true;
end $$;

-- Visão por usuário: último login (Supabase Auth), último acesso ao CRM e acessos em 30 dias.
create function public.access_overview() returns table(user_id uuid,name text,role text,active boolean,email text,last_sign_in_at timestamptz,last_access_at timestamptz,accesses_30d bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.admin() then raise exception 'Somente administrador consulta o registro de acessos' using errcode='42501'; end if;
 return query
 select p.id,p.name,p.role,p.active,u.email::text,u.last_sign_in_at,
  (select max(a.occurred_at) from public.access_log a where a.user_id=p.id),
  (select count(*) from public.access_log a where a.user_id=p.id and a.occurred_at>now()-interval '30 days')
 from public.profiles p left join auth.users u on u.id=p.id
 order by 7 desc nulls last,p.name;
end $$;

revoke all on function public.record_access(text),public.access_overview() from public;
do $$ begin if exists(select 1 from pg_roles where rolname='anon') then revoke all on function public.record_access(text),public.access_overview() from anon; end if; end $$;
grant execute on function public.record_access(text),public.access_overview() to authenticated;
