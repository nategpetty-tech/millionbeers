# Supabase Setup

## 1. Create a Project

Create a Supabase project from the Supabase Dashboard. After it finishes provisioning, open the project's API settings.

Copy these public client values into a local `.env` file:

```sh
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-or-anon-key
EXPO_PUBLIC_CLOUDFLARE_IMAGES_ACCOUNT_HASH=your-cloudflare-images-account-hash
```

The app also supports `EXPO_PUBLIC_SUPABASE_ANON_KEY` if your dashboard labels the public client key that way.

Do not put the service role key in the Expo app. It is server-only.

## 2. Auth

Supabase Auth is used for account creation and sign-in. Email/password auth should be enabled by default.

For friend testing, decide whether email confirmation should be required:

- Confirmation on: safer, but testers must confirm email before signing in.
- Confirmation off: easier for early testing with friends.

## 3. Storage

Pintly uses Cloudflare Images for user-uploaded photos. Supabase stores metadata only. See `SUPABASE_STORAGE.md` for Cloudflare setup, Edge Function secrets, and the upload flow.

## 4. Shared App Data

Run `supabase_schema.sql` in the Supabase SQL Editor. This creates the profile, group, join request, check-in, reaction, and global count tables/RPCs with Row Level Security policies.

This step is required for testers to see shared groups, shared group activity, approvals, and the app-wide global beer count. Without it, the app still opens and saves locally, but Supabase group/check-in sync will fail in the background.

## 5. Beer Photo Scanner

Deploy the Supabase Edge Function that counts visible beers in check-in photos:

```sh
supabase functions deploy scan-beer-photo
supabase secrets set OPENAI_API_KEY=sk-your-server-side-key
```

The scanner returns a suggested beer count, confidence, and normalized detection boxes that Pintly draws over the photo preview. The function defaults to `gpt-4o-mini`. To use a different OpenAI vision-capable model, set:

```sh
supabase secrets set OPENAI_VISION_MODEL=gpt-4o-mini
```

Keep `OPENAI_API_KEY` out of Expo `.env` files. The mobile app calls the Supabase function, and the function calls OpenAI from the server side.

## 6. Venue Suggestions

Deploy the nearby venue Edge Function and set the Foursquare key as a Supabase secret:

```sh
supabase functions deploy search-nearby-venues
supabase secrets set FOURSQUARE_API_KEY=your-foursquare-places-api-key
```

Keep `FOURSQUARE_API_KEY` out of Expo `.env` files. The app sends only GPS coordinates to the Supabase function.

## 7. Restart Expo

Expo reads public env vars at bundle time. After editing `.env`, restart the dev server:

```sh
npx expo start --clear
```
