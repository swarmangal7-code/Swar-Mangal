"use client";

// React Query wrappers around the RPC gateway. Every read is a query; every
// write goes through useMutationRpc and invalidates the RPC cache so the next
// read refetches from the server (the server stays the single source of truth).

import * as React from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { rpc, RpcError, type RpcArg } from "./rpc-client";
import type {
  ApprovalsResponse,
  AttendanceRosterResponse,
  AuditLogResponse,
  BootstrapResponse,
  CashbookResponse,
  DashboardMetricsResponse,
  DueRemindersResponse,
  DemoStudentListResponse,
  RecoveryCreditListResponse,
  FeeRateCardListResponse,
  InquiryQueueResponse,
  InstrumentListResponse,
  PaymentDraftsResponse,
  PayoutPreviewResponse,
  PayoutSettingsResponse,
  ReceiptSearchResponse,
  SchoolListResponse,
  StaffBootResponse,
  StaffStudentHubResponse,
  StudentProfileResponse,
  StudentSearchResponse,
  TeacherListResponse,
  TeacherProfileResponse,
  TeacherAttendanceReportResponse,
  TimetableResponse,
  TimetableWeekResponse,
  TimetableSessionDetailResponse,
  TodaysClassesResponse,
  WhatsAppGroupListResponse,
  WhatsAppStatusResponse,
} from "./rpc-types";

// --------------------------------------------------------------------- keys

export const rpcKeys = {
  root: ["rpc"] as const,
  call: (fn: string, arg?: RpcArg) => ["rpc", fn, arg ?? null] as const,
  bootstrap: () => ["rpc", "api_bootstrap"] as const,
  staffBoot: (branch?: string) => ["rpc", "api_staff_boot", branch ?? null] as const,
  studentSearch: (query: string, opts?: StudentSearchOptions) =>
    ["rpc", "students.search", query, opts?.branch ?? "ALL", opts?.mode ?? "staff"] as const,
  studentProfile: (id: string) => ["rpc", "students.profile", id] as const,
  teachers: () => ["rpc", "api_listTeachers"] as const,
  dashboard: (branch?: string) => ["rpc", "api_dashboard", branch ?? "ALL"] as const,
  dueReminders: (branch?: string) => ["rpc", "api_dueReminders", branch ?? "ALL"] as const,
  receipts: (query?: Record<string, unknown>) => ["rpc", "api_searchReceipt", query ?? null] as const,
  cashbook: (branch?: string, month?: string) => ["rpc", "api_cashbookReport", branch ?? "ALL", month ?? ""] as const,
  timetable: (branch?: string) => ["rpc", "api_timetableList", branch ?? "ALL"] as const,
  timetableWeek: (branch?: string, weekStart?: string) => ["rpc", "api_timetableWeek", branch ?? "ALL", weekStart ?? ""] as const,
  inquiries: (branch?: string) => ["rpc", "api_staff_inquiryQueue", branch ?? "ALL"] as const,
  approvals: () => ["rpc", "api_founder_approvalsList"] as const,
  paymentDrafts: () => ["rpc", "api_founder_listPaymentDrafts"] as const,
  auditLog: (branch?: string, month?: string) => ["rpc", "api_founder_auditLog", branch ?? "ALL", month ?? ""] as const,
  payoutPreview: (month?: string) => ["rpc", "api_teacherPayoutPreview", month ?? ""] as const,
  payoutSettings: () => ["rpc", "api_founder_listPayoutSettings"] as const,
  // Prefix-only (like payoutSettings above): matches every useFeeRateCard
  // query key regardless of its includeInactive argument, so one invalidate
  // refreshes both the admin screen (includeInactive) and any read-only list.
  feeRateCard: () => ["rpc", "api_listFeeRateCard"] as const,
  todaysClasses: (date?: string, branch?: string) =>
    ["rpc", "api_staff_todaysClasses", date ?? "", branch ?? "ALL"] as const,
  attendanceRoster: (classId?: string, date?: string) =>
    ["rpc", "api_staff_attendanceRoster", classId ?? "", date ?? ""] as const,
  whatsappStatus: () => ["rpc", "api_whatsappStatus"] as const,
  whatsappGroups: () => ["rpc", "api_listWhatsAppGroups"] as const,
};

// ------------------------------------------------------------------ generic

export type QueryOptions<T> = Omit<UseQueryOptions<T, RpcError, T, QueryKey>, "queryKey" | "queryFn">;

