-- Chaves de servidor também precisam de privilégios SQL explícitos. BYPASSRLS
-- não concede SELECT/INSERT por si só. Nunca usar service_role no navegador.
grant usage on schema public to service_role;
grant select,insert,update,delete on public.profiles,public.categories,public.buyers,public.campaigns,public.protocols,public.companies,public.opportunities,public.contacts,public.activities,public.tasks,public.meetings,public.evaluations,public.contracts,public.operations,public.production,public.audit_log to service_role;
grant usage,select on sequence public.audit_log_id_seq to service_role;
