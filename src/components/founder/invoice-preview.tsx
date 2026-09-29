"use client";

import Image from "next/image";
import type { InvoiceOwner } from "@/lib/api/rpc-types";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const MAROON = "#7A1F2B";

/**
 * On-screen preview of a school invoice, styled to match the real maroon
 * letterhead the downloaded PDF uses (src/lib/pdf/InvoiceDocument.tsx) —
 * same logo, same colors, same signatures — so what's shown before
 * downloading isn't a different-looking placeholder.
 */
export function InvoicePreview({
  invoiceNo,
  invoiceDate,
  className,
  amount,
  tenure,
  branch,
  schoolCode,
  schoolName,
  schoolAddress,
  schoolContact,
  owner1,
  owner2,
}: {
  invoiceNo: string;
  invoiceDate: string;
  className: string;
  amount: number;
  tenure: string;
  branch: string;
  schoolCode?: string;
  schoolName?: string;
  schoolAddress?: string;
  schoolContact?: string;
  owner1?: InvoiceOwner;
  owner2?: InvoiceOwner;
}) {
  const fmtDate = invoiceDate
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(
        new Date(invoiceDate),
      )
    : "—";

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E6DDD3] bg-[#FAF6EF] text-[#2B2B2B] shadow-soft-lg">
      <div className="flex items-center justify-between border-b-2 p-6" style={{ borderBottomColor: MAROON }}>
        <div className="flex items-center gap-3">
          <Image src="/brand/logo-mark.png" alt="" width={36} height={36} />
          <div>
            <p className="font-display text-lg font-bold" style={{ color: MAROON }}>
              Swar Mangal™
            </p>
            <p className="text-[10px] tracking-wide text-[#6B6B6B]">MUSIC ACADEMY</p>
          </div>
        </div>
        <p className="font-display text-2xl font-bold text-[#161616]">INVOICE</p>
      </div>

      <div className="grid gap-4 border-b border-[#E6DDD3] bg-[#FAF6EF] p-6 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6B6B6B]">Billed to</p>
          <p className="mt-1 text-sm font-semibold">{schoolName || className || "—"}</p>
          {schoolAddress && <p className="text-xs text-[#6B6B6B]">{schoolAddress}</p>}
          {schoolContact && <p className="text-xs text-[#6B6B6B]">{schoolContact}</p>}
          <p className="text-xs text-[#6B6B6B]">{[branch, schoolCode].filter(Boolean).join(" · ") || "—"}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6B6B6B]">Invoice no. · Date</p>
          <p className="mt-1 text-sm font-semibold" style={{ color: MAROON }}>
            {invoiceNo}
          </p>
          <p className="text-xs text-[#6B6B6B]">{fmtDate}</p>
          {tenure && <p className="text-xs text-[#6B6B6B]">Tenure: {tenure}</p>}
        </div>
      </div>

      <div className="mx-6 my-6 overflow-hidden rounded-lg border border-[#E6DDD3]">
        <div
          className="flex items-center justify-between px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white"
          style={{ backgroundColor: MAROON }}
        >
          <span>Description</span>
          <span>Amount</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span>{className ? `${className} classes` : "Music tuition"}</span>
          <span className="font-semibold tabular-nums">{inr.format(amount)}</span>
        </div>
        <div
          className="flex items-center justify-between px-4 py-2.5 text-sm font-bold text-white"
          style={{ backgroundColor: MAROON }}
        >
          <span>Total due</span>
          <span className="tabular-nums">{inr.format(amount)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-[#E6DDD3] p-6">
        <SignatureBlock owner={owner1} fallback="Sharvil Vaidya" fallbackSrc="/brand/signature-sharvil.png" />
        <SignatureBlock owner={owner2} fallback="Piyush Kashyap" fallbackSrc="/brand/signature-piyush.png" />
      </div>
    </div>
  );
}

function SignatureBlock({
  owner,
  fallback,
  fallbackSrc,
}: {
  owner?: InvoiceOwner;
  fallback: string;
  fallbackSrc: string;
}) {
  const src = owner?.signatureUrl || fallbackSrc;
  return (
    <div>
      <div className="flex h-14 items-end">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="max-h-14" />
      </div>
      <div className="mt-1 border-t border-[#2B2B2B]" />
      <p className="mt-1.5 text-sm font-semibold">{owner?.name ?? fallback}</p>
      <p className="text-xs text-[#6B6B6B]">{owner?.title ?? "Authorised Signatory"}</p>
    </div>
  );
}