/** Generic RPC read. */
export function useRpc<T>(fn: string, arg?: RpcArg, options?: QueryOptions<T>) {
  return useQuery<T, RpcError, T, QueryKey>({
    queryKey: rpcKeys.call(fn, arg),
    queryFn: () => rpc<T>(fn, arg),
    ...options,
  });
}

export interface MutationOptions<TArg, TRes> {
  /** Query keys to invalidate on success. Defaults to the whole RPC cache. */
  invalidate?: QueryKey[] | ((arg: TArg, res: TRes) => QueryKey[]);
  onSuccess?: (res: TRes, arg: TArg) => void;
  onError?: (err: RpcError, arg: TArg) => void;
}

/** Generic RPC write. Invalidates related queries on success. */
export function useMutationRpc<TArg extends RpcArg, TRes>(fn: string, options?: MutationOptions<TArg, TRes>) {
  const queryClient = useQueryClient();
  return useMutation<TRes, RpcError, TArg>({
    mutationFn: (arg) => rpc<TRes>(fn, arg),
    onSuccess: (res, arg) => {
      const keys =
        typeof options?.invalidate === "function"
          ? options.invalidate(arg, res)
          : options?.invalidate ?? [rpcKeys.root];
      for (const key of keys) queryClient.invalidateQueries({ queryKey: key });
      options?.onSuccess?.(res, arg);
    },
    onError: (err, arg) => options?.onError?.(err, arg),
  });
}

// -------------------------------------------------------------------- boots

/** Founder boot (api_bootstrap). Founder-only by policy. */
export function useBootstrap(options?: QueryOptions<BootstrapResponse>) {
  return useRpc<BootstrapResponse>("api_bootstrap", undefined, { staleTime: 5 * 60_000, ...options });
}

/** Staff boot (api_staff_boot). `branch` scopes the allowed branch list. */
export function useStaffBoot(branch?: string, options?: QueryOptions<StaffBootResponse>) {
  return useRpc<StaffBootResponse>(
    "api_staff_boot",
    branch ? { branch } : {},
    { staleTime: 5 * 60_000, ...options },
  );
}

// ----------------------------------------------------------------- students

export interface StudentSearchOptions {
  branch?: string;
  classCode?: string;
  /** "staff" calls api_staff_searchStudents; "founder" calls api_searchStudent. */
  mode?: "staff" | "founder";
}

export function useStudentSearch(query: string, opts?: StudentSearchOptions, options?: QueryOptions<StudentSearchResponse>) {
  const mode = opts?.mode ?? "staff";
  const fn = mode === "founder" ? "api_searchStudent" : "api_staff_searchStudents";
  return useRpc<StudentSearchResponse>(
    fn,
    {
      q: query,
      branch: opts?.branch ?? "ALL",
      classCode: opts?.classCode ?? "ALL",
      includeAll: true,
    },
    { enabled: query.trim().length > 0, ...options },
  );
}

export function useStudentProfile(id: string, options?: QueryOptions<StudentProfileResponse>) {
  return useRpc<StudentProfileResponse>(
    "api_staff_getStudentProfile",
    { studentId: id },
    { enabled: id.length > 0, ...options },
  );
}

export function useRecoveryCredits(studentId: string, options?: QueryOptions<RecoveryCreditListResponse>) {
  return useRpc<RecoveryCreditListResponse>(
    "api_staff_listRecoveryCredits",
    { studentId },
    { enabled: studentId.length > 0, ...options },
  );
}

export function useDemoStudents(branch?: string, options?: QueryOptions<DemoStudentListResponse>) {
  return useRpc<DemoStudentListResponse>("api_listDemoStudents", { branch: branch ?? "ALL" }, options);
}

// -------------------------------------------------------------- schools

/** Schools a class can be billed to. Founder-only writes, both roles read. */
export function useSchools(options?: QueryOptions<SchoolListResponse>) {
  return useRpc<SchoolListResponse>("api_listSchools", undefined, options);
}

export function useStudentHub(id: string, branch = "ALL", options?: QueryOptions<StaffStudentHubResponse>) {
  return useRpc<StaffStudentHubResponse>(
    "api_staff_studentHub",
    { studentId: id, branch },
    { enabled: id.length > 0, ...options },
  );
}

// ----------------------------------------------------------------- teachers

