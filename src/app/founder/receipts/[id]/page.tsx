"use client";

export const runtime = "edge";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, MessageCircle, Printer, ReceiptText, TriangleAlert } from "lucide-react";
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
import { useMutationRpc, useReceipts } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope } from "@/lib/api/rpc-types";
import { fadeUp, listVariants } from "@/lib/motion";
import { fmtDate, inr, todayISO } from "@/lib/utils/cn";

interface VoidResponse extends RpcEnvelope {
  receiptNo?: string;
  note?: string;
}

interface SendDocResponse extends RpcEnvelope {
  message?: { status?: string };
  note?: string;
}

async function fileToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch PDF (HTTP ${res.status}).`);
  const buf = await res.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export default function FounderReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const receiptNo = decodeURIComponent(id);

  const { data, isFetching, error, refetch } = useReceipts({ receiptNo, limit: 5 });
  const rows = data?.results ?? data?.rows ?? [];
  const receipt = rows.find((r) => r.receiptNo === receiptNo) ?? rows[0];

  const [voidOpen, setVoidOpen] = React.useState(false);

  const voidReceipt = useMutationRpc<{ receiptNo: string }, VoidResponse>("api_founder_voidReceipt", {
    onSuccess: (res) => {
      toast.success(`Receipt ${res.receiptNo ?? receiptNo} voided`);
      setVoidOpen(false);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const sendDoc = useMutationRpc<SendDocArg, SendDocResponse>("api_staff_sendWhatsAppDocument", {
    onSuccess: () => toast.success("Receipt sent on WhatsApp"),
    onError: (err) => toast.error(err.message),
  });

  const intentKey = React.useRef(`WA-${receiptNo}-${todayISO()}`).current;

  if (isFetching && !receipt && !error) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64 bg-dash-fg/[0.05]" />
        <Skeleton className="h-40 w-full bg-dash-fg/[0.04]" />
        <Skeleton className="h-40 w-full bg-dash-fg/[0.04]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-6 text-sm text-red-300">
        {error.message}
      </div>
    );
  }

  if (!receipt) {
    return (
      <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-4">
        <BackLink />
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-dash-fg/15 bg-dash-fg/[0.02] px-6 py-14 text-center">
          <ReceiptText className="mb-3 h-9 w-9 text-dash-fg/20" aria-hidden />
          <p className="text-sm font-medium text-dash-fg/70">Receipt not found</p>
          <p className="mt-1 text-xs text-dash-fg/40">No receipt matches {receiptNo}.</p>
        </div>
      </motion.div>
    );
  }

  const isVoid = (receipt.status ?? "").toUpperCase() === "VOID";
  const studentName = receipt.studentName || receipt.student || "—";
  const canWhatsApp = !!receipt.pdfUrl && !!receipt.studentId && (receipt.pdfUrl.startsWith("/") || receipt.pdfUrl.startsWith(window.location.origin));
  const amount = receipt.amount;

  const sendWhatsApp = async () => {
    if (!receipt.pdfUrl || !receipt.studentId) return;
    toast.loading("Preparing receipt PDF…");
    try {
      const fileBase64 = await fileToBase64(receipt.pdfUrl);
      toast.dismiss();
      sendDoc.mutate({
        studentId: receipt.studentId,
        kind: "RECEIPT",
        fileName: `receipt-${receiptNo}.pdf`,
        fileBase64,
        mimeType: "application/pdf",
        caption: `Swar Mangal receipt ${receiptNo}`,
        clientIntentKey: intentKey,
      });
    } catch (e) {
      toast.dismiss();
      toast.error(e instanceof Error ? e.message : "Could not prepare the PDF.");
    }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-6">
      <motion.div variants={fadeUp}>
        <BackLink />
      </motion.div>

      <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-dash-fg/40">Money · Receipt</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">{receiptNo}</h1>
          <p className="mt-1 text-sm text-dash-fg/55">{fmtDate(receipt.date)}</p>
        </div>
        <StatusBadge status={receipt.status} />
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card className="border-dash-fg/10 bg-dash-card">
            <CardContent className="space-y-5 pt-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-dash-fg/35">Student</p>
                <p className="mt-1 text-base font-semibold text-dash-fg">{studentName}</p>
                <p className="text-xs text-dash-fg/45">{receipt.studentId || receipt.entityId || ""}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-dash-fg/10 pt-4 text-sm sm:grid-cols-3">
                <Detail label="Amount" value={inr(amount)} />
                <Detail label="Mode" value={receipt.mode || receipt.paymentMode || "—"} />
                <Detail label="Reference" value={receipt.txnId || "—"} />
                <Detail label="Fee from" value={fmtDate(receipt.feePeriodFrom)} />
                <Detail label="Fee to" value={fmtDate(receipt.feePeriodTo)} />
                <Detail label="Status" value={isVoid ? "VOID" : "ACTIVE"} />
              </div>
              {isVoid && receipt.voidReason ? (
                <p className="rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-xs text-red-300">
                  Void reason: {receipt.voidReason}
                </p>
              ) : null}
            </CardContent>
          </Card>

          {!isVoid && (
            <Card className="border-dash-fg/10 bg-dash-card">
              <CardContent className="space-y-3 pt-5">
                <div className="flex flex-wrap gap-2">
                  {receipt.pdfUrl && (
                    <Button
                      asChild
                      variant="outline"
                      className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]"
                    >
                      <a href={receipt.pdfUrl} target="_blank" rel="noreferrer">
                        <Printer className="h-4 w-4" /> Print PDF
                      </a>
                    </Button>
                  )}
                  {canWhatsApp && (
                    <Button
                      variant="outline"
                      onClick={sendWhatsApp}
                      loading={sendDoc.isPending}
                      className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]"
                    >
                      <MessageCircle className="h-4 w-4" /> Send on WhatsApp
                    </Button>
                  )}
                </div>
                <p className="text-xs text-dash-fg/40">
                  Send the receipt PDF to the student&apos;s registered WhatsApp number. One message per receipt per day.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          <Card className="border-dash-fg/10 bg-dash-card">
            <CardContent className="space-y-4 pt-5">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-dash-fg/35">Founder action</p>
                <p className="mt-1 text-sm text-dash-fg/55">
                  Voiding keeps the receipt number but excludes it from every total. A corrected payment issues a new receipt.
                </p>
              </div>
              <Button
                variant="destructive"
                className="w-full"
                disabled={isVoid}
                onClick={() => setVoidOpen(true)}
              >
                <TriangleAlert className="h-4 w-4" /> {isVoid ? "Receipt voided" : "Void receipt"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent className="border-dash-fg/12 bg-dash-card text-dash-fg">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Void {receiptNo}?</DialogTitle>
            <DialogDescription className="text-dash-fg/55">
              Voiding is permanent and audited. The receipt number stays, is excluded from all totals, and the student&apos;s
              fee account is reopened. This cannot be undone from the app.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setVoidOpen(false)} className="text-dash-fg/70 hover:bg-dash-fg/[0.05]">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => voidReceipt.mutate({ receiptNo })}
              loading={voidReceipt.isPending}
            >
              Yes, void receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

interface SendDocArg extends Record<string, unknown> {
  studentId: string;
  kind: string;
  fileName: string;
  fileBase64: string;
  mimeType: string;
  caption: string;
  clientIntentKey: string;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.12em] text-dash-fg/35">{label}</p>
      <p className="mt-0.5 font-medium text-dash-fg/85">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const s = status.toUpperCase();
  if (s === "VOID" || s === "REJECTED") return <Badge variant="destructive">{status}</Badge>;
  return <Badge variant="mint">{status}</Badge>;
}

function BackLink() {
  return (
    <Link
      href="/founder/receipts"
      className="inline-flex items-center gap-2 text-sm font-medium text-dash-fg/60 transition-colors hover:text-dash-fg"
    >
      <ArrowLeft className="h-4 w-4" /> All receipts
    </Link>
  );
}