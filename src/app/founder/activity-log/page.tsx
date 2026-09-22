"use client";

import * as React from "react";
import { CheckCircle2, History, Loader2, Lock, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "sonner";

import { useTokenAuth } from "@/lib/auth/token-auth";
import { useMutationRpc, useRpc, rpcKeys } from "@/lib/api/rpc-hooks";
import type { AuditEntry, AuditLogResponse, RpcEnvelope } from "@/lib/api/rpc-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";

interface PeriodLockRow {
  month: string;
  label: string;
  closedBy: string;
  closedAt: string;
  note: string;
}

interface PeriodLocksResponse extends RpcEnvelope {
  rows: PeriodLockRow[];
  nextToClose: string;
  nextToCloseLabel: string;
  unansweredCount: number;
  unanswered: { date: string; startTime: string; course: string; teacher: string }[];
  expectedEventsFloor: string;
}

const PAGE_SIZE = 50;

function monthOptions(count = 8): { value: string; label: string }[] {
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({
      value,
      label: new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(d),
    });
  }
  return out;
}

function monthLookbackDays(month: string): number {
  if (!/^\d{4}-\d{2}$/.test(month)) return 31;
  const [y, m] = month.split("-").map(Number);
  const start = Date.UTC(y, m - 1, 1);
  const days = Math.ceil((Date.now() - start) / 86_400_000);
  return Math.min(Math.max(days, 1), 365);
}

const stamp = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

function roleLabel(role: string) {
  return role === "FOUNDER_ADMIN" ? "Founder" : "Staff";
}

