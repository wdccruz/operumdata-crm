-- Convites manuais sem vencimento automático. Apenas o hash do segredo é persistido.
create table public.access_activations(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 used_at timestamptz, revoked_at timestamptz,
 claim_id uuid, claimed_at timestamptz
);
alter table public.access_activations enable row level security;
revoke all on public.access_activations from public,anon,authenticated;
grant select,insert,update,delete on public.access_activations to service_role;
create index access_activation_user_idx on public.access_activations(user_id);
create function public.claim_access_activation(p_hash text,p_claim uuid)
returns table(id uuid,user_id uuid) language sql security definer set search_path='' as $$
 update public.access_activations a set claim_id=p_claim,claimed_at=now()
 where a.token_hash=p_hash and a.used_at is null and a.revoked_at is null
 and (a.claim_id is null or a.claimed_at<now()-interval '2 minutes')
 returning a.id,a.user_id;
$$;
create function public.finish_access_activation(p_id uuid,p_claim uuid)
returns boolean language sql security definer set search_path='' as $$
 with changed as(update public.access_activations set used_at=now(),claim_id=null,claimed_at=null
 where id=p_id and claim_id=p_claim and used_at is null and revoked_at is null returning id)
 select exists(select 1 from changed);
$$;
create function public.release_access_activation(p_id uuid,p_claim uuid)
returns void language sql security definer set search_path='' as $$
 update public.access_activations set claim_id=null,claimed_at=null
 where id=p_id and claim_id=p_claim and used_at is null;
$$;
revoke all on function public.claim_access_activation(text,uuid),public.finish_access_activation(uuid,uuid),public.release_access_activation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_access_activation(text,uuid),public.finish_access_activation(uuid,uuid),public.release_access_activation(uuid,uuid) to service_role;
