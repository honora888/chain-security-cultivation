import type { Metadata } from "next";

import { BestiaryArchivePage } from "@/features/bestiary-ui/bestiary-pages";

export const metadata: Metadata = {
  title: "异兽志｜链安修仙录",
  description:
    "浏览经人工审核正式发布的安全案例，以及已经化为可修炼秘境的正式 Quest 异兽。",
};

export default function BestiaryPage() {
  return <BestiaryArchivePage />;
}
