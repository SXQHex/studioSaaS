import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const code = params.get("code");
  const recovery = type === "recovery";
  const destination = new URL(
    recovery ? "/reset-password" : "/login",
    request.nextUrl.origin,
  );
  const supabase = await createClient();

  if (
    tokenHash &&
    (type === "recovery" || type === "email" || type === "signup")
  ) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error) {
      if (!recovery) destination.searchParams.set("confirmed", "true");
      return NextResponse.redirect(destination);
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      destination.searchParams.set("confirmed", "true");
      return NextResponse.redirect(destination);
    }
  }

  destination.searchParams.set("error", recovery ? "recovery" : "confirmation");
  return NextResponse.redirect(destination);
}
