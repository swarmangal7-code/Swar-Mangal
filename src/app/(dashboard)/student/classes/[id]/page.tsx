"use client";

export const runtime = "edge";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, MapPin, Music, Users, Video, BookOpen, Target, MessageCircle } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InstrumentBadge } from "@/components/music/instrument-badge";
import { SectionHeader } from "@/components/dashboard/section-header";

import { useAcademyData } from "@/hooks/use-academy-data";
import type { ClassEvent, Student } from "@/types";
import { formatTime } from "@/lib/utils/cn";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils/cn";

const notes: string[] = [
  "Focus on dynamics  piano vs forte contrast in section A.",
  "Metronome at 72 bpm; increase once consistent.",
  "Review bar 12—16 left hand voicing.",
  "Record a practice take for Friday's review.",
];

export default function ClassDetailPage() {
  const { classes, assignments, students } = useAcademyData();
  const params = useParams<{ id: string }>();
  const cls: ClassEvent | undefined = classes.find((l) => l.id === params.id);

  if (!cls) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <Music className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-medium">Class not found</p>
        <Button asChild className="mt-4"><Link href="/student/classes">Back to classes</Link></Button>
      </div>
    );
  }

  const roster: Student[] = cls.student_ids.map((id: string) => students.find((x: Student) => x.id === id) ?? students[0]).filter(Boolean);
  const clsAssignments = assignments.filter((a) => a.instrument === cls.instrument).slice(0, 1);
  const color: string = cls.color ?? "#8d6bf6";

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 text-muted-foreground">
          <Link href="/student/classes"><ArrowLeft className="h-4 w-4" /> Back to classes</Link>
        </Button>

        <Card className="overflow-hidden">
          <div className="h-2" style={{ background: color }} />
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <InstrumentBadge instrument={cls.instrument} color={color} size="lg" />
                  <div>
                    <h1 className="text-h1">{cls.title}</h1>
                    <p className="mt-1 text-body-sm text-muted-foreground">{cls.instrument} · {cls.mode}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <InfoChip icon={<Clock className="h-4 w-4" />} label="Time" value={`${formatTime(cls.start_time)} — ${formatTime(cls.end_time)}`} />
                  <InfoChip icon={<Clock className="h-4 w-4" />} label="Duration" value={`${cls.duration_min} min`} />
                  <InfoChip icon={cls.mode === "online" ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />} label="Location" value={cls.room ?? cls.mode} />
                  <InfoChip icon={<Users className="h-4 w-4" />} label="Students" value={`${roster.length}`} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Avatar name={cls.teacher_name} size="lg" />
                <div>
                  <p className="text-sm font-semibold">{cls.teacher_name}</p>
                  <p className="text-xs text-muted-foreground">Instructor</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, ease: EASE }}>
            <SectionHeader title="Lesson Plan" action={<BookOpen className="h-4 w-4 text-muted-foreground" />} />
            <Card>
              <CardContent className="p-5">
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  {["Warm-up scales  5 min", "Review last week assignments", "New piece walkthrough  Section A", "Rhythm drills (eighth & quarter notes)", "Sight-reading exercise"].map((n, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckIcon className={cn("mt-0.5 h-4 w-4 shrink-0", i < 2 ? "text-mint-500" : "text-lavender-400")} />
                      {n}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, ease: EASE }}>
            <SectionHeader title="Teacher Notes" action={<MessageCircle className="h-4 w-4 text-muted-foreground" />} />
            <Card>
              <CardContent className="p-5">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {notes.map((n, i) => (
                    <li key={i} className="flex items-start gap-2"><span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-lavender-400" />{n}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>

          {clsAssignments.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, ease: EASE }}>
              <SectionHeader title="Related Assignment" action={<Target className="h-4 w-4 text-muted-foreground" />} />
              {clsAssignments.map((a) => (
                <Card key={a.id}>
                  <CardContent className="flex items-center gap-4 p-5">
                    <Target className="h-5 w-5 shrink-0 text-peach-500" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{a.title}</p>
                      <p className="text-xs text-muted-foreground">Due {new Date(a.due_date).toLocaleDateString()} · {a.expected_minutes} min expected</p>
                    </div>
                    <Badge variant={a.status === "submitted" ? "mint" : "peach"}>{a.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </motion.div>
          )}
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, ease: EASE }}>
          <SectionHeader title="Students" action={<Users className="h-4 w-4 text-muted-foreground" />} />
          <Card>
            <CardContent className="p-4">
              {roster.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No students enrolled yet.</p>
              ) : (
                <div className="space-y-3">
                  {roster.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-secondary transition-colors">
                      <Avatar name={s.full_name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{s.full_name}</p>
                        <p className="text-xs text-muted-foreground">{s.instrument} · {s.level}</p>
                      </div>
                      <Badge variant={s.fee_status === "paid" ? "mint" : s.fee_status === "pending" ? "lavender" : "peach"}>{s.fee_status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

function InfoChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-secondary/60 p-3">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon} {label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return <svg className={cn("h-4 w-4 text-mint-500", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
}