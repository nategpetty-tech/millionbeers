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
};

type CheckInRow = {
  id: string;
  user_id: string;
  beer_name: string | null;
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
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Notification service is not configured." }, 500);

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

  const { data: reaction } = await serviceClient
    .from("check_in_reactions")
    .select("check_in_id")
    .eq("check_in_id", body.checkInId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!reaction) return json({ ok: true, sent: 0 });

  const { data: checkIn, error: checkInError } = await serviceClient
    .from("check_ins")
    .select("id,user_id,beer_name")
    .eq("id", body.checkInId)
    .maybeSingle();
  if (checkInError) return json({ error: "Could not load check-in." }, 500);
  const row = checkIn as CheckInRow | null;
  if (!row || row.user_id === user.id) return json({ ok: true, sent: 0 });

  const { data: blocks } = await serviceClient
    .from("user_blocks")
    .select("blocker_id")
    .or(`and(blocker_id.eq.${row.user_id},blocked_id.eq.${user.id}),and(blocker_id.eq.${user.id},blocked_id.eq.${row.user_id})`)
    .limit(1);
  if ((blocks ?? []).length > 0) return json({ ok: true, sent: 0 });

  const { data: actorProfile } = await serviceClient.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const actorName = actorProfile?.display_name?.trim() || "Someone";

  const { data: tokenRows, error: tokenError } = await serviceClient
    .from("push_tokens")
    .select("token")
    .eq("user_id", row.user_id)
    .eq("enabled", true);
  if (tokenError) return json({ error: "Could not load push tokens." }, 500);

  const tokens = Array.from(new Set((tokenRows ?? []).map((tokenRow: { token: string }) => tokenRow.token).filter(isExpoPushToken)));
  if (!tokens.length) return json({ ok: true, sent: 0 });

  const messages = tokens.map((to) => ({
    to,
    title: "Pintly",
    body: `${actorName} liked your beer log${beerPhrase(row.beer_name)}`,
    sound: "default",
    channelId: "group-beers",
    data: {
      type: "reaction",
      checkInId: row.id,
      actorUserId: user.id
    }
  }));

  let sent = 0;
  for (const chunk of chunkMessages(messages, 100)) {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(chunk)
    });
    if (response.ok) sent += chunk.length;
  }

  return json({ ok: true, sent });
});

function beerPhrase(beerName: string | null) {
  const trimmed = beerName?.trim();
  if (!trimmed || ["beer log", "pintly log"].includes(trimmed.toLowerCase())) return ".";
  return `: ${trimmed}.`;
}

function isExpoPushToken(token: string) {
  return /^ExponentPushToken\[[^\]]+\]$|^ExpoPushToken\[[^\]]+\]$/.test(token);
}

function chunkMessages<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
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
