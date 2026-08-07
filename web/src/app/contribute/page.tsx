import type { Metadata } from "next";

import { GuardianSecurityWorkbench } from "@/features/guardian-security-ui/guardian-security-workbench";

export const metadata: Metadata = {
  title: "异兽献策",
  description: "通过钱包签名提交个人安全案例，等待人工审核与收录。",
};

export default async function ContributePage({
  searchParams,
}: {
  searchParams: Promise<{ revision?: string }>;
}) {
  const { revision } = await searchParams;
  return <GuardianSecurityWorkbench revisionCaseId={revision} />;
}
