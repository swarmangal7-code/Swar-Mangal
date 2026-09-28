"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useMutationRpc, useTeachers } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope, TodaysClass } from "@/lib/api/rpc-types";
import { cn, todayISO } from "@/lib/utils/cn";

import { formatDateOnly } from "@/app/founder/_shared";

interface ScheduleArg extends Record<string, unknown> {
  branch: string;
  teacherId: string;
  instrument: string;
  sessionDate: string;
  startTime: string;
  customKind: string;
  reason: string;
  originalEventId?: string;
}

interface ScheduleRes extends RpcEnvelope {
  note?: string;
  scheduledSessionId?: string;
}

const KINDS = [
  { value: "SUBSTITUTE", label: "Substitute", help: "Somebody else covered a scheduled obligation." },
  { value: "REPLACEMENT", label: "Replacement", help: "A make-up for a class that did not happen." },
  { value: "GOODWILL_RECOVERY", label: "Goodwill recovery", help: "An extra class to recover a relationship. Discharges nothing." },
];

const selectCls =
  "h-11 w-full rounded-2xl border border-dash-fg/12 bg-dash-sidebar px-3 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60";

/**
 * Schedules an extra / make-up class (api_staff_scheduleSession). The server
 * decides what each kind is allowed to discharge — this only collects it.
 * Mirrors the app's Schedule-custom-class screen.
 */
export function ScheduleSessionDialog({
  open,
  onOpenChange,
  branch,
  /** Answered classes this operator may stand in for. */
  candidates,
  defaultKind = "GOODWILL_RECOVERY",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: string;
  candidates: TodaysClass[];
  defaultKind?: string;
}) {
  const [kind, setKind] = React.useState(defaultKind);
  const [sessionDate, setSessionDate] = React.useState(todayISO());
  const [startTime, setStartTime] = React.useState("18:00");
  const [instrument, setInstrument] = React.useState("");
  const [teacherId, setTeacherId] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [original, setOriginal] = React.useState("");

  const teachers = useTeachers();
  const teacherOptions = (teachers.data?.teachers ?? []).filter(
    (t) => !["INACTIVE", "LEFT"].includes((t.status ?? "").toUpperCase()),
  );
  // Only cancelled/rescheduled classes are owed a replacement; the server
  // refuses the rest, so don't offer them.
  const owedCandidates = candidates.filter((c) =>
    ["TEACHER_CANCELLED", "ACADEMY_CANCELLED", "RESCHEDULED"].includes((c.outcome ?? "").toUpperCase()),
  );

  React.useEffect(() => {
    if (open) setKind(defaultKind);
  }, [open, defaultKind]);

  const schedule = useMutationRpc<ScheduleArg, ScheduleRes>("api_staff_scheduleSession", {
    onSuccess: (res) => {
      toast.success(res.note ?? "Session scheduled.");
      onOpenChange(false);
      setReason("");
      setOriginal("");
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not schedule the class."),
  });

  const needsOriginal = kind !== "GOODWILL_RECOVERY";
  const valid = reason.trim().length > 0 && instrument.trim().length > 0 && (!needsOriginal || !!original);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-dash-fg/12 bg-dash-card text-dash-fg">
        <DialogHeader>
          <DialogTitle className="text-dash-fg">Schedule an extra class</DialogTitle>
          <DialogDescription className="text-dash-fg/55">
            A substitute, a make-up, or goodwill recovery. Extra classes never pay on their own — only Sharvil
            decides that.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">What is this? *</Label>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKind(k.value)}
                  aria-pressed={kind === k.value}
                  title={k.help}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60",
                    kind === k.value
                      ? "border-dash-accent/50 bg-dash-accent/15 text-dash-accent"
                      : "border-dash-fg/12 text-dash-fg/65 hover:text-dash-fg",
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-dash-fg/45">{KINDS.find((k) => k.value === kind)?.help}</p>
          </div>

          {needsOriginal && (
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Stands in for *</Label>
              <select value={original} onChange={(e) => setOriginal(e.target.value)} className={selectCls}>
                <option value="">Select the cancelled class</option>
                {owedCandidates.map((c) => (
                  <option key={c.eventId} value={c.eventId}>
                    {c.course || "Class"} · {formatDateOnly(c.classDate)} {c.startTime || ""} ·{" "}
                    {(c.outcome ?? "").replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              {owedCandidates.length === 0 && (
                <p className="text-xs text-dash-fg/45">
                  No cancelled or rescheduled class on record for this branch. Only those are owed a replacement.
                </p>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Date *</Label>
              <Input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Start time *</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Instrument / class *</Label>
              <Input
                value={instrument}
                onChange={(e) => setInstrument(e.target.value)}
                placeholder="Keyboard, Violin, Vocal…"
                className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Teacher</Label>
              <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={selectCls}>
                <option value="">Unassigned</option>
                {teacherOptions.map((t) => (
                  <option key={t.teacherId} value={t.teacherId}>
                    {t.teacherName}
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
              placeholder="Why is this extra class being held?"
              className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            loading={schedule.isPending}
            onClick={() =>
              schedule.mutate({
                branch,
                teacherId,
                instrument: instrument.trim(),
                sessionDate,
                startTime,
                customKind: kind,
                reason: reason.trim(),
                ...(original ? { originalEventId: original } : {}),
              })
            }
            className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
          >
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CorrectionArg extends Record<string, unknown> {
  eventId: string;
  reason: string;
}

/**
 * A class can only be answered once, so a mis-tap needs the founder to undo
 * it. Without this, staff who answered a class wrongly on web had no recourse
 * at all — the app has had it all along.
 */
export function ClassCorrectionButton({ row }: { row: TodaysClass }) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");

  const correct = useMutationRpc<CorrectionArg, RpcEnvelope>("api_staff_requestClassCorrection", {
    onSuccess: (res) => {
      toast.success((res as { note?: string }).note ?? "Sent for approval.");
      setOpen(false);
      setReason("");
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not send the request."),
  });

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="text-dash-fg/50 hover:bg-dash-fg/[0.05] hover:text-dash-fg"
        onClick={() => setOpen(true)}
      >
        Request correction
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-dash-fg/12 bg-dash-card text-dash-fg">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Request a correction</DialogTitle>
            <DialogDescription className="text-dash-fg/50">
              {row.course || "Class"} · {formatDateOnly(row.classDate)} was answered as{" "}
              {(row.outcome ?? "").replaceAll("_", " ") || "—"}. The founder decides; nothing changes until he does.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">What was wrong? *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Wrong teacher recorded — Rhea took it, not me."
              className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!reason.trim()}
              loading={correct.isPending}
              onClick={() => correct.mutate({ eventId: row.eventId, reason: reason.trim() })}
              className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
            >
              Send for approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
