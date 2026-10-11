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

      <motion.div
        initial="hidden"
        animate="visible"
        transition={{ staggerChildren: 0.06 }}
        className="relative z-10 w-full max-w-md"
      >
        <motion.div variants={fadeUp} className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#15141A]/10 bg-white/70 text-[#8A6A26] shadow-[0_1px_2px_rgba(21,20,26,0.04)] backdrop-blur-md">
            <Music2 className="h-5 w-5" aria-hidden />
          </div>
          <p className="font-display text-2xl font-extrabold tracking-tight text-[#15141A]">Swar Mangal</p>
          <p className="mt-2 max-w-xs text-sm text-[#15141A]/60">
            Sign in with the device token issued to your account.
          </p>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="rounded-[28px] border border-[#15141A]/10 bg-white/70 p-6 shadow-[0_24px_60px_-24px_rgba(21,20,26,0.3)] backdrop-blur-xl"
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
              <Label htmlFor="device-token" className="text-xs font-medium text-[#15141A]/70">
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
                  className="rounded-2xl border-[#15141A]/15 bg-white/80 pr-11 text-[#15141A] placeholder:text-[#15141A]/30 focus-visible:ring-[#D6A84F]/60"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((s) => !s)}
                  aria-label={showToken ? "Hide token" : "Show token"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#15141A]/50 transition-colors hover:bg-[#15141A]/[0.06] hover:text-[#15141A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D6A84F]/60"
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
              className="w-full rounded-full bg-[#15141A] text-[#F6F4EF] shadow-[0_8px_30px_-8px_rgba(21,20,26,0.4)] hover:bg-[#232029]"
            >
              Sign In
            </Button>
          </form>
        </motion.div>

        <motion.p variants={fadeUp} className="mt-6 text-center">
          <Link
            href="/"
            className="text-xs text-[#15141A]/50 transition-colors hover:text-[#8A6A26] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D6A84F]/60 focus-visible:ring-offset-2"
          >
            ← Back to home
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
