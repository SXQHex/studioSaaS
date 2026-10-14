import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  profile: vi.fn(),
  rpc: vi.fn(),
  signIn: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

import { authenticateBearer } from "@/lib/backend/auth";
import type { BackendClient, BackendContext } from "@/lib/backend/context";
import { changeMyPassword } from "@/lib/backend/services/account";

const id = "10000000-0000-4000-8000-000000000001";
const config = {
  url: "https://test.supabase.co",
  publishableKey: "publishable",
};
const token = "user.jwt.token";
const request = () =>
  new Request("https://test/", {
    headers: { authorization: `Bearer ${token}` },
  });
const client = {
  auth: {
    getUser: mocks.getUser,
    signInWithPassword: mocks.signIn,
    updateUser: mocks.updateUser,
    signOut: mocks.signOut,
  },
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: mocks.profile }) }),
  }),
  rpc: mocks.rpc,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockReturnValue(client);
  mocks.getUser.mockResolvedValue({
    data: {
      user: {
        id,
        email: "test@example.invalid",
        user_metadata: { role: "appowner" },
      },
    },
    error: null,
  });
  mocks.profile.mockResolvedValue({
    data: { id, full_name: "Test", role: "admin" },
    error: null,
  });
  mocks.rpc.mockResolvedValue({ data: [], error: null });
  mocks.signIn.mockResolvedValue({ data: { user: { id } }, error: null });
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});
describe("JWT and role boundary", () => {
  it("retains the caller token for RLS and ignores editable metadata and legacy profile role", async () => {
    const actor = await authenticateBearer(request(), config);
    expect(mocks.getUser).toHaveBeenCalledWith(token);
    expect(mocks.createClient).toHaveBeenCalledWith(
      config.url,
      config.publishableKey,
      expect.objectContaining({
        global: { headers: { Authorization: `Bearer ${token}` } },
      }),
    );
    expect(actor.profile.roles).toEqual(["student"]);
  });
  it("rejects invalid user tokens before profile or role access", async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "invalid signature" },
    });
    await expect(authenticateBearer(request(), config)).rejects.toMatchObject({
      status: 401,
    });
    expect(mocks.profile).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects authenticated users with no profile", async () => {
    mocks.profile.mockResolvedValueOnce({ data: null, error: null });
    await expect(authenticateBearer(request(), config)).rejects.toMatchObject({
      status: 403,
      code: "PROFILE_REQUIRED",
    });
  });
  it("accepts only valid scoped assignments from the database", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [
        { role: "appowner", scope_type: "center", scope_id: id },
        { role: "admin", scope_type: "center", scope_id: null },
        { role: "admin", scope_type: "center", scope_id: id },
      ],
      error: null,
    });
    expect((await authenticateBearer(request(), config)).profile.roles).toEqual(
      ["student", "admin"],
    );
  });
  it("fails closed if scoped role resolution fails", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{ role: "appowner", scope_type: "platform", scope_id: null }],
      error: {},
    });
    expect((await authenticateBearer(request(), config)).profile.roles).toEqual(
      ["student"],
    );
  });
});
describe("native password change", () => {
  const actor: BackendContext = {
    supabase: {} as BackendClient,
    userId: id,
    email: "test@example.invalid",
    profile: {
      id,
      fullName: "Test",
      role: "student",
      roles: ["student"],
      assignments: [],
    },
    config,
  };
  const input = {
    current_password: "old-password",
    new_password: "new-password",
    confirm_password: "new-password",
  };
  it("updates through the verified isolated Auth session, without cookie state", async () => {
    expect((await changeMyPassword(actor, input)).ok).toBe(true);
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "new-password" });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("never changes another account even if password verification returns a different identity", async () => {
    mocks.signIn.mockResolvedValueOnce({
      data: { user: { id: "other" } },
      error: null,
    });
    expect((await changeMyPassword(actor, input)).ok).toBe(false);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
