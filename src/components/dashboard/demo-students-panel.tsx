"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FlaskConical, Plus } from "lucide-react";
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
import { useDemoStudents, useMutationRpc, useTeachers } from "@/lib/api/rpc-hooks";
import type { DemoStudent, RpcEnvelope } from "@/lib/api/rpc-types";
import { formatINR } from "@/lib/utils/cn";

interface DemoRes extends RpcEnvelope {
  studentId?: string;
  note?: string;
}

const selectClass =
  "h-11 w-full rounded-2xl border border-dash-fg/10 bg-dash-surface px-4 py-2 text-sm text-dash-fg focus-visible:ring-2 focus-visible:ring-dash-accent/60";
const inputClass = "border-dash-fg/10 bg-dash-surface text-dash-fg placeholder:text-dash-fg/35";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function DemoStudentsPanel({
  backHref,
  isFounder,
  defaultBranch,
  plans,
  cycles,
  prefill,
}: {
  backHref: string;
  isFounder: boolean;
  defaultBranch: string;
  plans: { name?: string; amount?: number; months?: number }[];
  cycles: string[];
  /** From an inquiry hand-off: prefill the add-demo form with what's already known. */
  prefill?: { name?: string; phone?: string; instrument?: string; inquiryId?: string };
}) {
  const demos = useDemoStudents(defaultBranch);
  const teachers = useTeachers();
  const teacherOptions = (teachers.data?.teachers ?? []).filter(
    (t) => !["INACTIVE", "LEFT"].includes((t.status ?? "").toUpperCase()),
  );

  const [addOpen, setAddOpen] = React.useState(!!prefill);
  const [converting, setConverting] = React.useState<DemoStudent | null>(null);

  return (
    <div className="space-y-6">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-dash-fg/60 transition-colors hover:text-dash-accent">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-dash-fg/40">Students</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">Demo Students</h1>
          <p className="mt-1 text-sm text-dash-fg/55">
            A trial stage before real admission — no fee plan yet. Convert once they join for real.
          </p>
        </div>
        <Button className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Add demo student
        </Button>
      </div>

      {demos.isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-20 bg-dash-fg/[0.04]" />
          <Skeleton className="h-20 bg-dash-fg/[0.04]" />
        </div>
      ) : (demos.data?.students ?? []).length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-dash-fg/15 bg-dash-fg/[0.02] px-6 py-14 text-center">
          <FlaskConical className="mb-3 h-8 w-8 text-dash-fg/25" aria-hidden />
          <p className="text-sm font-medium text-dash-fg/70">No demo students yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(demos.data?.students ?? []).map((d) => (
            <Card key={d.studentId} className="border-dash-fg/10 bg-dash-card">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-dash-fg">{d.studentName}</p>
                    <Badge variant="peach">Demo</Badge>
                  </div>
                  <p className="mt-1 text-xs text-dash-fg/50">
                    {d.instrument} · {d.teacherName || "No teacher"} · {d.demoDate} {d.demoTime}
                  </p>
                  <p className="text-xs text-dash-fg/40">
                    {d.phone} · Guardian: {d.guardianName} ({d.guardianPhone})
                  </p>
                </div>
                {isFounder && (
                  <Button size="sm" variant="outline" className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]" onClick={() => setConverting(d)}>
                    Convert to student
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddDemoDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultBranch={defaultBranch}
        teacherOptions={teacherOptions}
        prefill={prefill}
      />

      {converting && (
        <ConvertDialog
          demo={converting}
          onClose={() => setConverting(null)}
          plans={plans}
          cycles={cycles}
        />
      )}
    </div>
  );
}

function AddDemoDialog({
  open,
  onOpenChange,
  defaultBranch,
  teacherOptions,
  prefill,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBranch: string;
  teacherOptions: { teacherId: string; teacherName: string }[];
  prefill?: { name?: string; phone?: string; instrument?: string; inquiryId?: string };
}) {
  const [name, setName] = React.useState(prefill?.name ?? "");
  const [phone, setPhone] = React.useState(prefill?.phone ?? "");
  const [email, setEmail] = React.useState("");
  const [guardian, setGuardian] = React.useState("");
  const [guardianPhone, setGuardianPhone] = React.useState("");
  const [instrument, setInstrument] = React.useState(prefill?.instrument ?? "");
  const [teacherId, setTeacherId] = React.useState("");
  const [demoDate, setDemoDate] = React.useState(todayIso());
  const [demoTime, setDemoTime] = React.useState("17:00");

  const router = useRouter();
  const add = useMutationRpc<Record<string, unknown>, DemoRes>("api_addDemoStudent", {
    invalidate: [["rpc", "api_listDemoStudents"]],
    onSuccess: (res) => {
      toast.success(res.note ?? "Demo student added.");
      onOpenChange(false);
      if (prefill?.inquiryId && res.studentId) {
        // Hand back to the inquiry so "Joined" can link this new demo record.
        router.push(`/staff/inquiries/${encodeURIComponent(prefill.inquiryId)}?convertedStudentId=${encodeURIComponent(res.studentId)}`);
        return;
      }
      setName("");
      setPhone("");
      setEmail("");
      setGuardian("");
      setGuardianPhone("");
      setInstrument("");
      setTeacherId("");
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not add demo student."),
  });

  const valid = name.trim() && phone.trim() && guardian.trim() && guardianPhone.trim() && instrument.trim() && teacherId && demoDate && demoTime;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-dash-fg/10 bg-dash-card text-dash-fg">
        <DialogHeader>
          <DialogTitle className="text-dash-fg">Add demo student</DialogTitle>
          <DialogDescription className="text-dash-fg/50">
            Just contact details and the trial session — no fee plan until they actually join.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-[13px] text-dash-fg/70">Student name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Phone *</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Guardian name *</Label>
            <Input value={guardian} onChange={(e) => setGuardian(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Guardian contact number *</Label>
            <Input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} type="tel" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Instrument / course *</Label>
            <Input value={instrument} onChange={(e) => setInstrument(e.target.value)} placeholder="Keyboard, Violin, Vocal…" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Teacher *</Label>
            <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={selectClass}>
              <option value="" disabled>
                Select a teacher
              </option>
              {teacherOptions.map((t) => (
                <option key={t.teacherId} value={t.teacherId}>
                  {t.teacherName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Demo date *</Label>
            <Input type="date" value={demoDate} onChange={(e) => setDemoDate(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Demo time *</Label>
            <Input type="time" value={demoTime} onChange={(e) => setDemoTime(e.target.value)} className={inputClass} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            loading={add.isPending}
            onClick={() =>
              add.mutate({
                studentName: name.trim(),
                phone: phone.trim(),
                email: email.trim() || undefined,
                guardianName: guardian.trim(),
                guardianPhone: guardianPhone.trim(),
                instrument: instrument.trim(),
                teacherId,
                demoDate,
                demoTime,
                branch: defaultBranch,
              })
            }
            className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
          >
            Add demo student
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConvertDialog({
  demo,
  onClose,
  plans,
  cycles,
}: {
  demo: DemoStudent;
  onClose: () => void;
  plans: { name?: string; amount?: number; months?: number }[];
  cycles: string[];
}) {
  const [plan, setPlan] = React.useState("");
  const [cycle, setCycle] = React.useState(cycles[0] ?? "Monthly");
  const [dueDay, setDueDay] = React.useState("5");
  const [enrollmentDate, setEnrollmentDate] = React.useState(todayIso());

  const convert = useMutationRpc<Record<string, unknown>, DemoRes>("api_founder_convertDemoStudent", {
    invalidate: [["rpc", "api_listDemoStudents"], ["rpc", "api_searchStudent"]],
    onSuccess: (res) => {
      toast.success(res.note ?? "Converted to an admitted student.");
      onClose();
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not convert."),
  });

  const dueDayNum = Number(dueDay);
  const validDueDay = Number.isInteger(dueDayNum) && dueDayNum >= 1 && dueDayNum <= 31;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="border-dash-fg/10 bg-dash-card text-dash-fg">
        <DialogHeader>
          <DialogTitle className="text-dash-fg">Convert {demo.studentName} to an admitted student</DialogTitle>
          <DialogDescription className="text-dash-fg/50">Fill in the fee plan — this is the same record, now billing.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Fee plan *</Label>
            <select value={plan} onChange={(e) => setPlan(e.target.value)} className={selectClass}>
              <option value="" disabled>
                Select a plan
              </option>
              {plans.map((p) => (
                <option key={p.name ?? ""} value={p.name ?? ""}>
                  {p.name} — {formatINR(p.amount ?? 0)}
                  {p.months ? ` / ${p.months} mo` : " / month"}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Fee cycle</Label>
            <select value={cycle} onChange={(e) => setCycle(e.target.value)} disabled={!!plan} className={selectClass}>
              {cycles.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Fee due day (1–31) *</Label>
            <Input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Admission date *</Label>
            <Input type="date" value={enrollmentDate} onChange={(e) => setEnrollmentDate(e.target.value)} className={inputClass} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!plan || !validDueDay}
            loading={convert.isPending}
            onClick={() =>
              convert.mutate({
                studentId: demo.studentId,
                feeCycleType: plan || cycle,
                feeDueDay: dueDayNum,
                enrollmentDate,
              })
            }
            className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
          >
            Convert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
