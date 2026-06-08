# Supabase Setup

## 1. Create a Project

Create a Supabase project from the Supabase Dashboard. After it finishes provisioning, open the project's API settings.

Copy these public client values into a local `.env` file:

```sh
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-or-anon-key
EXPO_PUBLIC_SUPABASE_PHOTO_BUCKET=beer-photos
EXPO_PUBLIC_SUPABASE_PROFILE_PHOTO_BUCKET=profile-photos
EXPO_PUBLIC_SUPABASE_GROUP_BACKDROP_BUCKET=group-backdrops
```

The app also supports `EXPO_PUBLIC_SUPABASE_ANON_KEY` if your dashboard labels the public client key that way.

Do not put the service role key in the Expo app. It is server-only.

## 2. Auth

Supabase Auth is used for account creation and sign-in. Email/password auth should be enabled by default.

For friend testing, decide whether email confirmation should be required:

- Confirmation on: safer, but testers must confirm email before signing in.
- Confirmation off: easier for early testing with friends.

## 3. Storage

Create three private Storage buckets:

- `beer-photos` for beer check-in photos.
- `profile-photos` for user profile pictures.
- `group-backdrops` for custom group hero images.

Pintly uploads photos to private storage and creates short-lived signed URLs for rendering inside the app.

After the buckets exist, add these policies in the Supabase SQL Editor:

```sql
drop policy if exists "authenticated users can upload beer photos" on storage.objects;
create policy "authenticated users can upload beer photos"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'beer-photos');

drop policy if exists "authenticated users can read beer photos" on storage.objects;
create policy "authenticated users can read beer photos"
on storage.objects
for select
to authenticated
using (bucket_id = 'beer-photos');

drop policy if exists "authenticated users can upload profile photos" on storage.objects;
create policy "authenticated users can upload profile photos"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'profile-photos');

drop policy if exists "authenticated users can read profile photos" on storage.objects;
create policy "authenticated users can read profile photos"
on storage.objects
for select
to authenticated
using (bucket_id = 'profile-photos');

drop policy if exists "authenticated users can upload group backdrops" on storage.objects;
create policy "authenticated users can upload group backdrops"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'group-backdrops');

drop policy if exists "authenticated users can read group backdrops" on storage.objects;
create policy "authenticated users can read group backdrops"
on storage.objects
for select
to authenticated
using (bucket_id = 'group-backdrops');
```

## 4. Shared App Data

Run `supabase_schema.sql` in the Supabase SQL Editor. This creates the profile, group, join request, check-in, reaction, and global count tables/RPCs with Row Level Security policies.

This step is required for testers to see shared groups, shared group activity, approvals, and the app-wide global beer count. Without it, the app still opens and saves locally, but Supabase group/check-in sync will fail in the background.

## 5. Restart Expo

Expo reads public env vars at bundle time. After editing `.env`, restart the dev server:

```sh
npx expo start --clear
```
