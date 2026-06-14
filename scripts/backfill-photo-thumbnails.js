const { createClient } = require("@supabase/supabase-js");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
const bucketName = process.env.EXPO_PUBLIC_SUPABASE_PHOTO_BUCKET ?? "beer-photos";
const pageSize = Number(process.env.THUMBNAIL_BACKFILL_PAGE_SIZE ?? 100);
const limit = Number(process.env.THUMBNAIL_BACKFILL_LIMIT ?? 0);

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.");
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
  const failedIds = new Set();
  let scanned = 0;
  let created = 0;
  let skipped = 0;
  let failed = 0;

  while (!limit || scanned < limit) {
    const remaining = limit ? Math.min(pageSize, limit - scanned) : pageSize;
    const { data, error } = await supabase
      .from("check_ins")
      .select("id, photo_storage_path, photo_thumbnail_storage_path")
      .not("photo_storage_path", "is", null)
      .is("photo_thumbnail_storage_path", null)
      .order("created_at", { ascending: true })
      .limit(remaining + failedIds.size);

    if (error) throw error;
    if (!data?.length) break;

    const rows = data.filter((row) => !failedIds.has(row.id)).slice(0, remaining);
    if (!rows.length) break;

    for (const row of rows) {
      scanned += 1;
      try {
        const thumbnailPath = await createThumbnailForRow(row);
        if (!thumbnailPath) {
          skipped += 1;
          continue;
        }

        const { error: updateError } = await supabase
          .from("check_ins")
          .update({
            photo_thumbnail_url: null,
            photo_thumbnail_storage_path: thumbnailPath
          })
          .eq("id", row.id);

        if (updateError) throw updateError;
        created += 1;
        console.log(`created ${thumbnailPath}`);
      } catch (error) {
        failedIds.add(row.id);
        failed += 1;
        console.warn(`failed ${row.id}: ${error.message}`);
      }
    }
  }

  console.log(`Done. scanned=${scanned} created=${created} skipped=${skipped} failed=${failed}`);
}

async function createThumbnailForRow(row) {
  if (!row.photo_storage_path || row.photo_thumbnail_storage_path) return null;

  const { data, error } = await supabase.storage.from(bucketName).download(row.photo_storage_path);
  if (error || !data) {
    throw error ?? new Error("Could not download source photo.");
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pintly-thumbs-"));
  const sourcePath = path.join(tmpDir, "source");
  const thumbnailFilePath = path.join(tmpDir, "thumbnail.jpg");

  try {
    fs.writeFileSync(sourcePath, Buffer.from(await data.arrayBuffer()));
    execFileSync("sips", ["-s", "format", "jpeg", "-Z", "320", sourcePath, "--out", thumbnailFilePath], {
      stdio: "ignore"
    });

    const thumbnailStoragePath = thumbnailPathFor(row);
    const thumbnailBytes = fs.readFileSync(thumbnailFilePath);
    const { error: uploadError } = await supabase.storage.from(bucketName).upload(thumbnailStoragePath, thumbnailBytes, {
      contentType: "image/jpeg",
      upsert: true
    });

    if (uploadError) throw uploadError;
    return thumbnailStoragePath;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function thumbnailPathFor(row) {
  const parsed = path.posix.parse(row.photo_storage_path);
  return path.posix.join(parsed.dir, "thumbs", `${parsed.name}-thumb-${row.id}.jpg`);
}
