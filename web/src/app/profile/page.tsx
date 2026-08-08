import type { Metadata } from "next";

import { ProfilePageClient } from "@/features/contributor-ui/contributor-pages";

export const metadata: Metadata = {
  title: "我的修仙档案",
  description: "查看当前钱包彼此独立的秘境修为与社区功德档案。",
};

export default function ProfilePage() {
  return <ProfilePageClient />;
}
