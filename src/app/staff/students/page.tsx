"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Search, UserPlus2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useNewEnrollments, useStudentSearch, useTeachers } from "@/lib/api/rpc-hooks";
import { useTokenAuth } from "@/lib/auth/token-auth";
import { fadeUp, listVariants } from "@/lib/motion";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { feeStatusTone, formatINR, studentStatusTone } from "@/app/founder/_shared";

type FeeFilter = "ALL" | "PAID" | "DUE" | "OVERDUE";

const FEE_FILTERS: { value: FeeFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PAID", label: "Paid" },
  { value: "DUE", label: "Due" },
  { value: "OVERDUE", label: "Overdue" },
];

export default function StaffStudentsPage() {
  const { session } = useTokenAuth();
  const branches = session?.branches ?? [];
  const branch = branches.length === 1 ? branches[0] : "ALL";

  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [instrument, setInstrument] = React.useState("ALL");
  const [teacherId, setTeacherId] = React.useState("ALL");
  const [feeFilter, setFeeFilter] = React.useState<FeeFilter>("ALL");

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const search = useStudentSearch(debounced, { mode: "staff", branch, instrument, teacherId, feeState: feeFilter }, { enabled: true });
  const { data: teacherData } = useTeachers();
  const newEnrollments = useNewEnrollments();
  const rows = search.data?.results ?? search.data?.rows ?? [];
  const instruments = search.data?.instruments ?? [];
  const hasFilters = instrument !== "ALL" || teacherId !== "ALL" || feeFilter !== "ALL";
  const searching = debounced.trim().length > 0 || hasFilters;

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-6">
      <motion.div variants={fadeUp} className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-dash-fg/40">Staff · Students</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">Students</h1>
          <p className="mt-1 text-sm text-dash-fg/55">
            The full roster — search to narrow it down.
            {!search.isPending && !search.isError && ` ${rows.length} student${rows.length === 1 ? "" : "s"}.`}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]">
          <Link href="/staff/students/new-enrollments" className="relative">
            <UserPlus2 className="h-3.5 w-3.5" aria-hidden /> New Enrollments
            {!!newEnrollments.data?.pendingCount && (
              <Badge className="ml-1.5 border-dash-accent/40 bg-dash-accent/15 text-dash-accent">
                {newEnrollments.data.pendingCount}
              </Badge>
            )}
          </Link>
        </Button>
      </motion.div>

      <motion.div variants={fadeUp} className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-dash-fg/35" aria-hidden />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, phone or STU id…"
          className="h-12 border-dash-fg/12 bg-dash-card pl-11 text-dash-fg placeholder:text-dash-fg/30"
        />
      </motion.div>

      <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-3">
        <select
          value={instrument}
          onChange={(e) => setInstrument(e.target.value)}
          aria-label="Filter by instrument"
          className="rounded-xl border border-dash-fg/10 bg-dash-card px-3 py-1.5 text-[13px] text-dash-fg"
        >
          <option value="ALL">All instruments</option>
          {instruments.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <select
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          aria-label="Filter by teacher"
          className="rounded-xl border border-dash-fg/10 bg-dash-card px-3 py-1.5 text-[13px] text-dash-fg"
        >
          <option value="ALL">All teachers</option>
          {(teacherData?.teachers ?? []).map((t) => (
            <option key={t.teacherId} value={t.teacherId}>
              {t.teacherName}
            </option>
          ))}
        </select>
        <SegmentedControl value={feeFilter} onChange={setFeeFilter} options={FEE_FILTERS} label="Filter by fee status" />
      </motion.div>

      {search.isError ? (
        <motion.div variants={fadeUp}>
          <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-6 text-sm text-red-300">
            {search.error?.message?.replace(/\[.*\]$/, "") || "Could not search students."}
          </p>
        </motion.div>
      ) : search.isPending || (search.isFetching && rows.length === 0) ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 bg-dash-fg/[0.04]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <motion.div variants={fadeUp}>
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-dash-fg/15 bg-dash-fg/[0.02] px-6 py-14 text-center">
            <Users className="mb-3 h-9 w-9 text-dash-fg/20" aria-hidden />
            <p className="text-sm font-medium text-dash-fg/70">
              {searching ? "No students matched" : "No students yet"}
            </p>
            <p className="mt-1 max-w-xs text-xs text-dash-fg/40">
              {searching ? "Try a different name or phone number." : "Add the first student to get started."}
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div variants={fadeUp} className="overflow-hidden rounded-2xl border border-dash-fg/10 bg-dash-card">
          <ul className="divide-y divide-dash-fg/[0.06]">
            {rows.map((s) => {
              const status = studentStatusTone(s.status);
              const fee = feeStatusTone(s.feeStatus);
              return (
                <li key={s.studentId}>
                  <Link
                    href={`/staff/students/${encodeURIComponent(s.studentId)}`}
                    className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-dash-fg/[0.04] sm:px-5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-dash-fg">{s.studentName}</span>
                        <Badge className={status.className}>{status.label}</Badge>
                        <Badge className={fee.className}>{fee.label}</Badge>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-dash-fg/45">
                        {[s.studentId, s.classCode, s.phone, s.instrument].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-sm text-dash-fg/60 sm:block">
                      {s.monthlyFee ? formatINR(s.monthlyFee) : ""}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-dash-fg/30" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </motion.div>
      )}
    </motion.div>
  );
}
