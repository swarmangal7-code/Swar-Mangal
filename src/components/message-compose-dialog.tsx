"use client";

import * as React from "react";
import { MessageCircle } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useMutationRpc, useRpc } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope } from "@/lib/api/rpc-types";

const MESSAGE_TYPES = [
  "FEE_REMINDER",
  "DUE_SOON",
  "DUE_TODAY",
  "OVERDUE_ACCRUING",
  "RENEWAL",
  "TERMS",
  "ABSENT_TODAY",
  "NOTIFY_TEACHER_ABSENCE",
] as const;

export type MessageType = (typeof MESSAGE_TYPES)[number];

interface CommGenerateRes extends RpcEnvelope {
  kind?: string;
  subject?: string;
  body?: string;
  recipientName?: string;
  recipientPhone?: string;
  warnings?: string[];
  mode?: "WHATSAPP" | "COPY_ONLY";
}

interface SendWhatsAppRes extends RpcEnvelope {
  message?: { status?: string; to?: string };
  note?: string;
}

interface HistoryRow {
  messageId: string;
  kind: string;
  to: string;
  status: string;
  body: string;
  fileName?: string;
  error?: string;
  createdAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
}

interface HistoryRes extends RpcEnvelope {
  rows?: HistoryRow[];
}

/**
 * "Message parent" — generates a WhatsApp reminder from the student's real
 * record, lets staff/founder edit it, then sends with one tap. Mirrors the
 * Flutter app's MessageComposeScreen so the capability exists on web too.
 */
