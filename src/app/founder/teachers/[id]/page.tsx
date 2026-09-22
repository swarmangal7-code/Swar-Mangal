"use client";

export const runtime = "edge";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, GraduationCap } from "lucide-react";
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
import {
  rpcKeys,
  useMutationRpc,
  usePayoutPreview,
  useTeacherProfile,
} from "@/lib/api/rpc-hooks";
import type { RpcEnvelope } from "@/lib/api/rpc-types";
import { fadeUp, listVariants } from "@/lib/motion";
import { initials } from "@/lib/utils/cn";

import { feeStatusTone, formatDateOnly, formatINR, teacherStatusTone } from "../../_shared";

type UpdateCompArg = {
  teacherId: string;
  percentage: number;
  effectiveFrom: string;
  reason: string;
  clientIntentKey: string;
};

type TeacherStatusArg = { teacherId: string; newStatus: string; reason: string };

const TEACHER_STATUSES = ["ACTIVE", "INACTIVE", "HOLD"];

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

export default function FounderTeacherProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const prof = useTeacherProfile(id, "ALL");

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const pay = usePayoutPreview(month);
  const payoutRow = (pay.data?.results ?? []).find((r) => r.teacherId === id);

  const [compOpen, setCompOpen] = React.useState(false);
  const [compPercent, setCompPercent] = React.useState("");
  const [compFrom, setCompFrom] = React.useState("");
  const [compReason, setCompReason] = React.useState("");
  const intentKey = React.useRef(`COMP-${Date.now()}`);

  const [statusOpen, setStatusOpen] = React.useState(false);
  const [statusValue, setStatusValue] = React.useState("ACTIVE");
  const [statusReason, setStatusReason] = React.useState("");

  const teacher = prof.data?.teacher;
  const students = prof.data?.students ?? [];

  const updateComp = useMutationRpc<UpdateCompArg, RpcEnvelope>("api_updateTeacherCompensation", {
    invalidate: [rpcKeys.root],
    onSuccess: () => {
      toast.success("Compensation updated.");
      setCompOpen(false);
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not update compensation."),
  });

  const setStatus = useMutationRpc<TeacherStatusArg, RpcEnvelope>("api_updateTeacherStatus", {
    invalidate: [rpcKeys.root],
    onSuccess: () => {
      toast.success("Teacher status updated.");
      setStatusOpen(false);
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not update status."),
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
  const percentNum = Number(compPercent);

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-5">
      <motion.div variants={fadeUp}>
        <Link
          href="/founder/teachers"
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
                onClick={() => {
                  setCompPercent(teacher.compensationPercent ?? teacher.academyShare ?? "");
                  setCompFrom(teacher.compensationEffectiveFrom ?? "");
                  setCompReason("");
                  intentKey.current = `COMP-${Date.now()}`;
                  setCompOpen(true);
                }}
              >
                Update Compensation
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusValue(teacher.status || "ACTIVE");
                  setStatusReason("");
                  setStatusOpen(true);
                }}
              >
                Change Status
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp} className="grid gap-4 lg:grid-cols-2">
        <Card className="border-dash-fg/10 bg-dash-card">
          <CardContent className="pt-5">
            <h2 className="mb-2 text-sm font-semibold text-dash-fg/90">Compensation</h2>
            <dl>
              <InfoRow label="Academy share" value={teacher.academyShare ? `${teacher.academyShare}%` : undefined} />
              <InfoRow label="Current %" value={teacher.compensationPercent ? `${teacher.compensationPercent}%` : undefined} />
              <InfoRow label="Effective from" value={formatDateOnly(teacher.compensationEffectiveFrom)} />
              <InfoRow label="Payout stream" value={teacher.payoutStreams} />
              <InfoRow label="Payout model" value={teacher.payoutModel} />
              <InfoRow label="Receipts this month" value={prof.data ? String(prof.data.receiptCountThisMonth) : undefined} />
            </dl>
          </CardContent>
        </Card>

        <Card className="border-dash-fg/10 bg-dash-card">
          <CardContent className="pt-5">
            <h2 className="mb-2 text-sm font-semibold text-dash-fg/90">
              Payout preview · {month}
            </h2>
            {pay.isPending ? (
              <Skeleton className="h-32 bg-dash-fg/[0.04]" />
            ) : pay.isError ? (
              <p className="py-6 text-sm text-red-300">
                Could not load the payout preview.{" "}
                <Button variant="link" className="h-auto p-0 text-dash-accent" onClick={() => pay.refetch()}>
                  Retry
                </Button>
              </p>
            ) : !payoutRow ? (
              <p className="py-6 text-sm text-dash-fg/45">No payout recorded for {month} yet.</p>
            ) : (
              <div>
                <dl>
                  <InfoRow label="Receipts" value={String(payoutRow.receiptCount)} />
                  <InfoRow label="Collection" value={formatINR(payoutRow.totalCollection)} />
                  <InfoRow label="Teacher share" value={formatINR(payoutRow.totalTeacherShare)} />
                  <InfoRow label="Payable" value={formatINR(payoutRow.payable)} />
                  <InfoRow label="Already paid" value={formatINR(payoutRow.alreadyPaid)} />
                  <InfoRow
                    label="Balance"
                    value={payoutRow.balance == null ? "—" : formatINR(payoutRow.balance)}
                  />
                </dl>
                {payoutRow.reasons?.length ? (
                  <ul className="mt-2 space-y-1">
                    {payoutRow.reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-amber-300">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-300" />
                        {r.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-3 border-t border-dash-fg/[0.04] pt-3">
                  <Badge
                    className={
                      payoutRow.status === "PAID"
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                        : payoutRow.status === "PENDING" || payoutRow.status === "READY"
                          ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                          : "border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/70"
                    }
                  >
                    {payoutRow.status || "—"}
                  </Badge>
                </div>
              </div>
            )}
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
                        href={`/founder/students/${s.studentId}`}
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

      <Dialog open={compOpen} onOpenChange={setCompOpen}>
        <DialogContent className="border-dash-fg/10 bg-dash-card">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Update compensation</DialogTitle>
            <DialogDescription className="text-dash-fg/50">
              Percentage and effective date apply to new payouts. Audited.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Share percentage *</Label>
              <Input
                value={compPercent}
                onChange={(e) => setCompPercent(e.target.value)}
                type="number"
                min={0}
                max={100}
                inputMode="numeric"
                placeholder="40"
                className="border-dash-fg/10 bg-dash-surface text-dash-fg placeholder:text-dash-fg/35"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Effective from *</Label>
              <Input
                value={compFrom}
                onChange={(e) => setCompFrom(e.target.value)}
                type="date"
                className="border-dash-fg/10 bg-dash-surface text-dash-fg"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Reason *</Label>
              <Textarea
                value={compReason}
                onChange={(e) => setCompReason(e.target.value)}
                placeholder="Why this change?"
                className="border-dash-fg/10 bg-dash-surface text-dash-fg placeholder:text-dash-fg/35"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              loading={updateComp.isPending}
              disabled={!compReason.trim() || !compFrom || compPercent.trim() === "" || !(percentNum >= 0 && percentNum <= 100)}
              onClick={() =>
                updateComp.mutate({
                  teacherId: id,
                  percentage: percentNum,
                  effectiveFrom: compFrom,
                  reason: compReason.trim(),
                  clientIntentKey: intentKey.current,
                })
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="border-dash-fg/10 bg-dash-card">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Change teacher status</DialogTitle>
            <DialogDescription className="text-dash-fg/50">
              Status changes are audited. A reason is required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {TEACHER_STATUSES.map((s) => (
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
                setStatus.mutate({ teacherId: id, newStatus: statusValue, reason: statusReason.trim() })
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}