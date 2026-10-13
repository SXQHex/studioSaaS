"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const name = fullName.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 120) {
      setError("Ad soyad 2–120 karakter olmalı.");
      return;
    }
    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalı.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const redirectOrigin = process.env.NODE_ENV === "production"
        ? "https://uye.fethiyetango.com"
        : window.location.origin;
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: `${redirectOrigin}/confirm`,
          data: { full_name: name },
        },
      });
      if (signUpError) throw signUpError;
      if (data.session) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }
      setMessage("Kayıt isteğiniz alındı. Hesabınızı etkinleştirmek için e-postanıza gelen doğrulama bağlantısını açın. E-posta gelmezse spam klasörünüzü kontrol edin.");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("Kayıt işlemi tamamlanamadı. Bilgilerinizi kontrol edip tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="reset-shell">
      <section className="reset-card">
        <Link href="/login" className="mobile-brand reset-brand">FTK <span>STUDIO</span></Link>
        <p className="eyebrow">YENİ HESAP</p>
        <h1>Hesap oluşturun</h1>
        <p className="subheading">Derslerinizi ve kredilerinizi tek yerden takip edin.</p>
        {error && <p className="notice error" role="alert">{error}</p>}
        {message ? (
          <div className="reset-success">
            <p className="notice success" role="status">{message}</p>
            <Link href="/login" className="primary-link">Giriş ekranına dön <span aria-hidden="true">→</span></Link>
          </div>
        ) : (
          <form className="login-form reset-form" onSubmit={handleSubmit}>
            <label htmlFor="full-name">Ad soyad</label>
            <input id="full-name" type="text" autoComplete="name" minLength={2} maxLength={120} required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Adınız Soyadınız" />
            <label htmlFor="register-email">E-posta</label>
            <input id="register-email" type="email" autoComplete="email" maxLength={320} required value={email} onChange={e => setEmail(e.target.value)} placeholder="ornek@eposta.com" />
            <label htmlFor="register-password">Şifre</label>
            <input id="register-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="En az 8 karakter" />
            <label htmlFor="register-confirm">Şifreyi tekrar girin</label>
            <input id="register-confirm" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Şifrenizi doğrulayın" />
            <button type="submit" disabled={busy}>{busy ? "Hesap oluşturuluyor…" : "Hesap oluştur"} <span aria-hidden="true">→</span></button>
          </form>
        )}
        <p className="setup-note">Kayıt olan kullanıcılar öğrenci hesabıyla başlar. Merkez ve ders erişimleri ayrıca atanır.</p>
        <Link href="/login" className="back-link reset-back">← Zaten hesabım var, giriş yap</Link>
      </section>
    </main>
  );
}
