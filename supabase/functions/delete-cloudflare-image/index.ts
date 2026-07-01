declare const Deno: {
  serve(handler: (request: Request) => Response | Promise<Response>): void;
  env: {
    get(key: string): string | undefined;
  };
};

// @ts-ignore Deno resolves URL imports at deploy/runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.107.0";

type RequestBody = {
  imageId?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const cloudflareAccountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
  const cloudflareToken = Deno.env.get("CLOUDFLARE_IMAGES_API_TOKEN");

  if (!supabaseUrl || !supabaseAnonKey || !cloudflareAccountId || !cloudflareToken) {
    return json({ error: "Image deletion service is not configured." }, 500);
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
  if (!body.imageId) return json({ error: "imageId is required." }, 400);

  const { data, error } = await supabase
    .from("image_uploads")
    .select("owner_user_id,deleted_at")
    .eq("cloudflare_image_id", body.imageId)
    .maybeSingle();
  if (error) return json({ error: "Could not validate image ownership." }, 500);
  if (!data || data.owner_user_id !== user.id) return json({ error: "Cannot delete another user's image." }, 403);
  if (data.deleted_at) return json({ ok: true });

  const cloudflareResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/images/v1/${encodeURIComponent(body.imageId)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${cloudflareToken}`
    }
  });
  if (!cloudflareResponse.ok) return json({ error: "Cloudflare image deletion failed." }, 502);

  await supabase.from("image_uploads").update({ deleted_at: new Date().toISOString() }).eq("cloudflare_image_id", body.imageId);
  return json({ ok: true });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
