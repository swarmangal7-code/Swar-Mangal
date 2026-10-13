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
    <div className="sm-landing relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-10 font-sans">
      <div className="sm-grain" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(36rem 22rem at 50% 30%, rgba(214,168,79,0.12), transparent 62%)," +
            "radial-gradient(30rem 20rem at 50% 34%, rgba(178,58,72,0.12), transparent 60%)",
        }}
      />
      <div className="relative z-10 mx-auto flex w-full max-w-sm flex-col items-center text-center">
        <div className="w-full rounded-[28px] border border-white/10 bg-white/[0.04] p-7 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          {/* Brand mark as an icon+wordmark lockup, not a kicker: the
              craft floor bans an uppercase label announcing the heading
              below it outright ("no brief earns it back"). This is the
              same identity lockup as the landing page's nav pill, just
              stacked for a narrow form card — the heading still carries
              its own weight. */}
          <div className="flex flex-col items-center gap-2">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D6A84F]/30 bg-[#D6A84F]/10 text-[#E8C57C]">
              <Music className="h-6 w-6" />
            </span>
            <span className="text-sm font-semibold text-[#F4EDE1]/70">Swar Mangal</span>
          </div>
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-[#F4EDE1]">
            Enroll a student
          </h1>

          {state === "LOADING" && <p className="mt-4 text-body-sm text-[#F4EDE1]/55">Loading…</p>}

          {state === "OPEN" && (
            <div className="mt-6 w-full space-y-4 text-left">
              <div className="space-y-1.5">
                <Label className="text-[#F4EDE1]/70">Student&apos;s full name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="border-white/10 bg-black/30 text-[#F4EDE1] placeholder:text-[#F4EDE1]/30 focus-visible:ring-[#D6A84F]/60" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#F4EDE1]/70">Guardian&apos;s name *</Label>
                <Input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="Parent / guardian name" className="border-white/10 bg-black/30 text-[#F4EDE1] placeholder:text-[#F4EDE1]/30 focus-visible:ring-[#D6A84F]/60" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#F4EDE1]/70">Contact number *</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" type="tel" className="border-white/10 bg-black/30 text-[#F4EDE1] placeholder:text-[#F4EDE1]/30 focus-visible:ring-[#D6A84F]/60" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#F4EDE1]/70">Email (optional)</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" type="email" className="border-white/10 bg-black/30 text-[#F4EDE1] placeholder:text-[#F4EDE1]/30 focus-visible:ring-[#D6A84F]/60" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#F4EDE1]/70">Preferred instrument *</Label>
                <Input value={instrument} onChange={(e) => setInstrument(e.target.value)} placeholder="e.g. Keyboard, Vocals, Tabla" className="border-white/10 bg-black/30 text-[#F4EDE1] placeholder:text-[#F4EDE1]/30 focus-visible:ring-[#D6A84F]/60" />
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-body-sm text-[#F4EDE1]/60">
                By checking the box below, you confirm you have read and agree to Swar Mangal&apos;s admission
                terms and conditions, including the academy&apos;s fee, attendance, and cancellation policies.
              </div>
              <label className="flex items-start gap-2 text-body-sm text-[#F4EDE1]/60">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-[#D6A84F]"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
                I accept the Terms &amp; Conditions
              </label>
              {error && <p className="text-body-sm text-red-300">{error}</p>}
              <Button
                className="w-full rounded-full bg-[#D6A84F] text-[#17100A] shadow-[0_8px_30px_-8px_rgba(214,168,79,0.55)] hover:bg-[#E8C57C]"
                disabled={busy}
                onClick={submit}
              >
                {busy ? "Submitting…" : "Enroll"}
              </Button>
            </div>
          )}

          {state === "SUBMITTED" && (
            <>
              <CheckCircle2 className="mx-auto mt-6 h-10 w-10 text-emerald-400" />
              <p className="mt-3 text-body-sm text-[#F4EDE1]/60 text-balance">
                Thank you! The academy has received your details and will be in touch shortly.
              </p>
            </>
          )}

          {state === "USED" && (
            <p className="mt-4 text-body-sm text-[#F4EDE1]/60 text-balance">
              This link has already been used. Please ask the academy to send a new one.
            </p>
          )}

          {state === "EXPIRED" && (
            <p className="mt-4 text-body-sm text-[#F4EDE1]/60 text-balance">
              This link has expired. Please ask the academy to send a new one.
            </p>
          )}

          {(state === "NOT_FOUND" || state === "ERROR") && (
            <p className="mt-4 text-body-sm text-[#F4EDE1]/60 text-balance">
              This link is not valid. Please ask the academy to send a new one.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
