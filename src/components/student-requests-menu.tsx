"use client";

import * as React from "react";
import { ChevronDown, Clock3, FileSignature, Gift, PauseCircle, PlayCircle, Receipt } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutationRpc, useRpc } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope } from "@/lib/api/rpc-types";

interface DraftRes extends RpcEnvelope {
  note?: string;
}

interface TermsStatusRes extends RpcEnvelope {
  tokens?: { token: string; status: string; url: string; expiresAt: string; issuedAt?: string }[];
  manualRequests?: { id: string; status: string; reason: string; submittedAt?: string }[];
}

interface AccruedLateFeeRes extends RpcEnvelope {
  studentId?: string;
  amount?: number;
  daysLate?: number;
  overdueSince?: string;
}

function termsUrl(t: { token: string; url: string }): string {
  if (t.url) return t.url;
  if (typeof window !== "undefined") return `${window.location.origin}/terms/${t.token}`;
  return `/terms/${t.token}`;
}

type Kind = "PAUSE" | "WAIVER" | "EXTENSION" | "INSTALMENT" | "TERMS" | null;

/**
 * Staff-only "propose a change" menu — every one of these already has a
 * founder-approve/reject RPC wired into the Approvals page; this is just
 * the missing submission UI (the Flutter app already has all five as
 * separate screens).
 */
export function StudentRequestsMenu({
  studentId,
  studentName,
  studentStatus,
}: {
  studentId: string;
  studentName: string;
  studentStatus: string;
}) {
  const [open, setOpen] = React.useState<Kind>(null);
  const isPaused = (studentStatus ?? "").toUpperCase() === "PAUSED";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]">
            More requests <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="border-dash-fg/10 bg-dash-card text-dash-fg">
          <DropdownMenuItem onClick={() => setOpen("PAUSE")}>
            {isPaused ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
            {isPaused ? "Request resume" : "Request pause"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpen("WAIVER")}>
            <Gift className="h-4 w-4" /> Late fee waiver
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpen("EXTENSION")}>
            <Clock3 className="h-4 w-4" /> Package extension
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpen("INSTALMENT")}>
            <Receipt className="h-4 w-4" /> Instalment plan
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpen("TERMS")}>
            <FileSignature className="h-4 w-4" /> Terms acceptance link
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PauseDialog open={open === "PAUSE"} onClose={() => setOpen(null)} studentId={studentId} studentName={studentName} isPaused={isPaused} />
      <WaiverDialog open={open === "WAIVER"} onClose={() => setOpen(null)} studentId={studentId} studentName={studentName} />
      <ExtensionDialog open={open === "EXTENSION"} onClose={() => setOpen(null)} studentId={studentId} studentName={studentName} />
      <InstalmentDialog open={open === "INSTALMENT"} onClose={() => setOpen(null)} studentId={studentId} studentName={studentName} />
      <TermsDialog open={open === "TERMS"} onClose={() => setOpen(null)} studentId={studentId} studentName={studentName} />
    </>
  );
}

