"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Check, CirclePlus, Edit2, Link2, Unlink2, Mail, Phone, UserRound, UserRoundX, X } from "lucide-react";
import { ListFilters } from "@/components/list-filters";
import { PageNotice } from "@/components/page-notice";
import { Pagination } from "@/components/pagination";
import { useActionRunner } from "@/components/use-action-runner";
import { saveMember, setMemberActive, lookupCenterAccount, linkMemberAccount, unlinkMemberAccount, type CenterAccount } from "@/lib/actions/members";
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
  const [linkingMember, setLinkingMember] = useState<MemberRow | null>(null);
  const [accountEmail, setAccountEmail] = useState("");
  const [candidate, setCandidate] = useState<CenterAccount | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, center_id: centers[0]?.id ?? "" });
  const { busy, pendingId, error, notice, reset, run } = useActionRunner();

  function startCreate() {
    setLinkingMember(null);
    setEditingId(null);
    setForm({ ...emptyForm, center_id: centers[0]?.id ?? "" });
    reset();
    setFormOpen(true);
  }

  function startEdit(member: MemberRow) {
    setLinkingMember(null);
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


  function startAccountLink(member: MemberRow) {
    setFormOpen(false);
    setLinkingMember(member);
    setAccountEmail(member.email ?? "");
    setCandidate(null);
    setLookupError("");
    reset();
  }

  async function checkAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!linkingMember) return;
    setLookupBusy(true);
    setLookupError("");
    setCandidate(null);
    try {
      const result = await lookupCenterAccount({ center_id: linkingMember.center_id, email: accountEmail });
      if (!result.ok) setLookupError(result.error);
      else if (!result.account) setLookupError("Bu e-postayla doğrulanmış bir giriş hesabı bulunamadı.");
      else setCandidate(result.account);
    } catch {
      setLookupError("Hesap sorgulanamadı. Lütfen tekrar deneyin.");
    } finally {
      setLookupBusy(false);
    }
  }

  async function connectAccount() {
    if (!linkingMember || !candidate || (candidate.linked_member_id && candidate.linked_member_id !== linkingMember.id)) return;
    if (!window.confirm(linkingMember.full_name + " kaydı " + candidate.email + " hesabına bağlansın mı?")) return;
    const memberId = linkingMember.id;
    await run(() => linkMemberAccount({ member_id: memberId, email: candidate.email }), {
      rowId: memberId,
      onSuccess: () => { setLinkingMember(null); setCandidate(null); },
    });
  }

  async function disconnectAccount(member: MemberRow) {
    if (!window.confirm(member.full_name + " kaydının giriş hesabı bağlantısı kaldırılsın mı? Üyelik ve geçmiş kayıtlar silinmez.")) return;
    await run(() => unlinkMemberAccount({ member_id: member.id }), { rowId: member.id });
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

      {linkingMember && (
        <section className="form-card" aria-label="Giriş hesabı bağlantısı">
          <div className="form-card-heading">
            <div><h2>Üye ve giriş hesabını eşleştir</h2>
              <p><strong>{linkingMember.full_name}</strong> · {centers.find((center) => center.id === linkingMember.center_id)?.name ?? "Merkez"}</p>
            </div>
            <button className="icon-button" type="button" onClick={() => setLinkingMember(null)} aria-label="Eşleştirmeyi kapat"><X size={18} /></button>
          </div>
          <p className="dashboard-subtitle">Yalnızca e-postası doğrulanmış mevcut bir hesap bağlanabilir. Üyenin iletişim e-postası girilmişse giriş hesabının e-postasıyla aynı olmalıdır.</p>
          <form className="record-form" onSubmit={checkAccount}>
            <div className="field-grid">
              <label>Giriş hesabı e-postası *
                <input type="email" required maxLength={254} autoComplete="off" value={accountEmail}
                  onChange={(event) => { setAccountEmail(event.target.value); setCandidate(null); setLookupError(""); }}
                  placeholder="kullanici@ornek.com" />
              </label>
            </div>
            <div className="form-actions">
              <button className="secondary-action" type="button" onClick={() => setLinkingMember(null)}>Vazgeç</button>
              <button className="primary-action" type="submit" disabled={lookupBusy || busy}>{lookupBusy ? "Kontrol ediliyor…" : "Hesabı doğrula"}</button>
            </div>
          </form>
          {lookupError && <div className="notice error" role="alert">{lookupError}</div>}
          {candidate && (
            <div className="record-form">
              <p className="dashboard-subtitle"><strong>Doğrulanan hesap:</strong> {candidate.full_name || "İsimsiz kullanıcı"} · {candidate.email}</p>
              {candidate.linked_member_id && candidate.linked_member_id !== linkingMember.id
                ? <div className="notice error" role="alert">Bu hesap aynı merkezde başka bir üye kaydına bağlı. Mükerrer eşleştirme yapılamaz.</div>
                : linkingMember.profile_id && linkingMember.profile_id !== candidate.profile_id
                  ? <div className="notice error" role="alert">Üye farklı bir giriş hesabına bağlı. Önce mevcut bağlantıyı kaldırın.</div>
                  : <button type="button" className="primary-action" onClick={() => void connectAccount()} disabled={busy}>Doğrulanan hesabı üyeye bağla</button>}
            </div>
          )}
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
              <thead><tr><th>Üye</th><th>Merkez</th><th>İletişim</th><th>Durum</th><th>Giriş hesabı</th><th className="actions-head">İşlem</th></tr></thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td><div className="person-cell"><span className="person-avatar">{member.full_name.trim().slice(0, 1).toLocaleUpperCase("tr-TR")}</span><span><strong>{member.full_name}</strong><small>Eklenme: {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(member.created_at))}</small></span></div></td>
                    <td>{centers.find((center) => center.id === member.center_id)?.name ?? "Merkez"}</td>
                    <td><div className="contact-cell">{member.phone && <span><Phone size={13} />{member.phone}</span>}{member.email && <span><Mail size={13} />{member.email}</span>}{!member.phone && !member.email && <span className="subtle">Bilgi girilmedi</span>}</div></td>
                    <td><span className={member.is_active ? "status-pill active-status" : "status-pill inactive-status"}><span />{member.is_active ? "Aktif" : "Pasif"}</span></td>
                    <td><span className={member.profile_id ? "status-pill active-status" : "status-pill inactive-status"}><span />{member.profile_id ? "Bağlı" : "Bağlı değil"}</span></td>
                    <td><div className="row-actions">
                      {member.profile_id
                        ? <button className="icon-button" type="button" disabled={busy || pendingId === member.id} onClick={() => void disconnectAccount(member)} aria-label={member.full_name + " giriş hesabı bağlantısını kaldır"} title="Hesap bağlantısını kaldır"><Unlink2 size={16} /></button>
                        : <button className="icon-button" type="button" onClick={() => startAccountLink(member)} aria-label={member.full_name + " giriş hesabını bağla"} title="Giriş hesabı bağla"><Link2 size={16} /></button>}
                      <Link className="text-action" href={"/dashboard/payments?action=collect&member_id="+member.id}>Tahsilat</Link><Link className="text-action" href={"/dashboard/catalog?member_id="+member.id}>Paket</Link><button className="icon-button" type="button" onClick={() => startEdit(member)} aria-label={`${member.full_name} bilgilerini düzenle`}><Edit2 size={16} /></button><button className="icon-button" type="button" disabled={pendingId === member.id} onClick={() => void toggleActive(member)} aria-label={member.is_active ? "Üyeyi pasife al" : "Üyeyi aktifleştir"}>{member.is_active ? <UserRoundX size={16} /> : <Check size={16} />}</button></div></td>
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
