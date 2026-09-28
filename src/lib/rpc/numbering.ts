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
