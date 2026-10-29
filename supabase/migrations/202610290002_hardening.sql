-- Defense in depth: referenced parents and attribution cannot be moved through child writes.
create function private.guard_child() returns trigger language plpgsql set search_path='' as $$
declare j jsonb:=to_jsonb(new); oldj jsonb; cid uuid;
begin
 if TG_OP='UPDATE' then
 oldj:=to_jsonb(old);
 if j->>'opportunity_id' is distinct from oldj->>'opportunity_id' or j->>'company_id' is distinct from oldj->>'company_id' then raise exception 'Vínculo do registro é imutável'; end if;
 if not private.admin() and (j->>'owner_id' is distinct from oldj->>'owner_id' or j->>'actor_id' is distinct from oldj->>'actor_id') then raise exception 'Autoria e responsável protegidos'; end if;
 end if;
 if TG_TABLE_NAME='meetings' and j->>'contact_id' is not null then
 select company_id into cid from public.opportunities where id=new.opportunity_id;
 if not exists(select 1 from public.contacts where id=(j->>'contact_id')::uuid and company_id=cid) then raise exception 'Contato não pertence à empresa da reunião'; end if;
 end if;
 return new; end $$;
do $$ declare t text; begin foreach t in array array['contacts','tasks','meetings','contracts','operations','production'] loop execute format('create trigger guard_child before insert or update on public.%I for each row execute function private.guard_child()',t); end loop; end $$;
-- Corrige semântica SQL de NULL em campos condicionais obrigatórios.
alter table public.opportunities drop constraint opportunities_check;
alter table public.opportunities add constraint opportunity_reason_required check((stage<>'Perdido' and qualification is distinct from 'Não elegível') or coalesce(length(trim(reason)),0)>0);
alter table public.evaluations add constraint approval_reference_required check(not buyer_approved or coalesce(length(trim(buyer_approval_ref)),0)>0);
alter table public.evaluations add constraint exception_reference_required check(not exception_authorized or coalesce(length(trim(exception_ref)),0)>0);
alter table public.contracts add constraint signature_reference_required check(not signature_confirmed or coalesce(length(trim(reference)),0)>0);
create function private.guard_profile() returns trigger language plpgsql set search_path='' as $$ begin
 if old.role='admin' and old.active and (new.role<>'admin' or not new.active) and not exists(select 1 from public.profiles where id<>old.id and role='admin' and active) then raise exception 'Mantenha ao menos um administrador ativo'; end if;
 return new; end $$;
create trigger guard_profile before update on public.profiles for each row execute function private.guard_profile();
revoke all on function private.guard_child(),private.guard_profile() from public;
