-- V1.2: empresas parceiras isoladas por empresa e parecer da empresa no lead.
-- Empresa parceira = comprador (public.buyers). Cada lead pertence a uma campanha e cada
-- campanha a um comprador; o usuário externo passa a ser vinculado a um comprador e só lê
-- os leads das campanhas dele. O código de perfil continua 'praxis_viewer' (código estável
-- já usado nas funções de servidor); na interface ele se chama "Empresa parceira".
-- Migration incremental: nenhum registro existente é apagado.

-- 1. Vínculo do usuário externo com a empresa parceira.
alter table public.profiles add column buyer_id uuid references public.buyers;
-- Usuários de leitura existentes eram da Praxis Robotics (primeiro comprador).
update public.profiles set buyer_id=(select id from public.buyers order by (name='Praxis Robotics') desc,name limit 1)
 where role='praxis_viewer' and buyer_id is null;
alter table public.profiles add constraint profiles_partner_buyer check(role<>'praxis_viewer' or buyer_id is not null);
create index profiles_buyer_idx on public.profiles(buyer_id);

create function private.partner_buyer() returns uuid language sql stable security definer set search_path='' as $$
 select buyer_id from public.profiles where id=auth.uid() and active and role='praxis_viewer' $$;
create function private.partner_lead(lid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(exists(select 1 from public.opportunities o join public.campaigns c on c.id=o.campaign_id where o.id=lid and c.buyer_id=private.partner_buyer()),false) $$;
create function private.partner_company(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(exists(select 1 from public.opportunities o join public.campaigns c on c.id=o.campaign_id where o.company_id=cid and c.buyer_id=private.partner_buyer()),false) $$;
revoke all on function private.partner_buyer(),private.partner_lead(uuid),private.partner_company(uuid) from public;
grant execute on function private.partner_buyer(),private.partner_lead(uuid),private.partner_company(uuid) to authenticated;

-- 2. Leitura da empresa parceira restrita aos próprios leads.
-- A política permissiva viewer_read (leitura integral, migration 0007) é substituída por uma
-- versão limitada. Uma política RESTRICTIVE adicional garante o limite mesmo que outra
-- política permissiva (ex.: reference_read) libere a linha.
do $$ declare r record; begin
 for r in select * from (values
  ('buyers','id=private.partner_buyer()'),
  ('campaigns','buyer_id=private.partner_buyer()'),
  ('protocols','exists(select 1 from public.campaigns c where c.id=campaign_id and c.buyer_id=private.partner_buyer())'),
  ('companies','private.partner_company(id)'),
  ('opportunities','private.partner_lead(id)'),
  ('contacts','private.partner_company(company_id)'),
  ('company_status_history','private.partner_company(company_id)'),
  ('activities','private.partner_lead(opportunity_id)'),
  ('tasks','private.partner_lead(opportunity_id)'),
  ('meetings','private.partner_lead(opportunity_id)'),
  ('evaluations','private.partner_lead(opportunity_id)'),
  ('contracts','private.partner_lead(opportunity_id)'),
  ('operations','private.partner_lead(opportunity_id)'),
  ('production','private.partner_lead(opportunity_id)'),
  ('audit_log','private.partner_lead(opportunity_id) or (opportunity_id is null and entity in (''companies'',''contacts'') and private.partner_company(company_id))'),
  ('profiles','id=auth.uid()'),
  ('categories','true')
 ) as v(t,cond) loop
  execute format('drop policy viewer_read on public.%I',r.t);
  execute format('create policy viewer_read on public.%I for select to authenticated using(private.viewer() and (%s))',r.t,r.cond);
  execute format('create policy partner_scope on public.%I as restrictive for select to authenticated using(not private.viewer() or (%s))',r.t,r.cond);
 end loop;
end $$;

-- 3. Parecer da empresa no lead: aprovação, recusa, pedido de informações ou comentário.
-- Registro imutável (sem UPDATE/DELETE pelo cliente). A equipe pode responder com comentário.
create table public.lead_reviews(
 id uuid primary key default gen_random_uuid(),
 opportunity_id uuid not null references public.opportunities,
 buyer_id uuid not null references public.buyers,
 author_id uuid not null default auth.uid() references public.profiles,
 author_name text not null,
 author_kind text not null check(author_kind in ('partner','team')),
 decision text not null check(decision in ('approved','rejected','needs_info','comment')),
 comment text check(comment is null or length(comment)<=4000),
 created_at timestamptz not null default now(),
 constraint lead_review_comment_required check(decision='approved' or coalesce(length(trim(comment)),0)>0)
);
create index lead_reviews_lead_idx on public.lead_reviews(opportunity_id,created_at desc);

create function private.guard_lead_review() returns trigger language plpgsql security definer set search_path='' as $$
declare me public.profiles;
begin
 select * into me from public.profiles where id=auth.uid() and active;
 if me.id is null then raise exception 'Perfil ativo obrigatório' using errcode='42501'; end if;
 select c.buyer_id into new.buyer_id from public.opportunities o join public.campaigns c on c.id=o.campaign_id where o.id=new.opportunity_id;
 new.author_id:=me.id; new.author_name:=me.name; new.created_at:=now();
 if me.role='praxis_viewer' then
  if not private.partner_lead(new.opportunity_id) then raise exception 'Lead fora da empresa parceira' using errcode='42501'; end if;
  new.author_kind:='partner';
 elsif private.writer() and private.access_lead(new.opportunity_id) then
  if new.decision<>'comment' then raise exception 'Somente a empresa parceira registra aprovação ou recusa'; end if;
  new.author_kind:='team';
 else raise exception 'Acesso negado ao lead' using errcode='42501'; end if;
 return new; end $$;
create trigger guard_lead_review before insert on public.lead_reviews for each row execute function private.guard_lead_review();
create trigger audit_change after insert or update or delete on public.lead_reviews for each row execute function private.audit();
revoke all on function private.guard_lead_review() from public;

alter table public.lead_reviews enable row level security;
create policy reviews_read on public.lead_reviews for select to authenticated using(private.admin() or (private.writer() and private.access_lead(opportunity_id)) or private.partner_lead(opportunity_id));
create policy reviews_insert on public.lead_reviews for insert to authenticated with check(author_id=auth.uid() and ((author_kind='partner' and buyer_id=private.partner_buyer() and private.partner_lead(opportunity_id)) or (author_kind='team' and decision='comment' and private.writer() and private.access_lead(opportunity_id))));
revoke all on public.lead_reviews from public,anon,authenticated;
grant select,insert on public.lead_reviews to authenticated;
grant select,insert,update,delete on public.lead_reviews to service_role;

-- Último parecer decisivo (aprovado, recusado ou pedido de informações) da empresa da campanha.
create function private.partner_approved(lid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select r.decision='approved' from public.lead_reviews r join public.opportunities o on o.id=r.opportunity_id join public.campaigns c on c.id=o.campaign_id
  where r.opportunity_id=lid and r.author_kind='partner' and r.buyer_id=c.buyer_id and r.decision<>'comment' order by r.created_at desc,r.id desc limit 1),false) $$;
revoke all on function private.partner_approved(uuid) from public;
grant execute on function private.partner_approved(uuid) to authenticated;

-- 4. Aprovação registrada pela empresa no CRM vale como aprovação individual formal.
create or replace function private.guard_contract() returns trigger language plpgsql set search_path='' as $$
declare pid uuid; needs boolean; evaluation public.evaluations;
begin
 if TG_OP='UPDATE' and (new.originated_on<>old.originated_on or new.origin<>old.origin or new.acquisition_owner<>old.acquisition_owner or new.opportunity_id<>old.opportunity_id) then raise exception 'Originação é imutável'; end if;
 if new.signature_confirmed then
 select p.id,p.praxis_approval_required into pid,needs from public.protocols p join public.opportunities o on o.campaign_id=p.campaign_id where o.id=new.opportunity_id order by p.version desc limit 1;
 if pid is null then raise exception 'Campanha sem protocolo vigente'; end if;
 select e.* into evaluation from public.evaluations e where e.opportunity_id=new.opportunity_id and e.protocol_id=pid order by e.evaluated_at desc,e.id desc limit 1;
 if evaluation.id is null or not ((evaluation.technical_fit or evaluation.exception_authorized) and evaluation.commercial_fit and evaluation.active_demand and (not needs or evaluation.buyer_approved or private.partner_approved(new.opportunity_id))) then raise exception 'Elegibilidade e aprovação formal vigente pendentes'; end if;
 end if; return new; end $$;

-- 5. Totais da rede para qualquer perfil ativo: somente contagens, nenhum registro.
create function public.network_totals() returns table(total bigint,potential bigint,stock bigint,contracted bigint,recording bigint,paused bigint,high bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if private.role() is null then raise exception 'Perfil ativo obrigatório' using errcode='42501'; end if;
 return query select count(*),count(*) filter(where commercial_status='potential'),count(*) filter(where commercial_status='stock'),
  count(*) filter(where commercial_status='contracted'),count(*) filter(where operational_status='recording'),count(*) filter(where operational_status='paused'),count(*) filter(where strategic_importance='high')
 from public.companies;
end $$;
revoke all on function public.network_totals() from public;
do $$ begin if exists(select 1 from pg_roles where rolname='anon') then revoke all on function public.network_totals() from anon; end if; end $$;
grant execute on function public.network_totals() to authenticated;