export function MessageComposeDialog({
  studentId,
  studentName,
  branch,
  initialType,
}: {
  studentId: string;
  studentName: string;
  branch?: string;
  /** Pre-selects the reminder type — the fee buckets each imply one, matching
   *  FeeBucketScreen's OVERDUE_ACCRUING / DUE_TODAY / DUE_SOON. */
  initialType?: (typeof MESSAGE_TYPES)[number];
}) {
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<(typeof MESSAGE_TYPES)[number]>(initialType ?? "FEE_REMINDER");
  const [msg, setMsg] = React.useState<CommGenerateRes | null>(null);
  const [body, setBody] = React.useState("");
  const [sent, setSent] = React.useState<SendWhatsAppRes | null>(null);
  const [selectedHistory, setSelectedHistory] = React.useState<HistoryRow | null>(null);
  const intentKeyRef = React.useRef("");

  const history = useRpc<HistoryRes>("api_staff_messageHistory", { studentId }, { enabled: open });

  const generate = useMutationRpc<{ type: string; studentId: string; branch?: string }, CommGenerateRes>(
    "api_staff_commGenerate",
    {
      onSuccess: (res) => {
        setMsg(res);
        setBody(res.body ?? "");
        setSent(null);
      },
      onError: (err) => toast.error(err.message),
    },
  );

  const send = useMutationRpc<
    { studentId: string; kind: string; body: string; clientIntentKey: string },
    SendWhatsAppRes
  >("api_staff_sendWhatsApp", {
    invalidate: [["rpc", "api_staff_messageHistory", { studentId }]],
    onSuccess: (res) => {
      setSent(res);
      toast.success(res.note || "Sent on WhatsApp.");
    },
    onError: (err) => toast.error(err.message),
  });

  const reset = () => {
    setMsg(null);
    setBody("");
    setSent(null);
  };

  const doSend = () => {
    if (!msg || !body.trim()) return;
    if (!confirm(`Send this message to ${msg.recipientName ?? "the registered number"}? A sent message cannot be recalled.`)) return;
    intentKeyRef.current = intentKeyRef.current || `WA-${Date.now()}`;
    send.mutate({ studentId, kind: msg.kind ?? "CUSTOM", body: body.trim(), clientIntentKey: intentKeyRef.current });
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <MessageCircle className="h-3.5 w-3.5" aria-hidden />
        {initialType === "NOTIFY_TEACHER_ABSENCE" ? "Notify teacher" : "Message parent"}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto border-dash-fg/10 bg-dash-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">
              {type === "NOTIFY_TEACHER_ABSENCE" ? `Notify ${studentName}'s teacher` : `Message ${studentName}'s parent`}
            </DialogTitle>
            <DialogDescription className="text-dash-fg/50">
              Generated from the student&rsquo;s real record. Edit before sending — one tap delivers it, nothing sends automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-1.5">
            {MESSAGE_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setType(t);
                  reset();
                }}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  type === t
                    ? "border-dash-accent bg-dash-accent/15 text-dash-accent"
                    : "border-dash-fg/10 text-dash-fg/60 hover:border-dash-fg/25"
                }`}
              >
                {t.replaceAll("_", " ")}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            variant="outline"
            disabled={generate.isPending}
            onClick={() => generate.mutate({ type, studentId, branch })}
          >
            {generate.isPending ? "Generating…" : "Generate message"}
          </Button>

          {msg && (
            <div className="space-y-3">
              <p className="text-xs text-dash-fg/55">
                TO: {msg.recipientName || "(unknown)"}
                {msg.recipientPhone ? ` · ${msg.recipientPhone}` : ""}
              </p>
              {msg.subject && <p className="text-sm font-semibold text-dash-accent">{msg.subject}</p>}
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={7}
                disabled={!!sent}
                className="border-dash-fg/10 bg-dash-surface text-sm text-dash-fg"
              />
              {!!msg.warnings?.length && (
                <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5">
                  {msg.warnings.map((w) => (
                    <p key={w} className="text-[11px] text-amber-600 dark:text-amber-400">
                      • {w}
                    </p>
                  ))}
                </div>
              )}
              {msg.mode === "WHATSAPP" ? (
                <Button
                  size="sm"
                  className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
                  disabled={!!sent || send.isPending}
                  onClick={doSend}
                >
                  {sent ? "Sent ✓" : send.isPending ? "Sending…" : "Send on WhatsApp"}
                </Button>
              ) : (
                <p className="text-xs text-dash-fg/50">
                  WhatsApp sending is off, or this student has no valid registered number. Copy the text and send it by hand.
                </p>
              )}
              {sent?.message?.status && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Sent to {sent.message.to} · {sent.message.status}.
                </p>
              )}
            </div>
          )}

          {!!history.data?.rows?.length && (
            <div className="space-y-2 border-t border-dash-fg/10 pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-dash-fg/40">
                Messages sent to this student ({history.data.rows.length})
              </p>
              {history.data.rows.map((h) => (
                <button
                  key={h.messageId}
                  type="button"
                  onClick={() => setSelectedHistory(h)}
                  className="flex w-full items-center justify-between rounded-lg px-1.5 py-1 text-left text-xs text-dash-fg/60 transition-colors hover:bg-dash-fg/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
                >
                  <span className="truncate">{h.fileName || h.kind.replaceAll("_", " ")}</span>
                  <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">
                    {h.status}
                  </Badge>
                </button>
              ))}
            </div>
          )}

          <Dialog open={!!selectedHistory} onOpenChange={(v) => !v && setSelectedHistory(null)}>
            <DialogContent className="border-dash-fg/10 bg-dash-card sm:max-w-md">
              {selectedHistory && (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center justify-between gap-2 text-dash-fg">
                      <span>{selectedHistory.fileName || selectedHistory.kind.replaceAll("_", " ")}</span>
                      <Badge variant="outline">{selectedHistory.status}</Badge>
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 text-sm">
                    <HistoryField label="To" value={selectedHistory.to} />
                    <HistoryField label="Message" value={selectedHistory.body} multiline />
                    {selectedHistory.fileName && <HistoryField label="Attachment" value={selectedHistory.fileName} />}
                    <HistoryField label="Created" value={selectedHistory.createdAt} />
                    {selectedHistory.sentAt && <HistoryField label="Sent" value={selectedHistory.sentAt} />}
                    {selectedHistory.deliveredAt && <HistoryField label="Delivered" value={selectedHistory.deliveredAt} />}
                    {selectedHistory.readAt && <HistoryField label="Read" value={selectedHistory.readAt} />}
                    {selectedHistory.status === "FAILED" && selectedHistory.error && (
                      <HistoryField label="Error" value={selectedHistory.error} />
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setSelectedHistory(null)}>
                      Close
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HistoryField({ label, value, multiline }: { label: string; value?: string; multiline?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-dash-fg/40">{label}</p>
      <p className={`mt-0.5 text-dash-fg/85 ${multiline ? "whitespace-pre-wrap" : ""}`}>{value || "—"}</p>
    </div>
  );
}
