"use client";

export const runtime = "edge";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Music, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type TermsState = "LOADING" | "OPEN" | "ACCEPTED" | "EXPIRED" | "NOT_FOUND" | "ERROR";

export default function TermsAcceptancePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [state, setState] = useState<TermsState>("LOADING");
  const [studentName, setStudentName] = useState("");
  const [acceptedAt, setAcceptedAt] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/terms/${token}`)
      .then((r) => r.json())
      .then((b) => {
        if (cancelled) return;
        setState(b.ok ? (b.state as TermsState) : "ERROR");
        setStudentName(b.studentName ?? "");
        setAcceptedAt(b.acceptedAt ?? "");
      })
      .catch(() => !cancelled && setState("ERROR"));
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function accept() {
    setBusy(true);
    try {
      const r = await fetch(`/api/terms/${token}`, { method: "POST" });
      const b = await r.json();
      if (b.ok) {
        setState("ACCEPTED");
        setAcceptedAt(b.acceptedAt ?? "");
      } else {
        setState(r.status === 410 ? "EXPIRED" : "ERROR");
      }
    } catch {
      setState("ERROR");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lavender-100/80 text-lavender-700 dark:bg-lavender-500/15 dark:text-lavender-300">
          <Music className="h-6 w-6" />
        </span>
        <p className="text-eyebrow mt-6">Swar Mangal</p>
        <h1 className="text-h1 mt-1">Admission terms</h1>

        {state === "LOADING" && <p className="mt-4 text-body-sm text-muted-foreground">Loading…</p>}

        {state === "OPEN" && (
          <>
            {studentName && <p className="mt-1.5 text-body-sm text-muted-foreground">For {studentName}</p>}
            <div className="mt-6 rounded-2xl border border-border p-4 text-left text-body-sm text-muted-foreground">
              By tapping Accept below, you confirm you have read and agree to Swar Mangal&apos;s admission
              terms and conditions, including the academy&apos;s fee, attendance, and cancellation policies.
            </div>
            <Button className="mt-6 w-full" disabled={busy} onClick={accept}>
              {busy ? "Submitting…" : "Accept"}
            </Button>
          </>
        )}

        {state === "ACCEPTED" && (
          <>
            <CheckCircle2 className="mt-6 h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            <p className="mt-3 text-body-sm text-muted-foreground text-balance">
              Terms accepted{acceptedAt ? ` on ${acceptedAt.slice(0, 10)}` : ""}. Nothing more is needed from you.
            </p>
          </>
        )}

        {state === "EXPIRED" && (
          <p className="mt-4 text-body-sm text-muted-foreground text-balance">
            This link has expired. Please ask the academy to send a new one.
          </p>
        )}

        {(state === "NOT_FOUND" || state === "ERROR") && (
          <p className="mt-4 text-body-sm text-muted-foreground text-balance">
            This link is not valid. Please ask the academy to send a new one.
          </p>
        )}
      </div>
    </div>
  );
}
