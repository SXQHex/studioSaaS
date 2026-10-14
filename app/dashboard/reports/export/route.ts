import { paymentBalanceRow } from "@/lib/payment-balance";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/access";
import { reportRange } from "@/lib/validation/operations";
import { toCsv } from "@/lib/csv";
export async function GET(request: NextRequest) {
  const { supabase } = await requireRole(["admin"]);
  const dataset = request.nextUrl.searchParams.get("dataset") ?? "";
  if (
    !["payments", "balances", "renewals", "lessons", "usage", "crm"].includes(
      dataset,
    )
  )
    return NextResponse.json({ error: "Rapor geçersiz." }, { status: 400 });
  const parsed = reportRange.safeParse({
    from: request.nextUrl.searchParams.get("from"),
    to: request.nextUrl.searchParams.get("to"),
  });
  if (!parsed.success)
    return NextResponse.json(
      { error: "Tarih aralığı geçersiz." },
      { status: 400 },
    );
  const { data, error } = await supabase.rpc("studio_report", {
    p_from: parsed.data.from,
    p_to: parsed.data.to,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data))
    return NextResponse.json(
      { error: "Rapor oluşturulamadı." },
      { status: 503 },
    );
  const rows = data[dataset];
  if (!Array.isArray(rows))
    return NextResponse.json(
      { error: "Rapor oluşturulamadı." },
      { status: 503 },
    );
  const exportRows = rows as Record<string, unknown>[];
  return new NextResponse(
    toCsv(
      dataset === "balances" ? exportRows.map(paymentBalanceRow) : exportRows,
    ),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="' +
          dataset +
          "-" +
          parsed.data.from +
          "-" +
          parsed.data.to +
          '.csv"',
        "Cache-Control": "private, no-store",
      },
    },
  );
}
