/**
 * The append-only receipt ledger uses a signed balance: price minus net paid.
 * Keep customer money owed separate from outstanding debt and lesson credits.
 */
export function paymentBalance(balance: number) {
  return {
    debt: Math.max(balance, 0),
    credit: Math.max(-balance, 0),
  };
}
export function paymentBalanceRow(row: Record<string, unknown>) {
  if (typeof row.balance !== "number") return row;
  const { debt, credit } = paymentBalance(row.balance);
  return {
    ...row,
    net_balance: row.balance,
    balance: debt,
    credit_balance: credit,
  };
}
