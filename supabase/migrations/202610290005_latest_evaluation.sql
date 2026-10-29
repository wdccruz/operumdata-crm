-- Só a avaliação mais recente do protocolo vigente pode autorizar assinatura.
create or replace function private.guard_contract() returns trigger language plpgsql set search_path='' as $$
declare pid uuid; needs boolean; evaluation public.evaluations;
begin
 if TG_OP='UPDATE' and (new.originated_on<>old.originated_on or new.origin<>old.origin or new.acquisition_owner<>old.acquisition_owner or new.opportunity_id<>old.opportunity_id) then raise exception 'Originação é imutável'; end if;
 if new.signature_confirmed then
 select p.id,p.praxis_approval_required into pid,needs from public.protocols p join public.opportunities o on o.campaign_id=p.campaign_id where o.id=new.opportunity_id order by p.version desc limit 1;
 if pid is null then raise exception 'Campanha sem protocolo vigente'; end if;
 select e.* into evaluation from public.evaluations e where e.opportunity_id=new.opportunity_id and e.protocol_id=pid order by e.evaluated_at desc,e.id desc limit 1;
 if evaluation.id is null or not ((evaluation.technical_fit or evaluation.exception_authorized) and evaluation.commercial_fit and evaluation.active_demand and (not needs or evaluation.buyer_approved)) then raise exception 'Elegibilidade e aprovação formal vigente pendentes'; end if;
 end if; return new; end $$;
