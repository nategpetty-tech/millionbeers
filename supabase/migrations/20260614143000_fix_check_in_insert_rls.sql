drop policy if exists "users can create own check-ins" on public.check_ins;
create policy "users can create own check-ins"
on public.check_ins for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "users can update own check-ins" on public.check_ins;
create policy "users can update own check-ins"
on public.check_ins for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "users can delete own check-ins" on public.check_ins;
create policy "users can delete own check-ins"
on public.check_ins for delete
to authenticated
using (user_id = auth.uid());