export function useTeachers(options?: QueryOptions<TeacherListResponse>) {
  return useRpc<TeacherListResponse>("api_listTeachers", undefined, { staleTime: 5 * 60_000, ...options });
}

export function useTeacherAttendanceReport(
  from: string,
  to: string,
  options?: QueryOptions<TeacherAttendanceReportResponse>,
) {
  return useRpc<TeacherAttendanceReportResponse>("api_teacherAttendanceReport", { from, to }, options);
}

// --------------------------------------------------------------- instruments

export function useInstruments(options?: QueryOptions<InstrumentListResponse>) {
  return useRpc<InstrumentListResponse>("api_listInstruments", undefined, { staleTime: 5 * 60_000, ...options });
}

// ------------------------------------------------------------ fee rate card

export function useFeeRateCard(includeInactive?: boolean, options?: QueryOptions<FeeRateCardListResponse>) {
  return useRpc<FeeRateCardListResponse>(
    "api_listFeeRateCard",
    includeInactive ? { includeInactive: true } : undefined,
    options,
  );
}

export function useTeacherProfile(teacherId: string, branch = "ALL", options?: QueryOptions<TeacherProfileResponse>) {
  return useRpc<TeacherProfileResponse>(
    "api_teacherProfile",
    { teacherId, branch },
    { enabled: teacherId.length > 0, ...options },
  );
}

// ---------------------------------------------------------------- dashboard

export function useDashboard(branch?: string, options?: QueryOptions<DashboardMetricsResponse>) {
  return useRpc<DashboardMetricsResponse>(
    "api_dashboard",
    { scope: branch ?? "ALL" },
    { staleTime: 30_000, ...options },
  );
}

export function useDueReminders(branch?: string, options?: QueryOptions<DueRemindersResponse>) {
  return useRpc<DueRemindersResponse>(
    "api_dueReminders",
    { branch: branch ?? "ALL" },
    { staleTime: 60_000, ...options },
  );
}

// ----------------------------------------------------------------- receipts

