"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { changeMyPassword, updateMyProfile } from "@/lib/actions/account";

export function AccountSettings({
  fullName,
  email,
}: {
  fullName: string;
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(fullName);
  const [nameBusy, setNameBusy] = useState(false);
  const [nameError, setNameError] = useState("");
  const [nameSuccess, setNameSuccess] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNameBusy(true);
    setNameError("");
    setNameSuccess("");
    try {
      const result = await updateMyProfile({ full_name: name });
      if (!result.ok) setNameError(result.error);
      else {
        setNameSuccess(result.message);
        router.refresh();
      }
    } catch {
      setNameError("Profil güncellenemedi. Tekrar deneyin.");
    } finally {
      setNameBusy(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    if (newPassword !== confirmPassword) {
      setPasswordError("Yeni şifreler eşleşmiyor.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Yeni şifre en az sekiz karakter olmalı.");
      return;
    }
    setPasswordBusy(true);
    try {
      const result = await changeMyPassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      if (!result.ok) setPasswordError(result.error);
      else {
        setPasswordSuccess(result.message);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setPasswordError("Şifre değiştirilemedi. Tekrar deneyin.");
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <>
      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Profil bilgilerim</h2>
            <p>Bu ad, FTK Studio içinde profil adınız olarak gösterilir.</p>
          </div>
        </div>
        <form className="record-form" onSubmit={saveName}>
          <div className="field-grid">
            <label>
              Ad soyad *
              <input
                type="text"
                autoComplete="name"
                required
                minLength={2}
                maxLength={160}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              Giriş e-postası
              <input
                type="email"
                value={email}
                readOnly
                aria-readonly="true"
                title="E-posta değiştirme, doğrulama gerektirdiğinden bu ekranda kapalıdır."
              />
            </label>
          </div>
          {nameError && (
            <p className="notice error" role="alert">
              {nameError}
            </p>
          )}
          {nameSuccess && (
            <p className="notice success" role="status">
              {nameSuccess}
            </p>
          )}
          <div className="form-actions">
            <button
              className="primary-action"
              type="submit"
              disabled={nameBusy || name.trim().length < 2}
            >
              {nameBusy ? "Kaydediliyor…" : "Profil adını kaydet"}
            </button>
          </div>
        </form>
      </section>
      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Şifremi değiştir</h2>
            <p>
              Güvenlik için mevcut şifreniz doğrulanır. Şifreler uygulama
              veritabanında saklanmaz.
            </p>
          </div>
        </div>
        <form className="record-form" onSubmit={savePassword}>
          <div className="field-grid">
            <label>
              Mevcut şifre *
              <input
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label>
              Yeni şifre *
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label>
              Yeni şifre (tekrar) *
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
          </div>
          {passwordError && (
            <p className="notice error" role="alert">
              {passwordError}
            </p>
          )}
          {passwordSuccess && (
            <p className="notice success" role="status">
              {passwordSuccess}
            </p>
          )}
          <div className="form-actions">
            <button
              className="primary-action"
              type="submit"
              disabled={passwordBusy}
            >
              {passwordBusy ? "Güncelleniyor…" : "Şifreyi değiştir"}
            </button>
          </div>
        </form>
        <p className="dashboard-footnote">
          Mevcut şifrenizi hatırlamıyorsanız{" "}
          <Link href="/login">giriş sayfasından Şifremi unuttum</Link> adımını
          kullanın.
        </p>
      </section>
    </>
  );
}
