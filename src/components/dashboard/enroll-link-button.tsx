"use client";

import * as React from "react";
import { Link2, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutationRpc } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope } from "@/lib/api/rpc-types";

interface EnrollLinkRes extends RpcEnvelope {
  url?: string;
  note?: string;
}

/**
 * A link staff can send a prospective family so they fill in their own
 * basic details, landing in New Enrollments for review — an alternative to
 * typing the whole record in by hand. Mirrors the existing terms-link
 * generation UX (generate, show, copy).
 */
export function EnrollLinkButton({ branch }: { branch: string }) {
  const [open, setOpen] = React.useState(false);
  const [url, setUrl] = React.useState("");

  const generate = useMutationRpc<{ branch: string }, EnrollLinkRes>("api_staff_generateEnrollLink", {
    onSuccess: (res) => {
      setUrl(res.url ?? "");
      if (!res.url) toast.error(res.note ?? "Could not build a shareable link.");
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not generate a link."),
  });

  const openDialog = () => {
    setOpen(true);
    setUrl("");
    generate.mutate({ branch });
  };

  const copy = () => {
    navigator.clipboard.writeText(url).then(() => toast.success("Link copied."));
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]"
        onClick={openDialog}
      >
        <Link2 className="h-3.5 w-3.5" aria-hidden /> Send an enroll link instead
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-dash-fg/10 bg-dash-card text-dash-fg">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Enroll link</DialogTitle>
            <DialogDescription className="text-dash-fg/50">
              Valid for 7 days, one use. The family fills in their own basic details; it lands in New
              Enrollments for you to review.
            </DialogDescription>
          </DialogHeader>
          {generate.isPending ? (
            <p className="text-sm text-dash-fg/50">Generating…</p>
          ) : url ? (
            <div className="flex items-center gap-2 rounded-2xl border border-dash-fg/10 bg-dash-surface p-3">
              <span className="min-w-0 flex-1 truncate text-sm text-dash-fg">{url}</span>
              <Button type="button" variant="ghost" size="sm" onClick={copy}>
                <Copy className="h-3.5 w-3.5" aria-hidden /> Copy
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
