// Document numbering helpers (pure; the counter itself lives in doc_counters).

/**
 * Indian financial year label (April–March) for a date, in IST.
 * 2026-04-01 → "26-27", 2026-03-31 → "25-26".
 */
export function financialYearLabel(date: Date = new Date()): string {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  const two = (n: number) => String(n % 100).padStart(2, "0");
  return `${two(start)}-${two(start + 1)}`;
}

/** SMR-26-27 + 7 → SMR-26-27-007 (grows past 3 digits naturally). */
export function formatDocNo(series: string, no: number): string {
  return `${series}-${String(no).padStart(3, "0")}`;
}

/**
 * School invoice numbers carry the school code after the sequence:
 *   SMI-26-27 + 7 + "MHWS" → SMI-26-27-007_SCH_MHWS
 *
 * The sequence is ONE run per financial year across every school — 005 is the
 * fifth invoice of the year whoever it was billed to, 006 the sixth. A school
 * code never restarts or forks the run, so the numbering stays gap-free and
 * each document is uniquely identifiable by number alone.
 */
export function formatSchoolInvoiceNo(series: string, no: number, schoolCode: string): string {
  const base = formatDocNo(series, no);
  const code = schoolCode.trim().toUpperCase();
  return code ? `${base}_SCH_${code}` : base;
}

export const receiptSeries = (date?: Date) => `SMR-${financialYearLabel(date)}`;
export const schoolInvoiceSeries = (date?: Date) => `SMI-${financialYearLabel(date)}`;

/**
 * Calendar start/end date for a "YYYY-MM" billing month, e.g. "2026-08" →
 * { from: "2026-08-01", to: "2026-08-31" }. Pure calendar math — no
 * reference to when the invoice is actually raised.
 */
export function billingMonthRange(billingMonth: string): { from: string; to: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(billingMonth.trim());
  if (!m) throw new Error(`Invalid billing month "${billingMonth}" — expected YYYY-MM.`);
  const year = Number(m[1]);
  const month = Number(m[2]); // 1-12
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const from = iso(new Date(Date.UTC(year, month - 1, 1)));
  const to = iso(new Date(Date.UTC(year, month, 0))); // day 0 of next month = last day of this month
  return { from, to };
}
