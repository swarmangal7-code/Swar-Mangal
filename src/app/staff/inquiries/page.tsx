"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, MessageSquareText, Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useInquiries } from "@/lib/api/rpc-hooks";
import type { Inquiry } from "@/lib/api/rpc-types";
import { useTokenAuth } from "@/lib/auth/token-auth";
import { fadeUp, listVariants } from "@/lib/motion";
import { cn } from "@/lib/utils/cn";
import { formatDateOnly } from "@/app/founder/_shared";

function statusTone(status: string) {
  const s = (status ?? "").toUpperCase();
  if (s === "CONVERTED") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (s === "DROPPED") return "border-red-400/30 bg-red-400/10 text-red-300";
  if (s === "DORMANT") return "border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/60";
  if (s === "TRIAL_SCHEDULED" || s === "TRIAL_DONE") return "border-sky-400/30 bg-sky-400/10 text-sky-300";
  return "border-amber-400/30 bg-amber-400/10 text-amber-300";
}

export default function StaffInquiriesPage() {
  const { session } = useTokenAuth();
  const branches = session?.branches ?? [];
  const [branch, setBranch] = React.useState(branches.length === 1 ? branches[0] : "ALL");
  const [q, setQ] = React.useState("");

  const inquiries = useInquiries(branch);
  const all = inquiries.data?.rows ?? [];
  const callToday = inquiries.data?.callToday ?? [];

  const needle = q.trim().toLowerCase();
  const rows = needle
    ? all.filter((r) =>
        [r.name, r.phone, r.instrument, r.branch, r.status].join(" ").toLowerCase().includes(needle),
      )
    : all;

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-6">
      <motion.div variants={fadeUp} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-dash-fg/40">Staff · Connect</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">Inquiries</h1>
          <p className="mt-1 text-sm text-dash-fg/55">
            {inquiries.data ? `${callToday.length} to call today · ${all.length} total` : "Leads and follow-ups."}
          </p>
        </div>
        {branches.length > 1 && (
          <select
            aria-label="Branch"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="h-11 rounded-2xl border border-dash-fg/12 bg-dash-sidebar px-3 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
          >
            <option value="ALL">All branches</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        )}
      </motion.div>

      <motion.div variants={fadeUp} className="relative">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, phone or instrument…"
          className="h-12 border-dash-fg/12 bg-dash-card text-dash-fg placeholder:text-dash-fg/30"
        />
      </motion.div>

      {inquiries.isError ? (
        <motion.div variants={fadeUp}>
          <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-6 text-sm text-red-300">
            {inquiries.error?.message?.replace(/\[.*\]$/, "") || "Could not load inquiries."}{" "}
            <button type="button" onClick={() => inquiries.refetch()} className="font-medium text-dash-accent">
              Retry
            </button>
          </p>
        </motion.div>
      ) : inquiries.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 bg-dash-fg/[0.04]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <motion.div variants={fadeUp}>
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-dash-fg/15 bg-dash-fg/[0.02] px-6 py-16 text-center">
            <MessageSquareText className="mb-3 h-9 w-9 text-dash-fg/25" aria-hidden />
            <p className="text-sm font-medium text-dash-fg/75">No inquiries</p>
            <p className="mt-1 max-w-xs text-xs text-dash-fg/40">
              {needle ? "Try a different search." : "New leads will appear here."}
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div variants={fadeUp} className="overflow-hidden rounded-2xl border border-dash-fg/10 bg-dash-card">
          <ul className="divide-y divide-dash-fg/[0.06]">
            {rows.map((r: Inquiry) => (
              <li key={r.inquiry_id}>
                <Link
                  href={`/staff/inquiries/${encodeURIComponent(r.inquiry_id)}`}
                  className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-dash-fg/[0.04] sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-dash-fg">{r.name || "Unnamed"}</span>
                      <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", statusTone(r.status))}>
                        {r.finalStatus || r.status || "—"}
                      </span>
                      {r.noAnswerCount > 0 && <Badge variant="outline">{r.noAnswerCount} misses</Badge>}
                      {r.formerStudentId && <Badge variant="peach">Former Student</Badge>}
                      {r.formerTeacherId && <Badge variant="peach">Former Teacher</Badge>}
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 truncate text-xs text-dash-fg/45">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-3 w-3" aria-hidden />
                        {r.phone || "—"}
                      </span>
                      <span className="text-dash-fg/25">·</span>
                      <span>{[r.instrument, r.branch].filter(Boolean).join(" · ")}</span>
                      {r.next_contact_date && (
                        <>
                          <span className="text-dash-fg/25">·</span>
                          <span>next {formatDateOnly(r.next_contact_date)}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-dash-fg/30" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </motion.div>
  );
}
