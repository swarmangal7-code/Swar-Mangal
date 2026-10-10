"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, UserPlus2, Check, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutationRpc, useNewEnrollments } from "@/lib/api/rpc-hooks";
import type { NewEnrollmentRow, RpcEnvelope } from "@/lib/api/rpc-types";
import { useTokenAuth } from "@/lib/auth/token-auth";
import { fadeUp, listVariants } from "@/lib/motion";
import { formatWhen } from "@/app/founder/_shared";

/**
 * Founder request 2026-10-10: a dedicated view for self-submitted
 * enrollments (the public enroll link), separate from the general
 * Approvals queue. Approve/reject reuse the exact same
 * mergeStudentDraft/studentDraftReject RPCs the Approvals screen already
 * calls for any student draft — only founder can decide; staff see this
 * list read-only. Rendered from both /founder/students/new-enrollments and
 * /staff/students/new-enrollments (each role's layout gates the route
 * itself; this component only gates the action buttons).
 */
export function NewEnrollmentsView({ backHref }: { backHref: string }) {
  const { session } = useTokenAuth();
  const isFounder = session?.role === "FOUNDER_ADMIN";
  const enrollments = useNewEnrollments();
  const [rejecting, setRejecting] = React.useState<NewEnrollmentRow | null>(null);
  const [reason, setReason] = React.useState("");

  const merge = useMutationRpc<{ draftId: string }, RpcEnvelope>("api_founder_mergeStudentDraft", {
    invalidate: [["rpc", "api_newEnrollments"]],
    onSuccess: () => toast.success("Added to the roster. Set the fee plan on their profile."),
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not merge."),
  });

  const reject = useMutationRpc<{ draftId: string; reason: string }, RpcEnvelope>("api_founder_studentDraftReject", {
    invalidate: [["rpc", "api_newEnrollments"]],
    onSuccess: () => {
      toast.success("Rejected.");
      setRejecting(null);
      setReason("");
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not reject."),
  });

  const pending = enrollments.data?.pending ?? [];
  const recent = enrollments.data?.recent ?? [];

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="mx-auto max-w-2xl space-y-5">
      <motion.div variants={fadeUp}>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-dash-fg/60 transition-colors hover:text-dash-accent"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to students
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-dash-fg">New Enrollments</h1>
        <p className="mt-1 text-sm text-dash-fg/55">
          Submitted through a public enroll link. {isFounder ? "Review and add the fee plan after approving." : "Sharvil decides these."}
        </p>
      </motion.div>

      {enrollments.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 bg-dash-fg/[0.04]" />
          ))}
        </div>
      ) : pending.length === 0 ? (
        <motion.div variants={fadeUp}>
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-dash-fg/15 bg-dash-fg/[0.02] px-6 py-14 text-center">
            <UserPlus2 className="mb-3 h-9 w-9 text-dash-fg/25" aria-hidden />
            <p className="text-sm font-medium text-dash-fg/75">No pending enrollments</p>
            <p className="mt-1 max-w-xs text-xs text-dash-fg/40">Nothing submitted through an enroll link yet.</p>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {pending.map((row) => (
            <motion.div key={row.draftId} variants={fadeUp}>
              <Card className="border-dash-fg/10 bg-dash-card">
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-dash-fg">{row.name}</p>
                    <Badge className="border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/70">{row.branch}</Badge>
                  </div>
                  <p className="text-xs text-dash-fg/50">
                    {[row.guardianName, row.phone, row.email, row.instrument].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-[11px] text-dash-fg/35">Submitted {formatWhen(row.submittedAt)}</p>
                  {isFounder && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
                        loading={merge.isPending}
                        onClick={() => merge.mutate({ draftId: row.draftId })}
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]"
                        onClick={() => {
                          setRejecting(row);
                          setReason("");
                        }}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden /> Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <motion.div variants={fadeUp} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-dash-fg/40">Recent decisions</p>
          {recent.map((row) => (
            <div key={row.draftId} className="flex items-center justify-between rounded-xl border border-dash-fg/10 px-3 py-2">
              <span className="text-sm text-dash-fg/70">{row.name}</span>
              <Badge
                className={
                  row.status === "MERGED"
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                    : "border-red-400/30 bg-red-400/10 text-red-300"
                }
              >
                {row.status === "MERGED" ? "Added" : "Rejected"}
              </Badge>
            </div>
          ))}
        </motion.div>
      )}

      <Dialog open={!!rejecting} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent className="border-dash-fg/12 bg-dash-card text-dash-fg">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Reject this enrollment?</DialogTitle>
            <DialogDescription className="text-dash-fg/55">{rejecting?.name}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required)"
            className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejecting(null)} className="text-dash-fg/70 hover:bg-dash-fg/[0.05]">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim()}
              loading={reject.isPending}
              onClick={() => rejecting && reject.mutate({ draftId: rejecting.draftId, reason: reason.trim() })}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
