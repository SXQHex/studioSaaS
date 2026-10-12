import { createClient } from "npm:@supabase/supabase-js@2";

type EventType = "created" | "approved" | "rejected";
type SessionRequest = {
  id: string;
  organization_id: string;
  center_id: string;
  requested_by: string;
  instructor_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  reviewed_by: string | null;
  review_note: string | null;
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ ok: false, error: "unauthorized" }, 401);

  let payload: { request_id?: unknown; event?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const requestId = typeof payload.request_id === "string" ? payload.request_id : "";
  const event = payload.event as EventType;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    return json({ ok: false, error: "invalid_request_id" }, 400);
  }
  if (!["created", "approved", "rejected"].includes(event)) {
    return json({ ok: false, error: "invalid_event" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    console.error("Session email sender is missing required environment configuration", {
      supabaseUrl: Boolean(supabaseUrl),
      serviceRoleKey: Boolean(serviceRoleKey),
      resendApiKey: Boolean(resendApiKey),
    });
    return json({ ok: false, error: "email_sender_not_configured" }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const jwt = authorization.slice("Bearer ".length);
  const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
  const user = authData.user;
  if (authError || !user) return json({ ok: false, error: "unauthorized" }, 401);

  const [{ data: profile, error: profileError }, { data: sessionRequest, error: requestError }] =
    await Promise.all([
      supabase.from("profiles").select("id, role, full_name").eq("id", user.id).maybeSingle(),
      supabase
        .from("session_requests")
        .select("id, organization_id, center_id, requested_by, instructor_id, title, starts_at, ends_at, status, reviewed_by, review_note")
        .eq("id", requestId)
        .maybeSingle(),
    ]);
  if (profileError || requestError || !profile || !sessionRequest) {
    return json({ ok: false, error: "request_not_found" }, 404);
  }

  const row = sessionRequest as SessionRequest;
  let recipientIds: string[] = [];

  if (event === "created") {
    if (row.requested_by !== user.id || !["admin", "instructor"].includes(profile.role)) {
      return json({ ok: false, error: "forbidden" }, 403);
    }
    if (row.status !== "pending") return json({ ok: false, error: "request_not_pending" }, 409);

    if (profile.role === "admin") {
      const { data: centerAdmin, error } = await supabase
        .from("center_admins")
        .select("profile_id")
        .eq("center_id", row.center_id)
        .eq("profile_id", user.id)
        .maybeSingle();
      if (error || !centerAdmin) return json({ ok: false, error: "forbidden" }, 403);
      recipientIds = [row.instructor_id];
    } else {
      if (row.instructor_id !== user.id) return json({ ok: false, error: "forbidden" }, 403);
      const { data: centerAdmins, error } = await supabase
        .from("center_admins")
        .select("profile_id")
        .eq("center_id", row.center_id);
      if (error) return json({ ok: false, error: "recipients_unavailable" }, 500);
      recipientIds = (centerAdmins ?? []).map((item) => item.profile_id);
    }
  } else {
    const expectedStatus = event === "approved" ? "approved" : "rejected";
    if (profile.role !== "admin" || row.status !== expectedStatus || row.reviewed_by !== user.id) {
      return json({ ok: false, error: "forbidden_or_unreviewed" }, 403);
    }
    const { data: centerAdmin, error } = await supabase
      .from("center_admins")
      .select("profile_id")
      .eq("center_id", row.center_id)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (error || !centerAdmin) return json({ ok: false, error: "forbidden" }, 403);
    recipientIds = [row.requested_by, row.instructor_id];
  }

  recipientIds = [...new Set(recipientIds.filter(Boolean))];
  const recipientUsers = await Promise.all(
    recipientIds.map(async (id) => {
      const { data, error } = await supabase.auth.admin.getUserById(id);
      if (error || !data.user?.email) return null;
      return { id, email: data.user.email };
    }),
  );
  const recipients = recipientUsers.filter(
    (item): item is { id: string; email: string } => Boolean(item),
  );
  if (!recipients.length) return json({ ok: false, error: "no_email_recipients" }, 422);

  const { data: center } = await supabase.from("centers").select("name").eq("id", row.center_id).maybeSingle();
  const date = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(row.starts_at));
  const eventTitle =
    event === "created"
      ? "Yeni seans talebi"
      : event === "approved"
        ? "Seans talebiniz onaylandı"
        : "Seans talebiniz reddedildi";
  const from = Deno.env.get("RESEND_FROM_EMAIL") || "FTK Studio <bildirim@fethiyetango.com>";
  const textFor = () => {
    if (event === "created" && profile.role === "admin") {
      return "Size bir seans planlama talebi gönderildi.\n\nDers: " + row.title +
        "\nMerkez: " + (center?.name ?? "Merkez") + "\nTarih: " + date +
        "\n\nTalebi incelemek için FTK Studio paneline giriş yapın.";
    }
    if (event === "created") {
      return "Yeni bir seans talebi oluşturuldu.\n\nDers: " + row.title +
        "\nMerkez: " + (center?.name ?? "Merkez") + "\nTarih: " + date +
        "\n\nTalebi incelemek için FTK Studio paneline giriş yapın.";
    }
    const note = row.review_note ? "\nYönetici notu: " + row.review_note : "";
    return "Ders: " + row.title + "\nMerkez: " + (center?.name ?? "Merkez") +
      "\nTarih: " + date + note +
      "\n\nGüncel durumu FTK Studio bildirim merkezinde görüntüleyebilirsiniz.";
  };

  const failures: string[] = [];
  let sent = 0;
  for (const recipient of recipients) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + resendApiKey,
        "Content-Type": "application/json",
        "Idempotency-Key": "session-request/" + row.id + "/" + event + "/" + recipient.id,
      },
      body: JSON.stringify({
        from,
        to: [recipient.email],
        subject: eventTitle + ": " + row.title,
        text: textFor(),
      }),
    });
    if (!response.ok) {
      console.error("Resend rejected a session notification", {
        status: response.status,
        event,
        requestId: row.id,
      });
      failures.push(recipient.id);
      continue;
    }
    sent += 1;
  }

  if (failures.length) return json({ ok: false, sent, failed: failures.length, error: "some_emails_failed" }, 502);
  return json({ ok: true, sent });
});
