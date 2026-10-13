"use client";

import { type FormEvent, useState } from "react";
import { UserRoundPlus, UserRoundX } from "lucide-react";
import { PageNotice } from "@/components/page-notice";
import { useActionRunner } from "@/components/use-action-runner";
import { assignScopedCenterRole, removeScopedCenterRole } from "@/lib/actions/roles";

type Center = { id: string; name: string; organization_id: string };
type CenterRole = {
  center_id: string;
  profile_id: string;
  role: string;
  profile_name: string;
};

const roleNames: Record<string, string> = {
  admin: "Merkez yöneticisi",
  instructor: "Eğitmen",
  ainstructor: "Asistan eğitmen",
};

export function RolesManager({ centers, roles, loadError }: {
  centers: Center[];
  roles: CenterRole[];
  loadError: boolean;
}) {
  const [centerId, setCenterId] = useState(centers[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "instructor" | "ainstructor">("instructor");
  const { run, busy, pendingId, error, notice } = useActionRunner();
  const visible = roles.filter((r) => r.center_id === centerId);

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(() => assignScopedCenterRole({ center_id: centerId, email, role }), {
      onSuccess: () => setEmail(""),
    });
  }

  async function remove(row: CenterRole) {
    if (!window.confirm(row.profile_name + " için " + (roleNames[row.role] ?? row.role) + " yetkisi kaldırılsın mı?")) return;
    await run(() => removeScopedCenterRole({
      center_id: row.center_id,
      profile_id: row.profile_id,
      role: row.role,
    }), { rowId: row.profile_id + row.role });
  }

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">ERİŞİM YÖNETİMİ</p><h1>Merkez rolleri</h1>
          <p className="dashboard-subtitle">Bir kullanıcı farklı merkezlerde farklı roller üstlenebilir. Roller yalnızca seçilen merkez için geçerlidir.</p>
        </div>
      </div>
      <PageNotice error={error} notice={notice} loadError={loadError}
        loadErrorMessage="Rol ve merkez kayıtları yüklenemedi." />
      {centers.length ? (
        <>
          <section className="form-card">
            <div className="form-card-heading"><div><h2>Rol ata</h2>
              <p>E-postası doğrulanmış mevcut bir kullanıcıya bu merkezde yetki verin.</p>
            </div></div>
            <form className="record-form" onSubmit={assign}>
              <div className="field-grid">
                <label>Merkez *
                  <select required value={centerId} onChange={(event) => setCenterId(event.target.value)}>
                    {centers.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label>Kullanıcının giriş e-postası *
                  <input type="email" required maxLength={254} autoComplete="off" value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="egitmen@ornek.com" />
                </label>
                <label>Merkez rolü *
                  <select value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
                    <option value="admin">Merkez yöneticisi</option>
                    <option value="instructor">Eğitmen</option>
                    <option value="ainstructor">Asistan eğitmen</option>
                  </select>
                </label>
              </div>
              <button className="primary-action" type="submit" disabled={busy || !centerId || !email.trim()}>
                <UserRoundPlus size={17} /> {busy ? "Kaydediliyor…" : "Rol ata"}
              </button>
            </form>
          </section>
          <section className="table-card">
            <div className="table-toolbar"><div><h2>Merkezdeki roller</h2>
              <p>{visible.length} yetki ataması</p></div></div>
            {visible.length ? <div className="table-scroll"><table className="data-table">
              <thead><tr><th>Kullanıcı</th><th>Rol</th><th className="actions-head">İşlem</th></tr></thead>
              <tbody>{visible.map((row) => (
                <tr key={row.profile_id + ":" + row.role}>
                  <td>{row.profile_name}</td><td>{roleNames[row.role] ?? row.role}</td>
                  <td><button type="button" className="icon-button"
                    disabled={busy || pendingId === row.profile_id + row.role}
                    onClick={() => void remove(row)}
                    aria-label={row.profile_name + " " + (roleNames[row.role] ?? row.role) + " rolünü kaldır"}
                    title="Bu merkez rolünü kaldır"><UserRoundX size={16} /></button></td>
                </tr>
              ))}</tbody>
            </table></div> : <div className="empty-state compact"><h3>Bu merkezde henüz rol ataması yok</h3></div>}
          </section>
        </>
      ) : <section className="overview-panel"><div className="empty-state"><h3>Yönetebildiğiniz bir merkez bulunamadı</h3></div></section>}
    </>
  );
}
