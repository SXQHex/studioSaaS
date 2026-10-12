import { requireRole } from "@/lib/supabase/access";
import { ReportsManager } from "./reports-manager";

export const metadata = { title: "Raporlama | FTK Studio" };
export default async function ReportsPage() {
  const { supabase } = await requireRole(["admin"]);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  const [members, activeMembers, activeSubscriptions, lessons, monthLessons, attendance, presentCount, credits, subscriptionRows, attendanceRows, creditRows] = await Promise.all([
    supabase.from("members").select("id", { count: "exact", head: true }),
    supabase.from("members").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("lessons").select("id", { count: "exact", head: true }),
    supabase.from("lessons").select("id", { count: "exact", head: true }).gte("starts_at", monthStart).lt("starts_at", monthEnd),
    supabase.from("attendance").select("id", { count: "exact", head: true }),
    supabase.from("attendance").select("id", { count: "exact", head: true }).eq("attended", true),
    supabase.from("credit_transactions").select("id, amount, reason, created_at, note, member_id, subscription_id").order("created_at", { ascending: false }).limit(1000),
    supabase.from("subscriptions").select("id, member_id, type, status, starts_on, ends_on, credits_purchased, credits_remaining, amount, payment_status").order("starts_on", { ascending: false }).limit(1000),
    supabase.from("attendance").select("id, member_id, lesson_id, attended, checked_in_at, notes").order("checked_in_at", { ascending: false }).limit(1000),
    supabase.from("credit_transactions").select("id, member_id, subscription_id, lesson_id, amount, reason, created_at, note").order("created_at", { ascending: false }).limit(1000),
  ]);
  const present = presentCount.count ?? 0;
  const absent = Math.max(0, (attendance.count ?? 0) - present);
  const errors = [members, activeMembers, activeSubscriptions, lessons, monthLessons, attendance, presentCount, credits, subscriptionRows, attendanceRows, creditRows].some((result) => result.error);
  return <div className="dashboard-content"><ReportsManager metrics={{ members: members.count ?? 0, activeMembers: activeMembers.count ?? 0, activeSubscriptions: activeSubscriptions.count ?? 0, lessons: lessons.count ?? 0, monthLessons: monthLessons.count ?? 0, attendance: attendance.count ?? 0, present, absent, creditEvents: credits.data?.length ?? 0, netCredits: (credits.data ?? []).reduce((sum, row) => sum + row.amount, 0) }} datasets={{ subscriptions: subscriptionRows.data ?? [], attendance: attendanceRows.data ?? [], credits: creditRows.data ?? [] }} loadError={errors} /></div>;
}
