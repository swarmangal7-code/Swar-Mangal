"use client";

export const runtime = "edge";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Music, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EnrollState = "LOADING" | "OPEN" | "SUBMITTED" | "EXPIRED" | "NOT_FOUND" | "USED" | "ERROR";

// The page itself is a static export (served from the public marketing
// site); its form submission reaches this app's own API cross-origin, same
// as every other call the Cloudflare-hosted site makes — see
// NEXT_PUBLIC_RPC_URL (already required for the whole site to talk to the
// VPS) and src/app/api/enroll/[token]/route.ts for the matching backend.
function apiBase(): string {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "";
  try {
    return new URL(rpcUrl).origin;
  } catch {
    return "";
  }
}

export default function EnrollPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [state, setState] = useState<EnrollState>("LOADING");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [instrument, setInstrument] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase()}/api/enroll/${token}`)
      .then((r) => r.json())
      .then((b) => {
        if (cancelled) return;
        setState(b.ok ? (b.state as EnrollState) : "ERROR");
      })
      .catch(() => !cancelled && setState("ERROR"));
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit() {
    setError("");
    if (!name.trim() || !guardianName.trim() || !phone.trim() || !instrument.trim()) {
      setError("Please fill in every required field.");
      return;
    }
    if (!termsAccepted) {
      setError("Please accept the terms & conditions to enroll.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${apiBase()}/api/enroll/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          guardianName: guardianName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          instrument: instrument.trim(),
          termsAccepted,
        }),
      });
      const b = await r.json();
      if (b.ok) {
        setState("SUBMITTED");
      } else {
        setState(r.status === 410 ? "EXPIRED" : r.status === 409 ? "USED" : "ERROR");
        setError(b.error ?? "");
      }
    } catch {
      setState("ERROR");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lavender-100/80 text-lavender-700 dark:bg-lavender-500/15 dark:text-lavender-300">
          <Music className="h-6 w-6" />
        </span>
        <p className="text-eyebrow mt-6">Swar Mangal</p>
        <h1 className="text-h1 mt-1">Enroll a student</h1>

        {state === "LOADING" && <p className="mt-4 text-body-sm text-muted-foreground">Loading…</p>}

        {state === "OPEN" && (
          <div className="mt-6 w-full space-y-4 text-left">
            <div className="space-y-1.5">
              <Label>Student&apos;s full name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label>Guardian&apos;s name *</Label>
              <Input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="Parent / guardian name" />
            </div>
            <div className="space-y-1.5">
              <Label>Contact number *</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" type="tel" />
            </div>
            <div className="space-y-1.5">
              <Label>Email (optional)</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" type="email" />
            </div>
            <div className="space-y-1.5">
              <Label>Preferred instrument *</Label>
              <Input value={instrument} onChange={(e) => setInstrument(e.target.value)} placeholder="e.g. Keyboard, Vocals, Tabla" />
            </div>
            <div className="rounded-2xl border border-border p-4 text-body-sm text-muted-foreground">
              By checking the box below, you confirm you have read and agree to Swar Mangal&apos;s admission
              terms and conditions, including the academy&apos;s fee, attendance, and cancellation policies.
            </div>
            <label className="flex items-start gap-2 text-body-sm text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              I accept the Terms &amp; Conditions
            </label>
            {error && <p className="text-body-sm text-red-600 dark:text-red-400">{error}</p>}
            <Button className="w-full" disabled={busy} onClick={submit}>
              {busy ? "Submitting…" : "Enroll"}
            </Button>
          </div>
        )}

        {state === "SUBMITTED" && (
          <>
            <CheckCircle2 className="mt-6 h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            <p className="mt-3 text-body-sm text-muted-foreground text-balance">
              Thank you! The academy has received your details and will be in touch shortly.
            </p>
          </>
        )}

        {state === "USED" && (
          <p className="mt-4 text-body-sm text-muted-foreground text-balance">
            This link has already been used. Please ask the academy to send a new one.
          </p>
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
