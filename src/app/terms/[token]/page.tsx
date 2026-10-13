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
    <div className="sm-landing relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 font-sans">
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
            Admission terms
          </h1>

          {state === "LOADING" && <p className="mt-4 text-body-sm text-[#F4EDE1]/55">Loading…</p>}

          {state === "OPEN" && (
            <>
              {studentName && <p className="mt-1.5 text-body-sm text-[#F4EDE1]/60">For {studentName}</p>}
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-left text-body-sm text-[#F4EDE1]/60">
                By tapping Accept below, you confirm you have read and agree to Swar Mangal&apos;s admission
                terms and conditions, including the academy&apos;s fee, attendance, and cancellation policies.
              </div>
              <Button
                className="mt-6 w-full rounded-full bg-[#D6A84F] text-[#17100A] shadow-[0_8px_30px_-8px_rgba(214,168,79,0.55)] hover:bg-[#E8C57C]"
                disabled={busy}
                onClick={accept}
              >
                {busy ? "Submitting…" : "Accept"}
              </Button>
            </>
          )}

          {state === "ACCEPTED" && (
            <>
              <CheckCircle2 className="mx-auto mt-6 h-10 w-10 text-emerald-400" />
              <p className="mt-3 text-body-sm text-[#F4EDE1]/60 text-balance">
                Terms accepted{acceptedAt ? ` on ${acceptedAt.slice(0, 10)}` : ""}. Nothing more is needed from you.
              </p>
            </>
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
