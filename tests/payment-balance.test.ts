import { describe, expect, it } from "vitest";
import { paymentBalance, paymentBalanceRow } from "@/lib/payment-balance";
describe("customer money balances", () => {
  it("separates debt and money owed without offsetting different customers", () => {
    const rows = [
      paymentBalanceRow({ balance: 150 }),
      paymentBalanceRow({ balance: -50 }),
    ];
    expect(rows.map((row) => row.balance)).toEqual([150, 0]);
    expect(rows.map((row) => row.credit_balance)).toEqual([0, 50]);
    expect(rows.map((row) => row.net_balance)).toEqual([150, -50]);
    expect(paymentBalance(0)).toEqual({ debt: 0, credit: 0 });
    expect(paymentBalance(-0.5)).toEqual({ debt: 0, credit: 0.5 });
  });
});
