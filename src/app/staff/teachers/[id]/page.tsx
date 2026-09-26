"use client";

export const runtime = "edge";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, GraduationCap, Pencil, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useMutationRpc, useTeacherProfile } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope } from "@/lib/api/rpc-types";
import { fadeUp, listVariants } from "@/lib/motion";
import { initials } from "@/lib/utils/cn";

import { feeStatusTone, teacherStatusTone } from "@/app/founder/_shared";

type TeacherDraftArg = {
  teacherId: string;
  teacherName: string;
  phone: string;
  email: string;
  primaryRole: string;
  clientIntentKey: string;
};
type TeacherDeleteArg = { teacherId: string; lifecycleStatus: string; statusReason: string; clientIntentKey: string };
type TeacherDraftRes = RpcEnvelope & { note?: string };

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

export default function StaffTeacherProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const prof = useTeacherProfile(id, "ALL");

  const teacher = prof.data?.teacher;
  const students = prof.data?.students ?? [];

  const [editOpen, setEditOpen] = React.useState(false);
  const [editName, setEditName] = React.useState("");
  const [editPhone, setEditPhone] = React.useState("");
  const [editEmail, setEditEmail] = React.useState("");
  const [editRole, setEditRole] = React.useState("");

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteReason, setDeleteReason] = React.useState("");
  const intentRef = React.useRef(`TCHREQ-${Date.now()}`);

  React.useEffect(() => {
    if (editOpen && teacher) {
      setEditName(teacher.teacherName ?? "");
      setEditPhone(teacher.phone ?? "");
      setEditEmail(teacher.email ?? "");
      setEditRole(teacher.primaryRole ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOpen, teacher]);

  const saveEdit = useMutationRpc<TeacherDraftArg, TeacherDraftRes>("api_staff_requestAddTeacher", {
    onSuccess: (res) => {
      toast.success(res.note ?? "Sent to Sharvil for approval.");
      setEditOpen(false);
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not save edit."),
  });

  const requestDelete = useMutationRpc<TeacherDeleteArg, TeacherDraftRes>("api_staff_requestAddTeacher", {
    onSuccess: (res) => {
      toast.success(res.note ?? "Sent to Sharvil for approval.");
      setDeleteOpen(false);
      setDeleteReason("");
      intentRef.current = `TCHREQ-${Date.now()}`;
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not send the request."),
  });

  if (prof.isError) {
    return (
      <motion.div variants={listVariants} initial="hidden" animate="visible" className="space-y-4">
        <Card className="border-red-400/30 bg-red-400/5">
          <CardContent className="pt-5 text-sm text-red-300">
            {prof.error?.message?.replace(/\[.*\]$/, "") || "Could not load this teacher."}{" "}
            <Button variant="link" className="h-auto p-0 text-dash-accent" onClick={() => prof.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (!teacher) {
    return (
      <motion.div variants={listVariants} initial="hidden" animate="visible" className="space-y-4">
        <Skeleton className="h-20 bg-dash-fg/[0.04]" />
        <Skeleton className="h-40 bg-dash-fg/[0.04]" />
        <Skeleton className="h-40 bg-dash-fg/[0.04]" />
      </motion.div>
    );
  }

  const tone = teacherStatusTone(teacher.status);

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-5">
      <motion.div variants={fadeUp}>
        <Link
          href="/staff/teachers"
          className="inline-flex items-center gap-1.5 text-sm text-dash-fg/60 transition-colors hover:text-dash-accent"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to teachers
        </Link>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card className="border-dash-fg/10 bg-dash-card">
          <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-dash-accent/10 text-lg font-semibold text-dash-accent">
                {initials(teacher.teacherName)}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold tracking-tight text-dash-fg">
                    {teacher.teacherName}
                  </h1>
                  <Badge className={tone.className}>{tone.label}</Badge>
                </div>
                <p className="mt-1 text-sm text-dash-fg/55">
                  {[teacher.primaryRole, teacher.branchClassCode].filter(Boolean).join(" · ") ||
                    "Instrument not set"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
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
        <Card className="border-dash-fg/10 bg-dash-card">
          <CardContent className="pt-5">
            <h2 className="mb-3 text-sm font-semibold text-dash-fg/90">
              Assigned students ({students.length})
            </h2>
            {students.length === 0 ? (
              <p className="py-6 text-sm text-dash-fg/45">No students assigned yet.</p>
            ) : (
              <ul className="divide-y divide-dash-fg/[0.04]">
                {students.map((s) => {
                  const fee = feeStatusTone(s.feeStatus);
                  return (
                    <li key={s.studentId}>
                      <Link
                        href={`/staff/students/${s.studentId}`}
                        className="flex items-center justify-between gap-3 py-3 transition-colors hover:text-dash-accent"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-dash-fg/90">
                            {s.studentName}
                          </p>
                          <p className="truncate text-xs text-dash-fg/45">
                            {[s.instrument, s.classCode].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <Badge className={fee.className}>{fee.label}</Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card className="border-dash-fg/10 bg-dash-card">
          <CardContent className="flex items-center gap-2 pt-5 text-xs text-dash-fg/45">
            <GraduationCap className="h-4 w-4 shrink-0 text-dash-accent/60" aria-hidden />
            Contact: {teacher.phone || "no phone"} · {teacher.email || "no email"}
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="border-dash-fg/10 bg-dash-card">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Edit teacher</DialogTitle>
            <DialogDescription className="text-dash-fg/50">
              Sent to Sharvil for approval — nothing changes until he approves it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Teacher name</Label>
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
              <Label className="text-[13px] text-dash-fg/70">Primary instrument / role</Label>
              <Input value={editRole} onChange={(e) => setEditRole(e.target.value)} className="border-dash-fg/10 bg-dash-surface text-dash-fg" />
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
                  teacherId: id,
                  teacherName: editName.trim(),
                  phone: editPhone.trim(),
                  email: editEmail.trim(),
                  primaryRole: editRole.trim(),
                  clientIntentKey: intentRef.current,
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
            <DialogTitle className="text-dash-fg">Request delete for {teacher.teacherName}?</DialogTitle>
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
                  teacherId: id,
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
