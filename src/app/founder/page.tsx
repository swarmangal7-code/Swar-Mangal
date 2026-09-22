"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CalendarDays, HandCoins, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAuditLog,
  useBootstrap,
  useDashboard,
  useDueReminders,
  useTeachers,
} from "@/lib/api/rpc-hooks";
import type { DueReminderItem } from "@/lib/api/rpc-types";
import { useTokenAuth } from "@/lib/auth/token-auth";
import { fadeUp, listVariants } from "@/lib/motion";
import { cn, formatINR } from "@/lib/utils/cn";

import { formatWhen, formatDateOnly } from "./_shared";

function MetricCard({
  label,
  value,
  sub,
  href,
  gold,
}: {
  label: string;
  value: string;
  sub?: string;
  href?: string;
  gold?: boolean;
}) {
  const inner = (
    <Card className="h-full border-dash-fg/10 bg-dash-card transition-colors hover:border-dash-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60">
      <CardContent className="pt-5">
        <p className="text-xs font-medium text-dash-fg/45">{label}</p>
        <p
          className={cn(
            "mt-2 text-2xl font-semibold tracking-tight",
            gold ? "text-dash-accent" : "text-dash-fg",
          )}
        >
          {value}
        </p>
        {sub ? <p className="mt-1 text-xs text-dash-fg/40">{sub}</p> : null}
      </CardContent>
    </Card>
  );
  if (href) {
    return (
      <Link href={href} className="block h-full">
        {inner}
      </Link>
    );
  }
  return inner;
}

function ReminderCard({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: DueReminderItem[];
  tone: "due" | "overdue";
}) {
  const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const count = rows.length;
  return (
    <Link
      href="/founder/fees"
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
    >
      <Card className="h-full border-dash-fg/10 bg-dash-card transition-colors hover:border-dash-accent/40">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-dash-fg">{title}</p>
            <Badge
              className={cn(
                "border",
                tone === "overdue"
                  ? "border-red-400/30 bg-red-400/10 text-red-300"
                  : "border-amber-400/30 bg-amber-400/10 text-amber-300",
              )}
            >
              {count}
            </Badge>
          </div>
          {total > 0 && (
            <p className="mt-1.5 text-lg font-semibold tracking-tight text-dash-accent">
              {formatINR(total)}
            </p>
          )}
          <ul className="mt-3 space-y-1.5">
            {rows.slice(0, 4).map((r) => (
              <li key={r.studentId} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="truncate text-dash-fg/85">{r.studentName}</span>
                <span className="shrink-0 text-dash-fg/45">
                  {r.classCode} · {formatDateOnly(r.nextDueDate)}
                </span>
              </li>
            ))}
          </ul>
          {count === 0 && (
            <p className="mt-3 text-sm text-dash-fg/45">Nothing {tone === "overdue" ? "overdue" : "due"} today.</p>
          )}
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-dash-accent">
            Collect fees <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

const QUICK_LINKS = [
  { label: "Add Student", href: "/founder/students/add", icon: Plus },
  { label: "Add Fee", href: "/founder/fees", icon: HandCoins },
  { label: "Today's Classes", href: "/founder/timetable", icon: CalendarDays },
];

export default function FounderDashboardPage() {
  const { session } = useTokenAuth();
  const boot = useBootstrap();
  const dash = useDashboard();
  const reminders = useDueReminders();
  const teachers = useTeachers();
  const audit = useAuditLog();

  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const firstName = session?.name?.split(" ")[0] || boot.data?.name?.split(" ")[0] || "Founder";

  const activeStudents =
    (reminders.data?.gmcActive ?? 0) + (reminders.data?.kmcActive ?? 0);
  const teacherCount = teachers.data?.teachers?.length;
  const approvals = dash.data?.approvalsCount;
  const collection = dash.data?.monthCollection ?? 0;
  const receiptCount = dash.data?.monthCount ?? 0;

  const loaded = dash.data && reminders.data;
  const failed = dash.isError || reminders.isError;
  const auditRows = audit.data?.rows ?? [];

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-6">
      <motion.div
        variants={fadeUp}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-dash-fg/40">{today}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-dash-fg">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-dash-fg/55">
            Founder overview — collections, approvals and academy health.
          </p>
        </div>
        <Badge className="w-fit border border-dash-accent/30 bg-dash-accent/10 text-dash-accent">
          Founder
        </Badge>
      </motion.div>

      {failed && (
        <motion.div variants={fadeUp}>
          <Card className="border-red-400/30 bg-red-400/5">
            <CardContent className="pt-5 text-sm text-red-300">
              Could not load live data.{" "}
              <Button variant="link" className="h-auto p-0 text-dash-accent" onClick={() => { dash.refetch(); reminders.refetch(); }}>
                Retry
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div variants={fadeUp} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loaded ? (
          <>
            <MetricCard
              label="Active students"
              value={String(activeStudents)}
              sub="GMC + KMC on the books"
            />
            <MetricCard label="Teachers" value={String(teacherCount ?? "—")} />
            <MetricCard
              label="Pending approvals"
              value={String(approvals ?? "—")}
              gold
              href="/founder/approvals"
            />
            <MetricCard
              label="Collected this month"
              value={formatINR(collection)}
              sub={receiptCount ? `${receiptCount} receipts` : undefined}
              gold
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 bg-dash-fg/[0.04]" />
          ))
        )}
      </motion.div>

      <motion.div variants={fadeUp} className="grid gap-4 md:grid-cols-2">
        {loaded ? (
          <>
            <ReminderCard title="Due today" rows={reminders.data?.dueToday ?? []} tone="due" />
            <ReminderCard title="Overdue" rows={reminders.data?.overdue ?? []} tone="overdue" />
          </>
        ) : (
          <>
            <Skeleton className="h-52 bg-dash-fg/[0.04]" />
            <Skeleton className="h-52 bg-dash-fg/[0.04]" />
          </>
        )}
      </motion.div>

      <motion.div variants={fadeUp}>
        <h2 className="mb-3 text-sm font-semibold text-dash-fg/80">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-3">
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
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-dash-fg/90">Recent activity</h2>
              <Link href="/founder/activity" className="text-xs font-medium text-dash-accent hover:text-dash-accent-hover">
                View all
              </Link>
            </div>
            {audit.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 bg-dash-fg/[0.04]" />
                ))}
              </div>
            ) : auditRows.length === 0 ? (
              <p className="py-4 text-sm text-dash-fg/45">No recent activity recorded.</p>
            ) : (
              <ul className="divide-y divide-dash-fg/[0.04]">
                {auditRows.slice(0, 6).map((e, i) => (
                  <li key={`${e.at}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-dash-fg/85">
                        <span className="font-medium text-dash-accent">{e.fn.replace("api_", "api·")}</span>
                        {" — "}
                        {e.ok ? "succeeded" : e.code}
                      </p>
                      <p className="truncate text-xs text-dash-fg/40">{e.actorEmail}</p>
                    </div>
                    <span className="shrink-0 text-xs text-dash-fg/45">{formatWhen(e.at)}</span>
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