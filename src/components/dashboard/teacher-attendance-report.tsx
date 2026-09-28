"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CalendarRange } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeacherAttendanceReport } from "@/lib/api/rpc-hooks";
import { todayISO } from "@/lib/utils/cn";

function monthStart(iso: string) {
  return `${iso.slice(0, 8)}01`;
}

/** Founder request: a date-range drill-down of who held/cancelled/substituted classes — read only, nothing to approve. */
export function TeacherAttendanceReport({ backHref }: { backHref: string }) {
  const today = todayISO();
  const [from, setFrom] = React.useState(monthStart(today));
  const [to, setTo] = React.useState(today);

  const report = useTeacherAttendanceReport(from, to);
  const rows = report.data?.teachers ?? [];

  return (
    <div className="space-y-6">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-dash-fg/60 transition-colors hover:text-dash-accent">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to teachers
      </Link>

      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-dash-fg/40">Academy</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">Teacher attendance</h1>
        <p className="mt-1 text-sm text-dash-fg/55">Held / cancelled / substituted classes over a date range.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-dash-fg/60">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-10 rounded-xl border border-dash-fg/15 bg-dash-fg/[0.04] px-3 text-sm text-dash-fg"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-dash-fg/60">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-10 rounded-xl border border-dash-fg/15 bg-dash-fg/[0.04] px-3 text-sm text-dash-fg"
          />
        </div>
      </div>

      {report.isPending ? (
        <Skeleton className="h-64 w-full bg-dash-fg/[0.04]" />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-dash-fg/15 bg-dash-fg/[0.02] px-6 py-14 text-center">
          <CalendarRange className="mb-3 h-8 w-8 text-dash-fg/25" aria-hidden />
          <p className="text-sm font-medium text-dash-fg/70">No classes in this range</p>
        </div>
      ) : (
        <Card className="border-dash-fg/10 bg-dash-card">
          <CardContent className="overflow-x-auto pt-5">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-dash-fg/10 text-left text-[11px] uppercase tracking-wide text-dash-fg/40">
                  <th className="pb-2 font-medium">Teacher</th>
                  <th className="pb-2 font-medium text-right">Scheduled</th>
                  <th className="pb-2 font-medium text-right">Held</th>
                  <th className="pb-2 font-medium text-right">Substituted</th>
                  <th className="pb-2 font-medium text-right">Cancelled</th>
                  <th className="pb-2 font-medium text-right">Unanswered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dash-fg/[0.06]">
                {rows.map((r) => (
                  <tr key={r.teacherId || r.teacherName}>
                    <td className="py-2.5 font-medium text-dash-fg">{r.teacherName || r.teacherId}</td>
                    <td className="py-2.5 text-right text-dash-fg/70">{r.scheduled}</td>
                    <td className="py-2.5 text-right text-emerald-600 dark:text-emerald-400">{r.held}</td>
                    <td className="py-2.5 text-right text-amber-600 dark:text-amber-400">{r.substituted}</td>
                    <td className="py-2.5 text-right text-red-500">{r.cancelled}</td>
                    <td className="py-2.5 text-right text-dash-fg/50">{r.unanswered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
