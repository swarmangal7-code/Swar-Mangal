"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Share2, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportShareDialog } from "@/components/dashboard/export-share-dialog";
import { useFeeRateCard } from "@/lib/api/rpc-hooks";
import type { FeeRateCardRow } from "@/lib/api/rpc-types";
import { fadeUp, listVariants } from "@/lib/motion";
import { inr } from "@/lib/utils/cn";

export default function StaffFeeRateCardPage() {
  const { data, isFetching, error } = useFeeRateCard();
  const rows = React.useMemo(() => data?.rows ?? [], [data]);
  const loading = isFetching && !data;
  const [exportOpen, setExportOpen] = React.useState(false);

  const byInstrument = React.useMemo(() => {
    const map = new Map<string, FeeRateCardRow[]>();
    for (const r of rows) {
      const list = map.get(r.instrument) ?? [];
      list.push(r);
      map.set(r.instrument, list);
    }
    return map;
  }, [rows]);
  const instrumentOrder = Array.from(byInstrument.keys()).sort((a, b) => a.localeCompare(b));

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-6">
      <motion.div variants={fadeUp} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-dash-fg/40">Staff · Money</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">Fee Rate Card</h1>
          <p className="mt-1 max-w-xl text-sm text-dash-fg/55">
            The academy&apos;s published price list — share it with an enquirer by WhatsApp or download it as a PDF. Only the
            founder can change these rates.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setExportOpen(true)}
          className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]"
        >
          <Share2 className="h-4 w-4" aria-hidden /> Export / Share
        </Button>
      </motion.div>

      {error && (
        <motion.div variants={fadeUp}>
          <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-6 text-sm text-red-300">{error.message}</p>
        </motion.div>
      )}

      <motion.div variants={fadeUp}>
        <Card className="border-dash-fg/10 bg-dash-card">
          <CardContent className="space-y-4 p-5">
            {loading ? (
              <>
                <Skeleton className="h-12 bg-dash-fg/[0.04]" />
                <Skeleton className="h-12 bg-dash-fg/[0.04]" />
              </>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Tag className="mb-3 h-8 w-8 text-dash-fg/25" aria-hidden />
                <p className="text-sm font-medium text-dash-fg/70">No rate card published yet</p>
                <p className="mt-1 text-xs text-dash-fg/40">Ask the founder to add prices to the rate card.</p>
              </div>
            ) : (
              instrumentOrder.map((instrument) => (
                <div key={instrument} className="space-y-2">
                  <h2 className="text-sm font-semibold text-dash-fg/80">{instrument}</h2>
                  <div className="space-y-2">
                    {(byInstrument.get(instrument) ?? []).map((row) => (
                      <div key={row.id} className="flex items-center gap-4 rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.03] p-4">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-dash-fg">{row.name}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-dash-fg/50">
                            <span>{inr(row.feeAmount)} / {row.billingPeriod}</span>
                            {row.notes && (
                              <>
                                <span className="text-dash-fg/25">·</span>
                                <span>{row.notes}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </motion.div>

      <ExportShareDialog open={exportOpen} onOpenChange={setExportOpen} docKind="fee-structure" documentLabel="Fee Rate Card" />
    </motion.div>
  );
}
