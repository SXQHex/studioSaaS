import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";

// Run the actual generated module in Deno against an isolated HTTP Auth/Data
// fixture. SQL behavior and center isolation are covered by verify-database.
const userId = "10000000-0000-4000-8000-000000000001";
const key = "10000000-0000-4000-8000-000000000003";
let paymentCalls = 0;
const fixture = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  const authorized =
    request.headers.authorization === "Bearer valid-user-token";
  if (!authorized) {
    response.writeHead(401);
    return response.end(JSON.stringify({ message: "Invalid token" }));
  }
  const path = new URL(request.url, "http://fixture").pathname;
  if (path === "/auth/v1/user")
    return response.end(
      JSON.stringify({ id: userId, email: "test@example.invalid" }),
    );
  if (path === "/rest/v1/profiles")
    return response.end(
      JSON.stringify([{ id: userId, full_name: "Test", role: "student" }]),
    );
  if (path === "/rest/v1/rpc/my_scoped_roles")
    return response.end(
      JSON.stringify([
        { role: "admin", scope_type: "center", scope_id: userId },
      ]),
    );
  if (path === "/rest/v1/rpc/payments_command") {
    let body = "";
    for await (const chunk of request) body += chunk;
    const payload = JSON.parse(body).p_data;
    assert.equal(payload.key, key);
    assert.equal(payload.method, "manual");
    assert.equal(payload.amount, 50);
    paymentCalls++;
    return response.end(JSON.stringify({ id: "test-payment" }));
  }
  response.writeHead(404);
  response.end("{}");
});
fixture.listen(0, "127.0.0.1");
await once(fixture, "listening");
const fixtureUrl = `http://127.0.0.1:${fixture.address().port}`;
const child = spawn(
  "deno",
  [
    "run",
    "--allow-env",
    "--allow-net",
    "supabase/functions/studio-api/index.js",
  ],
  {
    env: {
      ...process.env,
      SUPABASE_URL: fixtureUrl,
      SUPABASE_PUBLISHABLE_KEY: "publishable-test",
      STUDIO_API_ALLOWED_ORIGINS: "https://studio.test",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let logs = "";
child.stdout.on("data", (chunk) => {
  logs += chunk;
});
child.stderr.on("data", (chunk) => {
  logs += chunk;
});
const base = "http://127.0.0.1:8000/studio-api/v1";
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error(`Deno exited: ${logs}`);
    try {
      const response = await fetch(`${base}/openapi`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* Await Deno startup and dependency cache. */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, `Edge module did not start: ${logs}`);
  const spec = await (await fetch(`${base}/openapi`)).json();
  assert.equal(spec.openapi, "3.1.0");
  assert.ok(spec.paths["/v1/commands/payments.command"]);
  assert.equal((await fetch(`${base}/queries/session`)).status, 401);
  assert.equal(
    (
      await fetch(`${base}/queries/session`, {
        headers: { Authorization: "Bearer invalid" },
      })
    ).status,
    401,
  );
  const headers = {
    Authorization: "Bearer valid-user-token",
    "Content-Type": "application/json",
  };
  const session = await (
    await fetch(`${base}/queries/session`, { headers })
  ).json();
  assert.equal(session.data.userId, userId);
  assert.deepEqual(session.data.profile.roles, ["student", "admin"]);
  const response = await fetch(`${base}/commands/payments.command`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "collect",
      subscription_id: userId,
      amount: 50,
      key,
      occurred_at: "2026-10-14T12:00:00Z",
      note: "Fixture payment",
    }),
  });
  assert.equal(response.status, 200, await response.text());
  assert.equal(paymentCalls, 1);
  assert.equal(
    (
      await fetch(`${base}/commands/payments.command`, {
        method: "OPTIONS",
        headers: { Origin: "https://studio.test" },
      })
    ).status,
    204,
  );
  console.log(
    "Deno Edge smoke passed: OpenAPI, JWT rejection, scoped session, transactional payment dispatch, CORS.",
  );
} finally {
  child.kill();
  fixture.closeAllConnections();
  await new Promise((resolve) => fixture.close(resolve));
}
