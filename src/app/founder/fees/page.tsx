"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Banknote, CheckCircle2, Search, UserRound } from "lucide-react";
import { toast } from "sonner";

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
import { useBootstrap, useMutationRpc, useStudentSearch, type StudentSearchOptions } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope, Student } from "@/lib/api/rpc-types";
import { fadeUp, listVariants } from "@/lib/motion";
import { addMonths, cn, fmtDate, inr, todayISO } from "@/lib/utils/cn";

const MODE_DEFAULTS = ["Cash", "UPI", "Bank Transfer", "Cheque"];

const accFor = (mode: string) => (mode.toUpperCase().includes("CASH") ? "Cash" : mode);

interface AddFeeArg extends Record<string, unknown> {
  studentId: string;
  studentName: string;
  phone: string;
  classCode: string;
  paymentMode: string;
  mode: string;
  account: string;
  txnId: string;
  physicalReceiptNo: string;
  amount: number;
  baseAmount: number;
  dueDate: string;
  feeFrom: string;
  feeTo: string;
  requestId: string;
}

interface AddFeeResponse extends RpcEnvelope {
  receiptNo?: string;
  note?: string;
}

const selectCls =
  "flex h-11 w-full rounded-2xl border border-dash-fg/12 bg-dash-sidebar px-4 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60";

export default function FounderFeesPage() {
  return (
    <React.Suspense fallback={null}>
      <FounderFeesPageInner />
    </React.Suspense>
  );
}

