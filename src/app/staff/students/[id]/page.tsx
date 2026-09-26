"use client";

export const runtime = "edge";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, HandCoins, Pencil, Trash2, UserRoundCheck } from "lucide-react";
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
import { useMutationRpc, useStudentHub, useStudentProfile } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope } from "@/lib/api/rpc-types";
import { useTokenAuth } from "@/lib/auth/token-auth";
import { fadeUp, listVariants } from "@/lib/motion";
import { initials } from "@/lib/utils/cn";
import {
  admissionSourceLabel,
  attendanceTone,
  feeStatusTone,
  formatDateOnly,
  formatINR,
  studentStatusTone,
} from "@/app/founder/_shared";

type EditStudentArg = {
  studentId: string;
  studentName: string;
  phone: string;
  email: string;
  parentName: string;
  course: string;
  lenient: true;
};
type DeleteStudentArg = { studentId: string; lifecycleStatus: string; statusReason: string; clientIntentKey: string };
type DraftRes = RpcEnvelope & { note?: string };

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[13px] text-dash-fg/45">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] font-medium text-dash-fg/90">{value || "—"}</dd>
    </div>
  );
}

export default function StaffStudentProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const { session } = useTokenAuth();
  const branches = session?.branches ?? [];
  const branch = branches.length === 1 ? branches[0] : "ALL";

  const prof = useStudentProfile(id);
  const hub = useStudentHub(id, branch);

  const student = prof.data?.student;
  const receipts = prof.data?.receipts ?? [];
  const attendance = prof.data?.attendance ?? [];
  const pending = hub.data?.pending?.rows ?? [];
  const statusTone = studentStatusTone(student?.status);

  const [editOpen, setEditOpen] = React.useState(false);
  const [editName, setEditName] = React.useState("");
  const [editPhone, setEditPhone] = React.useState("");
  const [editEmail, setEditEmail] = React.useState("");
  const [editGuardian, setEditGuardian] = React.useState("");
  const [editInstrument, setEditInstrument] = React.useState("");

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteReason, setDeleteReason] = React.useState("");
  const intentRef = React.useRef(`SDRAFT-${Date.now()}`);

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

  const saveEdit = useMutationRpc<EditStudentArg, DraftRes>("api_staff_saveStudentDraft", {
    onSuccess: (res) => {
      toast.success(res.note ?? "Sent to Sharvil for approval.");
      setEditOpen(false);
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not save edit."),
  });

  const requestDelete = useMutationRpc<DeleteStudentArg, DraftRes>("api_staff_saveStudentDraft", {
    onSuccess: (res) => {
      toast.success(res.note ?? "Sent to Sharvil for approval.");
      setDeleteOpen(false);
      setDeleteReason("");
      intentRef.current = `SDRAFT-${Date.now()}`;
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not send the request."),
  });

  if (prof.isError) {
    return (
      <motion.div initial="hidden" animate="visible" variants={listVariants}>
        <Card className="border-red-400/30 bg-red-400/5">
          <CardContent className="pt-5 text-sm text-red-300">
            {prof.error?.message?.replace(/\[.*\]$/, "") || "Could not load this student."}{" "}
            <button type="button" onClick={() => prof.refetch()} className="font-medium text-dash-accent">
              Retry
            </button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (!prof.data || !student) {
    return (
      <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-4">
        <Skeleton className="h-24 bg-dash-fg/[0.04]" />
        <Skeleton className="h-40 bg-dash-fg/[0.04]" />
        <Skeleton className="h-40 bg-dash-fg/[0.04]" />
      </motion.div>
    );
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-5">
      <motion.div variants={fadeUp}>
        <Link
          href="/staff/students"
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
                  <h1 className="text-xl font-semibold tracking-tight text-dash-fg">{student.studentName}</h1>
                  <Badge className={statusTone.className}>{statusTone.label}</Badge>
                  <Badge className={feeStatusTone(student.feeStatus).className}>
                    {feeStatusTone(student.feeStatus).label}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-dash-fg/55">
                  {[student.studentId, student.instrument, student.className, student.location].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm" className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover">
                <Link href={`/staff/fees?studentId=${encodeURIComponent(id)}`}>
                  <HandCoins className="h-3.5 w-3.5" aria-hidden /> Collect fee
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]">
                <Link href="/staff/attendance">
                  <UserRoundCheck className="h-3.5 w-3.5" aria-hidden /> Attendance
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
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

      {pending.length > 0 && (
        <motion.div variants={fadeUp}>
          <p className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-300">
            {pending.length} payment draft{pending.length > 1 ? "s" : ""} waiting on Sharvil for this student.
          </p>
        </motion.div>
      )}

      <motion.div variants={fadeUp}>
        <Tabs defaultValue="details">
          <TabsList className="w-full max-w-md border border-dash-fg/10 bg-dash-fg/[0.03] text-dash-fg/55">
            <TabsTrigger value="details" className="flex-1 data-[state=active]:bg-dash-accent/15 data-[state=active]:text-dash-accent">
              Details
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex-1 data-[state=active]:bg-dash-accent/15 data-[state=active]:text-dash-accent">
              Attendance
            </TabsTrigger>
            <TabsTrigger value="receipts" className="flex-1 data-[state=active]:bg-dash-accent/15 data-[state=active]:text-dash-accent">
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance">
            <Card className="border-dash-fg/10 bg-dash-card">
              <CardContent className="pt-5">
                {attendance.length === 0 ? (
                  <p className="py-8 text-center text-sm text-dash-fg/45">No attendance recorded yet.</p>
                ) : (
                  <ul className="divide-y divide-dash-fg/[0.04]">
                    {attendance.map((a, i) => {
                      const tone = attendanceTone(a.status);
                      return (
                        <li key={`${a.date}-${i}`} className="flex items-center justify-between gap-3 py-3">
                          <div>
                            <p className="text-sm font-medium text-dash-fg/90">{formatDateOnly(a.date)}</p>
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
                {receipts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-dash-fg/45">No receipts recorded yet.</p>
                ) : (
                  <ul className="divide-y divide-dash-fg/[0.04]">
                    {receipts.map((r) => {
                      const tone = feeStatusTone(r.status);
                      return (
                        <li key={r.receiptNo} className="flex items-center justify-between gap-3 py-3">
                          <div>
                            <p className="text-sm font-semibold text-dash-accent">{formatINR(r.amount)}</p>
                            <p className="text-xs text-dash-fg/45">
                              {[r.receiptNo, formatDateOnly(r.date), r.paymentMode || r.mode].filter(Boolean).join(" · ")}
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="border-dash-fg/10 bg-dash-card">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Edit student</DialogTitle>
            <DialogDescription className="text-dash-fg/50">
              Sent to Sharvil for approval — nothing changes until he merges it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[13px] text-dash-fg/70">Student name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="border-dash-fg/10 bg-dash-surface text-dash-fg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Phone</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="border-dash-fg/10 bg-dash-surface text-dash-fg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Email</Label>
              <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="border-dash-fg/10 bg-dash-surface text-dash-fg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Guardian</Label>
              <Input value={editGuardian} onChange={(e) => setEditGuardian(e.target.value)} className="border-dash-fg/10 bg-dash-surface text-dash-fg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Instrument</Label>
              <Input value={editInstrument} onChange={(e) => setEditInstrument(e.target.value)} className="border-dash-fg/10 bg-dash-surface text-dash-fg" />
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
              Send to Sharvil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="border-dash-fg/10 bg-dash-card">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Request delete for {student.studentName}?</DialogTitle>
            <DialogDescription className="text-dash-fg/50">
              Sent to Sharvil for approval. Nothing changes until he approves it — this doesn&apos;t
              erase any records, it moves them to Inquiries as a lead. A reason is required.
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
              loading={requestDelete.isPending}
              disabled={!deleteReason.trim()}
              onClick={() =>
                requestDelete.mutate({
                  studentId: id,
                  lifecycleStatus: "LEFT",
                  statusReason: deleteReason.trim(),
                  clientIntentKey: intentRef.current,
                })
              }
            >
              <Trash2 className="h-4 w-4" aria-hidden /> Send to Sharvil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
