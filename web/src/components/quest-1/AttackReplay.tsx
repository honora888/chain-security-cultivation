"use client";

import type { CSSProperties } from "react";

import { QUEST_ONE_REPLAY_TIMING } from "@/data/quest-1";
import type {
  AttackReplayStep,
  ReplayStatus,
} from "@/features/quest-1/battle-types";

import styles from "./quest-1.module.css";

interface AttackReplayProps {
  steps: AttackReplayStep[];
  currentStep: number;
  status: ReplayStatus;
  viewedSteps: number[];
  complete: boolean;
  reducedMotion: boolean;
  onPlay: () => void;
  onPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onRestart: () => void;
}

const replayTimingStyle = {
  "--replay-balance-duration": `${QUEST_ONE_REPLAY_TIMING.balanceTransition}ms`,
  "--replay-transfer-duration": `${QUEST_ONE_REPLAY_TIMING.transferPath}ms`,
  "--replay-loop-duration": `${QUEST_ONE_REPLAY_TIMING.loopPath}ms`,
  "--replay-warning-duration": `${QUEST_ONE_REPLAY_TIMING.warningReveal}ms`,
} as CSSProperties;

function getPlaybackLabel(status: ReplayStatus): string {
  switch (status) {
    case "playing":
      return "正在播放";
    case "paused":
      return "已暂停";
    case "complete":
      return "五步已浏览";
    default:
      return "等待播放";
  }
}

export function AttackReplay({
  steps,
  currentStep,
  status,
  viewedSteps,
  complete,
  reducedMotion,
  onPlay,
  onPause,
  onPrevious,
  onNext,
  onRestart,
}: AttackReplayProps) {
  const step = steps[currentStep];
  const atFirstStep = currentStep === 0;
  const atLastStep = currentStep === steps.length - 1;
  const isPlaying = status === "playing";
  const playbackLabel = getPlaybackLabel(status);

  return (
    <section
      className={styles.replayShell}
      data-flow={step.flow}
      data-playing={isPlaying ? "true" : "false"}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      style={replayTimingStyle}
      aria-labelledby="replay-step-title"
    >
      {complete ? (
        <div className={styles.replayCompleteBanner} role="status">
          <span>回环已断明</span>
          <strong>回环已看破</strong>
          <p>
            call 在账本清零前触发 receive()，receive() 又重新进入
            withdraw()。
          </p>
        </div>
      ) : null}

      <div className={styles.replayProgress}>
        <div
          className={styles.replayLiveStep}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span>
            当前步骤 {currentStep + 1} / {steps.length}
          </span>
          <strong id="replay-step-title">{step.title}</strong>
          <small>{playbackLabel}</small>
        </div>

        <ol className={styles.replayStepList} aria-label="攻击回放五个步骤">
          {steps.map((replayStep) => {
            const isCurrent = replayStep.id === currentStep;
            const isViewed = viewedSteps.includes(replayStep.id);
            return (
              <li
                data-current={isCurrent ? "true" : "false"}
                data-viewed={isViewed ? "true" : "false"}
                key={replayStep.id}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span>{replayStep.id + 1}</span>
                <strong>{replayStep.title}</strong>
                <small>
                  {isCurrent ? "当前" : isViewed ? "已浏览" : "未浏览"}
                </small>
              </li>
            );
          })}
        </ol>
      </div>

      <div className={styles.replayStage} key={step.id}>
        <div className={styles.replayFlowPanel}>
          <svg
            className={styles.replayFlowSvg}
            viewBox="0 0 780 260"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <marker
                id="replay-arrow"
                markerHeight="8"
                markerWidth="8"
                orient="auto"
                refX="7"
                refY="4"
              >
                <path d="M0,0 L8,4 L0,8 Z" />
              </marker>
            </defs>
            <path
              className={`${styles.replayPath} ${styles.replayDepositPath}`}
              d="M570 166 C500 230 280 230 208 166"
              markerEnd="url(#replay-arrow)"
            />
            <path
              className={`${styles.replayPath} ${styles.replayTransferPath}`}
              d="M210 92 C300 24 486 24 570 92"
              markerEnd="url(#replay-arrow)"
            />
            <path
              className={`${styles.replayPath} ${styles.replayLoopPath}`}
              d="M590 126 C690 76 704 208 596 196 C530 188 520 142 570 122"
              markerEnd="url(#replay-arrow)"
            />
          </svg>

          <div className={`${styles.replayActor} ${styles.replayVault}`}>
            <span>公益金库</span>
            <strong>{step.vaultBalance}</strong>
            <small>VulnerableCharityVault</small>
          </div>
          <div className={`${styles.replayActor} ${styles.replayAttacker}`}>
            <span>攻击合约</span>
            <strong>{step.attackerBalance}</strong>
            <small>ReentrancyAttacker</small>
          </div>
          <div className={styles.replayFlowCaption}>
            <span>资金流向</span>
            <strong>{step.funds}</strong>
          </div>
        </div>

        <article className={styles.replayEvidence}>
          <header>
            <span>当前执行方</span>
            <strong>{step.actor}</strong>
            <code>{step.fn}</code>
          </header>

          <dl className={styles.replayBalances}>
            <div>
              <dt>金库余额</dt>
              <dd>{step.vaultBalance}</dd>
            </div>
            <div>
              <dt>攻击合约余额</dt>
              <dd>{step.attackerBalance}</dd>
            </div>
            <div data-danger={step.ledgerCleared ? "false" : "true"}>
              <dt>攻击者账面余额</dt>
              <dd>{step.ledgerBalance}</dd>
            </div>
          </dl>

          <div className={styles.replayReason}>
            <span>
              {step.ledgerCleared ? "账本已清零" : "balances 尚未清零"}
            </span>
            <p>{step.reentryReason}</p>
          </div>

          <div className={styles.callStack}>
            <span>调用栈</span>
            <ol>
              {step.callStack.map((frame, index) => (
                <li key={`${step.id}-${frame}`}>
                  <span>{index + 1}</span>
                  <code>{frame}</code>
                </li>
              ))}
            </ol>
          </div>
        </article>
      </div>

      <div
        className={styles.replayControls}
        role="group"
        aria-label="攻击回放控制"
      >
        <button
          disabled={complete || atFirstStep}
          onClick={onPrevious}
          type="button"
        >
          上一步
        </button>
        <button
          className={styles.replayPlayButton}
          disabled={complete || (!isPlaying && atLastStep)}
          onClick={isPlaying ? onPause : onPlay}
          type="button"
          aria-label={isPlaying ? "暂停攻击回放" : "播放攻击回放"}
        >
          {isPlaying ? "暂停" : "播放"}
        </button>
        <button
          disabled={complete || atLastStep}
          onClick={onNext}
          type="button"
        >
          下一步
        </button>
        <button disabled={complete} onClick={onRestart} type="button">
          重新播放
        </button>
      </div>

      <p className={styles.replaySourceNote}>
        Foundry 场景复现 · 金库初始 10 ETH · 攻击者存入 1 ETH ·
        重入次数 &gt; 1
      </p>
    </section>
  );
}
