"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { useBootstrap, useMutationRpc, useTeachers } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope } from "@/lib/api/rpc-types";
import { fadeUp, listVariants } from "@/lib/motion";
import { cn, formatINR } from "@/lib/utils/cn";

import { admissionSourceLabel } from "../../_shared";

const ADMISSION_SOURCES = ["WALK_IN", "FOLLOW_UP", "REFERRAL", "ONLINE_SOCIAL", "OTHER"];

type AddStudentArg = {
  studentName: string;
  phone?: string;
  email?: string;
  guardianName?: string;
  guardianPhone?: string;
  classCode: string;
  feeCycleType: string;
  feeDueDay: number;
  instrument?: string;
  admissionSource?: string;
  teacherId?: string;
  enrollmentDate?: string;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type AddStudentRes = RpcEnvelope & {
  studentId?: string;
  duplicateWarning?: { hasDuplicates?: boolean };
};

const selectClass =
  "h-11 w-full rounded-2xl border border-dash-fg/10 bg-dash-surface px-4 py-2 text-sm text-dash-fg focus-visible:ring-2 focus-visible:ring-dash-accent/60";

const inputClass =
  "border-dash-fg/10 bg-dash-surface text-dash-fg placeholder:text-dash-fg/35 focus-visible:ring-dash-accent/60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-medium text-dash-fg/70">{label}</Label>
      {children}
    </div>
  );
}