function FounderFeesPageInner() {
  const { data: boot } = useBootstrap();
  const modes = boot?.paymentModes?.length ? boot?.paymentModes : MODE_DEFAULTS;
  const searchParams = useSearchParams();
  const presetId = (searchParams.get("studentId") || searchParams.get("student") || "").trim();

  const [student, setStudent] = React.useState<Student | null>(null);
  const [amount, setAmount] = React.useState("");
  const [mode, setMode] = React.useState("Cash");
  const [payDate, setPayDate] = React.useState(todayISO());
  const [reference, setReference] = React.useState("");
  const [receiptBook, setReceiptBook] = React.useState("");
  const [feeFrom, setFeeFrom] = React.useState("");
  const [feeTo, setFeeTo] = React.useState("");
  const [success, setSuccess] = React.useState<AddFeeResponse | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const requestIdRef = React.useRef(`RCP-${Date.now()}`);

  const presetSearch = useStudentSearch(presetId, { mode: "founder" }, { enabled: !!presetId });
  const [autoSelectedFor, setAutoSelectedFor] = React.useState("");
  React.useEffect(() => {
    if (!presetId || autoSelectedFor === presetId) return;
    const rows = presetSearch.data?.results ?? presetSearch.data?.rows ?? [];
    const match = rows.find((r) => r.studentId === presetId);
    if (match) {
      setStudent(match);
      setAutoSelectedFor(presetId);
    }
  }, [presetId, presetSearch.data, autoSelectedFor]);

  // The amount owed right now, according to the student's own plan — founder
  // can still edit it (e.g. multiple cycles overdue), this is just a start.
  React.useEffect(() => {
    if (student?.monthlyFee) setAmount(String(student.monthlyFee));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.studentId]);

  const isCash = mode.toUpperCase().includes("CASH");
  const amountNum = Number(amount);
  const valid = !!student && Number.isFinite(amountNum) && amountNum > 0 && (isCash ? receiptBook.trim().length > 0 : reference.trim().length > 0);

  const addFee = useMutationRpc<AddFeeArg, AddFeeResponse>("api_addFeePayment", {
    onSuccess: (res) => {
      setSuccess(res);
      toast.success(res.receiptNo ? `Receipt ${res.receiptNo} recorded` : "Payment recorded");
    },
    onError: (err) => toast.error(err.message),
  });

  const reset = () => {
    setStudent(null);
    setAmount("");
    setReference("");
    setReceiptBook("");
    setFeeFrom("");
    setFeeTo("");
    setSuccess(null);
    requestIdRef.current = `RCP-${Date.now()}`;
  };

  const submit = () => {
    if (!student || !valid) return;
    addFee.mutate({
      studentId: student.studentId,
      studentName: student.studentName,
      phone: student.phone,
      classCode: student.classCode,
      paymentMode: mode,
      mode: accFor(mode),
      account: accFor(mode),
      txnId: isCash ? "" : reference.trim(),
      physicalReceiptNo: isCash ? receiptBook.trim() : "",
      amount: amountNum,
      baseAmount: amountNum,
      dueDate: payDate,
      feeFrom,
      feeTo,
      requestId: requestIdRef.current,
    });
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-6">
      <motion.div variants={fadeUp}>
        <p className="text-xs uppercase tracking-[0.16em] text-dash-fg/40">Money</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">Fee Collection</h1>
        <p className="mt-1 text-sm text-dash-fg/55">Record a real receipt — locked, countered and audited server-side.</p>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {presetId && !student && presetSearch.isFetching ? (
            <Skeleton className="h-24 bg-dash-fg/[0.04]" />
          ) : (
            <StudentPicker student={student} onSelect={setStudent} />
          )}

          <Card className="border-dash-fg/10 bg-dash-card">
            <CardContent className="space-y-4 pt-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-dash-fg/70">Amount (₹)</Label>
                  <Input
                    type="number"
                    min="1"
                    inputMode="decimal"
                    placeholder="e.g. 1250"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
                  />
                  {student && (
                    <p className="text-xs text-dash-fg/40">
                      Starting estimate from their plan — raise it if more than one cycle is owed.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-dash-fg/70">Mode</Label>
                  <select className={selectCls} value={mode} onChange={(e) => setMode(e.target.value)}>
                    {modes.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-dash-fg/70">Payment date</Label>
                <Input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-dash-fg/70">
                  {isCash ? "Receipt-book number" : "Reference / UTR"}
                </Label>
                <Input
                  value={isCash ? receiptBook : reference}
                  onChange={(e) => (isCash ? setReceiptBook(e.target.value) : setReference(e.target.value))}
                  placeholder={isCash ? "Physical receipt-book number (required for cash)" : "UPI ref / bank UTR (required for non-cash)"}
                  className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-dash-fg/70">Fee period from</Label>
                  <Input
                    type="date"
                    value={feeFrom}
                    onChange={(e) => {
                      setFeeFrom(e.target.value);
                      if (e.target.value) setFeeTo(addMonths(e.target.value, 1));
                    }}
                    className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-dash-fg/70">Fee period to</Label>
                  <Input
                    type="date"
                    value={feeTo}
                    onChange={(e) => setFeeTo(e.target.value)}
                    className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
                  />
                </div>
              </div>

              {success ? (
                <div className="space-y-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle2 className="h-5 w-5" />
                    <p className="text-sm font-semibold">
                      Receipt {success.receiptNo} created and recorded.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {success.receiptNo && (
                      <Button asChild size="sm" variant="outline" className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]">
                        <Link href={`/founder/receipts/${encodeURIComponent(success.receiptNo)}`}>
                          View receipt <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={reset}>
                      Record another
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  className="w-full bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
                  onClick={() => setConfirmOpen(true)}
                  disabled={!valid}
                  loading={addFee.isPending}
                >
                  {addFee.isPending ? "Recording…" : "Record receipt"}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {student ? (
            <Card className="border-dash-fg/10 bg-dash-card">
              <CardContent className="space-y-4 pt-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-dash-accent/10 text-dash-accent">
                    <UserRound className="h-5 w-5" aria-hidden />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-dash-fg/50 hover:bg-dash-fg/[0.05] hover:text-dash-fg"
                    onClick={() => setStudent(null)}
                  >
                    Change
                  </Button>
                </div>
                <div>
                  <p className="text-base font-semibold text-dash-fg">{student.studentName}</p>
                  <p className="text-xs text-dash-fg/45">
                    {student.studentId} · {student.classCode} · {student.phone}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-dash-fg/10 pt-4 text-sm">
                  <Detail label="Fee plan" value={student.feePlan || "—"} />
                  <Detail label="Monthly fee" value={inr(student.monthlyFee)} />
                  <Detail label="Fee status" value={student.feeStatus || "—"} />
                  <Detail label="Next due" value={fmtDate(student.nextDueDate)} />
                  <Detail label="Last receipt" value={student.lastReceiptNo || "—"} />
                  <Detail label="Last amount" value={inr(student.lastReceiptAmount)} />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-dash-fg/15 bg-dash-fg/[0.02]">
              <CardContent className="flex min-h-[220px] flex-col items-center justify-center text-center">
                <Banknote className="mb-3 h-8 w-8 text-dash-fg/25" aria-hidden />
                <p className="text-sm font-medium text-dash-fg/70">No student selected</p>
                <p className="mt-1 max-w-[260px] text-xs text-dash-fg/40">
                  Search and pick a student to see their fee plan and record a payment.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="border-dash-fg/10 bg-dash-card">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Record this receipt?</DialogTitle>
            <DialogDescription className="text-dash-fg/50">
              This is a real, locked receipt — it cannot be edited or deleted from the app afterward.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.02] p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-dash-fg/55">Student</span>
              <span className="font-medium text-dash-fg">{student?.studentName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-dash-fg/55">Amount</span>
              <span className="text-base font-semibold text-dash-accent">{inr(amountNum)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-dash-fg/55">Mode</span>
              <span className="font-medium text-dash-fg">{mode}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
              loading={addFee.isPending}
              onClick={() => {
                setConfirmOpen(false);
                submit();
              }}
            >
              Confirm & record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.12em] text-dash-fg/35">{label}</p>
      <p className="mt-0.5 font-medium text-dash-fg/85">{value}</p>
    </div>
  );
}

function StudentPicker({ student, onSelect }: { student: Student | null; onSelect: (s: Student) => void }) {
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const search = useStudentSearch(debounced, { mode: "founder" } satisfies StudentSearchOptions);
  const rows = search.data?.results ?? search.data?.rows ?? [];

  if (student) return null;

  return (
    <Card className="border-dash-fg/10 bg-dash-card">
      <CardContent className="pt-5">
        <Label className="flex items-center gap-2 text-dash-fg/70">
          <Search className="h-4 w-4 text-dash-fg/40" aria-hidden />
          Search student by name or phone
        </Label>
        <div className="mt-2">
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type at least 2 characters…"
            className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
          />
        </div>
        <div className="mt-3 max-h-72 space-y-1 overflow-y-auto no-scrollbar">
          {search.isFetching && rows.length === 0 && debounced.trim().length >= 2 ? (
            <>
              <Skeleton className="h-14 bg-dash-fg/[0.05]" />
              <Skeleton className="h-14 bg-dash-fg/[0.05]" />
            </>
          ) : debounced.trim().length >= 2 && rows.length === 0 && !search.isFetching ? (
            <p className="rounded-2xl border border-dashed border-dash-fg/15 p-6 text-center text-sm text-dash-fg/45">
              No students matched.
            </p>
          ) : (
            rows.map((r) => (
              <button
                key={r.studentId}
                type="button"
                onClick={() => onSelect(r)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-dash-fg/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
              >
                <span className={cn("h-2 w-2 shrink-0 rounded-full", r.status === "ACTIVE" ? "bg-emerald-400" : "bg-dash-fg/25")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-dash-fg">{r.studentName}</span>
                  <span className="block truncate text-xs text-dash-fg/45">
                    {r.studentId} · {r.classCode} · {r.phone}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-dash-fg/30" aria-hidden />
              </button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}