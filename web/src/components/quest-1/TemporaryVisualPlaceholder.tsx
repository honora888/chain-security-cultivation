import styles from "./quest-1.module.css";

interface TemporaryVisualPlaceholderProps {
  compact?: boolean;
}

export function TemporaryVisualPlaceholder({
  compact = false,
}: TemporaryVisualPlaceholderProps) {
  return (
    <div
      className={`${styles.visualPlaceholder} ${
        compact ? styles.visualPlaceholderCompact : ""
      }`}
      role="img"
      aria-label="Temporary Visual Placeholder：噬灵回环兽正式插画待补充"
    >
      <span className={styles.placeholderLabel}>
        Temporary Visual Placeholder
      </span>
      <strong>噬灵回环兽正式插画待补充</strong>
      <p>此处不使用参考稿整图、裁切图或 CSS 图形替代妖兽。</p>
    </div>
  );
}
