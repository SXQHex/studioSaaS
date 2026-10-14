import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Tests run at their original schema checkpoint, before later cutovers replace it.
export const checkpoints = {
  20261012180000: [
    "supabase/tests/security_privileges.test.sql",
    "supabase/tests/center_isolation.test.sql",
  ],
  20261013001000: ["supabase/tests/multi_role_foundation.test.sql"],
  20261013131000: [
    "supabase/tests/scoped_role_access.test.sql",
    "supabase/tests/scoped_cutover_security.test.sql",
  ],
  20261013163000: ["supabase/tests/member_account_linking.test.sql"],
  20261013180000: ["supabase/tests/student_instructor_panels.test.sql"],
  20261013163537: ["supabase/tests/session_request_workflow.test.sql"],
  20261013230735: [
    "supabase/tests/roadmap.test.sql",
    "supabase/tests/recovery_consistency.test.sql",
  ],
  20261014010043: ["supabase/tests/organization_center_policies.test.sql"],
  20261014032056: ["supabase/tests/priority_roadmap.test.sql"],
  20261014051755: ["supabase/tests/dry_simplification.test.sql"],
};

export function databaseEnvironment(connectionString) {
  const connection = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(connection.protocol))
    throw new Error("A PostgreSQL connection URL is required");
  return {
    PGHOST: connection.hostname,
    PGPORT: connection.port || "5432",
    PGUSER: decodeURIComponent(connection.username),
    PGPASSWORD: decodeURIComponent(connection.password),
    PGDATABASE: decodeURIComponent(connection.pathname.slice(1)),
    PGSSLMODE: connection.searchParams.get("sslmode") || "prefer",
  };
}
function apply(file) {
  const result = spawnSync("psql", ["-v", "ON_ERROR_STOP=1", "-f", file], {
    stdio: "inherit",
    env: { ...process.env, ...databaseEnvironment(process.env.DB_URL) },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
export function verifyDatabase(directory = "supabase/migrations") {
  if (!process.env.DB_URL)
    throw new Error("DB_URL is required for the isolated test database");
  apply("supabase/schema/00_baseline_snapshot.sql");
  for (const file of readdirSync(directory)
    .filter((f) => /^\d{14}_.+\.sql$/.test(f))
    .sort()) {
    apply(`${directory}/${file}`);
    for (const test of checkpoints[file.slice(0, 14)] ?? []) apply(test);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  verifyDatabase(process.argv[2]);
