-- OperumData: dados comerciais pertencem à OperumData, campanhas multi-comprador.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create table public.profiles (
 id uuid primary key references auth.users(id), name text not null, role text not null check(role in ('admin','prospector','commercial')), active boolean not null default true, created_at timestamptz not null default now()
);
create function private.role() returns text language sql stable security definer set search_path='' as $$ select role from public.profiles where id=auth.uid() and active $$;
create function private.admin() returns boolean language sql stable security definer set search_path='' as $$ select coalesce(private.role()='admin',false) $$;
create table public.categories(id uuid primary key default gen_random_uuid(), name text not null unique, priority int not null default 4 check(priority between 1 and 4));
create table public.buyers(id uuid primary key default gen_random_uuid(), name text not null unique);
create table public.campaigns(id uuid primary key default gen_random_uuid(), buyer_id uuid not null references public.buyers, name text not null, active boolean not null default true, meeting_minutes int not null default 30 check(meeting_minutes>0), goal_leads int not null default 0, goal_contracts int not null default 0, starts_on date, ends_on date);
create table public.protocols(id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.campaigns, version int not null, min_participants int not null default 5 check(min_participants>=1), two_tasks boolean not null default true, outside_home boolean not null default true, presentation_video boolean not null default false, praxis_approval_required boolean not null default true, criteria jsonb not null default '{}', published_at timestamptz not null default now(), unique(campaign_id,version));
create table public.companies(
 id uuid primary key default gen_random_uuid(), legal_name text not null check(length(trim(legal_name))>0), trade_name text, cnpj text unique check(cnpj is null or cnpj ~ '^[0-9]{14}$'), economic_activity text, category_id uuid references public.categories, city text, state text check(state is null or length(state)=2), address text, location text, website text, social text, phone text, whatsapp text, source text, identified_on date not null default current_date, prospecting_owner uuid not null default auth.uid() references public.profiles,
 activities text, task_types text, environment text, workers int check(workers>=0), participants int check(participants>=0), recurrence text, mobile boolean not null default false, protective_equipment text, preliminary_fit text, third_party_authorization text, restrictions text, notes text, document_refs text, created_at timestamptz not null default now()
);
create table public.opportunities(
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies, campaign_id uuid not null references public.campaigns, owner_id uuid not null default auth.uid() references public.profiles, commercial_id uuid references public.profiles, stage text not null default 'Novo' check(stage in ('Novo','Tentando contato','Contato estabelecido','Pré-qualificação','Reunião agendada','Reunião realizada','Negociação','Aguardando análise da Praxis','Contrato em formalização','Contrato assinado','Perdido')), priority int not null default 4 check(priority between 1 and 4), qualification text check(qualification in ('Pronto para reunião','Contato futuro','Informações pendentes','Não elegível','Sem interesse')), reason text, notes text, qualified_at timestamptz, created_at timestamptz not null default now(), unique(company_id,campaign_id), check((stage<>'Perdido' and qualification is distinct from 'Não elegível') or length(trim(reason))>0)
);
create function private.access_company(cid uuid) returns boolean language sql stable security definer set search_path='' as $$ select private.admin() or (private.role() is not null and (exists(select 1 from public.companies c where c.id=cid and c.prospecting_owner=auth.uid()) or exists(select 1 from public.opportunities o where o.company_id=cid and (o.owner_id=auth.uid() or (private.role()='commercial' and o.commercial_id=auth.uid()))))) $$;
create function private.access_lead(lid uuid) returns boolean language sql stable security definer set search_path='' as $$ select private.admin() or (private.role() is not null and exists(select 1 from public.opportunities o where o.id=lid and (o.owner_id=auth.uid() or (private.role()='commercial' and o.commercial_id=auth.uid())))) $$;
create function private.commercial(lid uuid) returns boolean language sql stable security definer set search_path='' as $$ select private.admin() or (private.role()='commercial' and private.access_lead(lid)) $$;
create table public.contacts(id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies, name text not null, position text, phone text, whatsapp text, email text, best_time text, notes text, created_at timestamptz not null default now());
create table public.activities(id uuid primary key default gen_random_uuid(), opportunity_id uuid not null references public.opportunities, actor_id uuid not null default auth.uid() references public.profiles, kind text not null default 'Ligação' check(kind in ('Ligação','WhatsApp','E-mail','Observação')), result text not null check(result in ('Não atendeu','Ocupado','Número inválido','Decisor ausente','Solicitou retorno','Informações pendentes','Interessado','Reunião agendada','Sem interesse','Não elegível','Observação')), reached_decision_maker boolean not null default false, notes text, occurred_at timestamptz not null default now());
create table public.tasks(id uuid primary key default gen_random_uuid(), opportunity_id uuid not null references public.opportunities, owner_id uuid not null default auth.uid() references public.profiles, title text not null, due_at timestamptz not null, done boolean not null default false, created_at timestamptz not null default now());
create table public.meetings(id uuid primary key default gen_random_uuid(), opportunity_id uuid not null references public.opportunities, contact_id uuid references public.contacts, owner_id uuid not null default auth.uid() references public.profiles, starts_at timestamptz not null, duration_minutes int not null default 30 check(duration_minutes>0), format text not null default 'Vídeo' check(format in ('Vídeo','Telefone','Presencial')), url text check(url is null or url ~ '^https?://'), status text not null default 'Agendada' check(status in ('Agendada','Confirmada','Realizada','Ausência','Cancelada')), outcome text, next_action text, created_at timestamptz not null default now());
create table public.evaluations(id uuid primary key default gen_random_uuid(), opportunity_id uuid not null references public.opportunities, protocol_id uuid not null references public.protocols, actor_id uuid not null default auth.uid() references public.profiles, evaluated_at timestamptz not null default now(), commercial_fit boolean not null default false, technical_fit boolean not null default false, active_demand boolean not null default false, buyer_approved boolean not null default false, buyer_approval_ref text, answers jsonb not null default '{}', justification text not null, exception_authorized boolean not null default false, exception_ref text, check(not buyer_approved or length(trim(buyer_approval_ref))>0), check(not exception_authorized or length(trim(exception_ref))>0));
create table public.contracts(id uuid primary key default gen_random_uuid(), opportunity_id uuid not null unique references public.opportunities, commercial_acceptance_on date, pending_items text, signed_on date, signature_confirmed boolean not null default false, reference text, formalization_owner uuid not null default auth.uid() references public.profiles, originated_on date not null default current_date, origin text not null, acquisition_owner uuid not null references public.profiles, praxis_tracker_id text, origination_reference_months int not null default 12, origination_note text not null default 'Referência negociada; não constitui garantia contratual automática.', created_at timestamptz not null default now(), check(not signature_confirmed or (signed_on is not null and length(trim(reference))>0)), check(signed_on is null or signature_confirmed));
create table public.operations(id uuid primary key default gen_random_uuid(), opportunity_id uuid not null unique references public.opportunities, owner_id uuid not null default auth.uid() references public.profiles, status text not null default 'Aguardando preparação' check(status in ('Aguardando preparação','Preparação em andamento','Aguardando recursos da Praxis','Aguardando aprovação','Implantação agendada','Implantação em andamento','Implantação concluída','Ativação confirmada','Gravações em andamento','Suspenso','Encerrado')), blocked_by text check(blocked_by in ('Praxis','Estabelecimento','OperumData','Terceiros')), scheduled_on date, deployment_completed_at timestamptz, first_recording_at timestamptz, notes text, updated_at timestamptz not null default now(), check(status not in ('Ativação confirmada','Gravações em andamento') or first_recording_at is not null));
create table public.production(id uuid primary key default gen_random_uuid(), opportunity_id uuid not null references public.opportunities, campaign_id uuid not null references public.campaigns, recorded_on date not null, recorded_hours numeric not null check(recorded_hours>=0), accepted_hours numeric check(accepted_hours>=0 and accepted_hours<=recorded_hours), acceptance_ref text, reconciled_at timestamptz);
create table public.audit_log(id bigint generated always as identity primary key, opportunity_id uuid, company_id uuid, actor_id uuid, entity text not null, entity_id text not null, action text not null, before_data jsonb, after_data jsonb, occurred_at timestamptz not null default now());
create function private.audit() returns trigger language plpgsql security definer set search_path='' as $$
declare oldj jsonb; newj jsonb; j jsonb; lid uuid; cid uuid;
begin oldj := case when TG_OP<>'INSERT' then to_jsonb(old) end; newj := case when TG_OP<>'DELETE' then to_jsonb(new) end; j:=coalesce(newj,oldj);
 if TG_TABLE_NAME='opportunities' then lid:=(j->>'id')::uuid; cid:=(j->>'company_id')::uuid;
 elsif TG_TABLE_NAME='companies' then cid:=(j->>'id')::uuid;
 else lid:=(j->>'opportunity_id')::uuid; cid:=(j->>'company_id')::uuid; end if;
 insert into public.audit_log(opportunity_id,company_id,actor_id,entity,entity_id,action,before_data,after_data) values(lid,cid,auth.uid(),TG_TABLE_NAME,j->>'id',TG_OP,oldj,newj); return coalesce(new,old); end $$;
