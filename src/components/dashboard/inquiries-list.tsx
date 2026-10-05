"use client";

// Shared Inquiries list, rendered by both the staff and founder routes
// (src/app/staff/inquiries/page.tsx, src/app/founder/inquiries/page.tsx).
// Founder request 2026-10-05: bring the web inquiries screen to parity with
// the Flutter app's lib/screens/shared/inquiries_screen.dart — an instrument
// filter, a lead-type (new vs. former-student win-back) filter, and an
// "actionable only / Today" toggle, all computed client-side over the rows
// the existing api_staff_inquiryQueue call already fetches. Also gives the
// founder a web Inquiries screen for the first time (previously staff-only).

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, Filter, MessageSquareText, Phone, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { useInquiries, useMutationRpc } from "@/lib/api/rpc-hooks";
import type { Inquiry, RpcEnvelope } from "@/lib/api/rpc-types";
import { useTokenAuth } from "@/lib/auth/token-auth";
import { fadeUp, listVariants } from "@/lib/motion";
import { cn } from "@/lib/utils/cn";
import { formatDateOnly } from "@/app/founder/_shared";

interface QuickAddArg extends Record<string, unknown> {
  name: string;
  phone: string;
  instrument: string;
  branch: string;
  notes: string;
}
interface QuickAddResponse extends RpcEnvelope {
  inquiryId?: string;
}

/** Matches the server's TERMINAL_INQUIRY_STATUSES (rules.ts) and the
 *  Flutter model's Inquiry.actionable getter exactly: a converted, dropped,
 *  or dormant lead needs no further action today. */
const TERMINAL_INQUIRY_STATUSES = new Set(["CONVERTED", "DROPPED", "DORMANT"]);
function isActionable(status: string): boolean {
  return !TERMINAL_INQUIRY_STATUSES.has((status ?? "").toUpperCase());
}

/** '' (no preference) is a real, selectable filter value distinct from
 *  undefined (any instrument) — mirrors the Flutter screen's `String?
 *  _instrumentFilter` (null = any, '' = no preference, else exact match). */
const ANY_INSTRUMENT = undefined;
const NO_PREFERENCE = "";
type LeadTypeFilter = "ALL" | "NEW" | "EXISTING";

function statusTone(status: string) {
  const s = (status ?? "").toUpperCase();
  if (s === "CONVERTED") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (s === "DROPPED") return "border-red-400/30 bg-red-400/10 text-red-300";
  if (s === "DORMANT") return "border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/60";
  if (s === "TRIAL_SCHEDULED" || s === "TRIAL_DONE") return "border-sky-400/30 bg-sky-400/10 text-sky-300";
  return "border-amber-400/30 bg-amber-400/10 text-amber-300";
}

