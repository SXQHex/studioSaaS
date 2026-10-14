export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (typeof value === "string" && /^[\s]*[=+\-@]/.test(text))
    text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function toCsv(rows: Record<string, unknown>[]) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return (
    "\uFEFF" +
    [
      columns.map(csvCell).join(";"),
      ...rows.map((row) => columns.map((c) => csvCell(row[c])).join(";")),
    ].join("\r\n")
  );
}
