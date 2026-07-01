-- App Review demo seed for Pintly.
-- Run this in the Supabase SQL Editor after creating the demo login account.
-- Change this email if your App Review demo account uses a different address.

do $$
declare
  demo_email text := 'apple.review+pintly@example.com';
  demo_user_id uuid;
  maya_id uuid := '00000000-0000-4000-8000-000000000101';
  jordan_id uuid := '00000000-0000-4000-8000-000000000102';
  sam_id uuid := '00000000-0000-4000-8000-000000000103';
  riley_id uuid := '00000000-0000-4000-8000-000000000104';
  chicago_group_id uuid := '00000000-0000-4000-8000-000000000201';
  afterwork_group_id uuid := '00000000-0000-4000-8000-000000000202';
  passport_group_id uuid := '00000000-0000-4000-8000-000000000203';
  river_venue_id uuid := '00000000-0000-4000-8000-000000000301';
  logan_venue_id uuid := '00000000-0000-4000-8000-000000000302';
  foundry_venue_id uuid := '00000000-0000-4000-8000-000000000303';
  prairie_venue_id uuid := '00000000-0000-4000-8000-000000000304';
  review_checkin_1 uuid := '00000000-0000-4000-8000-000000000401';
  review_checkin_2 uuid := '00000000-0000-4000-8000-000000000402';
  maya_checkin uuid := '00000000-0000-4000-8000-000000000403';
  jordan_checkin uuid := '00000000-0000-4000-8000-000000000404';
  sam_checkin uuid := '00000000-0000-4000-8000-000000000405';
