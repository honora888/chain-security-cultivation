import styles from "./quest-1.module.css";

export function QuestOneBackdrop() {
  return (
    <div className={styles.questBackdrop} aria-hidden="true">
      <span className={styles.sceneMountains} />
      <span className={styles.sceneGate} />
      <span className={styles.sceneMist} />
      <span className={styles.scenePlatform} />
    </div>
  );
}
