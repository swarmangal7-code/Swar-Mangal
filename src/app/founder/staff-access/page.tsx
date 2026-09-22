"use client";

import * as React from "react";
import { Mail, Plus, ShieldAlert, Smartphone, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { useTokenAuth } from "@/lib/auth/token-auth";
import { useMutationRpc, useRpc, rpcKeys } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope } from "@/lib/api/rpc-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface AuthorizedEmailRow {
  email: string;
  role: string;
  branches: string;
  addedBy: string;
  addedAt: string;
  note: string;
}

interface AuthorizedEmailsResponse extends RpcEnvelope {
  rows: AuthorizedEmailRow[];
}

interface StaffTokenRow {
  id: string;
  role: string;
  label: string;
  email: string;
  branches: string;
  createdAt: string;
  lastUsedAt: string;
  revokedAt: string;
  stale: boolean;
}

interface StaffTokensResponse extends RpcEnvelope {
  rows: StaffTokenRow[];
}

interface RpcResult extends RpcEnvelope {
  note?: string;
}

const stamp = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function fmtStamp(value: string) {
  if (!value) return "";
  const d = new Date(value.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? value : stamp.format(d);
}

export default function FounderStaffAccessPage() {
  const { session } = useTokenAuth();
  const branches = session?.branches?.length ? [...session.branches] : [];

  const authorizedQ = useRpc<AuthorizedEmailsResponse>(
    "api_founder_listAuthorizedEmails",
    undefined,
    { staleTime: 30_000 },
  );
  const tokensQ = useRpc<StaffTokensResponse>("api_founder_listStaffTokens", undefined, {
    staleTime: 30_000,
  });

  const invalidate = React.useMemo(
    () => [rpcKeys.call("api_founder_listAuthorizedEmails"), rpcKeys.call("api_founder_listStaffTokens")],
    [],
  );

  const addMut = useMutationRpc<{ email: string; branches: string }, RpcResult>(
    "api_founder_addAuthorizedEmail",
    { invalidate },
  );
  const removeMut = useMutationRpc<{ email: string }, RpcResult>(
    "api_founder_removeAuthorizedEmail",
    { invalidate },
  );
  const revokeMut = useMutationRpc<{ id: string }, RpcResult>("api_founder_revokeDeviceToken", {
    invalidate,
  });

  const [addOpen, setAddOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [branchInput, setBranchInput] = React.useState("");
  const [removing, setRemoving] = React.useState<AuthorizedEmailRow | null>(null);
  const [revoking, setRevoking] = React.useState<StaffTokenRow | null>(null);

  const authorized = authorizedQ.data?.rows ?? [];
  const tokens = tokensQ.data?.rows ?? [];

  const handleAdd = async () => {
    if (!email.trim()) return toast.error("Enter an email address.");
    try {
      const res = await addMut.mutateAsync({ email: email.trim(), branches: branchInput.trim() });
      toast.success(res.note ?? "Email authorized.");
      setAddOpen(false);
      setEmail("");
      setBranchInput("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the email.");
    }
  };

  const handleRemove = async () => {
    if (!removing) return;
    try {
      const res = await removeMut.mutateAsync({ email: removing.email });
      toast.success(res.note ?? "Access removed.");
      setRemoving(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove the email.");
    }
  };

  const handleRevoke = async () => {
    if (!revoking) return;
    try {
      const res = await revokeMut.mutateAsync({ id: revoking.id });
      toast.success(res.note ?? "Device revoked.");
      setRevoking(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not revoke the device.");
    }
  };

  const toggleBranchChip = (b: string) => {
    const parts = branchInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const next = parts.includes(b) ? parts.filter((p) => p !== b) : [...parts, b];
    setBranchInput(next.join(", "));
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-dash-fg/40">
            Founder · Settings
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-dash-fg">
            Staff access
          </h1>
          <p className="mt-1 text-sm text-dash-fg/55">
            Who may self-register a token, and every device token issued.
          </p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
        >
          <UserPlus className="h-4 w-4" aria-hidden />
          Add access
        </Button>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-dash-fg/80">Authorized to register</h2>
        {authorizedQ.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[68px] w-full bg-dash-fg/[0.05]" />
            ))}
          </div>
        ) : authorizedQ.isError ? (
          <ErrorCard message={authorizedQ.error?.message} onRetry={() => authorizedQ.refetch()} />
        ) : authorized.length === 0 ? (
          <EmptyCard icon={<Mail className="h-5 w-5" aria-hidden />} text="No staff emails added yet." />
        ) : (
          <div className="space-y-2">
            {authorized.map((row) => (
              <div
                key={row.email}
                className="flex items-center gap-4 rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.03] p-4"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-dash-fg/[0.04] text-dash-fg/50">
                  <Mail className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-dash-fg">{row.email}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-dash-fg/45">
                    <span>{row.branches ? row.branches : "Default branches"}</span>
                    {row.addedBy && (
                      <>
                        <span className="text-dash-fg/25">·</span>
                        <span className="truncate">added by {row.addedBy}</span>
                      </>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="iconSm"
                  onClick={() => setRemoving(row)}
                  aria-label={`Remove ${row.email}`}
                  className="text-red-300/70 hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-dash-fg/80">Issued device tokens</h2>
        {tokensQ.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[76px] w-full bg-dash-fg/[0.05]" />
            ))}
          </div>
        ) : tokensQ.isError ? (
          <ErrorCard message={tokensQ.error?.message} onRetry={() => tokensQ.refetch()} />
        ) : tokens.length === 0 ? (
          <EmptyCard
            icon={<Smartphone className="h-5 w-5" aria-hidden />}
            text="No tokens issued yet."
          />
        ) : (
          <div className="space-y-2">
            {tokens.map((row) => {
              const revoked = !!row.revokedAt;
              return (
                <div
                  key={row.id}
                  className="flex items-center gap-4 rounded-2xl border border-dash-fg/10 bg-dash-fg/[0.03] p-4"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-dash-fg/[0.04] text-dash-fg/50">
                    <Smartphone className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-dash-fg">
                        {row.label || "Unlabelled device"}
                      </p>
                      <Badge
                        variant="outline"
                        className={
                          row.role === "FOUNDER_ADMIN"
                            ? "border-dash-accent/30 bg-dash-accent/10 text-dash-accent"
                            : "border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/60"
                        }
                      >
                        {row.role === "FOUNDER_ADMIN" ? "Founder" : "Staff"}
                      </Badge>
                      {row.stale && !revoked && (
                        <Badge
                          variant="outline"
                          className="border-amber-500/30 bg-amber-500/10 text-amber-300"
                        >
                          <ShieldAlert className="h-3 w-3" aria-hidden />
                          Unused 90d+
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-dash-fg/45">
                      {row.email && <span className="truncate">{row.email}</span>}
                      <span className="text-dash-fg/25">·</span>
                      <span>
                        {row.lastUsedAt ? `last used ${fmtStamp(row.lastUsedAt)}` : "never used"}
                      </span>
                      {row.branches && (
                        <>
                          <span className="text-dash-fg/25">·</span>
                          <span>{row.branches}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {revoked ? (
                    <Badge variant="destructive" className="bg-red-500/10 text-red-300">
                      Revoked
                    </Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRevoking(row)}
                      className="text-red-300/80 hover:bg-red-500/10 hover:text-red-300"
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md border-dash-fg/10 bg-dash-card text-dash-fg">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Add staff access</DialogTitle>
            <DialogDescription className="text-dash-fg/45">
              This email can register its own device token. OTP only proves inbox control — this
              list is the actual authorization.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div>
              <label htmlFor="sa-email" className="mb-1.5 block text-xs font-medium text-dash-fg/70">
                Email address
              </label>
              <input
                id="sa-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@example.com"
                className="h-11 w-full rounded-2xl border border-dash-fg/15 bg-dash-bg px-4 text-sm text-dash-fg placeholder:text-dash-fg/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
              />
            </div>
            <div>
              <label htmlFor="sa-branches" className="mb-1.5 block text-xs font-medium text-dash-fg/70">
                Branches (optional)
              </label>
              <input
                id="sa-branches"
                value={branchInput}
                onChange={(e) => setBranchInput(e.target.value)}
                placeholder="e.g. GOREGAON, KANDIVALI"
                className="h-11 w-full rounded-2xl border border-dash-fg/15 bg-dash-bg px-4 text-sm text-dash-fg placeholder:text-dash-fg/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
              />
              {branches.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {branches.map((b) => {
                    const active = branchInput
                      .split(",")
                      .map((s) => s.trim().toUpperCase())
                      .includes(b.toUpperCase());
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => toggleBranchChip(b)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60 ${
                          active
                            ? "border-dash-accent/40 bg-dash-accent/15 text-dash-accent"
                            : "border-dash-fg/15 text-dash-fg/55 hover:bg-dash-fg/[0.05]"
                        }`}
                      >
                        {b}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="mt-1.5 text-[11px] text-dash-fg/35">
                Blank grants the default branches.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setAddOpen(false)}
              className="border-dash-fg/10 text-dash-fg/70 hover:bg-dash-fg/[0.05] hover:text-dash-fg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              loading={addMut.isPending}
              className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent className="max-w-sm border-dash-fg/10 bg-dash-card text-dash-fg">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Remove access?</DialogTitle>
            <DialogDescription className="text-dash-fg/45">
              <span className="font-medium text-dash-fg">{removing?.email}</span> will no longer be
              able to register or reset a token, and any active token of theirs is revoked
              immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRemoving(null)}
              className="border-dash-fg/10 text-dash-fg/70 hover:bg-dash-fg/[0.05] hover:text-dash-fg"
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove} loading={removeMut.isPending}>
              <X className="h-4 w-4" aria-hidden />
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!revoking} onOpenChange={(open) => !open && setRevoking(null)}>
        <DialogContent className="max-w-sm border-dash-fg/10 bg-dash-card text-dash-fg">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Revoke this device?</DialogTitle>
            <DialogDescription className="text-dash-fg/45">
              <span className="font-medium text-dash-fg">
                {revoking?.label || "This device"}
              </span>{" "}
              is locked out immediately. The person can self-register a new token if they still have
              access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRevoking(null)}
              className="border-dash-fg/10 text-dash-fg/70 hover:bg-dash-fg/[0.05] hover:text-dash-fg"
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevoke} loading={revokeMut.isPending}>
              <Trash2 className="h-4 w-4" aria-hidden />
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyCard({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-dash-fg/15 bg-dash-fg/[0.02] px-5 py-6 text-sm text-dash-fg/45">
      <span className="text-dash-fg/30">{icon}</span>
      {text}
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
      <p className="text-sm font-medium text-red-300">Could not load this list.</p>
      <p className="mt-1 text-sm text-dash-fg/55">{message ?? "Something went wrong."}</p>
      <Button
        variant="outline"
        onClick={onRetry}
        className="mt-3 border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]"
      >
        Retry
      </Button>
    </div>
  );
}