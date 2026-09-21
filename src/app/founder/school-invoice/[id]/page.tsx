"use client";

export const runtime = "edge";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, FileText, Share2 } from "lucide-react";
import { toast } from "sonner";

import { useRpc } from "@/lib/api/rpc-hooks";
import type { SchoolInvoiceResponse } from "@/lib/api/rpc-types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoicePreview } from "@/components/founder/invoice-preview";

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

export default function FounderSchoolInvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const invoiceQ = useRpc<SchoolInvoiceResponse>(
    "api_getSchoolInvoice",
    { invoiceId: id },
    { enabled: id.length > 0 },
  );

  const invoice = invoiceQ.data?.invoice;

  const handleDownload = () => {
    if (!invoice) return;
    if (invoice.pdfUrl) {
      window.open(invoice.pdfUrl, "_blank", "noopener,noreferrer");
      return;
    }
    window.print();
  };

  const handleShare = async () => {
    if (!invoice) return;
    const text = `Invoice ${invoice.invoiceNo} · ${invoice.className} · ${inr.format(invoice.amount)}`;
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

  if (invoiceQ.isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-40 bg-white/[0.05]" />
        <Skeleton className="h-28 w-full bg-white/[0.05]" />
        <Skeleton className="h-80 w-full bg-white/[0.05]" />
      </div>
    );
  }

  if (invoiceQ.isError || !invoice) {
    return (
      <div className="space-y-4">
        <Link
          href="/founder/school-invoice"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#F7F2E8]/50 transition-colors hover:text-[#D6A84F]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          School invoices
        </Link>
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
          <p className="text-sm font-medium text-red-300">Could not load this invoice.</p>
          <p className="mt-1 text-sm text-[#F7F2E8]/55">
            {invoiceQ.error instanceof Error
              ? invoiceQ.error.message
              : "The invoice may no longer exist."}
          </p>
          <Button
            variant="outline"
            onClick={() => invoiceQ.refetch()}
            className="mt-4 border-[#F7F2E8]/15 text-[#F7F2E8] hover:bg-white/[0.05]"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/founder/school-invoice"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#F7F2E8]/50 transition-colors hover:text-[#D6A84F]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          School invoices
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#F7F2E8]/40">
            School invoice
          </p>
          <h1 className="mt-1 font-mono text-2xl font-semibold tracking-tight text-[#F7F2E8]">
            {invoice.invoiceNo}
          </h1>
          <p className="mt-1 text-sm text-[#F7F2E8]/55">
            {invoice.className || "—"} · {invoice.branch}
            {invoice.invoiceDate ? ` · ${fmtDate.format(new Date(invoice.invoiceDate))}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleDownload}
            className="border-[#F7F2E8]/15 text-[#F7F2E8] hover:bg-white/[0.05]"
          >
            <Download className="h-4 w-4" aria-hidden />
            Download
          </Button>
          <Button
            onClick={handleShare}
            className="bg-[#D6A84F] text-[#08070B] hover:bg-[#E2BD68]"
          >
            <Share2 className="h-4 w-4" aria-hidden />
            Share
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#F7F2E8]/10 bg-white/[0.03] p-5">
          <p className="text-xs text-[#F7F2E8]/45">Amount</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[#F7F2E8]">
            {inr.format(Number(invoice.amount) || 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#F7F2E8]/10 bg-white/[0.03] p-5">
          <p className="text-xs text-[#F7F2E8]/45">Tenure</p>
          <p className="mt-2 text-lg font-semibold text-[#F7F2E8]">{invoice.tenure || "—"}</p>
        </div>
        <div className="rounded-2xl border border-[#F7F2E8]/10 bg-white/[0.03] p-5">
          <p className="text-xs text-[#F7F2E8]/45">Branch</p>
          <p className="mt-2 text-lg font-semibold text-[#F7F2E8]">{invoice.branch || "—"}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#F7F2E8]/10 bg-white/[0.03] p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#F7F2E8]/80">
          <FileText className="h-4 w-4 text-[#D6A84F]" aria-hidden />
          Owner signatures
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <OwnerCard owner={invoice.owner1} />
          <OwnerCard owner={invoice.owner2} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-[#F7F2E8]/80">Invoice preview</h2>
        <InvoicePreview
          invoiceNo={invoice.invoiceNo}
          invoiceDate={invoice.invoiceDate}
          className={invoice.className}
          amount={Number(invoice.amount) || 0}
          tenure={invoice.tenure}
          branch={invoice.branch}
          owner1={invoice.owner1}
          owner2={invoice.owner2}
        />
      </div>
    </div>
  );
}

function OwnerCard({ owner }: { owner?: { name: string; title: string; signatureUrl: string } }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#F7F2E8]/10 bg-white/[0.02] p-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#D6A84F]/25 bg-[#D6A84F]/10 font-display text-lg text-[#D6A84F]">
        {owner?.name?.charAt(0)?.toUpperCase() ?? "—"}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[#F7F2E8]">{owner?.name ?? "—"}</p>
        <p className="text-xs text-[#F7F2E8]/45">{owner?.title ?? "Signature"}</p>
      </div>
    </div>
  );
}