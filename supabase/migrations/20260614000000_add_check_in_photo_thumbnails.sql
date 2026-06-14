alter table public.check_ins add column if not exists photo_thumbnail_url text;
alter table public.check_ins add column if not exists photo_thumbnail_storage_path text;
