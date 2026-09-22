"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, Plus, Search, UserX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { useRpc } from "@/lib/api/rpc-hooks";
import type { StudentSearchResponse } from "@/lib/api/rpc-types";
import { fadeUp, listVariants } from "@/lib/motion";
import { initials } from "@/lib/utils/cn";

import { feeStatusTone, studentStatusTone, formatINR } from "../_shared";

type ClassFilter = "ALL" | "GMC" | "KMC";

const CLASS_FILTERS: { value: ClassFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "GMC", label: "GMC" },
  { value: "KMC", label: "KMC" },
];

export default function FounderStudentsPage() {
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [cls, setCls] = React.useState<ClassFilter>("ALL");

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isPending, isError, error, refetch } = useRpc<StudentSearchResponse>(
    "api_searchStudent",
    { q: debounced, branch: "ALL", classCode: cls, includeAll: true },
  );

  const rows = data?.results ?? data?.rows ?? [];

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-5">
      <motion.div
        variants={fadeUp}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-dash-fg">Students</h1>
          <p className="mt-1 text-sm text-dash-fg/55">Search the academy roster.</p>
        </div>
        <Button asChild className="hidden bg-dash-accent text-dash-bg hover:bg-dash-accent-hover lg:inline-flex">
          <Link href="/founder/students/add">
            <Plus className="h-4 w-4" aria-hidden /> Add Student
          </Link>
        </Button>
      </motion.div>

      <motion.div variants={fadeUp} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dash-fg/35"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, phone or instrument…"
            className="border-dash-fg/10 bg-dash-card pl-10 text-dash-fg placeholder:text-dash-fg/35 focus-visible:ring-dash-accent/60"
            aria-label="Search students"
          />
        </div>
        <SegmentedControl value={cls} onChange={setCls} options={CLASS_FILTERS} label="Filter by class" />
      </motion.div>

      {isError ? (
        <motion.div variants={fadeUp}>
          <Card className="border-red-400/30 bg-red-400/5">
            <CardContent className="pt-5 text-sm text-red-300">
              {error?.message || "Could not load students."}{" "}
              <Button variant="link" className="h-auto p-0 text-dash-accent" onClick={() => refetch()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : isPending ? (
        <motion.div variants={fadeUp} className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 bg-dash-fg/[0.04]" />
          ))}
        </motion.div>
      ) : rows.length === 0 ? (
        <motion.div variants={fadeUp}>
          <Card className="border-dash-fg/10 bg-dash-card">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-dash-fg/[0.04] text-dash-fg/40">
                <UserX className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium text-dash-fg">No students found</p>
                <p className="mt-0.5 text-sm text-dash-fg/45">
                  {debounced || cls !== "ALL"
                    ? "Try a different search or class filter."
                    : "Add your first student to get started."}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/founder/students/add">
                  <Plus className="h-4 w-4" aria-hidden /> Add Student
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={fadeUp} className="space-y-3">
          {rows.map((s) => {
            const fee = feeStatusTone(s.feeStatus);
            const status = studentStatusTone(s.status);
            return (
              <Link
                key={s.studentId}
                href={`/founder/students/${s.studentId}`}
                className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
              >
                <Card className="border-dash-fg/10 bg-dash-card transition-colors hover:border-dash-accent/40">
                  <CardContent className="flex items-center gap-4 pt-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-dash-accent/10 text-sm font-semibold text-dash-accent">
                      {initials(s.studentName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <p className="truncate text-sm font-medium text-dash-fg">{s.studentName}</p>
                        <Badge className={status.className}>{status.label}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-dash-fg/50">
                        {[s.instrument, s.teacher, s.location].filter(Boolean).join(" · ") || s.className}
                      </p>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <Badge className={fee.className}>{fee.label}</Badge>
                      {s.monthlyFee ? (
                        <p className="mt-1 text-xs font-medium text-dash-fg/55">
                          {formatINR(s.monthlyFee)}
                        </p>
                      ) : null}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-dash-fg/30" aria-hidden />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </motion.div>
      )}

      <Button
        asChild
        size="icon"
        className="fixed bottom-5 right-5 z-30 h-14 w-14 rounded-2xl bg-dash-accent text-dash-bg shadow-float hover:bg-dash-accent-hover lg:hidden"
      >
        <Link href="/founder/students/add" aria-label="Add student">
          <Plus className="h-6 w-6" aria-hidden />
        </Link>
      </Button>
    </motion.div>
  );
}