export default function FounderAddStudentPage() {
  const router = useRouter();
  const boot = useBootstrap();
  const teachers = useTeachers();

  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [guardian, setGuardian] = React.useState("");
  const [guardianPhone, setGuardianPhone] = React.useState("");
  const [joiningDate, setJoiningDate] = React.useState(() => todayIso());
  const [instrument, setInstrument] = React.useState("");
  const [classCode, setClassCode] = React.useState<string>("GMC");
  const [plan, setPlan] = React.useState("");
  const [cycle, setCycle] = React.useState("Monthly");
  const [dueDay, setDueDay] = React.useState("5");
  const [source, setSource] = React.useState("");
  const [teacherId, setTeacherId] = React.useState("");
  const [feedback, setFeedback] = React.useState<{ ok: boolean; message: string } | null>(null);

  const classCodes =
    boot.data?.classCodes && boot.data.classCodes.length > 0 ? boot.data.classCodes : ["GMC", "KMC"];
  const plans = boot.data?.plans ?? [];
  const cycles =
    boot.data?.feeCycleTypes && boot.data.feeCycleTypes.length > 0
      ? boot.data.feeCycleTypes
      : ["Monthly", "3 Months", "6 Months", "Yearly"];
  const teacherOptions = (teachers.data?.teachers ?? []).filter(
    (t) => (t.status ?? "").toUpperCase() !== "INACTIVE",
  );

  const feeCycleType = plan || cycle;

  const addStudent = useMutationRpc<AddStudentArg, AddStudentRes>("api_addStudent", {
    onSuccess: (res) => {
      const dup = res.duplicateWarning?.hasDuplicates === true;
      toast.success(
        dup
          ? "Student added. A student with this phone may already exist — check before collecting fees."
          : "Student added.",
      );
      router.push(res.studentId ? `/founder/students/${res.studentId}` : "/founder/students");
    },
    onError: (err) => {
      const message = err.message.replace(/\[.*\]$/, "").trim() || "Could not save student.";
      setFeedback({ ok: false, message });
      toast.error(message);
    },
  });

  const dueDayNum = Number(dueDay);
  const validDueDay = Number.isInteger(dueDayNum) && dueDayNum >= 1 && dueDayNum <= 31;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !validDueDay) return;
    setFeedback(null);
    addStudent.mutate({
      studentName: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      guardianName: guardian.trim() || undefined,
      guardianPhone: guardianPhone.trim() || undefined,
      classCode,
      feeCycleType,
      feeDueDay: dueDayNum,
      instrument: instrument.trim() || undefined,
      admissionSource: source || undefined,
      teacherId: teacherId || undefined,
      enrollmentDate: joiningDate || undefined,
    });
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={listVariants}
      className="mx-auto max-w-2xl space-y-5"
    >
      <motion.div variants={fadeUp}>
        <Link
          href="/founder/students"
          className="inline-flex items-center gap-1.5 text-sm text-dash-fg/60 transition-colors hover:text-dash-accent"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to students
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-dash-fg">Add Student</h1>
        <p className="mt-1 text-sm text-dash-fg/55">
          New admissions land straight on the roster with the fee plan attached.
        </p>
      </motion.div>

      {feedback && (
        <motion.div variants={fadeUp}>
          <Card
            className={cn(
              "border",
              feedback.ok ? "border-emerald-400/30 bg-emerald-400/5" : "border-red-400/30 bg-red-400/5",
            )}
          >
            <CardContent className="flex items-center gap-2 pt-5 text-sm text-dash-fg/85">
              {feedback.ok ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden />
              ) : (
                <XCircle className="h-4 w-4 text-red-300" aria-hidden />
              )}
              {feedback.message}
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.form variants={fadeUp} onSubmit={handleSubmit} className="space-y-4">
        <Card className="border-dash-fg/10 bg-dash-card">
          <CardContent className="space-y-4 pt-5">
            <Field label="Student name *">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Full name"
                className={inputClass}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  type="tel"
                  inputMode="numeric"
                  placeholder="98xxxxxx00"
                  className={inputClass}
                />
              </Field>
              <Field label="Email">
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="parent@example.com"
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Parent / guardian name">
                <Input
                  value={guardian}
                  onChange={(e) => setGuardian(e.target.value)}
                  placeholder="Guardian name"
                  className={inputClass}
                />
              </Field>
              <Field label="Guardian contact number">
                <Input
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  type="tel"
                  inputMode="numeric"
                  placeholder="98xxxxxx00"
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Joining date">
              <Input
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                type="date"
                className={inputClass}
              />
            </Field>
            <Field label="Instrument / course">
              <Input
                value={instrument}
                onChange={(e) => setInstrument(e.target.value)}
                placeholder="Keyboard, Violin, Vocal…"
                className={inputClass}
              />
            </Field>
          </CardContent>
        </Card>

        <Card className="border-dash-fg/10 bg-dash-card">
          <CardContent className="space-y-4 pt-5">
            <Field label="Class code">
              <SegmentedControl
                value={classCode}
                onChange={setClassCode}
                options={classCodes.map((c) => ({ value: c, label: c }))}
                label="Class code"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fee plan">
                {boot.isLoading ? (
                  <Skeleton className="h-11 bg-dash-fg/[0.04]" />
                ) : (
                  <select value={plan} onChange={(e) => setPlan(e.target.value)} className={selectClass}>
                    <option value="">No plan yet</option>
                    {plans.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name} — {formatINR(p.amount)}
                        {p.months ? ` / ${p.months} mo` : " / month"}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Fee cycle">
                {boot.isLoading ? (
                  <Skeleton className="h-11 bg-dash-fg/[0.04]" />
                ) : (
                  <select
                    value={cycle}
                    onChange={(e) => setCycle(e.target.value)}
                    className={selectClass}
                    disabled={Boolean(plan)}
                  >
                    {cycles.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
            <Field label="Fee due day (1–31) *">
              <Input
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                type="number"
                min={1}
                max={31}
                required
                inputMode="numeric"
                className={inputClass}
              />
              {!validDueDay && (
                <p className="text-xs text-red-300">Day must be a whole number from 1 to 31.</p>
              )}
            </Field>
          </CardContent>
        </Card>

        <Card className="border-dash-fg/10 bg-dash-card">
          <CardContent className="space-y-4 pt-5">
            <div>
              <Label className="text-[13px] font-medium text-dash-fg/70">
                How did they come to us?
              </Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {ADMISSION_SOURCES.map((src) => {
                  const active = source === src;
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setSource(active ? "" : src)}
                      aria-pressed={active}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60",
                        active
                          ? "border-dash-accent/50 bg-dash-accent/15 text-dash-accent"
                          : "border-dash-fg/12 text-dash-fg/65 hover:border-dash-accent/40 hover:text-dash-fg",
                      )}
                    >
                      {admissionSourceLabel(src)}
                    </button>
                  );
                })}
              </div>
            </div>
            <Field label="Teacher (optional)">
              {teachers.isPending ? (
                <Skeleton className="h-11 bg-dash-fg/[0.04]" />
              ) : (
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">No teacher assigned yet</option>
                  {teacherOptions.map((t) => (
                    <option key={t.teacherId} value={t.teacherId}>
                      {t.teacherName}
                      {t.primaryRole ? ` · ${t.primaryRole}` : ""}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-dash-fg/45">
                Attendance drives payroll — this is just who the student starts with.
              </p>
            </Field>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/founder/students"
            className="text-center text-sm text-dash-fg/60 transition-colors hover:text-dash-fg"
          >
            Cancel
          </Link>
          <Button
            type="submit"
            loading={addStudent.isPending}
            disabled={!name.trim() || !validDueDay}
            className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
          >
            Add Student
          </Button>
        </div>
      </motion.form>
    </motion.div>
  );
}