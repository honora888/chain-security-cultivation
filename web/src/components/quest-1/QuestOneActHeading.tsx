import { QuestOneIcon } from "./QuestOneIcon";
import styles from "./quest-1.module.css";

interface QuestOneActHeadingProps {
  eyebrow: string;
  title: string;
}

export function QuestOneActHeading({ eyebrow, title }: QuestOneActHeadingProps) {
  return (
    <div className={styles.questActHeading}>
      <p><span aria-hidden="true">◇</span>{eyebrow}<span aria-hidden="true">◇</span></p>
      <h1 id="stage-title">{title}</h1>
      <span className={styles.actHeadingRule} aria-hidden="true"><QuestOneIcon name="water-drop" /></span>
    </div>
  );
}
