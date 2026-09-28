"use client";

import * as React from "react";
import { CalendarOff, Plus } from "lucide-react";
import { toast } from "sonner";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutationRpc, useRpc } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope } from "@/lib/api/rpc-types";

interface ClosureRow {
  closureId: string;
  scope: string;
  branch: string;
  fromDate: string;
  toDate: string;
  reason: string;
  state: string;
  recordedBy: string;
}

interface ClosureListRes extends RpcEnvelope {
  rows?: ClosureRow[];
}

interface ClosureRes extends RpcEnvelope {
  note?: string;
}

function StateBadge({ state }: { state: string }) {
  if (state === "AUTHORISED") return <Badge variant="mint">Authorised</Badge>;
  if (state === "REVOKED") return <Badge variant="outline">Revoked</Badge>;
  return <Badge variant="peach">Proposed</Badge>;
}

/** Founder request: staff proposes a branch/academy closure (holiday); founder authorises or revokes it. */
export function ClosuresPanel({ branch, isFounder }: { branch?: string; isFounder: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [proposeOpen, setProposeOpen] = React.useState(false);
  const [scope, setScope] = React.useState<"BRANCH" | "ACADEMY">("BRANCH");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [reason, setReason] = React.useState("");
  const intentRef = React.useRef(`CLOSURE-${Date.now()}`);

  const list = useRpc<ClosureListRes>("api_closureCalendarList", undefined, { enabled: open });
  const rows = list.data?.rows ?? [];

  const propose = useMutationRpc<
    { scope: string; branch?: string; fromDate: string; toDate: string; reason: string; clientIntentKey: string },
    ClosureRes
  >("api_staff_proposeClosure", {
    invalidate: [["rpc", "api_closureCalendarList"]],
    onSuccess: (res) => {
      toast.success(res.note ?? "Sent for approval.");
      setProposeOpen(false);
      setFromDate("");
      setToDate("");
      setReason("");
      intentRef.current = `CLOSURE-${Date.now()}`;
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not send the request."),
  });

  const revoke = useMutationRpc<{ closureId: string; reason: string }, ClosureRes>("api_founder_revokeClosure", {
    invalidate: [["rpc", "api_closureCalendarList"]],
    onSuccess: (res) => toast.success(res.note ?? "Closure revoked."),
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not revoke."),
  });

  return (
    <>
      <Button variant="outline" size="sm" className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]" onClick={() => setOpen(true)}>
        <CalendarOff className="h-3.5 w-3.5" aria-hidden /> Closures
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-dash-fg/10 bg-dash-card text-dash-fg sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Closures / holidays</DialogTitle>
            <DialogDescription className="text-dash-fg/50">
              A closure marks the affected classes as not required — it never overwrites a class already answered.
            </DialogDescription>
          </DialogHeader>

          <Button size="sm" className="w-fit bg-dash-accent text-dash-bg hover:bg-dash-accent-hover" onClick={() => setProposeOpen(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden /> Propose closure
          </Button>

          <div className="space-y-2">
            {list.isPending ? (
              <p className="text-sm text-dash-fg/50">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-dash-fg/50">No closures recorded yet.</p>
            ) : (
              rows.map((r) => (
                <div key={r.closureId} className="rounded-xl border border-dash-fg/10 bg-dash-fg/[0.02] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-dash-fg">
                      {r.fromDate === r.toDate ? r.fromDate : `${r.fromDate} – ${r.toDate}`}
                    </p>
                    <StateBadge state={r.state} />
                  </div>
                  <p className="mt-1 text-xs text-dash-fg/50">
                    {r.scope === "ACADEMY" ? "Academy-wide" : r.branch} · {r.reason}
                  </p>
                  {isFounder && r.state === "AUTHORISED" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2 h-auto px-0 text-red-500 hover:bg-transparent hover:text-red-400"
                      onClick={() => {
                        const why = window.prompt("Why is this closure being revoked?");
                        if (why?.trim()) revoke.mutate({ closureId: r.closureId, reason: why.trim() });
                      }}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={proposeOpen} onOpenChange={setProposeOpen}>
        <DialogContent className="border-dash-fg/10 bg-dash-card text-dash-fg">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Propose a closure</DialogTitle>
            <DialogDescription className="text-dash-fg/50">Sent for approval — the founder decides.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setScope("BRANCH")}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${scope === "BRANCH" ? "border-dash-accent bg-dash-accent/10 text-dash-accent" : "border-dash-fg/10 text-dash-fg/60"}`}
              >
                This branch{branch ? ` (${branch})` : ""}
              </button>
              <button
                type="button"
                onClick={() => setScope("ACADEMY")}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${scope === "ACADEMY" ? "border-dash-accent bg-dash-accent/10 text-dash-accent" : "border-dash-fg/10 text-dash-fg/60"}`}
              >
                Whole academy
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[13px] text-dash-fg/70">From *</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border-dash-fg/10 bg-dash-surface text-dash-fg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] text-dash-fg/70">To</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="border-dash-fg/10 bg-dash-surface text-dash-fg" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Reason *</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Diwali holiday" className="border-dash-fg/10 bg-dash-surface text-dash-fg" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setProposeOpen(false)}>Cancel</Button>
            <Button
              disabled={!fromDate || !reason.trim()}
              loading={propose.isPending}
              onClick={() =>
                propose.mutate({
                  scope,
                  branch: scope === "BRANCH" ? branch : undefined,
                  fromDate,
                  toDate: toDate || fromDate,
                  reason: reason.trim(),
                  clientIntentKey: intentRef.current,
                })
              }
              className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
            >
              Send for approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
