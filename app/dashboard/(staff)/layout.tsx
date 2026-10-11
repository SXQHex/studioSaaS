import type { ReactNode } from "react";
import { requireRole } from "@/lib/supabase/access";

/**
 * Everything under (staff) is for admins and instructors. Students are redirected to the
 * dashboard home. Individual pages and Server Actions still enforce their own, narrower role
 * check: a layout does not re-run on client-side navigation between sibling pages.
 */
export default async function StaffLayout({ children }: { children: ReactNode }) {
  await requireRole(["admin", "instructor"]);
  return children;
}
