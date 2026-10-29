-- V1.1: estabelecimentos como cadastro central, status comercial e operacional
-- independentes, importância estratégica, histórico, idioma e perfil praxis_viewer.
-- Migration incremental: nenhum registro existente é apagado.

-- 1. Perfil externo somente leitura e preferência de idioma por usuário.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('admin','prospector','commercial','praxis_viewer'));
alter table public.profiles add column locale text not null default 'pt-BR' constraint profiles_locale_check check(locale in ('pt-BR','en-US'));

create function private.writer() returns boolean language sql stable security definer set search_path='' as $$ select coalesce(private.role() in ('admin','prospector','commercial'),false) $$;
create function private.viewer() returns boolean language sql stable security definer set search_path='' as $$ select coalesce(private.role()='praxis_viewer',false) $$;
revoke all on function private.writer(),private.viewer() from public;
grant execute on function private.writer(),private.viewer() to authenticated;

-- 2. Estabelecimento com identidade própria. Códigos estáveis, independentes do idioma.
alter table public.companies
 add column commercial_status text not null default 'registered' constraint company_commercial_status check(commercial_status in ('registered','potential','prospecting','qualifying','negotiating','awaiting_praxis','stock','contracted','discarded')),
 add column operational_status text not null default 'not_started' constraint company_operational_status check(operational_status in ('not_started','awaiting_deployment','deploying','recording','paused','ended')),
 add column strategic_importance text not null default 'not_assessed' constraint company_strategic_importance check(strategic_importance in ('high','medium','low','not_assessed')),
 add column importance_justification text,
 add column pending_items text,
 add column status_reason text,
 add column recording_confirmed boolean not null default false,
 add column recording_started_at timestamptz,
 add column next_action text,
 add column next_action_at timestamptz,
 add column updated_at timestamptz,
 add column updated_by uuid references public.profiles,
 add column status_changed_at timestamptz;
-- Última atualização dos cadastros existentes = data de criação (sem gerar auditoria artificial).
alter table public.companies disable trigger audit_change;
alter table public.companies disable trigger guard_company;
update public.companies set updated_at=created_at,status_changed_at=created_at;
alter table public.companies enable trigger audit_change;
alter table public.companies enable trigger guard_company;
alter table public.companies alter column updated_at set default now(), alter column updated_at set not null, alter column status_changed_at set default now(), alter column status_changed_at set not null;
alter table public.companies add constraint company_discard_reason check(commercial_status<>'discarded' or coalesce(length(trim(status_reason)),0)>0);
alter table public.companies add constraint company_recording_confirmed check(operational_status<>'recording' or (recording_confirmed and recording_started_at is not null));
create index company_commercial_status_idx on public.companies(commercial_status);
create index company_operational_status_idx on public.companies(operational_status);

-- 3. Histórico legível de alterações de status e importância.
create table public.company_status_history(
 id bigint generated always as identity primary key,
 company_id uuid not null references public.companies,
 field text not null check(field in ('commercial_status','operational_status','strategic_importance')),
 old_value text, new_value text not null, reason text,
 actor_id uuid references public.profiles,
 changed_at timestamptz not null default now()
);
create index company_status_history_idx on public.company_status_history(company_id,changed_at desc);

-- Backfill somente de fatos já registrados: contrato assinado e primeira gravação confirmada.
update public.companies c set commercial_status='contracted',status_reason='Migração V1.1: contrato com assinatura efetiva registrado'
 where exists(select 1 from public.contracts ct join public.opportunities o on o.id=ct.opportunity_id where o.company_id=c.id and ct.signature_confirmed and ct.signed_on is not null);
update public.companies c set operational_status='recording',recording_confirmed=true,recording_started_at=x.first_recording_at
 from (select o.company_id,min(op.first_recording_at) first_recording_at from public.operations op join public.opportunities o on o.id=op.opportunity_id where op.first_recording_at is not null and op.status='Gravações em andamento' group by o.company_id) x
 where x.company_id=c.id;
insert into public.company_status_history(company_id,field,old_value,new_value,reason,changed_at)
 select id,'commercial_status',null,commercial_status,'Migração V1.1',created_at from public.companies;
insert into public.company_status_history(company_id,field,old_value,new_value,reason)
 select id,'operational_status','not_started',operational_status,'Migração V1.1: primeira gravação confirmada' from public.companies where operational_status<>'not_started';

