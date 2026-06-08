alter table public.check_ins add column if not exists count_source text not null default 'manual';
alter table public.check_ins alter column count_source set default 'manual';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'check_ins_count_source_values'
  ) then
    alter table public.check_ins
      add constraint check_ins_count_source_values check (count_source in ('scanner', 'manual'));
  end if;
end
$$;

drop policy if exists "users can update own check-ins" on public.check_ins;
create policy "users can update own check-ins"
on public.check_ins for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
