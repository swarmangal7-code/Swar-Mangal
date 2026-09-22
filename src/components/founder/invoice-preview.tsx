"use client";

import type { InvoiceOwner } from "@/lib/api/rpc-types";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function InvoicePreview({
  invoiceNo,
  invoiceDate,
  className,
  amount,
  tenure,
  branch,
  owner1,
  owner2,
}: {
  invoiceNo: string;
  invoiceDate: string;
  className: string;
  amount: number;
  tenure: string;
  branch: string;
  owner1?: InvoiceOwner;
  owner2?: InvoiceOwner;
}) {
  const fmtDate = invoiceDate
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(
        new Date(invoiceDate),
      )
    : "—";

  return (
    <div className="overflow-hidden rounded-2xl border border-dash-fg/10 bg-dash-fg text-dash-card shadow-soft-lg">
      <div className="flex items-start justify-between border-b border-dash-card/10 p-6">
        <div>
          <p className="font-display text-lg font-semibold tracking-wide">Swar Mangal</p>
          <p className="text-xs text-dash-card/55">Music Academy</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-dash-card/45">
            Tax Invoice
          </p>
          <p className="mt-1 font-mono text-sm font-semibold">{invoiceNo}</p>
          <p className="text-xs text-dash-card/55">{fmtDate}</p>
        </div>
      </div>

      <div className="grid gap-4 p-6 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-dash-card/45">
            Billed to
          </p>
          <p className="mt-1 text-sm font-semibold">{className || "—"}</p>
          <p className="text-xs text-dash-card/55">{branch || "—"}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-dash-card/45">
            Amount
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{inr.format(amount)}</p>
          {tenure && <p className="text-xs text-dash-card/55">Tenure: {tenure}</p>}
        </div>
      </div>

      <div className="mx-6 mb-6 rounded-xl border border-dash-card/10">
        <div className="flex items-center justify-between border-b border-dash-card/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-dash-card/45">
          <span>Description</span>
          <span>Amount</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span>{className ? `${className} classes` : "Music tuition"}</span>
          <span className="font-semibold tabular-nums">{inr.format(amount)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-dash-card/10 p-6">
        <SignatureBlock owner={owner1} fallback="Owner 1" />
        <SignatureBlock owner={owner2} fallback="Owner 2" />
      </div>
    </div>
  );
}

function SignatureBlock({ owner, fallback }: { owner?: InvoiceOwner; fallback: string }) {
  return (
    <div>
      <div className="flex h-14 items-end">
        {owner?.signatureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={owner.signatureUrl} alt="" className="max-h-14" />
        ) : (
          <div className="h-12 w-full border-b border-dashed border-dash-card/25" />
        )}
      </div>
      <p className="mt-1.5 text-sm font-semibold">{owner?.name ?? fallback}</p>
      <p className="text-xs text-dash-card/55">{owner?.title ?? "Signature"}</p>
    </div>
  );
}