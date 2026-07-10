insert into public.image_uploads (
  cloudflare_image_id,
  image_type,
  owner_user_id,
  check_in_id,
  width,
  height,
  blurhash,
  delivery_url,
  created_at
)
select
  ci.photo_cloudflare_image_id,
  'beer_photo',
  ci.user_id,
  ci.id,
  ci.photo_image_width,
  ci.photo_image_height,
  ci.photo_blurhash,
  ci.photo_url,
  ci.created_at
from public.check_ins ci
where ci.photo_cloudflare_image_id is not null
on conflict (cloudflare_image_id) do update
set
  image_type = excluded.image_type,
  owner_user_id = excluded.owner_user_id,
  check_in_id = excluded.check_in_id,
  width = coalesce(public.image_uploads.width, excluded.width),
  height = coalesce(public.image_uploads.height, excluded.height),
  blurhash = coalesce(public.image_uploads.blurhash, excluded.blurhash),
  delivery_url = coalesce(public.image_uploads.delivery_url, excluded.delivery_url);
