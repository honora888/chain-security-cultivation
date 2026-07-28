export type QuestOneRewardVisualState = "locked" | "unlocked";

export interface QuestOneRewardVisualAsset {
  src: string;
  width: number;
  height: number;
}

export const QUEST_ONE_REWARD_VISUAL_ASSETS = {
  locked: {
    src: "/assets/quest-1/rewards/water-guardian-badge-silhouette-v1.webp",
    width: 1024,
    height: 1024,
  },
  unlocked: {
    src: "/assets/quest-1/rewards/water-guardian-badge-v1.webp",
    width: 1024,
    height: 1024,
  },
} as const satisfies Record<
  QuestOneRewardVisualState,
  QuestOneRewardVisualAsset
>;
