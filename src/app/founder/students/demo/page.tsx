"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { DemoStudentsPanel } from "@/components/dashboard/demo-students-panel";
import { useBootstrap } from "@/lib/api/rpc-hooks";
import { useTokenAuth } from "@/lib/auth/token-auth";

function FounderDemoStudentsInner() {
  const { session } = useTokenAuth();
  const boot = useBootstrap();
  const searchParams = useSearchParams();

  const branches = session?.branches?.length ? session.branches : [];
  const defaultBranch = branches.length === 1 ? branches[0] : "KANDIVALI";
  const plans = boot.data?.plans ?? [];
  const cycles = boot.data?.feeCycleTypes?.length ? boot.data.feeCycleTypes : ["Monthly", "3 Months", "6 Months", "Yearly"];

  const fromInquiry = searchParams.get("fromInquiry");
  const prefill = fromInquiry
    ? {
        name: searchParams.get("name") ?? "",
        phone: searchParams.get("phone") ?? "",
        instrument: searchParams.get("instrument") ?? "",
        inquiryId: fromInquiry,
      }
    : undefined;

  return <DemoStudentsPanel backHref="/founder/students" isFounder defaultBranch={defaultBranch} plans={plans} cycles={cycles} prefill={prefill} />;
}

export default function FounderDemoStudentsPage() {
  return (
    <React.Suspense fallback={null}>
      <FounderDemoStudentsInner />
    </React.Suspense>
  );
}
