"use client";

import type { RefObject } from "react";

import { QUEST_ONE_REPAIR_BLOCKS, QUEST_ONE_COPY } from "@/data/quest-1";
import type {
  RepairBlockId,
  RepairCodeBlock,
  RepairFeedback,
  RepairMoveDirection,
} from "@/features/quest-1/battle-types";

import { JadeActionButton } from "./JadeActionButton";

import styles from "./quest-1.module.css";

interface RepairOrderPuzzleProps {
  order: RepairBlockId[];
  feedback: RepairFeedback;
  disabled: boolean;
  statusRef: RefObject<HTMLDivElement | null>;
  onMove: (blockId: RepairBlockId, direction: RepairMoveDirection) => void;
  onReset: () => void;
}

function getOrderAssessment(
  order: RepairBlockId[],
  blockId: RepairBlockId,
): { safe: boolean; text: string } {
  const index = order.indexOf(blockId);
  const checksIndex = order.indexOf("checks");
  const effectsIndex = order.indexOf("effects");
  const interactionsIndex = order.indexOf("interactions");

  if (blockId === "checks") {
    return index === 0
      ? {
          safe: true,
          text: "检查位于阵首，余额会在任何状态修改或外部调用前完成验证。",
        }
      : {
          safe: false,
          text: "检查没有位于阵首，不能保证后续操作只处理有效提款。",
        };
  }

  if (blockId === "effects") {
    const safe =
      checksIndex < effectsIndex && effectsIndex < interactionsIndex;
    return safe
      ? {
          safe: true,
          text: "内部余额先清零，receive() 回调时无法再次读取同一余额。",
        }
      : {
          safe: false,
          text: "内部状态仍在外部交互之后更新，重入窗口尚未关闭。",
        };
  }

  const safe =
    effectsIndex < interactionsIndex &&
    interactionsIndex === order.length - 1;
  return safe
    ? {
        safe: true,
        text: "外部调用位于阵尾；调用失败时整笔交易回滚，先前状态不会永久错误清除。",
      }
    : {
        safe: false,
        text: "外部交互仍然发生在内部状态更新之前，receive() 可重新进入 withdraw()。",
      };
}

function isRepairCodeBlock(
  block: RepairCodeBlock | undefined,
): block is RepairCodeBlock {
  return Boolean(block);
}

export function RepairOrderPuzzle({
  order,
  feedback,
  disabled,
  statusRef,
  onMove,
  onReset,
}: RepairOrderPuzzleProps) {
  const orderedBlocks = order
    .map((blockId) =>
      QUEST_ONE_REPAIR_BLOCKS.find((block) => block.id === blockId),
    )
    .filter(isRepairCodeBlock);

  return (
    <section
      className={styles.repairPuzzle}
      aria-labelledby="repair-order-title"
    >
      <header className={styles.repairPuzzleHeader}>
        <div>
          <span>修复机关</span>
          <h2 id="repair-order-title">重排 CEI 阵序</h2>
          <p>使用上移与下移，将三段真实合约代码排成安全执行顺序。</p>
        </div>
        <JadeActionButton
          className={styles.repairResetButton}
          disabled={disabled}
          onClick={onReset}
          type="button"
        >
          恢复初始顺序
        </JadeActionButton>
      </header>

      <ol className={styles.repairOrderList} aria-label="当前修复代码块顺序">
        {orderedBlocks.map((block, index) => {
          const assessment = getOrderAssessment(order, block.id);
          const titleId = `repair-block-${block.id}`;

          return (
            <li
              className={styles.repairBlock}
              data-safe={assessment.safe ? "true" : "false"}
              key={block.id}
            >
              <article aria-labelledby={titleId}>
                <header className={styles.repairBlockHeader}>
                  <span className={styles.repairOrderNumber}>
                    阵位 {index + 1}
                  </span>
                  <div>
                    <strong id={titleId}>{block.englishName}</strong>
                    <span>{block.chineseName}</span>
                  </div>
                </header>

                <div
                  className={styles.repairCodeScroll}
                  tabIndex={0}
                  aria-label={`${block.englishName} 代码`}
                >
                  <pre>
                    <code>{block.code.join("\n")}</code>
                  </pre>
                </div>

                <p className={styles.repairPurpose}>{block.purpose}</p>
                <p className={styles.repairAssessment}>
                  <strong>{assessment.safe ? "顺序安全" : "顺序危险"}</strong>
                  <span>{assessment.text}</span>
                </p>

                <div
                  className={styles.repairMoveControls}
                  role="group"
                  aria-label={`${block.englishName} 排序操作`}
                >
                  <button
                    aria-label={`上移 ${block.englishName}（${block.chineseName}）`}
                    disabled={disabled || index === 0}
                    onClick={() => onMove(block.id, "up")}
                    type="button"
                  >
                    上移
                  </button>
                  <button
                    aria-label={`下移 ${block.englishName}（${block.chineseName}）`}
                    disabled={
                      disabled || index === orderedBlocks.length - 1
                    }
                    onClick={() => onMove(block.id, "down")}
                    type="button"
                  >
                    下移
                  </button>
                </div>
              </article>
            </li>
          );
        })}
      </ol>

      <div
        className={styles.repairFeedbackSlot}
        data-feedback={feedback ?? "idle"}
        ref={statusRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {feedback === "invalid" ? (
          <p>
            <strong>阵序尚未闭合</strong>
            <span>{QUEST_ONE_COPY.act5.error}</span>
            <small>
              外部交互仍然发生在内部状态更新之前。继续调整阵位后重新提交。
            </small>
          </p>
        ) : null}
      </div>
    </section>
  );
}
