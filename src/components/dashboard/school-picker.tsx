"use client";

import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useMutationRpc, useSchools } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope, School, SchoolBeneficiary } from "@/lib/api/rpc-types";

const selectCls =
  "h-11 w-full rounded-2xl border border-dash-fg/12 bg-dash-sidebar px-3 text-sm text-dash-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60";

const inputCls = "border-dash-fg/10 bg-dash-surface text-dash-fg placeholder:text-dash-fg/35";

interface SaveRes extends RpcEnvelope {
  note?: string;
}

type BeneficiaryDraft = {
  beneficiaryName: string;
  sharePercent: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
  upi: string;
};

const blankBeneficiary = (): BeneficiaryDraft => ({
  beneficiaryName: "",
  sharePercent: "100",
  bankName: "",
  accountNo: "",
  ifsc: "",
  upi: "",
});

const toDraft = (b: SchoolBeneficiary): BeneficiaryDraft => ({
  beneficiaryName: b.beneficiaryName,
  sharePercent: String(b.sharePercent),
  bankName: b.bankName,
  accountNo: b.accountNo,
  ifsc: b.ifsc,
  upi: b.upi,
});

/**
 * Picks the school an invoice is billed to. Every school uses the same invoice
 * template — the code (which appears in the invoice number), the addressee,
 * the billed service description and the payment split all live here, so
 * adding one is all a new school ever needs before its first invoice.
 */
export function SchoolPicker({
  value,
  onChange,
  /** Founder-only: staff can read schools but not create/edit them. */
  canAdd,
}: {
  value: string;
  onChange: (schoolId: string) => void;
  canAdd?: boolean;
}) {
  const schools = useSchools();
  const [addOpen, setAddOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<School | null>(null);
  const active = (schools.data?.schools ?? []).filter((s) => s.active !== false);
  const selected = (schools.data?.schools ?? []).find((s) => s.schoolId === value) ?? null;

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
        {canAdd && selected && (
          <Button
            size="sm"
            variant="outline"
            className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]"
            onClick={() => setEditing(selected)}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
          </Button>
        )}
        {canAdd && (
          <Button
            size="sm"
            variant="outline"
            className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> Add school
          </Button>
        )}
      </div>
      {active.length === 0 && !schools.isPending && (
        <p className="text-xs text-amber-300">
          No schools yet. Add one — every invoice names the school it is billed to.
        </p>
      )}
      {canAdd && <SchoolFormDialog open={addOpen} onOpenChange={setAddOpen} mode="add" />}
      {canAdd && (
        <SchoolFormDialog
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          mode="edit"
          school={editing ?? undefined}
        />
      )}
    </>
  );
}

