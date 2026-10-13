import { requireRole } from "@/lib/supabase/access";
import { StudentHome } from "../_components/student-home";

export const metadata = { title: "Öğrenci Görünümü | FTK Studio" };

/** Every authenticated user can also be a student in one or more centers. */
export default async function MyLearningPage() {
  const { supabase, profile } = await requireRole(["student"]);
  return <StudentHome supabase={supabase} profileId={profile.id} fullName={profile.fullName} />;
}
