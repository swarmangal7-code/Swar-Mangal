"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, FileText, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PaymentProfileDialog } from "@/components/dashboard/payment-profile-dialog";
import { SchoolPicker } from "@/components/dashboard/school-picker";
import { InvoicePreview } from "@/components/founder/invoice-preview";
import { useMutationRpc, useRpc, useSchools } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope, SchoolInvoiceListResponse } from "@/lib/api/rpc-types";
import { useTokenAuth } from "@/lib/auth/token-auth";
import { fadeUp, listVariants } from "@/lib/motion";
import { formatDateOnly, formatINR } from "@/app/founder/_shared";

interface ExtraChargeInput {
  description: string;
  amount: string;
}

interface DraftArg extends Record<string, unknown> {
  amount: number;
  tenure: string;
  invoiceDate: string;
  billingMonth: string;
  schoolAddress: string;
  invoiceSeq: string;
  branch: string;
  notes: string;
  previewConfirmed: boolean;
  clientIntentKey: string;
  extraCharges: { description: string; amount: number }[];
}

interface PeekInvoiceNoResponse extends RpcEnvelope {
  seq: number;
  invoiceNo: string;
}

/** Mirrors the backend's billingMonthRange for the client-side preview. */
function billingMonthBounds(billingMonth: string): { from: string; to: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(billingMonth);
  if (!m) return { from: "", to: "" };
  const year = Number(m[1]);
  const month = Number(m[2]); // 1-12
  const pad = (n: number) => String(n).padStart(2, "0");
  const from = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${pad(month)}-${pad(lastDay)}`;
  return { from, to };
}

/** Mirrors the backend's financialYearLabel/formatSchoolInvoiceNo so the
 *  editable invoice-number field can show a live preview of the full
 *  number without a round trip on every keystroke. */
function clientInvoiceNo(invoiceDateIso: string, seq: string, schoolCode: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(invoiceDateIso) ? new Date(`${invoiceDateIso}T12:00:00+05:30`) : new Date();
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  const y = ist.getUTCFullYear();
  const startYear = ist.getUTCMonth() >= 3 ? y : y - 1;
  const two = (n: number) => String(n % 100).padStart(2, "0");
  const fy = `${two(startYear)}-${two(startYear + 1)}`;
  const n = Number(seq);
  const padded = Number.isFinite(n) && n > 0 ? String(n).padStart(3, "0") : "???";
  const code = schoolCode.trim().toUpperCase();
  return `SMI-${fy}-${padded}${code ? `_SCH_${code}` : ""}`;
}

/** Last fully-completed calendar month, as "YYYY-MM" — schools are billed in
 *  arrears, so this is the sensible default for a new invoice draft. */
function defaultBillingMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface DraftResponse extends RpcEnvelope {
  draftId?: string;
  note?: string;
}

function statusStyle(status: string) {
  const s = (status ?? "").toUpperCase();
  if (s === "FINAL" || s === "FINALISED" || s === "PAID" || s === "ISSUED")
    return "border-dash-accent/30 bg-dash-accent/10 text-dash-accent";
  if (s === "VOID" || s === "CANCELLED" || s === "REJECTED") return "border-red-500/30 bg-red-500/10 text-red-300";
  return "border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/60";
}

const selectCls =
  "flex h-11 w-full rounded-2xl border border-dash-fg/12 bg-dash-sidebar px-4 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60";

export default function StaffSchoolInvoicePage() {
  const { session } = useTokenAuth();
  const branches = session?.branches ?? [];
  const [branch, setBranch] = React.useState(branches.length === 1 ? branches[0] : "ALL");

  const invoices = useRpc<SchoolInvoiceListResponse>("api_listSchoolInvoices", { branch });
  const rows = invoices.data?.invoices ?? [];

  const [amount, setAmount] = React.useState("");
  const [extraCharges, setExtraCharges] = React.useState<ExtraChargeInput[]>([]);
  const [tenure, setTenure] = React.useState("");
  const [schoolId, setSchoolId] = React.useState("");
  const [invoiceDate, setInvoiceDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [billingMonth, setBillingMonth] = React.useState(defaultBillingMonth());
  const [notes, setNotes] = React.useState("");
  const [confirmed, setConfirmed] = React.useState(false);
  const [success, setSuccess] = React.useState<DraftResponse | null>(null);
  const intentRef = React.useRef(`SIDRAFT-${Date.now()}`);

  const schools = useSchools();
  const selectedSchool = (schools.data?.schools ?? []).find((s) => s.schoolId === schoolId) ?? null;
  const [schoolAddress, setSchoolAddress] = React.useState("");

  // Pre-fill (and reset) the editable address whenever a different school is
  // picked — it's a per-invoice override, not a persisted edit to the school.
  React.useEffect(() => {
    setSchoolAddress(selectedSchool?.address ?? "");
  }, [selectedSchool?.schoolId, selectedSchool?.address]);

  // Suggested invoice number — a proposal only. The founder's approval is
  // what actually allocates it when the draft is finalised.
  const [invoiceSeq, setInvoiceSeq] = React.useState("");
  const [seqTouched, setSeqTouched] = React.useState(false);
  const peekSeq = useRpc<PeekInvoiceNoResponse>(
    "api_peekNextSchoolInvoiceNo",
    { schoolId, invoiceDate },
    { enabled: schoolId.length > 0 && !success },
  );
  React.useEffect(() => {
    setSeqTouched(false);
  }, [selectedSchool?.schoolId]);
  React.useEffect(() => {
    if (seqTouched || success) return;
    if (peekSeq.data?.seq) setInvoiceSeq(String(peekSeq.data.seq));
  }, [peekSeq.data?.seq, seqTouched, success]);

  const draftBranch = branch === "ALL" ? branches[0] ?? "" : branch;

  const submit = useMutationRpc<DraftArg, DraftResponse>("api_staff_submitSchoolInvoiceDraft", {
    onSuccess: (res) => {
      setSuccess(res);
      toast.success(res.note ?? "Sent for approval.");
      intentRef.current = `SIDRAFT-${Date.now()}`;
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not send the draft."),
  });

  const amountNum = Number(amount);

  // Only rows with BOTH a description and an amount count — a blank "Add
  // charge" row that was never filled in is just dropped, never sent.
  const cleanedCharges = extraCharges
    .map((c) => ({ description: c.description.trim(), amount: Number(c.amount) || 0 }))
    .filter((c) => c.description.length > 0 && c.amount > 0);

  const addCharge = () => setExtraCharges((prev) => [...prev, { description: "", amount: "" }]);
  const removeCharge = (index: number) => setExtraCharges((prev) => prev.filter((_, i) => i !== index));
  const updateCharge = (index: number, field: "description" | "amount", value: string) =>
    setExtraCharges((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));

  const hasIncompleteCharge = extraCharges.some((c) => {
    const hasDescription = c.description.trim().length > 0;
    const hasAmount = c.amount.trim().length > 0 && Number(c.amount) > 0;
    return hasDescription !== hasAmount;
  });

  const valid = schoolId.length > 0 && Number.isFinite(amountNum) && amountNum > 0 && confirmed && !hasIncompleteCharge;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    submit.mutate({
      schoolId,
      amount: amountNum,
      tenure: tenure.trim(),
      invoiceDate,
      billingMonth,
      schoolAddress: schoolAddress.trim(),
      invoiceSeq: invoiceSeq.trim(),
      branch: draftBranch,
      notes: notes.trim(),
      previewConfirmed: true,
      clientIntentKey: intentRef.current,
      extraCharges: cleanedCharges,
    });
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-6">
      <motion.div variants={fadeUp} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-dash-fg/40">Staff · Academy</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">School Invoices</h1>
          <p className="mt-1 text-sm text-dash-fg/55">
            Draft an invoice for Sharvil to number and issue.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {branches.length > 1 && (
            <select
              aria-label="Branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="h-11 rounded-2xl border border-dash-fg/12 bg-dash-sidebar px-3 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
            >
              <option value="ALL">All branches</option>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}
          <PaymentProfileDialog />
        </div>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card className="border-dash-fg/10 bg-dash-card">
          <CardContent className="space-y-4 pt-5">
            <h2 className="text-sm font-semibold text-dash-fg/90">New invoice draft</h2>

            {success && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-300">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                <span>{success.note ?? "Sent for approval."}</span>
                {success.draftId && <span className="font-mono text-xs text-emerald-200/70">{success.draftId}</span>}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <SchoolPicker value={schoolId} onChange={setSchoolId} />
              {selectedSchool && (
                <div className="space-y-2">
                  <Label className="text-dash-fg/70">School address</Label>
                  <Textarea
                    value={schoolAddress}
                    onChange={(e) => setSchoolAddress(e.target.value)}
                    rows={2}
                    placeholder="No address on file — enter one for this invoice"
                    className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
                  />
                  <p className="text-[11px] text-dash-fg/40">
                    Only for this invoice — won&rsquo;t change the school&rsquo;s saved address.
                  </p>
                </div>
              )}

              {selectedSchool && (
                <div className="space-y-2">
                  <Label className="text-dash-fg/70">Invoice number</Label>
                  <Input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={invoiceSeq}
                    onChange={(e) => {
                      setSeqTouched(true);
                      setInvoiceSeq(e.target.value);
                    }}
                    placeholder={peekSeq.data ? String(peekSeq.data.seq) : "e.g. 7"}
                    className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
                  />
                  <p className="text-[11px] text-dash-fg/40">
                    Suggested as <span className="font-medium text-dash-fg/60">{clientInvoiceNo(invoiceDate, invoiceSeq, selectedSchool.code)}</span> —
                    Sharvil allocates the real number when he approves this.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-dash-fg/70">Fixed amount (₹) *</Label>
                <Input
                  type="number"
                  min="1"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 9000"
                  className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-dash-fg/70">Other charges (optional)</Label>
                  <button
                    type="button"
                    onClick={addCharge}
                    className="inline-flex items-center gap-1 text-xs font-medium text-dash-accent hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    Add charge
                  </button>
                </div>
                {extraCharges.map((charge, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={charge.description}
                      onChange={(e) => updateCharge(i, "description", e.target.value)}
                      placeholder="e.g. Diwali decoration"
                      className="flex-[2] border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
                    />
                    <Input
                      type="number"
                      min="0"
                      inputMode="decimal"
                      value={charge.amount}
                      onChange={(e) => updateCharge(i, "amount", e.target.value)}
                      placeholder="₹"
                      className="flex-1 border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
                    />
                    <button
                      type="button"
                      onClick={() => removeCharge(i)}
                      aria-label="Remove charge"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-dash-fg/40 hover:bg-dash-fg/[0.06] hover:text-dash-fg/70"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ))}
                {hasIncompleteCharge && (
                  <p className="text-[11px] text-red-400">Each other charge needs both a description and an amount.</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-dash-fg/70">Billing period</Label>
                  <Input
                    type="month"
                    value={billingMonth}
                    onChange={(e) => setBillingMonth(e.target.value)}
                    className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-dash-fg/70">Invoice date</Label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-dash-fg/70">Tenure</Label>
                  <Input
                    value={tenure}
                    onChange={(e) => setTenure(e.target.value)}
                    placeholder="1 Month / 6 Months"
                    className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-dash-fg/70">Branch</Label>
                  <select className={selectCls} value={draftBranch} onChange={(e) => setBranch(e.target.value)}>
                    {branches.length === 0 && <option value="">Default</option>}
                    {branches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-dash-fg/70">Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything Sharvil should know"
                  className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
                />
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.02] p-4 text-sm text-dash-fg/80">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="h-4 w-4 rounded border-dash-fg/20 bg-dash-sidebar accent-dash-accent"
                />
                I have checked the school, amount and tenure before sending.
              </label>

              <Button
                type="submit"
                disabled={!valid}
                loading={submit.isPending}
                className="w-full bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
              >
                <FileText className="h-4 w-4" aria-hidden />
                Send for approval
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {selectedSchool && (
        <motion.div variants={fadeUp}>
          <h2 className="mb-3 text-sm font-semibold text-dash-fg/80">Invoice preview</h2>
          <InvoicePreview
            invoiceNo={clientInvoiceNo(invoiceDate, invoiceSeq, selectedSchool.code)}
            invoiceDate={invoiceDate}
            billingPeriodFrom={billingMonthBounds(billingMonth).from}
            billingPeriodTo={billingMonthBounds(billingMonth).to}
            className=""
            amount={amountNum || 0}
            tenure={tenure}
            branch={draftBranch}
            schoolCode={selectedSchool.code}
            schoolName={selectedSchool.name}
            schoolAddress={schoolAddress}
            schoolContact={selectedSchool.contact}
            charges={cleanedCharges}
          />
        </motion.div>
      )}

      <motion.div variants={fadeUp} className="space-y-2">
        <h2 className="text-sm font-semibold text-dash-fg/80">Invoices</h2>
        {invoices.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[68px] bg-dash-fg/[0.04]" />
            ))}
          </div>
        ) : invoices.isError ? (
          <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-6 text-sm text-red-300">
            {invoices.error?.message?.replace(/\[.*\]$/, "") || "Could not load invoices."}
          </p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-dash-fg/15 bg-dash-fg/[0.02] px-6 py-14 text-center">
            <Plus className="mb-3 h-8 w-8 text-dash-fg/25" aria-hidden />
            <p className="text-sm font-medium text-dash-fg/70">No invoices yet</p>
            <p className="mt-1 text-xs text-dash-fg/40">Draft the first one above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((inv) => (
              <Link
                key={inv.invoiceId}
                href={`/staff/school-invoice/${encodeURIComponent(inv.invoiceId)}`}
                className="flex items-center gap-4 rounded-2xl border border-dash-fg/10 bg-dash-card p-4 transition-colors hover:border-dash-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-mono text-sm font-semibold text-dash-fg">{inv.invoiceNo || "—"}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusStyle(inv.status)}`}>
                      {inv.status || "—"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-dash-fg/50">
                    {[inv.schoolName || inv.schoolCode, inv.className, inv.branch, formatDateOnly(inv.invoiceDate), inv.tenure]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-dash-fg">{formatINR(inv.amount)}</p>
              </Link>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
