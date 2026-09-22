// Shared helpers for founder screens. Underscore prefix keeps this out of the
// router — imported, never a route.

export function formatINR(n: number | string | null | undefined): string {
  const num = typeof n === "number" ? n : Number(n ?? NaN);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}

const ADMISSION_LABELS: Record<string, string> = {
  WALK_IN: "Walk-in",
  FOLLOW_UP: "Follow-up",
  REFERRAL: "Referral",
  ONLINE_SOCIAL: "Online / Social",
  OTHER: "Other",
};

export function admissionSourceLabel(value?: string | null): string {
  if (!value) return "—";
  return ADMISSION_LABELS[value] ?? value;
}

export function formatDateOnly(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

export function formatWhen(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export interface Tone {
  label: string;
  className: string;
}

export function feeStatusTone(status?: string | null): Tone {
  const s = (status ?? "").toUpperCase();
  if (!s) return { label: "—", className: "border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/55" };
  if (s.includes("UP_TO") || s.includes("CLEAR") || s === "PAID")
    return { label: "Up to date", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" };
  if (s.includes("OVERDUE"))
    return { label: "Overdue", className: "border-red-400/30 bg-red-400/10 text-red-300" };
  if (s.includes("DUE") || s.includes("PENDING"))
    return { label: "Due", className: "border-amber-400/30 bg-amber-400/10 text-amber-300" };
  return { label: status ?? "—", className: "border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/70" };
}

export function studentStatusTone(status?: string | null): Tone {
  switch ((status ?? "").toUpperCase()) {
    case "ACTIVE":
      return { label: "Active", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" };
    case "PAUSED":
      return { label: "Paused", className: "border-amber-400/30 bg-amber-400/10 text-amber-300" };
    case "LEFT":
      return { label: "Left", className: "border-red-400/30 bg-red-400/10 text-red-300" };
    default:
      return { label: status || "—", className: "border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/55" };
  }
}

export function teacherStatusTone(status?: string | null): Tone {
  switch ((status ?? "").toUpperCase()) {
    case "ACTIVE":
      return { label: "Active", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" };
    case "HOLD":
      return { label: "Hold", className: "border-amber-400/30 bg-amber-400/10 text-amber-300" };
    case "INACTIVE":
      return { label: "Inactive", className: "border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/55" };
    default:
      return { label: status || "—", className: "border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/55" };
  }
}

export function attendanceTone(status?: string | null): Tone {
  const s = (status ?? "NOT_MARKED").toUpperCase();
  if (s === "PRESENT")
    return { label: "Present", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" };
  if (s === "ABSENT")
    return { label: "Absent", className: "border-red-400/30 bg-red-400/10 text-red-300" };
  if (s === "LATE")
    return { label: "Late", className: "border-amber-400/30 bg-amber-400/10 text-amber-300" };
  if (s === "EXCUSED")
    return { label: "Excused", className: "border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/70" };
  return { label: status || "—", className: "border-dash-fg/15 bg-dash-fg/[0.04] text-dash-fg/55" };
}