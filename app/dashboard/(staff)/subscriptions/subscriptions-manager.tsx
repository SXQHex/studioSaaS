"use client";

import Link from "next/link";
import { studioDate } from "@/lib/studio-date";
import { Check, CirclePlus, CreditCard } from "lucide-react";
import { ListFilters } from "@/components/list-filters";
import { PageNotice } from "@/components/page-notice";
import { Pagination } from "@/components/pagination";
import { useActionRunner } from "@/components/use-action-runner";
import { updateSubscription as updateSubscriptionAction } from "@/lib/actions/subscriptions";
import type { SubscriptionRow } from "@/lib/data/subscriptions";

type Subscription = SubscriptionRow;

const statusLabels: Record<Subscription["status"], string> = {
  active: "Aktif",
  expired: "Süresi doldu",
  cancelled: "İptal",
};
const typeLabels: Record<Subscription["type"], string> = {
  private_credits: "Özel ders paketi",
  group_4_weeks: "Grup paketi",
};

function money(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(value);
}

export function SubscriptionsManager({
  subscriptions,
  total,
  stats,
  query,
  status,
  page,
  loadError,
}: {
  subscriptions: Subscription[];
  total: number;
  stats: { total: number; active: number; remainingCredits: number };
  query: string;
  status: string;
  page: number;
  loadError: boolean;
}) {
  const { pendingId, error, notice, run } = useActionRunner();

  async function updateSubscription(
    subscription: Subscription,
    changes: Partial<Pick<Subscription, "payment_status" | "status">>,
  ) {
    if (
      changes.status &&
      changes.status !== "active" &&
      !window.confirm(
        "Aboneliğin durumu değiştirilsin mi? Bu işlem daha önce tüketilen kredileri geri yüklemez.",
      )
    )
      return;
    await run(
      () => updateSubscriptionAction({ id: subscription.id, ...changes }),
      { rowId: subscription.id },
    );
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PAKET VE ÖDEME TAKİBİ</p>
          <h1>Abonelikler</h1>
          <p className="dashboard-subtitle">
            Ders paketlerini, ödemeleri ve kalan kredileri izleyin.
          </p>
        </div>
        <Link className="primary-action" href="/dashboard/catalog">
          <CirclePlus size={17} /> Paket sat
        </Link>
      </div>
      <div className="stat-strip">
        <div>
          <span>Toplam paket</span>
          <strong>{stats.total}</strong>
        </div>
        <div>
          <span>Aktif paket</span>
          <strong>{stats.active}</strong>
        </div>
        <div>
          <span>Kalan toplam kredi</span>
          <strong>{stats.remainingCredits}</strong>
        </div>
      </div>
      <PageNotice
        error={error}
        notice={notice}
        loadError={loadError}
        loadErrorMessage="Abonelikler yüklenemedi. RLS politikalarını kontrol edin."
      />

      <section className="table-card">
        <div className="table-toolbar">
          <div>
            <h2>Paket listesi</h2>
            <p>{total} kayıt bulundu</p>
          </div>
          <ListFilters
            action="/dashboard/subscriptions"
            query={query}
            searchPlaceholder="Üye ara…"
            searchLabel="Abonelik ara"
          >
            <select
              className="filter-select"
              name="status"
              defaultValue={status}
              aria-label="Abonelik durumuna göre filtrele"
            >
              <option value="">Tüm durumlar</option>
              <option value="active">Aktif</option>
              <option value="expired">Süresi doldu</option>
              <option value="cancelled">İptal</option>
            </select>
          </ListFilters>
        </div>
        {stats.total === 0 && !loadError ? (
          <div className="empty-state">
            <span className="empty-icon">
              <CreditCard size={24} />
            </span>
            <h3>Henüz abonelik yok</h3>
            <p>Üye için ilk ders paketini oluşturarak başlayın.</p>
            <Link className="secondary-action" href="/dashboard/catalog">
              Paket sat
            </Link>
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="empty-state compact">
            <h3>Sonuç bulunamadı</h3>
            <p>Arama veya filtre ölçütünü değiştirin.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Üye / Paket</th>
                  <th>Kredi</th>
                  <th>Tutar</th>
                  <th>Ödeme</th>
                  <th>Durum</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((subscription) => {
                  const disabled = pendingId === subscription.id;
                  return (
                    <tr key={subscription.id}>
                      <td>
                        <div className="person-cell">
                          <span className="person-avatar">
                            <CreditCard size={15} />
                          </span>
                          <span>
                            <strong>{subscription.members.full_name}</strong>
                            <small>
                              {subscription.catalog_snapshot &&
                              typeof subscription.catalog_snapshot ===
                                "object" &&
                              !Array.isArray(subscription.catalog_snapshot) &&
                              typeof subscription.catalog_snapshot.name ===
                                "string"
                                ? subscription.catalog_snapshot.name
                                : typeLabels[subscription.type]}{" "}
                              · {studioDate(subscription.starts_on)}
                              {subscription.effective_ends_on
                                ? ` – ${studioDate(subscription.effective_ends_on)}`
                                : " · Bitiş tarihi yok"}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="credit-cell">
                          <strong>
                            {subscription.credits_remaining} /{" "}
                            {subscription.credits_purchased}
                          </strong>
                          <span className="credit-bar">
                            <span
                              style={{
                                width: `${Math.min(100, Math.max(0, (subscription.credits_remaining / subscription.credits_purchased) * 100))}%`,
                              }}
                            />
                          </span>
                        </div>
                      </td>
                      <td>
                        <strong className="amount-cell">
                          {money(Number(subscription.amount))}
                        </strong>
                      </td>
                      <td>
                        {subscription.payment_status === "paid"
                          ? "Ödendi"
                          : subscription.payment_status === "refunded"
                            ? "İade edildi"
                            : "Bekliyor"}
                        <a className="block" href="/dashboard/payments">
                          Tahsilat defteri
                        </a>
                      </td>
                      <td>
                        <span
                          className={
                            subscription.status === "active"
                              ? "status-pill active-status"
                              : "status-pill inactive-status"
                          }
                        >
                          <span />
                          {statusLabels[subscription.status]}
                        </span>
                      </td>
                      <td>
                        {subscription.status === "active" ? (
                          <select
                            className="inline-select"
                            disabled={disabled}
                            value={subscription.status}
                            onChange={(e) =>
                              void updateSubscription(subscription, {
                                status: e.target
                                  .value as Subscription["status"],
                              })
                            }
                            aria-label="Abonelik durumunu değiştir"
                          >
                            <option value="active">Aktif</option>
                            <option value="cancelled">İptal et</option>
                            <option value="expired">Süresi doldu</option>
                          </select>
                        ) : (
                          <button
                            className="icon-button"
                            type="button"
                            disabled={disabled}
                            onClick={() =>
                              void updateSubscription(subscription, {
                                status: "active",
                              })
                            }
                            aria-label="Aboneliği yeniden aktifleştir"
                          >
                            <Check size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          basePath="/dashboard/subscriptions"
          params={{ q: query, status }}
          page={page}
          total={total}
        />
      </section>
    </>
  );
}
