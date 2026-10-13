"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Music2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useTokenAuth } from "@/lib/auth/token-auth";
import { fadeUp } from "@/lib/motion";

type RoleTab = "founder" | "staff";

export default function LoginPage() {
  const { login, error: contextError, clearError } = useTokenAuth();
  const router = useRouter();
  const [tab, setTab] = React.useState<RoleTab>("founder");
  const [token, setToken] = React.useState("");
  const [showToken, setShowToken] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const error = contextError ?? localError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setLocalError("Enter your device token.");
      return;
    }
    setSubmitting(true);
    setLocalError(null);
    const ok = await login(token.trim(), tab);
    if (ok) {
      router.push(tab === "founder" ? "/founder" : "/staff");
    } else {
      setSubmitting(false);
    }
  };

  return (
    <div className="sm-landing relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-12 font-sans">
      <div className="sm-grain" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(36rem 22rem at 50% 28%, rgba(214,168,79,0.22), transparent 62%)," +
            "radial-gradient(30rem 20rem at 50% 32%, rgba(198,59,42,0.08), transparent 60%)",
        }}
      />

      <motion.div
        initial="hidden"
        animate="visible"
        transition={{ staggerChildren: 0.06 }}
        className="relative z-10 w-full max-w-md"
      >
        <motion.div variants={fadeUp} className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#9A7422]/35 bg-[#9A7422]/10 text-[#6E2018] shadow-[0_0_30px_-8px_rgba(154,116,34,0.5)] backdrop-blur-md">
            <Music2 className="h-5 w-5" aria-hidden />
          </div>
          <p className="font-display text-3xl font-semibold tracking-tight text-[#2A1512]">Swar Mangal</p>
          <p className="mt-2 max-w-xs text-sm text-[#2A1512]/60">
            Sign in with the device token issued to your account.
          </p>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="rounded-[28px] border border-[#2A1512]/10 bg-white/70 p-6 shadow-[0_24px_60px_-28px_rgba(110,32,24,0.35)] backdrop-blur-xl"
        >
          <div className="mb-5 flex justify-center">
            <SegmentedControl<RoleTab>
              value={tab}
              onChange={(v) => {
                setTab(v);
                setLocalError(null);
                clearError();
              }}
              options={[
                { value: "founder", label: "Founder" },
                { value: "staff", label: "Staff" },
              ]}
              label="Sign in as"
            />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="device-token" className="text-xs font-medium text-[#2A1512]/70">
                Device token
              </Label>
              <div className="relative">
                <Input
                  id="device-token"
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="••••••••••••••••"
                  required
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="rounded-2xl border-[#2A1512]/15 bg-white/80 pr-11 text-[#2A1512] placeholder:text-[#2A1512]/30 focus-visible:ring-[#9A7422]/50"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((s) => !s)}
                  aria-label={showToken ? "Hide token" : "Show token"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#2A1512]/50 transition-colors hover:bg-[#2A1512]/[0.06] hover:text-[#6E2018] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A7422]/50"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-xl border border-red-400/30 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}

            <Button
              type="submit"
              loading={submitting}
              className="w-full rounded-full bg-[#6E2018] text-[#F7F1E5] shadow-[0_8px_30px_-8px_rgba(110,32,24,0.5)] hover:bg-[#82281D]"
            >
              Sign In
            </Button>
          </form>
        </motion.div>

        <motion.p variants={fadeUp} className="mt-6 text-center">
          <Link
            href="/"
            className="text-xs text-[#2A1512]/50 transition-colors hover:text-[#6E2018] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A7422]/50 focus-visible:ring-offset-2"
          >
            ← Back to home
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
