import {
  QUEST_ONE_BACKGROUNDS,
  type QuestOneBackgroundAct,
} from "./quest-1-backgrounds";
import styles from "./quest-1.module.css";

type QuestOneSceneBackgroundProps = {
  act: QuestOneBackgroundAct;
};

/** Purely decorative, responsive scene art for the approved Phase 3 acts. */
export function QuestOneSceneBackground({
  act,
}: QuestOneSceneBackgroundProps) {
  const background = QUEST_ONE_BACKGROUNDS[act];

  return (
    <div className={styles.sceneBackground} aria-hidden="true">
      <picture>
        <source media="(max-width: 640px)" srcSet={background.mobile} />
        <img alt="" draggable={false} src={background.desktop} />
      </picture>
    </div>
  );
}
