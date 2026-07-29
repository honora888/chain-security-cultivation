export const QUEST_ONE_BACKGROUNDS = {
  act1: {
    desktop:
      "/assets/quest-1/ui/backgrounds/quest-1-act1-background-desktop.webp",
    mobile:
      "/assets/quest-1/ui/backgrounds/quest-1-act1-background-mobile.webp",
  },
  act2: {
    desktop:
      "/assets/quest-1/ui/backgrounds/quest-1-act2-background-desktop.webp",
    mobile:
      "/assets/quest-1/ui/backgrounds/quest-1-act2-background-mobile.webp",
  },
  act3: {
    desktop:
      "/assets/quest-1/ui/backgrounds/quest-1-act3-background-desktop.webp",
    mobile:
      "/assets/quest-1/ui/backgrounds/quest-1-act3-background-mobile.webp",
  },
  act4: {
    desktop:
      "/assets/quest-1/ui/backgrounds/quest-1-act4-background-desktop.webp",
    mobile:
      "/assets/quest-1/ui/backgrounds/quest-1-act4-background-mobile.webp",
  },
  act5: {
    desktop:
      "/assets/quest-1/ui/backgrounds/quest-1-act5-background-desktop.webp",
    mobile:
      "/assets/quest-1/ui/backgrounds/quest-1-act5-background-mobile.webp",
  },
  act6: {
    desktop:
      "/assets/quest-1/ui/backgrounds/quest-1-act6-background-desktop.webp",
    mobile:
      "/assets/quest-1/ui/backgrounds/quest-1-act6-background-mobile.webp",
  },
} as const;

export type QuestOneBackgroundAct = keyof typeof QUEST_ONE_BACKGROUNDS;
