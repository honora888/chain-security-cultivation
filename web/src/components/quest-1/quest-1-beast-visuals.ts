export type QuestOneBeastVisualState =
  | "dormant"
  | "awakened"
  | "reentrancy-attack"
  | "sealed"
  | "defeated-frame-1"
  | "defeated-frame-2"
  | "defeated"
  | "bestiary";

export interface QuestOneBeastVisualAsset {
  src: string;
  width: number;
  height: number;
}

export const QUEST_ONE_BEAST_VISUAL_ASSETS = {
  "reentrancy-attack": {
    src: "/assets/quest-1/beast/reentry-devourer-reentrancy-attack-v1.webp",
    width: 1122,
    height: 1402,
  },
  sealed: {
    src: "/assets/quest-1/beast/reentry-devourer-cei-sealed-v1.webp",
    width: 1122,
    height: 1402,
  },
  "defeated-frame-1": {
    src: "/assets/quest-1/beast/reentry-devourer-defeated-frame-1.webp",
    width: 1122,
    height: 1402,
  },
  "defeated-frame-2": {
    src: "/assets/quest-1/beast/reentry-devourer-defeated-frame-2.webp",
    width: 1122,
    height: 1402,
  },
  defeated: {
    src: "/assets/quest-1/beast/reentry-devourer-defeated-v1.webp",
    width: 1122,
    height: 1402,
  },
  bestiary: {
    src: "/assets/quest-1/beast/reentry-devourer-bestiary-portrait-v1.webp",
    width: 1024,
    height: 1024,
  },
} as const satisfies Partial<
  Record<QuestOneBeastVisualState, QuestOneBeastVisualAsset>
>;
