"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ReceiptText, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useReceipts } from "@/lib/api/rpc-hooks";
import type { ReceiptRow } from "@/lib/api/rpc-types";
import { fadeUp, listVariants } from "@/lib/motion";
import { fmtDate, inr } from "@/lib/utils/cn";

const PAGE = 25;

export default function FounderReceiptsPage() {
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  React.useEffect(() => setOffset(0), [debounced]);

  const { data, isFetching, error } = useReceipts({ q: debounced.trim(), limit: PAGE, offset });

  const rows = data?.results ?? data?.rows ?? [];
  const total = data?.total ?? rows.length;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE, total);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE < total;

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-6">
      <motion.div variants={fadeUp}>
        <p className="text-xs uppercase tracking-[0.16em] text-dash-fg/40">Money</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">Receipts</h1>
        <p className="mt-1 text-sm text-dash-fg/55">Search by receipt number, student name or UTR reference.</p>
      </motion.div>

      <motion.div variants={fadeUp} className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-dash-fg/35" aria-hidden />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Receipt number, student name, UTR…"
          className="h-12 border-dash-fg/12 bg-dash-card pl-11 text-dash-fg placeholder:text-dash-fg/30"
        />
      </motion.div>

      {error ? (
        <motion.div variants={fadeUp}>
          <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-6 text-sm text-red-300">{error.message}</p>
        </motion.div>
      ) : isFetching && rows.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 bg-dash-fg/[0.04]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <motion.div variants={fadeUp}>
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-dash-fg/15 bg-dash-fg/[0.02] px-6 py-14 text-center">
            <ReceiptText className="mb-3 h-9 w-9 text-dash-fg/20" aria-hidden />
            <p className="text-sm font-medium text-dash-fg/70">No receipts found</p>
            <p className="mt-1 max-w-xs text-xs text-dash-fg/40">
              {debounced.trim() ? "Try a different search term." : "Receipts will appear here as soon as they are recorded."}
            </p>
          </div>
        </motion.div>
      ) : (
        <>
          <motion.div variants={fadeUp} className="overflow-hidden rounded-2xl border border-dash-fg/10 bg-dash-card">
            <ul className="divide-y divide-dash-fg/[0.06]">
              {rows.map((r) => (
                <ReceiptRowLink key={r.receiptNo ?? r.entityId} row={r} />
              ))}
            </ul>
          </motion.div>

          <motion.div variants={fadeUp} className="flex items-center justify-between gap-4 text-sm">
            <p className="text-dash-fg/45">
              Showing {from}–{to} of {total}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!hasPrev}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE))}
                className="flex h-9 items-center gap-1 rounded-xl border border-dash-fg/12 px-3 text-xs font-medium text-dash-fg/80 transition-colors hover:bg-dash-fg/[0.05] disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <button
                type="button"
                disabled={!hasNext}
                onClick={() => setOffset((o) => o + PAGE)}
                className="flex h-9 items-center gap-1 rounded-xl border border-dash-fg/12 px-3 text-xs font-medium text-dash-fg/80 transition-colors hover:bg-dash-fg/[0.05] disabled:pointer-events-none disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

function ReceiptRowLink({ row }: { row: ReceiptRow }) {
  return (
    <li>
      <Link
        href={`/founder/receipts/${encodeURIComponent(row.receiptNo ?? row.entityId)}`}
        className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-dash-fg/[0.04] sm:px-5"
      >
        <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dash-accent/10 text-dash-accent sm:flex">
          <ReceiptText className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-dash-fg">{row.studentName || row.student || "Student"}</span>
            <StatusBadge status={row.status} />
          </span>
          <span className="mt-0.5 block truncate text-xs text-dash-fg/45">
            {row.receiptNo} · {fmtDate(row.date)} · {row.mode || row.paymentMode || row.txnId || "—"}
          </span>
        </span>
        <span className="text-sm font-semibold text-dash-fg">{inr(row.amount)}</span>
      </Link>
    </li>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const s = status.toUpperCase();
  if (s === "VOID" || s === "REJECTED" || s === "CANCELLED") return <Badge variant="destructive">{status}</Badge>;
  return <Badge variant="mint">{status}</Badge>;
}