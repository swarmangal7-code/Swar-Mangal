"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, FileText, Share2, Trash2, TriangleAlert } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoicePreview } from "@/components/founder/invoice-preview";
import { API_ORIGIN } from "@/lib/api/rpc-client";
import { useMutationRpc, useRpc } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope, SchoolInvoiceResponse } from "@/lib/api/rpc-types";
import { useTokenAuth } from "@/lib/auth/token-auth";

interface VoidInvoiceResponse extends RpcEnvelope {
  invoiceNo?: string;
  note?: string;
}

interface DeleteInvoiceResponse extends RpcEnvelope {
  invoiceNo?: string;
  note?: string;
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const fmtDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * One stored invoice snapshot, read-only. Shared by the founder and staff
 * routes so both roles get the same view — issuing is immutable, so nothing
 * here re-renders from the student's current profile.
 */
export function InvoiceDetail({ invoiceId, backHref }: { invoiceId: string; backHref: string }) {
  const invoiceQ = useRpc<SchoolInvoiceResponse>(
    "api_getSchoolInvoice",
    { invoiceId },
    { enabled: invoiceId.length > 0 },
  );

  const invoice = invoiceQ.data?.invoice;
  const { token, session } = useTokenAuth();
  const isFounder = session?.role === "FOUNDER_ADMIN";
  const isVoid = (invoice?.status ?? "").toUpperCase() === "VOID";
  const router = useRouter();

  const [voidOpen, setVoidOpen] = React.useState(false);
  const [voidReason, setVoidReason] = React.useState("");
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteReason, setDeleteReason] = React.useState("");

