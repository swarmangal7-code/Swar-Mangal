"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useTokenAuth } from "@/lib/auth/token-auth";
import { rpcKeys, useMutationRpc, useTeachers, useTimetableWeek } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope, TimetableWeekEntry } from "@/lib/api/rpc-types";
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
import {
  DAYS,
  DAY_LABELS,
  fmt12,
  SessionDetailDialog,
  TimeSlotCard,
  TimetableDialog,
  type TimetableWriteArg,
} from "@/components/dashboard/timetable-dialog";

interface RpcResult extends RpcEnvelope {
  note?: string;
}

/** Monday (YYYY-MM-DD) of the week containing `date`. */
function mondayOf(date: Date): string {
  const idx = (date.getDay() + 6) % 7;
  const d = new Date(date);
  d.setDate(d.getDate() - idx);
  return d.toISOString().slice(0, 10);
}
function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function fmtWeekRange(weekStart: string) {
  const end = addDaysIso(weekStart, 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = new Date(`${weekStart}T12:00:00Z`).toLocaleDateString("en-IN", opts);
  const e = new Date(`${end}T12:00:00Z`).toLocaleDateString("en-IN", opts);
  return `${s} – ${e}`;
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
  const [weekStart, setWeekStart] = React.useState(() => mondayOf(new Date()));
  const [selectedDay, setSelectedDay] = React.useState(
    () => (new Date().getDay() + 6) % 7,
  );

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<"create" | "edit">("create");
  const [editingEntry, setEditingEntry] = React.useState<TimetableWeekEntry | null>(null);
  const [deleting, setDeleting] = React.useState<TimetableWeekEntry | null>(null);
  const [viewing, setViewing] = React.useState<TimetableWeekEntry | null>(null);

  const timetable = useTimetableWeek(branch, weekStart);
  const teachersQ = useTeachers();

  const createMut = useMutationRpc<TimetableWriteArg, RpcResult>("api_timetableCreate", {
    invalidate: [["rpc", "api_timetableWeek"], rpcKeys.teachers()],
  });
  const updateMut = useMutationRpc<TimetableWriteArg & { id: string }, RpcResult>(
    "api_timetableUpdate",
    { invalidate: [["rpc", "api_timetableWeek"]] },
  );
  const deleteMut = useMutationRpc<{ id: string; scope: "THIS_WEEK" | "ALL_WEEKS"; weekStart: string }, RpcResult>(
    "api_timetableDelete",
    { invalidate: [["rpc", "api_timetableWeek"]] },
  );

  const openCreate = (day?: number) => {
    setDialogMode("create");
    setEditingEntry(null);
    if (day !== undefined) setSelectedDay(day);
    setDialogOpen(true);
  };

  const openEdit = (entry: TimetableWeekEntry) => {
    setViewing(null);
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

  const runDelete = async (scope: "THIS_WEEK" | "ALL_WEEKS") => {
    if (!deleting) return;
    try {
      const res = await deleteMut.mutateAsync({ id: deleting.id, scope, weekStart });
      toast.success(res.note ?? "Removed from the timetable.");
      setDeleting(null);
      setViewing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove the class.");
    }
  };

  const entries = timetable.data?.entries ?? [];
  const sorted = [...entries].sort((a, b) =>
    a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0,
  );
  const dayEntries = sorted.filter((e) => e.dayOfWeek === selectedDay);
  const times = Array.from(new Set(sorted.map((e) => e.startTime))).sort();
  const teachers =
    teachersQ.data?.teachers
      ?.filter((t) => !["INACTIVE", "LEFT"].includes((t.status ?? "").toUpperCase()))
      .map((t) => ({ teacherId: t.teacherId, teacherName: t.teacherName })) ?? [];

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
          <div className="flex items-center gap-1 rounded-xl border border-dash-fg/15 bg-dash-fg/[0.04] p-1">
            <Button
              variant="ghost"
              size="iconSm"
              aria-label="Previous week"
              onClick={() => setWeekStart((w) => addDaysIso(w, -7))}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <button
              type="button"
              onClick={() => setWeekStart(mondayOf(new Date()))}
              className="px-2 text-xs font-semibold text-dash-fg"
            >
              {fmtWeekRange(weekStart)}
            </button>
            <Button
              variant="ghost"
              size="iconSm"
              aria-label="Next week"
              onClick={() => setWeekStart((w) => addDaysIso(w, 7))}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
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
              <span className="text-[10px] text-dash-fg/40">{addDaysIso(weekStart, i).slice(-2)}</span>
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
              onView={() => setViewing(entry)}
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
                            onClick={() => setViewing(entry)}
                            className="w-full rounded-xl border border-dash-accent/20 bg-dash-accent/10 px-2 py-1.5 text-left transition-colors hover:border-dash-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
                          >
                            <p className="truncate text-xs font-semibold text-dash-fg">
                              {entry.className}
                            </p>
                            <p className="truncate text-[10px] text-dash-fg/50">
                              {entry.teacherName}
                              {entry.status !== "ENABLED" ? " · disabled" : ""}
                            </p>
                            {entry.substituteTeacherName && (
                              <p className="truncate text-[10px] text-amber-300">
                                Sub: {entry.substituteTeacherName}
                              </p>
                            )}
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
        weekStart={weekStart}
        branches={dialogBranches}
        defaultBranch={singleBranch ?? "KANDIVALI"}
        defaultDay={selectedDay}
        teachers={teachers}
        saving={createMut.isPending || updateMut.isPending}
        onSubmit={handleSubmit}
      />

      {viewing && (
        <SessionDetailDialog
          open={!!viewing}
          onOpenChange={(open) => !open && setViewing(null)}
          timetableId={viewing.id}
          date={viewing.date}
          className={viewing.className}
          onEdit={() => openEdit(viewing)}
          onDelete={() => setDeleting(viewing)}
        />
      )}

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-w-sm border-dash-fg/10 bg-dash-card text-dash-fg">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Remove this class?</DialogTitle>
            <DialogDescription className="text-dash-fg/45">
              <span className="font-medium text-dash-fg">{deleting?.className}</span> on{" "}
              {deleting ? DAY_LABELS[deleting.dayOfWeek] : ""} at{" "}
              {deleting ? fmt12(deleting.startTime) : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={() => runDelete("THIS_WEEK")}
              loading={deleteMut.isPending}
              className="justify-start border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Remove this week only
            </Button>
            <Button
              variant="destructive"
              onClick={() => runDelete("ALL_WEEKS")}
              loading={deleteMut.isPending}
              className="justify-start"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Remove for all weeks
            </Button>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleting(null)}
              className="border-dash-fg/10 text-dash-fg/70 hover:bg-dash-fg/[0.05] hover:text-dash-fg"
            >
              Cancel
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