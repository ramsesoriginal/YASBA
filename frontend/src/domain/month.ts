import type { IsoDateTime, MonthKey } from "./types";

/** Extract "YYYY-MM" from an ISO string. */
export function monthKeyFromIso(iso: IsoDateTime): MonthKey {
  // We rely on ISO-8601 strings with leading YYYY-MM.
  // Example: 2026-01-16T...
  return iso.slice(0, 7);
}
