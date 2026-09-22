"use client";

export const runtime = "edge";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, HandCoins, UserRoundCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStudentHub, useStudentProfile } from "@/lib/api/rpc-hooks";
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
                <Link href="/staff/fees">
                  <HandCoins className="h-3.5 w-3.5" aria-hidden /> Collect fee
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]">
                <Link href="/staff/attendance">
                  <UserRoundCheck className="h-3.5 w-3.5" aria-hidden /> Attendance
                </Link>
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
    </motion.div>
  );
}
