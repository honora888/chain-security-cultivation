import type { ReactNode } from "react";

import { QuestOneIcon } from "./QuestOneIcon";
import styles from "./quest-1.module.css";

interface CodeScrollProps {
  children: ReactNode;
  fileName: string;
  functionName: string;
  className?: string;
}

export function CodeScroll({ children, className = "", fileName, functionName }: CodeScrollProps) {
  return (
    <section className={`${styles.codeScrollFrame} ${className}`} aria-label={`${fileName} ${functionName} 代码卷轴`}>
      <span className={`${styles.scrollRod} ${styles.scrollRodLeft}`} aria-hidden="true" />
      <div className={styles.codeScrollContent}>
        <header>
          <span><QuestOneIcon name="code-scroll" aria-hidden="true" />{fileName}</span>
          <code>{functionName}</code>
        </header>
        {children}
      </div>
      <span className={`${styles.scrollRod} ${styles.scrollRodRight}`} aria-hidden="true" />
    </section>
  );
}
