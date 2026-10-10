"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, CalendarDays, Plus, School, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SchoolPicker } from "@/components/dashboard/school-picker";
import {
  useMutationRpc,
  useSchoolTeacherRoster,
  useSchoolTimetable,
  useTeachers,
  useTodaysSchoolSessions,
} from "@/lib/api/rpc-hooks";
import type {
  RpcEnvelope,
  SchoolSessionRow,
  SchoolTimetableSlot,
} from "@/lib/api/rpc-types";
import { useTokenAuth } from "@/lib/auth/token-auth";
import { fadeUp, listVariants } from "@/lib/motion";
import { cn, todayISO } from "@/lib/utils/cn";

const selectCls =
  "h-11 w-full rounded-2xl border border-dash-fg/12 bg-dash-sidebar px-3 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60";
const inputCls = "border-dash-fg/10 bg-dash-surface text-dash-fg placeholder:text-dash-fg/35";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const ATTENDANCE_STATES = [
  { value: "PRESENT", label: "P", tone: "border-emerald-400/50 bg-emerald-400/15 text-emerald-300" },
  { value: "ABSENT", label: "A", tone: "border-red-400/50 bg-red-400/15 text-red-300" },
  { value: "CANCELLED", label: "C", tone: "border-amber-400/50 bg-amber-400/15 text-amber-300" },
] as const;

