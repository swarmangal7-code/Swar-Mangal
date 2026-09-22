"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, FileText, Plus } from "lucide-react";

import { useTokenAuth } from "@/lib/auth/token-auth";
import { useRpc } from "@/lib/api/rpc-hooks";
import type { SchoolInvoiceListResponse } from "@/lib/api/rpc-types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const fmtDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function statusStyle(status: string) {
  const s = status.toUpperCase();
  if (s === "FINAL" || s === "PAID" || s === "ISSUED") {
    return "border-dash-accent/30 bg-dash-accent/10 text-dash-accent";
  }
  if (s === "DRAFT") return "border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/60";
  if (s === "VOID" || s === "CANCELLED" || s === "REJECTED") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }
  return "border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/60";
}

export default function FounderSchoolInvoicePage() {
  const { session } = useTokenAuth();
  const branches = session?.branches?.length ? [...session.branches] : [];
  const [branch, setBranch] = React.useState(branches.length === 1 ? branches[0] : "ALL");

  const invoices = useRpc<SchoolInvoiceListResponse>("api_listSchoolInvoices", { branch });

  const rows = invoices.data?.invoices ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-dash-fg/40">
            Founder · Academy
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">
            School invoices
          </h1>
          <p className="mt-1 text-sm text-dash-fg/55">
            Every invoice issued to a school, newest first.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {branches.length > 1 && (
            <select
              aria-label="Branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="h-10 rounded-xl border border-dash-fg/15 bg-dash-fg/[0.04] px-3 text-sm font-medium text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
            >
              <option value="ALL">All Branches</option>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}
          <Button asChild className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover">
            <Link href="/founder/school-invoice/new">
              <Plus className="h-4 w-4" aria-hidden />
              New Invoice
            </Link>
          </Button>
        </div>
      </div>

      {invoices.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] w-full bg-dash-fg/[0.05]" />
          ))}
        </div>
      ) : invoices.isError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
          <p className="text-sm font-medium text-red-300">Could not load invoices.</p>
          <p className="mt-1 text-sm text-dash-fg/55">
            {invoices.error instanceof Error ? invoices.error.message : "Something went wrong."}
          </p>
          <Button
            variant="outline"
            onClick={() => invoices.refetch()}
            className="mt-4 border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]"
          >
            Retry
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-dash-fg/15 bg-dash-fg/[0.02] px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.03] text-dash-fg/40">
            <FileText className="h-6 w-6" aria-hidden />
          </div>
          <h3 className="text-base font-semibold text-dash-fg">No invoices yet</h3>
          <p className="mt-1 max-w-sm text-sm text-dash-fg/45">
            Generate the first school invoice and it will show up here.
          </p>
          <Button asChild className="mt-5 bg-dash-accent text-dash-bg hover:bg-dash-accent-hover">
            <Link href="/founder/school-invoice/new">
              <Plus className="h-4 w-4" aria-hidden />
              New Invoice
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((inv) => (
            <Link
              key={inv.invoiceId}
              href={`/founder/school-invoice/${inv.invoiceId}`}
              className="flex items-center gap-4 rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.03] p-4 transition-colors hover:border-dash-accent/40 hover:bg-dash-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-mono text-sm font-semibold text-dash-fg">
                    {inv.invoiceNo}
                  </p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusStyle(
                      inv.status,
                    )}`}
                  >
                    {inv.status || "—"}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-dash-fg/50">
                  <span>{inv.className || "—"}</span>
                  <span className="text-dash-fg/25">·</span>
                  <span>{inv.branch}</span>
                  <span className="text-dash-fg/25">·</span>
                  <span>{inv.invoiceDate ? fmtDate.format(new Date(inv.invoiceDate)) : "—"}</span>
                  {inv.tenure && (
                    <>
                      <span className="text-dash-fg/25">·</span>
                      <span>{inv.tenure}</span>
                    </>
                  )}
                </div>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-dash-fg">
                {inr.format(Number(inv.amount) || 0)}
              </p>
              <ChevronRight className="h-4 w-4 shrink-0 text-dash-fg/30" aria-hidden />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}