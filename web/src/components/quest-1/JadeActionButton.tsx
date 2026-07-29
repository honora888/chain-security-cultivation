import type { ButtonHTMLAttributes } from "react";

import styles from "./quest-1.module.css";

type JadeActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "success" | "ghost";
};

export function JadeActionButton({
  children,
  className = "",
  variant = "primary",
  ...props
}: JadeActionButtonProps) {
  return (
    <button className={`${styles.jadeActionButton} ${styles[`jade_${variant}`]} ${className}`} {...props}>
      <span className={`${styles.jadeButtonCap} ${styles.jadeButtonCapStart}`} aria-hidden="true" />
      <span className={styles.jadeButtonLabel}>{children}</span>
      <span className={`${styles.jadeButtonCap} ${styles.jadeButtonCapEnd}`} aria-hidden="true" />
    </button>
  );
}
