declare const Deno: {
  serve(handler: (request: Request) => Response | Promise<Response>): void;
  env: {
    get(key: string): string | undefined;
  };
};

// @ts-ignore Deno resolves URL imports at deploy/runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.107.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Deletion service is not configured." }, 500);

  const authorization = request.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } }
  });
  const {
    data: { user },
    error: userError
  } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Authentication required." }, 401);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: requestRow } = await serviceClient
    .from("account_deletion_requests")
    .insert({ user_id: user.id, status: "requested" })
    .select("id")
    .maybeSingle();

  try {
    await serviceClient.from("push_tokens").delete().eq("user_id", user.id);
    await serviceClient.from("user_blocks").delete().or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
    await serviceClient.from("friendships").delete().or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);
    await serviceClient.from("friend_requests").delete().or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    await serviceClient.from("group_join_requests").delete().eq("user_id", user.id);
    await serviceClient.from("check_in_reactions").delete().eq("user_id", user.id);

    await serviceClient
      .from("profiles")
      .update({
        display_name: "Deleted Pintly User",
        avatar: "DU",
        avatar_url: null,
        avatar_storage_path: null,
        avatar_cloudflare_image_id: null,
        avatar_image_width: null,
        avatar_image_height: null,
        avatar_blurhash: null
      })
      .eq("id", user.id);

    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id, true);
    if (deleteError) throw deleteError;

    if (requestRow?.id) {
      await serviceClient
        .from("account_deletion_requests")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", requestRow.id);
    }
    return json({ ok: true });
  } catch (error) {
    if (requestRow?.id) {
      await serviceClient
        .from("account_deletion_requests")
        .update({ status: "failed", error_message: errorMessage(error) })
        .eq("id", requestRow.id);
    }
    return json({ error: "Could not delete account." }, 500);
  }
});

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 500);
  return "Unknown account deletion error.";
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
