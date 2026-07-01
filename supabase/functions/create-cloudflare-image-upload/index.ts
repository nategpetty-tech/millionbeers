declare const Deno: {
  serve(handler: (request: Request) => Response | Promise<Response>): void;
  env: {
    get(key: string): string | undefined;
  };
};

// @ts-ignore Deno resolves URL imports at deploy/runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.107.0";

type ImageType = "beer_photo" | "profile_avatar" | "group_image";

type RequestBody = {
  imageType?: ImageType;
  ownerUserId?: string;
  relatedCheckInId?: string;
  relatedGroupId?: string;
  relatedGroupIds?: string[];
  contentType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const allowedImageTypes = new Set<ImageType>(["beer_photo", "profile_avatar", "group_image"]);
const maxUploadBytes = 10 * 1024 * 1024;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const cloudflareAccountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
  const cloudflareToken = Deno.env.get("CLOUDFLARE_IMAGES_API_TOKEN");

  if (!supabaseUrl || !supabaseAnonKey || !cloudflareAccountId || !cloudflareToken) {
    return json({ error: "Image upload service is not configured." }, 500);
  }

  const authorization = request.headers.get("Authorization") ?? "";
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } }
  });
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) return json({ error: "Authentication required." }, 401);

  const body = (await request.json().catch(() => ({}))) as RequestBody;
  if (!body.imageType || !allowedImageTypes.has(body.imageType)) return json({ error: "Unsupported image type." }, 400);
  if (body.ownerUserId && body.ownerUserId !== user.id) return json({ error: "Cannot upload for another user." }, 403);
  if (!body.contentType?.startsWith("image/")) return json({ error: "Only image uploads are allowed." }, 400);
  if (typeof body.fileSize === "number" && body.fileSize > maxUploadBytes) return json({ error: "Image exceeds the 10 MB limit." }, 400);

  const authError = await validateAttachment(supabase, user.id, body);
  if (authError) return json({ error: authError.message }, authError.status);

  const formData = new FormData();
  formData.append("requireSignedURLs", "false");
  formData.append(
    "metadata",
    JSON.stringify({
      app: "pintly",
      imageType: body.imageType,
      ownerUserId: user.id,
      relatedCheckInId: body.relatedCheckInId ?? null,
      relatedGroupId: body.relatedGroupId ?? null,
      relatedGroupIds: body.relatedGroupIds ?? [],
      width: body.width ?? null,
      height: body.height ?? null
    })
  );

  const cloudflareResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/images/v2/direct_upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cloudflareToken}`
    },
    body: formData
  });
  const cloudflareJson = await cloudflareResponse.json().catch(() => null);
  if (!cloudflareResponse.ok || !cloudflareJson?.success) {
    return json({ error: "Could not create Cloudflare upload URL." }, 502);
  }

  return json({
    id: cloudflareJson.result.id,
    uploadURL: cloudflareJson.result.uploadURL
  });
});

async function validateAttachment(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  body: RequestBody
): Promise<{ message: string; status: number } | null> {
  if (body.imageType === "profile_avatar") return null;

  if (body.imageType === "group_image" && body.relatedGroupId) {
    const { data, error } = await supabase.from("groups").select("founder_id").eq("id", body.relatedGroupId).maybeSingle();
    if (error) return { message: "Could not validate group access.", status: 500 };
    if (!data || data.founder_id !== userId) return { message: "Only the group founder can change this image.", status: 403 };
    return null;
  }

  if (body.imageType === "beer_photo" && body.relatedCheckInId) {
    const { data, error } = await supabase.from("check_ins").select("user_id").eq("id", body.relatedCheckInId).maybeSingle();
    if (!error && data && data.user_id !== userId) return { message: "Cannot attach a photo to another user's log.", status: 403 };
  }

  const groupIds = Array.from(new Set(body.relatedGroupIds ?? []));
  if (groupIds.length) {
    const { data, error } = await supabase.from("group_memberships").select("group_id").in("group_id", groupIds).eq("user_id", userId);
    if (error) return { message: "Could not validate group posting access.", status: 500 };
    const allowed = new Set((data ?? []).map((row: { group_id: string }) => row.group_id));
    if (groupIds.some((groupId) => !allowed.has(groupId))) return { message: "Cannot post photos to a group you do not belong to.", status: 403 };
  }

  return null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
