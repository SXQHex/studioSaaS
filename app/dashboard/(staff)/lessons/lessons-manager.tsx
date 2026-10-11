"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { CalendarDays, CirclePlus, Clock3, Edit2, UserRound, X } from "lucide-react";
import { ListFilters } from "@/components/list-filters";
import { PageNotice } from "@/components/page-notice";
import { Pagination } from "@/components/pagination";
import { useActionRunner } from "@/components/use-action-runner";
import { changeLessonStatus, saveLesson } from "@/lib/actions/lessons";
import type { InstructorOption, LessonRow } from "@/lib/data/lessons";
import type { MemberOption } from "@/lib/data/members";
import type { CenterOption, RoomOption } from "@/lib/data/session-requests";

type Lesson = LessonRow;

type LessonForm = {
  type: "private" | "group";
  title: string;
  starts_at: string;
  ends_at: string;
  instructor_id: string;
  private_member_id: string;
  center_id: string;
  room_id: string;
  expected_attendees: string;
  notes: string;
};

const emptyForm: LessonForm = {
  type: "group",
  title: "Grup dersi",
  starts_at: "",
  ends_at: "",
  instructor_id: "",
  private_member_id: "",
  center_id: "",
  room_id: "",
  expected_attendees: "20",
  notes: "",
};

const statusLabels: Record<Lesson["status"], string> = {
  scheduled: "Planlandı",
  completed: "Tamamlandı",
  cancelled: "İptal",
  postponed: "Ertelendi",
};

function localDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(value: string) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toISOString() : "";
}

