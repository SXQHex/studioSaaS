import { describe, expect, it } from "vitest";
import { dbErrorMessage, parseInput } from "@/lib/actions/result";
import { memberStatusSchema } from "@/lib/validation/schemas";

describe("dbErrorMessage", () => {
  it("maps known SQLSTATE codes to friendly messages", () => {
    expect(dbErrorMessage({ code: "42501" })).toBe("Bu işlem için yetkiniz yok.");
    expect(dbErrorMessage({ code: "23505" })).toBe("Bu kayıt zaten mevcut.");
  });

  it("passes through messages raised by our own trigger functions", () => {
    expect(dbErrorMessage({ code: "P0001", message: "Kredi bakiyesi bu işlem için uygun değil." })).toBe(
      "Kredi bakiyesi bu işlem için uygun değil.",
    );
  });

  it("never leaks unknown database errors", () => {
    expect(dbErrorMessage({ code: "XX000", message: 'relation "secret" does not exist' }, "Kaydedilemedi.")).toBe("Kaydedilemedi.");
    expect(dbErrorMessage(null)).toBe("İşlem tamamlanamadı.");
  });
});

describe("parseInput", () => {
  it("returns data for valid input and a failure result for invalid input", () => {
    const good = parseInput(memberStatusSchema, { id: "3f2b8c1e-9d4a-4b6e-8f10-2c7d5a9e1b34", is_active: true });
    expect(good.failure).toBeUndefined();
    expect(good.data?.is_active).toBe(true);

    const bad = parseInput(memberStatusSchema, { id: "nope", is_active: true });
    expect(bad.data).toBeUndefined();
    expect(bad.failure).toEqual({ ok: false, error: "Geçersiz üye." });
  });
});
