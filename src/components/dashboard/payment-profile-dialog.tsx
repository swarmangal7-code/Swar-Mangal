"use client";

import * as React from "react";
import { Landmark } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useMutationRpc } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope } from "@/lib/api/rpc-types";

interface Res extends RpcEnvelope {
  note?: string;
}

const ENTITIES = [
  { id: "ENT-GOREGAON", label: "Goregaon" },
  { id: "ENT-KANDIVALI", label: "Kandivali" },
];

/** Staff proposes how an entity's invoices get paid; the founder decides (governance.ts's submitPaymentProfileChangeRequest, previously had no web submission UI). */
export function PaymentProfileDialog() {
  const [open, setOpen] = React.useState(false);
  const [entityId, setEntityId] = React.useState(ENTITIES[0].id);
  const [label, setLabel] = React.useState("");
  const [reason, setReason] = React.useState("");
  const intentRef = React.useRef(`PPCHG-${Date.now()}`);

  const submit = useMutationRpc<{ entityId: string; requestedLabel: string; reason: string; clientIntentKey: string }, Res>(
    "api_staff_submitPaymentProfileChangeRequest",
    {
      onSuccess: (res) => {
        toast.success(res.note ?? "Sent for approval.");
        setOpen(false);
        setLabel("");
        setReason("");
        intentRef.current = `PPCHG-${Date.now()}`;
      },
      onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not send the request."),
    },
  );

  return (
    <>
      <Button variant="outline" size="sm" className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]" onClick={() => setOpen(true)}>
        <Landmark className="h-3.5 w-3.5" aria-hidden /> Payment profile change
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-dash-fg/10 bg-dash-card text-dash-fg">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Request a payment profile change</DialogTitle>
            <DialogDescription className="text-dash-fg/50">Sent for approval — the founder decides.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Entity *</Label>
              <select
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                className="h-11 w-full rounded-2xl border border-dash-fg/10 bg-dash-surface px-4 text-sm text-dash-fg"
              >
                {ENTITIES.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">New payment profile *</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. HDFC ****1234"
                className="border-dash-fg/10 bg-dash-surface text-dash-fg placeholder:text-dash-fg/35"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Reason *</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="border-dash-fg/10 bg-dash-surface text-dash-fg" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!label.trim() || !reason.trim()}
              loading={submit.isPending}
              onClick={() => submit.mutate({ entityId, requestedLabel: label.trim(), reason: reason.trim(), clientIntentKey: intentRef.current })}
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
