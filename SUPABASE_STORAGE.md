# Pintly Photo Storage

Pintly now stores user-uploaded image files in Cloudflare Images and keeps Supabase as the source of truth for auth, app data, and image metadata.

## Client Environment

Expo should only receive public delivery configuration:

```bash
EXPO_PUBLIC_CLOUDFLARE_IMAGES_ACCOUNT_HASH=your-cloudflare-images-account-hash
# Optional, for a custom delivery domain:
# EXPO_PUBLIC_CLOUDFLARE_IMAGES_DELIVERY_BASE_URL=https://imagedelivery.net/your-account-hash
```

Do not put Cloudflare API tokens in Expo `.env` or EAS public env values.

## Server Secrets

Set these as Supabase Edge Function secrets:

```bash
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_IMAGES_API_TOKEN=your-cloudflare-images-api-token
CLOUDFLARE_IMAGES_ACCOUNT_HASH=your-cloudflare-images-account-hash
```

Deploy these functions:

```bash
supabase functions deploy create-cloudflare-image-upload
supabase functions deploy delete-cloudflare-image
```

## Upload Flow

1. The signed-in app asks `create-cloudflare-image-upload` for a one-time Direct Creator Upload URL.
2. The Edge Function validates the user, image type, file size, and group/record ownership where applicable.
3. The app uploads the local image directly to Cloudflare using the one-time URL.
4. Supabase stores only metadata: Cloudflare image ID, image type, owner, related check-in/group, dimensions, blurhash placeholder, and delivery URL.

Existing Supabase Storage URLs and paths still render as legacy fallbacks. Do not delete old Supabase Storage objects until a verified backfill has migrated them to Cloudflare Images.
