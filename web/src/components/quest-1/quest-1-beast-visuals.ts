export type QuestOneBeastVisualState =
  | "dormant"
  | "awakened"
  | "reentrancy-attack"
  | "sealed"
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
} as const satisfies Partial<
  Record<QuestOneBeastVisualState, QuestOneBeastVisualAsset>
>;