  const voidInvoice = useMutationRpc<{ invoiceId: string; reason: string }, VoidInvoiceResponse>("api_founder_voidSchoolInvoice", {
    onSuccess: (res) => {
      toast.success(res.note ?? `${res.invoiceNo ?? invoiceId} voided.`);
      setVoidOpen(false);
      setVoidReason("");
      invoiceQ.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteInvoice = useMutationRpc<{ invoiceId: string; reason: string }, DeleteInvoiceResponse>("api_founder_deleteSchoolInvoice", {
    onSuccess: (res) => {
      toast.success(res.note ?? `${res.invoiceNo ?? invoiceId} deleted.`);
      router.push(backHref);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleDownload = () => {
    if (!invoice) return;
    window.open(`${API_ORIGIN}/api/pdf/invoice/${encodeURIComponent(invoiceId)}?token=${encodeURIComponent(token)}`, "_blank", "noopener,noreferrer");
  };

  const handleShare = async () => {
    if (!invoice) return;
    const text = `Invoice ${invoice.invoiceNo} · ${invoice.className} · ${inr.format(Number(invoice.total ?? invoice.amount) || 0)}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `School invoice ${invoice.invoiceNo}`, text });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Invoice summary copied.");
    } catch {
      toast.error("Could not share the invoice.");
    }
  };

  const back = (
    <Link
      href={backHref}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-dash-fg/50 transition-colors hover:text-dash-accent"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      School invoices
    </Link>
  );

  if (invoiceQ.isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-40 bg-dash-fg/[0.05]" />
        <Skeleton className="h-28 w-full bg-dash-fg/[0.05]" />
        <Skeleton className="h-80 w-full bg-dash-fg/[0.05]" />
      </div>
    );
  }

  if (invoiceQ.isError || !invoice) {
    return (
      <div className="space-y-4">
        {back}
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
          <p className="text-sm font-medium text-red-300">Could not load this invoice.</p>
          <p className="mt-1 text-sm text-dash-fg/55">
            {invoiceQ.error instanceof Error ? invoiceQ.error.message : "The invoice may no longer exist."}
          </p>
          <Button
            variant="outline"
            onClick={() => invoiceQ.refetch()}
            className="mt-4 border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {back}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-dash-fg/40">School invoice</p>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="font-mono text-2xl font-semibold tracking-tight text-dash-fg">{invoice.invoiceNo}</h1>
            {isVoid && <Badge variant="destructive">VOID</Badge>}
          </div>
          <p className="mt-1 text-sm text-dash-fg/55">
            {invoice.schoolName || invoice.className || "—"} · {invoice.branch}
            {invoice.invoiceDate ? ` · ${fmtDate.format(new Date(invoice.invoiceDate))}` : ""}
          </p>
          {isVoid && invoice.voidReason && (
            <p className="mt-1 text-xs text-red-400/80">Void reason: {invoice.voidReason}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={handleDownload}
            className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]"
          >
            <Download className="h-4 w-4" aria-hidden />
            Download
          </Button>
          <Button onClick={handleShare} className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover">
            <Share2 className="h-4 w-4" aria-hidden />
            Share
          </Button>
          {isFounder && (
            <Button variant="destructive" disabled={isVoid} onClick={() => setVoidOpen(true)}>
              <TriangleAlert className="h-4 w-4" aria-hidden />
              {isVoid ? "Voided" : "Void"}
            </Button>
          )}
          {isFounder && (
            <Button
              variant="outline"
              className="border-red-500/40 text-red-400 hover:bg-red-500/10"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete permanently
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.03] p-5">
          <p className="text-xs text-dash-fg/45">{invoice.charges?.length ? "Total due" : "Amount"}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-dash-fg">
            {inr.format(Number(invoice.total ?? invoice.amount) || 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.03] p-5">
          <p className="text-xs text-dash-fg/45">Tenure</p>
          <p className="mt-2 text-lg font-semibold text-dash-fg">{invoice.tenure || "—"}</p>
        </div>
        <div className="rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.03] p-5">
          <p className="text-xs text-dash-fg/45">Branch</p>
          <p className="mt-2 text-lg font-semibold text-dash-fg">{invoice.branch || "—"}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.03] p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-dash-fg/80">
          <FileText className="h-4 w-4 text-dash-accent" aria-hidden />
          Owner signatures
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <OwnerCard owner={invoice.owner1} />
          <OwnerCard owner={invoice.owner2} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-dash-fg/80">Invoice preview</h2>
        <InvoicePreview
          invoiceNo={invoice.invoiceNo}
          invoiceDate={invoice.invoiceDate}
          billingPeriodFrom={invoice.billingPeriodFrom}
          billingPeriodTo={invoice.billingPeriodTo}
          className={invoice.className}
          amount={Number(invoice.amount) || 0}
          tenure={invoice.tenure}
          branch={invoice.branch}
          schoolCode={invoice.schoolCode ?? ""}
          schoolName={invoice.schoolName ?? ""}
          schoolAddress={invoice.schoolAddress ?? ""}
          schoolContact={invoice.schoolContact ?? ""}
          charges={invoice.charges ?? []}
          owner1={invoice.owner1}
          owner2={invoice.owner2}
        />
      </div>
      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent className="border-dash-fg/12 bg-dash-card text-dash-fg">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Void {invoice.invoiceNo}?</DialogTitle>
            <DialogDescription className="text-dash-fg/55">
              Voiding keeps the invoice and its number on record but excludes it from every total — use this for an
              invoice that was actually sent to the school. If it was never sent (a test or duplicate) and you need
              its number free again, delete it permanently instead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-dash-fg/70">Reason (required)</Label>
            <Textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="e.g. wrong amount, wrong school, duplicate"
              className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setVoidOpen(false)} className="text-dash-fg/70 hover:bg-dash-fg/[0.05]">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!voidReason.trim()}
              loading={voidInvoice.isPending}
              onClick={() => voidInvoice.mutate({ invoiceId, reason: voidReason.trim() })}
            >
              Yes, void invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="border-dash-fg/12 bg-dash-card text-dash-fg">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Delete {invoice.invoiceNo} permanently?</DialogTitle>
            <DialogDescription className="text-dash-fg/55">
              This removes the invoice and its charges from the database entirely — its number becomes free to use
              again. There is no undo. Use this only for a test or duplicate invoice that was never actually sent to
              the school; for a real invoice that needs correcting, void it instead and raise a fresh one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-dash-fg/70">Reason (required, kept in the audit log)</Label>
            <Textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="e.g. test invoice, raised by mistake"
              className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} className="text-dash-fg/70 hover:bg-dash-fg/[0.05]">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!deleteReason.trim()}
              loading={deleteInvoice.isPending}
              onClick={() => deleteInvoice.mutate({ invoiceId, reason: deleteReason.trim() })}
            >
              Yes, delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OwnerCard({ owner }: { owner?: { name: string; title: string; signatureUrl: string } }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dash-fg/10 bg-dash-fg/[0.02] p-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-dash-accent/25 bg-dash-accent/10 font-display text-lg text-dash-accent">
        {owner?.name?.charAt(0)?.toUpperCase() ?? "—"}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-dash-fg">{owner?.name ?? "—"}</p>
        <p className="text-xs text-dash-fg/45">{owner?.title ?? "Signature"}</p>
      </div>
    </div>
  );
}
