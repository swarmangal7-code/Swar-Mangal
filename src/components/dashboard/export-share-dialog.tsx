"use client";

// Founder request 2026-10-05: export the Timetable or Fee Rate Card as a PDF
// filtered to one or more instruments, and optionally share it on WhatsApp to
// a hand-typed phone number — a deliberate, explicit exception to the
// "student's registered phone only" rule (see the comment at the top of
// src/lib/rpc/messaging.ts), because this PDF is public-facing informational
// material with no student-specific data in it. Same fetch-then-send pattern
// as the receipt detail page's "Send on WhatsApp" button.
import * as React from "react";
import { Download, MessageCircle } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_ORIGIN } from "@/lib/api/rpc-client";
import { useInstruments, useMutationRpc } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope } from "@/lib/api/rpc-types";
import { useTokenAuth } from "@/lib/auth/token-auth";
import { fileToBase64 } from "@/lib/utils/pdf-share";

export type ExportShareDocKind = "timetable" | "fee-structure";

interface ShareResponse extends RpcEnvelope {
  note?: string;
}

interface ExportShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which PDF route to hit and which WhatsApp "kind" to record. */
  docKind: ExportShareDocKind;
  /** Human label used in the dialog title/filenames/caption. */
  documentLabel: string;
  /** Extra query params merged into the PDF URL (e.g. { branch } for the timetable). */
  extraParams?: Record<string, string>;
}

export function ExportShareDialog({ open, onOpenChange, docKind, documentLabel, extraParams }: ExportShareDialogProps) {
  const { token } = useTokenAuth();
  const instrumentsQ = useInstruments();
  const instruments = instrumentsQ.data?.instruments ?? [];

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [phone, setPhone] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setSelected(new Set());
      setPhone("");
    }
  }, [open]);

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const pdfPath = docKind === "timetable" ? "/api/pdf/timetable" : "/api/pdf/fee-structure";
  const pdfHref = React.useMemo(() => {
    const params = new URLSearchParams({ token, ...(extraParams ?? {}) });
    for (const name of selected) params.append("instruments", name);
    return `${API_ORIGIN}${pdfPath}?${params.toString()}`;
  }, [token, pdfPath, extraParams, selected]);

  const shareKind = docKind === "timetable" ? "TIMETABLE_SHARE" : "FEE_STRUCTURE_SHARE";
  const fileName = docKind === "timetable" ? "timetable.pdf" : "fee-rate-card.pdf";

  const shareMut = useMutationRpc<Record<string, unknown>, ShareResponse>("api_staff_shareDocumentViaWhatsApp", {
    onSuccess: (res) => toast.success(res.note === "already sent" ? "Already shared earlier." : `${documentLabel} shared on WhatsApp.`),
    onError: (err) => toast.error(err.message),
  });

  const intentKey = React.useRef(`WA-SHARE-${docKind}-${Date.now()}`).current;

  const handleShare = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Enter a valid 10-digit phone number.");
      return;
    }
    toast.loading(`Preparing ${documentLabel} PDF…`);
    try {
      const fileBase64 = await fileToBase64(pdfHref);
      toast.dismiss();
      shareMut.mutate({
        phone: digits,
        kind: shareKind,
        fileName,
        fileBase64,
        mimeType: "application/pdf",
        caption: `Swar Mangal ${documentLabel}`,
        clientIntentKey: intentKey,
      });
    } catch (e) {
      toast.dismiss();
      toast.error(e instanceof Error ? e.message : "Could not prepare the PDF.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-dash-fg/10 bg-dash-card text-dash-fg">
        <DialogHeader>
          <DialogTitle className="text-dash-fg">Export / Share {documentLabel}</DialogTitle>
          <DialogDescription className="text-dash-fg/55">
            Filter by instrument, then download the PDF or share it on WhatsApp to any number — this does not have to be a
            student&apos;s registered number.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block text-dash-fg/70">Instruments (leave all unchecked for everything)</Label>
            <div className="grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.02] p-3">
              {instrumentsQ.isPending ? (
                <p className="col-span-2 text-xs text-dash-fg/40">Loading instruments…</p>
              ) : instruments.length === 0 ? (
                <p className="col-span-2 text-xs text-dash-fg/40">No instruments configured yet.</p>
              ) : (
                instruments.map((i) => (
                  <label key={i.id} className="flex items-center gap-2 text-xs text-dash-fg/80">
                    <input
                      type="checkbox"
                      checked={selected.has(i.name)}
                      onChange={() => toggle(i.name)}
                      className="h-3.5 w-3.5 rounded border-dash-fg/20 bg-dash-sidebar accent-dash-accent"
                    />
                    {i.name}
                  </label>
                ))
              )}
            </div>
          </div>

          <Button asChild variant="outline" className="w-full justify-center border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]">
            <a href={pdfHref} target="_blank" rel="noreferrer">
              <Download className="h-4 w-4" /> Download PDF
            </a>
          </Button>

          <div className="space-y-2 border-t border-dash-fg/10 pt-4">
            <Label className="text-dash-fg/70">Share on WhatsApp — phone number</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 98200 11223"
              inputMode="numeric"
              className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
            />
            <p className="text-[11px] text-dash-fg/40">
              Not tied to any student record — type in any number to send this {documentLabel.toLowerCase()} PDF to.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-dash-fg/70 hover:bg-dash-fg/[0.05]">
            Close
          </Button>
          <Button
            onClick={handleShare}
            loading={shareMut.isPending}
            className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
          >
            <MessageCircle className="h-4 w-4" /> Share on WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
