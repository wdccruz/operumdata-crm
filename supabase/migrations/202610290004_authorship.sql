create function private.guard_authorship() returns trigger language plpgsql set search_path='' as $$
declare j jsonb:=to_jsonb(new); oldj jsonb;
begin
 if TG_OP='INSERT' then
 if j ? 'actor_id' and (j->>'actor_id')::uuid<>auth.uid() then raise exception 'Autoria deve ser do usuário autenticado'; end if;
 if not private.admin() and ((j ? 'owner_id' and (j->>'owner_id')::uuid<>auth.uid()) or (j ? 'formalization_owner' and (j->>'formalization_owner')::uuid<>auth.uid())) then raise exception 'Responsável inicial deve ser o usuário autenticado'; end if;
 else
 oldj:=to_jsonb(old);
 if not private.admin() and (j->>'formalization_owner' is distinct from oldj->>'formalization_owner') then raise exception 'Formalizador protegido'; end if;
 end if;
 return new;
end $$;
do $$ declare t text; begin foreach t in array array['activities','tasks','meetings','evaluations','contracts','operations'] loop execute format('create trigger guard_authorship before insert or update on public.%I for each row execute function private.guard_authorship()',t); end loop; end $$;
revoke all on function private.guard_authorship() from public;
create trigger audit_change after insert or update or delete on public.buyers for each row execute function private.audit();
