drop policy if exists "requesters can cancel pending join requests" on public.group_join_requests;
create policy "requesters can cancel pending join requests"
on public.group_join_requests for update
to authenticated
using (
  user_id = (select auth.uid())
  and status = 'pending'
)
with check (
  user_id = (select auth.uid())
  and status = 'rejected'
);
