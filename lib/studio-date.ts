/** Display studio timestamps consistently, regardless of server or browser timezone. */
const timeZone = "Europe/Istanbul";
export const studioDateTime = (value: string) => new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium", timeStyle: "short", timeZone,
}).format(new Date(value));
export const studioTime = (value: string) => new Intl.DateTimeFormat("tr-TR", {
  timeStyle: "short", timeZone,
}).format(new Date(value));
export const studioDate = (value: string) => new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium", timeZone,
}).format(new Date(value));

/** datetime-local inputs are explicitly entered in the studio's Istanbul timezone. */
export function studioInputToIso(value: string) {
  const date = new Date(value + "+03:00");
  return value && !Number.isNaN(date.getTime()) ? date.toISOString() : "";
}
