"use client";

import { type FormEvent, useState } from "react";
import { Check, CirclePlus, CreditCard, X } from "lucide-react";
import { ListFilters } from "@/components/list-filters";
import { PageNotice } from "@/components/page-notice";
import { Pagination } from "@/components/pagination";
import { useActionRunner } from "@/components/use-action-runner";
import { createSubscription, updateSubscription as updateSubscriptionAction } from "@/lib/actions/subscriptions";
import type { MemberOption } from "@/lib/data/members";
import type { SubscriptionRow } from "@/lib/data/subscriptions";

type Subscription = SubscriptionRow;

type SubscriptionForm = {
  member_id: string;
  type: "private_credits" | "group_4_weeks";
  starts_on: string;
  ends_on: string;
  credits_purchased: string;
  amount: string;
  payment_status: "pending" | "paid";
  notes: string;
};

const blankForm: SubscriptionForm = {
  member_id: "",
  type: "group_4_weeks",
  starts_on: "",
  ends_on: "",
  credits_purchased: "4",
  amount: "0",
  payment_status: "pending",
  notes: "",
};

const statusLabels: Record<Subscription["status"], string> = {
  active: "Aktif",
  expired: "Süresi doldu",
  cancelled: "İptal",
};
const typeLabels: Record<Subscription["type"], string> = {
  private_credits: "Özel ders paketi",
  group_4_weeks: "Grup paketi · 4 ders",
};

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function money(value: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(value);
}

