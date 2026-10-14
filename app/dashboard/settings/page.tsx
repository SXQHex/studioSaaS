import { requireRole } from "@/lib/supabase/access";
import type { PolicyWorkspace } from "@/lib/policies";
import { PolicySettings } from "./policy-settings";
export const metadata = {
  title: "Organizasyon ve merkez ayarları | FTK Studio",
};
export default async function Page() {
  const { supabase } = await requireRole(["admin"]);
  const { data, error } = await supabase.rpc("policy_workspace");
  if (error || !data || typeof data !== "object" || Array.isArray(data))
    return (
      <div className="dashboard-content">
        <h1>Organizasyon ve merkez ayarları</h1>
        <p role="alert">Ayarlar yüklenemedi.</p>
      </div>
    );
  const workspace = data as unknown as PolicyWorkspace;
  const lessonIds = [
    ...new Set(workspace.exceptions.map((row) => String(row.lesson_id))),
  ];
  const memberIds = [
    ...new Set(workspace.exceptions.map((row) => String(row.member_id))),
  ];
  const [lessons, members] = await Promise.all([
    lessonIds.length
      ? supabase.from("lessons").select("id,title").in("id", lessonIds)
      : Promise.resolve({ data: [], error: null }),
    memberIds.length
      ? supabase.from("members").select("id,full_name").in("id", memberIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const lessonNames = new Map(
    (lessons.data ?? []).map((row) => [row.id, row.title]),
  );
  const memberNames = new Map(
    (members.data ?? []).map((row) => [row.id, row.full_name]),
  );
  workspace.exceptions = workspace.exceptions.map((row) => ({
    ...row,
    lesson:
      lessonNames.get(String(row.lesson_id)) ?? "Ders bilgisi yüklenemedi",
    member:
      memberNames.get(String(row.member_id)) ?? "Öğrenci bilgisi yüklenemedi",
  }));
  return <PolicySettings data={workspace} />;
}
