const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const cloudflareToken = process.env.CLOUDFLARE_IMAGES_API_TOKEN;
const cloudflareAccountHash = process.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH ?? process.env.EXPO_PUBLIC_CLOUDFLARE_IMAGES_ACCOUNT_HASH;
const dryRun = process.env.CLOUDFLARE_BACKFILL_DRY_RUN !== "false";
const limit = Number(process.env.CLOUDFLARE_BACKFILL_LIMIT ?? 25);

const buckets = {
  beerPhoto: process.env.EXPO_PUBLIC_SUPABASE_PHOTO_BUCKET ?? "beer-photos",
  profilePhoto: process.env.EXPO_PUBLIC_SUPABASE_PROFILE_PHOTO_BUCKET ?? "profile-photos",
  groupBackdrop: process.env.EXPO_PUBLIC_SUPABASE_GROUP_BACKDROP_BUCKET ?? "group-backdrops"
};

if (!supabaseUrl || !serviceRoleKey || !cloudflareAccountId || !cloudflareToken || !cloudflareAccountHash) {
  console.error("Set EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_IMAGES_API_TOKEN, and CLOUDFLARE_IMAGES_ACCOUNT_HASH.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  let scanned = 0;
  let migrated = 0;
  let failed = 0;

  for (const candidate of await loadCandidates()) {
    if (scanned >= limit) break;
    scanned += 1;
    try {
      if (dryRun) {
        console.log(`[dry-run] ${candidate.type} ${candidate.id} from ${candidate.bucket}/${candidate.path}`);
        continue;
      }
      await migrateCandidate(candidate);
      migrated += 1;
      console.log(`[migrated] ${candidate.type} ${candidate.id}`);
    } catch (error) {
      failed += 1;
      console.warn(`[failed] ${candidate.type} ${candidate.id}: ${error.message}`);
    }
  }

  console.log(`Done. dryRun=${dryRun} scanned=${scanned} migrated=${migrated} failed=${failed}`);
  if (dryRun) console.log("Run with CLOUDFLARE_BACKFILL_DRY_RUN=false to copy and update rows.");
}

async function loadCandidates() {
  const [checkIns, profiles, groups] = await Promise.all([loadCheckIns(), loadProfiles(), loadGroups()]);
  return [...checkIns, ...profiles, ...groups];
}

async function loadCheckIns() {
  const { data, error } = await supabase
    .from("check_ins")
    .select("id,user_id,photo_storage_path,photo_image_width,photo_image_height")
    .not("photo_storage_path", "is", null)
    .is("photo_cloudflare_image_id", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    type: "beer_photo",
    id: row.id,
    ownerUserId: row.user_id,
    bucket: buckets.beerPhoto,
    path: row.photo_storage_path,
    width: row.photo_image_width,
    height: row.photo_image_height,
    updateTable: "check_ins",
    updateIdColumn: "id",
    updateId: row.id,
    updatePayload: (image) => ({
      photo_url: deliveryUrl(image.id, "feed"),
      photo_thumbnail_url: deliveryUrl(image.id, "thumbnail"),
      photo_cloudflare_image_id: image.id,
      photo_image_width: image.width ?? row.photo_image_width ?? null,
      photo_image_height: image.height ?? row.photo_image_height ?? null
    }),
    imageUploadPayload: (image) => ({
      cloudflare_image_id: image.id,
      image_type: "beer_photo",
      owner_user_id: row.user_id,
      check_in_id: row.id,
      width: image.width ?? row.photo_image_width ?? null,
      height: image.height ?? row.photo_image_height ?? null,
      delivery_url: deliveryUrl(image.id, "feed")
    })
  }));
}