export function InquiriesList({ basePath, eyebrow }: { basePath: string; eyebrow: string }) {
  const { session } = useTokenAuth();
  const branches = session?.branches ?? [];
  const [branch, setBranch] = React.useState(branches.length === 1 ? branches[0] : "ALL");
  const [q, setQ] = React.useState("");
  const [showAdd, setShowAdd] = React.useState(false);

  // Flutter default: _actionableOnly starts true ("Today").
  const [actionableOnly, setActionableOnly] = React.useState(true);
  const [leadTypeFilter, setLeadTypeFilter] = React.useState<LeadTypeFilter>("ALL");
  const [instrumentFilter, setInstrumentFilter] = React.useState<string | undefined>(ANY_INSTRUMENT);

  const inquiries = useInquiries(branch);
  const all = React.useMemo(() => inquiries.data?.rows ?? [], [inquiries.data]);
  const callToday = inquiries.data?.callToday ?? [];

  // Built from the already-fetched rows, not a separate call — same as the
  // Flutter screen's `_instrumentOptions` getter.
  const instrumentOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of all) {
      const v = (r.instrument ?? "").trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [all]);

  // Composition order mirrors the Flutter screen's `_filtered` getter:
  // actionable -> instrument -> lead type. The text search is a web-only
  // addition on top, applied last.
  const filtered = React.useMemo(() => {
    let list = actionableOnly ? all.filter((r) => isActionable(r.status)) : all;
    if (instrumentFilter !== ANY_INSTRUMENT) {
      list = list.filter((r) => (r.instrument ?? "").trim() === instrumentFilter);
    }
    if (leadTypeFilter === "NEW") {
      list = list.filter((r) => !r.formerStudentId);
    } else if (leadTypeFilter === "EXISTING") {
      list = list.filter((r) => !!r.formerStudentId);
    }
    return list;
  }, [all, actionableOnly, instrumentFilter, leadTypeFilter]);

  const needle = q.trim().toLowerCase();
  const rows = needle
    ? filtered.filter((r) =>
        [r.name, r.phone, r.instrument, r.branch, r.status].join(" ").toLowerCase().includes(needle),
      )
    : filtered;

  const filterActive = leadTypeFilter !== "ALL" || instrumentFilter !== ANY_INSTRUMENT;
  const filterSummary = React.useMemo(() => {
    if (!filterActive) return "Filter";
    const parts: string[] = [];
    if (leadTypeFilter === "NEW") parts.push("New");
    if (leadTypeFilter === "EXISTING") parts.push("Existing");
    if (instrumentFilter === NO_PREFERENCE) parts.push("No preference");
    else if (instrumentFilter !== ANY_INSTRUMENT) parts.push(instrumentFilter);
    return parts.join(" · ");
  }, [filterActive, leadTypeFilter, instrumentFilter]);

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-6">
      <motion.div variants={fadeUp} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-dash-fg/40">{eyebrow}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">Inquiries</h1>
          <p className="mt-1 text-sm text-dash-fg/55">
            {inquiries.data ? `${callToday.length} to call today · ${all.length} total` : "Leads and follow-ups."}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button
            variant={showAdd ? "ghost" : "outline"}
            className={cn(!showAdd && "border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]")}
            onClick={() => setShowAdd((v) => !v)}
          >
            {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showAdd ? "Close" : "Quick add"}
          </Button>
        </div>
      </motion.div>

      {showAdd && (
        <motion.div variants={fadeUp}>
          <QuickAddInquiryForm
            branch={branches.length === 1 ? branches[0] : branch === "ALL" ? "" : branch}
            onSaved={() => {
              setShowAdd(false);
              inquiries.refetch();
            }}
          />
        </motion.div>
      )}

      <motion.div variants={fadeUp} className="relative">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, phone or instrument…"
          className="h-12 border-dash-fg/12 bg-dash-card text-dash-fg placeholder:text-dash-fg/30"
        />
      </motion.div>

      <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Today only"
          value={actionableOnly ? "TODAY" : "ALL"}
          onChange={(v) => setActionableOnly(v === "TODAY")}
          options={[
            { value: "ALL", label: "All" },
            { value: "TODAY", label: "Today" },
          ]}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]",
                filterActive && "border-dash-accent/50 text-dash-accent",
              )}
            >
              <Filter className="h-3.5 w-3.5" aria-hidden /> {filterSummary}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <div className="flex items-center justify-between px-2 py-1.5">
              <DropdownMenuLabel className="p-0 text-dash-fg/90">Filter inquiries</DropdownMenuLabel>
              {filterActive && (
                <button
                  type="button"
                  onClick={() => {
                    setLeadTypeFilter("ALL");
                    setInstrumentFilter(ANY_INSTRUMENT);
                  }}
                  className="text-xs font-medium text-dash-accent hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-dash-fg/50">Lead type</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={leadTypeFilter} onValueChange={(v) => setLeadTypeFilter(v as LeadTypeFilter)}>
              <DropdownMenuRadioItem value="ALL" onSelect={(e) => e.preventDefault()}>
                All leads
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="NEW" onSelect={(e) => e.preventDefault()}>
                New
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="EXISTING" onSelect={(e) => e.preventDefault()}>
                Existing (win-back)
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-dash-fg/50">Instrument</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={instrumentFilter === ANY_INSTRUMENT ? "__ANY__" : instrumentFilter}
              onValueChange={(v) => setInstrumentFilter(v === "__ANY__" ? ANY_INSTRUMENT : v)}
            >
              <DropdownMenuRadioItem value="__ANY__" onSelect={(e) => e.preventDefault()}>
                Any
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value={NO_PREFERENCE} onSelect={(e) => e.preventDefault()}>
                No preference
              </DropdownMenuRadioItem>
              {instrumentOptions.map((inst) => (
                <DropdownMenuRadioItem key={inst} value={inst} onSelect={(e) => e.preventDefault()}>
                  {inst}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
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
              {needle || filterActive || actionableOnly ? "Try a different search or filter." : "New leads will appear here."}
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div variants={fadeUp} className="overflow-hidden rounded-2xl border border-dash-fg/10 bg-dash-card">
          <ul className="divide-y divide-dash-fg/[0.06]">
            {rows.map((r: Inquiry) => (
              <li key={r.inquiry_id}>
                <Link
                  href={`${basePath}/${encodeURIComponent(r.inquiry_id)}`}
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

/** Mirrors the Flutter app's `_InquiryForm` (lib/screens/shared/inquiries_screen.dart)
 *  field-for-field: name, phone, instrument, branch, notes via api_staff_inquiryQuickAdd
 *  — the website never had this capability before, only the app did. */
function QuickAddInquiryForm({ branch, onSaved }: { branch: string; onSaved: () => void }) {
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [instrument, setInstrument] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const add = useMutationRpc<QuickAddArg, QuickAddResponse>("api_staff_inquiryQuickAdd", {
    onSuccess: (res) => {
      toast.success(`Inquiry ${res.inquiryId ?? ""} captured.`);
      setName("");
      setPhone("");
      setInstrument("");
      setNotes("");
      onSaved();
    },
    onError: (err) => toast.error(err.message),
  });

  const valid = name.trim().length > 0 || phone.trim().length > 0;

  return (
    <Card className="border-dash-fg/10 bg-dash-card">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-dash-fg/70">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="border-dash-fg/12 bg-dash-sidebar text-dash-fg" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-dash-fg/70">Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="border-dash-fg/12 bg-dash-sidebar text-dash-fg" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-dash-fg/70">Instrument (optional)</Label>
            <Input
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
              placeholder="Leave blank for no preference"
              className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-dash-fg/70">Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="border-dash-fg/12 bg-dash-sidebar text-dash-fg" />
          </div>
        </div>
        {!valid && <p className="text-xs text-dash-fg/40">Enter at least a name or a phone.</p>}
        <Button
          className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
          disabled={!valid}
          loading={add.isPending}
          onClick={() =>
            add.mutate({
              name: name.trim(),
              phone: phone.trim(),
              instrument: instrument.trim(),
              branch,
              notes: notes.trim(),
            })
          }
        >
          Save inquiry
        </Button>
      </CardContent>
    </Card>
  );
}
