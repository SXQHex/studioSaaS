/** All studio dates use Istanbul regardless of the host or browser timezone. */
export const STUDIO_TIME_ZONE = "Europe/Istanbul";
const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeZone: STUDIO_TIME_ZONE,
});
const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeStyle: "short",
  timeZone: STUDIO_TIME_ZONE,
});
const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: STUDIO_TIME_ZONE,
});
export const studioDate = (value: string) =>
  dateFormatter.format(new Date(value));
export const studioTime = (value: string) =>
  timeFormatter.format(new Date(value));
export const studioDateTime = (value: string) =>
  dateTimeFormatter.format(new Date(value));

export function studioDateKey(value: string | Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STUDIO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (key: string) => parts.find((p) => p.type === key)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function studioDateTimeInput(value: string) {
  if (!value || Number.isNaN(Date.parse(value))) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: STUDIO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  return `${studioDateKey(value)}T${parts.find((p) => p.type === "hour")?.value}:${parts.find((p) => p.type === "minute")?.value}`;
}
export function studioInputToIso(value: string) {
  const date = new Date(value + "+03:00");
  return value && !Number.isNaN(date.getTime()) ? date.toISOString() : "";
}