function PauseDialog({
  open,
  onClose,
  studentId,
  studentName,
  isPaused,
}: {
  open: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  isPaused: boolean;
}) {
  const [reason, setReason] = React.useState("");
  const intentRef = React.useRef(`SDRAFT-${Date.now()}`);
  const mut = useMutationRpc<{ studentId: string; lifecycleStatus: string; statusReason: string; clientIntentKey: string }, DraftRes>(
    "api_staff_saveStudentDraft",
    {
      onSuccess: (res) => {
        toast.success(res.note ?? "Sent for approval.");
        onClose();
        setReason("");
        intentRef.current = `SDRAFT-${Date.now()}`;
      },
      onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not send the request."),
    },
  );
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="border-dash-fg/10 bg-dash-card text-dash-fg">
        <DialogHeader>
          <DialogTitle className="text-dash-fg">{isPaused ? "Request resume" : "Request pause"} for {studentName}</DialogTitle>
          <DialogDescription className="text-dash-fg/50">
            {isPaused
              ? "This membership is currently paused. Request resuming it — the founder decides."
              : "For genuine leave (illness, travel, exams). The membership stays on record, not cancelled — the founder decides."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label className="text-[13px] text-dash-fg/70">Reason *</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="border-dash-fg/10 bg-dash-surface text-dash-fg" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!reason.trim()}
            loading={mut.isPending}
            onClick={() =>
              mut.mutate({
                studentId,
                lifecycleStatus: isPaused ? "ACTIVE" : "PAUSED",
                statusReason: reason.trim(),
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
  );
}

function WaiverDialog({
  open,
  onClose,
  studentId,
  studentName,
}: {
  open: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
}) {
  const [reason, setReason] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const intentRef = React.useRef(`WAIVER-${Date.now()}`);

  // Read-only preview of the real computed accrued late fee, so the amount
  // field's placeholder shows the actual figure before staff submit — a
  // blank amount still waives this computed figure server-side, it's just
  // no longer a guess.
  const preview = useRpc<AccruedLateFeeRes>("api_previewAccruedLateFee", { studentId }, { enabled: open && !!studentId });
  const computed = preview.data?.ok ? preview.data.amount : undefined;

  const mut = useMutationRpc<{ studentId: string; reason: string; waivedAmount?: number; clientIntentKey: string }, DraftRes>(
    "api_staff_submitLateFeeWaiverRequest",
    {
      onSuccess: (res) => {
        toast.success(res.note ?? "Sent for approval.");
        onClose();
        setReason("");
        setAmount("");
        intentRef.current = `WAIVER-${Date.now()}`;
      },
      onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not send the request."),
    },
  );
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="border-dash-fg/10 bg-dash-card text-dash-fg">
        <DialogHeader>
          <DialogTitle className="text-dash-fg">Late fee waiver for {studentName}</DialogTitle>
          <DialogDescription className="text-dash-fg/50">Sent for approval — the founder decides.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Amount to waive (optional)</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={computed != null ? `Computed: ₹${computed} — leave blank to waive this amount` : undefined}
              className="border-dash-fg/10 bg-dash-surface text-dash-fg placeholder:text-dash-fg/35"
            />
            {preview.isFetching ? (
              <p className="text-xs text-dash-fg/40">Computing the accrued late fee…</p>
            ) : computed != null ? (
              <p className="text-xs text-dash-fg/45">
                Computed accrued late fee: ₹{computed}
                {preview.data?.daysLate ? ` · ${preview.data.daysLate} day${preview.data.daysLate === 1 ? "" : "s"} late` : ""}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Reason *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="border-dash-fg/10 bg-dash-surface text-dash-fg" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!reason.trim()}
            loading={mut.isPending}
            onClick={() =>
              mut.mutate({
                studentId,
                reason: reason.trim(),
                waivedAmount: amount ? Number(amount) : undefined,
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
  );
}

function ExtensionDialog({
  open,
  onClose,
  studentId,
  studentName,
}: {
  open: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
}) {
  const [months, setMonths] = React.useState("1");
  const [reason, setReason] = React.useState("");
  const intentRef = React.useRef(`PKGEXT-${Date.now()}`);
  const mut = useMutationRpc<{ studentId: string; extraMonths: number; reason: string; clientIntentKey: string }, DraftRes>(
    "api_staff_submitPackageExtensionRequest",
    {
      onSuccess: (res) => {
        toast.success(res.note ?? "Sent for approval.");
        onClose();
        setReason("");
        setMonths("1");
        intentRef.current = `PKGEXT-${Date.now()}`;
      },
      onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not send the request."),
    },
  );
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="border-dash-fg/10 bg-dash-card text-dash-fg">
        <DialogHeader>
          <DialogTitle className="text-dash-fg">Package extension for {studentName}</DialogTitle>
          <DialogDescription className="text-dash-fg/50">Sent for approval — the founder decides.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Extra months (1-24) *</Label>
            <Input type="number" min={1} max={24} value={months} onChange={(e) => setMonths(e.target.value)} className="border-dash-fg/10 bg-dash-surface text-dash-fg" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Reason *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="border-dash-fg/10 bg-dash-surface text-dash-fg" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!reason.trim() || !(Number(months) > 0)}
            loading={mut.isPending}
            onClick={() => mut.mutate({ studentId, extraMonths: Number(months), reason: reason.trim(), clientIntentKey: intentRef.current })}
            className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
          >
            Send for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InstalmentDialog({
  open,
  onClose,
  studentId,
  studentName,
}: {
  open: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
}) {
  const [total, setTotal] = React.useState("");
  const [count, setCount] = React.useState("2");
  const [firstDue, setFirstDue] = React.useState("");
  const intentRef = React.useRef(`INSTPLAN-${Date.now()}`);
  const mut = useMutationRpc<
    { studentId: string; totalAmount: number; instalmentCount: number; firstDueDate: string; clientIntentKey: string },
    DraftRes
  >("api_staff_submitInstalmentPlanDraft", {
    onSuccess: (res) => {
      toast.success(res.note ?? "Sent for approval.");
      onClose();
      setTotal("");
      setCount("2");
      setFirstDue("");
      intentRef.current = `INSTPLAN-${Date.now()}`;
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not send the request."),
  });
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="border-dash-fg/10 bg-dash-card text-dash-fg">
        <DialogHeader>
          <DialogTitle className="text-dash-fg">Instalment plan for {studentName}</DialogTitle>
          <DialogDescription className="text-dash-fg/50">Sent for approval — the founder decides.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-[13px] text-dash-fg/70">Total amount *</Label>
            <Input type="number" value={total} onChange={(e) => setTotal(e.target.value)} className="border-dash-fg/10 bg-dash-surface text-dash-fg" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Instalments (2-12) *</Label>
            <Input type="number" min={2} max={12} value={count} onChange={(e) => setCount(e.target.value)} className="border-dash-fg/10 bg-dash-surface text-dash-fg" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">First due date *</Label>
            <Input type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} className="border-dash-fg/10 bg-dash-surface text-dash-fg" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!(Number(total) > 0) || !firstDue}
            loading={mut.isPending}
            onClick={() =>
              mut.mutate({
                studentId,
                totalAmount: Number(total),
                instalmentCount: Number(count),
                firstDueDate: firstDue,
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
  );
}

/** Standalone terms-link button — usable on its own (e.g. founder profile), not gated behind the staff request menu. */
export function TermsLinkButton({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" variant="outline" className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]" onClick={() => setOpen(true)}>
        <FileSignature className="h-3.5 w-3.5" aria-hidden /> Terms link
      </Button>
      <TermsDialog open={open} onClose={() => setOpen(false)} studentId={studentId} studentName={studentName} />
    </>
  );
}

function TermsDialog({
  open,
  onClose,
  studentId,
  studentName,
}: {
  open: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
}) {
  const status = useRpc<TermsStatusRes>(
    "api_termsStatusForStudent",
    { studentId },
    { enabled: open },
  );
  const openToken = status.data?.tokens?.find((t) => t.status === "OPEN");

  const [freshUrl, setFreshUrl] = React.useState("");
  const [note, setNote] = React.useState("");
  const [manualReason, setManualReason] = React.useState("");
  const [showManual, setShowManual] = React.useState(false);

  // Staff can force a brand new link (the old one may have expired or been
  // shared to the wrong parent). Without this the dialog is read-only.
  const mint = useMutationRpc<{ studentId: string }, DraftRes & { url?: string }>(
    "api_staff_generateTermsToken",
    {
      onSuccess: (res) => {
        setFreshUrl(res.url ?? "");
        setNote(res.note ?? "Fresh link ready.");
        toast.success("Fresh terms link ready.");
      },
      onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not generate a link."),
    },
  );

  // The only route to a MANUAL_TERMS_ACCEPTANCE approval item. Never a tick
  // box — the founder decides.
  const manual = useMutationRpc<
    { studentId: string; reason: string; clientIntentKey: string },
    DraftRes
  >("api_staff_requestManualTermsAcceptance", {
    onSuccess: (res) => {
      toast.success(res.note ?? "Sent for approval.");
      setShowManual(false);
      setManualReason("");
      status.refetch();
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not send the request."),
  });

  const shareUrl = openToken ? termsUrl(openToken) : freshUrl;

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
    } catch {
      toast.error("Could not copy — select and copy manually.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-dash-fg/10 bg-dash-card text-dash-fg">
        <DialogHeader>
          <DialogTitle className="text-dash-fg">Terms acceptance for {studentName}</DialogTitle>
          <DialogDescription className="text-dash-fg/50">
            A link is minted automatically the moment this student needs one. Share it with the parent.
          </DialogDescription>
        </DialogHeader>

        {status.isPending ? (
          <p className="text-sm text-dash-fg/50">Loading…</p>
        ) : shareUrl ? (
          <div className="space-y-2">
            <p className="break-all rounded-xl border border-dash-fg/10 bg-dash-surface p-3 text-xs text-dash-fg/80">{shareUrl}</p>
            <Button variant="outline" onClick={() => copy(shareUrl)} className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]">
              Copy link
            </Button>
          </div>
        ) : (
          <p className="text-sm text-dash-fg/50">
            {status.data?.tokens?.length
              ? "Terms are already accepted or this student is not eligible for a new link right now."
              : "No link available yet — generate one below."}
          </p>
        )}

        {note && <p className="text-xs text-dash-fg/50">{note}</p>}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            loading={mint.isPending}
            onClick={() => mint.mutate({ studentId })}
            className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]"
          >
            {openToken ? "Send a fresh link" : "Generate parent link"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowManual((v) => !v)}
            className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]"
          >
            Request manual acceptance
          </Button>
        </div>

        {showManual && (
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">How did the parent accept? *</Label>
            <Textarea
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
              placeholder="e.g. Read the printed copy at the desk and signed it."
              className="border-dash-fg/10 bg-dash-surface text-dash-fg placeholder:text-dash-fg/35"
            />
            <Button
              disabled={!manualReason.trim()}
              loading={manual.isPending}
              onClick={() =>
                manual.mutate({
                  studentId,
                  reason: manualReason.trim(),
                  clientIntentKey: `MTERMS-${Date.now()}`,
                })
              }
              className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
            >
              Send for approval
            </Button>
          </div>
        )}

        {!!status.data?.manualRequests?.length && (
          <div className="space-y-1 border-t border-dash-fg/10 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-dash-fg/40">Manual requests</p>
            {status.data.manualRequests.map((m, i) => (
              <p key={i} className="text-xs text-dash-fg/60">
                {m.status} · {m.reason}
              </p>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