export function SubscriptionsManager({
  subscriptions,
  total,
  stats,
  members,
  query,
  status,
  page,
  loadError,
}: {
  subscriptions: Subscription[];
  total: number;
  stats: { total: number; active: number; remainingCredits: number };
  members: MemberOption[];
  query: string;
  status: string;
  page: number;
  loadError: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const { busy, pendingId, error, notice, reset, run } = useActionRunner();

  function openCreate() {
    setForm({ ...blankForm, starts_on: localToday() });
    reset();
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const isGroup = form.type === "group_4_weeks";
    await run(
      () =>
        createSubscription({
          member_id: form.member_id,
          type: form.type,
          starts_on: form.starts_on,
          ends_on: isGroup ? null : form.ends_on || null,
          credits_purchased: isGroup ? 4 : Number(form.credits_purchased),
          amount: Number(form.amount),
          payment_status: form.payment_status,
          notes: form.notes,
        }),
      { onSuccess: () => setFormOpen(false) },
    );
  }

  async function updateSubscription(subscription: Subscription, changes: Partial<Pick<Subscription, "payment_status" | "status">>) {
    if (changes.status && changes.status !== "active" && !window.confirm("Aboneliğin durumu değiştirilsin mi? Bu işlem daha önce tüketilen kredileri geri yüklemez.")) return;
    await run(() => updateSubscriptionAction({ id: subscription.id, ...changes }), { rowId: subscription.id });
  }

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">PAKET VE ÖDEME TAKİBİ</p><h1>Abonelikler</h1><p className="dashboard-subtitle">Ders paketlerini, ödemeleri ve kalan kredileri izleyin.</p></div>
        <button className="primary-action" type="button" onClick={openCreate}><CirclePlus size={17} /> Abonelik ekle</button>
      </div>
      <div className="stat-strip">
        <div><span>Toplam paket</span><strong>{stats.total}</strong></div>
        <div><span>Aktif paket</span><strong>{stats.active}</strong></div>
        <div><span>Kalan toplam kredi</span><strong>{stats.remainingCredits}</strong></div>
      </div>
      <PageNotice error={error} notice={notice} loadError={loadError} loadErrorMessage="Abonelikler yüklenemedi. RLS politikalarını kontrol edin." />

      {formOpen && (
        <section className="form-card">
          <div className="form-card-heading"><div><h2>Yeni abonelik</h2><p>Grup paketi her zaman 4 kredi ve bitiş tarihi olmadan oluşturulur.</p></div><button className="icon-button" type="button" onClick={() => setFormOpen(false)} aria-label="Formu kapat"><X size={18} /></button></div>
          <form className="record-form" onSubmit={handleSubmit}>
            <div className="field-grid">
              <label className="field-wide">Üye *<select required value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })}><option value="">Üye seçin</option>{members.filter((member) => member.is_active).map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}</select></label>
              <label>Paket türü *<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as SubscriptionForm["type"], credits_purchased: e.target.value === "group_4_weeks" ? "4" : "8", ends_on: "" })}><option value="group_4_weeks">Grup paketi · 4 ders</option><option value="private_credits">Özel ders kredisi</option></select></label>
              <label>Başlangıç tarihi *<input required type="date" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} /></label>
              {form.type === "private_credits" ? <><label>Ders kredisi *<input type="number" min="1" max="100" step="1" required value={form.credits_purchased} onChange={(e) => setForm({ ...form, credits_purchased: e.target.value })} /></label><label>Bitiş tarihi *<input required type="date" min={form.starts_on || undefined} value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} /></label></> : <label>Ders kredisi<input readOnly value="4 kredi (sabit)" /></label>}
              <label>Paket tutarı (₺) *<input required type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
              <label>Ödeme durumu<select value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value as SubscriptionForm["payment_status"] })}><option value="pending">Bekliyor</option><option value="paid">Ödendi</option></select></label>
              <label className="field-wide">Notlar<textarea rows={2} maxLength={1500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="İsteğe bağlı notlar" /></label>
            </div>
            <div className="form-actions"><button className="secondary-action" type="button" onClick={() => setFormOpen(false)}>Vazgeç</button><button className="primary-action" type="submit" disabled={busy}>{busy ? "Kaydediliyor…" : "Aboneliği oluştur"}</button></div>
          </form>
        </section>
      )}

      <section className="table-card">
        <div className="table-toolbar"><div><h2>Paket listesi</h2><p>{total} kayıt bulundu</p></div><ListFilters action="/dashboard/subscriptions" query={query} searchPlaceholder="Üye ara…" searchLabel="Abonelik ara"><select className="filter-select" name="status" defaultValue={status} aria-label="Abonelik durumuna göre filtrele"><option value="">Tüm durumlar</option><option value="active">Aktif</option><option value="expired">Süresi doldu</option><option value="cancelled">İptal</option></select></ListFilters></div>
        {stats.total === 0 && !loadError ? (
          <div className="empty-state"><span className="empty-icon"><CreditCard size={24} /></span><h3>Henüz abonelik yok</h3><p>Üye için ilk ders paketini oluşturarak başlayın.</p><button className="secondary-action" type="button" onClick={openCreate}>Abonelik ekle</button></div>
        ) : subscriptions.length === 0 ? <div className="empty-state compact"><h3>Sonuç bulunamadı</h3><p>Arama veya filtre ölçütünü değiştirin.</p></div> : (
          <div className="table-scroll"><table className="data-table"><thead><tr><th>Üye / Paket</th><th>Kredi</th><th>Tutar</th><th>Ödeme</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>
            {subscriptions.map((subscription) => {
              const disabled = pendingId === subscription.id;
              return <tr key={subscription.id}>
                <td><div className="person-cell"><span className="person-avatar"><CreditCard size={15} /></span><span><strong>{subscription.members.full_name}</strong><small>{typeLabels[subscription.type]} · {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(subscription.starts_on))}{subscription.ends_on ? ` – ${new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(subscription.ends_on))}` : " · Bitiş tarihi yok"}</small></span></div></td>
                <td><div className="credit-cell"><strong>{subscription.credits_remaining} / {subscription.credits_purchased}</strong><span className="credit-bar"><span style={{ width: `${Math.min(100, Math.max(0, subscription.credits_remaining / subscription.credits_purchased * 100))}%` }} /></span></div></td>
                <td><strong className="amount-cell">{money(Number(subscription.amount))}</strong></td>
                <td><select className="inline-select" disabled={disabled || subscription.payment_status === "refunded"} value={subscription.payment_status} onChange={(e) => void updateSubscription(subscription, { payment_status: e.target.value as Subscription["payment_status"] })} aria-label="Ödeme durumunu değiştir"><option value="pending">Bekliyor</option><option value="paid">Ödendi</option>{subscription.payment_status === "refunded" && <option value="refunded">İade edildi</option>}</select></td>
                <td><span className={subscription.status === "active" ? "status-pill active-status" : "status-pill inactive-status"}><span />{statusLabels[subscription.status]}</span></td>
                <td>{subscription.status === "active" ? <select className="inline-select" disabled={disabled} value={subscription.status} onChange={(e) => void updateSubscription(subscription, { status: e.target.value as Subscription["status"] })} aria-label="Abonelik durumunu değiştir"><option value="active">Aktif</option><option value="cancelled">İptal et</option><option value="expired">Süresi doldu</option></select> : <button className="icon-button" type="button" disabled={disabled} onClick={() => void updateSubscription(subscription, { status: "active" })} aria-label="Aboneliği yeniden aktifleştir"><Check size={16} /></button>}</td>
              </tr>;
            })}
          </tbody></table></div>
        )}
        <Pagination basePath="/dashboard/subscriptions" params={{ q: query, status }} page={page} total={total} />
      </section>
    </>
  );
}