create function private.guard_establishment() returns trigger language plpgsql security definer set search_path='' as $$
declare ops boolean:=private.admin() or private.role()='commercial';
begin
 if TG_OP='UPDATE' then
  if not private.admin() and (new.strategic_importance is distinct from old.strategic_importance or new.importance_justification is distinct from old.importance_justification) then raise exception 'Somente administrador altera a importância estratégica'; end if;
  if not ops and (new.operational_status is distinct from old.operational_status or new.recording_confirmed is distinct from old.recording_confirmed or new.recording_started_at is distinct from old.recording_started_at) then raise exception 'Status operacional restrito a administrador e comercial'; end if;
  if new.commercial_status is distinct from old.commercial_status or new.operational_status is distinct from old.operational_status then new.status_changed_at:=now(); end if;
 else
  if not private.admin() and (new.strategic_importance<>'not_assessed' or new.importance_justification is not null) then raise exception 'Somente administrador altera a importância estratégica'; end if;
  if not ops and (new.operational_status<>'not_started' or new.recording_confirmed or new.recording_started_at is not null) then raise exception 'Status operacional restrito a administrador e comercial'; end if;
  new.status_changed_at:=now();
 end if;
 new.updated_at:=now(); new.updated_by:=auth.uid();
 if new.commercial_status='contracted' and (TG_OP='INSERT' or old.commercial_status is distinct from 'contracted')
  and not exists(select 1 from public.contracts ct join public.opportunities o on o.id=ct.opportunity_id where o.company_id=new.id and ct.signature_confirmed and ct.signed_on is not null)
  then raise exception 'Status Contratada exige contrato com assinatura efetiva registrada'; end if;
 return new; end $$;
create trigger guard_establishment before insert or update on public.companies for each row execute function private.guard_establishment();

create function private.company_history() returns trigger language plpgsql security definer set search_path='' as $$
declare f text; o text; n text; why text;
begin
 foreach f in array array['commercial_status','operational_status','strategic_importance'] loop
  n:=to_jsonb(new)->>f; o:=case when TG_OP='UPDATE' then to_jsonb(old)->>f end;
  if TG_OP='INSERT' and f<>'commercial_status' and n in ('not_started','not_assessed') then continue; end if;
  if TG_OP='INSERT' or n is distinct from o then
   -- Motivo só é registrado quando informado nesta alteração, evitando reaproveitar motivo antigo.
   why:=case when f='strategic_importance' then new.importance_justification
             when TG_OP='INSERT' or new.status_reason is distinct from old.status_reason then new.status_reason end;
   insert into public.company_status_history(company_id,field,old_value,new_value,reason,actor_id) values(new.id,f,o,n,why,auth.uid());
  end if;
 end loop;
 return new; end $$;
create trigger company_history after insert or update on public.companies for each row execute function private.company_history();
revoke all on function private.guard_establishment(),private.company_history() from public;

alter table public.company_status_history enable row level security;
create policy history_read on public.company_status_history for select to authenticated using(private.admin() or private.access_company(company_id));
grant select on public.company_status_history to authenticated;
grant select,insert,update,delete on public.company_status_history to service_role;
grant usage,select on sequence public.company_status_history_id_seq to service_role;

-- 4. praxis_viewer: leitura integral; escrita bloqueada no banco para qualquer caminho da API.
-- Políticas RESTRICTIVE são combinadas com AND às permissivas existentes, sem alterar
-- as permissões de administrador, prospector e comercial.
do $$ declare t text; begin
 foreach t in array array['profiles','categories','buyers','campaigns','protocols','companies','opportunities','contacts','activities','tasks','meetings','evaluations','contracts','operations','production','audit_log','company_status_history'] loop
  execute format('create policy writers_only_insert on public.%I as restrictive for insert to authenticated with check(private.writer())',t);
  execute format('create policy writers_only_update on public.%I as restrictive for update to authenticated using(private.writer()) with check(private.writer())',t);
  execute format('create policy writers_only_delete on public.%I as restrictive for delete to authenticated using(private.writer())',t);
  execute format('create policy viewer_read on public.%I for select to authenticated using(private.viewer())',t);
 end loop;
end $$;

-- 5. Cada usuário ativo altera somente o próprio idioma (sem liberar UPDATE em profiles).
create function public.set_my_locale(p_locale text) returns text language plpgsql security definer set search_path='' as $$
begin
 if private.role() is null then raise exception 'Perfil ativo obrigatório' using errcode='42501'; end if;
 if p_locale is null or p_locale not in ('pt-BR','en-US') then raise exception 'Idioma não suportado' using errcode='22023'; end if;
 update public.profiles set locale=p_locale where id=auth.uid();
 return p_locale;
end $$;
revoke all on function public.set_my_locale(text) from public;
do $$ begin if exists(select 1 from pg_roles where rolname='anon') then revoke all on function public.set_my_locale(text) from anon; end if; end $$;
grant execute on function public.set_my_locale(text) to authenticated;
