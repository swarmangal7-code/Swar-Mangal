"use client";

import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { rpcKeys, useMutationRpc, useRecoveryCredits, useTeachers } from "@/lib/api/rpc-hooks";
import type { RecoveryCredit, RpcEnvelope } from "@/lib/api/rpc-types";
import { formatDateOnly } from "@/app/founder/_shared";

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function statusTone(status: string): string {
  switch (status) {
    case "AVAILABLE":
      return "border-dash-accent/30 bg-dash-accent/10 text-dash-accent";
    case "SCHEDULED":
      return "border-blue-400/30 bg-blue-400/10 text-blue-300";
    case "DELIVERED":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
    case "NO_SHOW":
    case "LAPSED":
      return "border-red-400/30 bg-red-400/10 text-red-300";
    default:
      return "border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/60";
  }
}

/** Handover spec §8.4: a missed class may earn a separate Recovery Credit
 *  with its own use-by date — never a package-validity extension. */
export function RecoveryCreditsPanel({ studentId, studentName }: { studentId: string; studentName: string }) {
  const credits = useRecoveryCredits(studentId);
  const teachers = useTeachers();
  const rows = credits.data?.credits ?? [];

  const [grantOpen, setGrantOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [useByDate, setUseByDate] = React.useState(() => addDaysIso(30));

  const [scheduleFor, setScheduleFor] = React.useState<RecoveryCredit | null>(null);
  const [sessionDate, setSessionDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [teacherId, setTeacherId] = React.useState("");

  const invalidate = [rpcKeys.call("api_staff_listRecoveryCredits", { studentId })];

  const grant = useMutationRpc<{ studentId: string; reason: string; useByDate: string }, RpcEnvelope & { note?: string }>(
    "api_staff_grantRecoveryCredit",
    {
      invalidate,
      onSuccess: (res) => {
        toast.success(res.note ?? "Recovery credit granted.");
        setGrantOpen(false);
        setReason("");
      },
      onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not grant the credit."),
    },
  );

  const schedule = useMutationRpc<{ creditId: string; sessionDate: string; teacherId: string }, RpcEnvelope & { note?: string }>(
    "api_staff_scheduleRecoveryCredit",
    {
      invalidate,
      onSuccess: (res) => {
        toast.success(res.note ?? "Recovery class scheduled.");
        setScheduleFor(null);
      },
      onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not schedule."),
    },
  );

  const resolve = useMutationRpc<{ creditId: string; outcome: string }, RpcEnvelope & { note?: string }>(
    "api_staff_resolveRecoveryCredit",
    {
      invalidate,
      onSuccess: (res) => toast.success(res.note ?? "Updated."),
      onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not update."),
    },
  );

  return (
    <div className="space-y-3 rounded-2xl border border-dash-fg/10 bg-dash-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-dash-fg/90">Recovery credits</p>
        <Button size="sm" variant="outline" onClick={() => setGrantOpen(true)}>
          Grant credit
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-dash-fg/45">No recovery credits on record.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <div key={c.creditId} className="rounded-xl border border-dash-fg/10 bg-dash-fg/[0.02] p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge className={statusTone(c.status)}>{c.status.replaceAll("_", " ")}</Badge>
                <span className="text-xs text-dash-fg/45">Use by {formatDateOnly(c.useByDate)}</span>
              </div>
              <p className="mt-1.5 text-dash-fg/75">{c.reason}</p>
              {c.status === "SCHEDULED" && (
                <p className="mt-1 text-xs text-dash-fg/50">
                  Scheduled {formatDateOnly(c.scheduledDate)}{c.teacherName ? ` with ${c.teacherName}` : ""}
                </p>
              )}
              {c.status === "AVAILABLE" && (
                <div className="mt-2">
                  <Button size="sm" variant="outline" onClick={() => { setScheduleFor(c); setTeacherId(""); }}>
                    Schedule
                  </Button>
                </div>
              )}
              {c.status === "SCHEDULED" && (
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
                    disabled={resolve.isPending}
                    onClick={() => resolve.mutate({ creditId: c.creditId, outcome: "DELIVERED" })}
                  >
                    Delivered
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resolve.isPending}
                    onClick={() => resolve.mutate({ creditId: c.creditId, outcome: "NO_SHOW" })}
                  >
                    No-show
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className="border-dash-fg/10 bg-dash-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Grant a recovery credit to {studentName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-dash-fg/70">Why is this class eligible?</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="border-dash-fg/10 bg-dash-surface text-dash-fg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-dash-fg/70">Use by</Label>
              <Input type="date" value={useByDate} onChange={(e) => setUseByDate(e.target.value)} className="border-dash-fg/10 bg-dash-surface text-dash-fg" />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={!reason.trim() || grant.isPending}
              className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
              onClick={() => grant.mutate({ studentId, reason: reason.trim(), useByDate })}
            >
              {grant.isPending ? "Granting…" : "Grant credit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!scheduleFor} onOpenChange={(v) => !v && setScheduleFor(null)}>
        <DialogContent className="border-dash-fg/10 bg-dash-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Schedule the recovery class</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-dash-fg/70">Date</Label>
              <Input
                type="date"
                value={sessionDate}
                max={scheduleFor?.useByDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="border-dash-fg/10 bg-dash-surface text-dash-fg"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-dash-fg/70">Teacher</Label>
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="h-11 w-full rounded-2xl border border-dash-fg/10 bg-dash-surface px-3 text-sm text-dash-fg"
              >
                <option value="" disabled>Select a teacher</option>
                {(teachers.data?.teachers ?? []).map((t) => (
                  <option key={t.teacherId} value={t.teacherId}>{t.teacherName}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={!teacherId || !sessionDate || schedule.isPending}
              className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
              onClick={() => scheduleFor && schedule.mutate({ creditId: scheduleFor.creditId, sessionDate, teacherId })}
            >
              {schedule.isPending ? "Scheduling…" : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
