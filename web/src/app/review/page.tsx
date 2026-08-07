import type { Metadata } from "next";

import { ReviewerQueuePage } from "@/features/reviewer-ui/reviewer-pages";

export const metadata: Metadata = {
  title: "守阁人审核台 | 链安修仙录",
  description: "查证异兽之实，裁定安全案例是否收入《异兽志》。",
};

export default function ReviewPage() {
  return <ReviewerQueuePage />;
}