begin
  select id into demo_user_id from auth.users where lower(email) = lower(demo_email) limit 1;

  if demo_user_id is null then
    raise exception 'No auth.users row found for %. Create the demo account first, then rerun this seed.', demo_email;
  end if;

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values
    (maya_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'app-review-maya@pintly.demo', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Maya"}'::jsonb, now(), now()),
    (jordan_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'app-review-jordan@pintly.demo', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Jordan"}'::jsonb, now(), now()),
    (sam_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'app-review-sam@pintly.demo', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Sam"}'::jsonb, now(), now()),
    (riley_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'app-review-riley@pintly.demo', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Riley"}'::jsonb, now(), now())
  on conflict (id) do nothing;

  insert into public.profiles (id, display_name, username, avatar)
  values
    (demo_user_id, 'Pintly Reviewer', 'pintlyreview', 'PR'),
    (maya_id, 'Maya Kim', 'maya_pints', 'MK'),
    (jordan_id, 'Jordan Reed', 'jordan_hops', 'JR'),
    (sam_id, 'Sam Chen', 'sam_taps', 'SC'),
    (riley_id, 'Riley Brooks', 'riley_brews', 'RB')
  on conflict (id) do update
  set
    display_name = excluded.display_name,
    username = coalesce(public.profiles.username, excluded.username),
    avatar = excluded.avatar,
    updated_at = now();

  delete from public.check_in_reactions where check_in_id in (review_checkin_1, review_checkin_2, maya_checkin, jordan_checkin, sam_checkin);
  delete from public.check_in_groups where check_in_id in (review_checkin_1, review_checkin_2, maya_checkin, jordan_checkin, sam_checkin);
  delete from public.check_ins where id in (review_checkin_1, review_checkin_2, maya_checkin, jordan_checkin, sam_checkin);
  delete from public.group_join_requests where group_id in (chicago_group_id, afterwork_group_id, passport_group_id);
  delete from public.group_memberships where group_id in (chicago_group_id, afterwork_group_id, passport_group_id);
  delete from public.groups where id in (chicago_group_id, afterwork_group_id, passport_group_id);
  delete from public.venues where id in (river_venue_id, logan_venue_id, foundry_venue_id, prairie_venue_id);

  insert into public.venues (id, provider, provider_place_id, name, category, latitude, longitude, address, city, state, country)
  values
    (river_venue_id, 'foursquare', 'review-river-north-taproom', 'River North Taproom', 'Brewery', 41.8840, -87.6320, 'Demo venue near River North', 'Chicago', 'IL', 'US'),
    (logan_venue_id, 'foursquare', 'review-logan-beer-garden', 'Logan Square Beer Garden', 'Beer Garden', 41.9100, -87.6770, 'Demo venue near Logan Square', 'Chicago', 'IL', 'US'),
    (foundry_venue_id, 'foursquare', 'review-foundry-barrel-house', 'Foundry Barrel House', 'Taproom', 42.0450, -87.6880, 'Demo venue near Evanston', 'Evanston', 'IL', 'US'),
    (prairie_venue_id, 'foursquare', 'review-prairie-path-brewing', 'Prairie Path Brewing', 'Brewery', 41.8850, -87.7840, 'Demo venue near Oak Park', 'Oak Park', 'IL', 'US')
  on conflict (provider, provider_place_id) do update
  set name = excluded.name,
      category = excluded.category,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      address = excluded.address,
      city = excluded.city,
      state = excluded.state,
      country = excluded.country,
      updated_at = now();

  insert into public.groups (id, name, description, image, backdrop_url, privacy, goal, founder_id, invite_code, created_at)
  values
    (chicago_group_id, 'Chicago Tap Crew', 'Weekend brewery visits around the city.', 'CT', 'https://images.unsplash.com/photo-1559526324-593bc073d938?auto=format&fit=crop&w=1200&q=80', 'Invite Only', 250, demo_user_id, 'TAPCREW', now() - interval '36 days'),
    (afterwork_group_id, 'After Work Pints', 'Low-key check-ins after the laptop closes.', 'AW', 'https://images.unsplash.com/photo-1518176258769-f227c798150e?auto=format&fit=crop&w=1200&q=80', 'Private', 100, maya_id, 'AFTER5', now() - interval '18 days'),
    (passport_group_id, 'Brewery Passport', 'Taprooms, patios, and beer gardens.', 'BP', 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=1200&q=80', 'Public', 500, jordan_id, 'PASSPORT', now() - interval '62 days');

  insert into public.group_memberships (group_id, user_id, role)
  values
    (chicago_group_id, demo_user_id, 'founder'),
    (chicago_group_id, maya_id, 'member'),
    (chicago_group_id, jordan_id, 'member'),
    (chicago_group_id, sam_id, 'member'),
    (afterwork_group_id, demo_user_id, 'member'),
    (afterwork_group_id, maya_id, 'founder'),
    (afterwork_group_id, jordan_id, 'member'),
    (afterwork_group_id, sam_id, 'member'),
    (passport_group_id, demo_user_id, 'member'),
    (passport_group_id, maya_id, 'member'),
    (passport_group_id, jordan_id, 'founder'),
    (passport_group_id, sam_id, 'member')
  on conflict do nothing;

  insert into public.group_join_requests (id, group_id, user_id, source, status, requested_at)
  values ('00000000-0000-4000-8000-000000000501', chicago_group_id, riley_id, 'invite', 'pending', now() - interval '8 hours')
  on conflict (group_id, user_id) do update
  set status = excluded.status,
      requested_at = excluded.requested_at;

  insert into public.friendships (user_id, friend_id)
  values
    (demo_user_id, maya_id), (maya_id, demo_user_id),
    (demo_user_id, jordan_id), (jordan_id, demo_user_id),
    (demo_user_id, sam_id), (sam_id, demo_user_id)
  on conflict do nothing;

  insert into public.check_ins (
    id, user_id, beer_name, brewery, style, quantity, abv, rating, city, state, country, latitude, longitude,
    venue_id, venue_provider, venue_provider_place_id, venue_name, venue_category, venue_latitude, venue_longitude,
    venue_address, venue_distance_meters, venue_confirmation_status, note, photo_url, count_source, created_at
  )
  values
    (review_checkin_1, demo_user_id, 'Hazy River IPA', 'River North Brewing', 'IPA', 1, 6.8, 4.5, 'Chicago', 'IL', 'US', 41.8840, -87.6320, river_venue_id, 'foursquare', 'review-river-north-taproom', 'River North Taproom', 'Brewery', 41.8840, -87.6320, 'Demo venue near River North', 42, 'confirmed', 'Great patio pour before dinner.', 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1200&q=80', 'manual', now() - interval '2 hours'),
    (review_checkin_2, demo_user_id, 'Citrus Wheat', 'Prairie Path Brewing', 'Wheat', 1, 5.4, 4.0, 'Oak Park', 'IL', 'US', 41.8850, -87.7840, prairie_venue_id, 'foursquare', 'review-prairie-path-brewing', 'Prairie Path Brewing', 'Brewery', 41.8850, -87.7840, 'Demo venue near Oak Park', 34, 'confirmed', 'Easy win after the train ride.', 'https://images.unsplash.com/photo-1571613316887-6f8d5cbf7ef7?auto=format&fit=crop&w=1200&q=80', 'manual', now() - interval '2 days'),
    (maya_checkin, maya_id, 'Patio Pils', 'Lakefront Lager Co.', 'Pilsner', 2, 5.1, 4.0, 'Chicago', 'IL', 'US', 41.9100, -87.6770, logan_venue_id, 'foursquare', 'review-logan-beer-garden', 'Logan Square Beer Garden', 'Beer Garden', 41.9100, -87.6770, 'Demo venue near Logan Square', 55, 'confirmed', 'Crisp, sunny, exactly the vibe.', 'https://images.unsplash.com/photo-1532634786-c8f8c1a006db?auto=format&fit=crop&w=1200&q=80', 'manual', now() - interval '5 hours'),
    (jordan_checkin, jordan_id, 'Midnight Porter', 'Foundry Barrel House', 'Porter', 1, 6.2, 4.25, 'Evanston', 'IL', 'US', 42.0450, -87.6880, foundry_venue_id, 'foursquare', 'review-foundry-barrel-house', 'Foundry Barrel House', 'Taproom', 42.0450, -87.6880, 'Demo venue near Evanston', 48, 'confirmed', 'Roasty and smooth.', 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=1200&q=80', 'manual', now() - interval '1 day'),
    (sam_checkin, sam_id, 'West Loop Pale Ale', 'Canal Street Beer Co.', 'Pale Ale', 1, 5.8, 4.0, 'Chicago', 'IL', 'US', 41.8830, -87.6500, null, null, null, null, null, null, null, null, null, 'skipped', 'After-work round with the crew.', 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=1200&q=80', 'manual', now() - interval '10 hours');

  insert into public.check_in_groups (check_in_id, group_id)
  values
    (review_checkin_1, chicago_group_id),
    (review_checkin_1, passport_group_id),
    (review_checkin_2, passport_group_id),
    (maya_checkin, chicago_group_id),
    (maya_checkin, afterwork_group_id),
    (jordan_checkin, passport_group_id),
    (sam_checkin, chicago_group_id),
    (sam_checkin, afterwork_group_id)
  on conflict do nothing;

  insert into public.check_in_reactions (check_in_id, user_id)
  values
    (review_checkin_1, maya_id),
    (review_checkin_1, jordan_id),
    (review_checkin_1, sam_id),
    (review_checkin_2, sam_id),
    (maya_checkin, demo_user_id),
    (maya_checkin, jordan_id),
    (jordan_checkin, demo_user_id),
    (jordan_checkin, maya_id),
    (sam_checkin, demo_user_id)
  on conflict do nothing;

  raise notice 'Seeded App Review demo content for % (%)', demo_email, demo_user_id;
end $$;
