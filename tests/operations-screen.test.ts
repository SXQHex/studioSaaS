import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/lib/actions/operations", () => ({ runOperation: vi.fn() }));
import { OperationsWorkspace } from "@/components/operations-workspace";
import { OperationsTable } from "@/components/operations-table";
describe("operation screen rendering", () => {
  it("shows the full group workflow with fixture options and preserves readable table values", () => {
    const html = renderToStaticMarkup(
      createElement(OperationsWorkspace, {
        module: "groups",
        title: "Grup programları",
        data: {
          centers: [{ id: "center", label: "Test merkez" }],
          groups: [
            {
              id: "group",
              name: "Test Grup",
              label: "Test Grup",
              capacity: 10,
              enrolled: 2,
            },
          ],
        },
        manager: true,
        instructor: false,
        loadError: false,
      }),
    );
    expect(html).toContain("Test merkez");
    expect(html).toContain("Bekleme listesine ekle");
    expect(html).toContain("Sıradaki öğrenciyi gruba al");
    expect(html).toContain("Test Grup");
  });
  it("does not offer staff-wide cancellation or policy changes in the student screen", () => {
    const html = renderToStaticMarkup(
      createElement(OperationsWorkspace, {
        module: "lesson-operations",
        title: "Dersler",
        data: {},
        manager: false,
        instructor: false,
        loadError: false,
      }),
    );
    expect(html).toContain("Öğrenci iptali");
    expect(html).not.toContain("Dersi iptal et");
    expect(html).not.toContain("İptal süresini ayarla");
  });
  it("renders ledger amounts and dates rather than implementation objects", () => {
    const html = renderToStaticMarkup(
      createElement(OperationsTable, {
        rows: [
          {
            id: "p",
            amount: 100.25,
            kind: "collection",
            occurred_at: "2026-10-13T16:00:00Z",
          },
        ],
        columns: ["amount", "kind", "occurred_at"],
      }),
    );
    expect(html).toContain("100,25");
    expect(html).toContain("Tahsilat");
    expect(html).toContain("19:00");
    expect(html).not.toContain("[object Object]");
  });
});
