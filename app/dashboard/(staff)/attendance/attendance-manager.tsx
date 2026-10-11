"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, CheckCircle2, CirclePlus, UserCheck, UserX } from "lucide-react";
import { ListFilters } from "@/components/list-filters";
import { PageNotice } from "@/components/page-notice";
import { Pagination } from "@/components/pagination";
import { useActionRunner } from "@/components/use-action-runner";
import { recordAttendance } from "@/lib/actions/attendance";
import type { AttendanceRow } from "@/lib/data/attendance";
import type { LessonOption } from "@/lib/data/lessons";
import type { MemberOption } from "@/lib/data/members";
import type { ActiveSubscription } from "@/lib/data/subscriptions";

const statusLabels: Record<LessonOption["status"], string> = {
  scheduled: "Planlandı",
  completed: "Tamamlandı",
  cancelled: "İptal",
  postponed: "Ertelendi",
};

function istanbulDate(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function AttendanceManager({
  lessons,
  members,
  attendance,
  total,
  stats,
  recordedMemberIds,
  subscriptions,
  lessonId,
  query,
  page,
  loadError,
}: {
  lessons: LessonOption[];
  members: MemberOption[];
  attendance: AttendanceRow[];
  total: number;
  stats: { total: number; attended: number; absent: number };
  /** Members that already have an attendance row for the selected lesson. */
  recordedMemberIds: string[];
  /** Active packages, used only for credit warnings. */
  subscriptions: ActiveSubscription[];
  lessonId: string;
  query: string;
  page: number;
  loadError: boolean;
}) {
  const router = useRouter();
  const selectedLesson = lessons.find((lesson) => lesson.id === lessonId);
  const recordedSet = new Set(recordedMemberIds);
  const lessonMemberId = selectedLesson?.type === "private" ? selectedLesson.private_member_id : null;
  const defaultMemberId = lessonMemberId && !recordedSet.has(lessonMemberId) ? lessonMemberId : "";

  const [memberId, setMemberId] = useState(defaultMemberId);
  const [attended, setAttended] = useState(true);
  const [notes, setNotes] = useState("");
  const [previousLessonId, setPreviousLessonId] = useState(lessonId);
  const { busy, error, notice, setError, reset, run } = useActionRunner();

  // Selecting another lesson (the lesson lives in the URL) resets the member choice.
  if (previousLessonId !== lessonId) {
    setPreviousLessonId(lessonId);
    setMemberId(defaultMemberId);
  }

  function selectLesson(nextId: string) {
    const search = new URLSearchParams();
    if (nextId) search.set("lesson", nextId);
    if (query) search.set("q", query);
    const qs = search.toString();
    router.push(qs ? `/dashboard/attendance?${qs}` : "/dashboard/attendance");
  }

  const eligibleMembers = members.filter((member) =>
    !recordedSet.has(member.id) && (!lessonMemberId || member.id === lessonMemberId)
  );

  const lessonDate = selectedLesson ? istanbulDate(selectedLesson.starts_at) : "";
  const matchingSubscriptions = selectedLesson ? subscriptions.filter((subscription) =>
    subscription.status === "active" &&
    subscription.starts_on <= lessonDate &&
    (subscription.ends_on === null || subscription.ends_on >= lessonDate) &&
    subscription.type === (selectedLesson.type === "group" ? "group_4_weeks" : "private_credits") &&
    (selectedLesson.type === "group" || subscription.member_id === selectedLesson.private_member_id)
  ) : [];
  const zeroCreditPacks = matchingSubscriptions.filter((subscription) => subscription.credits_remaining <= 0).length;
  const privateHasCredit = matchingSubscriptions.some((subscription) => subscription.credits_remaining > 0);
  const selectedMemberHasGroupCredit = matchingSubscriptions.some((subscription) =>
    selectedLesson?.type === "group" && subscription.member_id === memberId && subscription.credits_remaining > 0
  );
  const privateAttendanceAlreadyRecorded = Boolean(
    selectedLesson?.type === "private" &&
    selectedLesson.private_member_id &&
    recordedSet.has(selectedLesson.private_member_id)
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    reset();
    if (!lessonId || !memberId) {
      setError("Ders ve üye seçmeniz gerekiyor.");
      return;
    }
    if (privateAttendanceAlreadyRecorded) {
      setError("Bu özel ders için yoklama zaten kaydedilmiş.");
      return;
    }

    await run(() => recordAttendance({ lesson_id: lessonId, member_id: memberId, attended, notes }), {
      onSuccess: () => {
        setMemberId("");
        setNotes("");
        setAttended(true);
      },
    });
  }

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">KATILIM TAKİBİ</p><h1>Yoklama</h1><p className="dashboard-subtitle">Derse katılımı kaydedin. Kredi bakiyesi istemci tarafından değiştirilmez.</p></div>
      </div>

      <div className="stat-strip">
        <div><span>Toplam kayıt</span><strong>{stats.total}</strong></div>
        <div><span>Katıldı</span><strong>{stats.attended}</strong></div>
        <div><span>Katılmadı</span><strong>{stats.absent}</strong></div>
      </div>

      <PageNotice error={error} notice={notice} loadError={loadError} loadErrorMessage="Yoklama listesi yüklenemedi. RLS politikalarını kontrol edin." />

      <section className="form-card attendance-entry">
        <div className="form-card-heading"><div><h2>Yoklama ekle</h2><p>Her ders ve üye için tek bir kayıt oluşturun.</p></div><span className="panel-icon"><UserCheck size={19} /></span></div>
        <form className="record-form" onSubmit={handleSubmit}>
          <div className="field-grid">
            <label className="field-wide">Ders *<select required value={lessonId} onChange={(e) => selectLesson(e.target.value)}><option value="">Ders seçin</option>{lessons.map((lesson) => <option key={lesson.id} value={lesson.id} disabled={lesson.status === "cancelled" || lesson.status === "postponed"}>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(lesson.starts_at))} · {lesson.title} · {lesson.type === "group" ? "Grup" : "Özel"} · {statusLabels[lesson.status]}</option>)}</select></label>
            <label>Üye *<select required value={memberId} onChange={(e) => setMemberId(e.target.value)} disabled={!lessonId}><option value="">Üye seçin</option>{eligibleMembers.map((member) => <option key={member.id} value={member.id}>{member.full_name}{!member.is_active ? " (pasif)" : ""}</option>)}</select></label>
            <label className="check-field attendance-check"><input type="checkbox" checked={attended} onChange={(e) => setAttended(e.target.checked)} /> Katıldı</label>
            <label className="field-wide">Notlar<textarea rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="İsteğe bağlı notlar" /></label>
          </div>
          {selectedLesson?.type === "group" && <p className="inline-info"><CheckCircle2 size={15} /> Grup dersine yoklama eklenmesi dersi tamamlanmış sayar. Aktif grup aboneliklerinden uygun krediler bir kez düşülür; katıldı/katılmadı seçimi bu kuralı değiştirmez.</p>}
          {selectedLesson?.type === "group" && zeroCreditPacks > 0 && <p className="notice error credit-warning" role="status">{zeroCreditPacks} aktif grup paketi sıfır krediye sahip. Bu paketlerden kredi düşülmez; yoklama kaydı yine de yapılabilir.</p>}
          {selectedLesson?.type === "group" && memberId && !selectedMemberHasGroupCredit && <p className="notice error credit-warning" role="status">Seçilen üyenin ders tarihinde kullanılabilir aktif grup kredisi yok. Katılım kaydı yapılabilir; bakiye eksiye düşmez.</p>}
          {selectedLesson?.type === "private" && <p className="inline-info"><CheckCircle2 size={15} /> Özel ders kredisi, ders durumu yönetim panelinde “Tamamlandı” yapıldığında tüketilir.</p>}
          {privateAttendanceAlreadyRecorded && <p className="notice error credit-warning" role="status">Bu özel ders için yoklama zaten mevcut.</p>}
          {selectedLesson?.type === "private" && selectedLesson.private_member_id && !privateHasCredit && <p className="notice error credit-warning" role="status">Bu üyenin ders tarihinde kullanılabilir özel ders kredisi yok. Ders tamamlandığında bakiye eksiye düşmez; yoklama yine kaydedilebilir.</p>}
          {selectedLesson?.type === "private" && !selectedLesson.private_member_id && <p className="notice error credit-warning" role="status">Bu özel derse üye atanmamış. Önce ders kaydına üye atayın.</p>}
          <div className="form-actions"><button className="primary-action" type="submit" disabled={busy || !lessonId || !memberId}><CirclePlus size={16} />{busy ? "Kaydediliyor…" : "Yoklamayı kaydet"}</button></div>
        </form>
      </section>

      <section className="table-card">
        <div className="table-toolbar"><div><h2>Yoklama kayıtları</h2><p>{total} kayıt bulundu</p></div><ListFilters action="/dashboard/attendance" query={query} searchPlaceholder="Üye ara…" searchLabel="Yoklamada üye ara"><select className="filter-select" name="lesson" defaultValue={lessonId} aria-label="Derse göre filtrele"><option value="">Tüm dersler</option>{lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title} · {new Intl.DateTimeFormat("tr-TR", { dateStyle: "short" }).format(new Date(lesson.starts_at))}</option>)}</select></ListFilters></div>
        {stats.total === 0 && !loadError ? (
          <div className="empty-state"><span className="empty-icon"><Activity size={24} /></span><h3>Henüz yoklama kaydı yok</h3><p>Yukarıdaki formdan ilk katılım kaydınızı ekleyin.</p></div>
        ) : attendance.length === 0 ? (
          <div className="empty-state compact"><h3>Sonuç bulunamadı</h3><p>Ders veya arama ölçütünü değiştirin.</p></div>
        ) : (
          <div className="table-scroll"><table className="data-table"><thead><tr><th>Üye</th><th>Ders</th><th>Kayıt zamanı</th><th>Katılım</th></tr></thead><tbody>{attendance.map((row) => (
            <tr key={row.id}><td><div className="person-cell"><span className="person-avatar">{row.members.full_name.slice(0, 1).toLocaleUpperCase("tr-TR")}</span><span><strong>{row.members.full_name}</strong><small>{row.notes || row.members.email || row.members.phone || "Ek not yok"}</small></span></div></td><td><div className="lesson-cell"><span><strong>{row.lessons?.title ?? "Ders kaydı bulunamadı"}</strong><small>{row.lessons ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.lessons.starts_at)) : ""}</small></span></div></td><td>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.checked_in_at))}</td><td><span className={row.attended ? "status-pill active-status" : "status-pill inactive-status"}>{row.attended ? <CheckCircle2 size={13} /> : <UserX size={13} />}{row.attended ? "Katıldı" : "Katılmadı"}</span></td></tr>
          ))}</tbody></table></div>
        )}
        <Pagination basePath="/dashboard/attendance" params={{ q: query, lesson: lessonId }} page={page} total={total} />
      </section>
    </>
  );
}
