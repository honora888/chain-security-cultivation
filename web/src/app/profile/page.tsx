import type { Metadata } from "next";

import { ProfilePageClient } from "@/features/contributor-ui/contributor-pages";

export const metadata: Metadata = {
  title: "我的修仙档案",
  description: "查看当前钱包的安全案例和 Merit 记录。",
};

export default function ProfilePage() {
  return <ProfilePageClient />;
}
