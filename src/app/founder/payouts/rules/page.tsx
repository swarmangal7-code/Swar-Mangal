"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CalendarClock, Gauge, Info, Plus } from "lucide-react";
import { toast } from "sonner";

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
import { rpcKeys, useMutationRpc, usePayoutSettings } from "@/lib/api/rpc-hooks";
import type { LateFeeSetting, PayoutStatusRule, RpcEnvelope, TeacherPercentSlab } from "@/lib/api/rpc-types";
import { fadeUp, listVariants } from "@/lib/motion";
import { fmtDate, inr } from "@/lib/utils/cn";

const OUTCOMES = [
  "HELD",
  "TEACHER_CANCELLED",
  "ACADEMY_CANCELLED",
  "SUBSTITUTE_DELIVERED",
  "RESCHEDULED",
  "TEACHER_ABSENT",
  "SCHOOL_HOLIDAY",
  "STUDENT_ABSENT",
];

const selectCls =
  "flex h-11 w-full rounded-2xl border border-dash-fg/12 bg-dash-sidebar px-4 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60";

export default function PayoutRulesPage() {
  const { data, isFetching, error } = usePayoutSettings();
  const loading = isFetching && !data;

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-6">
      <motion.div variants={fadeUp}>
        <p className="text-xs uppercase tracking-[0.16em] text-dash-fg/40">Money</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">Payroll Rules</h1>
        <p className="mt-1 text-sm text-dash-fg/55">
          Every save below adds a new effective-dated row — nothing existing is ever edited or deleted, so a month
          already shown to you never silently reshapes.
        </p>
      </motion.div>

      {error && (
        <motion.div variants={fadeUp}>
          <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-6 text-sm text-red-300">{error.message}</p>
        </motion.div>
      )}

      <motion.div variants={fadeUp}>
        <StatusRuleSection rows={data?.payoutStatusRules ?? []} loading={loading} />
      </motion.div>
      <motion.div variants={fadeUp}>
        <SlabSection rows={data?.teacherPercentSlabs ?? []} loading={loading} />
      </motion.div>
      <motion.div variants={fadeUp}>
        <LateFeeSection rows={data?.lateFeeSettings ?? []} loading={loading} />
      </motion.div>
    </motion.div>
  );
}

function SectionShell({
  title,
  subtitle,
  icon: Icon,
  onAdd,
  addLabel,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  onAdd: () => void;
  addLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-dash-fg/10 bg-dash-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-dash-accent/10 text-dash-accent">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-dash-fg">{title}</h2>
              <p className="mt-0.5 max-w-xl text-xs text-dash-fg/50">{subtitle}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" aria-hidden /> {addLabel}
          </Button>
        </div>
        <div className="space-y-2 border-t border-dash-fg/10 pt-3">{children}</div>
      </CardContent>
    </Card>
  );
}

function EmptyHistory() {
  return <p className="text-xs text-dash-fg/40">Nothing added yet.</p>;
}

function HistoryRow({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-xl border border-dash-fg/10 bg-dash-fg/[0.02] px-3 py-2">
      <p className="truncate text-sm font-medium text-dash-fg/85">{title}</p>
      <p className="text-xs text-dash-fg/45">{subtitle}</p>
    </div>
  );
}

// ------------------------------------------------------------- status rules

function StatusRuleSection({ rows, loading }: { rows: PayoutStatusRule[]; loading: boolean }) {
  const [open, setOpen] = React.useState(false);
  return (
    <SectionShell
      title="Payout % by class outcome"
      subtitle="Informational / visibility-only — shown on the payout preview as badges. It never changes the payable figure. A real rupee correction goes through a manual payout adjustment instead."
      icon={Info}
      onAdd={() => setOpen(true)}
      addLabel="Add outcome rule"
    >
      {loading ? (
        <Skeleton className="h-12 bg-dash-fg/[0.04]" />
      ) : rows.length === 0 ? (
        <EmptyHistory />
      ) : (
        rows.map((r) => (
          <HistoryRow
            key={r.id}
            title={`${r.outcome} → ${r.payoutPercent}%`}
            subtitle={`from ${fmtDate(r.effectiveFrom)}${r.effectiveTo ? ` to ${fmtDate(r.effectiveTo)}` : ""}${r.notes ? ` · ${r.notes}` : ""}`}
          />
        ))
      )}
      <StatusRuleDialog open={open} onOpenChange={setOpen} />
    </SectionShell>
  );
}

function StatusRuleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [outcome, setOutcome] = React.useState(OUTCOMES[0]);
  const [percent, setPercent] = React.useState("");
  const [effectiveFrom, setEffectiveFrom] = React.useState("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setOutcome(OUTCOMES[0]);
      setPercent("");
      setEffectiveFrom("");
      setNotes("");
    }
  }, [open]);

  const mut = useMutationRpc<
    { outcome: string; payoutPercent: number; effectiveFrom?: string; notes?: string },
    RpcEnvelope & { note?: string }
  >("api_founder_setPayoutStatusRule", {
    invalidate: [rpcKeys.payoutSettings()],
    onSuccess: (res) => {
      toast.success(res.note ?? "Saved.");
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not save."),
  });

  const pct = Number(percent);
  const valid = Number.isFinite(pct) && pct >= 0 && pct <= 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-dash-fg/12 bg-dash-card text-dash-fg">
        <DialogHeader>
          <DialogTitle className="text-dash-fg">Add outcome payout rule</DialogTitle>
          <DialogDescription className="text-dash-fg/55">
            Adds a new effective-dated row. Earlier rows are untouched.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-dash-fg/70">Outcome</Label>
            <select className={selectCls} value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              {OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-dash-fg/70">Payout percent (0-100)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-dash-fg/70">Effective from (optional, default today)</Label>
            <Input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-dash-fg/70">Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="border-dash-fg/12 bg-dash-sidebar text-dash-fg" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-dash-fg/70 hover:bg-dash-fg/[0.05]">
            Cancel
          </Button>
          <Button
            className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
            disabled={!valid}
            loading={mut.isPending}
            onClick={() =>
              mut.mutate({
                outcome,
                payoutPercent: pct,
                effectiveFrom: effectiveFrom || undefined,
                notes: notes.trim() || undefined,
              })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ slabs

function SlabSection({ rows, loading }: { rows: TeacherPercentSlab[]; loading: boolean }) {
  const [open, setOpen] = React.useState(false);
  return (
    <SectionShell
      title="Teacher percent-slab ramp"
      subtitle="Months since a teacher's start → % of the normal rate. Only applies to a teacher explicitly opted into the slab model; every other teacher keeps reading their own payout rule untouched."
      icon={Gauge}
      onAdd={() => setOpen(true)}
      addLabel="Add slab step"
    >
      {loading ? (
        <Skeleton className="h-12 bg-dash-fg/[0.04]" />
      ) : rows.length === 0 ? (
        <EmptyHistory />
      ) : (
        rows.map((r) => (
          <HistoryRow key={r.id} title={`Month ${r.monthsSinceStart} → ${r.percent}%`} subtitle={`from ${fmtDate(r.effectiveFrom)}`} />
        ))
      )}
      <SlabDialog open={open} onOpenChange={setOpen} />
    </SectionShell>
  );
}

function SlabDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [months, setMonths] = React.useState("");
  const [percent, setPercent] = React.useState("");
  const [effectiveFrom, setEffectiveFrom] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setMonths("");
      setPercent("");
      setEffectiveFrom("");
    }
  }, [open]);

  const mut = useMutationRpc<
    { monthsSinceStart: number; percent: number; effectiveFrom?: string },
    RpcEnvelope & { note?: string }
  >("api_founder_setTeacherPercentSlab", {
    invalidate: [rpcKeys.payoutSettings()],
    onSuccess: (res) => {
      toast.success(res.note ?? "Saved.");
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not save."),
  });

  const m = Number(months);
  const pct = Number(percent);
  const valid = Number.isInteger(m) && m >= 0 && Number.isFinite(pct) && pct >= 0 && pct <= 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-dash-fg/12 bg-dash-card text-dash-fg">
        <DialogHeader>
          <DialogTitle className="text-dash-fg">Add slab step</DialogTitle>
          <DialogDescription className="text-dash-fg/55">
            Adds a new effective-dated row. Earlier rows are untouched.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-dash-fg/70">Months since start (e.g. 0, 6, 12)</Label>
            <Input
              type="number"
              min="0"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-dash-fg/70">Percent (0-100)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-dash-fg/70">Effective from (optional, default today)</Label>
            <Input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
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
            loading={mut.isPending}
            onClick={() => mut.mutate({ monthsSinceStart: m, percent: pct, effectiveFrom: effectiveFrom || undefined })}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------- late fee

function LateFeeSection({ rows, loading }: { rows: LateFeeSetting[]; loading: boolean }) {
  const [open, setOpen] = React.useState(false);
  return (
    <SectionShell
      title="Late-fee grace period & daily rate"
      subtitle="Days already accrued under an earlier rate are never retroactively changed — a new setting only affects days from its own effective date on."
      icon={CalendarClock}
      onAdd={() => setOpen(true)}
      addLabel="Add late-fee setting"
    >
      {loading ? (
        <Skeleton className="h-12 bg-dash-fg/[0.04]" />
      ) : rows.length === 0 ? (
        <EmptyHistory />
      ) : (
        rows.map((r) => (
          <HistoryRow key={r.id} title={`${r.graceDays} grace days · ${inr(r.dailyRate)}/day`} subtitle={`from ${fmtDate(r.effectiveFrom)}`} />
        ))
      )}
      <LateFeeDialog open={open} onOpenChange={setOpen} />
    </SectionShell>
  );
}

function LateFeeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [graceDays, setGraceDays] = React.useState("");
  const [dailyRate, setDailyRate] = React.useState("");
  const [effectiveFrom, setEffectiveFrom] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setGraceDays("");
      setDailyRate("");
      setEffectiveFrom("");
    }
  }, [open]);

  const mut = useMutationRpc<
    { graceDays: number; dailyRate: number; effectiveFrom?: string },
    RpcEnvelope & { note?: string }
  >("api_founder_setLateFeeSettings", {
    invalidate: [rpcKeys.payoutSettings()],
    onSuccess: (res) => {
      toast.success(res.note ?? "Saved.");
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not save."),
  });

  const grace = Number(graceDays);
  const rate = Number(dailyRate);
  const valid = Number.isInteger(grace) && grace >= 0 && Number.isFinite(rate) && rate >= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-dash-fg/12 bg-dash-card text-dash-fg">
        <DialogHeader>
          <DialogTitle className="text-dash-fg">Add late-fee setting</DialogTitle>
          <DialogDescription className="text-dash-fg/55">
            Adds a new effective-dated row. Earlier rows are untouched.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-dash-fg/70">Grace days</Label>
            <Input
              type="number"
              min="0"
              value={graceDays}
              onChange={(e) => setGraceDays(e.target.value)}
              className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-dash-fg/70">Daily rate (₹)</Label>
            <Input
              type="number"
              min="0"
              step="any"
              value={dailyRate}
              onChange={(e) => setDailyRate(e.target.value)}
              className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-dash-fg/70">Effective from (optional, default today)</Label>
            <Input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
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
            loading={mut.isPending}
            onClick={() => mut.mutate({ graceDays: grace, dailyRate: rate, effectiveFrom: effectiveFrom || undefined })}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
