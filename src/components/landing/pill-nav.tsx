"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/**
 * First-viewport chrome: an ivory-glass pill badge top-left
 * ("Swar Mangal · Mumbai", mono telemetry voice) and a small circular
 * icon button top-right (→ login). Not a full nav bar — the hero's own
 * CTAs carry navigation weight, this is identity + one affordance.
 */
export function PillNav() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 pt-6 sm:px-8 sm:pt-8">
      <span className="sm-telemetry pointer-events-auto inline-flex items-center gap-2 rounded-full border border-[#2A1512]/10 bg-white/70 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[#2A1512] shadow-[0_1px_2px_rgba(42,21,18,0.06)] backdrop-blur-md">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#C63B2A]" />
        Swar Mangal · Mumbai
      </span>
      <Link
        href="/login"
        aria-label="Student / staff login"
        className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#2A1512]/10 bg-white/70 text-[#2A1512] shadow-[0_1px_2px_rgba(42,21,18,0.06)] backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-[#9A7422]/50 hover:text-[#7A5A1A]"
      >
        <ArrowUpRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}
