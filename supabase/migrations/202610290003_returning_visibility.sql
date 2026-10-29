-- SELECT aplicado também a INSERT RETURNING: novos registros precisam ser visíveis
-- por sua própria atribuição antes de consultas auxiliares encontrarem a linha.
drop policy companies_read on public.companies;
create policy companies_read on public.companies for select to authenticated using(private.admin() or (private.role() is not null and prospecting_owner=auth.uid()) or private.access_company(id));
drop policy leads_read on public.opportunities;
create policy leads_read on public.opportunities for select to authenticated using(private.admin() or (private.role() is not null and (owner_id=auth.uid() or (private.role()='commercial' and commercial_id=auth.uid()))));
