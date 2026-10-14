import { describe, expect, it, vi } from "vitest";
import { authenticateBearer } from "@/lib/backend/auth";
import type { BackendClient, BackendContext } from "@/lib/backend/context";
import { BackendError } from "@/lib/backend/errors";
import { MAX_API_BODY_BYTES, readJsonBody } from "@/lib/backend/http";
import { queryParameters } from "@/lib/backend/queries";
import { createBackendHandler } from "@/lib/backend/router";

const config = {
  url: "https://test.supabase.co",
  publishableKey: "public-key",
  allowedOrigins: ["https://studio.test"],
};
const rpc = vi.fn();
function context(
  roles: BackendContext["profile"]["roles"] = ["student"],
): BackendContext {
  return {
    supabase: { rpc } as unknown as BackendClient,
    userId: "10000000-0000-4000-8000-000000000001",
    email: "test@example.invalid",
    profile: {
      id: "10000000-0000-4000-8000-000000000001",
      fullName: "Test",
      role: "student",
      roles,
      assignments: [],
    },
    config,
  };
}
function request(path: string, options?: RequestInit) {
  return new Request(
    `https://test.supabase.co/functions/v1/studio-api/v1/${path}`,
    options,
  );
}
describe("frontend-independent Edge API", () => {
  it("uses the same session contract without browser cookies", async () => {
    const actor = context();
    const handler = createBackendHandler(config, async () => actor);
    const response = await handler(request("queries/session"));
    expect(response.status).toBe(200);
    expect((await response.json()).data.userId).toBe(actor.userId);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("rejects missing, malformed and oversized user tokens", async () => {
    for (const authorization of [
      "",
      "Basic x",
      "Bearer a b",
      `Bearer ${"a".repeat(8193)}`,
    ]) {
      await expect(
        authenticateBearer(
          request("queries/session", { headers: { authorization } }),
          config,
        ),
      ).rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
    }
  });
  it("does not authenticate preflight and allows SDK headers", async () => {
    const auth = vi.fn();
    const response = await createBackendHandler(
      config,
      auth,
    )(
      request("commands/payments.command", {
        method: "OPTIONS",
        headers: { origin: "https://studio.test" },
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-headers")).toContain(
      "apikey",
    );
    expect(auth).not.toHaveBeenCalled();
  });
  it("rejects an unapproved browser origin before authenticating", async () => {
    const auth = vi.fn();
    const response = await createBackendHandler(
      config,
      auth,
    )(request("queries/session", { headers: { origin: "https://evil.test" } }));
    expect(response.status).toBe(403);
    expect(auth).not.toHaveBeenCalled();
  });
  it("returns stable errors and a request ID without leaking internals", async () => {
    const response = await createBackendHandler(config, async () => {
      throw new Error("secret db host");
    })(request("queries/session"));
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.requestId).toBe(response.headers.get("x-request-id"));
    expect(JSON.stringify(body)).not.toContain("secret db host");
  });
  it("signals expired authentication with HTTP 401", async () => {
    const response = await createBackendHandler(config, async () => {
      throw new BackendError(401, "UNAUTHENTICATED", "Expired");
    })(request("queries/session"));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
  });
  it("denies student payment mutations without invoking Postgres", async () => {
    rpc.mockClear();
    const response = await createBackendHandler(config, async () => context())(
      request("commands/payments.command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "collect",
          subscription_id: "10000000-0000-4000-8000-000000000002",
          amount: 50,
          key: "10000000-0000-4000-8000-000000000003",
          occurred_at: "2026-10-14T12:00:00Z",
          note: "Test",
        }),
      }),
    );
    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("passes the payment idempotency key to the caller-scoped transaction RPC", async () => {
    rpc.mockResolvedValueOnce({ data: { id: "payment" }, error: null });
    const key = "10000000-0000-4000-8000-000000000003";
    const response = await createBackendHandler(config, async () =>
      context(["student", "admin"]),
    )(
      request("commands/payments.command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "collect",
          subscription_id: "10000000-0000-4000-8000-000000000002",
          amount: 50,
          key,
          occurred_at: "2026-10-14T12:00:00Z",
          note: "Test",
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("payments_command", {
      p_data: expect.objectContaining({ key, method: "manual" }),
    });
  });
  it("rejects invalid financial input before the transaction", async () => {
    rpc.mockClear();
    const response = await createBackendHandler(config, async () =>
      context(["admin"]),
    )(
      request("commands/payments.command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"action":"collect","amount":-10}',
      }),
    );
    expect(response.status).toBe(422);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("does not expose arbitrary RPC or inherited object names", async () => {
    const handler = createBackendHandler(config, async () => context());
    for (const name of ["constructor", "toString", "private_admin_rpc"]) {
      expect((await handler(request(`queries/${name}`))).status).toBe(404);
    }
    expect((await handler(request("commands/payments.command"))).status).toBe(
      405,
    );
  });
  it("publishes the same command schemas from the Supabase URL", async () => {
    const auth = vi.fn();
    const response = await createBackendHandler(
      config,
      auth,
    )(request("openapi"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.servers[0].url).toBe(`${config.url}/functions/v1/studio-api`);
    expect(
      body.paths["/v1/commands/payments.command"].post.requestBody.required,
    ).toBe(true);
    expect(body.info.description).toContain("Windows");
    expect(auth).not.toHaveBeenCalled();
  });
  it("limits actual body bytes even without Content-Length", async () => {
    await expect(
      readJsonBody(
        request("commands/x", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify("ü".repeat(MAX_API_BODY_BYTES)),
        }),
      ),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      readJsonBody(
        request("commands/x", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{",
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      readJsonBody(request("commands/x", { method: "POST", body: "{}" })),
    ).rejects.toMatchObject({ status: 415 });
  });
  it("rejects repeated query parameters and malformed filter JSON", () => {
    expect(() =>
      queryParameters(new URL("https://test/?page=1&page=2")),
    ).toThrow(BackendError);
    expect(() => queryParameters(new URL("https://test/?filters=%7B"))).toThrow(
      BackendError,
    );
    expect(
      queryParameters(new URL("https://test/?page=2&ascending=false")),
    ).toEqual({ page: 2, ascending: false });
  });
});
