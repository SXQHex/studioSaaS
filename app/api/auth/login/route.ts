import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 8;
const localAttempts = new Map<string, { count: number; expiresAt: number }>();

async function consumeAttempt(ip: string, email: string) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const keys = [`login:ip:${ip}`, `login:email:${email}`];
  if (url && token) {
    // Atomically checks and increments IP + email budgets, including concurrent attempts.
    const script =
      "local limit=tonumber(ARGV[1]); local window=tonumber(ARGV[2]); for i,key in ipairs(KEYS) do if tonumber(redis.call('GET',key) or '0') >= limit then return 1 end end; for i,key in ipairs(KEYS) do local count=redis.call('INCR',key); if count == 1 then redis.call('EXPIRE',key,window) end end; return 0";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        script,
        keys.length,
        ...keys,
        MAX_ATTEMPTS,
        WINDOW_SECONDS,
      ]),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Rate limiter unavailable");
    const result = (await response.json()) as { result?: number };
    return result.result === 1;
  }

  // A per-instance limiter is acceptable only for local development.
  if (process.env.NODE_ENV === "production")
    throw new Error("Distributed rate limiter is not configured");
  const now = Date.now();
  for (const key of keys) {
    const value = localAttempts.get(key);
    if (value && value.expiresAt <= now) localAttempts.delete(key);
    const current = localAttempts.get(key);
    if (current && current.count >= MAX_ATTEMPTS) return true;
  }
  for (const key of keys) {
    const current = localAttempts.get(key);
    localAttempts.set(
      key,
      current && current.expiresAt > now
        ? { count: current.count + 1, expiresAt: current.expiresAt }
        : { count: 1, expiresAt: now + WINDOW_SECONDS * 1000 },
    );
  }
  return false;
}

export async function POST(request: NextRequest) {
  let payload: { email?: unknown; password?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Giriş yapılamadı." }, { status: 400 });
  }

  const email =
    typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  if (!email || !password || email.length > 320 || password.length > 1024) {
    return NextResponse.json({ error: "Giriş yapılamadı." }, { status: 400 });
  }

  const ip =
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  try {
    if (await consumeAttempt(ip, email)) {
      return NextResponse.json(
        {
          error:
            "Çok fazla giriş denemesi yapıldı. 15 dakika sonra tekrar deneyin.",
        },
        { status: 429, headers: { "Retry-After": String(WINDOW_SECONDS) } },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Giriş hizmeti geçici olarak kullanılamıyor." },
      { status: 503 },
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      return NextResponse.json(
        { error: "Giriş yapılamadı. E-posta ve şifrenizi kontrol edin." },
        { status: 401 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Giriş hizmeti yapılandırılamadı." },
      { status: 503 },
    );
  }
}