export function LessonsManager({
  lessons,
  total,
  stats,
  members,
  instructors,
  centers,
  rooms,
  query,
  status,
  page,
  loadError,
  canManage,
}: {
  lessons: Lesson[];
  total: number;
  stats: { total: number; scheduled: number; completed: number };
  members: MemberOption[];
  instructors: InstructorOption[];
  centers: CenterOption[];
  rooms: RoomOption[];
  query: string;
  status: string;
  page: number;
  loadError: boolean;
  canManage: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LessonForm>(emptyForm);
  const { busy, pendingId, error, notice, setError, reset, run } = useActionRunner();
  const formRooms = rooms.filter((room) => room.center_id === form.center_id);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    reset();
    setFormOpen(true);
  }

  function openEdit(lesson: Lesson) {
    setEditingId(lesson.id);
    setForm({
      type: lesson.type,
      title: lesson.title,
      starts_at: localDateTime(lesson.starts_at),
      ends_at: lesson.ends_at ? localDateTime(lesson.ends_at) : "",
      instructor_id: lesson.instructor_id ?? "",
      private_member_id: lesson.private_member_id ?? "",
      center_id: lesson.center_id ?? "",
      room_id: lesson.room_id ?? "",
      expected_attendees: String(lesson.expected_attendees ?? (lesson.type === "private" ? 1 : 20)),
      notes: lesson.notes ?? "",
    });
    reset();
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      type: form.type,
      title: form.title,
      starts_at: toIso(form.starts_at),
      ends_at: form.ends_at ? toIso(form.ends_at) : null,
      instructor_id: form.instructor_id || null,
      private_member_id: form.type === "private" ? form.private_member_id || null : null,
      center_id: form.center_id,
      room_id: form.room_id,
      expected_attendees: Number(form.expected_attendees),
      notes: form.notes,
    };
    await run(() => saveLesson(editingId, payload), {
      onSuccess: () => {
        setFormOpen(false);
        setEditingId(null);
        setForm(emptyForm);
      },
    });
  }

  async function changeStatus(lesson: Lesson, nextStatus: Lesson["status"]) {
    if (nextStatus === lesson.status) return;
    if (lesson.status === "completed") {
      setError("Tamamlanan dersin durumu değiştirilemez; krediler işlenmiş olabilir.");
      return;
    }
    if (nextStatus === "completed" && !window.confirm("Dersi tamamlandı olarak işaretlemek, uygun aboneliklerden kredileri otomatik düşürür. Devam edilsin mi?")) {
      return;
    }
    if ((nextStatus === "cancelled" || nextStatus === "postponed") && !window.confirm("Ders durumu güncellensin mi? İptal veya erteleme kredi tüketimini engeller.")) return;

    await run(() => changeLessonStatus({ id: lesson.id, status: nextStatus }), { rowId: lesson.id });
  }

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">PLANLAMA</p><h1>Ders takvimi</h1><p className="dashboard-subtitle">Özel ve grup derslerini planlayın, tamamlanma durumunu yönetin.</p></div>
        <div className="row-actions"><Link className="secondary-action" href="/dashboard/session-requests">Seans talepleri ve odalar</Link>{canManage && <button className="primary-action" type="button" onClick={openCreate}><CirclePlus size={17} /> Ders planla</button>}</div>
      </div>

      <div className="stat-strip">
        <div><span>Toplam ders</span><strong>{stats.total}</strong></div>
        <div><span>Planlandı</span><strong>{stats.scheduled}</strong></div>
        <div><span>Tamamlandı</span><strong>{stats.completed}</strong></div>
      </div>
      <PageNotice error={error} notice={notice} loadError={loadError} loadErrorMessage="Dersler yüklenemedi. RLS politikalarını kontrol edin." />

      {canManage && formOpen && (
        <section className="form-card">
          <div className="form-card-heading"><div><h2>{editingId ? "Dersi düzenle" : "Yeni ders planla"}</h2><p>Ders tamamlanınca kredi tüketimi veritabanında yönetilir.</p></div><button className="icon-button" type="button" onClick={() => setFormOpen(false)} aria-label="Formu kapat"><X size={18} /></button></div>
          <form className="record-form" onSubmit={handleSubmit}>
            <div className="field-grid">
              <label>Ders türü *<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as LessonForm["type"], title: e.target.value === "group" ? "Grup dersi" : "Özel ders", private_member_id: "", expected_attendees: e.target.value === "group" ? "20" : "1" })}><option value="group">Grup dersi</option><option value="private" disabled={!editingId}>Özel ders (talep ile)</option></select></label>
              <label>Ders adı *<input required maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Dersin adı" /></label>
              <label>Başlangıç *<input required type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></label>
              <label>Bitiş *<input required type="datetime-local" value={form.ends_at} min={form.starts_at || undefined} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></label>
              <label>Merkez *<select required disabled={Boolean(editingId)} value={form.center_id} onChange={(e) => setForm({ ...form, center_id: e.target.value, room_id: "" })}><option value="">Merkez seçin</option>{centers.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}</select></label>
              <label>Oda *<select required value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })}><option value="">Oda seçin</option>{formRooms.map((room) => <option key={room.id} value={room.id}>{room.name} · kapasite {room.capacity}</option>)}</select></label>
              <label>Eğitmen *<select required value={form.instructor_id} onChange={(e) => setForm({ ...form, instructor_id: e.target.value })}><option value="">Eğitmen seçilmedi</option>{instructors.map((instructor) => <option key={instructor.id} value={instructor.id}>{instructor.full_name || instructor.role}</option>)}</select></label>
              <label>Beklenen katılımcı *<input required type="number" min="1" max="500" value={form.expected_attendees} onChange={(e) => setForm({ ...form, expected_attendees: e.target.value })} /></label>
              {form.type === "private" && <label>Üye *<select required value={form.private_member_id} onChange={(e) => setForm({ ...form, private_member_id: e.target.value })}><option value="">Üye seçin</option>{members.filter((member) => member.is_active).map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}</select></label>}
              <label className="field-wide">Notlar<textarea rows={2} maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="İsteğe bağlı ders notları" /></label>
            </div>
            <div className="form-actions"><button className="secondary-action" type="button" onClick={() => setFormOpen(false)}>Vazgeç</button><button className="primary-action" type="submit" disabled={busy}>{busy ? "Kaydediliyor…" : editingId ? "Değişiklikleri kaydet" : "Dersi planla"}</button></div>
          </form>
        </section>
      )}

      <section className="table-card">
        <div className="table-toolbar"><div><h2>Ders listesi</h2><p>{total} kayıt bulundu</p></div><ListFilters action="/dashboard/lessons" query={query} searchPlaceholder="Ders ara…" searchLabel="Ders ara" searchIcon={<CalendarDays size={16} />}><select className="filter-select" name="status" defaultValue={status} aria-label="Duruma göre filtrele"><option value="">Tüm durumlar</option><option value="scheduled">Planlandı</option><option value="completed">Tamamlandı</option><option value="cancelled">İptal</option><option value="postponed">Ertelendi</option></select></ListFilters></div>
        {stats.total === 0 && !loadError ? (
          <div className="empty-state"><span className="empty-icon"><CalendarDays size={24} /></span><h3>Henüz ders planlanmadı</h3><p>İlk dersi oluşturarak takviminizi hazırlayın.</p>{canManage && <button className="secondary-action" type="button" onClick={openCreate}>Ders planla</button>}</div>
        ) : lessons.length === 0 ? (
          <div className="empty-state compact"><h3>Sonuç bulunamadı</h3><p>Arama veya filtre ölçütünü değiştirin.</p></div>
        ) : (
          <div className="table-scroll"><table className="data-table"><thead><tr><th>Ders</th><th>Tarih ve saat</th><th>Merkez / oda</th><th>Tür</th><th>Durum</th><th className="actions-head">İşlem</th></tr></thead>
            <tbody>{lessons.map((lesson) => (
              <tr key={lesson.id}>
                <td><div className="lesson-cell"><span className="person-avatar"><UserRound size={16} /></span><span><strong>{lesson.title}</strong><small>{lesson.type === "private" ? members.find((m) => m.id === lesson.private_member_id)?.full_name ?? "Üye kaydı bulunamadı" : "Grup dersi"}{lesson.notes ? ` · ${lesson.notes}` : ""}</small></span></div></td>
                <td><div className="date-cell"><strong>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(lesson.starts_at))}</strong><span><Clock3 size={13} />{new Intl.DateTimeFormat("tr-TR", { timeStyle: "short" }).format(new Date(lesson.starts_at))}{lesson.ends_at ? ` – ${new Intl.DateTimeFormat("tr-TR", { timeStyle: "short" }).format(new Date(lesson.ends_at))}` : ""}</span></div></td>
                <td>{centers.find((center) => center.id === lesson.center_id)?.name ?? "Merkez yok"}<small className="block">{rooms.find((room) => room.id === lesson.room_id)?.name ?? "Oda yok"}</small></td><td><span className="type-pill">{lesson.type === "private" ? "Özel" : "Grup"}</span></td>
                <td><span className={`status-pill lesson-${lesson.status}`}><span />{statusLabels[lesson.status]}</span></td>
                <td><div className="row-actions">{canManage && lesson.status !== "completed" && <><button className="icon-button" type="button" onClick={() => openEdit(lesson)} aria-label="Dersi düzenle"><Edit2 size={16} /></button><select className="status-select" disabled={pendingId === lesson.id} value={lesson.status} onChange={(e) => void changeStatus(lesson, e.target.value as Lesson["status"])} aria-label="Ders durumunu değiştir"><option value="scheduled">Planlandı</option><option value="completed">Tamamlandı</option><option value="cancelled">İptal</option><option value="postponed">Ertelendi</option></select></>}</div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <Pagination basePath="/dashboard/lessons" params={{ q: query, status }} page={page} total={total} />
      </section>
    </>
  );
}
