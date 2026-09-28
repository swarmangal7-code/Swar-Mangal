"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { DemoStudentsPanel } from "@/components/dashboard/demo-students-panel";
import { useStaffBoot } from "@/lib/api/rpc-hooks";
import { useTokenAuth } from "@/lib/auth/token-auth";

function StaffDemoStudentsInner() {
  const { session } = useTokenAuth();
  const branches = session?.branches ?? [];
  const defaultBranch = branches.length === 1 ? branches[0] : branches[0] ?? "KANDIVALI";
  const boot = useStaffBoot(defaultBranch);
  const searchParams = useSearchParams();

  const plans = boot.data?.plans ?? [];
  const cycles = boot.data?.planTypes?.length ? boot.data.planTypes : ["Monthly", "3 Months", "6 Months", "Yearly"];

  const fromInquiry = searchParams.get("fromInquiry");
  const prefill = fromInquiry
    ? {
        name: searchParams.get("name") ?? "",
        phone: searchParams.get("phone") ?? "",
        instrument: searchParams.get("instrument") ?? "",
        inquiryId: fromInquiry,
      }
    : undefined;

  return (
    <DemoStudentsPanel
      backHref="/staff/students"
      isFounder={false}
      defaultBranch={defaultBranch}
      plans={plans}
      cycles={cycles}
      prefill={prefill}
    />
  );
}

export default function StaffDemoStudentsPage() {
  return (
    <React.Suspense fallback={null}>
      <StaffDemoStudentsInner />
    </React.Suspense>
  );
}
