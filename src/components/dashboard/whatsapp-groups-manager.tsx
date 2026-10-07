"use client";

// Shared WhatsApp Groups screen, rendered by both the founder and staff routes
// (src/app/founder/whatsapp-groups/page.tsx, src/app/staff/whatsapp-groups/page.tsx).
// Founder request 2026-10-07: send a plain message or a poll to a WhatsApp
// GROUP (not a student, not a hand-typed number) through the same WA-AKG
// gateway every other send in this app uses. Same staff-level RPCs as
// api_staff_sendWhatsApp — see src/lib/rpc/messaging.ts.

import * as React from "react";
import { motion } from "framer-motion";
import { ListChecks, MessageCircle, MessagesSquare, Plus, Trash2, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useMutationRpc, useWhatsAppGroups, useWhatsAppStatus } from "@/lib/api/rpc-hooks";
import type { WhatsAppGroupSendResponse } from "@/lib/api/rpc-types";
import { fadeUp, listVariants } from "@/lib/motion";

const selectCls =
  "flex h-11 w-full rounded-2xl border border-dash-fg/12 bg-dash-sidebar px-4 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60";

const MAX_TEXT = 4000;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 12;

type Mode = "message" | "poll";

export function WhatsAppGroupsManager({ eyebrow }: { eyebrow: string }) {
  const status = useWhatsAppStatus();
  const groupsQ = useWhatsAppGroups();
  const groups = React.useMemo(() => groupsQ.data?.groups ?? [], [groupsQ.data]);

  const [jid, setJid] = React.useState("");
  const [mode, setMode] = React.useState<Mode>("message");

  // Default to the first group once the list loads, without fighting a
  // deliberate "no selection" choice if the user clears it.
  React.useEffect(() => {
    if (!jid && groups.length > 0) setJid(groups[0].jid);
  }, [groups, jid]);

  const selectedGroup = groups.find((g) => g.jid === jid) ?? null;
  const sendingEnabled = !!status.data?.enabled && !!status.data?.connected;

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-6">
      <motion.div variants={fadeUp}>
        <p className="text-xs uppercase tracking-[0.16em] text-dash-fg/40">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">WhatsApp Groups</h1>
        <p className="mt-1 max-w-xl text-sm text-dash-fg/55">
          Send a plain message or a poll to a WhatsApp group — separate from messaging a student or typing in a phone
          number by hand.
        </p>
      </motion.div>

      <motion.div variants={fadeUp}>
        <StatusBanner
          isPending={status.isPending}
          enabled={!!status.data?.enabled}
          connected={!!status.data?.connected}
          statusText={status.data?.status}
          error={status.data?.error || status.error?.message}
        />
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card className="border-dash-fg/10 bg-dash-card">
          <CardContent className="space-y-5 p-5">
            <div className="space-y-2">
              <Label className="text-dash-fg/70">Group</Label>
              {groupsQ.isPending ? (
                <Skeleton className="h-11 bg-dash-fg/[0.04]" />
              ) : groups.length === 0 ? (
                <div className="rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.02] p-4 text-xs text-dash-fg/50">
                  <p className="font-medium text-dash-fg/70">No groups found</p>
                  <p className="mt-1">
                    The WhatsApp account connected to the gateway needs to already be a member of a group for it to
                    show up here. Add it to a group from a phone, then reload this page.
                  </p>
                </div>
              ) : (
                <select className={selectCls} value={jid} onChange={(e) => setJid(e.target.value)}>
                  {groups.map((g) => (
                    <option key={g.jid} value={g.jid}>
                      {g.subject}
                    </option>
                  ))}
                </select>
              )}
              {groupsQ.error && <p className="text-xs text-red-400">{groupsQ.error.message}</p>}
            </div>

            {groups.length > 0 && (
              <>
                <SegmentedControl<Mode>
                  label="Send mode"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "message", label: "Send message" },
                    { value: "poll", label: "Send poll" },
                  ]}
                />

                {mode === "message" ? (
                  <SendMessagePanel jid={jid} subject={selectedGroup?.subject} disabled={!sendingEnabled} />
                ) : (
                  <SendPollPanel jid={jid} subject={selectedGroup?.subject} disabled={!sendingEnabled} />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function StatusBanner({
  isPending,
  enabled,
  connected,
  statusText,
  error,
}: {
  isPending: boolean;
  enabled: boolean;
  connected: boolean;
  statusText?: string;
  error?: string;
}) {
  if (isPending) {
    return <Skeleton className="h-14 bg-dash-fg/[0.04]" />;
  }
  const ok = enabled && connected;
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-4 text-sm ${
        ok ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-amber-500/25 bg-amber-500/10 text-amber-300"
      }`}
    >
      {ok ? <Wifi className="h-4 w-4 shrink-0" aria-hidden /> : <WifiOff className="h-4 w-4 shrink-0" aria-hidden />}
      <div className="min-w-0">
        <p className="font-medium">
          {!enabled
            ? "WhatsApp sending is switched off."
            : connected
              ? "WhatsApp gateway connected."
              : "WhatsApp gateway not connected."}
        </p>
        <p className="mt-0.5 text-xs opacity-80">
          {statusText ? `Status: ${statusText}` : null}
          {error ? ` · ${error}` : null}
          {!statusText && !error ? "Sending is disabled until this is enabled and connected." : null}
        </p>
      </div>
    </div>
  );
}

function SendMessagePanel({ jid, subject, disabled }: { jid: string; subject?: string; disabled: boolean }) {
  const [body, setBody] = React.useState("");
  const intentRef = React.useRef(`WA-GROUP-MSG-${Date.now()}`);

  const send = useMutationRpc<
    { jid: string; subject?: string; body: string; clientIntentKey: string },
    WhatsAppGroupSendResponse
  >("api_staff_sendWhatsAppGroupMessage", {
    onSuccess: (res) => {
      toast.success(res.note || "Sent to the group.");
      setBody("");
      intentRef.current = `WA-GROUP-MSG-${Date.now()}`;
    },
    onError: (err) => toast.error(err.message),
  });

  const valid = !!jid && body.trim().length > 0 && body.length <= MAX_TEXT;

  return (
    <div className="space-y-3 border-t border-dash-fg/10 pt-4">
      <div className="space-y-1.5">
        <Label className="text-dash-fg/70">Message</Label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="Type the message to send to the group…"
          className="border-dash-fg/10 bg-dash-surface text-dash-fg"
        />
        <p className="text-right text-[11px] text-dash-fg/35">
          {body.length}/{MAX_TEXT}
        </p>
      </div>
      <Button
        disabled={!valid || disabled}
        loading={send.isPending}
        onClick={() =>
          send.mutate({ jid, subject, body: body.trim(), clientIntentKey: intentRef.current })
        }
        className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
      >
        <MessageCircle className="h-4 w-4" aria-hidden /> Send message
      </Button>
      {disabled && <p className="text-xs text-dash-fg/40">Sending is disabled until WhatsApp is enabled and connected.</p>}
    </div>
  );
}

function SendPollPanel({ jid, subject, disabled }: { jid: string; subject?: string; disabled: boolean }) {
  const [question, setQuestion] = React.useState("");
  const [options, setOptions] = React.useState<string[]>(["", ""]);
  const [allowMultiple, setAllowMultiple] = React.useState(false);
  const intentRef = React.useRef(`WA-GROUP-POLL-${Date.now()}`);

  const send = useMutationRpc<
    { jid: string; subject?: string; question: string; options: string[]; selectableCount: number; clientIntentKey: string },
    WhatsAppGroupSendResponse
  >("api_staff_sendWhatsAppGroupPoll", {
    onSuccess: (res) => {
      toast.success(res.note || "Poll sent to the group.");
      setQuestion("");
      setOptions(["", ""]);
      setAllowMultiple(false);
      intentRef.current = `WA-GROUP-POLL-${Date.now()}`;
    },
    onError: (err) => toast.error(err.message),
  });

  const updateOption = (i: number, value: string) => {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  };
  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((prev) => [...prev, ""]);
  };
  const removeOption = (i: number) => {
    if (options.length <= MIN_OPTIONS) return;
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  };

  const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
  const distinctOptions = new Set(cleanOptions);
  const validOptions = cleanOptions.length >= MIN_OPTIONS && cleanOptions.length <= MAX_OPTIONS && distinctOptions.size === cleanOptions.length;
  const valid = !!jid && question.trim().length > 0 && validOptions;

  const handleSend = () => {
    const selectableCount = allowMultiple ? cleanOptions.length : 1;
    send.mutate({
      jid,
      subject,
      question: question.trim(),
      options: cleanOptions,
      selectableCount,
      clientIntentKey: intentRef.current,
    });
  };

  return (
    <div className="space-y-4 border-t border-dash-fg/10 pt-4">
      <div className="space-y-1.5">
        <Label className="text-dash-fg/70">Question</Label>
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Which Sunday works for the recital?"
          className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-dash-fg/70">
            Options ({cleanOptions.length}/{MAX_OPTIONS})
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addOption}
            disabled={options.length >= MAX_OPTIONS}
            className="text-dash-fg/60 hover:bg-dash-fg/[0.05]"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> Add option
          </Button>
        </div>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                className="border-dash-fg/12 bg-dash-sidebar text-dash-fg"
              />
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                onClick={() => removeOption(i)}
                disabled={options.length <= MIN_OPTIONS}
                aria-label={`Remove option ${i + 1}`}
                className="shrink-0 text-red-300/70 hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          ))}
        </div>
        {!distinctOptions.size || distinctOptions.size !== cleanOptions.length ? (
          cleanOptions.length > 0 && distinctOptions.size !== cleanOptions.length ? (
            <p className="text-xs text-amber-400">Options must be distinct.</p>
          ) : null
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-xs text-dash-fg/70">
        <input
          type="checkbox"
          checked={allowMultiple}
          onChange={(e) => setAllowMultiple(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-dash-fg/20 bg-dash-sidebar accent-dash-accent"
        />
        <ListChecks className="h-3.5 w-3.5" aria-hidden /> Allow multiple answers
      </label>

      <Button
        disabled={!valid || disabled}
        loading={send.isPending}
        onClick={handleSend}
        className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
      >
        <MessagesSquare className="h-4 w-4" aria-hidden /> Send poll
      </Button>
      {disabled && <p className="text-xs text-dash-fg/40">Sending is disabled until WhatsApp is enabled and connected.</p>}
    </div>
  );
}