create function private.guard_lead() returns trigger language plpgsql set search_path='' as $$ begin
 if TG_OP='UPDATE' and not private.admin() and (new.owner_id<>old.owner_id or new.company_id<>old.company_id or new.campaign_id<>old.campaign_id or new.commercial_id is distinct from old.commercial_id) then raise exception 'Somente administrador pode alterar atribuição e campanha'; end if;
 if new.stage='Contrato assinado' and not exists(select 1 from public.contracts c where c.opportunity_id=new.id and c.signature_confirmed and c.signed_on is not null) then raise exception 'Registre primeiro a assinatura efetiva no contrato'; end if;
 if new.qualification='Pronto para reunião' and (TG_OP='INSERT' or old.qualification is distinct from new.qualification) then new.qualified_at:=now(); end if;
 return new; end $$;
create trigger guard_lead before insert or update on public.opportunities for each row execute function private.guard_lead();
create function private.guard_company() returns trigger language plpgsql set search_path='' as $$ begin if new.prospecting_owner<>old.prospecting_owner and not private.admin() then raise exception 'Atribuição restrita ao administrador'; end if; return new; end $$;
create trigger guard_company before update on public.companies for each row execute function private.guard_company();
create function private.guard_contract() returns trigger language plpgsql set search_path='' as $$
declare pid uuid; needs boolean;
begin
 if TG_OP='UPDATE' and (new.originated_on<>old.originated_on or new.origin<>old.origin or new.acquisition_owner<>old.acquisition_owner or new.opportunity_id<>old.opportunity_id) then raise exception 'Originação é imutável'; end if;
 if new.signature_confirmed then
 select p.id,p.praxis_approval_required into pid,needs from public.protocols p join public.opportunities o on o.campaign_id=p.campaign_id where o.id=new.opportunity_id order by p.version desc limit 1;
 if pid is null then raise exception 'Campanha sem protocolo vigente'; end if;
 if not exists(select 1 from public.evaluations e where e.opportunity_id=new.opportunity_id and e.protocol_id=pid and (e.technical_fit or e.exception_authorized) and e.commercial_fit and e.active_demand and (not needs or e.buyer_approved)) then raise exception 'Elegibilidade e aprovação formal vigente pendentes'; end if;
 end if; return new; end $$;
