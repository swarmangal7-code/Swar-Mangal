"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutationRpc, useSchools } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope, School } from "@/lib/api/rpc-types";

const selectCls =
  "h-11 w-full rounded-2xl border border-dash-fg/12 bg-dash-sidebar px-3 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60";

interface AddRes extends RpcEnvelope {
  note?: string;
}

/**
 * Picks the school an invoice is billed to. Every school uses the same invoice
 * template — only the code (which appears in the invoice number) and the
 * addressee differ — so adding one here is all a new school ever needs.
 */
export function SchoolPicker({
  value,
  onChange,
  /** Founder-only: staff can read schools but not create them. */
  canAdd,
}: {
  value: string;
  onChange: (schoolId: string) => void;
  canAdd?: boolean;
}) {
  const schools = useSchools();
  const [addOpen, setAddOpen] = React.useState(false);
  const active = (schools.data?.schools ?? []).filter((s) => s.active !== false);

  return (
    <>
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label className="text-[13px] text-dash-fg/70">Billed to *</Label>
          <select
            aria-label="School"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={selectCls}
            disabled={schools.isPending}
          >
            <option value="">
              {schools.isPending ? "Loading schools…" : "Select a school"}
            </option>
            {active.map((s) => (
              <option key={s.schoolId} value={s.schoolId}>
                {s.name && s.name !== s.code ? `${s.name} (${s.code})` : s.code}
              </option>
            ))}
          </select>
        </div>
        {canAdd && (
          <Button
            size="sm"
            variant="outline"
            className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]"
            onClick={() => setAddOpen(true)}
          >
            Add school
          </Button>
        )}
      </div>
      {active.length === 0 && !schools.isPending && (
        <p className="text-xs text-amber-300">
          No schools yet. Add one — every invoice names the school it is billed to.
        </p>
      )}
      {canAdd && (
        <AddSchoolDialog open={addOpen} onOpenChange={setAddOpen} />
      )}
    </>
  );
}

function AddSchoolDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [contact, setContact] = React.useState("");

  const schools = useSchools();
  const add = useMutationRpc<Record<string, unknown>, AddRes>("api_addSchool", {
    onSuccess: (res) => {
      toast.success(res.note ?? "School added.");
      onOpenChange(false);
      setCode("");
      setName("");
      setAddress("");
      setContact("");
      schools.refetch();
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not add the school."),
  });

  // 2-16 letters/digits/dash/underscore — the code is printed on every invoice
  // number, so it stays short and unambiguous.
  const valid = /^[A-Za-z0-9][A-Za-z0-9_-]{1,15}$/.test(code.trim());
  const clash = (schools.data?.schools ?? []).some(
    (s: School) => s.code.toUpperCase() === code.trim().toUpperCase(),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-dash-fg/10 bg-dash-card text-dash-fg">
        <DialogHeader>
          <DialogTitle className="text-dash-fg">Add a school</DialogTitle>
          <DialogDescription className="text-dash-fg/50">
            It uses the same invoice template as every other school. The code goes on the invoice number
            (SMI-26-27-007_SCH_MHWS) and cannot be changed once invoices exist.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Code *</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="MHWS"
              className="border-dash-fg/10 bg-dash-surface text-dash-fg placeholder:text-dash-fg/35"
            />
            {clash && <p className="text-xs text-red-300">That code is already used.</p>}
            {!clash && code.trim().length > 0 && !valid && (
              <p className="text-xs text-red-300">Use 2–16 letters, digits, dash or underscore.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">School name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Modern High School"
              className="border-dash-fg/10 bg-dash-surface text-dash-fg placeholder:text-dash-fg/35"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-[13px] text-dash-fg/70">Address (optional)</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="border-dash-fg/10 bg-dash-surface text-dash-fg"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-[13px] text-dash-fg/70">Contact (optional)</Label>
            <Input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Phone or email — printed on the invoice"
              className="border-dash-fg/10 bg-dash-surface text-dash-fg placeholder:text-dash-fg/35"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!valid || clash || name.trim().length === 0}
            loading={add.isPending}
            onClick={() =>
              add.mutate({
                code: code.trim().toUpperCase(),
                name: name.trim(),
                address: address.trim() || undefined,
                contact: contact.trim() || undefined,
              })
            }
            className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
          >
            Add school
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
