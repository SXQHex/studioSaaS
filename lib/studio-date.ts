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
