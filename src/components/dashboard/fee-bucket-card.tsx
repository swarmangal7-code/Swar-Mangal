"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { MessageComposeDialog, type MessageType } from "@/components/message-compose-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DueReminderItem } from "@/lib/api/rpc-types";
import { cn, formatINR } from "@/lib/utils/cn";

import { formatDateOnly } from "@/app/founder/_shared";

export type FeeBucket = "due" | "overdue" | "dueSoon";

/** Which reminder each bucket implies. Mirrors FeeBucketScreen in the app. */
const BUCKET_MESSAGE_TYPE: Record<FeeBucket, MessageType> = {
  overdue: "OVERDUE_ACCRUING",
  due: "DUE_TODAY",
  dueSoon: "DUE_SOON",
};

/**
 * One fee bucket as a card: headline count + total, a peek at the top few, and
 * a drill-down listing everyone in it. Each row offers the two things you can
 * actually do next — send that student's reminder, or go collect the fee.
 */
export function FeeBucketCard({
  title,
  rows,
  tone,
  collectHref,
}: {
  title: string;
  rows: DueReminderItem[];
  tone: FeeBucket;
  /** Where "Collect" goes — differs by role: /founder/fees vs /staff/fees. */
  collectHref: (studentId: string) => string;
}) {
  const [open, setOpen] = React.useState(false);
  const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const count = rows.length;
  const empty = tone === "overdue" ? "Nothing overdue." : tone === "due" ? "Nothing due today." : "Nothing due in the coming days.";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
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
              <p className="mt-1.5 text-lg font-semibold tracking-tight text-dash-accent">{formatINR(total)}</p>
            )}
            {count > 0 ? (
              <ul className="mt-3 space-y-2">
                {rows.slice(0, 4).map((r) => (
                  <li key={r.studentId} className="min-w-0 text-[13px]">
                    <p className="truncate text-dash-fg/85">{r.studentName}</p>
                    <p className="truncate text-[11px] text-dash-fg/45">
                      {r.classCode} · {formatDateOnly(r.nextDueDate)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-dash-fg/45">{empty}</p>
            )}
            <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-dash-accent">
              View all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </p>
          </CardContent>
        </Card>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-dash-fg/10 bg-dash-card text-dash-fg sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">
              {title} ({count})
            </DialogTitle>
          </DialogHeader>
          {count === 0 ? (
            <p className="text-sm text-dash-fg/50">{empty}</p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div
                  key={r.studentId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-dash-fg/10 bg-dash-fg/[0.02] p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-dash-fg">{r.studentName}</p>
                    <p className="text-xs text-dash-fg/45">
                      {r.classCode} · {formatDateOnly(r.nextDueDate)} · {formatINR(Number(r.amount) || 0)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <MessageComposeDialog
                      studentId={r.studentId}
                      studentName={r.studentName}
                      initialType={BUCKET_MESSAGE_TYPE[tone]}
                    />
                    <Button asChild size="sm" variant="outline" className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]">
                      <Link href={collectHref(r.studentId)}>Collect</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
