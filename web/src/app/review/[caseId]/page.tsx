import type { Metadata } from "next";

import { ReviewerCasePage } from "@/features/reviewer-ui/reviewer-pages";

export const metadata: Metadata = {
  title: "审核卷宗 | 链安修仙录",
  description: "守阁人查阅安全案例、Guardian 证据与源码卷宗。",
};

export default async function ReviewCaseRoute({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  return <ReviewerCasePage caseId={caseId} />;
}
