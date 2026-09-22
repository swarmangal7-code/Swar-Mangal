"use client";

import * as React from "react";
import { CalendarDays, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useTokenAuth } from "@/lib/auth/token-auth";
import { rpcKeys, useMutationRpc, useTeachers, useTimetable } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope, TimetableEntry } from "@/lib/api/rpc-types";
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
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

function fmt12(time: string) {
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

interface TimetableWriteArg {
  className: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  teacherId: string;
  teacherName: string;
  branch: string;
  status: string;
  [key: string]: unknown;
}

interface RpcResult extends RpcEnvelope {
  note?: string;
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

function TimetableDialog({
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

  React.useEffect(() => {
    if (!open) return;
    setClassName(entry?.className ?? "");
    setDayOfWeek(entry?.dayOfWeek ?? defaultDay);
    setStartTime(entry?.startTime ? toTime12(entry.startTime) : "18:00");
    setEndTime(entry?.endTime ? toTime12(entry.endTime) : "19:00");
    setTeacherId(entry?.teacherId ?? "");
    setBranch(entry?.branch ?? defaultBranch);
    setStatus(entry?.status ?? "ENABLED");
  }, [open, entry, defaultDay, defaultBranch]);

  const selectedTeacher = teachers.find((t) => t.teacherId === teacherId);

  const handleSubmit = () => {
    if (!className.trim()) return toast.error("Enter a class name.");
    if (!startTime || !endTime) return toast.error("Set the start and end time.");
    if (!teacherId) return toast.error("Pick the teacher.");
    onSubmit({
      className: className.trim(),
      dayOfWeek,
      startTime,
      endTime,
      teacherId,
      teacherName: selectedTeacher?.teacherName ?? "",
      branch,
      status,
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

export default function FounderTimetablePage() {
  const { session } = useTokenAuth();
  const branches = React.useMemo(
    () => (session?.branches?.length ? [...session.branches] : []),
    [session?.branches],
  );
  const singleBranch = branches.length === 1 ? branches[0] : undefined;

  const [branch, setBranch] = React.useState(singleBranch ?? "ALL");
  const [view, setView] = React.useState<"day" | "week">("week");
  const [selectedDay, setSelectedDay] = React.useState(
    () => (new Date().getDay() + 6) % 7,
  );

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<"create" | "edit">("create");
  const [editingEntry, setEditingEntry] = React.useState<TimetableEntry | null>(null);
  const [deleting, setDeleting] = React.useState<TimetableEntry | null>(null);

  const timetable = useTimetable(branch);
  const teachersQ = useTeachers();

  const createMut = useMutationRpc<TimetableWriteArg, RpcResult>("api_timetableCreate", {
    invalidate: [rpcKeys.timetable(branch), rpcKeys.teachers()],
  });
  const updateMut = useMutationRpc<TimetableWriteArg & { id: string }, RpcResult>(
    "api_timetableUpdate",
    { invalidate: [rpcKeys.timetable(branch)] },
  );
  const deleteMut = useMutationRpc<{ id: string }, RpcResult>("api_timetableDelete", {
    invalidate: [rpcKeys.timetable(branch)],
  });

  const openCreate = (day?: number) => {
    setDialogMode("create");
    setEditingEntry(null);
    if (day !== undefined) setSelectedDay(day);
    setDialogOpen(true);
  };

  const openEdit = (entry: TimetableEntry) => {
    setDialogMode("edit");
    setEditingEntry(entry);
    setSelectedDay(entry.dayOfWeek);
    setDialogOpen(true);
  };

  const handleSubmit = async (values: TimetableWriteArg) => {
    try {
      if (dialogMode === "create") {
        const res = await createMut.mutateAsync(values);
        toast.success(res.note ?? "Class added to the timetable.");
      } else if (editingEntry) {
        const res = await updateMut.mutateAsync({ id: editingEntry.id, ...values });
        toast.success(res.note ?? "Class updated.");
      }
      setDialogOpen(false);
      setEditingEntry(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the class.");
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      const res = await deleteMut.mutateAsync({ id: deleting.id });
      toast.success(res.note ?? "Class removed from the timetable.");
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the class.");
    }
  };

  const entries = timetable.data?.entries ?? [];
  const sorted = [...entries].sort((a, b) =>
    a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0,
  );
  const dayEntries = sorted.filter((e) => e.dayOfWeek === selectedDay);
  const times = Array.from(new Set(sorted.map((e) => e.startTime))).sort();
  const teachers =
    teachersQ.data?.teachers?.map((t) => ({ teacherId: t.teacherId, teacherName: t.teacherName })) ?? [];

  const dialogBranches = React.useMemo(() => {
    const set = new Set<string>();
    if (singleBranch) set.add(singleBranch);
    else if (branch !== "ALL") set.add(branch);
    for (const b of branches) set.add(b);
    if (set.size === 0) set.add("KANDIVALI");
    return Array.from(set);
  }, [singleBranch, branch, branches]);

  const teachersLoading = teachersQ.isPending;

  if (timetable.isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56 bg-dash-fg/[0.05]" />
        <Skeleton className="h-40 w-full bg-dash-fg/[0.05]" />
        <Skeleton className="h-40 w-full bg-dash-fg/[0.05]" />
      </div>
    );
  }

  if (timetable.isError) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
        <p className="text-sm font-medium text-red-300">Could not load the timetable.</p>
        <p className="mt-1 text-sm text-dash-fg/55">
          {timetable.error instanceof Error ? timetable.error.message : "Something went wrong."}
        </p>
        <Button
          variant="outline"
          onClick={() => timetable.refetch()}
          className="mt-4 border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-dash-fg/40">
            Founder · Academy
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">
            Branch timetable
          </h1>
          <p className="mt-1 text-sm text-dash-fg/55">
            Recurring class slots {branch !== "ALL" ? `for ${branch}` : "across branches"}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {branches.length > 1 && (
            <select
              aria-label="Branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="h-10 rounded-xl border border-dash-fg/15 bg-dash-fg/[0.04] px-3 text-sm font-medium text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
            >
              <option value="ALL">All Branches</option>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "day", label: "Day" },
              { value: "week", label: "Week" },
            ]}
            className="bg-dash-fg/[0.04]"
          />
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.02] p-1">
        {DAYS.map((d, i) => {
          const active = view === "day" && i === selectedDay;
          const count = sorted.filter((e) => e.dayOfWeek === i).length;
          return (
            <button
              key={d}
              type="button"
              onClick={() => {
                setSelectedDay(i);
                if (view === "week") setView("day");
              }}
              aria-pressed={active}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60 ${
                active ? "bg-dash-accent/15 text-dash-accent" : "text-dash-fg/60 hover:bg-dash-fg/[0.04]"
              }`}
            >
              <span className="text-[11px] font-bold tracking-wide">{d}</span>
              <span className={`text-[10px] ${count ? "text-dash-fg/50" : "text-dash-fg/25"}`}>
                {count ? `${count} class${count === 1 ? "" : "es"}` : "—"}
              </span>
            </button>
          );
        })}
      </div>

      {view === "day" ? (
        <div className="space-y-2">
          {dayEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-dash-fg/15 bg-dash-fg/[0.02] px-6 py-12 text-center">
              <CalendarDays className="mb-3 h-6 w-6 text-dash-fg/30" aria-hidden />
              <p className="text-sm font-medium text-dash-fg">
                No classes on {DAY_LABELS[selectedDay]}
              </p>
              <p className="mt-1 text-xs text-dash-fg/45">
                Nothing scheduled here yet.
              </p>
              <Button
                onClick={() => openCreate(selectedDay)}
                size="sm"
                className="mt-4 bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Add class
              </Button>
            </div>
          )}
          {dayEntries.map((entry) => (
            <TimeSlotCard
              key={entry.id}
              entry={entry}
              onEdit={() => openEdit(entry)}
              onDelete={() => setDeleting(entry)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.02]">
          {times.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <CalendarDays className="mb-3 h-6 w-6 text-dash-fg/30" aria-hidden />
              <p className="text-sm font-medium text-dash-fg">No classes in the timetable</p>
              <p className="mt-1 text-xs text-dash-fg/45">
                Add the recurring slots to get started.
              </p>
            </div>
          ) : (
            <div
              className="grid min-w-[880px]"
              style={{ gridTemplateColumns: "5rem repeat(7, minmax(0, 1fr))" }}
            >
              <div className="sticky left-0 z-10 border-b border-r border-dash-fg/10 bg-dash-card p-3 text-[10px] font-bold uppercase tracking-[0.14em] text-dash-fg/40" />
              {DAYS.map((d) => (
                <div
                  key={d}
                  className="border-b border-l border-dash-fg/10 bg-dash-card p-2 text-center text-[11px] font-bold tracking-wide text-dash-fg/70"
                >
                  {DAY_LABELS[DAYS.indexOf(d)]}
                </div>
              ))}
              {times.map((time) => (
                <React.Fragment key={time}>
                  <div className="sticky left-0 z-10 flex items-start border-b border-r border-dash-fg/10 bg-dash-card p-3 text-xs font-semibold text-dash-fg/50">
                    {fmt12(time)}
                  </div>
                  {DAYS.map((_, i) => {
                    const cell = sorted.filter((e) => e.dayOfWeek === i && e.startTime === time);
                    return (
                      <div
                        key={i}
                        className="space-y-1 border-b border-l border-dash-fg/10 p-1.5"
                      >
                        {cell.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => openEdit(entry)}
                            className="w-full rounded-xl border border-dash-accent/20 bg-dash-accent/10 px-2 py-1.5 text-left transition-colors hover:border-dash-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
                          >
                            <p className="truncate text-xs font-semibold text-dash-fg">
                              {entry.className}
                            </p>
                            <p className="truncate text-[10px] text-dash-fg/50">
                              {entry.teacherName}
                              {entry.status !== "ENABLED" ? " · disabled" : ""}
                            </p>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => openCreate()}
        className="fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-dash-accent text-dash-bg shadow-soft-lg transition-transform hover:bg-dash-accent-hover active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-dash-bg"
        aria-label="Add class"
      >
        {createMut.isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Plus className="h-5 w-5" aria-hidden />
        )}
      </button>

      <TimetableDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        entry={editingEntry}
        branches={dialogBranches}
        defaultBranch={singleBranch ?? "KANDIVALI"}
        defaultDay={selectedDay}
        teachers={teachers}
        saving={createMut.isPending || updateMut.isPending}
        onSubmit={handleSubmit}
      />

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-w-sm border-dash-fg/10 bg-dash-card text-dash-fg">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Delete this class?</DialogTitle>
            <DialogDescription className="text-dash-fg/45">
              <span className="font-medium text-dash-fg">{deleting?.className}</span> on{" "}
              {deleting ? DAY_LABELS[deleting.dayOfWeek] : ""} at{" "}
              {deleting ? fmt12(deleting.startTime) : ""} will be removed from the timetable.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleting(null)}
              className="border-dash-fg/10 text-dash-fg/70 hover:bg-dash-fg/[0.05] hover:text-dash-fg"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              loading={deleteMut.isPending}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {teachersLoading && !teachers.length && (
        <p className="sr-only" role="status">
          Loading teachers…
        </p>
      )}
    </div>
  );
}

function TimeSlotCard({
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
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-dash-fg">{entry.className}</p>
          {entry.status !== "ENABLED" && (
            <Badge variant="outline" className="border-dash-fg/20 text-dash-fg/50">
              Disabled
            </Badge>
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