async function loadProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,avatar_storage_path,avatar_image_width,avatar_image_height")
    .not("avatar_storage_path", "is", null)
    .is("avatar_cloudflare_image_id", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    type: "profile_avatar",
    id: row.id,
    ownerUserId: row.id,
    bucket: buckets.profilePhoto,
    path: row.avatar_storage_path,
    width: row.avatar_image_width,
    height: row.avatar_image_height,
    updateTable: "profiles",
    updateIdColumn: "id",
    updateId: row.id,
    updatePayload: (image) => ({
      avatar_url: deliveryUrl(image.id, "avatar"),
      avatar_cloudflare_image_id: image.id,
      avatar_image_width: image.width ?? row.avatar_image_width ?? null,
      avatar_image_height: image.height ?? row.avatar_image_height ?? null
    }),
    imageUploadPayload: (image) => ({
      cloudflare_image_id: image.id,
      image_type: "profile_avatar",
      owner_user_id: row.id,
      width: image.width ?? row.avatar_image_width ?? null,
      height: image.height ?? row.avatar_image_height ?? null,
      delivery_url: deliveryUrl(image.id, "avatar")
    })
  }));
}

async function loadGroups() {
  const { data, error } = await supabase
    .from("groups")
    .select("id,founder_id,backdrop_storage_path,backdrop_image_width,backdrop_image_height")
    .not("backdrop_storage_path", "is", null)
    .is("backdrop_cloudflare_image_id", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    type: "group_image",
    id: row.id,
    ownerUserId: row.founder_id,
    bucket: buckets.groupBackdrop,
    path: row.backdrop_storage_path,
    width: row.backdrop_image_width,
    height: row.backdrop_image_height,
    updateTable: "groups",
    updateIdColumn: "id",
    updateId: row.id,
    updatePayload: (image) => ({
      backdrop_url: deliveryUrl(image.id, "feed"),
      backdrop_cloudflare_image_id: image.id,
      backdrop_image_width: image.width ?? row.backdrop_image_width ?? null,
      backdrop_image_height: image.height ?? row.backdrop_image_height ?? null
    }),
    imageUploadPayload: (image) => ({
      cloudflare_image_id: image.id,
      image_type: "group_image",
      owner_user_id: row.founder_id,
      group_id: row.id,
      width: image.width ?? row.backdrop_image_width ?? null,
      height: image.height ?? row.backdrop_image_height ?? null,
      delivery_url: deliveryUrl(image.id, "feed")
    })
  }));
}

async function migrateCandidate(candidate) {
  const file = await downloadStorageObject(candidate);
  const image = await uploadToCloudflare(candidate, file);
  const { error: metadataError } = await supabase.from("image_uploads").upsert(candidate.imageUploadPayload(image), { onConflict: "cloudflare_image_id" });
  if (metadataError) throw metadataError;

  const { error: updateError } = await supabase
    .from(candidate.updateTable)
    .update(candidate.updatePayload(image))
    .eq(candidate.updateIdColumn, candidate.updateId);
  if (updateError) throw updateError;
}

async function downloadStorageObject(candidate) {
  const { data, error } = await supabase.storage.from(candidate.bucket).download(candidate.path);
  if (error || !data) throw error ?? new Error("Could not download Supabase Storage object.");
  return {
    bytes: Buffer.from(await data.arrayBuffer()),
    contentType: data.type || contentTypeForPath(candidate.path)
  };
}

async function uploadToCloudflare(candidate, file) {
  const formData = new FormData();
  formData.append("requireSignedURLs", "false");
  formData.append(
    "metadata",
    JSON.stringify({
      app: "pintly",
      backfill: true,
      imageType: candidate.type,
      ownerUserId: candidate.ownerUserId,
      sourceBucket: candidate.bucket,
      sourcePath: candidate.path
    })
  );
  formData.append("file", new Blob([file.bytes], { type: file.contentType }), fileNameFor(candidate.path));

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/images/v1`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cloudflareToken}`
    },
    body: formData
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error(body?.errors?.[0]?.message ?? `Cloudflare upload failed with ${response.status}`);
  }
  return body.result;
}

function deliveryUrl(imageId, variant) {
  return `https://imagedelivery.net/${cloudflareAccountHash}/${imageId}/${variant}`;
}

function contentTypeForPath(storagePath) {
  const extension = storagePath.split("?")[0].split(".").pop()?.toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";
  return "image/jpeg";
}

function fileNameFor(storagePath) {
  return storagePath.split("/").pop() || `pintly-backfill-${Date.now()}.jpg`;
}
