"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "profile") {
      setError("Bu hesap için profil/rol kaydı doğrulanamadı. Lütfen stüdyo yöneticisine başvurun.");
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      router.replace("/dashboard"); router.refresh();
    } catch {
      setError("Giriş yapılamadı. E-posta ve şifrenizi kontrol edin.");
    } finally { setBusy(false); }
  }

  async function handleReset() {
    setError(""); setMessage("");
    if (!email) { setError("Şifre sıfırlama bağlantısı için e-posta adresini gir."); return; }
    try {
      const supabase = createClient();
      // Production recovery emails must always return to the canonical app domain.
      // Keep localhost behavior only for local development.
      const redirectOrigin =
        process.env.NODE_ENV === "production"
          ? "https://uye.fethiyetango.com"
          : window.location.origin;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${redirectOrigin}/reset-password` });
      if (resetError) throw resetError;
      setMessage("E-posta adresin kayıtlıysa şifre sıfırlama bağlantısı gönderildi.");
    } catch { setError("Şifre sıfırlama isteği alınamadı. Bir süre sonra tekrar deneyin."); }
  }

  return <main className="auth-shell">
    <section className="brand-panel"><div className="brand-mark">FTK</div><div><p className="eyebrow">STUDIO MANAGEMENT</p><h1>Stüdyonuzun ritmi, tek yerde.</h1><p className="brand-copy">Dersleri, üyeleri ve abonelikleri sade bir panelden yönetin.</p></div><p className="brand-foot">Dans okulu yönetim platformu</p></section>
    <section className="form-panel"><div className="mobile-brand">FTK <span>STUDIO</span></div><div className="form-wrap"><p className="eyebrow">YÖNETİM PANELİ</p><h2>Tekrar hoş geldiniz</h2><p className="subheading">Hesabınıza giriş yapın.</p>
      <form onSubmit={handleSubmit} className="login-form"><label htmlFor="email">E-posta</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="ornek@stüdyo.com" /><label htmlFor="password">Şifre</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Şifreniz" minLength={6} />
      {error && <p className="notice error" role="alert">{error}</p>}{message && <p className="notice success" role="status">{message}</p>}
      <button type="submit" disabled={busy}>{busy ? "Giriş yapılıyor…" : "Giriş yap"} <span aria-hidden="true">→</span></button></form>
      <button className="text-button" type="button" onClick={handleReset}>Şifremi unuttum</button><div className="secure-note"><span aria-hidden="true">◈</span> Güvenli oturum · Supabase Auth</div><p className="setup-note">Henüz hesabınız yoksa yöneticinizden erişim isteyin.</p><Link href="/" className="back-link">← Ana sayfa</Link>
    </div><p className="copyright">© {new Date().getFullYear()} FTK Studio</p></section>
  </main>;
}
