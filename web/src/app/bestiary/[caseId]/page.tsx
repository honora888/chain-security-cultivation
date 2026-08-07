import type { Metadata } from "next";

import { BestiaryDetailPage } from "@/features/bestiary-ui/bestiary-pages";

export const metadata: Metadata = {
  title: "异兽档案｜链安修仙录",
};

export default async function BestiaryEntryPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  return <BestiaryDetailPage entryId={caseId} />;
}
