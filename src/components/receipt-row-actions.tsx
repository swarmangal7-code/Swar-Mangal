"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, MessageCircle, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { API_ORIGIN } from "@/lib/api/rpc-client";
import { useMutationRpc } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope } from "@/lib/api/rpc-types";
import { useTokenAuth } from "@/lib/auth/token-auth";
import { todayISO } from "@/lib/utils/cn";

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

interface SendDocArg extends Record<string, unknown> {
  studentId: string;
  kind: string;
  fileName: string;
  fileBase64: string;
  mimeType: string;
  caption: string;
  clientIntentKey: string;
}

interface SendDocResponse extends RpcEnvelope {
  message?: { status?: string };
  note?: string;
}

/**
 * Per-receipt actions for the student-profile receipts lists (founder +
 * staff share this component): view the PDF in a new tab, download it,
 * and send it on WhatsApp to the student's REGISTERED number via WA-AKG
 * (kind RECEIPT through api_staff_sendWhatsAppDocument — the server reads
 * the recipient only from the student record, never a typed number).
 */
export function ReceiptRowActions({ receiptNo, studentId }: { receiptNo: string; studentId: string }) {
  const { token } = useTokenAuth();
  const pdfHref = `${API_ORIGIN}/api/pdf/receipt/${encodeURIComponent(receiptNo)}?token=${encodeURIComponent(token)}`;

  const sendDoc = useMutationRpc<SendDocArg, SendDocResponse>("api_staff_sendWhatsAppDocument", {
    onSuccess: () => toast.success("Receipt sent on WhatsApp"),
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not send the receipt."),
  });

  const waIntentKey = React.useRef(`WA-${receiptNo}-${todayISO()}`).current;

  const sendWhatsApp = async () => {
    if (!studentId) return;
    toast.loading("Preparing receipt PDF…");
    try {
      const fileBase64 = await fileToBase64(pdfHref);
      toast.dismiss();
      sendDoc.mutate({
        studentId,
        kind: "RECEIPT",
        fileName: `receipt-${receiptNo}.pdf`,
        fileBase64,
        mimeType: "application/pdf",
        caption: `Swar Mangal receipt ${receiptNo}`,
        clientIntentKey: waIntentKey,
      });
    } catch (e) {
      toast.dismiss();
      toast.error(e instanceof Error ? e.message : "Could not prepare the PDF.");
    }
  };

  const iconBtn =
    "flex h-8 w-8 items-center justify-center rounded-xl border border-dash-fg/12 text-dash-fg/55 transition-colors hover:border-dash-accent/50 hover:text-dash-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60";

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <a href={pdfHref} target="_blank" rel="noreferrer" title="View receipt PDF" aria-label={`View receipt ${receiptNo} PDF`} className={iconBtn}>
        <Printer className="h-4 w-4" aria-hidden />
      </a>
      <a href={pdfHref} download={`receipt-${receiptNo}.pdf`} title="Download receipt PDF" aria-label={`Download receipt ${receiptNo} PDF`} className={iconBtn}>
        <Download className="h-4 w-4" aria-hidden />
      </a>
      {studentId ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Send on WhatsApp"
          aria-label={`Send receipt ${receiptNo} on WhatsApp`}
          onClick={sendWhatsApp}
          disabled={sendDoc.isPending}
          className="h-8 w-8 rounded-xl border border-dash-fg/12 text-dash-fg/55 hover:border-dash-accent/50 hover:text-dash-accent"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