export interface ReceiptQuery {
  q?: string;
  studentName?: string;
  receiptNo?: string;
  classCode?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export function useReceipts(query?: ReceiptQuery, options?: QueryOptions<ReceiptSearchResponse>) {
  return useRpc<ReceiptSearchResponse>("api_searchReceipt", { ...(query ?? {}) }, options);
}

// ----------------------------------------------------------------- cashbook

/** `month` is "YYYY-MM"; omitted means the server's full recent window. */
export function useCashbook(branch?: string, month?: string, options?: QueryOptions<CashbookResponse>) {
  const range = monthRange(month);
  return useRpc<CashbookResponse>(
    "api_cashbookReport",
    { branch: branch ?? "ALL", dateFrom: range.from, dateTo: range.to },
    options,
  );
}

// ---------------------------------------------------------------- timetable

export function useTimetable(branch?: string, options?: QueryOptions<TimetableResponse>) {
  return useRpc<TimetableResponse>("api_timetableList", { branch: branch ?? "ALL" }, options);
}

export function useTimetableWeek(branch: string | undefined, weekStart: string, options?: QueryOptions<TimetableWeekResponse>) {
  return useRpc<TimetableWeekResponse>(
    "api_timetableWeek",
    { branch: branch ?? "ALL", weekStart },
    { enabled: weekStart.length > 0, ...options },
  );
}

export function useTimetableSessionDetail(
  timetableId: string,
  date: string,
  options?: QueryOptions<TimetableSessionDetailResponse>,
) {
  return useRpc<TimetableSessionDetailResponse>(
    "api_timetableSessionDetail",
    { timetableId, date },
    { enabled: !!timetableId && !!date, ...options },
  );
}

// ---------------------------------------------------------------- inquiries

export function useInquiries(branch?: string, options?: QueryOptions<InquiryQueueResponse>) {
  return useRpc<InquiryQueueResponse>("api_staff_inquiryQueue", { branch: branch ?? "ALL" }, options);
}

// ---------------------------------------------------------------- approvals

export function useApprovals(options?: QueryOptions<ApprovalsResponse>) {
  return useRpc<ApprovalsResponse>("api_founder_approvalsList", undefined, options);
}

export function usePaymentDrafts(branch?: string, options?: QueryOptions<PaymentDraftsResponse>) {
  return useRpc<PaymentDraftsResponse>("api_founder_listPaymentDrafts", { branch: branch ?? "" }, options);
}

// ---------------------------------------------------------------- audit log

export function useAuditLog(branch?: string, month?: string, options?: QueryOptions<AuditLogResponse>) {
  const days = month ? monthLookbackDays(month) : undefined;
  return useRpc<AuditLogResponse>(
    "api_founder_auditLog",
    { limit: 200, ...(days ? { days } : {}) },
    options,
  );
}

// ------------------------------------------------------------------ payouts

export function usePayoutPreview(month?: string, options?: QueryOptions<PayoutPreviewResponse>) {
  return useRpc<PayoutPreviewResponse>(
    "api_teacherPayoutPreview",
    month ? { month } : {},
    options,
  );
}

/** Founder-only read of the full history of the three append-only payroll
 *  settings tables (payout_status_rules, teacher_percent_slabs, late_fee_settings). */
export function usePayoutSettings(options?: QueryOptions<PayoutSettingsResponse>) {
  return useRpc<PayoutSettingsResponse>("api_founder_listPayoutSettings", undefined, options);
}

// ------------------------------------------------------------- today classes

export function useTodaysClasses(date?: string, branch?: string, options?: QueryOptions<TodaysClassesResponse>) {
  return useRpc<TodaysClassesResponse>(
    "api_staff_todaysClasses",
    { date: date ?? "", branch: branch ?? "ALL" },
    { staleTime: 30_000, ...options },
  );
}

export function useAttendanceRoster(classId?: string, date?: string, options?: QueryOptions<AttendanceRosterResponse>) {
  const payload: RpcArg = { date: date ?? "" };
  if (classId) {
    payload.classId = classId;
    payload.instrument = classId;
  }
  return useRpc<AttendanceRosterResponse>("api_staff_attendanceRoster", payload, options);
}

// ----------------------------------------------------------------- whatsapp

/** Connection status of the WA-AKG gateway — same read every WhatsApp send
 *  surface uses to decide whether to let someone try sending at all. */
export function useWhatsAppStatus(options?: QueryOptions<WhatsAppStatusResponse>) {
  return useRpc<WhatsAppStatusResponse>("api_whatsappStatus", undefined, { staleTime: 15_000, ...options });
}

/** Every group the gateway's WhatsApp account is a member of, for a picker. */
export function useWhatsAppGroups(options?: QueryOptions<WhatsAppGroupListResponse>) {
  return useRpc<WhatsAppGroupListResponse>("api_listWhatsAppGroups", undefined, options);
}

// ---------------------------------------------------------------- live sync

/**
 * Near-real-time sync for the web dashboard — mirrors Flutter's SyncManager
 * (lib/state/sync_manager.dart): poll api_syncChanges with the revision
 * counters we already know, and when any entity's counter has moved (bumped
 * server-side by bumpRevisions() on every write — see src/lib/rpc/shared.ts),
 * invalidate the whole RPC cache so every mounted query refetches on its own.
 * One poll call, not a websocket: the VPS has no push channel, and this is
 * cheap (one indexed counter lookup) regardless of how much data changed.
 *
 * Call this once from a shell every founder/staff page renders through
 * (WebShell) — never per-screen, so there is exactly one poll loop.
 */
export function useLiveSync(enabled: boolean, intervalMs = 15_000) {
  const queryClient = useQueryClient();
  const known = React.useRef<Record<string, number>>({});

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let inFlight = false;

    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const res = await rpc<{ revisions: Record<string, number> }>("api_syncChanges", {
          knownRevisions: known.current,
        });
        if (cancelled) return;
        const server = res.revisions ?? {};
        const changed = Object.keys(server).some((k) => known.current[k] !== server[k]);
        known.current = server;
        if (changed) await queryClient.invalidateQueries({ queryKey: rpcKeys.root });
      } catch {
        // Offline or unreachable — next tick tries again. Never surfaced to
        // the user; the existing per-query error states already cover that.
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, intervalMs, queryClient]);
}

// ------------------------------------------------------------------ helpers

function monthRange(month?: string): { from: string; to: string } {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return { from: "", to: "" };
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

function monthLookbackDays(month: string): number {
  if (!/^\d{4}-\d{2}$/.test(month)) return 31;
  const [y, m] = month.split("-").map(Number);
  const start = Date.UTC(y, m - 1, 1);
  const days = Math.ceil((Date.now() - start) / 86_400_000);
  return Math.min(Math.max(days, 1), 365);
}
