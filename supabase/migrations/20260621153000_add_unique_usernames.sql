alter table public.profiles add column if not exists username text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_username_format_check'
  ) then
    alter table public.profiles
      add constraint profiles_username_format_check
      check (username is null or username ~ '^[a-z0-9_]{3,20}$');
  end if;
end
$$;

create unique index if not exists profiles_username_unique_idx
on public.profiles (lower(username))
where username is not null;

create or replace function public.prevent_profile_username_change()
returns trigger
language plpgsql
as $$
begin
  if old.username is not null and new.username is distinct from old.username then
    raise exception 'Username cannot be changed once set.';
  end if;

  if new.username is not null then
    new.username := lower(new.username);
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profile_username_change on public.profiles;
create trigger prevent_profile_username_change
before update on public.profiles
for each row execute function public.prevent_profile_username_change();

create or replace function public.is_username_available(username_input text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select lower(trim(regexp_replace(coalesce(username_input, ''), '^@+', ''))) ~ '^[a-z0-9_]{3,20}$'
    and not exists (
      select 1
      from public.profiles
      where lower(username) = lower(trim(regexp_replace(coalesce(username_input, ''), '^@+', '')))
    );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

create or replace function public.claim_username(username_input text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_username text;
begin
  normalized_username := lower(trim(regexp_replace(coalesce(username_input, ''), '^@+', '')));

  if normalized_username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Invalid username.';
  end if;

  update public.profiles
  set username = normalized_username,
      updated_at = now()
  where id = auth.uid()
    and username is null;

  if not found then
    raise exception 'Username is already set.';
  end if;

  return normalized_username;
end;
$$;

revoke all on function public.claim_username(text) from public;
grant execute on function public.claim_username(text) to authenticated;

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_username text;
  display_name text;
begin
  normalized_username := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', ''), '^@+', ''));
  display_name := nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), '');

  insert into public.profiles (id, display_name, username, avatar)
  values (
    new.id,
    coalesce(display_name, 'Pintly User'),
    nullif(normalized_username, ''),
    coalesce(nullif(upper(left(regexp_replace(coalesce(display_name, 'Pintly User'), '[^A-Za-z0-9]+', '', 'g'), 2)), ''), 'PU')
  )
  on conflict (id) do update
    set
      display_name = excluded.display_name,
      username = coalesce(public.profiles.username, excluded.username),
      avatar = case
        when public.profiles.avatar = 'HU' then excluded.avatar
        else public.profiles.avatar
      end,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user_profile();
