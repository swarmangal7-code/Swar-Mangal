"use client";

export const runtime = "edge";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Phone, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useMutationRpc, useRpc } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope } from "@/lib/api/rpc-types";
import { fadeUp, listVariants } from "@/lib/motion";
import { cn, todayISO } from "@/lib/utils/cn";
import { formatDateOnly, formatWhen } from "@/app/founder/_shared";

interface Followup {
  id: string;
  action: string;
  description: string;
  resultingStatus: string;
  nextContactDate: string;
  createdBy: string;
  createdAt: string;
}

interface InquiryDetailResponse extends RpcEnvelope {
  inquiryId: string;
  name: string;
  phone: string;
  course: string;
  branch: string;
  source: string;
  notes: string;
  status: string;
  finalStatus: string;
  createdAt: string;
  nextContactDate: string;
  trialDate: string;
  dropReason: string;
  convertedStudentId: string;
  noAnswerCount: number;
  lastContactedAt: string;
  dormantReason: string;
  formerStudentId: string;
  formerTeacherId: string;
  followups: Followup[];
}

interface TransitionArg extends Record<string, unknown> {
  inquiryId: string;
  action: string;
  nextContactDate: string;
  trialDate: string;
  reason: string;
  studentRef: string;
  note: string;
}

const ACTIONS: { value: string; label: string }[] = [
  { value: "LOG_CONTACT", label: "Log contact" },
  { value: "NO_ANSWER", label: "No answer" },
  { value: "SCHEDULE_TRIAL", label: "Schedule trial" },
  { value: "TRIAL_DONE", label: "Trial done" },
  { value: "CONVERT", label: "Joined" },
  { value: "DROP", label: "Drop" },
  { value: "REOPEN", label: "Reopen" },
];

const TERMINAL = new Set(["CONVERTED", "DROPPED"]);

function statusTone(status: string) {
  const s = (status ?? "").toUpperCase();
  if (s === "CONVERTED") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (s === "DROPPED") return "border-red-400/30 bg-red-400/10 text-red-300";
  if (s === "DORMANT") return "border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/60";
  if (s === "TRIAL_SCHEDULED" || s === "TRIAL_DONE") return "border-sky-400/30 bg-sky-400/10 text-sky-300";
  return "border-amber-400/30 bg-amber-400/10 text-amber-300";
}

