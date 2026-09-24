"use client";

export const runtime = "edge";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, GraduationCap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeacherProfile } from "@/lib/api/rpc-hooks";
import { fadeUp, listVariants } from "@/lib/motion";
import { initials } from "@/lib/utils/cn";

import { feeStatusTone, teacherStatusTone } from "@/app/founder/_shared";

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
    </motion.div>
  );
}
