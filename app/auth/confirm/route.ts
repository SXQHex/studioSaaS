import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  const resetUrl = new URL("/reset-password", request.nextUrl.origin);

  if (!tokenHash || type !== "recovery") {
    resetUrl.searchParams.set("error", "recovery");
    return NextResponse.redirect(resetUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });

  if (error) {
    resetUrl.searchParams.set("error", "recovery");
  }

  // The SSR Supabase client persists the verified session in response cookies,
  // so this works even if the email is opened in a different browser context.
  return NextResponse.redirect(resetUrl);
}
