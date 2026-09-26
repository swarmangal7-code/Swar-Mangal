"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CalendarDays, Loader2, Plus, Trash2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { rpcKeys, useMutationRpc, useTeachers, useTimetable } from "@/lib/api/rpc-hooks";
import { useTokenAuth } from "@/lib/auth/token-auth";
import { fadeUp, listVariants } from "@/lib/motion";
import type { RpcEnvelope, TimetableEntry } from "@/lib/api/rpc-types";
import {
  DAYS,
  DAY_LABELS,
  fmt12,
  TimeSlotCard,
  TimetableDialog,
  type TimetableWriteArg,
} from "@/components/dashboard/timetable-dialog";

interface RpcResult extends RpcEnvelope {
  note?: string;
}

export default function StaffTimetablePage() {
  const { session } = useTokenAuth();
  const branches = session?.branches ?? [];
  const singleBranch = branches.length === 1 ? branches[0] : undefined;

  const [branch, setBranch] = React.useState(singleBranch ?? "ALL");
  const [selectedDay, setSelectedDay] = React.useState(() => (new Date().getDay() + 6) % 7);

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
  const sorted = [...entries].sort((a, b) => (a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0));
  const dayEntries = sorted.filter((e) => e.dayOfWeek === selectedDay);
  const times = Array.from(new Set(sorted.map((e) => e.startTime))).sort();
  const teachers = teachersQ.data?.teachers?.map((t) => ({ teacherId: t.teacherId, teacherName: t.teacherName })) ?? [];

  const dialogBranches = React.useMemo(() => {
    const set = new Set<string>();
    if (singleBranch) set.add(singleBranch);
    else if (branch !== "ALL") set.add(branch);
    for (const b of branches) set.add(b);
    if (set.size === 0) set.add("KANDIVALI");
    return Array.from(set);
  }, [singleBranch, branch, branches]);

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-6 pb-24">
      <motion.div variants={fadeUp} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-dash-fg/40">Staff · Academy</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">Timetable</h1>
          <p className="mt-1 text-sm text-dash-fg/55">
            Recurring class slots {branch !== "ALL" ? `for ${branch}` : "across branches"}.
          </p>
        </div>
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
      </motion.div>

      {timetable.isError ? (
        <motion.div variants={fadeUp}>
          <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-6 text-sm text-red-300">
            {timetable.error?.message?.replace(/\[.*\]$/, "") || "Could not load the timetable."}{" "}
            <button type="button" onClick={() => timetable.refetch()} className="font-medium text-dash-accent">
              Retry
            </button>
          </p>
        </motion.div>
      ) : timetable.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-14 bg-dash-fg/[0.04]" />
          <Skeleton className="h-64 bg-dash-fg/[0.04]" />
        </div>
      ) : (
        <>
          <motion.div variants={fadeUp} className="grid grid-cols-7 gap-1 rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.02] p-1">
            {DAYS.map((d, i) => {
              const active = i === selectedDay;
              const count = sorted.filter((e) => e.dayOfWeek === i).length;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDay(i)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60 ${
                    active ? "bg-dash-accent/15 text-dash-accent" : "text-dash-fg/60 hover:bg-dash-fg/[0.04]"
                  }`}
                >
                  <span className="text-[11px] font-bold tracking-wide">{d}</span>
                  <span className={`text-[10px] ${count ? "text-dash-fg/50" : "text-dash-fg/25"}`}>
                    {count ? `${count}` : "—"}
                  </span>
                </button>
              );
            })}
          </motion.div>

          <motion.div variants={fadeUp} className="space-y-2">
            <h2 className="text-sm font-semibold text-dash-fg/80">{DAY_LABELS[selectedDay]}</h2>
            {dayEntries.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-dash-fg/15 bg-dash-fg/[0.02] px-6 py-14 text-center">
                <CalendarDays className="mb-3 h-8 w-8 text-dash-fg/25" aria-hidden />
                <p className="text-sm font-medium text-dash-fg/70">No classes on {DAY_LABELS[selectedDay]}</p>
                <p className="mt-1 text-xs text-dash-fg/40">Nothing scheduled here.</p>
                <Button
                  onClick={() => openCreate(selectedDay)}
                  size="sm"
                  className="mt-4 bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add class
                </Button>
              </div>
            ) : (
              dayEntries.map((entry) => (
                <TimeSlotCard
                  key={entry.id}
                  entry={entry}
                  onEdit={() => openEdit(entry)}
                  onDelete={() => setDeleting(entry)}
                />
              ))
            )}
          </motion.div>

          {times.length > 0 && (
            <motion.div variants={fadeUp} className="overflow-x-auto rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.02]">
              <div className="grid min-w-[880px]" style={{ gridTemplateColumns: "5rem repeat(7, minmax(0, 1fr))" }}>
                <div className="sticky left-0 z-10 border-b border-r border-dash-fg/10 bg-dash-card p-3 text-[10px] font-bold uppercase tracking-[0.14em] text-dash-fg/40" />
                {DAYS.map((d, i) => (
                  <div
                    key={d}
                    className="border-b border-l border-dash-fg/10 bg-dash-card p-2 text-center text-[11px] font-bold tracking-wide text-dash-fg/70"
                  >
                    {DAY_LABELS[i]}
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
                        <div key={i} className="space-y-1 border-b border-l border-dash-fg/10 p-1.5">
                          {cell.map((entry) => (
                            <button
                              key={entry.id}
                              type="button"
                              onClick={() => openEdit(entry)}
                              className="w-full rounded-xl border border-dash-accent/20 bg-dash-accent/10 px-2 py-1.5 text-left transition-colors hover:border-dash-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
                            >
                              <p className="truncate text-xs font-semibold text-dash-fg">{entry.className}</p>
                              <p className="truncate text-[10px] text-dash-fg/50">{entry.teacherName}</p>
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
            </motion.div>
          )}
        </>
      )}

      <button
        type="button"
        onClick={() => openCreate()}
        className="fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-dash-accent text-dash-bg shadow-soft-lg transition-transform hover:bg-dash-accent-hover active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-dash-bg"
        aria-label="Add class"
      >
        {createMut.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" aria-hidden />}
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
              {deleting ? fmt12(deleting.startTime) : ""} will be removed from the timetable. This cannot be undone.
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
            <Button variant="destructive" onClick={confirmDelete} loading={deleteMut.isPending}>
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
