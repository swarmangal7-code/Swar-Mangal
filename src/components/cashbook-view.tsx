"use client";

import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, CircleDollarSign, Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCashbook } from "@/lib/api/rpc-hooks";
import { fadeUp } from "@/lib/motion";
import { currentMonth, fmtDate, inr } from "@/lib/utils/cn";
import { motion } from "framer-motion";

const selectCls =
  "flex h-11 w-full rounded-2xl border border-dash-fg/12 bg-dash-sidebar px-4 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60";

export function CashbookView({ branches }: { branches: string[] }) {
  const [month, setMonth] = React.useState(currentMonth());
  const [branch, setBranch] = React.useState("ALL");

  const { data, isFetching, error } = useCashbook(branch, month);

  const entries = data?.entries ?? [];
  const inflow = entries.filter((e) => (e.type ?? "EXPENSE").toUpperCase().includes("INFLOW"));
  const outflow = entries.filter((e) => !(e.type ?? "EXPENSE").toUpperCase().includes("INFLOW"));
  const inflowTotal = inflow.reduce((s, e) => s + Number(e.amount), 0);
  const outflowTotal = outflow.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <motion.div variants={fadeUp} className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-fit border-dash-fg/12 bg-dash-card text-dash-fg"
        />
        <select className={selectCls + " w-auto"} value={branch} onChange={(e) => setBranch(e.target.value)}>
          <option value="ALL">All branches</option>
          {branches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Inflow" value={inr(inflowTotal)} tone="mint" icon={ArrowDownLeft} />
        <SummaryCard label="Outflow" value={inr(outflowTotal)} tone="peach" icon={ArrowUpRight} />
        <SummaryCard label="Net" value={inr(inflowTotal - outflowTotal)} tone={inflowTotal - outflowTotal >= 0 ? "mint" : "peach"} icon={CircleDollarSign} />
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-6 text-sm text-red-300">{error.message}</p>
      ) : isFetching && entries.length === 0 ? (
        <Card className="border-dash-fg/10 bg-dash-card">
          <CardContent className="space-y-2 p-4">
            <Skeleton className="h-9 bg-dash-fg/[0.05]" />
            <Skeleton className="h-9 bg-dash-fg/[0.05]" />
            <Skeleton className="h-9 bg-dash-fg/[0.05]" />
          </CardContent>
        </Card>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-dash-fg/15 bg-dash-fg/[0.02] px-6 py-14 text-center">
          <Download className="mb-3 h-8 w-8 text-dash-fg/20" aria-hidden />
          <p className="text-sm font-medium text-dash-fg/70">No ledger entries</p>
          <p className="mt-1 text-xs text-dash-fg/40">Nothing recorded for this month yet.</p>
        </div>
      ) : (
        <Card className="overflow-hidden border-dash-fg/10 bg-dash-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dash-fg/10 text-left text-[11px] uppercase tracking-[0.12em] text-dash-fg/35">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dash-fg/[0.06]">
                {entries.map((e) => {
                  const isIn = (e.type ?? "").toUpperCase().includes("INFLOW");
                  return (
                    <tr key={e.entryId} className="hover:bg-dash-fg/[0.03]">
                      <td className="px-4 py-3 text-dash-fg/60">{fmtDate(e.date)}</td>
                      <td className="px-4 py-3 font-medium text-dash-fg/85">{e.category || "—"}</td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-dash-fg/60">{e.description || "—"}</td>
                      <td className="px-4 py-3 text-dash-fg/60">{e.mode || e.status || "—"}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${isIn ? "text-emerald-300" : "text-dash-fg"}`}>
                        {isIn ? "+" : "−"}
                        {inr(e.amount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {e.approvalStatus && e.approvalStatus !== "APPROVED" ? (
                          <Badge variant="peach">{e.approvalStatus}</Badge>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-dash-fg/15 bg-dash-fg/[0.03]">
                  <td colSpan={4} className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-dash-fg/45">
                    Totals
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-dash-fg">
                    {inr(inflowTotal)} in · {inr(outflowTotal)} out
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-dash-fg/45">net {inr(inflowTotal - outflowTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </motion.div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: "mint" | "peach";
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}) {
  const color = tone === "mint" ? "text-emerald-300" : "text-rose-300";
  return (
    <Card className="border-dash-fg/10 bg-dash-card">
      <CardContent className="flex items-center gap-3 pt-5">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-dash-fg/[0.05] ${color}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <p className="text-xs text-dash-fg/45">{label}</p>
          <p className="text-lg font-semibold tracking-tight text-dash-fg">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
