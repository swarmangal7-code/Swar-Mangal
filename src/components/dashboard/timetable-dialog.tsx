"use client";

import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useTimetableSessionDetail } from "@/lib/api/rpc-hooks";
import type { TimetableEntry, TimetableWeekEntry } from "@/lib/api/rpc-types";

export const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export function fmt12(time: string) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m ?? 0).padStart(2, "0")} ${suffix}`;
}

function toTime12(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${String(h % 24).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`;
}

export interface TimetableWriteArg {
  className: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  teacherId: string;
  teacherName: string;
  branch: string;
  status: string;
  substituteTeacherId: string;
  substituteTeacherName: string;
  scope?: "THIS_WEEK" | "ALL_WEEKS";
  weekStart?: string;
  [key: string]: unknown;
}

interface TimetableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  entry: TimetableEntry | null;
  /** The calendar week currently being viewed — required to offer "this week only". */
  weekStart?: string;
  branches: string[];
  defaultBranch: string;
  defaultDay: number;
  teachers: { teacherId: string; teacherName: string }[];
  saving: boolean;
  onSubmit: (values: TimetableWriteArg) => void;
}

export function TimetableDialog({
  open,
  onOpenChange,
  mode,
  entry,
  weekStart,
  branches,
  defaultBranch,
  defaultDay,
  teachers,
  saving,
  onSubmit,
}: TimetableDialogProps) {
  const [className, setClassName] = React.useState("");
  const [dayOfWeek, setDayOfWeek] = React.useState(defaultDay);
  const [startTime, setStartTime] = React.useState("18:00");
  const [endTime, setEndTime] = React.useState("19:00");
  const [teacherId, setTeacherId] = React.useState("");
  const [branch, setBranch] = React.useState(defaultBranch);
  const [status, setStatus] = React.useState("ENABLED");
  const [substituteTeacherId, setSubstituteTeacherId] = React.useState("");
  const [editScope, setEditScope] = React.useState<"THIS_WEEK" | "ALL_WEEKS">("THIS_WEEK");

  React.useEffect(() => {
    if (!open) return;
    setClassName(entry?.className ?? "");
    setDayOfWeek(entry?.dayOfWeek ?? defaultDay);
    setStartTime(entry?.startTime ? toTime12(entry.startTime) : "18:00");
    setEndTime(entry?.endTime ? toTime12(entry.endTime) : "19:00");
    setTeacherId(entry?.teacherId ?? "");
    setBranch(entry?.branch ?? defaultBranch);
    setStatus(entry?.status ?? "ENABLED");
    setSubstituteTeacherId(entry?.substituteTeacherId ?? "");
    setEditScope("THIS_WEEK");
  }, [open, entry, defaultDay, defaultBranch]);

  const selectedTeacher = teachers.find((t) => t.teacherId === teacherId);
  const selectedSubstitute = teachers.find((t) => t.teacherId === substituteTeacherId);

  const handleSubmit = () => {
    if (!className.trim()) return toast.error("Enter a class name.");
    if (!startTime || !endTime) return toast.error("Set the start and end time.");
    if (!teacherId) return toast.error("Pick the teacher.");
    if (substituteTeacherId && substituteTeacherId === teacherId)
      return toast.error("Substitute must be a different teacher.");
    onSubmit({
      className: className.trim(),
      dayOfWeek,
      startTime,
      endTime,
      teacherId,
      teacherName: selectedTeacher?.teacherName ?? "",
      branch,
      status,
      substituteTeacherId,
      substituteTeacherName: selectedSubstitute?.teacherName ?? "",
      ...(mode === "edit" ? { scope: editScope, weekStart } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-dash-fg/10 bg-dash-card text-dash-fg">
        <DialogHeader>
          <DialogTitle className="text-dash-fg">
            {mode === "create" ? "Add class" : "Edit class"}
          </DialogTitle>
          <DialogDescription className="text-dash-fg/45">
            {mode === "create"
              ? "Add a recurring slot to the branch timetable."
              : `Editing ${entry?.className ?? "class"}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div>
            <label htmlFor="tt-class" className="mb-1.5 block text-xs font-medium text-dash-fg/70">
              Class name
            </label>
            <input
              id="tt-class"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g. Keyboard"
              className="h-11 w-full rounded-2xl border border-dash-fg/15 bg-dash-bg px-4 text-sm text-dash-fg placeholder:text-dash-fg/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="tt-day" className="mb-1.5 block text-xs font-medium text-dash-fg/70">
                Day
              </label>
              <select
                id="tt-day"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="h-11 w-full rounded-2xl border border-dash-fg/15 bg-dash-bg px-3 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
              >
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {DAY_LABELS[i]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tt-branch" className="mb-1.5 block text-xs font-medium text-dash-fg/70">
                Branch
              </label>
              <select
                id="tt-branch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="h-11 w-full rounded-2xl border border-dash-fg/15 bg-dash-bg px-3 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
              >
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="tt-start" className="mb-1.5 block text-xs font-medium text-dash-fg/70">
                Start time
              </label>
              <input
                id="tt-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-11 w-full rounded-2xl border border-dash-fg/15 bg-dash-bg px-3 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
              />
            </div>
            <div>
              <label htmlFor="tt-end" className="mb-1.5 block text-xs font-medium text-dash-fg/70">
                End time
              </label>
              <input
                id="tt-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="h-11 w-full rounded-2xl border border-dash-fg/15 bg-dash-bg px-3 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="tt-teacher" className="mb-1.5 block text-xs font-medium text-dash-fg/70">
                Teacher
              </label>
              <select
                id="tt-teacher"
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="h-11 w-full rounded-2xl border border-dash-fg/15 bg-dash-bg px-3 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
              >
                <option value="" disabled>
                  Select teacher
                </option>
                {teachers.map((t) => (
                  <option key={t.teacherId} value={t.teacherId}>
                    {t.teacherName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tt-status" className="mb-1.5 block text-xs font-medium text-dash-fg/70">
                Status
              </label>
              <select
                id="tt-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-11 w-full rounded-2xl border border-dash-fg/15 bg-dash-bg px-3 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
              >
                <option value="ENABLED">Enabled</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="tt-substitute" className="mb-1.5 block text-xs font-medium text-dash-fg/70">
              Substitute teacher (optional)
            </label>
            <select
              id="tt-substitute"
              value={substituteTeacherId}
              onChange={(e) => setSubstituteTeacherId(e.target.value)}
              className="h-11 w-full rounded-2xl border border-dash-fg/15 bg-dash-bg px-3 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
            >
              <option value="">No substitute</option>
              {teachers
                .filter((t) => t.teacherId !== teacherId)
                .map((t) => (
                  <option key={t.teacherId} value={t.teacherId}>
                    {t.teacherName}
                  </option>
                ))}
            </select>
            <p className="mt-1 text-[11px] text-dash-fg/40">
              In case {selectedTeacher?.teacherName || "the assigned teacher"} is unavailable. To add a
              teacher who isn&apos;t listed, add them from the Teachers page first.
            </p>
          </div>

          {mode === "edit" && (
            <div className="rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.03] p-3">
              <p className="mb-2 text-xs font-medium text-dash-fg/70">Apply this change to</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="flex flex-1 cursor-pointer items-start gap-2 rounded-xl border border-dash-fg/10 p-2.5 text-xs has-[:checked]:border-dash-accent has-[:checked]:bg-dash-accent/10">
                  <input
                    type="radio"
                    name="tt-scope"
                    checked={editScope === "THIS_WEEK"}
                    onChange={() => setEditScope("THIS_WEEK")}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-medium text-dash-fg">This week only</span>
                    <span className="block text-dash-fg/45">Other weeks, past and future, stay unchanged.</span>
                  </span>
                </label>
                <label className="flex flex-1 cursor-pointer items-start gap-2 rounded-xl border border-dash-fg/10 p-2.5 text-xs has-[:checked]:border-dash-accent has-[:checked]:bg-dash-accent/10">
                  <input
                    type="radio"
                    name="tt-scope"
                    checked={editScope === "ALL_WEEKS"}
                    onChange={() => setEditScope("ALL_WEEKS")}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-medium text-dash-fg">All weeks</span>
                    <span className="block text-dash-fg/45">Changes the recurring schedule going forward.</span>
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="border-dash-fg/10 text-dash-fg/70 hover:bg-dash-fg/[0.05] hover:text-dash-fg"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={saving}
            className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
          >
            {mode === "create" ? "Add class" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TimeSlotCard({
  entry,
  onView,
  onEdit,
  onDelete,
}: {
  entry: TimetableEntry | TimetableWeekEntry;
  onView?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const overridden = "overridden" in entry && entry.overridden;
  return (
    <div
      role={onView ? "button" : undefined}
      tabIndex={onView ? 0 : undefined}
      onClick={onView}
      onKeyDown={(e) => {
        if (onView && (e.key === "Enter" || e.key === " ")) onView();
      }}
      className={`flex items-center gap-4 rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.03] p-4 ${onView ? "cursor-pointer transition-colors hover:border-dash-accent/40" : ""}`}
    >
      <div className="min-w-[54px] text-center">
        <p className="text-sm font-bold tabular-nums text-dash-fg">{fmt12(entry.startTime)}</p>
        {entry.endTime && (
          <p className="text-[10px] text-dash-fg/40">to {fmt12(entry.endTime)}</p>
        )}
      </div>
      <div className="h-8 w-px bg-dash-fg/10" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-dash-fg">{entry.className}</p>
          {entry.status !== "ENABLED" && (
            <Badge variant="outline" className="border-dash-fg/20 text-dash-fg/50">
              Disabled
            </Badge>
          )}
          {entry.substituteTeacherName && (
            <Badge variant="peach">Sub: {entry.substituteTeacherName}</Badge>
          )}
          {overridden && <Badge variant="outline" className="border-dash-accent/30 text-dash-accent">Changed this week</Badge>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-dash-fg/50">
          <span>{entry.teacherName || "No teacher assigned"}</span>
          {entry.branch && (
            <>
              <span className="text-dash-fg/25">·</span>
              <span>{entry.branch}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="iconSm"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          aria-label="Edit class"
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="iconSm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Delete class"
          className="text-red-300/70 hover:text-red-300"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

const ATTENDANCE_LABEL: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  INFORMED_ABSENCE: "Informed absence",
  LATE: "Late",
  EXCUSED: "Excused",
  NOT_MARKED: "Not marked",
};

const OUTCOME_LABEL: Record<string, string> = {
  HELD: "Held by the assigned teacher",
  TEACHER_CANCELLED: "Teacher was absent / cancelled",
  ACADEMY_CANCELLED: "Cancelled by the academy",
  SUBSTITUTE_DELIVERED: "Delivered by a substitute",
  RESCHEDULED: "Rescheduled",
};

/**
 * Founder request 2026-09-28: clicking a calendar session shows teacher
 * attendance (with the reason if absent) and student attendance by name.
 */
export function SessionDetailDialog({
  open,
  onOpenChange,
  timetableId,
  date,
  className,
  onEdit,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timetableId: string;
  date: string;
  className: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const detail = useTimetableSessionDetail(timetableId, date, { enabled: open && !!timetableId && !!date });
  const d = detail.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-dash-fg/10 bg-dash-card text-dash-fg">
        <DialogHeader>
          <DialogTitle className="text-dash-fg">{className || "Session"}</DialogTitle>
          <DialogDescription className="text-dash-fg/45">{date}</DialogDescription>
        </DialogHeader>

        {detail.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full bg-dash-fg/[0.05]" />
            <Skeleton className="h-24 w-full bg-dash-fg/[0.05]" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.03] p-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-dash-fg/40">Teacher</p>
              <p className="text-sm font-semibold text-dash-fg">{d?.slot.teacherName || "No teacher assigned"}</p>
              {d?.teacherAttendance.recorded ? (
                <>
                  <p className="mt-1 text-xs text-dash-fg/60">
                    {OUTCOME_LABEL[d.teacherAttendance.outcome] ?? d.teacherAttendance.outcome}
                    {d.teacherAttendance.deliveredBy ? ` — ${d.teacherAttendance.deliveredBy}` : ""}
                  </p>
                  {d.teacherAttendance.reason && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Reason: {d.teacherAttendance.reason}</p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-xs text-dash-fg/45">Not yet recorded for this date.</p>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-dash-fg/40">
                Students {d?.students.length ? `(${d.students.length})` : ""}
              </p>
              {!d?.students.length ? (
                <p className="text-xs text-dash-fg/45">No students matched to this class yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {d.students.map((st) => (
                    <div
                      key={st.studentId}
                      className="flex items-center justify-between rounded-xl border border-dash-fg/10 bg-dash-fg/[0.02] px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <span className="text-dash-fg">{st.name}</span>
                        {!!st.absenceReason && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">Reason: {st.absenceReason}</p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          st.status === "PRESENT"
                            ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                            : st.status === "ABSENT" || st.status === "INFORMED_ABSENCE"
                              ? "border-red-500/30 text-red-500"
                              : undefined
                        }
                      >
                        {ATTENDANCE_LABEL[st.status] ?? st.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button
            variant="ghost"
            onClick={onDelete}
            className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Remove
          </Button>
          <Button variant="outline" onClick={onEdit} className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]">
            <Pencil className="h-4 w-4" aria-hidden />
            Edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
