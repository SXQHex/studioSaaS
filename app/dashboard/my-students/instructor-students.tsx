"use client";

import { useRouter } from "next/navigation";
import { AlertCircle, CalendarDays, Users } from "lucide-react";
import { PageNotice } from "@/components/page-notice";
import type { Database } from "@/lib/supabase/database.types";

type Lesson = Database["public"]["Functions"]["my_teaching_lessons"]["Returns"][number];
type Student = Database["public"]["Functions"]["my_lesson_roster"]["Returns"][number];

const formatDate = (value: string) => new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul",
}).format(new Date(value));

const statusLabels: Record<string, string> = {
  scheduled: "Planlandı", completed: "Tamamlandı", cancelled: "İptal", postponed: "Ertelendi",
};
const sourceLabels: Record<string, string> = {
  private: "Özel ders", enrolled: "Derse kayıtlı", attendance: "Yoklama kaydı",
};

export function InstructorStudents({ lessons, selectedLesson, students, loadError }: {
  lessons: Lesson[];
  selectedLesson: Lesson | null;
  students: Student[];
  loadError: boolean;
}) {
  const router = useRouter();
  return (
    <>
      <PageNotice loadError={loadError} loadErrorMessage="Ders veya öğrenci listesi yüklenemedi. Yetkinizi ve bağlantınızı kontrol edin." />
      <section className="form-card">
        <div className="form-card-heading">
          <div><h2>Ders seçimi</h2><p>Öğrenci listesi seçilen dersin kaydı, özel ders üyesi ve yoklamalarıyla sınırlandırılır.</p></div>
        </div>
        <div className="field-grid">
          <label>Ders
            <select value={selectedLesson?.id ?? ""} disabled={!lessons.length}
              onChange={(event) => router.push("/dashboard/my-students?lesson=" + encodeURIComponent(event.target.value))}>
              {!lessons.length && <option value="">Ders bulunamadı</option>}
              {lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>
                {formatDate(lesson.starts_at)} · {lesson.title} · {lesson.type === "private" ? "Özel" : "Grup"}
              </option>)}
            </select>
          </label>
        </div>
      </section>
      {selectedLesson ? (
        <>
          <div className="stat-strip">
            <div><span>Listelenen öğrenci</span><strong>{students.length}</strong></div>
            <div><span>Beklenen katılım</span><strong>{selectedLesson.expected_attendees ?? "—"}</strong></div>
            <div><span>Katılım kaydı</span><strong>{students.filter((row) => row.attended !== null).length}</strong></div>
          </div>
          <section className="table-card">
            <div className="table-toolbar">
              <div><h2>{selectedLesson.title}</h2>
                <p>{formatDate(selectedLesson.starts_at)} · {statusLabels[selectedLesson.status] ?? selectedLesson.status}</p>
              </div>
              <Users size={19} aria-hidden="true" />
            </div>
            {!students.length ? (
              <div className="empty-state compact">
                <h3>Henüz bağlı öğrenci bulunmuyor</h3>
                <p>Özel derse öğrenci atanmış olmalı; grup dersine kayıt/yoklama eklendiğinde liste oluşur.</p>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>Öğrenci</th><th>İletişim</th><th>Kaynak</th><th>Yoklama</th></tr></thead>
                  <tbody>{students.map((student) => (
                    <tr key={student.member_id}>
                      <td><strong>{student.full_name}</strong></td>
                      <td><span>{student.email ?? student.phone ?? "—"}</span></td>
                      <td>{sourceLabels[student.source] ?? student.source}</td>
                      <td>
                        {student.attended === null
                          ? "Henüz kayıt yok"
                          : student.attended
                            ? "Katıldı"
                            : "Katılmadı"}
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="overview-panel">
          <div className="empty-state">
            <CalendarDays size={23} aria-hidden="true" />
            <h3>Henüz atanmış ders yok</h3>
            <p>Yönetici sizi bir derse tam eğitmen olarak atadığında öğrencileri burada görebilirsiniz.</p>
          </div>
        </section>
      )}
      <p className="dashboard-footnote">
        <AlertCircle size={13} aria-hidden="true" /> Bu ekran başka bir merkezin öğrenci dizinini göstermez.
      </p>
    </>
  );
}
