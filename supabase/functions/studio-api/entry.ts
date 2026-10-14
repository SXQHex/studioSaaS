import { createBackendHandler } from "../../../lib/backend/router.ts";

const handler = createBackendHandler({
  url: Deno.env.get("SUPABASE_URL") ?? "",
  publishableKey: Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  allowedOrigins: (Deno.env.get("STUDIO_API_ALLOWED_ORIGINS") ?? "https://uye.fethiyetango.com")
    .split(",").map((origin) => origin.trim()).filter(Boolean),
});

Deno.serve(handler);
