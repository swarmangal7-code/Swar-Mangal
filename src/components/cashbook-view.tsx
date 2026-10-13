"use client";

import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, CircleDollarSign, Download, Pencil, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCashbook, useMutationRpc } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope } from "@/lib/api/rpc-types";
import { fadeUp } from "@/lib/motion";
import { currentMonth, fmtDate, inr } from "@/lib/utils/cn";
import { motion } from "framer-motion";

const selectCls =
  "flex h-11 w-full rounded-2xl border border-dash-fg/12 bg-dash-sidebar px-4 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60";

export function CashbookView({ branches }: { branches: string[] }) {
  const [month, setMonth] = React.useState(currentMonth());
  const [branch, setBranch] = React.useState("ALL");

  const { data, isFetching, error } = useCashbook(branch, month);

  const entries = data?.entries ?? [];
  // Lifetime cash on hand for the selected scope — not the month's net.
  // Stays visible even with no entries in the picked month.
  const available = Number(data?.balance ?? 0);
  const inflow = entries.filter((e) => (e.type ?? "EXPENSE").toUpperCase().includes("INFLOW"));
  const outflow = entries.filter((e) => !(e.type ?? "EXPENSE").toUpperCase().includes("INFLOW"));
  const inflowTotal = inflow.reduce((s, e) => s + Number(e.amount), 0);
  const outflowTotal = outflow.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <motion.div variants={fadeUp} className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-fit border-dash-fg/12 bg-dash-card text-dash-fg"
        />
        <select className={selectCls + " w-auto"} value={branch} onChange={(e) => setBranch(e.target.value)}>
          <option value="ALL">All branches</option>
          {branches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Available"
          value={inr(available)}
          tone={available >= 0 ? "mint" : "peach"}
          icon={Wallet}
          action={<AdjustBalanceButton branches={branches} currentBranch={branch} />}
        />
        <SummaryCard label="Inflow" value={inr(inflowTotal)} tone="mint" icon={ArrowDownLeft} />
        <SummaryCard label="Outflow" value={inr(outflowTotal)} tone="peach" icon={ArrowUpRight} />
        <SummaryCard label="Net" value={inr(inflowTotal - outflowTotal)} tone={inflowTotal - outflowTotal >= 0 ? "mint" : "peach"} icon={CircleDollarSign} />
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-6 text-sm text-red-300">{error.message}</p>
      ) : isFetching && entries.length === 0 ? (
        <Card className="border-dash-fg/10 bg-dash-card">
          <CardContent className="space-y-2 p-4">
            <Skeleton className="h-9 bg-dash-fg/[0.05]" />
            <Skeleton className="h-9 bg-dash-fg/[0.05]" />
            <Skeleton className="h-9 bg-dash-fg/[0.05]" />
          </CardContent>
        </Card>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-dash-fg/15 bg-dash-fg/[0.02] px-6 py-14 text-center">
          <Download className="mb-3 h-8 w-8 text-dash-fg/20" aria-hidden />
          <p className="text-sm font-medium text-dash-fg/70">No ledger entries</p>
          <p className="mt-1 text-xs text-dash-fg/40">Nothing recorded for this month yet.</p>
        </div>
      ) : (
        <Card className="overflow-hidden border-dash-fg/10 bg-dash-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dash-fg/10 text-left text-[11px] uppercase tracking-[0.12em] text-dash-fg/35">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dash-fg/[0.06]">
                {entries.map((e) => {
                  const isIn = (e.type ?? "").toUpperCase().includes("INFLOW");
                  return (
                    <tr key={e.entryId} className="hover:bg-dash-fg/[0.03]">
                      <td className="px-4 py-3 text-dash-fg/60">{fmtDate(e.date)}</td>
                      <td className="px-4 py-3 font-medium text-dash-fg/85">{e.category || "—"}</td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-dash-fg/60">{e.description || "—"}</td>
                      <td className="px-4 py-3 text-dash-fg/60">{e.mode || e.status || "—"}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${isIn ? "text-emerald-300" : "text-dash-fg"}`}>
                        {isIn ? "+" : "−"}
                        {inr(e.amount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {e.approvalStatus && e.approvalStatus !== "APPROVED" ? (
                          <Badge variant="peach">{e.approvalStatus}</Badge>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-dash-fg/15 bg-dash-fg/[0.03]">
                  <td colSpan={4} className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-dash-fg/45">
                    Totals
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-dash-fg">
                    {inr(inflowTotal)} in · {inr(outflowTotal)} out
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-dash-fg/45">net {inr(inflowTotal - outflowTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </motion.div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  icon: Icon,
  action,
}: {
  label: string;
  value: string;
  tone: "mint" | "peach";
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  action?: React.ReactNode;
}) {
  const color = tone === "mint" ? "text-emerald-300" : "text-rose-300";
  return (
    <Card className="border-dash-fg/10 bg-dash-card">
      <CardContent className="flex items-center gap-3 pt-5">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-dash-fg/[0.05] ${color}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-dash-fg/45">{label}</p>
          <p className="text-lg font-semibold tracking-tight text-dash-fg">{value}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

interface AdjustArg extends Record<string, unknown> {
  direction: string;
  amount: number;
  reason: string;
  branch: string;
  paymentMode: string;
  clientIntentKey: string;
}

interface AdjustResponse extends RpcEnvelope {
  entryId?: string;
  note?: string;
}

/**
 * Edit affordance for the Available card. This never overwrites a number:
 * it posts a real "Balance Correction" ledger adjustment (cash in or cash
 * out) to the selected branch, audited and idempotency-guarded like every
 * other money write. Available to both founder and staff — the endpoint
 * is STAFF-level, and this shared component serves both dashboards.
 */
function AdjustBalanceButton({ branches, currentBranch }: { branches: string[]; currentBranch: string }) {
  const [open, setOpen] = React.useState(false);
  const [direction, setDirection] = React.useState<"IN" | "OUT">("IN");
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const options = branches.length ? branches : ["GOREGAON", "KANDIVALI"];
  const [branch, setBranch] = React.useState(currentBranch !== "ALL" ? currentBranch : options[0] ?? "KANDIVALI");
  const intentRef = React.useRef(`ADJ-${Date.now()}`);

  React.useEffect(() => {
    if (open && currentBranch !== "ALL") setBranch(currentBranch);
  }, [open, currentBranch]);

  const adjust = useMutationRpc<AdjustArg, AdjustResponse>("api_addBalanceCorrection", {
    onSuccess: (res) => {
      toast.success(res.note ?? "Cashbook corrected");
      setOpen(false);
      setAmount("");
      setReason("");
      intentRef.current = `ADJ-${Date.now()}`;
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not correct the balance."),
  });

  const amountNum = Number(amount);
  const valid = Number.isFinite(amountNum) && amountNum > 0 && reason.trim().length > 0 && branch.length > 0;

  const submit = () => {
    if (!valid) return;
    adjust.mutate({
      direction,
      amount: amountNum,
      reason: reason.trim(),
      branch,
      paymentMode: "Cash",
      clientIntentKey: intentRef.current,
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Edit available amount"
        title="Edit available amount"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-dash-fg/12 text-dash-fg/50 transition-colors hover:border-dash-accent/50 hover:text-dash-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-dash-fg/12 bg-dash-card text-dash-fg">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Edit available amount</DialogTitle>
            <DialogDescription className="text-dash-fg/55">
              Posts a Balance Correction entry to the ledger — the figure itself is never overwritten.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              {(["IN", "OUT"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  aria-pressed={direction === d}
                  className={`flex-1 rounded-2xl border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60 ${
                    direction === d
                      ? "border-dash-accent/50 bg-dash-accent/15 text-dash-accent"
                      : "border-dash-fg/12 text-dash-fg/65 hover:text-dash-fg"
                  }`}
                >
                  {d === "IN" ? "Cash in" : "Cash out"}
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[13px] text-dash-fg/70">Amount (₹) *</Label>
                <Input
                  type="number"
                  min="1"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 2000"
                  className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] text-dash-fg/70">Branch *</Label>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-dash-fg/12 bg-dash-sidebar px-3 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
                >
                  {options.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Reason *</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Opening cash counted physically"
                className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} className="text-dash-fg/70 hover:bg-dash-fg/[0.05]">
              Cancel
            </Button>
            <Button
              className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
              loading={adjust.isPending}
              disabled={!valid}
              onClick={submit}
            >
              {adjust.isPending ? "Posting…" : `Post ${direction === "IN" ? "cash in" : "cash out"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
