"use client";
import { useState, useEffect, type FormEvent } from "react";
export function ApplicationForm({ slug }: { slug: string }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "info", slug }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((r) => {
        if (r.ok) setTitle(r.form.title);
        else setMessage("Başvuru formu kullanılamıyor.");
      })
      .catch(() => {
        if (!controller.signal.aborted) setMessage("Form yüklenemedi.");
      });
    return () => controller.abort();
  }, [slug]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          slug,
          data: {
            full_name: String(f.get("full_name")),
            email: String(f.get("email")),
            phone: String(f.get("phone")),
            interests: String(f.get("interests")),
            marketing_opt_in: f.get("marketing_opt_in") === "on",
            website: String(f.get("website") ?? ""),
          },
        }),
      });
      const r = await response.json();
      if (r.ok) {
        setDone(true);
        setMessage("Başvurunuz alındı. Ekibimiz sizinle iletişime geçecek.");
      } else setMessage(r.error ?? "Başvuru alınamadı.");
    } catch {
      setMessage("Başvuru alınamadı. Tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="form-card">
      <h1>{title || "Başvuru"}</h1>
      {message && <p role="status">{message}</p>}
      {title && !done && (
        <form className="record-form" onSubmit={submit}>
          <label>
            Ad soyad
            <input
              name="full_name"
              required
              minLength={2}
              maxLength={160}
              autoComplete="name"
            />
          </label>
          <label>
            E-posta
            <input
              type="email"
              name="email"
              maxLength={320}
              autoComplete="email"
            />
          </label>
          <label>
            Telefon
            <input type="tel" name="phone" maxLength={40} autoComplete="tel" />
          </label>
          <p>Size ulaşabilmemiz için e-posta veya telefon girin.</p>
          <label>
            İlgilendiğiniz dersler
            <textarea name="interests" maxLength={2000} />
          </label>
          <div aria-hidden="true" style={{ display: "none" }}>
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <label>
            <input type="checkbox" name="marketing_opt_in" />
            Pazarlama iletişimi almak istiyorum (isteğe bağlı)
          </label>
          <button className="primary-action" disabled={busy} type="submit">
            {busy ? "Gönderiliyor…" : "Başvur"}
          </button>
        </form>
      )}
    </section>
  );
}
