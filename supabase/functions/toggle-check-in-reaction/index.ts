declare const Deno: {
  serve(handler: (request: Request) => Response | Promise<Response>): void;
  env: {
    get(key: string): string | undefined;
  };
};

// @ts-ignore Deno resolves URL imports at deploy/runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.107.0";

type RequestBody = {
  checkInId?: string;
  reacted?: boolean;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Reaction service is not configured." }, 500);

  const authorization = request.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } }
  });
  const {
    data: { user },
    error: userError
  } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Authentication required." }, 401);

  const body = (await request.json().catch(() => ({}))) as RequestBody;
  if (!body.checkInId) return json({ error: "checkInId is required." }, 400);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  if (body.reacted) {
    const { error } = await serviceClient
      .from("check_in_reactions")
      .delete()
      .eq("check_in_id", body.checkInId)
      .eq("user_id", user.id);
    if (error) return json({ error: "Could not remove reaction." }, 500);
    return json({ ok: true, reacted: false });
  }

  const { data: visibleCheckIn, error: visibleError } = await userClient
    .from("check_ins")
    .select("id")
    .eq("id", body.checkInId)
    .maybeSingle();
  if (visibleError) return json({ error: "Could not verify check-in visibility." }, 500);
  if (!visibleCheckIn) return json({ error: "Check-in is not visible." }, 403);

  const { error } = await serviceClient
    .from("check_in_reactions")
    .upsert({ check_in_id: body.checkInId, user_id: user.id }, { onConflict: "check_in_id,user_id", ignoreDuplicates: true });
  if (error) return json({ error: "Could not save reaction." }, 500);

  return json({ ok: true, reacted: true });
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
