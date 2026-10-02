"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Download, FileText, Share2 } from "lucide-react";
import { toast } from "sonner";

import { useTokenAuth } from "@/lib/auth/token-auth";
import { API_ORIGIN } from "@/lib/api/rpc-client";
import { useMutationRpc, useSchools, rpcKeys } from "@/lib/api/rpc-hooks";
import type { InvoiceOwner, RpcEnvelope } from "@/lib/api/rpc-types";
import { Button } from "@/components/ui/button";
import { SchoolPicker } from "@/components/dashboard/school-picker";
import { InvoicePreview } from "@/components/founder/invoice-preview";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

interface GenerateInvoiceResponse extends RpcEnvelope {
  invoiceId: string;
  invoiceNo: string;
  invoiceDate: string;
  billingPeriodFrom: string;
  billingPeriodTo: string;
  branch: string;
  schoolId?: string;
  schoolCode?: string;
  schoolName?: string;
  schoolAddress?: string;
  schoolContact?: string;
  className: string;
  amount: number;
  tenure: string;
  owner1: InvoiceOwner;
  owner2: InvoiceOwner;
  pdfUrl: string;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Last fully-completed calendar month, as "YYYY-MM" — schools are billed in
 *  arrears, so this is the sensible default for a new invoice. */
function defaultBillingMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Mirrors the backend's billingMonthRange for the client-side preview. */
function billingMonthBounds(billingMonth: string): { from: string; to: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(billingMonth);
  if (!m) return { from: "", to: "" };
  const year = Number(m[1]);
  const month = Number(m[2]); // 1-12
  const pad = (n: number) => String(n).padStart(2, "0");
  const from = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${pad(month)}-${pad(lastDay)}`;
  return { from, to };
}

function fmtMonthLabel(billingMonth: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(billingMonth);
  if (!m) return "—";
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(
    new Date(Number(m[1]), Number(m[2]) - 1, 1),
  );
}

export default function FounderNewSchoolInvoicePage() {
  const { session, token } = useTokenAuth();
  const branches = session?.branches?.length ? [...session.branches] : [];

  const [amount, setAmount] = React.useState("");
  const [tenure, setTenure] = React.useState("");
  const [schoolId, setSchoolId] = React.useState("");
  const [branch, setBranch] = React.useState(branches[0] ?? "");
  const [billingMonth, setBillingMonth] = React.useState(defaultBillingMonth());
  const [invoiceDate, setInvoiceDate] = React.useState(todayIso());
  const [schoolAddress, setSchoolAddress] = React.useState("");
  const [created, setCreated] = React.useState<GenerateInvoiceResponse | null>(null);

  const schools = useSchools();
  const selectedSchool = (schools.data?.schools ?? []).find((s) => s.schoolId === schoolId) ?? null;

  // Pre-fill (and reset) the editable address whenever a different school is
  // picked — it's a per-invoice override, not a persisted edit to the school.
  React.useEffect(() => {
    setSchoolAddress(selectedSchool?.address ?? "");
  }, [selectedSchool?.schoolId, selectedSchool?.address]);

  const generateMut = useMutationRpc<Record<string, unknown>, GenerateInvoiceResponse>(
    "api_generateSchoolInvoice",
    { invalidate: [rpcKeys.root] },
  );

  const amountValue = Number(amount);
  const valid = schoolId.length > 0 && Number.isFinite(amountValue) && amountValue > 0;

  const handleGenerate = async () => {
    if (!schoolId) return toast.error("Pick the school this invoice is for.");
    if (!(Number.isFinite(amountValue) && amountValue > 0)) return toast.error("Enter a valid amount.");
    try {
      const res = await generateMut.mutateAsync({
        schoolId,
        amount: amountValue,
        tenure: tenure.trim(),
        branch,
        invoiceDate,
        billingMonth,
        schoolAddress: schoolAddress.trim(),
      });
      setCreated(res);
      toast.success(`Invoice ${res.invoiceNo} generated.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate the invoice.");
    }
  };

  const handleDownload = () => {
    if (!created) return;
    window.open(`${API_ORIGIN}/api/pdf/invoice/${encodeURIComponent(created.invoiceId)}?token=${encodeURIComponent(token)}`, "_blank", "noopener,noreferrer");
  };

  const handleShare = async () => {
    if (!created) return;
    const text = `Invoice ${created.invoiceNo} · ${created.schoolName} · ${inr.format(created.amount)}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `School invoice ${created.invoiceNo}`, text });
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

  const previewInvoice = created;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/founder/school-invoice"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-dash-fg/50 transition-colors hover:text-dash-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          School invoices
        </Link>
        <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-dash-fg/40">
          Founder · Academy
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">
          Generate invoice
        </h1>
        <p className="mt-1 text-sm text-dash-fg/55">
          Allocate an invoice number and issue it to the school.
        </p>
      </div>

      {created && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-emerald-200">
              Invoice {created.invoiceNo} generated
            </p>
            <p className="mt-0.5 text-xs text-emerald-200/70">
              {created.schoolName} · {inr.format(created.amount)} · {created.branch}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                asChild
                size="sm"
                className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
              >
                <Link href={`/founder/school-invoice/${created.invoiceId}`}>
                  View invoice
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownload}
                className="border-emerald-400/30 text-emerald-100 hover:bg-emerald-500/10"
              >
                <Download className="h-4 w-4" aria-hidden />
                Download
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleShare}
                className="border-emerald-400/30 text-emerald-100 hover:bg-emerald-500/10"
              >
                <Share2 className="h-4 w-4" aria-hidden />
                Share
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="space-y-4 rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.03] p-5">
          <h2 className="text-sm font-semibold text-dash-fg/80">Invoice details</h2>

          <SchoolPicker value={schoolId} onChange={setSchoolId} canAdd />

          {selectedSchool && (
            <div>
              <label htmlFor="inv-school-address" className="mb-1.5 block text-xs font-medium text-dash-fg/70">
                School address
              </label>
              <textarea
                id="inv-school-address"
                value={schoolAddress}
                onChange={(e) => setSchoolAddress(e.target.value)}
                disabled={!!created}
                rows={2}
                placeholder="No address on file — enter one for this invoice"
                className="w-full rounded-2xl border border-dash-fg/15 bg-dash-bg px-4 py-2.5 text-sm text-dash-fg placeholder:text-dash-fg/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60 disabled:opacity-60"
              />
              <p className="mt-1 text-[11px] text-dash-fg/40">
                Only for this invoice — won&rsquo;t change the school&rsquo;s saved address.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="inv-amount" className="mb-1.5 block text-xs font-medium text-dash-fg/70">
              Amount (₹)
            </label>
            <input
              id="inv-amount"
              type="number"
              min={0}
              inputMode="numeric"
              onWheel={(e) => e.currentTarget.blur()}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!!created}
              placeholder="e.g. 9000"
              className="h-11 w-full rounded-2xl border border-dash-fg/15 bg-dash-bg px-4 text-sm text-dash-fg placeholder:text-dash-fg/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60 disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="inv-tenure" className="mb-1.5 block text-xs font-medium text-dash-fg/70">
              Tenure
            </label>
            <input
              id="inv-tenure"
              value={tenure}
              onChange={(e) => setTenure(e.target.value)}
              disabled={!!created}
              placeholder="e.g. 1 Month / 6 Months"
              className="h-11 w-full rounded-2xl border border-dash-fg/15 bg-dash-bg px-4 text-sm text-dash-fg placeholder:text-dash-fg/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60 disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="inv-billing-month" className="mb-1.5 block text-xs font-medium text-dash-fg/70">
                Billing period
              </label>
              <input
                id="inv-billing-month"
                type="month"
                value={billingMonth}
                onChange={(e) => setBillingMonth(e.target.value)}
                disabled={!!created}
                className="h-11 w-full rounded-2xl border border-dash-fg/15 bg-dash-bg px-3 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60 disabled:opacity-60"
              />
            </div>
            <div>
              <label htmlFor="inv-date" className="mb-1.5 block text-xs font-medium text-dash-fg/70">
                Invoice date
              </label>
              <input
                id="inv-date"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                disabled={!!created}
                className="h-11 w-full rounded-2xl border border-dash-fg/15 bg-dash-bg px-3 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60 disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label htmlFor="inv-branch" className="mb-1.5 block text-xs font-medium text-dash-fg/70">
              Branch
            </label>
            <select
              id="inv-branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              disabled={!!created || branches.length <= 1}
              className="h-11 w-full rounded-2xl border border-dash-fg/15 bg-dash-bg px-3 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60 disabled:opacity-60"
            >
              {branches.length === 0 && <option value="">Default</option>}
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <p className="text-xs text-dash-fg/50">
            Bills for all of <span className="font-medium text-dash-fg/70">{fmtMonthLabel(billingMonth)}</span>, per the calendar.
          </p>

          <Button
            onClick={handleGenerate}
            disabled={!valid || !!created}
            loading={generateMut.isPending}
            className="w-full bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
          >
            <FileText className="h-4 w-4" aria-hidden />
            {created ? "Invoice generated" : "Generate invoice"}
          </Button>
          {created && (
            <Button
              variant="ghost"
              onClick={() => {
                setCreated(null);
                setAmount("");
                setTenure("");
                setBillingMonth(defaultBillingMonth());
                setInvoiceDate(todayIso());
                setSchoolAddress(selectedSchool?.address ?? "");
              }}
              className="w-full text-dash-fg/60 hover:bg-dash-fg/[0.05] hover:text-dash-fg"
            >
              Generate another
            </Button>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-dash-fg/80">Invoice preview</h2>
          <InvoicePreview
            invoiceNo={previewInvoice?.invoiceNo ?? "—"}
            invoiceDate={invoiceDate}
            billingPeriodFrom={previewInvoice?.billingPeriodFrom ?? billingMonthBounds(billingMonth).from}
            billingPeriodTo={previewInvoice?.billingPeriodTo ?? billingMonthBounds(billingMonth).to}
            className={previewInvoice?.className ?? ""}
            amount={previewInvoice ? previewInvoice.amount : Number(amount) || 0}
            tenure={tenure}
            branch={previewInvoice?.branch ?? branch}
            schoolCode={previewInvoice?.schoolCode ?? ""}
            schoolName={previewInvoice?.schoolName ?? ""}
            schoolAddress={previewInvoice?.schoolAddress ?? schoolAddress}
            schoolContact={previewInvoice?.schoolContact ?? ""}
            owner1={previewInvoice?.owner1}
            owner2={previewInvoice?.owner2}
          />
        </div>
      </div>
    </div>
  );
}