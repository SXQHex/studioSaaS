import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const baseline = readFileSync("supabase/schema/00_baseline_snapshot.sql", "utf8");
const hardening = readFileSync("supabase/migrations/20261012180000_harden_internal_function_privileges.sql", "utf8");

describe("SECURITY DEFINER privilege contract", () => {
  it("revokes default execution grants from internal app_private routines", () => {
    expect(hardening).toContain("revoke execute on all functions in schema app_private from public, anon, authenticated");
    expect(hardening).toContain("grant execute on function app_private.current_role() to authenticated");
    expect(hardening).toContain("grant execute on function app_private.is_center_admin(uuid) to authenticated");
    expect(hardening).toContain("grant execute on function app_private.instructor_can_access_member_center(uuid, uuid) to authenticated");
    expect(hardening).toContain("authenticated must not execute app_private.consume_lesson_credit(uuid)");
  });

  it("keeps the intended public SECURITY DEFINER RPCs behind authenticated grants and role checks", () => {
    for (const name of ["create_center", "create_session_request", "grant_center_admin", "list_requestable_members", "revoke_center_admin"]) {
      const definitions = [...baseline.matchAll(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$function\\$;`, "gi"))];
      const fn = definitions.at(-1)?.[0] ?? "";
      expect(fn.toLowerCase(), `${name} definition exists`).toContain("security definer");
      expect(fn, `${name} pins search_path`).toContain("set search_path to ''");
      expect(fn.toLowerCase(), `${name} checks role`).toMatch(/current_role\(\)|role/);
    }
    expect(baseline).toContain("revoke all on function public.create_session_request");
  });

  it("keeps a schema-only baseline without hard-coded tenant seed rows", () => {
    expect(baseline).toContain("create table if not exists public.centers");
    expect(baseline).toContain("create table if not exists public.session_requests");
    expect(baseline).not.toContain("FTK Studio");
    expect(baseline).not.toContain("Salon 1");
    expect(baseline).not.toContain("values ('00000000-0000-0000-0000-000000000101'");
    expect(baseline).not.toContain("values ('00000000-0000-0000-0000-000000000102'");
  });
});
