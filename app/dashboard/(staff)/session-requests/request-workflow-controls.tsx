"use client";

import { useState, type FormEvent } from "react";
import { PageNotice } from "@/components/page-notice";
import { useActionRunner } from "@/components/use-action-runner";
import {
  reviewSessionRequest,
  withdrawSessionRequest,
  proposeSessionRequestAlternative,
  respondSessionRequestAlternative,
} from "@/lib/actions/session-requests";
import type { SessionRequestRow } from "@/lib/data/session-requests";
import { studioDateTime, studioInputToIso } from "@/lib/studio-date";

const actions: Record<string, string> = {
  created: "Talep oluşturuldu",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  withdrawn: "Geri çekildi",
  alternative_proposed: "Alternatif saat önerildi",
  alternative_accepted: "Alternatif kabul edildi; onay bekliyor",
  alternative_declined: "Alternatif kabul edilmedi",
};
export function RequestHistory({ request }: { request: SessionRequestRow }) {
  return (
    <details>
      <summary>İşlem geçmişi</summary>
      {request.events.length ? (
        <ul>
          {request.events.map((event) => {
            const detail =
              event.details &&
              typeof event.details === "object" &&
              !Array.isArray(event.details)
                ? event.details
                : {};
            const start =
              event.action === "alternative_proposed"
                ? detail.alternative_starts_at
                : detail.starts_at;
            const end =
              event.action === "alternative_proposed"
                ? detail.alternative_ends_at
                : detail.ends_at;
            return (
              <li key={event.id}>
                <strong>{actions[event.action] ?? event.action}</strong>
                <small className="block">
                  {studioDateTime(event.created_at)} ·{" "}
                  {event.actor_id === request.requested_by
                    ? "Talep sahibi"
                    : "Yönetici"}
                </small>
                {typeof start === "string" && typeof end === "string" && (
                  <small className="block">
                    {studioDateTime(start)} – {studioDateTime(end)}
                  </small>
                )}
                {event.note && <small className="block">{event.note}</small>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p>Bu talep için henüz yeni işlem kaydı yok.</p>
      )}
    </details>
  );
}

export function RequestWorkflowControls({
  request,
  isAdmin,
  currentUserId,
  pendingGroups,
}: {
  request: SessionRequestRow;
  isAdmin: boolean;
  currentUserId: string;
  pendingGroups: number;
}) {
  const [note, setNote] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [alternativeNote, setAlternativeNote] = useState("");
  const { busy, error, notice, run } = useActionRunner();
  const own = request.requested_by === currentUserId;
  const offered = Boolean(request.alternative_proposed_at);
  async function propose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(
      () =>
        proposeSessionRequestAlternative({
          id: request.id,
          starts_at: studioInputToIso(start),
          ends_at: studioInputToIso(end),
          note: alternativeNote,
        }),
      {
        onSuccess: () => {
          setStart("");
          setEnd("");
          setAlternativeNote("");
        },
      },
    );
  }
  async function review(approve: boolean) {
    if (
      approve &&
      !window.confirm(
        "Oda ve eğitmen uygunluğu yeniden kontrol edilerek ders kesinleştirilecek. Onaylıyor musunuz?",
      )
    )
      return;
    await run(() =>
      reviewSessionRequest({
        id: request.id,
        approve,
        note: note.trim() || null,
      }),
    );
  }
  return (
    <div className="request-workflow">
      <PageNotice
        error={error}
        notice={notice}
        loadError={false}
        loadErrorMessage=""
      />
      {offered &&
        request.alternative_starts_at &&
        request.alternative_ends_at && (
          <div>
            <strong>Alternatif saat · yanıt bekliyor</strong>
            <small className="block">
              {studioDateTime(request.alternative_starts_at)} –{" "}
              {studioDateTime(request.alternative_ends_at)}
            </small>
            <small className="block">{request.alternative_note}</small>
            {own && request.status === "pending" && (
              <div className="row-actions">
                <button
                  className="secondary-action"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      respondSessionRequestAlternative({
                        id: request.id,
                        proposed_at: request.alternative_proposed_at,
                        accept: true,
                      }),
                    )
                  }
                >
                  Alternatifi kabul et
                </button>
                <button
                  className="secondary-action"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      respondSessionRequestAlternative({
                        id: request.id,
                        proposed_at: request.alternative_proposed_at,
                        accept: false,
                      }),
                    )
                  }
                >
                  Alternatifi kabul etme
                </button>
              </div>
            )}
            <small className="block">
              Kabul edilse de yönetici onayı gerekir; oda ayrılmaz.
            </small>
          </div>
        )}
      {request.status === "pending" && isAdmin && (
        <div>
          {pendingGroups > 0 && (
            <p className="notice">
              Aynı oda ve saat için {pendingGroups} bekleyen grup taslağı var.
              Grup planını değerlendirerek karar verin.
            </p>
          )}
          <label>
            Değerlendirme / ret gerekçesi
            <input
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ret için zorunlu"
            />
          </label>
          <div className="row-actions">
            <button
              className="secondary-action"
              type="button"
              disabled={busy || offered}
              onClick={() => void review(true)}
            >
              Talebi onayla
            </button>
            <button
              className="secondary-action"
              type="button"
              disabled={busy || !note.trim()}
              onClick={() => void review(false)}
            >
              Gerekçeli reddet
            </button>
          </div>
          {request.session_type === "private" && (
            <details>
              <summary>Alternatif saat öner</summary>
              <form className="record-form" onSubmit={propose}>
                <label>
                  Alternatif başlangıç (İstanbul saati)
                  <input
                    type="datetime-local"
                    required
                    value={start}
                    onChange={(event) => setStart(event.target.value)}
                  />
                </label>
                <label>
                  Alternatif bitiş (İstanbul saati)
                  <input
                    type="datetime-local"
                    required
                    min={start || undefined}
                    value={end}
                    onChange={(event) => setEnd(event.target.value)}
                  />
                </label>
                <label>
                  Alternatif açıklaması
                  <input
                    required
                    maxLength={500}
                    value={alternativeNote}
                    onChange={(event) => setAlternativeNote(event.target.value)}
                  />
                </label>
                <button
                  className="secondary-action"
                  type="submit"
                  disabled={busy}
                >
                  Alternatif öneriyi ilet
                </button>
              </form>
            </details>
          )}
        </div>
      )}
      {request.status === "pending" && own && (
        <button
          className="secondary-action"
          type="button"
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                "Bekleyen talebiniz geri çekilecek. Devam edilsin mi?",
              )
            )
              void run(() => withdrawSessionRequest({ id: request.id }));
          }}
        >
          Talebimi geri çek
        </button>
      )}
      {request.status === "approved" && (
        <a href="/dashboard/lessons">Kesinleşen ders</a>
      )}
    </div>
  );
}