create trigger guard_contract before insert or update on public.contracts for each row execute function private.guard_contract();
create function private.guard_operation() returns trigger language plpgsql set search_path='' as $$ begin
 if not exists(select 1 from public.contracts where opportunity_id=new.opportunity_id and signature_confirmed) then raise exception 'Operação exige contrato assinado'; end if;
 new.updated_at:=now(); return new; end $$;
create trigger guard_operation before insert or update on public.operations for each row execute function private.guard_operation();
create function private.guard_evaluation() returns trigger language plpgsql set search_path='' as $$
declare p public.protocols; c public.companies;
begin
 select p0.* into p from public.protocols p0 join public.opportunities o on o.campaign_id=p0.campaign_id where p0.id=new.protocol_id and o.id=new.opportunity_id;
 if p.id is null then raise exception 'Protocolo não pertence à campanha'; end if;
 select c0.* into c from public.companies c0 join public.opportunities o on o.company_id=c0.id where o.id=new.opportunity_id;
 if new.technical_fit and not new.exception_authorized and (coalesce(c.participants,0)<p.min_participants or not coalesce((new.answers->>'company_active')::boolean,false) or not coalesce((new.answers->>'compatible_activity')::boolean,false) or not coalesce((new.answers->>'professional_environment')::boolean,false) or not coalesce((new.answers->>'authorization')::boolean,false) or not coalesce((new.answers->>'safety')::boolean,false) or (p.two_tasks and not coalesce((new.answers->>'two_tasks')::boolean,false)) or (p.outside_home and not coalesce((new.answers->>'outside_home')::boolean,false)) or (p.presentation_video and not coalesce((new.answers->>'presentation_video')::boolean,false))) then raise exception 'Critérios técnicos não atendidos; registre pendências ou exceção autorizada'; end if;
 return new; end $$;
