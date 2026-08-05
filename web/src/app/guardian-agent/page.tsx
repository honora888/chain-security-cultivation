import type { Metadata } from "next";

import { GuardianSecurityWorkbench } from "@/features/guardian-security-ui/guardian-security-workbench";

export const metadata: Metadata = {
  title: "Guardian Security Agent",
  description:
    "提交漏洞源码、攻击样例与修复对照，生成待人工审核的异兽志与安全 Quest 草案。",
};

export default function GuardianAgentPage() {
  return <GuardianSecurityWorkbench />;
}
