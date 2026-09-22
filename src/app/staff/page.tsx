"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarCheck,
  HandCoins,
  MessageSquareText,
  Phone,
  UserPlus,
  UserRoundCheck,
} from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRpc, useTodaysClasses } from "@/lib/api/rpc-hooks";
import type { StaffTodayResponse } from "@/lib/api/rpc-types";
import { useTokenAuth } from "@/lib/auth/token-auth";
import { fadeUp, listVariants } from "@/lib/motion";

const QUICK_LINKS = [
  { label: "Today's classes", href: "/staff/classes", icon: CalendarCheck },
  { label: "Collect fee", href: "/staff/fees", icon: HandCoins },
  { label: "Mark attendance", href: "/staff/attendance", icon: UserRoundCheck },
  { label: "Add student", href: "/staff/students/add", icon: UserPlus },
  { label: "Inquiries", href: "/staff/inquiries", icon: MessageSquareText },
];

const OUTCOME_TONE: Record<string, string> = {
  HELD: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  SUBSTITUTE_DELIVERED: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  TEACHER_CANCELLED: "border-red-400/30 bg-red-400/10 text-red-300",
  ACADEMY_CANCELLED: "border-red-400/30 bg-red-400/10 text-red-300",
  RESCHEDULED: "border-amber-400/30 bg-amber-400/10 text-amber-300",
};

