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
import type { TimetableEntry } from "@/lib/api/rpc-types";

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
  [key: string]: unknown;
}

interface TimetableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  entry: TimetableEntry | null;
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
  onEdit,
  onDelete,
}: {
  entry: TimetableEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.03] p-4">
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
        <Button variant="ghost" size="iconSm" onClick={onEdit} aria-label="Edit class">
          <Pencil className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="iconSm"
          onClick={onDelete}
          aria-label="Delete class"
          className="text-red-300/70 hover:text-red-300"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
