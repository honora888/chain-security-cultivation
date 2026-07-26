"use client";

import {
  type KeyboardEvent,
  useRef,
} from "react";

import type { CodeLine, CodeVerdict } from "@/features/quest-1/battle-types";

import styles from "./quest-1.module.css";

interface CodeLinePuzzleProps {
  lines: CodeLine[];
  selectedLineId: string | null;
  feedback: CodeVerdict | null;
  disabled: boolean;
  onSelect: (lineId: string) => void;
}

export function CodeLinePuzzle({
  lines,
  selectedLineId,
  feedback,
  disabled,
  onSelect,
}: CodeLinePuzzleProps) {
  const lineRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function moveFocus(currentIndex: number, nextIndex: number) {
    const normalized = (nextIndex + lines.length) % lines.length;
    const nextLine = lines[normalized];
    onSelect(nextLine.id);
    lineRefs.current[normalized]?.focus();
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (disabled) return;

    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowRight" ||
      event.key === "ArrowUp" ||
      event.key === "ArrowLeft"
    ) {
      event.preventDefault();
      const direction =
        event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
      moveFocus(index, index + direction);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveFocus(index, 0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveFocus(index, lines.length - 1);
    }
  }

  return (
    <div className={styles.codeScroll}>
      <div
        className={styles.codePanel}
        role="radiogroup"
        aria-label="选择最先打开重入窗口的代码行"
        aria-disabled={disabled}
      >
        <div className={styles.codeHeader}>
          <span>GuardianVault.sol</span>
          <span>withdraw()</span>
        </div>
        <div className={styles.codeLines}>
          {lines.map((line, index) => {
            const selected = selectedLineId === line.id;
            const feedbackClass =
              selected && feedback ? styles[`line_${feedback}`] : "";

            return (
              <button
                className={`${styles.codeLine} ${
                  selected ? styles.codeLineSelected : ""
                } ${feedbackClass}`}
                disabled={disabled}
                key={line.id}
                onClick={() => onSelect(line.id)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                ref={(element) => {
                  lineRefs.current[index] = element;
                }}
                role="radio"
                aria-checked={selected}
                tabIndex={selected || (!selectedLineId && index === 0) ? 0 : -1}
              >
                <span className={styles.lineNumber}>{line.lineNumber}</span>
                <code>{line.code}</code>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
