"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Info, LogOut, Mail, Music2, ShieldCheck } from "lucide-react";

import pkg from "../../../../package.json";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTokenAuth } from "@/lib/auth/token-auth";

export default function StaffAboutPage() {
  const { session, logout } = useTokenAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await logout();
    router.replace("/login");
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-dash-fg/40">Staff · Settings</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">About</h1>
        <p className="mt-1 text-sm text-dash-fg/55">App information and your account.</p>
      </div>

      <div className="rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.03] p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-dash-accent/30 bg-dash-accent/10 text-dash-accent">
            <Music2 className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-dash-fg">Swar Mangal — Staff portal</p>
            <p className="text-xs text-dash-fg/45">Music academy operations</p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-dash-fg/10 pt-4 text-sm">
          <div>
            <dt className="text-xs text-dash-fg/45">Version</dt>
            <dd className="mt-0.5 font-mono text-dash-fg">{pkg.version}</dd>
          </div>
          <div>
            <dt className="text-xs text-dash-fg/45">Build</dt>
            <dd className="mt-0.5 font-mono text-dash-fg">web · production</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.03] p-5">
        <h2 className="text-sm font-semibold text-dash-fg/80">Account</h2>
        <div className="mt-4 flex items-center gap-3">
          <Avatar name={session?.name ?? "S"} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-dash-fg">{session?.name ?? "—"}</p>
            <p className="flex items-center gap-1.5 truncate text-xs text-dash-fg/45">
              <Mail className="h-3 w-3" aria-hidden />
              {session?.email ?? "—"}
            </p>
          </div>
          <Badge className="ml-auto border border-dash-accent/30 bg-dash-accent/10 text-dash-accent">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Staff
          </Badge>
        </div>
      </div>

      <div className="rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.03] p-5">
        <h2 className="text-sm font-semibold text-dash-fg/80">Branches</h2>
        {session?.branches?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {session.branches.map((b) => (
              <span
                key={b}
                className="rounded-full border border-dash-fg/15 bg-dash-fg/[0.04] px-3 py-1 text-xs font-medium text-dash-fg/70"
              >
                {b}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-dash-fg/45">No branches assigned to this account.</p>
        )}
      </div>

      <div className="rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.03] p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-dash-fg/[0.04] text-dash-fg/60">
              <Info className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-dash-fg">Appearance</p>
              <p className="text-xs text-dash-fg/45">Switch between light and dark</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <Button
        variant="outline"
        onClick={handleSignOut}
        loading={signingOut}
        className="w-full justify-center border-red-500/25 text-red-300 hover:bg-red-500/10 hover:text-red-200"
      >
        <LogOut className="h-4 w-4" aria-hidden />
        Sign out
      </Button>
    </div>
  );
}