function SchoolFormDialog({
  open,
  onOpenChange,
  mode,
  school,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "add" | "edit";
  school?: School;
}) {
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [contact, setContact] = React.useState("");
  const [attn, setAttn] = React.useState("The Principal");
  const [billingBasis, setBillingBasis] = React.useState("Fixed Monthly");
  const [serviceDescription, setServiceDescription] = React.useState("");
  const [beneficiaries, setBeneficiaries] = React.useState<BeneficiaryDraft[]>([blankBeneficiary()]);

  const schools = useSchools();

  React.useEffect(() => {
    if (!open) return;
    if (mode === "edit" && school) {
      setCode(school.code);
      setName(school.name);
      setAddress(school.address);
      setContact(school.contact);
      setAttn(school.attn || "The Principal");
      setBillingBasis(school.billingBasis || "Fixed Monthly");
      setServiceDescription(school.serviceDescription);
      setBeneficiaries(school.beneficiaries.length ? school.beneficiaries.map(toDraft) : [blankBeneficiary()]);
    } else {
      setCode("");
      setName("");
      setAddress("");
      setContact("");
      setAttn("The Principal");
      setBillingBasis("Fixed Monthly");
      setServiceDescription("");
      setBeneficiaries([blankBeneficiary()]);
    }
  }, [open, mode, school]);

  const save = useMutationRpc<Record<string, unknown>, SaveRes>(mode === "add" ? "api_addSchool" : "api_updateSchool", {
    onSuccess: (res) => {
      toast.success(res.note ?? (mode === "add" ? "School added." : "School updated."));
      onOpenChange(false);
      schools.refetch();
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not save the school."),
  });

  // 2-16 letters/digits/dash/underscore — the code is printed on every invoice
  // number, so it stays short and unambiguous. Immutable once a school exists.
  const valid = /^[A-Za-z0-9][A-Za-z0-9_-]{1,15}$/.test(code.trim());
  const clash =
    mode === "add" &&
    (schools.data?.schools ?? []).some((s: School) => s.code.toUpperCase() === code.trim().toUpperCase());

  const shareTotal = beneficiaries.reduce((sum, b) => sum + (Number(b.sharePercent) || 0), 0);
  const sharesValid = beneficiaries.length > 0 && Math.abs(shareTotal - 100) < 0.01 && beneficiaries.every((b) => b.beneficiaryName.trim());
  const formValid = valid && !clash && name.trim().length > 0 && sharesValid;

  const updateBeneficiary = (i: number, patch: Partial<BeneficiaryDraft>) =>
    setBeneficiaries((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-dash-fg/10 bg-dash-card text-dash-fg sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-dash-fg">{mode === "add" ? "Add a school" : `Edit ${school?.name || school?.code}`}</DialogTitle>
          <DialogDescription className="text-dash-fg/50">
            Every school uses the same invoice template (SMI-26-27-007_SCH_MHWS). The code goes on the invoice
            number and cannot be changed once set.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Code *</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="MHWS"
              disabled={mode === "edit"}
              className={inputCls}
            />
            {clash && <p className="text-xs text-red-300">That code is already used.</p>}
            {!clash && code.trim().length > 0 && !valid && (
              <p className="text-xs text-red-300">Use 2–16 letters, digits, dash or underscore.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">School name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Modern High School" className={inputCls} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-[13px] text-dash-fg/70">Address (optional)</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Attn (printed on the invoice)</Label>
            <Input value={attn} onChange={(e) => setAttn(e.target.value)} placeholder="The Principal" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Contact (optional)</Label>
            <Input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Phone or email"
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] text-dash-fg/70">Billing basis</Label>
            <Input value={billingBasis} onChange={(e) => setBillingBasis(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-[13px] text-dash-fg/70">
              Service description (what &ldquo;Instruments covered&rdquo; and the invoice line item say)
            </Label>
            <Textarea
              value={serviceDescription}
              onChange={(e) => setServiceDescription(e.target.value)}
              placeholder="e.g. Guitar, Cajon Box, Keyboard, Flute, Djembe"
              rows={2}
              className={inputCls}
            />
          </div>
        </div>

        <div className="space-y-2 border-t border-dash-fg/10 pt-3">
          <div className="flex items-center justify-between">
            <Label className="text-[13px] text-dash-fg/70">
              Payment split — shares must add to 100% {beneficiaries.length > 1 ? `(currently ${shareTotal}%)` : ""}
            </Label>
            <Button
              size="sm"
              variant="outline"
              className="border-dash-fg/15 text-dash-fg hover:bg-dash-fg/[0.05]"
              onClick={() => setBeneficiaries((prev) => [...prev, blankBeneficiary()])}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add beneficiary
            </Button>
          </div>
          {beneficiaries.map((b, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-dash-fg/10 bg-dash-fg/[0.02] p-3 sm:grid-cols-6">
              <Input
                value={b.beneficiaryName}
                onChange={(e) => updateBeneficiary(i, { beneficiaryName: e.target.value })}
                placeholder="Beneficiary name"
                className={`${inputCls} sm:col-span-2`}
              />
              <Input
                type="number"
                value={b.sharePercent}
                onChange={(e) => updateBeneficiary(i, { sharePercent: e.target.value })}
                placeholder="Share %"
                className={inputCls}
              />
              <Input
                value={b.bankName}
                onChange={(e) => updateBeneficiary(i, { bankName: e.target.value })}
                placeholder="Bank · Branch"
                className={`${inputCls} sm:col-span-2`}
              />
              <div className="flex items-center gap-1">
                <Input
                  value={b.accountNo}
                  onChange={(e) => updateBeneficiary(i, { accountNo: e.target.value })}
                  placeholder="Account no."
                  className={inputCls}
                />
                {beneficiaries.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0 text-dash-fg/50 hover:text-red-400"
                    onClick={() => setBeneficiaries((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                )}
              </div>
              <Input
                value={b.ifsc}
                onChange={(e) => updateBeneficiary(i, { ifsc: e.target.value.toUpperCase() })}
                placeholder="IFSC"
                className={`${inputCls} sm:col-span-2`}
              />
              <Input
                value={b.upi}
                onChange={(e) => updateBeneficiary(i, { upi: e.target.value })}
                placeholder="UPI (optional)"
                className={`${inputCls} sm:col-span-3`}
              />
            </div>
          ))}
          {!sharesValid && beneficiaries.some((b) => b.beneficiaryName.trim()) && (
            <p className="text-xs text-red-300">Beneficiary shares must add up to exactly 100%.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!formValid}
            loading={save.isPending}
            onClick={() =>
              save.mutate({
                schoolId: school?.schoolId,
                code: code.trim().toUpperCase(),
                name: name.trim(),
                address: address.trim() || undefined,
                contact: contact.trim() || undefined,
                attn: attn.trim() || undefined,
                billingBasis: billingBasis.trim() || undefined,
                serviceDescription: serviceDescription.trim() || undefined,
                beneficiaries: beneficiaries.map((b) => ({
                  beneficiaryName: b.beneficiaryName.trim(),
                  sharePercent: Number(b.sharePercent) || 0,
                  bankName: b.bankName.trim(),
                  accountNo: b.accountNo.trim(),
                  ifsc: b.ifsc.trim(),
                  upi: b.upi.trim(),
                })),
              })
            }
            className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover"
          >
            {mode === "add" ? "Add school" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
