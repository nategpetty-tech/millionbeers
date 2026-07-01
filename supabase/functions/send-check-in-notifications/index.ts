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
  city: string | null;
  state: string | null;
  venue_name: string | null;
  venue_confirmation_status: string | null;
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

  const { data: checkIn, error: checkInError } = await serviceClient
    .from("check_ins")
    .select("id,user_id,city,state,venue_name,venue_confirmation_status")
    .eq("id", body.checkInId)
    .maybeSingle();
  if (checkInError) return json({ error: "Could not load check-in." }, 500);
  const row = checkIn as CheckInRow | null;
  if (!row) return json({ ok: true, sent: 0 });
  if (row.user_id !== user.id) return json({ error: "Cannot notify for another user's check-in." }, 403);

  const { data: profile } = await serviceClient.from("profiles").select("display_name").eq("id", row.user_id).maybeSingle();
  const actorName = profile?.display_name?.trim() || "Someone";

  const { data: groupLinks, error: groupError } = await serviceClient.from("check_in_groups").select("group_id").eq("check_in_id", row.id);
  if (groupError) return json({ error: "Could not load check-in groups." }, 500);
  const groupIds = Array.from(new Set((groupLinks ?? []).map((link: { group_id: string }) => link.group_id)));
  if (!groupIds.length) return json({ ok: true, sent: 0 });

  const { data: memberships, error: membershipError } = await serviceClient
    .from("group_memberships")
    .select("user_id")
    .in("group_id", groupIds);
  if (membershipError) return json({ error: "Could not load group members." }, 500);

  const recipientIds = Array.from(new Set((memberships ?? []).map((member: { user_id: string }) => member.user_id).filter((id: string) => id !== row.user_id)));
  if (!recipientIds.length) return json({ ok: true, sent: 0 });

  const { data: tokenRows, error: tokenError } = await serviceClient
    .from("push_tokens")
    .select("token")
    .in("user_id", recipientIds)
    .eq("enabled", true);
  if (tokenError) return json({ error: "Could not load push tokens." }, 500);

  const tokens = Array.from(new Set((tokenRows ?? []).map((tokenRow: { token: string }) => tokenRow.token).filter(isExpoPushToken)));
  if (!tokens.length) return json({ ok: true, sent: 0 });

  const messageBody = `${actorName} is having a beer ${placePhrase(row)}`;
  const messages = tokens.map((to) => ({
    to,
    title: "Pintly",
    body: messageBody,
    sound: "default",
    channelId: "group-beers",
    data: {
      type: "check_in",
      checkInId: row.id,
      groupIds
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

function placePhrase(checkIn: CheckInRow) {
  if (checkIn.venue_confirmation_status === "confirmed" && checkIn.venue_name?.trim()) {
    return `at ${checkIn.venue_name.trim()}`;
  }
  const cityState = [checkIn.city, checkIn.state].map((part) => part?.trim()).filter(Boolean).join(", ");
  return cityState ? `in ${cityState}` : "nearby";
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
