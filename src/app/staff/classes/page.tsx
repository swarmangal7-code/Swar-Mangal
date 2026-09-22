"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CalendarCheck, CheckCircle2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useMutationRpc, useTeachers, useTodaysClasses } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope, TodaysClass } from "@/lib/api/rpc-types";
import { useTokenAuth } from "@/lib/auth/token-auth";
import { fadeUp, listVariants } from "@/lib/motion";
import { cn, todayISO } from "@/lib/utils/cn";
import { formatDateOnly } from "@/app/founder/_shared";

const FALLBACK_OUTCOMES = [
  "HELD",
  "TEACHER_CANCELLED",
  "ACADEMY_CANCELLED",
  "SUBSTITUTE_DELIVERED",
  "RESCHEDULED",
];

const OUTCOME_TONE: Record<string, string> = {
  HELD: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  SUBSTITUTE_DELIVERED: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  TEACHER_CANCELLED: "border-red-400/30 bg-red-400/10 text-red-300",
  ACADEMY_CANCELLED: "border-red-400/30 bg-red-400/10 text-red-300",
  RESCHEDULED: "border-amber-400/30 bg-amber-400/10 text-amber-300",
};

function outcomeLabel(value?: string) {
  if (!value) return "Not answered";
  return value
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

interface ResolveArg extends Record<string, unknown> {
  eventId: string;
  outcome: string;
  deliveredBy: string;
  lateReason: string;
}

export default function StaffClassesPage() {
  const { session } = useTokenAuth();
  const branches = session?.branches ?? [];
  const [branch, setBranch] = React.useState(branches.length === 1 ? branches[0] : "ALL");
  const [date, setDate] = React.useState(todayISO());
  const [active, setActive] = React.useState<TodaysClass | null>(null);
  const [outcome, setOutcome] = React.useState("HELD");
  const [deliveredBy, setDeliveredBy] = React.useState("");
  const [lateReason, setLateReason] = React.useState("");

  const classes = useTodaysClasses(date, branch);
  const teachers = useTeachers();

  const resolve = useMutationRpc<ResolveArg, RpcEnvelope>("api_staff_resolveTodaysClass", {
    onSuccess: () => {
      toast.success("Class recorded.");
      setActive(null);
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not record the class."),
  });

  const rows = classes.data?.rows ?? [];
  const outcomes = classes.data?.outcomes?.length ? classes.data.outcomes : FALLBACK_OUTCOMES;
  const isSubstitute = outcome === "SUBSTITUTE_DELIVERED";
  const teacherOptions = (teachers.data?.teachers ?? []).filter(
    (t) => (t.status ?? "").toUpperCase() !== "INACTIVE",
  );

  const openDialog = (c: TodaysClass) => {
    setActive(c);
    setOutcome("HELD");
    setDeliveredBy("");
    setLateReason("");
  };

  const submit = () => {
    if (!active) return;
    if (isSubstitute && !deliveredBy) {
      toast.error("Pick the teacher who actually took the class.");
      return;
    }
    resolve.mutate({
      eventId: active.eventId,
      outcome,
      deliveredBy: isSubstitute ? deliveredBy : "",
      lateReason: lateReason.trim(),
    });
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-6">
      <motion.div variants={fadeUp} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-dash-fg/40">Staff · Today</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">Today&apos;s Classes</h1>
          <p className="mt-1 text-sm text-dash-fg/55">
            Record what actually happened — each class can be answered once.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <Input
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            className="w-fit border-dash-fg/12 bg-dash-sidebar text-dash-fg"
          />
        </div>
      </motion.div>

      {classes.isError ? (
        <motion.div variants={fadeUp}>
          <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-6 text-sm text-red-300">
            {classes.error?.message?.replace(/\[.*\]$/, "") || "Could not load classes."}{" "}
            <button type="button" onClick={() => classes.refetch()} className="font-medium text-dash-accent">
              Retry
            </button>
          </p>
        </motion.div>
      ) : classes.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 bg-dash-fg/[0.04]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <motion.div variants={fadeUp}>
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-dash-fg/15 bg-dash-fg/[0.02] px-6 py-16 text-center">
            <CalendarCheck className="mb-3 h-9 w-9 text-dash-fg/25" aria-hidden />
            <p className="text-sm font-medium text-dash-fg/75">No classes on {formatDateOnly(date)}</p>
            <p className="mt-1 text-xs text-dash-fg/40">Nothing scheduled for this day.</p>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <motion.div key={c.eventId} variants={fadeUp}>
              <Card className="border-dash-fg/10 bg-dash-card">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="min-w-[60px] text-center">
                      <p className="text-sm font-bold tabular-nums text-dash-fg">{c.startTime || "—"}</p>
                    </div>
                    <div className="h-9 w-px bg-dash-fg/10" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-dash-fg">{c.course || "Class"}</p>
                      <p className="truncate text-xs text-dash-fg/45">
                        {[c.teacherName, c.branch].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                        c.resolved
                          ? OUTCOME_TONE[(c.outcome ?? "").toUpperCase()] ??
                            "border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/70"
                          : "border-amber-400/30 bg-amber-400/10 text-amber-300",
                      )}
                    >
                      {c.resolved ? outcomeLabel(c.outcome) : "Not answered"}
                    </span>
                    {c.resolved ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-300/70" aria-hidden />
                    ) : (
                      <Button
                        size="sm"
                        className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
                        onClick={() => openDialog(c)}
                      >
                        Record outcome
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="border-dash-fg/12 bg-dash-card text-dash-fg">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Record outcome</DialogTitle>
            <DialogDescription className="text-dash-fg/55">
              {active ? `${active.course || "Class"} · ${active.startTime || ""} · ${formatDateOnly(active.classDate)}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">What happened?</Label>
              <div className="flex flex-wrap gap-2">
                {outcomes.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setOutcome(o)}
                    aria-pressed={outcome === o}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60",
                      outcome === o
                        ? "border-dash-accent/50 bg-dash-accent/15 text-dash-accent"
                        : "border-dash-fg/12 text-dash-fg/65 hover:text-dash-fg",
                    )}
                  >
                    {outcomeLabel(o)}
                  </button>
                ))}
              </div>
            </div>

            {isSubstitute && (
              <div className="space-y-1.5">
                <Label className="text-[13px] text-dash-fg/70">Substitute teacher *</Label>
                <select
                  value={deliveredBy}
                  onChange={(e) => setDeliveredBy(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-dash-fg/12 bg-dash-sidebar px-3 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
                >
                  <option value="">Select teacher</option>
                  {teacherOptions.map((t) => (
                    <option key={t.teacherId} value={t.teacherId}>
                      {t.teacherName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Note (optional)</Label>
              <Textarea
                value={lateReason}
                onChange={(e) => setLateReason(e.target.value)}
                placeholder="Anything worth recording?"
                className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setActive(null)} className="text-dash-fg/70 hover:bg-dash-fg/[0.05]">
              Cancel
            </Button>
            <Button
              className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
              loading={resolve.isPending}
              disabled={isSubstitute && !deliveredBy}
              onClick={submit}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
