"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useActionRunner } from "./use-action-runner";
import { PageNotice } from "./page-notice";
import { openRegistrationDocument } from "@/lib/registration-documents";
import { roadmapCommand } from "@/lib/actions/roadmap";
import type { WorkspaceData as RoadmapData } from "@/lib/workspace";
export function RegistrationSelf({
  data,
  userId,
}: {
  data: RoadmapData;
  userId: string;
}) {
  const router = useRouter();
  const members = (data.members ?? []).filter((m) => m.profile_id === userId);
  const [memberId, setMemberId] = useState(String(members[0]?.id ?? ""));
  const { busy, error, notice, run: execute } = useActionRunner();
  const member = members.find((m) => m.id === memberId);
  const policies = (data.policies ?? []).filter(
    (p) =>
      p.organization_id === member?.organization_id &&
      (!p.center_id || p.center_id === member?.center_id),
  );
  const documents = (data.documents ?? []).filter(
    (d) => d.member_id === memberId,
  );
  const accepted = (id: unknown) =>
    data.acceptances?.some(
      (a) => a.member_id === memberId && a.policy_id === id,
    );
  async function run(input: unknown) {
    return execute(() => roadmapCommand("registration", input), {
      onSuccess: () => router.refresh(),
    });
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await run({
      action: "details",
      member_id: memberId,
      phone: String(f.get("phone") ?? ""),
      emergency_name: String(f.get("emergency_name") ?? ""),
      emergency_phone: String(f.get("emergency_phone") ?? ""),
      marketing_opt_in: f.get("marketing_opt_in") === "on",
    });
  }
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const file = f.get("file");
    if (!(file instanceof File) || !file.size) return;
    await execute(
      async () => {
        if (
          file.size > 5242880 ||
          !["application/pdf", "image/jpeg", "image/png"].includes(file.type)
        )
          return {
            ok: false,
            error: "En fazla 5 MB PDF, JPEG veya PNG yükleyin.",
          };
        const path =
          userId +
          "/" +
          memberId +
          "/" +
          crypto.randomUUID() +
          "." +
          (
            {
              "application/pdf": "pdf",
              "image/jpeg": "jpg",
              "image/png": "png",
            } as Record<string, string>
          )[file.type];
        const { error } = await createClient()
          .storage.from("registration-documents")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) return { ok: false, error: "Belge yüklenemedi." };
        return roadmapCommand("registration", {
          action: "document",
          member_id: memberId,
          title: String(f.get("title")),
          object_path: path,
        });
      },
      { onSuccess: () => router.refresh() },
    );
  }
  async function download(path: string) {
    await execute(() => openRegistrationDocument(path));
  }
  if (!members.length)
    return (
      <p>
        Bilgi ve onay girişi için giriş hesabınızın öğrenci kaydıyla
        eşleştirilmesi gerekir.
      </p>
    );
  return (
    <>
      <section className="form-card">
        <h2>Kayıt bilgilerim</h2>
        <label>
          Öğrenci kaydı
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
          >
            {members.map((m) => (
              <option key={String(m.id)} value={String(m.id)}>
                {String(m.full_name)}
              </option>
            ))}
          </select>
        </label>
        <p>
          {member?.missing
            ? "Eksik: " + String(member.missing)
            : "Kayıt gereksinimleri tamamlandı."}
        </p>
        <form
          key={memberId + String(member?.updated_at ?? "")}
          className="record-form"
          onSubmit={save}
        >
          <div className="field-grid">
            <label>
              Telefon
              <input
                name="phone"
                required
                minLength={7}
                maxLength={40}
                defaultValue={String(member?.phone ?? "")}
              />
            </label>
            <label>
              Acil durumda aranacak kişi
              <input
                name="emergency_name"
                maxLength={160}
                defaultValue={String(member?.emergency_name ?? "")}
              />
            </label>
            <label>
              Acil iletişim telefonu
              <input
                name="emergency_phone"
                maxLength={40}
                defaultValue={String(member?.emergency_phone ?? "")}
              />
            </label>
            <label>
              <input
                type="checkbox"
                name="marketing_opt_in"
                defaultChecked={Boolean(member?.marketing_opt_in)}
              />
              Pazarlama iletişimi almak istiyorum (isteğe bağlı)
            </label>
          </div>
          <button disabled={busy} type="submit">
            Bilgilerimi kaydet
          </button>
        </form>
      </section>
      <section className="form-card">
        <h2>Kurallar ve onaylar</h2>
        {policies.map((p) => (
          <article key={String(p.id)}>
            <h3>
              {String(p.title)} · {p.required ? "Zorunlu" : "İsteğe bağlı"}
            </h3>
            <p>Yayımlanma: {String(p.published_at).slice(0, 10)}</p>
            <p style={{ whiteSpace: "pre-wrap" }}>{String(p.body)}</p>
            {accepted(p.id) ? (
              <p>Kabul edildi.</p>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await run({
                    action: "accept",
                    member_id: memberId,
                    policy_id: p.id,
                  });
                }}
              >
                <label>
                  <input type="checkbox" required disabled={busy} />
                  Bu metni okudum ve kabul ediyorum.
                </label>
                <button type="submit" disabled={busy}>
                  Kabulü kaydet
                </button>
              </form>
            )}
          </article>
        ))}
      </section>
      <section className="form-card">
        <h2>Belgelerim</h2>
        <form onSubmit={upload} className="record-form">
          <label>
            Belge adı
            <input name="title" required maxLength={160} />
          </label>
          <label>
            Belge (PDF/JPEG/PNG, en fazla 5 MB)
            <input
              type="file"
              name="file"
              required
              accept="application/pdf,image/jpeg,image/png"
            />
          </label>
          <button disabled={busy} type="submit">
            Belgeyi yükle
          </button>
        </form>
        {documents.map((d) => (
          <p key={String(d.id)}>
            <button
              disabled={busy}
              type="button"
              onClick={() => download(String(d.object_path))}
            >
              {String(d.title)}
            </button>
          </p>
        ))}
      </section>
      <PageNotice error={error} notice={notice} loadError={false} />
    </>
  );
}