function prettyAction(action: string) {
  return action
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

export default function StaffInquiryDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const detail = useRpc<InquiryDetailResponse>("api_staff_inquiryDetail", { inquiryId: id });

  const [action, setAction] = React.useState("LOG_CONTACT");
  const [nextContactDate, setNextContactDate] = React.useState("");
  const [trialDate, setTrialDate] = React.useState(todayISO());
  const [reason, setReason] = React.useState("");
  const [studentRef, setStudentRef] = React.useState("");
  const [note, setNote] = React.useState("");

  const transition = useMutationRpc<TransitionArg, RpcEnvelope>("api_staff_inquiryTransition", {
    onSuccess: (res) => {
      const extra = res as unknown as Record<string, unknown>;
      toast.success(typeof extra.note === "string" && extra.note ? extra.note : "Updated.");
      setNote("");
      setReason("");
      setStudentRef("");
      setNextContactDate("");
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not update the inquiry."),
  });

  const data = detail.data;
  const terminal = data ? TERMINAL.has((data.status ?? "").toUpperCase()) : false;

  const submit = () => {
    if (!data) return;
    transition.mutate({
      inquiryId: id,
      action,
      nextContactDate: action === "LOG_CONTACT" || action === "TRIAL_DONE" ? nextContactDate : "",
      trialDate: action === "SCHEDULE_TRIAL" ? trialDate : "",
      reason: action === "DROP" ? reason.trim() : "",
      studentRef: action === "CONVERT" ? studentRef.trim() : "",
      note: note.trim(),
    });
  };

  if (detail.isError) {
    return (
      <motion.div initial="hidden" animate="visible" variants={listVariants}>
        <Card className="border-red-400/30 bg-red-400/5">
          <CardContent className="pt-5 text-sm text-red-300">
            {detail.error?.message?.replace(/\[.*\]$/, "") || "Could not load this inquiry."}{" "}
            <button type="button" onClick={() => detail.refetch()} className="font-medium text-dash-accent">
              Retry
            </button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (!data) {
    return (
      <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-4">
        <Skeleton className="h-24 bg-dash-fg/[0.04]" />
        <Skeleton className="h-48 bg-dash-fg/[0.04]" />
        <Skeleton className="h-48 bg-dash-fg/[0.04]" />
      </motion.div>
    );
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-5">
      <motion.div variants={fadeUp}>
        <Link
          href="/staff/inquiries"
          className="inline-flex items-center gap-1.5 text-sm text-dash-fg/60 transition-colors hover:text-dash-accent"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to inquiries
        </Link>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card className="border-dash-fg/10 bg-dash-card">
          <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-dash-accent/10 text-dash-accent">
                <UserRound className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold tracking-tight text-dash-fg">{data.name || "Inquiry"}</h1>
                  <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", statusTone(data.status))}>
                    {data.finalStatus || data.status || "—"}
                  </span>
                  {data.noAnswerCount > 0 && <Badge variant="outline">{data.noAnswerCount} no-answers</Badge>}
                  {data.formerStudentId && <Badge variant="peach">Former Student</Badge>}
                  {data.formerTeacherId && <Badge variant="peach">Former Teacher</Badge>}
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-dash-fg/55">
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" aria-hidden />
                    {data.phone || "—"}
                  </span>
                  <span className="text-dash-fg/25">·</span>
                  <span>{[data.course, data.branch, data.source].filter(Boolean).join(" · ")}</span>
                </p>
              </div>
            </div>
            {data.convertedStudentId && (
              <Button asChild size="sm" variant="outline" className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]">
                <Link href={`/staff/students/${encodeURIComponent(data.convertedStudentId)}`}>View student</Link>
              </Button>
            )}
            {data.formerTeacherId && (
              <Button asChild size="sm" variant="outline" className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]">
                <Link href={`/staff/teachers/${encodeURIComponent(data.formerTeacherId)}`}>View teacher</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-5">
        <motion.div variants={fadeUp} className="lg:col-span-2">
          <Card className="border-dash-fg/10 bg-dash-card">
            <CardContent className="space-y-3 pt-5">
              <h2 className="text-sm font-semibold text-dash-fg/90">Details</h2>
              <dl className="space-y-2 text-sm">
                <Row label="Next contact" value={formatDateOnly(data.nextContactDate)} />
                <Row label="Trial date" value={formatDateOnly(data.trialDate)} />
                <Row label="Last contacted" value={formatWhen(data.lastContactedAt)} />
                <Row label="Created" value={formatDateOnly(data.createdAt)} />
                {data.dropReason && <Row label="Drop reason" value={data.dropReason} />}
                {data.dormantReason && <Row label="Dormant" value={data.dormantReason} />}
              </dl>
              {data.notes && (
                <p className="rounded-xl border border-dash-fg/10 bg-dash-fg/[0.02] p-3 text-xs text-dash-fg/70">
                  {data.notes}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} className="space-y-6 lg:col-span-3">
          <Card className="border-dash-fg/10 bg-dash-card">
            <CardContent className="space-y-4 pt-5">
              <h2 className="text-sm font-semibold text-dash-fg/90">Log activity</h2>
              {data.formerTeacherId && (
                <p className="text-xs text-dash-fg/45">
                  This is a former teacher, not a student lead — once they&apos;re formally rehired,
                  Sharvil re-activates them from their teacher profile; use Drop with a note here
                  to close this out.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {ACTIONS.filter((a) => {
                  if (terminal) return a.value === "REOPEN";
                  // A former teacher rejoins the academy, not "trials" and
                  // "joins" the way a fresh admission lead does — those verbs
                  // would otherwise route through the student-conversion flow.
                  if (data.formerTeacherId && ["SCHEDULE_TRIAL", "TRIAL_DONE", "CONVERT"].includes(a.value)) return false;
                  return true;
                }).map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setAction(a.value)}
                    aria-pressed={action === a.value}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60",
                      action === a.value
                        ? "border-dash-accent/50 bg-dash-accent/15 text-dash-accent"
                        : "border-dash-fg/12 text-dash-fg/65 hover:text-dash-fg",
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              {(action === "LOG_CONTACT" || action === "TRIAL_DONE") && (
                <div className="space-y-1.5">
                  <Label className="text-[13px] text-dash-fg/70">
                    Next contact date {action === "LOG_CONTACT" ? "*" : "(optional)"}
                  </Label>
                  <Input
                    type="date"
                    value={nextContactDate}
                    min={todayISO()}
                    onChange={(e) => setNextContactDate(e.target.value)}
                    className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
                  />
                </div>
              )}

              {action === "SCHEDULE_TRIAL" && (
                <div className="space-y-1.5">
                  <Label className="text-[13px] text-dash-fg/70">Trial date *</Label>
                  <Input
                    type="date"
                    value={trialDate}
                    min={todayISO()}
                    onChange={(e) => setTrialDate(e.target.value)}
                    className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
                  />
                </div>
              )}

              {action === "DROP" && (
                <div className="space-y-1.5">
                  <Label className="text-[13px] text-dash-fg/70">Why is it being dropped? *</Label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason"
                    className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
                  />
                </div>
              )}

              {action === "CONVERT" && (
                <div className="space-y-1.5">
                  <Label className="text-[13px] text-dash-fg/70">Student ID (optional)</Label>
                  <Input
                    value={studentRef}
                    onChange={(e) => setStudentRef(e.target.value)}
                    placeholder="STU-… if already added"
                    className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-[13px] text-dash-fg/70">Note (optional)</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What was discussed?"
                  className="border-dash-fg/12 bg-dash-sidebar text-dash-fg placeholder:text-dash-fg/30"
                />
              </div>

              <Button
                className="w-full bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
                loading={transition.isPending}
                disabled={action === "LOG_CONTACT" && !nextContactDate}
                onClick={submit}
              >
                Save activity
              </Button>
            </CardContent>
          </Card>

          <Card className="border-dash-fg/10 bg-dash-card">
            <CardContent className="pt-5">
              <h2 className="mb-3 text-sm font-semibold text-dash-fg/90">Follow-up history</h2>
              {data.followups.length === 0 ? (
                <p className="py-6 text-center text-sm text-dash-fg/45">No activity recorded yet.</p>
              ) : (
                <ul className="divide-y divide-dash-fg/[0.04]">
                  {data.followups.map((f) => (
                    <li key={f.id} className="py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-dash-fg/90">{prettyAction(f.action)}</p>
                        <span className="shrink-0 text-xs text-dash-fg/45">{formatWhen(f.createdAt)}</span>
                      </div>
                      {f.description && <p className="mt-0.5 text-xs text-dash-fg/60">{f.description}</p>}
                      <p className="mt-0.5 text-xs text-dash-fg/40">
                        {[f.resultingStatus, f.nextContactDate && `next ${formatDateOnly(f.nextContactDate)}`, f.createdBy]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[13px] text-dash-fg/45">{label}</dt>
      <dd className="text-right text-[13px] font-medium text-dash-fg/85">{value || "—"}</dd>
    </div>
  );
}
