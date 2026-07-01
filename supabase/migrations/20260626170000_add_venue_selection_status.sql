alter table public.check_ins add column if not exists venue_confirmed boolean not null default false;
alter table public.check_ins add column if not exists venue_selection_status text not null default 'skipped';

alter table public.check_ins alter column venue_confirmed set default false;
alter table public.check_ins alter column venue_selection_status set default 'skipped';

update public.check_ins
set
  venue_confirmed = venue_confirmation_status = 'confirmed',
  venue_selection_status = case
    when venue_confirmation_status = 'confirmed' then 'confirmed'
    when venue_confirmation_status = 'unavailable' then 'unavailable'
    else 'skipped'
  end
where venue_selection_status is null
  or venue_selection_status not in ('confirmed', 'changed', 'skipped', 'unavailable')
  or (venue_selection_status = 'skipped' and venue_confirmation_status in ('confirmed', 'unavailable'));

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'check_ins_venue_selection_status_values'
  ) then
    alter table public.check_ins
      add constraint check_ins_venue_selection_status_values check (venue_selection_status in ('confirmed', 'changed', 'skipped', 'unavailable'));
  end if;
end
$$;