function outcomeLabel(value?: string) {
  if (!value) return "Not answered";
  return value
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

function StatCard({ label, value, sub, href }: { label: string; value: string; sub?: string; href?: string }) {
  const body = (
    <Card className="h-full border-dash-fg/10 bg-dash-card transition-colors hover:border-dash-accent/40">
      <CardContent className="pt-5">
        <p className="text-xs text-dash-fg/45">{label}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-dash-fg">{value}</p>
        {sub ? <p className="mt-1 text-xs text-dash-fg/40">{sub}</p> : null}
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

export default function StaffDashboardPage() {
  const { session } = useTokenAuth();
  const branches = session?.branches ?? [];
  const branch = branches.length === 1 ? branches[0] : "ALL";

  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const tasks = useRpc<StaffTodayResponse>("api_staff_todaysTasks", { branch });
  const classes = useTodaysClasses(undefined, branch);

  const feeDue = tasks.data?.feesDueToday;
  const attendance = tasks.data?.attendanceSummary;
  const classRows = classes.data?.rows ?? tasks.data?.todaysLectures?.rows ?? [];
  const loading = tasks.isPending && classes.isPending;
  const failed = tasks.isError && classes.isError;

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-6">
      <motion.div variants={fadeUp} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={session?.name ?? "S"} size="lg" />
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-dash-fg/40">{today}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-dash-fg">
              Welcome, {session?.name?.split(" ")[0] ?? "there"}
            </h1>
            <p className="mt-1 text-sm text-dash-fg/55">
              Your day — classes, fee collection and open inquiries.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {branches.map((b) => (
            <Badge key={b} className="border border-dash-accent/30 bg-dash-accent/10 text-dash-accent">
              {b}
            </Badge>
          ))}
          <Badge className="border border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/70">Staff</Badge>
        </div>
      </motion.div>

      {failed && (
        <motion.div variants={fadeUp}>
          <Card className="border-red-400/30 bg-red-400/5">
            <CardContent className="pt-5 text-sm text-red-300">
              Could not load your day.{" "}
              <button
                type="button"
                onClick={() => {
                  tasks.refetch();
                  classes.refetch();
                }}
                className="font-medium text-dash-accent hover:text-dash-accent-hover"
              >
                Retry
              </button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div variants={fadeUp} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 bg-dash-fg/[0.04]" />)
        ) : (
          <>
            <StatCard
              label="Classes today"
              value={String(classes.data?.count ?? tasks.data?.todaysLectures?.count ?? 0)}
              sub={`${classes.data?.unanswered ?? tasks.data?.todaysLectures?.unanswered ?? 0} not answered`}
              href="/staff/classes"
            />
            <StatCard
              label="Fees due today"
              value={String(feeDue?.count ?? 0)}
              sub={`${feeDue?.overdueCount ?? 0} overdue`}
              href="/staff/fees"
            />
            <StatCard
              label="Attendance marked"
              value={attendance ? `${attendance.marked}/${attendance.totalActive}` : "—"}
              sub={attendance ? `${attendance.notMarked} not marked` : undefined}
              href="/staff/attendance"
            />
            <StatCard
              label="Open inquiries"
              value={String(tasks.data?.openInquiries ?? 0)}
              sub={`${tasks.data?.enquiries?.callTodayCount ?? 0} to call today`}
              href="/staff/inquiries"
            />
          </>
        )}
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={fadeUp}>
          <Card className="h-full border-dash-fg/10 bg-dash-card">
            <CardContent className="pt-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-dash-fg/90">Today&apos;s classes</h2>
                <Link href="/staff/classes" className="text-xs font-medium text-dash-accent hover:text-dash-accent-hover">
                  View all
                </Link>
              </div>
              {classes.isPending ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 bg-dash-fg/[0.04]" />
                  ))}
                </div>
              ) : classRows.length === 0 ? (
                <p className="py-6 text-center text-sm text-dash-fg/45">No classes scheduled today.</p>
              ) : (
                <ul className="divide-y divide-dash-fg/[0.04]">
                  {classRows.slice(0, 6).map((c) => (
                    <li key={c.eventId} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-dash-fg/90">
                          {c.course || "Class"} · {c.startTime || "—"}
                        </p>
                        <p className="truncate text-xs text-dash-fg/45">
                          {[c.teacherName, c.branch].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                          c.resolved
                            ? OUTCOME_TONE[(c.outcome ?? "").toUpperCase()] ??
                              "border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/70"
                            : "border-amber-400/30 bg-amber-400/10 text-amber-300"
                        }`}
                      >
                        {c.resolved ? outcomeLabel(c.outcome) : "Not answered"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card className="h-full border-dash-fg/10 bg-dash-card">
            <CardContent className="pt-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-dash-fg/90">Fee collection</h2>
                <Link href="/staff/fees" className="text-xs font-medium text-dash-accent hover:text-dash-accent-hover">
                  Collect
                </Link>
              </div>
              <div className="mb-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-red-400/20 bg-red-400/5 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.1em] text-dash-fg/40">Overdue</p>
                  <p className="mt-0.5 text-lg font-semibold text-red-300">{feeDue?.overdueCount ?? 0}</p>
                </div>
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.1em] text-dash-fg/40">Due today</p>
                  <p className="mt-0.5 text-lg font-semibold text-amber-300">{feeDue?.count ?? 0}</p>
                </div>
                <div className="rounded-xl border border-dash-fg/10 bg-dash-fg/[0.03] px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.1em] text-dash-fg/40">Due soon</p>
                  <p className="mt-0.5 text-lg font-semibold text-dash-fg">{feeDue?.dueSoonCount ?? 0}</p>
                </div>
              </div>
              {tasks.isPending ? (
                <Skeleton className="h-20 bg-dash-fg/[0.04]" />
              ) : (feeDue?.rows?.length ?? 0) === 0 ? (
                <p className="py-6 text-center text-sm text-dash-fg/45">No fees due today.</p>
              ) : (
                <ul className="divide-y divide-dash-fg/[0.04]">
                  {feeDue!.rows.slice(0, 5).map((r) => (
                    <li key={r.studentId} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-dash-fg/90">{r.studentName}</p>
                        <p className="flex items-center gap-1.5 truncate text-xs text-dash-fg/45">
                          <Phone className="h-3 w-3" aria-hidden />
                          {r.phone || r.classCode || "—"}
                        </p>
                      </div>
                      <Link
                        href={`/staff/students/${encodeURIComponent(r.studentId)}`}
                        className="shrink-0 text-xs font-medium text-dash-accent hover:text-dash-accent-hover"
                      >
                        Open
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={fadeUp}>
        <h2 className="mb-3 text-sm font-semibold text-dash-fg/80">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {QUICK_LINKS.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="group flex items-center gap-3 rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.03] px-4 py-3.5 transition-colors hover:border-dash-accent/40 hover:bg-dash-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-dash-accent/10 text-dash-accent">
                <q.icon className="h-4 w-4" aria-hidden />
              </span>
              <p className="text-sm font-medium text-dash-fg">{q.label}</p>
            </Link>
          ))}
        </div>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card className="border-dash-fg/10 bg-dash-card">
          <CardContent className="pt-5">
            <h2 className="mb-3 text-sm font-semibold text-dash-fg/90">Needs attention</h2>
            {tasks.isPending ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 bg-dash-fg/[0.04]" />
                ))}
              </div>
            ) : (tasks.data?.cards ?? []).length === 0 ? (
              <p className="py-4 text-sm text-dash-fg/45">Nothing pending. You are all caught up.</p>
            ) : (
              <ul className="divide-y divide-dash-fg/[0.04]">
                {(tasks.data?.cards ?? [])
                  .filter((c) => (c.count ?? 0) > 0)
                  .slice(0, 8)
                  .map((c) => (
                    <li key={c.key} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="text-sm text-dash-fg/85">{c.label || c.title}</span>
                      <span className="flex items-center gap-2">
                        <Badge
                          className={
                            c.priority === "HIGH"
                              ? "border-red-400/30 bg-red-400/10 text-red-300"
                              : "border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/70"
                          }
                        >
                          {c.count}
                        </Badge>
                        <ArrowRight className="h-3.5 w-3.5 text-dash-fg/25" aria-hidden />
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
