"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ChevronDown, XCircle } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useApprovals, useMutationRpc, usePaymentDrafts, useRpc } from "@/lib/api/rpc-hooks";
import { RpcError, type RpcArg } from "@/lib/api/rpc-client";
import type { ApprovalItem, PaymentDraft, RpcEnvelope } from "@/lib/api/rpc-types";
import { fadeUp, listVariants } from "@/lib/motion";
import { cn, fmtDate, inr } from "@/lib/utils/cn";

interface Cmd {
  key: string;
  fn: string;
  arg: RpcArg;
  label: string;
}

type ConfirmState = { cmd: Cmd | null; message: string; money: boolean };

export default function FounderApprovalsPage() {
  const approvals = useApprovals();
  const drafts = usePaymentDrafts();

  const [tab, setTab] = React.useState("ALL");
  const [cmd, setCmd] = React.useState<Cmd | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmState | null>(null);
  const [reject, setReject] = React.useState<ApprovalItem | null>(null);
  const [pendingFinalise, setPendingFinalise] = React.useState<PaymentDraft | null>(null);
  const [active, setActive] = React.useState<string | null>(null);

  const groups = approvals.data?.groups ?? [];
  const items = approvals.data?.items ?? groups.flatMap((g) => g.items);
  const allItems = tab === "ALL" ? items : groups.find((g) => g.label === tab)?.items ?? items.filter((i) => i.type === tab);
  const queue = drafts.data?.rows ?? [];
  const queueActive = queue.filter((r) => r.status === "APPROVED" || r.repairRequired);
  const totalPending = items.length + queueActive.length;
  const empty =
    (approvals.data?.empty ?? items.length === 0) && queueActive.length === 0 && !approvals.isFetching && !drafts.isFetching;

  const runCmd = (c: Cmd) => setCmd(c);

  const onDone = (c: Cmd) => {
    toast.success(c.label);
    setCmd(null);
  };
  const onError = (err: RpcError) => {
    setCmd(null);
    toast.error(err.message);
  };

  const requestAction = (item: ApprovalItem, action: string) => {
    if (action === "reject") {
      setReject(item);
      return;
    }
    const c = actionCmd(item, action);
    if (!c) {
      toast.error(`No action handler for ${item.type}/${action}`);
      return;
    }
    setConfirm({ cmd: c, message: confirmMessage(item, action), money: action === "finalise" || action === "void" || item.type === "EXPENSE_DRAFT" });
  };

  const confirmThen = () => {
    if (!confirm?.cmd) return;
    runCmd(confirm.cmd);
    setConfirm(null);
  };

  const rejectThen = (reason: string) => {
    if (!reject) return;
    runCmd(rejectCmd(reject, reason));
    setReject(null);
  };

  const finaliseDraft = (row: PaymentDraft) => {
    if (row.repairRequired) {
      toast.info("Repair is done on the founder web — the block names the missing data.");
      return;
    }
    setPendingFinalise(row);
    setConfirm({
      cmd: { key: `${row.draftId}-finalise`, fn: "api_founder_finalisePaymentDraft", arg: { draftId: row.draftId }, label: "Receipt created" },
      message: `Creating a receipt for ${row.draftId} (${inr(Number(row.amount) || 0)}) allocates a receipt number, writes STUDENT_RECEIPTS + MONEY_LEDGER, advances the due date and generates the PDF. This is audited and NOT reversible from the app.`,
      money: true,
    });
  };

  const confirmFinalise = () => {
    if (!confirm?.cmd) return;
    runCmd(confirm.cmd);
    setPendingFinalise(null);
    setConfirm(null);
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-6">
      <motion.div variants={fadeUp}>
        <p className="text-xs uppercase tracking-[0.16em] text-dash-fg/40">People</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">Approvals</h1>
        <p className="mt-1 text-sm text-dash-fg/55">
          {empty ? "All caught up." : `${totalPending} item(s) awaiting your authority.`}
        </p>
      </motion.div>

      {approvals.error || drafts.error ? (
        <motion.div variants={fadeUp}>
          <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-sm text-red-300">
            {approvals.error?.message ?? drafts.error?.message}
          </p>
        </motion.div>
      ) : approvals.isFetching && items.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 bg-dash-fg/[0.04]" />
          ))}
        </div>
      ) : empty ? (
        <motion.div variants={fadeUp}>
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-dash-fg/15 bg-dash-fg/[0.02] px-6 py-16 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-300/70" aria-hidden />
            <p className="text-sm font-medium text-dash-fg/75">All caught up</p>
            <p className="mt-1 max-w-sm text-xs text-dash-fg/40">Nothing waiting for you. New drafts from the team will show up here.</p>
          </div>
        </motion.div>
      ) : (
        <>
          <motion.div variants={fadeUp}>
            <Tabs tabs={[{ label: "All", key: "ALL" }, ...groups.map((g) => ({ label: g.label, key: g.label }))]} active={tab} onChange={setTab} />
          </motion.div>

          <div className="space-y-2">
            {allItems.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-dash-fg/15 p-8 text-center text-sm text-dash-fg/45">Nothing in this tab.</p>
            ) : (
              allItems.map((item) => (
                <ApprovalCard
                  key={`${item.type}-${item.itemId}`}
                  item={item}
                  active={active === `${item.type}-${item.itemId}`}
                  onToggle={() => setActive(active === `${item.type}-${item.itemId}` ? null : `${item.type}-${item.itemId}`)}
                  busy={!!cmd && cmd.key.startsWith(item.itemId)}
                  onAction={(a) => requestAction(item, a)}
                />
              ))
            )}
          </div>

          {tab === "ALL" && queue.length > 0 && (
            <motion.div variants={fadeUp} className="pt-2">
              <h2 className="mb-1 text-sm font-semibold text-dash-fg/80">Receipts pending</h2>
              <p className="mb-3 text-xs text-dash-fg/40">
                Approved payments that have not been turned into a receipt. Finalising writes real money records server-side.
              </p>
              <div className="space-y-2">
                {queue.map((row) => (
                  <DraftCard key={row.draftId} row={row} onFinalise={() => finaliseDraft(row)} busy={!!cmd && cmd.key === `${row.draftId}-finalise`} />
                ))}
              </div>
            </motion.div>
          )}
        </>
      )}

      <ConfirmDialog state={confirm} setState={setConfirm} onConfirm={pendingFinalise ? confirmFinalise : confirmThen} />
      <RejectDialog item={reject} setItem={setReject} onReject={rejectThen} />

      {cmd && <WriteExecute key={cmd.key} fn={cmd.fn} arg={cmd.arg} onDone={() => onDone(cmd)} onError={onError} />}
    </motion.div>
  );
}