create trigger guard_evaluation before insert on public.evaluations for each row execute function private.guard_evaluation();
-- RLS: nenhuma política usa metadados editáveis pelo usuário.
alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or private.admin());
create policy profiles_admin on public.profiles for all to authenticated using(private.admin()) with check(private.admin());
do $$ declare t text; begin
 foreach t in array array['categories','buyers','campaigns','protocols'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy reference_read on public.%I for select to authenticated using(private.role() is not null)',t);
 execute format('create policy reference_insert on public.%I for insert to authenticated with check(private.admin())',t);
 if t<>'protocols' then execute format('create policy reference_update on public.%I for update to authenticated using(private.admin()) with check(private.admin())',t); end if;
 end loop;
end $$;
alter table public.companies enable row level security;
create policy companies_read on public.companies for select to authenticated using(private.access_company(id));
create policy companies_insert on public.companies for insert to authenticated with check(private.role() is not null and (prospecting_owner=auth.uid() or private.admin()));
create policy companies_update on public.companies for update to authenticated using(private.access_company(id)) with check(private.access_company(id));
alter table public.opportunities enable row level security;
create policy leads_read on public.opportunities for select to authenticated using(private.access_lead(id));
create policy leads_insert on public.opportunities for insert to authenticated with check(private.role() is not null and private.access_company(company_id) and (private.admin() or (owner_id=auth.uid() and commercial_id is null)));
create policy leads_update on public.opportunities for update to authenticated using(private.access_lead(id)) with check(private.access_lead(id));
alter table public.contacts enable row level security;
create policy contacts_read on public.contacts for select to authenticated using(private.access_company(company_id));
create policy contacts_insert on public.contacts for insert to authenticated with check(private.access_company(company_id));
create policy contacts_update on public.contacts for update to authenticated using(private.access_company(company_id)) with check(private.access_company(company_id));
do $$ declare t text; begin
 foreach t in array array['activities','tasks','meetings'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy child_read on public.%I for select to authenticated using(private.access_lead(opportunity_id))',t);
 execute format('create policy child_insert on public.%I for insert to authenticated with check(private.access_lead(opportunity_id) and %I=auth.uid())',t,case when t='activities' then 'actor_id' else 'owner_id' end);
 if t<>'activities' then execute format('create policy child_update on public.%I for update to authenticated using(private.access_lead(opportunity_id)) with check(private.access_lead(opportunity_id))',t); end if;
 end loop;
 foreach t in array array['evaluations','contracts','operations','production'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy commercial_read on public.%I for select to authenticated using(private.commercial(opportunity_id))',t);
 execute format('create policy commercial_insert on public.%I for insert to authenticated with check(private.commercial(opportunity_id))',t);
 if t<>'evaluations' then execute format('create policy commercial_update on public.%I for update to authenticated using(private.commercial(opportunity_id)) with check(private.commercial(opportunity_id))',t); end if;
 end loop;
end $$;
alter table public.audit_log enable row level security;
create policy audit_read on public.audit_log for select to authenticated using(private.admin() or (entity in ('companies','contacts','opportunities','activities','tasks','meetings') and (private.access_lead(opportunity_id) or private.access_company(company_id))) or (entity in ('evaluations','contracts','operations','production') and private.commercial(opportunity_id)));
-- Sem DELETE no cliente. Retenção/anonimização: procedimento administrativo documentado.
revoke all on all tables in schema public from anon,authenticated;
grant select,insert,update on public.profiles,public.categories,public.buyers,public.campaigns,public.companies,public.contacts,public.opportunities,public.tasks,public.meetings,public.contracts,public.operations,public.production to authenticated;
grant select,insert on public.protocols,public.activities,public.evaluations to authenticated;
grant select on public.audit_log to authenticated;
revoke all on all functions in schema private from public;
grant execute on function private.role(),private.admin(),private.access_company(uuid),private.access_lead(uuid),private.commercial(uuid) to authenticated;
do $$ declare t text; begin foreach t in array array['companies','contacts','opportunities','activities','tasks','meetings','evaluations','contracts','operations','production','profiles','categories','campaigns','protocols'] loop execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit()',t); end loop; end $$;
create index leads_owner_idx on public.opportunities(owner_id,stage);
create index leads_commercial_idx on public.opportunities(commercial_id);
create index leads_campaign_idx on public.opportunities(campaign_id);
create index company_owner_idx on public.companies(prospecting_owner);
create index company_name_idx on public.companies(lower(legal_name));
create index company_phone_idx on public.companies(phone);
create index contacts_company_idx on public.contacts(company_id);
create index activities_lead_idx on public.activities(opportunity_id,occurred_at desc);
create index tasks_due_idx on public.tasks(due_at) where not done;
create index meetings_date_idx on public.meetings(starts_at);
create index evaluations_lead_idx on public.evaluations(opportunity_id,evaluated_at desc);
create index audit_lead_idx on public.audit_log(opportunity_id,occurred_at desc);
insert into public.buyers(name) values ('Praxis Robotics');
insert into public.campaigns(buyer_id,name,starts_on) select id,'Praxis Robotics — Prospecção inicial','2026-10-29' from public.buyers;
insert into public.protocols(campaign_id,version,criteria) select id,1,'{"nota":"Mínimo de cinco em discussão desde 28/10/2026; configurável por nova versão. Aprovação individual da Praxis obrigatória."}' from public.campaigns;
insert into public.categories(name,priority) values ('Energia e utilidades',1),('Impressão e design',1),('Oficinas criativas',1),('Vestuário e moda',1),('Limpeza especializada',1),('Construção comercial',2),('Agricultura',2),('Eventos e audiovisual',2),('Varejo especializado',2),('Reparos comerciais',3),('Fabricação farmacêutica',3),('Outros setores',4);
