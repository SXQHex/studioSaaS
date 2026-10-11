"use client";

import { type FormEvent, useState } from "react";
import { ArrowDownRight, ArrowUpRight, History, PlusCircle } from "lucide-react";
import { ListFilters } from "@/components/list-filters";
import { PageNotice } from "@/components/page-notice";
import { Pagination } from "@/components/pagination";
import { useActionRunner } from "@/components/use-action-runner";
import { adjustCredits } from "@/lib/actions/credits";
import type { CreditReason, TransactionRow } from "@/lib/data/credits";
import type { ActiveSubscription } from "@/lib/data/subscriptions";

const reasonLabels: Record<CreditReason, string> = {
  purchase: "Paket alımı",
  lesson_use: "Ders kullanımı",
  admin_adjustment: "Yönetici düzeltmesi",
  refund: "İade",
};
const typeLabels: Record<ActiveSubscription["type"], string> = {
  private_credits: "Özel ders",
  group_4_weeks: "Grup paketi",
};

export function CreditsManager({
  transactions,
  total,
  subscriptions,
  query,
  page,
  loadError,
}: {
  transactions: TransactionRow[];
  total: number;
  subscriptions: ActiveSubscription[];
  query: string;
  page: number;
  loadError: boolean;
}) {
  const [subscriptionId, setSubscriptionId] = useState("");
  const [amount, setAmount] = useState("1");
  const [note, setNote] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const { busy, error, notice, setError, reset, run } = useActionRunner();

  const selectedSubscription = subscriptions.find((subscription) => subscription.id === subscriptionId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    reset();
    const delta = Number(amount);
    if (!selectedSubscription) {
      setError("Kredi düzeltmesi için bir aktif abonelik seçin.");
      return;
    }
    if (
      selectedSubscription.credits_remaining + delta < 0 ||
      selectedSubscription.credits_remaining + delta > selectedSubscription.credits_purchased
    ) {
      setError("Bu değişiklik kredi bakiyesini 0 ile satın alınan kredi sayısı aralığının dışına çıkarıyor.");
      return;
    }
    if (!window.confirm(`${selectedSubscription.members.full_name} için kredi bakiyesi ${delta > 0 ? "+" : ""}${delta} değiştirilecek. Devam edilsin mi?`)) return;

    await run(() => adjustCredits({ subscription_id: selectedSubscription.id, amount: delta, note }), {
      onSuccess: () => {
        setAmount("1");
        setNote("");
        setFormOpen(false);
      },
    });
  }

  const positiveTotal = transactions.filter((transaction) => transaction.amount > 0).reduce((sum, transaction) => sum + transaction.amount, 0);
  const negativeTotal = transactions.filter((transaction) => transaction.amount < 0).reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">BAKİYE VE HAREKETLER</p><h1>Kredi hareketleri</h1><p className="dashboard-subtitle">Tüm kredi değişikliklerini izleyin; manuel düzeltmeleri açıklama ile kaydedin.</p></div>
        <button className="primary-action" type="button" onClick={() => { setFormOpen((value) => !value); reset(); }}><PlusCircle size={17} /> Kredi düzelt</button>
      </div>

      <div className="stat-strip">
        <div><span>İşlem kaydı</span><strong>{total}</strong></div>
        <div><span>Bu sayfada eklenen</span><strong className="positive-number">+{positiveTotal}</strong></div>
        <div><span>Bu sayfada kullanılan</span><strong className="negative-number">−{negativeTotal}</strong></div>
      </div>

      <PageNotice error={error} notice={notice} loadError={loadError} loadErrorMessage="Kredi hareketleri yüklenemedi. RLS politikalarını kontrol edin." />

      {formOpen && <section className="form-card">
        <div className="form-card-heading"><div><h2>Manuel kredi düzeltmesi</h2><p>Pozitif değer kredi ekler, negatif değer kredi düşer. Geçmiş kayıtlar silinmez.</p></div><span className="panel-icon"><History size={19} /></span></div>
        <form className="record-form" onSubmit={handleSubmit}>
          <div className="field-grid">
            <label className="field-wide">Üye paketi *<select required value={subscriptionId} onChange={(e) => setSubscriptionId(e.target.value)}><option value="">Aktif abonelik seçin</option>{subscriptions.map((subscription) => <option key={subscription.id} value={subscription.id}>{subscription.members.full_name} · {typeLabels[subscription.type]} · {subscription.credits_remaining}/{subscription.credits_purchased} kredi</option>)}</select></label>
            <label>Kredi değişimi *<input required type="number" step="1" min="-100" max="100" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <label className="field-wide">Açıklama *<textarea required rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Düzeltme nedeni" /></label>
          </div>
          {selectedSubscription && <p className="inline-info"><History size={15} /> Mevcut bakiye: {selectedSubscription.credits_remaining}. İşlem sonrası bakiye {selectedSubscription.credits_remaining + (Number(amount) || 0)} olacak.</p>}
          <div className="form-actions"><button className="secondary-action" type="button" onClick={() => setFormOpen(false)}>Vazgeç</button><button className="primary-action" type="submit" disabled={busy || subscriptions.length === 0}>{busy ? "Kaydediliyor…" : "Düzeltmeyi kaydet"}</button></div>
        </form>
      </section>}

      <section className="table-card">
        <div className="table-toolbar"><div><h2>Hareket geçmişi</h2><p>{total} işlem bulundu</p></div><ListFilters action="/dashboard/credits" query={query} searchPlaceholder="Üye veya açıklama ara…" searchLabel="Kredi hareketlerinde ara" /></div>
        {total === 0 && !query && !loadError ? (
          <div className="empty-state"><span className="empty-icon"><History size={24} /></span><h3>Henüz kredi hareketi yok</h3><p>Abonelik oluşturulduğunda satın alma hareketi otomatik kaydedilir.</p></div>
        ) : transactions.length === 0 ? <div className="empty-state compact"><h3>Sonuç bulunamadı</h3><p>Arama ölçütünü değiştirin.</p></div> : (
          <div className="table-scroll"><table className="data-table"><thead><tr><th>Tarih</th><th>Üye / Paket</th><th>İşlem</th><th>Değişim</th><th>Açıklama</th></tr></thead><tbody>
            {transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(transaction.created_at))}</td>
                <td><div className="person-cell"><span className="person-avatar"><History size={15} /></span><span><strong>{transaction.members.full_name}</strong><small>{transaction.subscriptions ? typeLabels[transaction.subscriptions.type] : "Paket kaydı yok"}</small></span></div></td>
                <td><span className="reason-pill">{reasonLabels[transaction.reason]}</span></td>
                <td><strong className={transaction.amount > 0 ? "positive-number" : "negative-number"}>{transaction.amount > 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}{transaction.amount > 0 ? "+" : ""}{transaction.amount}</strong></td>
                <td>{transaction.note || "—"}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}
        <Pagination basePath="/dashboard/credits" params={{ q: query }} page={page} total={total} />
      </section>
    </>
  );
}
