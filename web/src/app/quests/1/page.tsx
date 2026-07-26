import type { Metadata } from "next";

import { QuestBattleExperience } from "@/components/quest-1/QuestBattleExperience";

export const metadata: Metadata = {
  title: "Quest 1：噬灵回环兽",
  description:
    "进入水灵秘境，在代码中找出经典重入漏洞最先打开攻击窗口的危险行。",
};

export default function QuestOnePage() {
  return <QuestBattleExperience />;
}
