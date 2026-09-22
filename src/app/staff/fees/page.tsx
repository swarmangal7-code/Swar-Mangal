"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Banknote, CheckCircle2, Search, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useMutationRpc, useStaffBoot, useStudentSearch } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope, Student } from "@/lib/api/rpc-types";
import { fadeUp, listVariants } from "@/lib/motion";
import { cn, fmtDate, inr, todayISO } from "@/lib/utils/cn";
import { formatINR, feeStatusTone } from "@/app/founder/_shared";

const MODE_DEFAULTS = ["Cash", "UPI", "Bank Transfer", "Cheque"];

const selectCls =
  "flex h-11 w-full rounded-2xl border border-dash-fg/12 bg-dash-sidebar px-4 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60";

interface DraftArg extends Record<string, unknown> {
  studentId: string;
  amount: number;
  paymentMode: string;
  paymentDate: string;
  paymentReference: string;
  physicalReceiptNo: string;
  packageStartDate: string;
  monthsPaid: number;
  notes: string;
  clientIntentKey: string;
}

interface DraftResponse extends RpcEnvelope {
  draftId?: string;
  status?: string;
  note?: string;
}

export default function StaffFeesPage() {
  const boot = useStaffBoot();
  const modes = boot.data?.paymentModes?.length ? boot.data.paymentModes : MODE_DEFAULTS;

  const [student, setStudent] = React.useState<Student | null>(null);
  const [amount, setAmount] = React.useState("");
  const [mode, setMode] = React.useState("Cash");
  const [payDate, setPayDate] = React.useState(todayISO());
  const [reference, setReference] = React.useState("");
  const [receiptBook, setReceiptBook] = React.useState("");
  const [packageStart, setPackageStart] = React.useState("");
  const [months, setMonths] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [success, setSuccess] = React.useState<DraftResponse | null>(null);

  const intentRef = React.useRef(`PDRAFT-${Date.now()}`);

  const isCash = mode.toUpperCase().includes("CASH");
  const amountNum = Number(amount);
  const valid =
    !!student &&
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    (isCash ? receiptBook.trim().length > 0 : reference.trim().length > 0);

  const prepare = useMutationRpc<DraftArg, DraftResponse>("api_staff_prepareReceiptDraft", {
    onSuccess: (res) => {
      setSuccess(res);
      toast.success(res.note ?? "Sent to Sharvil for approval.");
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not send the draft."),
  });

  const reset = () => {
    setStudent(null);
    setAmount("");
    setReference("");
    setReceiptBook("");
    setPackageStart("");
    setMonths("");
    setNotes("");
    setSuccess(null);
    intentRef.current = `PDRAFT-${Date.now()}`;
  };

  const submit = () => {
    if (!student || !valid) return;
    prepare.mutate({
      studentId: student.studentId,
      amount: amountNum,
      paymentMode: mode,
      paymentDate: payDate,
      paymentReference: isCash ? "" : reference.trim(),
      physicalReceiptNo: isCash ? receiptBook.trim() : "",
      packageStartDate: packageStart,
      monthsPaid: Number(months) || 0,
      notes: notes.trim(),
      clientIntentKey: intentRef.current,
    });
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-6">
      <motion.div variants={fadeUp}>
        <p className="text-xs uppercase tracking-[0.16em] text-dash-fg/40">Staff · Money</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">Fee Collection</h1>
        <p className="mt-1 text-sm text-dash-fg/55">
          Record the payment details — Sharvil approves and issues the receipt.
        </p>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <StudentPicker student={student} onSelect={setStudent} />

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
                  max={todayISO()}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-dash-fg/70">{isCash ? "Receipt-book number" : "Reference / UTR"}</Label>
                <Input
                  value={isCash ? receiptBook : reference}
                  onChange={(e) => (isCash ? setReceiptBook(e.target.value) : setReference(e.target.value))}
                  placeholder={isCash ? "Physical receipt-book number (required for cash)" : "UPI ref / bank UTR (required for non-cash)"}
                  className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-dash-fg/70">Package start (optional)</Label>
                  <Input
                    type="date"
                    value={packageStart}
                    onChange={(e) => setPackageStart(e.target.value)}
                    className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-dash-fg/70">Months paid (optional)</Label>
                  <Input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={months}
                    onChange={(e) => setMonths(e.target.value)}
                    placeholder="e.g. 3"
                    className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-dash-fg/70">Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything Sharvil should know"
                  className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
                />
              </div>

              {success ? (
                <div className="space-y-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle2 className="h-5 w-5" aria-hidden />
                    <p className="text-sm font-semibold">
                      {success.note ?? "Sent to Sharvil for approval."}
                    </p>
                  </div>
                  {success.draftId && <p className="font-mono text-xs text-emerald-200/70">{success.draftId}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline" className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]">
                      <Link href="/staff/requests">
                        View my requests <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </Button>
                    <Button size="sm" variant="secondary" onClick={reset}>
                      Record another
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  className="w-full bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
                  onClick={submit}
                  disabled={!valid}
                  loading={prepare.isPending}
                >
                  {prepare.isPending ? "Sending…" : "Send for approval"}
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
                    {[student.studentId, student.classCode, student.phone].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-dash-fg/10 pt-4 text-sm">
                  <Detail label="Fee plan" value={student.feePlan || "—"} />
                  <Detail label="Monthly fee" value={inr(student.monthlyFee)} />
                  <Detail label="Fee status" value={feeStatusTone(student.feeStatus).label} />
                  <Detail label="Next due" value={fmtDate(student.nextDueDate)} />
                  <Detail label="Last receipt" value={student.lastReceiptNo || "—"} />
                  <Detail label="Last amount" value={formatINR(student.lastReceiptAmount)} />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-dash-fg/15 bg-dash-fg/[0.02]">
              <CardContent className="flex min-h-[220px] flex-col items-center justify-center text-center">
                <Banknote className="mb-3 h-8 w-8 text-dash-fg/25" aria-hidden />
                <p className="text-sm font-medium text-dash-fg/70">No student selected</p>
                <p className="mt-1 max-w-[260px] text-xs text-dash-fg/40">
                  Search and pick a student to prepare a fee payment draft.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
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

  const search = useStudentSearch(debounced, { mode: "staff" });
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
                    {[r.studentId, r.classCode, r.phone].filter(Boolean).join(" · ")}
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
