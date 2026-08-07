import type { Metadata } from "next";

import { CaseDetailPageClient } from "@/features/contributor-ui/contributor-pages";

export const metadata: Metadata = {
  title: "安全案例详情",
};

export default async function ContributionCasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  return <CaseDetailPageClient caseId={caseId} />;
}
