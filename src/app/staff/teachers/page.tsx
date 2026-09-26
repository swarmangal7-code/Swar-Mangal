"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, GraduationCap, Plus, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutationRpc, useTeachers } from "@/lib/api/rpc-hooks";
import type { RpcEnvelope } from "@/lib/api/rpc-types";
import { fadeUp, listVariants } from "@/lib/motion";
import { initials } from "@/lib/utils/cn";

import { teacherStatusTone } from "@/app/founder/_shared";

type RequestTeacherArg = { teacherName: string; phone: string; primaryRole: string; clientIntentKey: string };
type RequestTeacherRes = RpcEnvelope & { requestId?: string; note?: string };

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE" | "HOLD" | "LEFT";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "HOLD", label: "Hold" },
  { value: "LEFT", label: "Left" },
];

export default function StaffTeachersPage() {
  const teachers = useTeachers();
  const [filter, setFilter] = React.useState<StatusFilter>("ALL");
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [role, setRole] = React.useState("");
  const intentRef = React.useRef(`TCHREQ-${Date.now()}`);

  const requestTeacher = useMutationRpc<RequestTeacherArg, RequestTeacherRes>("api_staff_requestAddTeacher", {
    onSuccess: (res) => {
      toast.success(res.note ?? "Sent to Sharvil for approval.");
      setOpen(false);
      setName("");
      setPhone("");
      setRole("");
      intentRef.current = `TCHREQ-${Date.now()}`;
    },
    onError: (err) => toast.error(err.message.replace(/\[.*\]$/, "") || "Could not send the request."),
  });

  const rows = teachers.data?.teachers ?? [];
  const filtered =
    filter === "ALL" ? rows : rows.filter((t) => (t.status ?? "").toUpperCase() === filter);

  return (
    <motion.div initial="hidden" animate="visible" variants={listVariants} className="space-y-5">
      <motion.div
        variants={fadeUp}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-dash-fg">Teachers</h1>
          <p className="mt-1 text-sm text-dash-fg/55">Academy teaching panel.</p>
        </div>
        <Button className="bg-dash-accent text-dash-bg hover:bg-dash-accent-hover" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Request Teacher
        </Button>
      </motion.div>

      <motion.div variants={fadeUp} className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              filter === f.value
                ? "border-dash-accent/50 bg-dash-accent/15 text-dash-accent"
                : "border-dash-fg/12 text-dash-fg/65 hover:border-dash-accent/40 hover:text-dash-fg"
            }`}
          >
            {f.label}
          </button>
        ))}
      </motion.div>

      {teachers.isError ? (
        <motion.div variants={fadeUp}>
          <Card className="border-red-400/30 bg-red-400/5">
            <CardContent className="pt-5 text-sm text-red-300">
              {teachers.error?.message?.replace(/\[.*\]$/, "") || "Could not load teachers."}{" "}
              <Button variant="link" className="h-auto p-0 text-dash-accent" onClick={() => teachers.refetch()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : teachers.isPending ? (
        <motion.div variants={fadeUp} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 bg-dash-fg/[0.04]" />
          ))}
        </motion.div>
      ) : filtered.length === 0 ? (
        <motion.div variants={fadeUp}>
          <Card className="border-dash-fg/10 bg-dash-card">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-dash-fg/[0.04] text-dash-fg/40">
                <Users className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium text-dash-fg">No teachers here</p>
                <p className="mt-0.5 text-sm text-dash-fg/45">
                  {filter === "ALL" ? "Request the first teacher for the panel." : `No ${filter.toLowerCase()} teachers.`}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={fadeUp} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => {
            const tone = teacherStatusTone(t.status);
            return (
              <Link
                key={t.teacherId}
                href={`/staff/teachers/${t.teacherId}`}
                className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-accent/60"
              >
                <Card className="h-full border-dash-fg/10 bg-dash-card transition-colors hover:border-dash-accent/40">
                  <CardContent className="flex h-full flex-col pt-5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-dash-accent/10 text-sm font-semibold text-dash-accent">
                        {initials(t.teacherName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-dash-fg">{t.teacherName}</p>
                        <p className="truncate text-xs text-dash-fg/50">{t.primaryRole || "Role not set"}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-dash-fg/30" aria-hidden />
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <Badge className={tone.className}>{tone.label}</Badge>
                      {t.branchClassCode && (
                        <Badge className="border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/70">
                          {t.branchClassCode}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-dash-fg/[0.04] pt-3 text-xs text-dash-fg/45">
                      <GraduationCap className="hidden h-3.5 w-3.5" aria-hidden />
                      <span>{t.phone || t.email || "No contact"}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </motion.div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-dash-fg/10 bg-dash-card">
          <DialogHeader>
            <DialogTitle className="text-dash-fg">Request a new teacher</DialogTitle>
            <DialogDescription className="text-dash-fg/50">
              Sent to Sharvil — he adds the teacher to the panel.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Teacher name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="border-dash-fg/10 bg-dash-surface text-dash-fg placeholder:text-dash-fg/35"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                inputMode="numeric"
                placeholder="98xxxxxx00"
                className="border-dash-fg/10 bg-dash-surface text-dash-fg placeholder:text-dash-fg/35"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-dash-fg/70">Primary instrument / role</Label>
              <Input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Violin, Tabla, Vocal…"
                className="border-dash-fg/10 bg-dash-surface text-dash-fg placeholder:text-dash-fg/35"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              loading={requestTeacher.isPending}
              disabled={!name.trim()}
              onClick={() =>
                requestTeacher.mutate({
                  teacherName: name.trim(),
                  phone: phone.trim(),
                  primaryRole: role.trim(),
                  clientIntentKey: intentRef.current,
                })
              }
            >
              Send to Sharvil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