export default function FounderActivityLogPage() {
  const { session } = useTokenAuth();
  const branches = session?.branches?.length ? [...session.branches] : [];

  const months = React.useMemo(() => monthOptions(), []);
  const [month, setMonth] = React.useState(months[0]?.value ?? "");
  const [branch, setBranch] = React.useState("ALL");
  const [failuresOnly, setFailuresOnly] = React.useState(false);
  const [shown, setShown] = React.useState(PAGE_SIZE);
  const [closing, setClosing] = React.useState(false);

  React.useEffect(() => {
    setShown(PAGE_SIZE);
  }, [month, branch, failuresOnly]);

  const days = month ? monthLookbackDays(month) : undefined;
  const auditQ = useRpc<AuditLogResponse>("api_founder_auditLog", {
    limit: 200,
    ...(failuresOnly ? { failuresOnly: true } : {}),
    ...(days ? { days } : {}),
  });

  const locksQ = useRpc<PeriodLocksResponse>("api_founder_periodLocks", undefined, {
    staleTime: 60_000,
  });

  const closeMut = useMutationRpc<{ month: string }, RpcEnvelope>("api_founder_closeMonth", {
    invalidate: [rpcKeys.call("api_founder_periodLocks")],
  });

  const rows: AuditEntry[] = (auditQ.data?.rows ?? []).filter(
    (r) => branch === "ALL" || !r.branch || r.branch === branch,
  );
  const visible = rows.slice(0, shown);

  const locks = locksQ.data;

  const handleCloseMonth = async () => {
    if (!locks?.nextToClose) return;
    setClosing(true);
    try {
      const res = await closeMut.mutateAsync({ month: locks.nextToClose });
      toast.success((res as { note?: string }).note ?? "Month closed.");
      await locksQ.refetch();
      await auditQ.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not close the month.");
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-dash-fg/40">
          Founder · Academy
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">Activity log</h1>
        <p className="mt-1 text-sm text-dash-fg/55">
          Every change made through the app, newest first. Record ids only — no names, amounts or
          phone numbers.
        </p>
      </div>

      {locks && <PeriodLockCard locks={locks} closing={closing} onClose={handleCloseMonth} />}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-10 rounded-xl border border-dash-fg/15 bg-dash-fg/[0.04] px-3 text-sm font-medium text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          {branches.length > 1 && (
            <select
              aria-label="Branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="h-10 rounded-xl border border-dash-fg/15 bg-dash-fg/[0.04] px-3 text-sm font-medium text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
            >
              <option value="ALL">All Branches</option>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}
        </div>
        <SegmentedControl
          label="Filter"
          value={failuresOnly ? "failures" : "all"}
          onChange={(v) => setFailuresOnly(v === "failures")}
          options={[
            { value: "all", label: "All writes" },
            { value: "failures", label: "Failures only" },
          ]}
          className="bg-dash-fg/[0.04]"
        />
      </div>

      {auditQ.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[84px] w-full bg-dash-fg/[0.05]" />
          ))}
        </div>
      ) : auditQ.isError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
          <p className="text-sm font-medium text-red-300">Could not load the activity log.</p>
          <p className="mt-1 text-sm text-dash-fg/55">
            {auditQ.error instanceof Error ? auditQ.error.message : "Something went wrong."}
          </p>
          <Button
            variant="outline"
            onClick={() => auditQ.refetch()}
            className="mt-4 border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]"
          >
            Retry
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-dash-fg/15 bg-dash-fg/[0.02] px-6 py-16 text-center">
          <History className="mb-3 h-6 w-6 text-dash-fg/30" aria-hidden />
          <p className="text-sm font-medium text-dash-fg">
            {failuresOnly ? "No failed writes recorded." : "Nothing recorded for this period."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((entry, i) => (
            <AuditRow key={`${entry.at}-${entry.fn}-${i}`} entry={entry} />
          ))}
          {rows.length > shown && (
            <div className="pt-2 text-center">
              <Button
                variant="outline"
                onClick={() => setShown((n) => n + PAGE_SIZE)}
                className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]"
              >
                Load more ({rows.length - shown} remaining)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const ok = entry.ok;
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border bg-dash-fg/[0.03] p-4 ${
        ok ? "border-dash-fg/10" : "border-red-500/25 bg-red-500/5"
      }`}
    >
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-mono text-[13px] font-semibold text-dash-fg">{entry.fn}</p>
          <Badge
            variant="outline"
            className={
              entry.actorRole === "FOUNDER_ADMIN"
                ? "border-dash-accent/30 bg-dash-accent/10 text-dash-accent"
                : "border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/60"
            }
          >
            {roleLabel(entry.actorRole)}
          </Badge>
          {!ok && entry.code && (
            <Badge variant="destructive" className="bg-red-500/10 text-red-300">
              {entry.code}
            </Badge>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-dash-fg/45">
          {entry.actorEmail && <span className="truncate">{entry.actorEmail}</span>}
          {entry.device && (
            <>
              <span className="text-dash-fg/25">·</span>
              <span className="truncate">{entry.device}</span>
            </>
          )}
          {entry.branch && (
            <>
              <span className="text-dash-fg/25">·</span>
              <span>{entry.branch}</span>
            </>
          )}
        </div>
        {entry.ref && (
          <p className="mt-1 truncate font-mono text-[11px] text-dash-fg/35">{entry.ref}</p>
        )}
      </div>
      <p className="shrink-0 text-[11px] text-dash-fg/40">
        {entry.at ? stamp.format(new Date(entry.at.replace(" ", "T"))) : "—"}
      </p>
    </div>
  );
}

function PeriodLockCard({
  locks,
  closing,
  onClose,
}: {
  locks: PeriodLocksResponse;
  closing: boolean;
  onClose: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const nextToClose = locks.nextToClose;
  const canClose = !!nextToClose && locks.unansweredCount === 0;

  return (
    <div className="rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.03] p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-dash-fg/80">
        <Lock className="h-4 w-4 text-dash-accent" aria-hidden />
        Service months
      </h2>

      {!nextToClose ? (
        <p className="mt-3 text-sm text-dash-fg/55">Every past month is closed.</p>
      ) : locks.unansweredCount > 0 ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
          <p className="text-sm text-amber-100">
            {locks.nextToCloseLabel} cannot close yet: {locks.unansweredCount} class
            {locks.unansweredCount === 1 ? "" : "es"} not answered.
          </p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-dash-fg/55">
            {locks.nextToCloseLabel} has ended and every class is answered.
          </p>
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={!canClose}
            loading={closing}
            className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
          >
            <Lock className="h-4 w-4" aria-hidden />
            Close month
          </Button>
        </div>
      )}

      {locks.rows.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {locks.rows.slice(0, 6).map((r) => (
            <span
              key={r.month}
              className="inline-flex items-center gap-1 rounded-full border border-dash-fg/15 bg-dash-fg/[0.04] px-2.5 py-1 text-[11px] text-dash-fg/55"
              title={r.closedBy ? `Closed by ${r.closedBy} on ${r.closedAt}` : undefined}
            >
              <Lock className="h-3 w-3" aria-hidden />
              {r.label}
            </span>
          ))}
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm border-dash-fg/10 bg-dash-card text-dash-fg">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">
              Close {locks.nextToCloseLabel}?
            </DialogTitle>
            <DialogDescription className="text-dash-fg/45">
              This locks every dated write in that month — attendance, fees, expenses, classes. It
              cannot be reopened from the app.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              className="border-dash-fg/10 text-dash-fg/70 hover:bg-dash-fg/[0.05] hover:text-dash-fg"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                onClose();
              }}
              loading={closing}
              className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
            >
              {closing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Close month
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}