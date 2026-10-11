"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      router.replace("/login");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Oturum kapatılamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="signout-wrap">
      <button className="signout-button" type="button" onClick={signOut} disabled={busy}>
        <LogOut size={17} aria-hidden="true" />
        {busy ? "Çıkış yapılıyor…" : "Çıkış yap"}
      </button>
      {error && <p className="inline-error" role="alert">{error}</p>}
    </div>
  );
}
