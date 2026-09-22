"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { BadgeIndianRupee, ChevronDown, CircleCheck, HandCoins, UserRound, Users } from "lucide-react";
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
import { useMutationRpc, usePayoutPreview } from "@/lib/api/rpc-hooks";
import type { PayoutRow, RpcEnvelope, SharedStudentDecision, SharedStudentTeacher } from "@/lib/api/rpc-types";
import { fadeUp, listVariants } from "@/lib/motion";
import { cn, currentMonth, inr, todayISO } from "@/lib/utils/cn";

const MODES = ["Bank Transfer", "UPI", "Cash", "Cheque"];

interface RecordPayoutArg extends Record<string, unknown> {
  teacherId: string;
  month: string;
  amount: number;
  paidOn: string;
  paymentMode: string;
  reference: string;
  branch: string;
}

interface RecordPayoutResponse extends RpcEnvelope {
  payoutId?: string;
  totalPaidForMonth?: number;
  note?: string;
}

interface AssignSharedArg extends Record<string, unknown> {
  month: string;
  studentId: string;
  allocations: { teacherId: string; amount: number }[];
}

const selectCls =
  "flex h-11 w-full rounded-2xl border border-dash-fg/12 bg-dash-sidebar px-4 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60";

export default function FounderPayoutsPage() {
  const [month, setMonth] = React.useState(currentMonth());
  const { data, isFetching, error } = usePayoutPreview(month);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const rows = data?.results ?? [];
  const totalPayable = rows.reduce((s, r) => s + (Number(r.payable) || 0), 0);
  const totalPaid = rows.reduce((s, r) => s + (Number(r.alreadyPaid) || 0), 0);
  const remaining = rows.reduce((s, r) => s + (Number(r.balance) || 0), 0);
  const awaiting = data?.awaitingDecision ?? [];

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-6">
      <motion.div variants={fadeUp} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-dash-fg/40">Money</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">Teacher Payouts</h1>
          <p className="mt-1 text-sm text-dash-fg/55">Earnings are computed server-side — nothing is calculated on this screen.</p>
        </div>
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-fit border-dash-fg/12 bg-dash-card text-dash-fg"
        />
      </motion.div>

      <motion.div variants={fadeUp} className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={BadgeIndianRupee} label="Total payable" value={inr(totalPayable)} />
        <SummaryCard icon={CircleCheck} label="Total paid" value={inr(totalPaid)} />
        <SummaryCard icon={HandCoins} label="Remaining" value={inr(remaining)} />
      </motion.div>

      {error ? (
        <motion.div variants={fadeUp}>
          <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-6 text-sm text-red-300">{error.message}</p>
        </motion.div>
      ) : isFetching && rows.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 bg-dash-fg/[0.04]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <motion.div variants={fadeUp}>
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-dash-fg/15 bg-dash-fg/[0.02] px-6 py-14 text-center">
            <Users className="mb-3 h-9 w-9 text-dash-fg/20" aria-hidden />
            <p className="text-sm font-medium text-dash-fg/70">No payout data for this month</p>
            <p className="mt-1 text-xs text-dash-fg/40">Once classes are attended and receipts are recorded, earnings show up here.</p>
          </div>
        </motion.div>
      ) : (
        <>
          <div className="space-y-2">
            {rows.map((r) => (
              <PayoutCard key={r.teacherId} row={r} month={month} open={expanded === r.teacherId} onToggle={() => setExpanded(expanded === r.teacherId ? null : r.teacherId)} />
            ))}
          </div>

          {awaiting.length > 0 && (
            <motion.div variants={fadeUp} className="pt-2">
              <h2 className="mb-3 text-sm font-semibold text-dash-fg/80">
                Shared students — split {inr(data?.awaitingDecisionAmount ?? 0)}
              </h2>
              <div className="space-y-2">
                {awaiting.map((d) => (
                  <SharedCard key={d.studentId} decision={d} month={month} />
                ))}
              </div>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}

function PayoutCard({ row, month, open, onToggle }: { row: PayoutRow; month: string; open: boolean; onToggle: () => void }) {
  const [payOpen, setPayOpen] = React.useState(false);
  const payable = Number(row.payable) || 0;
  const paid = Number(row.alreadyPaid) || 0;
  const balance = Number(row.balance);
  const balanceNum = Number.isFinite(balance) ? balance : 0;

  return (
    <Card className={cn("border-dash-fg/10 bg-dash-card transition-colors", open && "border-dash-accent/40")}>
      <CardContent className="p-4 sm:p-5">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dash-accent/10 text-dash-accent">
            <UserRound className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-dash-fg">{row.teacherName}</span>
            <span className="block text-xs text-dash-fg/45">
              {row.receiptCount} session{row.receiptCount === 1 ? "" : "s"} · gross {inr(row.totalCollection)}
            </span>
          </span>
          <span className="hidden gap-4 text-right sm:flex">
            <span className="w-20 text-xs text-dash-fg/45">
              paid<span className="block text-sm font-semibold text-dash-fg/80">{inr(paid)}</span>
            </span>
            <span className="w-20 text-xs text-dash-fg/45">
              balance<span className="block text-sm font-semibold text-dash-fg">{inr(row.balance)}</span>
            </span>
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-dash-fg/40 transition-transform", open && "rotate-180")} aria-hidden />
        </button>

        {open && (
          <div className="mt-4 space-y-3 border-t border-dash-fg/10 pt-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Detail label="Sessions held" value={String(row.receiptCount)} />
              <Detail label="Gross collected" value={inr(row.totalCollection)} />
              <Detail label="Teacher share" value={inr(row.totalTeacherShare)} />
              <Detail label="Payable" value={inr(payable)} />
            </div>
            {(row.reasons ?? []).length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-dash-fg/35">Notes</p>
                <ul className="mt-1 space-y-1">
                  {row.reasons.map((r, i) => (
                    <li key={i} className="text-xs text-dash-fg/55">• {r.message}</li>
                  ))}
                </ul>
              </div>
            )}
            {(row.qualifications ?? []).length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-dash-fg/35">Qualification</p>
                <ul className="mt-1 space-y-1">
                  {row.qualifications.map((r, i) => (
                    <li key={i} className="text-xs text-emerald-300/80">• {r.message}</li>
                  ))}
                </ul>
              </div>
            )}
            {row.note && <p className="text-xs text-dash-fg/45">{row.note}</p>}
            {row.status && <Badge variant={row.status.toUpperCase().includes("PAID") ? "mint" : "peach"}>{row.status}</Badge>}
            <Button
              className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover lg:w-fit"
              size="sm"
              disabled={balanceNum <= 0}
              onClick={() => setPayOpen(true)}
            >
              <HandCoins className="h-4 w-4" /> Record payment {inr(row.balance)}
            </Button>
          </div>
        )}
      </CardContent>

      <RecordPaymentDialog open={payOpen} onOpenChange={setPayOpen} teacher={row} month={month} defaultAmount={balanceNum} />
    </Card>
  );
}

function RecordPaymentDialog({
  open,
  onOpenChange,
  teacher,
  month,
  defaultAmount,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  teacher: PayoutRow;
  month: string;
  defaultAmount: number;
}) {
  const [amount, setAmount] = React.useState(String(Number(defaultAmount) || ""));
  const [mode, setMode] = React.useState("Bank Transfer");
  const [reference, setReference] = React.useState("");
  const [paidOn, setPaidOn] = React.useState(todayISO());

  React.useEffect(() => {
    if (open) {
      setAmount(String(Number(defaultAmount) || ""));
      setReference("");
      setPaidOn(todayISO());
    }
  }, [open, defaultAmount]);

  const record = useMutationRpc<RecordPayoutArg, RecordPayoutResponse>("api_recordTeacherPayout", {
    onSuccess: (res) => {
      toast.success(res.note ?? `Payout ${res.payoutId ?? ""} recorded`);
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const amountNum = Number(amount);
  const valid = Number.isFinite(amountNum) && amountNum > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-dash-fg/12 bg-dash-card text-dash-fg">
        <DialogHeader>
          <DialogTitle className="text-dash-fg">Record payment — {teacher.teacherName}</DialogTitle>
          <DialogDescription className="text-dash-fg/55">
            {month} · posts a cashbook outflow server-side. Audited, founder only.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-dash-fg/70">Amount (₹)</Label>
            <Input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-dash-fg/70">Mode</Label>
              <select className={selectCls} value={mode} onChange={(e) => setMode(e.target.value)}>
                {MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-dash-fg/70">Paid on</Label>
              <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className="border-dash-fg/12 bg-dash-sidebar text-dash-fg" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-dash-fg/70">Reference / UTR (optional)</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
              placeholder="Bank ref, UTR…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-dash-fg/70 hover:bg-dash-fg/[0.05]">
            Cancel
          </Button>
          <Button
            className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
            disabled={!valid}
            loading={record.isPending}
            onClick={() =>
              record.mutate({
                teacherId: teacher.teacherId,
                month,
                amount: amountNum,
                paidOn,
                paymentMode: mode,
                reference: reference.trim(),
                branch: "",
              })
            }
          >
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SharedCard({ decision, month }: { decision: SharedStudentDecision; month: string }) {
  const [openAssign, setOpenAssign] = React.useState(false);
  return (
    <Card className="border-dash-fg/10 bg-dash-card">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-dash-fg">{decision.studentName}</p>
          <p className="text-xs text-dash-fg/45">
            collected {inr(decision.collected)} · assigned {inr(decision.assigned)} · {inr(decision.remaining)} to split
          </p>
        </div>
        <Button size="sm" variant="outline" className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]" onClick={() => setOpenAssign(true)}>
          Split
        </Button>
      </CardContent>
      <AssignSharedDialog open={openAssign} onOpenChange={setOpenAssign} decision={decision} month={month} />
    </Card>
  );
}

function AssignSharedDialog({
  open,
  onOpenChange,
  decision,
  month,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  decision: SharedStudentDecision;
  month: string;
}) {
  const [allocs, setAllocs] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      const first: Record<string, string> = {};
      for (const t of decision.teachers) first[t.teacherId] = "";
      setAllocs(first);
    }
  }, [open, decision]);

  const used = Object.values(allocs).reduce((s, v) => s + (Number(v) || 0), 0);
  const remaining = Number(decision.remaining) || 0;
  const valid = used > 0 && used <= remaining + 1e-9;

  const assign = useMutationRpc<AssignSharedArg, RpcEnvelope>("api_assignSharedStudent", {
    onSuccess: () => {
      toast.success("Split saved");
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-dash-fg/12 bg-dash-card text-dash-fg">
        <DialogHeader>
          <DialogTitle className="text-dash-fg">Split {decision.studentName}</DialogTitle>
          <DialogDescription className="text-dash-fg/55">
            Divide {inr(remaining)} between the teachers who taught this student in {month}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {decision.teachers.map((t) => (
            <AssignmentRow key={t.teacherId} teacher={t} value={allocs[t.teacherId] ?? ""} onChange={(v) => setAllocs((p) => ({ ...p, [t.teacherId]: v }))} />
          ))}
          <div className="flex items-center justify-between border-t border-dash-fg/10 pt-3 text-sm">
            <span className="text-dash-fg/55">
              Allocated {inr(used)} of {inr(remaining)}
            </span>
            <span className={cn("font-semibold", used > remaining ? "text-rose-300" : "text-emerald-300")}>
              {inr(Math.max(remaining - used, 0))} left
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-dash-fg/70 hover:bg-dash-fg/[0.05]">
            Cancel
          </Button>
          <Button
            className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
            disabled={!valid}
            loading={assign.isPending}
            onClick={() =>
              assign.mutate({
                month,
                studentId: decision.studentId,
                allocations: decision.teachers
                  .map((t) => ({ teacherId: t.teacherId, amount: Number(allocs[t.teacherId]) || 0 }))
                  .filter((a) => a.amount > 0),
              })
            }
          >
            Save split
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignmentRow({ teacher, value, onChange }: { teacher: SharedStudentTeacher; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-dash-fg/85">{teacher.teacherName}</p>
        <p className="text-xs text-dash-fg/40">{teacher.classesThisMonth} classes · assigned {inr(teacher.assigned)}</p>
      </div>
      <Input
        type="number"
        min="0"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="w-28 border-dash-fg/12 bg-dash-sidebar text-right text-dash-fg placeholder:text-dash-fg/30"
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}) {
  return (
    <Card className="border-dash-fg/10 bg-dash-card">
      <CardContent className="flex items-center gap-3 pt-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-dash-accent/10 text-dash-accent">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <p className="text-xs text-dash-fg/45">{label}</p>
          <p className="text-lg font-semibold tracking-tight text-dash-fg">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.12em] text-dash-fg/35">{label}</p>
      <p className="mt-0.5 font-medium text-dash-fg/85">{value}</p>
    </div>
  );
}