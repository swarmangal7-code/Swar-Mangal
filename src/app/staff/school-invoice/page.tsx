"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, FileText, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useMutationRpc, useRpc } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope, SchoolInvoiceListResponse } from "@/lib/api/rpc-types";
import { useTokenAuth } from "@/lib/auth/token-auth";
import { fadeUp, listVariants } from "@/lib/motion";
import { formatDateOnly, formatINR } from "@/app/founder/_shared";

interface DraftArg extends Record<string, unknown> {
  className: string;
  amount: number;
  tenure: string;
  invoiceDate: string;
  branch: string;
  notes: string;
  previewConfirmed: boolean;
  clientIntentKey: string;
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

  const [className, setClassName] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [tenure, setTenure] = React.useState("");
  const [invoiceDate, setInvoiceDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = React.useState("");
  const [confirmed, setConfirmed] = React.useState(false);
  const [success, setSuccess] = React.useState<DraftResponse | null>(null);
  const intentRef = React.useRef(`SIDRAFT-${Date.now()}`);

  const draftBranch = branch === "ALL" ? branches[0] ?? "" : branch;

  const submit = useMutationRpc<DraftArg, DraftResponse>("api_staff_submitSchoolInvoiceDraft", {
    onSuccess: (res) => {
      setSuccess(res);
      toast.success(res.note ?? "Sent to Sharvil.");
      intentRef.current = `SIDRAFT-${Date.now()}`;
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not send the draft."),
  });

  const amountNum = Number(amount);
  const valid = className.trim().length > 0 && Number.isFinite(amountNum) && amountNum > 0 && confirmed;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    submit.mutate({
      className: className.trim(),
      amount: amountNum,
      tenure: tenure.trim(),
      invoiceDate,
      branch: draftBranch,
      notes: notes.trim(),
      previewConfirmed: true,
      clientIntentKey: intentRef.current,
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
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card className="border-dash-fg/10 bg-dash-card">
          <CardContent className="space-y-4 pt-5">
            <h2 className="text-sm font-semibold text-dash-fg/90">New invoice draft</h2>

            {success && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-300">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                <span>{success.note ?? "Sent to Sharvil."}</span>
                {success.draftId && <span className="font-mono text-xs text-emerald-200/70">{success.draftId}</span>}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-dash-fg/70">Class / school *</Label>
                  <Input
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="e.g. Tabla — St. Xavier's"
                    className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-dash-fg/70">Amount (₹) *</Label>
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
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
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
                  <Label className="text-dash-fg/70">Invoice date</Label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
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
                I have checked the class, amount and tenure before sending.
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
              <div
                key={inv.invoiceId}
                className="flex items-center gap-4 rounded-2xl border border-dash-fg/10 bg-dash-card p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-mono text-sm font-semibold text-dash-fg">{inv.invoiceNo || "—"}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusStyle(inv.status)}`}>
                      {inv.status || "—"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-dash-fg/50">
                    {[inv.className, inv.branch, formatDateOnly(inv.invoiceDate), inv.tenure].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-dash-fg">{formatINR(inv.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