function DraftCard({ row, onFinalise, busy }: { row: PaymentDraft; onFinalise: () => void; busy: boolean }) {
  return (
    <Card className="border-dash-fg/10 bg-dash-card">
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-dash-fg">{row.studentName || "Student"}</p>
            <p className="text-xs text-dash-fg/45">
              {row.draftId} · {row.branch || "—"}
            </p>
          </div>
          <span className="text-sm font-bold text-dash-accent">{inr(Number(row.amount) || 0)}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge status={row.status} />
          {row.repairRequired && <Badge variant="destructive">REPAIR REQUIRED</Badge>}
          {row.paymentMode && <Badge variant="outline">{row.paymentMode}</Badge>}
          {row.projectedNextDueDate && <Badge variant="outline">→ due {fmtDate(row.projectedNextDueDate)}</Badge>}
          {row.termsStatus && row.termsStatus.toLowerCase() !== "accepted" && <Badge variant="peach">{row.termsStatus}</Badge>}
        </div>
        <div>
          <Button
            size="sm"
            className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
            disabled={row.status !== "APPROVED"}
            loading={busy}
            onClick={onFinalise}
          >
            {row.repairRequired ? "Repair (founder web)" : "Create receipt"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Short, human labels for each approval type — shown on the card so its
 * kind is legible at a glance instead of only in the tab it came from. */
const APPROVAL_TYPE_LABEL: Record<string, string> = {
  PAYMENT_DRAFT: "Fee payment",
  EXPENSE_DRAFT: "Expense",
  STUDENT_DRAFT: "Student change",
  RECEIPT_CORRECTION: "Receipt correction",
  SCHOOL_INVOICE_DRAFT: "School invoice",
  PACKAGE_EXTENSION: "Package extension",
  PAYMENT_PROFILE_CHANGE: "Payment profile change",
  CLOSURE: "Closure",
  CLASS_CORRECTION: "Class correction",
  LATE_FEE_WAIVER: "Late-fee waiver",
  INSTALMENT_PLAN: "Instalment plan",
  MANUAL_TERMS_ACCEPTANCE: "Terms acceptance",
  TEACHER_ADD_REQUEST: "New teacher",
  TEACHER_EDIT_REQUEST: "Teacher change",
};

function ApprovalCard({
  item,
  active,
  onToggle,
  onAction,
  busy,
}: {
  item: ApprovalItem;
  active: boolean;
  onToggle: () => void;
  onAction: (a: string) => void;
  busy: boolean;
}) {
  const actions = item.actions ?? [];
  const amount = item.amount ? inr(Number(item.amount)) : "";
  const typeLabel = APPROVAL_TYPE_LABEL[item.type] ?? item.type;

  return (
    <Card className={cn("border-dash-fg/10 bg-dash-card transition-colors", active && "border-dash-accent/40")}>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60">
          <div className="min-w-0 flex-1">
            <Badge variant="lavender">{typeLabel}</Badge>
            <p className="mt-1.5 truncate text-sm font-semibold text-dash-fg">{item.entity || item.itemId}</p>
            <p className="text-xs text-dash-fg/45">
              {item.itemId} · {fmtDate(item.date)} · {item.branch || "—"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {amount && <span className="text-sm font-bold text-dash-accent">{amount}</span>}
            <ChevronDown className={cn("h-4 w-4 text-dash-fg/40 transition-transform", active && "rotate-180")} aria-hidden />
          </div>
        </button>

        {item.reason && <p className="text-sm text-dash-fg/75">{item.reason}</p>}
        {item.feesPeriod && <p className="text-xs text-dash-fg/45">Period: {item.feesPeriod}</p>}

        <div className="flex flex-wrap gap-1.5">
          {item.noStudentLinked && <Badge variant="destructive">NO STUDENT LINKED</Badge>}
          {item.studentId && <Badge variant="outline">{item.studentId}</Badge>}
          {item.flags?.backdated && <Badge variant="peach">BACKDATED</Badge>}
          {item.flags?.incomplete && <Badge variant="peach">INCOMPLETE</Badge>}
          {item.flags?.junk && <Badge variant="destructive">QA/JUNK</Badge>}
          {item.termsStatus && <Badge variant="outline">{item.termsStatus}</Badge>}
          {item.paymentMode && <Badge variant="outline">{item.paymentMode}</Badge>}
        </div>

        {active && (
          <div className="mt-3 space-y-3 border-t border-dash-fg/10 pt-3">
            {actions.includes("details") && <ApprovalDetails item={item} />}
            <div className="flex flex-wrap gap-2">
              {actions.includes("approve") && (
                <Button size="sm" variant="outline" className="border-emerald-400/40 text-emerald-300 hover:bg-emerald-400/10" loading={busy} onClick={() => onAction("approve")}>
                  Approve
                </Button>
              )}
              {actions.includes("merge") && (
                <Button size="sm" variant="outline" className="border-emerald-400/40 text-emerald-300 hover:bg-emerald-400/10" loading={busy} onClick={() => onAction("merge")}>
                  Approve
                </Button>
              )}
              {actions.includes("finalise") && (
                <Button size="sm" variant="outline" className="border-emerald-400/40 text-emerald-300 hover:bg-emerald-400/10" loading={busy} onClick={() => onAction("finalise")}>
                  Issue invoice
                </Button>
              )}
              {actions.includes("void") && (
                <Button size="sm" variant="outline" className="border-red-400/40 text-red-300 hover:bg-red-400/10" loading={busy} onClick={() => onAction("void")}>
                  Void receipt
                </Button>
              )}
              {actions.includes("reject") && (
                <Button size="sm" variant="ghost" className="text-dash-fg/60 hover:bg-dash-fg/[0.05] hover:text-red-300" loading={busy} onClick={() => onAction("reject")}>
                  Reject
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface DetailFields {
  fields?: Record<string, unknown>;
}

function ApprovalDetails({ item }: { item: ApprovalItem }) {
  const { data, isFetching, error } = useRpc<DetailFields>("api_founder_approvalItemDetail", { type: item.type, itemId: item.itemId });
  const fields = data?.fields ?? {};

  return (
    <div className="rounded-xl border border-dash-fg/10 bg-dash-fg/[0.02] p-3">
      {isFetching ? (
        <Skeleton className="h-10 bg-dash-fg/[0.05]" />
      ) : error ? (
        <p className="text-xs text-red-300">{error.message}</p>
      ) : Object.keys(fields).length === 0 ? (
        <p className="text-xs text-dash-fg/45">No further detail stored for this record.</p>
      ) : (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {Object.entries(fields).map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] uppercase tracking-[0.1em] text-dash-fg/35">{pretty(k)}</dt>
              <dd className="break-words text-xs text-dash-fg/80">{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function WriteExecute({ fn, arg, onDone, onError }: { fn: string; arg: RpcArg; onDone: () => void; onError: (err: RpcError) => void }) {
  const m = useMutationRpc<RpcArg, RpcEnvelope>(fn, { onSuccess: onDone, onError });
  React.useEffect(() => {
    m.mutate(arg);
    // runs once per mount; parent remounts via `key` for every new write
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function Tabs({ tabs, active, onChange }: { tabs: { label: string; key: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
            active === t.key
              ? "border-dash-accent/50 bg-dash-accent/15 text-dash-accent"
              : "border-dash-fg/10 text-dash-fg/60 hover:bg-dash-fg/[0.05] hover:text-dash-fg",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function ConfirmDialog({
  state,
  setState,
  onConfirm,
}: {
  state: ConfirmState | null;
  setState: (s: ConfirmState | null) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={!!state} onOpenChange={(v) => !v && setState(null)}>
      <DialogContent className="border-dash-fg/12 bg-dash-card text-dash-fg">
        <DialogHeader>
          <DialogTitle className="text-dash-fg">{state?.money ? "Approve — money operation" : "Confirm"}</DialogTitle>
          <DialogDescription className="text-dash-fg/55">{state?.message ?? "Continue?"}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setState(null)} className="text-dash-fg/70 hover:bg-dash-fg/[0.05]">
            Cancel
          </Button>
          <Button className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover" onClick={onConfirm}>
            Yes, proceed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({
  item,
  setItem,
  onReject,
}: {
  item: ApprovalItem | null;
  setItem: (i: ApprovalItem | null) => void;
  onReject: (reason: string) => void;
}) {
  const [reason, setReason] = React.useState("");
  React.useEffect(() => setReason(""), [item]);
  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && setItem(null)}>
      <DialogContent className="border-dash-fg/12 bg-dash-card text-dash-fg">
        <DialogHeader>
          <DialogTitle className="text-dash-fg">Reject {item?.itemId}</DialogTitle>
          <DialogDescription className="text-dash-fg/55">A reason is required and is audited.</DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this being rejected?"
          className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setItem(null)} className="text-dash-fg/70 hover:bg-dash-fg/[0.05]">
            Cancel
          </Button>
          <Button variant="destructive" disabled={reason.trim().length === 0} onClick={() => onReject(reason.trim())}>
            <XCircle className="h-4 w-4" /> Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  if (s === "REJECTED" || s === "VOID") return <Badge variant="destructive">{status}</Badge>;
  if (s.includes("REPAIR")) return <Badge variant="destructive">{status}</Badge>;
  if (s === "APPROVED" || s === "FINALISED") return <Badge variant="mint">{status}</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function pretty(k: string) {
  return k
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function actionCmd(item: ApprovalItem, action: string): Cmd | null {
  const id = item.itemId;
  if (action === "approve") {
    switch (item.type) {
      case "EXPENSE_DRAFT":
        return { key: `${id}-approve`, fn: "api_founder_expenseDraftApprove", arg: { draftId: id }, label: "Expense approved" };
      case "PACKAGE_EXTENSION":
        return { key: `${id}-approve`, fn: "api_founder_packageExtensionApprove", arg: { requestId: id }, label: "Approved" };
      case "PAYMENT_PROFILE_CHANGE":
        return { key: `${id}-approve`, fn: "api_founder_paymentProfileChangeApprove", arg: { requestId: id }, label: "Approved" };
      case "CLOSURE":
        return { key: `${id}-approve`, fn: "api_founder_authoriseClosure", arg: { closureId: id }, label: "Authorised" };
      case "CLASS_CORRECTION":
        return { key: `${id}-approve`, fn: "api_founder_approveClassCorrection", arg: { correctionId: id }, label: "Approved" };
      case "LATE_FEE_WAIVER":
        return { key: `${id}-approve`, fn: "api_founder_lateFeeWaiverApprove", arg: { requestId: id }, label: "Approved" };
      case "INSTALMENT_PLAN":
        return { key: `${id}-approve`, fn: "api_founder_instalmentPlanDraftApprove", arg: { draftId: id }, label: "Approved" };
      case "MANUAL_TERMS_ACCEPTANCE":
        return { key: `${id}-approve`, fn: "api_founder_manualTermsAcceptanceApprove", arg: { requestId: id }, label: "Approved" };
      case "TEACHER_ADD_REQUEST":
      case "TEACHER_EDIT_REQUEST":
        return { key: `${id}-approve`, fn: "api_founder_addTeacherRequestApprove", arg: { requestId: id }, label: "Approved" };
      default:
        return { key: `${id}-approve`, fn: "api_founder_paymentDraftApprove", arg: { draftId: id }, label: "Approved" };
    }
  }
  if (action === "merge") return { key: `${id}-merge`, fn: "api_founder_mergeStudentDraft", arg: { draftId: id }, label: "Student merged" };
  if (action === "void") return { key: `${id}-void`, fn: "api_founder_voidReceipt", arg: { correctionId: id }, label: "Receipt voided" };
  if (action === "finalise") return { key: `${id}-finalise`, fn: "api_founder_finaliseSchoolInvoiceDraft", arg: { draftId: id }, label: "Invoice issued" };
  return null;
}

function rejectCmd(item: ApprovalItem, reason: string): Cmd {
  const id = item.itemId;
  switch (item.type) {
    case "STUDENT_DRAFT":
      return { key: `${id}-reject`, fn: "api_founder_studentDraftReject", arg: { draftId: id, reason }, label: "Rejected" };
    case "EXPENSE_DRAFT":
      return { key: `${id}-reject`, fn: "api_founder_expenseDraftReject", arg: { draftId: id, reason }, label: "Rejected" };
    case "RECEIPT_CORRECTION":
      return { key: `${id}-reject`, fn: "api_founder_correctionReject", arg: { correctionId: id, reason }, label: "Rejected" };
    case "SCHOOL_INVOICE_DRAFT":
      return { key: `${id}-reject`, fn: "api_founder_schoolInvoiceDraftReject", arg: { draftId: id, reason }, label: "Rejected" };
    case "PACKAGE_EXTENSION":
      return { key: `${id}-reject`, fn: "api_founder_packageExtensionReject", arg: { requestId: id, reason }, label: "Rejected" };
    case "PAYMENT_PROFILE_CHANGE":
      return { key: `${id}-reject`, fn: "api_founder_paymentProfileChangeReject", arg: { requestId: id, reason }, label: "Rejected" };
    case "CLOSURE":
      return { key: `${id}-reject`, fn: "api_founder_closureReject", arg: { closureId: id, reason }, label: "Rejected" };
    case "CLASS_CORRECTION":
      return { key: `${id}-reject`, fn: "api_founder_rejectClassCorrection", arg: { correctionId: id, reason }, label: "Rejected" };
    case "LATE_FEE_WAIVER":
      return { key: `${id}-reject`, fn: "api_founder_lateFeeWaiverReject", arg: { requestId: id, reason }, label: "Rejected" };
    case "INSTALMENT_PLAN":
      return { key: `${id}-reject`, fn: "api_founder_instalmentPlanDraftReject", arg: { draftId: id, reason }, label: "Rejected" };
    case "MANUAL_TERMS_ACCEPTANCE":
      return { key: `${id}-reject`, fn: "api_founder_manualTermsAcceptanceReject", arg: { requestId: id, reason }, label: "Rejected" };
    case "TEACHER_ADD_REQUEST":
    case "TEACHER_EDIT_REQUEST":
      return { key: `${id}-reject`, fn: "api_founder_addTeacherRequestReject", arg: { requestId: id, reason }, label: "Rejected" };
    default:
      return { key: `${id}-reject`, fn: "api_founder_paymentDraftReject", arg: { draftId: id, comment: reason }, label: "Rejected" };
  }
}

function confirmMessage(item: ApprovalItem, action: string): string {
  const what = item.entity || item.itemId;
  switch (action) {
    case "finalise":
      return `Allocate the next SMI- number and issue "${what}" for ₹${item.amount ?? ""}?`;
    case "void":
      return `Void ${item.receiptNo || item.itemId} permanently? It stays excluded from every total; a new payment issues a new receipt. This cannot be undone.`;
    case "merge":
      return `Approve this change for "${what}"?`;
    case "approve":
      if (item.type === "EXPENSE_DRAFT") return `Record "${item.reason}" as a real expense and post it to the cashbook?`;
      return `Approve ${what}?`;
    default:
      return "Continue?";
  }
}