function fmt12(hm: string) {
  if (!hm) return "—";
  const [hStr, mStr] = hm.split(":");
  const h = Number(hStr);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${mStr ?? "00"} ${h >= 12 ? "PM" : "AM"}`;
}

interface MarkArg extends Record<string, unknown> {
  schoolTimetableId: string;
  status: string;
  date: string;
  absenceReason?: string;
  backdatedReason?: string;
}

interface SlotWriteArg extends Record<string, unknown> {
  branch: string;
  schoolId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  status: string;
}

/**
 * Academy > School Sessions: staff/founder mark teacher attendance for
 * lectures delivered at partner schools, maintain the recurring timetable of
 * who goes where/when, and see who is already assigned to a school.
 * Rendered from both /founder/school-sessions and /staff/school-sessions
 * (each role's layout gates the route itself).
 */
export function SchoolSessionsView({ backHref, addTeacherHref }: { backHref: string; addTeacherHref: string }) {
  const { session } = useTokenAuth();
  const branches = session?.branches ?? [];
  const [branch, setBranch] = React.useState(branches.length === 1 ? branches[0] : "ALL");
  const [schoolId, setSchoolId] = React.useState("");

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="mx-auto max-w-4xl space-y-5">
      <motion.div variants={fadeUp}>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-dash-fg/60 transition-colors hover:text-dash-accent"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-dash-fg">School Sessions</h1>
        <p className="mt-1 text-sm text-dash-fg/55">
          Attendance and timetable for teachers who travel to partner schools to deliver lectures.
        </p>
      </motion.div>

      <motion.div variants={fadeUp} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {branches.length > 1 && (
          <div className="space-y-1.5 sm:w-48">
            <Label className="text-[13px] text-dash-fg/70">Branch</Label>
            <select aria-label="Branch" value={branch} onChange={(e) => setBranch(e.target.value)} className={selectCls}>
              <option value="ALL">All branches</option>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex-1">
          <SchoolPicker value={schoolId} onChange={setSchoolId} />
        </div>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Tabs defaultValue="today">
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="timetable">Timetable</TabsTrigger>
            <TabsTrigger value="teachers">Teachers</TabsTrigger>
          </TabsList>
          <TabsContent value="today">
            <TodayTab branch={branch} schoolId={schoolId} />
          </TabsContent>
          <TabsContent value="timetable">
            <TimetableTab branch={branch} schoolId={schoolId} />
          </TabsContent>
          <TabsContent value="teachers">
            <TeachersTab schoolId={schoolId} addTeacherHref={addTeacherHref} />
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}

// ------------------------------------------------------------------- Today

function TodayTab({ branch, schoolId }: { branch: string; schoolId: string }) {
  const [date, setDate] = React.useState(todayISO());
  const sessions = useTodaysSchoolSessions(date, branch, schoolId);
  const [marking, setMarking] = React.useState<string | null>(null);
  const [pendingMark, setPendingMark] = React.useState<{ row: SchoolSessionRow; status: string } | null>(null);
  const [backdatedReason, setBackdatedReason] = React.useState("");

  const mark = useMutationRpc<MarkArg, RpcEnvelope>("api_markSchoolAttendance", {
    invalidate: [["rpc", "api_todaysSchoolSessions"]],
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not mark attendance."),
  });

  const runMark = (row: SchoolSessionRow, status: string, reason?: string) => {
    setMarking(row.schoolTimetableId);
    mark.mutate(
      {
        schoolTimetableId: row.schoolTimetableId,
        status,
        date,
        ...(status === "ABSENT" ? { absenceReason: reason ?? "" } : {}),
        ...(date !== todayISO() ? { backdatedReason: reason ?? "" } : {}),
      },
      { onSettled: () => setMarking((m) => (m === row.schoolTimetableId ? null : m)) },
    );
  };

  const onMark = (row: SchoolSessionRow, status: string) => {
    if (date !== todayISO()) {
      setBackdatedReason("");
      setPendingMark({ row, status });
      return;
    }
    runMark(row, status);
  };

  const confirmBackdated = () => {
    if (!pendingMark || !backdatedReason.trim()) return;
    runMark(pendingMark.row, pendingMark.status, backdatedReason.trim());
    setPendingMark(null);
  };

  const rows = sessions.data?.sessions ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Input
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value)}
          className="w-fit border-dash-fg/12 bg-dash-sidebar text-dash-fg"
        />
      </div>

      {!schoolId ? (
        <EmptyState icon={School} title="Pick a school" subtitle="Select a school above to see today's sessions." />
      ) : sessions.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 bg-dash-fg/[0.04]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No sessions" subtitle="Nothing scheduled at this school for this day." />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card key={row.schoolTimetableId} className="border-dash-fg/10 bg-dash-card">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-dash-fg">
                    {row.teacherName} {row.subject ? `· ${row.subject}` : ""}
                  </p>
                  <p className="truncate text-xs text-dash-fg/45">
                    {fmt12(row.startTime)} – {fmt12(row.endTime)} · {row.branch}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {marking === row.schoolTimetableId ? (
                    <span className="h-7 w-24 animate-pulse rounded-full bg-dash-fg/10" />
                  ) : (
                    ATTENDANCE_STATES.map((st) => (
                      <button
                        key={st.value}
                        type="button"
                        title={st.value}
                        onClick={() => onMark(row, st.value)}
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-bold transition-colors",
                          row.status === st.value ? st.tone : "border-dash-fg/12 text-dash-fg/30 hover:text-dash-fg/60",
                        )}
                      >
                        {st.label}
                      </button>
                    ))
                  )}
                  <Badge className="border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/60">
                    {row.status === "NOT_MARKED" ? "Not marked" : row.status.replaceAll("_", " ")}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!pendingMark} onOpenChange={(open) => !open && setPendingMark(null)}>
        <DialogContent className="border-dash-fg/12 bg-dash-card text-dash-fg">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Why is this being entered late?</DialogTitle>
            <DialogDescription className="text-dash-fg/55">
              {pendingMark ? `${pendingMark.row.teacherName} · ${date}` : ""}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={backdatedReason}
            onChange={(e) => setBackdatedReason(e.target.value)}
            placeholder="Reason (required)"
            className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingMark(null)} className="text-dash-fg/70 hover:bg-dash-fg/[0.05]">
              Cancel
            </Button>
            <Button
              className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
              disabled={!backdatedReason.trim()}
              onClick={confirmBackdated}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------- Timetable

function TimetableTab({ branch, schoolId }: { branch: string; schoolId: string }) {
  const timetable = useSchoolTimetable(branch, schoolId);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SchoolTimetableSlot | null>(null);

  const rows = timetable.data?.entries ?? [];

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (slot: SchoolTimetableSlot) => {
    setEditing(slot);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button
          size="sm"
          className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
          onClick={openCreate}
          disabled={!schoolId}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden /> Add slot
        </Button>
      </div>

      {!schoolId ? (
        <EmptyState icon={School} title="Pick a school" subtitle="Select a school above to see its timetable." />
      ) : timetable.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 bg-dash-fg/[0.04]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No slots yet" subtitle="Add the first recurring school session." />
      ) : (
        <div className="space-y-2">
          {rows.map((slot) => (
            <Card key={slot.id} className="border-dash-fg/10 bg-dash-card">
              <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-dash-fg">
                    {DAY_LABELS[slot.dayOfWeek] ?? slot.dayOfWeek} · {fmt12(slot.startTime)} – {fmt12(slot.endTime)}
                  </p>
                  <p className="truncate text-xs text-dash-fg/45">
                    {slot.teacherName} {slot.subject ? `· ${slot.subject}` : ""} · {slot.branch}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    className={
                      slot.status === "ACTIVE"
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                        : "border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/60"
                    }
                  >
                    {slot.status}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]"
                    onClick={() => openEdit(slot)}
                  >
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SlotFormDialog open={dialogOpen} onOpenChange={setDialogOpen} schoolId={schoolId} branch={branch} slot={editing} />
    </div>
  );
}

function SlotFormDialog({
  open,
  onOpenChange,
  schoolId,
  branch,
  slot,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  branch: string;
  slot: SchoolTimetableSlot | null;
}) {
  const { session } = useTokenAuth();
  const branches = session?.branches ?? [];
  const teachers = useTeachers();
  const [form, setForm] = React.useState<SlotWriteArg>({
    branch: branches[0] ?? "KANDIVALI",
    schoolId,
    dayOfWeek: 0,
    startTime: "09:00",
    endTime: "10:00",
    teacherId: "",
    teacherName: "",
    subject: "",
    status: "ACTIVE",
  });

  React.useEffect(() => {
    if (!open) return;
    if (slot) {
      setForm({
        branch: slot.branch,
        schoolId: slot.schoolId,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        teacherId: slot.teacherId,
        teacherName: slot.teacherName,
        subject: slot.subject,
        status: slot.status,
      });
    } else {
      setForm({
        branch: branch !== "ALL" ? branch : branches[0] ?? "KANDIVALI",
        schoolId,
        dayOfWeek: 0,
        startTime: "09:00",
        endTime: "10:00",
        teacherId: "",
        teacherName: "",
        subject: "",
        status: "ACTIVE",
      });
    }
  }, [open, slot, schoolId, branch, branches]);

  const create = useMutationRpc<SlotWriteArg, RpcEnvelope & { note?: string }>("api_addSchoolTimetableSlot", {
    invalidate: [["rpc", "api_listSchoolTimetable"]],
  });
  const update = useMutationRpc<SlotWriteArg & { id: string }, RpcEnvelope & { note?: string }>(
    "api_updateSchoolTimetableSlot",
    { invalidate: [["rpc", "api_listSchoolTimetable"]] },
  );

  const teacherOptions = (teachers.data?.teachers ?? []).filter(
    (t) => !["INACTIVE", "LEFT"].includes((t.status ?? "").toUpperCase()),
  );

  const formValid = form.schoolId && form.teacherId && form.startTime && form.endTime;

  const submit = async () => {
    try {
      if (slot) {
        const res = await update.mutateAsync({ id: slot.id, ...form });
        toast.success(res.note ?? "Session updated.");
      } else {
        const res = await create.mutateAsync(form);
        toast.success(res.note ?? "Session added.");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message.replace(/\[.*\]$/, "") : "Could not save the session.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-dash-fg/10 bg-dash-card text-dash-fg sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-dash-fg">{slot ? "Edit school session" : "Add school session"}</DialogTitle>
          <DialogDescription className="text-dash-fg/50">A recurring weekly slot at this school.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {branches.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Branch</Label>
              <select
                value={form.branch}
                onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
                className={selectCls}
              >
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Day of week *</Label>
            <select
              value={form.dayOfWeek}
              onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: Number(e.target.value) }))}
              className={selectCls}
            >
              {DAY_LABELS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Start time *</Label>
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">End time *</Label>
            <Input
              type="time"
              value={form.endTime}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-[13px] text-dash-fg/70">Teacher *</Label>
            <select
              value={form.teacherId}
              onChange={(e) => {
                const t = teacherOptions.find((o) => o.teacherId === e.target.value);
                setForm((f) => ({ ...f, teacherId: e.target.value, teacherName: t?.teacherName ?? "" }));
              }}
              className={selectCls}
            >
              <option value="">Select teacher</option>
              {teacherOptions.map((t) => (
                <option key={t.teacherId} value={t.teacherId}>
                  {t.teacherName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-[13px] text-dash-fg/70">Subject (optional)</Label>
            <Input
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="e.g. Guitar"
              className={inputCls}
            />
          </div>
          {slot && (
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Status</Label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className={selectCls}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-dash-fg/70 hover:bg-dash-fg/[0.05]">
            Cancel
          </Button>
          <Button
            className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
            disabled={!formValid}
            loading={create.isPending || update.isPending}
            onClick={submit}
          >
            {slot ? "Save changes" : "Add session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ Teachers

function TeachersTab({ schoolId, addTeacherHref }: { schoolId: string; addTeacherHref: string }) {
  const roster = useSchoolTeacherRoster(schoolId);
  const rows = roster.data?.teachers ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button asChild size="sm" variant="outline" className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]">
          <Link href={addTeacherHref}>
            <Plus className="h-3.5 w-3.5" aria-hidden /> Add teacher
          </Link>
        </Button>
      </div>

      {!schoolId ? (
        <EmptyState icon={School} title="Pick a school" subtitle="Select a school above to see its assigned teachers." />
      ) : roster.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 bg-dash-fg/[0.04]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title="No teachers assigned" subtitle="Nobody is set up for this school yet in compensation." />
      ) : (
        <div className="space-y-2">
          {rows.map((t) => (
            <Card key={t.teacherId} className="border-dash-fg/10 bg-dash-card">
              <CardContent className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-dash-fg">{t.teacherName}</p>
                  <p className="truncate text-xs text-dash-fg/45">
                    {[t.courses, t.instrument, t.phone].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Badge className="border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/60">{t.status || "ACTIVE"}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: typeof School; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-dash-fg/15 bg-dash-fg/[0.02] px-6 py-14 text-center">
      <Icon className="mb-3 h-9 w-9 text-dash-fg/25" aria-hidden />
      <p className="text-sm font-medium text-dash-fg/75">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-dash-fg/40">{subtitle}</p>
    </div>
  );
}
