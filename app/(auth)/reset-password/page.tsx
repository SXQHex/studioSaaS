"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [recoveryVerified, setRecoveryVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function prepareRecoverySession() {
      try {
        const params = new URLSearchParams(window.location.search);
        const supabase = createClient();
        const code = params.get("code");

        // Support existing Supabase confirmation links when their PKCE
        // verifier is available, while the server callback handles token_hash.
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!data.session) {
          if (active) {
            setError(
              params.get("error") === "recovery"
                ? "Şifre sıfırlama bağlantısı geçersiz, kullanılmış veya süresi dolmuş olabilir. Giriş ekranından yeni bir bağlantı isteyin."
                : "Şifre sıfırlama oturumu doğrulanamadı. Giriş ekranından yeni bir bağlantı isteyin.",
            );
          }
          return;
        }

        if (active) setRecoveryVerified(true);
      } catch {
        if (active) {
          setError("Şifre sıfırlama oturumu doğrulanamadı. Giriş ekranından yeni bir bağlantı isteyin.");
        }
      } finally {
        if (active) setReady(true);
      }
    }

    void prepareRecoverySession();
    return () => { active = false; };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("Yeni şifre en az 8 karakter olmalı.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage("Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("Şifre güncellenemedi. Giriş ekranından yeni bir sıfırlama bağlantısı isteyin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="reset-shell">
      <section className="reset-card">
        <Link href="/login" className="mobile-brand reset-brand">FTK <span>STUDIO</span></Link>
        <p className="eyebrow">HESAP GÜVENLİĞİ</p>
        <h1>Yeni şifre belirleyin</h1>
        <p className="subheading">Hesabınız için yeni bir şifre oluşturun.</p>

        {!ready ? <p className="notice" role="status">Sıfırlama bağlantısı doğrulanıyor…</p> : !recoveryVerified ? (
          <>
            <p className="notice error" role="alert">{error}</p>
            <Link href="/login" className="primary-link">Giriş ekranına dön ve yeni bağlantı iste <span aria-hidden="true">→</span></Link>
          </>
        ) : (
          <>
            {error && <p className="notice error" role="alert">{error}</p>}
            {message ? (
              <div className="reset-success">
                <p className="notice success" role="status">{message}</p>
                <Link href="/login" className="primary-link">Giriş ekranına dön <span aria-hidden="true">→</span></Link>
              </div>
            ) : (
              <form className="login-form reset-form" onSubmit={handleSubmit}>
                <label htmlFor="new-password">Yeni şifre</label>
                <input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="En az 8 karakter" />
                <label htmlFor="confirm-password">Yeni şifreyi tekrar girin</label>
                <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Şifreyi tekrar girin" />
                <button type="submit" disabled={busy || !ready}>{busy ? "Güncelleniyor…" : "Şifreyi güncelle"} <span aria-hidden="true">→</span></button>
              </form>
            )}
          </>
        )}

        <Link href="/login" className="back-link reset-back">← Giriş ekranına dön</Link>
      </section>
    </main>
  );
}
