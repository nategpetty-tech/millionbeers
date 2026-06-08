# Supabase Photo Storage

Pintly uploads check-in photos to Supabase Storage when these Expo public env vars are present:

```sh
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-or-anon-key
EXPO_PUBLIC_SUPABASE_PHOTO_BUCKET=beer-photos
EXPO_PUBLIC_SUPABASE_PROFILE_PHOTO_BUCKET=profile-photos
EXPO_PUBLIC_SUPABASE_GROUP_BACKDROP_BUCKET=group-backdrops
```

## Bucket

Create three private Supabase Storage buckets:

- `beer-photos` for check-in photos.
- `profile-photos` for profile pictures.
- `group-backdrops` for custom group hero images.

The app uploads photos to private storage and creates short-lived signed URLs while a signed-in tester is using Pintly. Direct public object URLs are not required.

The app also accepts `EXPO_PUBLIC_SUPABASE_ANON_KEY` as a fallback if your Supabase dashboard still labels the public client key as an anon key.

## Current App Flow

1. The user takes a photo in the check-in modal.
2. The app uploads the local file to `beer-photos/{userId}/{yyyy-mm-dd}/{timestamp}.jpg`.
3. The check-in stores:
   - `photoUri` for local fallback.
   - `photoUrl` as a temporary signed URL for immediate rendering.
   - `photoStoragePath` for refreshing signed URLs later.
4. If upload fails, the check-in is not logged so a stamp is not created without its photo.

Profile photos upload to `profile-photos/{userId}/{timestamp}.jpg` and store the signed URL on the user's profile row for app display.

Group backdrops upload to `group-backdrops/{userId}/{timestamp}.jpg` and store the signed URL on the group row for app display.

## Storage Policies

Run these in the Supabase SQL editor after creating all three private buckets:

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

## Production Notes

- Signed URL creation currently depends on authenticated read access to the bucket. Tighten this further with a server-side signed URL endpoint once group privacy matters at larger scale.
- Add a server-side delete path when users delete check-ins.
- Resize/compress images before upload if mobile bandwidth becomes annoying.
