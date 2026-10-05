"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Pencil, Plus, Share2, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ExportShareDialog } from "@/components/dashboard/export-share-dialog";
import { rpcKeys, useFeeRateCard, useInstruments, useMutationRpc } from "@/lib/api/rpc-hooks";
import type { FeeRateCardRow, FeeRateCardWriteResponse } from "@/lib/api/rpc-types";
import { fadeUp, listVariants } from "@/lib/motion";
import { fmtDate, inr } from "@/lib/utils/cn";

const selectCls =
  "flex h-11 w-full rounded-2xl border border-dash-fg/12 bg-dash-sidebar px-4 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60";

export default function FounderFeeRateCardPage() {
  const { data, isFetching, error } = useFeeRateCard(true);
  const rows = React.useMemo(() => data?.rows ?? [], [data]);
  const loading = isFetching && !data;

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<FeeRateCardRow | null>(null);
  const [deactivating, setDeactivating] = React.useState<FeeRateCardRow | null>(null);
  const [exportOpen, setExportOpen] = React.useState(false);

  const deactivateMut = useMutationRpc<{ id: string }, FeeRateCardWriteResponse>("api_founder_deactivateFeeRateCard", {
    invalidate: [rpcKeys.feeRateCard()],
    onSuccess: () => {
      toast.success("Rate card row deactivated.");
      setDeactivating(null);
    },
    onError: (err) => toast.error(err.message),
  });

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
          <p className="text-xs uppercase tracking-[0.16em] text-dash-fg/40">Money</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">Fee Rate Card</h1>
          <p className="mt-1 max-w-xl text-sm text-dash-fg/55">
            The academy&apos;s published price list — a quotable rate per instrument. This is separate from what any
            individual student actually pays; edit it directly, the same way you&apos;d edit a school or teacher record.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setExportOpen(true)}
            className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]"
          >
            <Share2 className="h-4 w-4" aria-hidden /> Export / Share
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
          >
            <Plus className="h-4 w-4" aria-hidden /> Add rate
          </Button>
        </div>
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
                <p className="text-sm font-medium text-dash-fg/70">No rate card rows yet</p>
                <p className="mt-1 text-xs text-dash-fg/40">Add the first quotable price for an instrument.</p>
              </div>
            ) : (
              instrumentOrder.map((instrument) => (
                <div key={instrument} className="space-y-2">
                  <h2 className="text-sm font-semibold text-dash-fg/80">{instrument}</h2>
                  <div className="space-y-2">
                    {(byInstrument.get(instrument) ?? []).map((row) => (
                      <div
                        key={row.id}
                        className={`flex items-center gap-4 rounded-2xl border p-4 ${
                          row.active ? "border-dash-fg/10 bg-dash-fg/[0.03]" : "border-dash-fg/10 bg-dash-fg/[0.01] opacity-60"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-dash-fg">{row.name}</p>
                            {!row.active && (
                              <Badge variant="outline" className="border-dash-fg/20 text-dash-fg/50">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-dash-fg/50">
                            <span>{inr(row.feeAmount)} / {row.billingPeriod}</span>
                            {row.notes && (
                              <>
                                <span className="text-dash-fg/25">·</span>
                                <span>{row.notes}</span>
                              </>
                            )}
                            {row.updatedAt && (
                              <>
                                <span className="text-dash-fg/25">·</span>
                                <span>updated {fmtDate(row.updatedAt)}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="iconSm"
                            onClick={() => {
                              setEditing(row);
                              setDialogOpen(true);
                            }}
                            aria-label="Edit rate"
                          >
                            <Pencil className="h-4 w-4" aria-hidden />
                          </Button>
                          {row.active && (
                            <Button
                              variant="ghost"
                              size="iconSm"
                              onClick={() => setDeactivating(row)}
                              aria-label="Deactivate rate"
                              className="text-red-300/70 hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </Button>
                          )}
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

      <FeeRateCardDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />

      <Dialog open={!!deactivating} onOpenChange={(open) => !open && setDeactivating(null)}>
        <DialogContent className="max-w-sm border-dash-fg/10 bg-dash-card text-dash-fg">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Deactivate this rate?</DialogTitle>
            <DialogDescription className="text-dash-fg/45">
              <span className="font-medium text-dash-fg">{deactivating?.name}</span> ({deactivating?.instrument}) will stop
              appearing on new exports and the active price list. It is kept, not deleted, and can be re-added if needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeactivating(null)} className="text-dash-fg/70 hover:bg-dash-fg/[0.05]">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deactivating && deactivateMut.mutate({ id: deactivating.id })}
              loading={deactivateMut.isPending}
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExportShareDialog open={exportOpen} onOpenChange={setExportOpen} docKind="fee-structure" documentLabel="Fee Rate Card" />
    </motion.div>
  );
}

function FeeRateCardDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: FeeRateCardRow | null;
}) {
  const instrumentsQ = useInstruments();
  const instruments = React.useMemo(() => instrumentsQ.data?.instruments ?? [], [instrumentsQ.data]);

  const [instrument, setInstrument] = React.useState("");
  const [name, setName] = React.useState("");
  const [feeAmount, setFeeAmount] = React.useState("");
  const [billingPeriod, setBillingPeriod] = React.useState("Monthly");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setInstrument(editing?.instrument ?? instruments[0]?.name ?? "");
    setName(editing?.name ?? "");
    setFeeAmount(editing ? String(editing.feeAmount) : "");
    setBillingPeriod(editing?.billingPeriod ?? "Monthly");
    setNotes(editing?.notes ?? "");
  }, [open, editing, instruments]);

  const mut = useMutationRpc<Record<string, unknown>, FeeRateCardWriteResponse>("api_founder_upsertFeeRateCard", {
    invalidate: [rpcKeys.feeRateCard()],
    onSuccess: (res) => {
      toast.success(res.note === "updated" ? "Rate updated." : "Rate added.");
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not save."),
  });

  const fee = Number(feeAmount);
  const valid = !!instrument && !!name.trim() && Number.isFinite(fee) && fee > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-dash-fg/12 bg-dash-card text-dash-fg">
        <DialogHeader>
          <DialogTitle className="text-dash-fg">{editing ? "Edit rate" : "Add rate"}</DialogTitle>
          <DialogDescription className="text-dash-fg/55">
            {editing ? "Updates this row in place." : "Adds a new quotable price to the rate card."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-dash-fg/70">Instrument</Label>
            <select className={selectCls} value={instrument} onChange={(e) => setInstrument(e.target.value)}>
              <option value="" disabled>
                Select instrument
              </option>
              {instruments.map((i) => (
                <option key={i.id} value={i.name}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-dash-fg/70">Plan name (e.g. Standard, 1-on-1)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="border-dash-fg/12 bg-dash-sidebar text-dash-fg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-dash-fg/70">Fee (₹)</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
                className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-dash-fg/70">Billing period</Label>
              <select className={selectCls} value={billingPeriod} onChange={(e) => setBillingPeriod(e.target.value)}>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Annual">Annual</option>
                <option value="One-time">One-time</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-dash-fg/70">Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="border-dash-fg/12 bg-dash-sidebar text-dash-fg" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-dash-fg/70 hover:bg-dash-fg/[0.05]">
            Cancel
          </Button>
          <Button
            className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
            disabled={!valid}
            loading={mut.isPending}
            onClick={() =>
              mut.mutate({
                id: editing?.id,
                instrument,
                name: name.trim(),
                feeAmount: fee,
                billingPeriod,
                notes: notes.trim() || undefined,
              })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
