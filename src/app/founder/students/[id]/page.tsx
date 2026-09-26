"use client";

export const runtime = "edge";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
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
import { rpcKeys, useMutationRpc, useStudentHub, useStudentProfile } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope } from "@/lib/api/rpc-types";
import { fadeUp, listVariants } from "@/lib/motion";
import { initials } from "@/lib/utils/cn";

import {
  admissionSourceLabel,
  attendanceTone,
  feeStatusTone,
  formatDateOnly,
  formatINR,
  studentStatusTone,
} from "../../_shared";

type StudentStatusArg = { studentId: string; status: string; reason: string };
type EditStudentArg = {
  studentId: string;
  studentName: string;
  phone: string;
  email: string;
  parentName: string;
  course: string;
  lenient: true;
};

const STUDENT_STATUSES = ["ACTIVE", "PAUSED", "LEFT"];

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[13px] text-dash-fg/45">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] font-medium text-dash-fg/90">
        {value || "—"}
      </dd>
    </div>
  );
}

export default function FounderStudentProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const prof = useStudentProfile(id);
  const hub = useStudentHub(id, "ALL");

  const [statusOpen, setStatusOpen] = React.useState(false);
  const [statusValue, setStatusValue] = React.useState("ACTIVE");
  const [statusReason, setStatusReason] = React.useState("");

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteReason, setDeleteReason] = React.useState("");

  const [editOpen, setEditOpen] = React.useState(false);
  const [editName, setEditName] = React.useState("");
  const [editPhone, setEditPhone] = React.useState("");
  const [editEmail, setEditEmail] = React.useState("");
  const [editGuardian, setEditGuardian] = React.useState("");
  const [editInstrument, setEditInstrument] = React.useState("");

  const student = prof.data?.student;
  React.useEffect(() => {
    if (editOpen && student) {
      setEditName(student.studentName ?? "");
      setEditPhone(student.phone ?? "");
      setEditEmail(student.email ?? "");
      setEditGuardian(hub.data?.profile?.parentName ?? "");
      setEditInstrument(student.instrument ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOpen, student]);

  const setStatus = useMutationRpc<StudentStatusArg, RpcEnvelope>("api_founder_setStudentStatus", {
    invalidate: [rpcKeys.root],
    onSuccess: () => {
      toast.success("Student status updated.");
      setStatusOpen(false);
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not update status."),
  });

  const deleteStudent = useMutationRpc<StudentStatusArg, RpcEnvelope>("api_founder_setStudentStatus", {
    invalidate: [rpcKeys.root],
    onSuccess: () => {
      toast.success("Student removed — moved to Inquiries as a lead.");
      setDeleteOpen(false);
      setDeleteReason("");
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not delete student."),
  });

  const saveEdit = useMutationRpc<EditStudentArg, RpcEnvelope>("api_staff_saveStudentDraft", {
    invalidate: [rpcKeys.root],
    onSuccess: () => {
      toast.success("Edit draft created — merge it from Approvals to update the student.");
      setEditOpen(false);
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not save edit."),
  });

  const loaded = prof.data && student;
  const failed = prof.isError;
  const receipts = prof.data?.receipts ?? [];
  const attendance = prof.data?.attendance ?? [];
  const pendingCount = hub.data?.pending?.rows?.length ?? 0;
  const statusTone = studentStatusTone(student?.status);

  if (failed) {
    return (
      <motion.div variants={listVariants} initial="hidden" animate="visible" className="space-y-4">
        <Card className="border-red-400/30 bg-red-400/5">
          <CardContent className="pt-5 text-sm text-red-300">
            {prof.error?.message?.replace(/\[.*\]$/, "") || "Could not load this student."}{" "}
            <Button variant="link" className="h-auto p-0 text-dash-accent" onClick={() => prof.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (!loaded) {
    return (
      <motion.div variants={listVariants} initial="hidden" animate="visible" className="space-y-4">
        <Skeleton className="h-20 bg-dash-fg/[0.04]" />
        <Skeleton className="h-40 bg-dash-fg/[0.04]" />
        <Skeleton className="h-40 bg-dash-fg/[0.04]" />
      </motion.div>
    );
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-5">
      <motion.div variants={fadeUp}>
        <Link
          href="/founder/students"
          className="inline-flex items-center gap-1.5 text-sm text-dash-fg/60 transition-colors hover:text-dash-accent"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to students
        </Link>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card className="border-dash-fg/10 bg-dash-card">
          <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-dash-accent/10 text-lg font-semibold text-dash-accent">
                {initials(student.studentName)}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold tracking-tight text-dash-fg">
                    {student.studentName}
                  </h1>
                  <Badge className={statusTone.className}>{statusTone.label}</Badge>
                </div>
                <p className="mt-1 text-sm text-dash-fg/55">
                  {[student.instrument, student.className, student.location].filter(Boolean).join(" · ") ||
                    "Instrument not set"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusValue(student.status || "ACTIVE");
                  setStatusReason("");
                  setStatusOpen(true);
                }}
              >
                Set Status
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-red-400/30 text-red-300 hover:bg-red-400/10"
                onClick={() => {
                  setDeleteReason("");
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Tabs defaultValue="details">
          <TabsList className="w-full max-w-md">
            <TabsTrigger value="details" className="flex-1">
              Details
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex-1">
              Attendance
            </TabsTrigger>
            <TabsTrigger value="receipts" className="flex-1">
              Receipts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <Card className="border-dash-fg/10 bg-dash-card">
              <CardContent className="pt-5">
                <dl className="grid gap-x-8 sm:grid-cols-2">
                  <InfoRow label="Phone" value={student.phone} />
                  <InfoRow label="Email" value={student.email} />
                  <InfoRow label="Guardian" value={hub.data?.profile?.parentName} />
                  <InfoRow label="Admission source" value={admissionSourceLabel(student.admissionSource)} />
                  <InfoRow label="Teacher" value={prof.data?.teacher?.teacherName} />
                  <InfoRow label="Batch" value={student.batch} />
                  <InfoRow label="Fee plan" value={student.feePlan} />
                  <InfoRow label="Fee cycle" value={student.feeCycleType} />
                  <InfoRow label="Fee due day" value={student.feeDueDay} />
                  <InfoRow label="Next due date" value={formatDateOnly(student.nextDueDate)} />
                  <InfoRow label="Monthly fee" value={formatINR(student.monthlyFee)} />
                  <InfoRow label="Last receipt" value={student.lastReceiptNo} />
                </dl>
                <div className="mt-2 flex items-center gap-2 border-t border-dash-fg/[0.04] pt-4">
                  <span className="text-[13px] text-dash-fg/45">Fee status</span>
                  <Badge className={feeStatusTone(student.feeStatus).className}>
                    {feeStatusTone(student.feeStatus).label}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance">
            <Card className="border-dash-fg/10 bg-dash-card">
              <CardContent className="pt-5">
                {attendance.length === 0 ? (
                  <p className="py-8 text-center text-sm text-dash-fg/45">
                    No attendance recorded yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-dash-fg/[0.04]">
                    {attendance.map((a, i) => {
                      const tone = attendanceTone(a.status);
                      return (
                        <li key={`${a.date}-${i}`} className="flex items-center justify-between gap-3 py-3">
                          <div>
                            <p className="text-sm font-medium text-dash-fg/90">
                              {formatDateOnly(a.date)}
                            </p>
                            <p className="text-xs text-dash-fg/45">
                              {[a.teacherName, a.instrument].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <Badge className={tone.className}>{tone.label}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receipts">
            <Card className="border-dash-fg/10 bg-dash-card">
              <CardContent className="pt-5">
                {pendingCount > 0 && (
                  <p className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
                    {pendingCount} receipt draft{pendingCount > 1 ? "s" : ""} waiting on your approval.
                  </p>
                )}
                {receipts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-dash-fg/45">
                    No receipts recorded yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-dash-fg/[0.04]">
                    {receipts.map((r) => {
                      const tone = feeStatusTone(r.status);
                      return (
                        <li key={r.receiptNo} className="flex items-center justify-between gap-3 py-3">
                          <div>
                            <p className="text-sm font-medium text-dash-fg/90">
                              <span className="font-semibold text-dash-accent">{formatINR(r.amount)}</span>
                            </p>
                            <p className="text-xs text-dash-fg/45">
                              {r.receiptNo} · {formatDateOnly(r.date)} · {r.paymentMode || r.mode}
                            </p>
                          </div>
                          <Badge className={tone.className}>{tone.label}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="border-dash-fg/10 bg-dash-card">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Set student status</DialogTitle>
            <DialogDescription className="text-dash-fg/50">
              Status changes are audited. A reason is required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {STUDENT_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusValue(s)}
                  aria-pressed={statusValue === s}
                  className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                    statusValue === s
                      ? "border-dash-accent/50 bg-dash-accent/15 text-dash-accent"
                      : "border-dash-fg/12 text-dash-fg/65 hover:text-dash-fg"
                  }`}
                >
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Reason *</Label>
              <Textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Why is this changing?"
                className="border-dash-fg/10 bg-dash-surface text-dash-fg placeholder:text-dash-fg/35"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              loading={setStatus.isPending}
              disabled={!statusReason.trim()}
              onClick={() =>
                setStatus.mutate({ studentId: id, status: statusValue, reason: statusReason.trim() })
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="border-dash-fg/10 bg-dash-card">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Delete {student.studentName}?</DialogTitle>
            <DialogDescription className="text-dash-fg/50">
              This doesn&apos;t erase their records — it marks them LEFT and moves them to Inquiries
              as a lead, so you can follow up if they ever want to come back. A reason is required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Reason *</Label>
            <Textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Why are they leaving?"
              className="border-dash-fg/10 bg-dash-surface text-dash-fg placeholder:text-dash-fg/35"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              loading={deleteStudent.isPending}
              disabled={!deleteReason.trim()}
              onClick={() => deleteStudent.mutate({ studentId: id, status: "LEFT", reason: deleteReason.trim() })}
            >
              <Trash2 className="h-4 w-4" aria-hidden /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="border-dash-fg/10 bg-dash-card">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Edit student</DialogTitle>
            <DialogDescription className="text-dash-fg/50">
              Creates an edit draft you merge from Approvals.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[13px] text-dash-fg/70">Student name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="border-dash-fg/10 bg-dash-surface text-dash-fg"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Phone</Label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="border-dash-fg/10 bg-dash-surface text-dash-fg"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Email</Label>
              <Input
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="border-dash-fg/10 bg-dash-surface text-dash-fg"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Guardian</Label>
              <Input
                value={editGuardian}
                onChange={(e) => setEditGuardian(e.target.value)}
                className="border-dash-fg/10 bg-dash-surface text-dash-fg"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Instrument</Label>
              <Input
                value={editInstrument}
                onChange={(e) => setEditInstrument(e.target.value)}
                className="border-dash-fg/10 bg-dash-surface text-dash-fg"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              loading={saveEdit.isPending}
              disabled={!editName.trim()}
              onClick={() =>
                saveEdit.mutate({
                  studentId: id,
                  studentName: editName.trim(),
                  phone: editPhone.trim(),
                  email: editEmail.trim(),
                  parentName: editGuardian.trim(),
                  course: editInstrument.trim(),
                  lenient: true,
                })
              }
            >
              Save draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}