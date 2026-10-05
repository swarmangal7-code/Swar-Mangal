// Pure validation for the optional "Other charges" list on a school invoice
// (on top of the existing fixed `amount`). Kept dependency-free (no @/lib/db,
// no pool) so backend-tests can import it directly with plain node, the same
// way numbering.ts/fees.ts/payouts.ts are tested.

const s = (v: unknown): string => (v == null ? "" : String(v));
const n = (v: unknown): number => {
  const x = Number(String(v ?? "").replace(/[^\d.\-]/g, "") || 0);
  return Number.isFinite(x) ? x : 0;
};

export interface ExtraCharge {
  description: string;
  amount: number;
}

/**
 * Validates the optional "Other charges" list on a school invoice:
 * generateSchoolInvoice, submitSchoolInvoiceDraft and
 * finaliseSchoolInvoiceDraft all go through this. The whole list is
 * optional — zero charges is the default, valid state — but every charge
 * that IS given must carry BOTH a non-empty description and a positive
 * amount; a row with only one of the two is rejected rather than silently
 * dropped, since a charge with no description or no amount can't be billed.
 * A fully blank row (both empty) is ignored — it's just an unused "Add
 * charge" slot from the UI, not a mistake.
 */
export function parseExtraCharges(
  raw: unknown,
): { ok: true; charges: ExtraCharge[] } | { ok: false; code: string; error: string } {
  if (raw == null) return { ok: true, charges: [] };
  if (!Array.isArray(raw)) return { ok: false, code: "BAD_EXTRA_CHARGES", error: "Other charges must be a list." };
  const charges: ExtraCharge[] = [];
  for (const item of raw) {
    const rec = (item ?? {}) as Record<string, unknown>;
    const description = s(rec["description"]).trim();
    const amountRaw = s(rec["amount"]).trim();
    const amount = n(rec["amount"]);
    const hasDescription = description.length > 0;
    const hasAmount = amountRaw.length > 0 && amount > 0;
    if (!hasDescription && !hasAmount) continue;
    if (!hasDescription || !hasAmount) {
      return {
        ok: false,
        code: "EXTRA_CHARGE_INCOMPLETE",
        error: "Each other charge needs both a description and an amount greater than 0.",
      };
    }
    charges.push({ description, amount });
  }
  return { ok: true, charges };
}

/** Same shape coming back off a jsonb column (school_invoice_drafts.extra_charges) —
 *  already-validated data, so this just normalizes it, it never re-validates. */
export function normalizeChargesJson(raw: unknown): ExtraCharge[] {
  if (!raw) return [];
  const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((c) => ({ description: s((c as Record<string, unknown>)?.description), amount: n((c as Record<string, unknown>)?.amount) }))
    .filter((c) => c.description && c.amount > 0);
}
