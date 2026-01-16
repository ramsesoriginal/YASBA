export function todayIsoDate(): string {
  // YYYY-MM-DD
  return new Date().toISOString().slice(0, 10);
}

export function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

export function isoFromDateInput(dateStr: string): string {
  // Input "YYYY-MM-DD" -> ISO at noon UTC to avoid TZ edges in display logic.
  // Determinism is based on the stored string, not local tz conversion.
  return `${dateStr}T12:00:00.000Z`;
}
