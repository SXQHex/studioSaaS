"use client";

import { type FormEvent, useState } from "react";
import { Check, CirclePlus, Edit2, Mail, Phone, UserRound, UserRoundX, X } from "lucide-react";
import { ListFilters } from "@/components/list-filters";
import { PageNotice } from "@/components/page-notice";
import { Pagination } from "@/components/pagination";
import { useActionRunner } from "@/components/use-action-runner";
import { saveMember, setMemberActive } from "@/lib/actions/members";
import type { MemberRow } from "@/lib/data/members";
import type { CenterOption } from "@/lib/data/session-requests";

const emptyForm = { center_id: "", full_name: "", phone: "", email: "", notes: "", is_active: true };

export function MembersManager({
  members,
  centers,
  total,
  stats,
  query,
  page,
  loadError,
}: {
  members: MemberRow[];
  centers: CenterOption[];
  total: number;
  stats: { total: number; active: number; inactive: number };
  query: string;
  page: number;
  loadError: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm, center_id: centers[0]?.id ?? "" });
  const { busy, pendingId, error, notice, reset, run } = useActionRunner();

  function startCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, center_id: centers[0]?.id ?? "" });
    reset();
    setFormOpen(true);
  }

  function startEdit(member: MemberRow) {
    setEditingId(member.id);
    setForm({
      center_id: member.center_id,
      full_name: member.full_name,
      phone: member.phone ?? "",
      email: member.email ?? "",
      notes: member.notes ?? "",
      is_active: member.is_active,
    });
    reset();
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(() => saveMember(editingId, form), {
      onSuccess: () => {
        setFormOpen(false);
        setEditingId(null);
        setForm({ ...emptyForm, center_id: centers[0]?.id ?? "" });
      },
    });
  }

  async function toggleActive(member: MemberRow) {
    await run(() => setMemberActive({ id: member.id, is_active: !member.is_active }), { rowId: member.id });
  }

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">ÜYE KAYITLARI</p><h1>Üyeler</h1><p className="dashboard-subtitle">Üye bilgilerini ve aktiflik durumunu yönetin.</p></div>
        <button className="primary-action" type="button" onClick={startCreate}><CirclePlus size={17} /> Yeni üye</button>
      </div>

      <div className="stat-strip">
        <div><span>Toplam üye</span><strong>{stats.total}</strong></div>
        <div><span>Aktif</span><strong>{stats.active}</strong></div>
        <div><span>Pasif</span><strong>{stats.inactive}</strong></div>
      </div>

      <PageNotice error={error} notice={notice} loadError={loadError} loadErrorMessage="Üyeler yüklenemedi. RLS politikalarını ve yönetici rolünü kontrol edin." />

      {formOpen && (
        <section className="form-card">
          <div className="form-card-heading"><div><h2>{editingId ? "Üye bilgilerini düzenle" : "Yeni üye kaydı"}</h2><p>Yıldızlı alanlar zorunludur.</p></div><button className="icon-button" type="button" onClick={() => setFormOpen(false)} aria-label="Formu kapat"><X size={18} /></button></div>
          <form className="record-form" onSubmit={handleSubmit}>
            <div className="field-grid">
              <label>Merkez *<select required disabled={Boolean(editingId)} value={form.center_id} onChange={(e) => setForm({ ...form, center_id: e.target.value })}><option value="">Merkez seçin</option>{centers.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}</select></label>
              <label>Ad soyad *<input required maxLength={160} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Üyenin adı soyadı" /></label>
              <label>Telefon<input type="tel" maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+90 5xx xxx xx xx" /></label>
              <label>E-posta<input type="email" maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="uye@ornek.com" /></label>
              <label className="field-wide">Notlar<textarea maxLength={2000} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="İsteğe bağlı notlar" /></label>
              <label className="check-field"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Üye aktif</label>
            </div>
            <div className="form-actions"><button className="secondary-action" type="button" onClick={() => setFormOpen(false)}>Vazgeç</button><button className="primary-action" type="submit" disabled={busy}>{busy ? "Kaydediliyor…" : editingId ? "Değişiklikleri kaydet" : "Üyeyi kaydet"}</button></div>
          </form>
        </section>
      )}

      <section className="table-card">
        <div className="table-toolbar"><div><h2>Üye listesi</h2><p>{total} kayıt bulundu</p></div><ListFilters action="/dashboard/members" query={query} searchPlaceholder="Üye ara…" searchLabel="Üye ara" /></div>
        {stats.total === 0 && !loadError ? (
          <div className="empty-state"><span className="empty-icon"><UserRound size={24} /></span><h3>Henüz üye yok</h3><p>İlk üye kaydınızı oluşturarak başlayın.</p><button className="secondary-action" onClick={startCreate} type="button">Üye ekle</button></div>
        ) : members.length === 0 ? (
          <div className="empty-state compact"><h3>Sonuç bulunamadı</h3><p>Arama ölçütünü değiştirin.</p></div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Üye</th><th>Merkez</th><th>İletişim</th><th>Durum</th><th className="actions-head">İşlem</th></tr></thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td><div className="person-cell"><span className="person-avatar">{member.full_name.trim().slice(0, 1).toLocaleUpperCase("tr-TR")}</span><span><strong>{member.full_name}</strong><small>Eklenme: {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(member.created_at))}</small></span></div></td>
                    <td>{centers.find((center) => center.id === member.center_id)?.name ?? "Merkez"}</td>
                    <td><div className="contact-cell">{member.phone && <span><Phone size={13} />{member.phone}</span>}{member.email && <span><Mail size={13} />{member.email}</span>}{!member.phone && !member.email && <span className="subtle">Bilgi girilmedi</span>}</div></td>
                    <td><span className={member.is_active ? "status-pill active-status" : "status-pill inactive-status"}><span />{member.is_active ? "Aktif" : "Pasif"}</span></td>
                    <td><div className="row-actions"><button className="icon-button" type="button" onClick={() => startEdit(member)} aria-label={`${member.full_name} bilgilerini düzenle`}><Edit2 size={16} /></button><button className="icon-button" type="button" disabled={pendingId === member.id} onClick={() => void toggleActive(member)} aria-label={member.is_active ? "Üyeyi pasife al" : "Üyeyi aktifleştir"}>{member.is_active ? <UserRoundX size={16} /> : <Check size={16} />}</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination basePath="/dashboard/members" params={{ q: query }} page={page} total={total} />
      </section>
    </>
  );
}
