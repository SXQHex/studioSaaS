import Link from "next/link";
import { requireRole } from "@/lib/supabase/access";
import { pickUuid, type SearchParams } from "@/lib/data/pagination";
import { InstructorStudents } from "./instructor-students";

export const metadata = { title: "Ders öğrencilerim | FTK Studio" };

export default async function InstructorStudentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { supabase } = await requireRole(["admin", "instructor"]);
  const { lesson } = await searchParams;
  const requestedId = pickUuid(lesson);

  const { data, error } = await supabase.rpc("my_teaching_lessons");
  const lessons = data ?? [];
  const selected =
    lessons.find((row) => row.id === requestedId) ?? lessons[0] ?? null;
  const rosterResult = selected
    ? await supabase.rpc("my_lesson_roster", { p_lesson_id: selected.id })
    : { data: [], error: null };

  return (
    <div className="dashboard-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">EĞİTMEN PANELİ</p>
          <h1>Ders öğrencilerim</h1>
          <p className="dashboard-subtitle">
            Yalnızca yönettiğiniz veya tam eğitmen olarak atandığınız derslerin
            kayıtlı öğrencilerini ve yoklama durumunu görüntüleyin.
          </p>
        </div>
        <Link className="secondary-action" href="/dashboard/lessons">
          Ders takvimi
        </Link>
      </div>
      <InstructorStudents
        lessons={lessons}
        selectedLesson={selected}
        students={rosterResult.data ?? []}
        loadError={Boolean(error || rosterResult.error)}
      />
    </div>
  );
}
