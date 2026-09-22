"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, UserRoundCheck, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAttendanceRoster, useMutationRpc } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope } from "@/lib/api/rpc-types";
import { fadeUp, listVariants } from "@/lib/motion";
import { cn, todayISO } from "@/lib/utils/cn";
import { attendanceTone, formatDateOnly } from "@/app/founder/_shared";

interface MarkArg extends Record<string, unknown> {
  studentId: string;
  state: string;
  date: string;
  backdatedReason: string;
}

const selectClass =
  "h-11 rounded-2xl border border-dash-fg/12 bg-dash-sidebar px-3 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60";

export default function StaffAttendancePage() {
  const [date, setDate] = React.useState(todayISO());
  const [instrument, setInstrument] = React.useState("");
  const [backdatedReason, setBackdatedReason] = React.useState("");
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const roster = useAttendanceRoster(instrument || undefined, date);

  const mark = useMutationRpc<MarkArg, RpcEnvelope>("api_staff_markAttendance", {
    onSuccess: () => setPendingId(null),
    onError: (err) => {
      setPendingId(null);
      toast.error(err.message.replace(/\[.*\]$/, "") || "Could not mark attendance.");
    },
  });

  const students = roster.data?.students ?? [];
  const instruments = roster.data?.instruments ?? [];
  const isBackdated = date < todayISO();
  const needsReason = isBackdated && backdatedReason.trim().length === 0;

  const doMark = (studentId: string, state: string) => {
    if (needsReason) {
      toast.error("This is a past date — add a reason first.");
      return;
    }
    setPendingId(studentId);
    mark.mutate({ studentId, state, date, backdatedReason: backdatedReason.trim() });
  };

  const markedCount = students.filter((s) => s.state && s.state !== "NOT_MARKED").length;

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-6">
      <motion.div variants={fadeUp}>
        <p className="text-xs uppercase tracking-[0.16em] text-dash-fg/40">Staff · Students</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">Attendance</h1>
        <p className="mt-1 text-sm text-dash-fg/55">
          {roster.data ? `${markedCount}/${students.length} marked for ${formatDateOnly(date)}` : "Mark the roster for the day."}
        </p>
      </motion.div>

      <motion.div variants={fadeUp} className="flex flex-wrap items-end gap-3">
        <Input
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value)}
          className="w-fit border-dash-fg/12 bg-dash-card text-dash-fg"
        />
        <select value={instrument} onChange={(e) => setInstrument(e.target.value)} className={selectClass}>
          <option value="">All instruments</option>
          {instruments.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      </motion.div>

      {isBackdated && (
        <motion.div variants={fadeUp}>
          <Card className="border-amber-400/30 bg-amber-400/5">
            <CardContent className="space-y-2 pt-5">
              <Label className="text-[13px] text-dash-fg/70">
                This is a past date — why is it being entered late?
              </Label>
              <Textarea
                value={backdatedReason}
                onChange={(e) => setBackdatedReason(e.target.value)}
                placeholder="Required before any mark can be saved"
                className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
              />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {roster.isError ? (
        <motion.div variants={fadeUp}>
          <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-6 text-sm text-red-300">
            {roster.error?.message?.replace(/\[.*\]$/, "") || "Could not load the roster."}{" "}
            <button type="button" onClick={() => roster.refetch()} className="font-medium text-dash-accent">
              Retry
            </button>
          </p>
        </motion.div>
      ) : roster.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 bg-dash-fg/[0.04]" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <motion.div variants={fadeUp}>
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-dash-fg/15 bg-dash-fg/[0.02] px-6 py-16 text-center">
            <UserRoundCheck className="mb-3 h-9 w-9 text-dash-fg/25" aria-hidden />
            <p className="text-sm font-medium text-dash-fg/75">No active students</p>
            <p className="mt-1 text-xs text-dash-fg/40">Nothing to mark for this filter.</p>
          </div>
        </motion.div>
      ) : (
        <motion.div variants={fadeUp} className="overflow-hidden rounded-2xl border border-dash-fg/10 bg-dash-card">
          <ul className="divide-y divide-dash-fg/[0.06]">
            {students.map((s) => {
              const tone = attendanceTone(s.state);
              const busy = pendingId === s.studentId;
              const present = s.state === "PRESENT";
              const absent = s.state === "ABSENT";
              return (
                <li key={s.studentId} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-dash-fg">{s.name}</p>
                    <p className="truncate text-xs text-dash-fg/45">
                      {[s.studentId, s.instrument, s.teacherName].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge className={tone.className}>{tone.label}</Badge>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => doMark(s.studentId, "PRESENT")}
                      aria-label={`Mark ${s.name} present`}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60 disabled:opacity-50",
                        present
                          ? "border-emerald-400/50 bg-emerald-400/20 text-emerald-300"
                          : "border-dash-fg/12 text-dash-fg/60 hover:border-emerald-400/40 hover:text-emerald-300",
                      )}
                    >
                      <Check className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => doMark(s.studentId, "ABSENT")}
                      aria-label={`Mark ${s.name} absent`}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60 disabled:opacity-50",
                        absent
                          ? "border-red-400/50 bg-red-400/20 text-red-300"
                          : "border-dash-fg/12 text-dash-fg/60 hover:border-red-400/40 hover:text-red-300",
                      )}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </motion.div>
      )}
    </motion.div>
  );
}
