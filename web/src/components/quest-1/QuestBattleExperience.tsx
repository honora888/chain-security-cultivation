"use client";

import Link from "next/link";
import {
  type AnimationEvent,
  type CSSProperties,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import {
  QUEST_ONE,
  QUEST_ONE_ATTACK_REPLAY_STEPS,
  QUEST_ONE_CODE_LINES,
  QUEST_ONE_COPY,
  QUEST_ONE_REPLAY_TIMING,
} from "@/data/quest-1";
import {
  battleReducer,
  createInitialBattleState,
} from "@/features/quest-1/battle-reducer";
import {
  clearBattleProgress,
  loadBattleData,
  saveBattleProgress,
  saveMotionMode,
} from "@/features/quest-1/persistence";
import type {
  BattleEvent,
  BattleState,
  MotionMode,
} from "@/features/quest-1/battle-types";

import { AttackReplay } from "./AttackReplay";
import { ClassificationPuzzle } from "./ClassificationPuzzle";
import { CodeLinePuzzle } from "./CodeLinePuzzle";
import { TemporaryVisualPlaceholder } from "./TemporaryVisualPlaceholder";
import styles from "./quest-1.module.css";

function getLiveMessage(
  phase: ReturnType<typeof createInitialBattleState>["phase"],
): string {
  switch (phase) {
    case "ACT1_READY":
      return "噬灵回环兽现身，迎战操作已可用。";
    case "ACT2_LOCATE":
      return "请选择一行代码，然后确认剑诀。";
    case "ACT2_WRONG":
    case "ACT2_PARTIAL":
    case "ACT2_HIT":
    case "ACT3_CLASSIFY":
    case "ACT3_FORMATION":
    case "ACT4_REPLAY":
    case "ACT4_COMPLETE":
      return "";
    default:
      return "水灵秘境正在显现。";
  }
}

function persistBattleState(state: BattleState) {
  const replayStatus =
    state.replayStatus === "playing" ? "paused" : state.replayStatus;

  saveBattleProgress({
    checkpoint: state.checkpoint,
    classificationAnswers: state.classificationAnswers,
    replayStep: state.replayStep,
    replayStatus,
    viewedReplaySteps: state.viewedReplaySteps,
  });
}

export function QuestBattleExperience() {
  const [state, dispatch] = useReducer(
    battleReducer,
    undefined,
    () => createInitialBattleState(),
  );
  const [systemReduced, setSystemReduced] = useState(false);
  const hydratedOnce = useRef(false);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const classificationFeedbackRef = useRef<HTMLDivElement>(null);

  const reducedMotion =
    state.motionMode === "reduced" ||
    (state.motionMode === "system" && systemReduced);
  const isActTwo = state.phase.startsWith("ACT2");
  const isActThree = state.phase.startsWith("ACT3");
  const isActFour = state.phase.startsWith("ACT4");
  const copy = isActFour
    ? QUEST_ONE_COPY.act4
    : isActThree
      ? QUEST_ONE_COPY.act3
      : isActTwo
        ? QUEST_ONE_COPY.act2
        : QUEST_ONE_COPY.act1;
  const replayFullyViewed = QUEST_ONE_ATTACK_REPLAY_STEPS.every((step) =>
    state.viewedReplaySteps.includes(step.id),
  );
  const liveMessage = useMemo(() => getLiveMessage(state.phase), [state.phase]);

  useEffect(() => {
    if (hydratedOnce.current) return;
    hydratedOnce.current = true;
    dispatch({ type: "HYDRATE", payload: loadBattleData() });
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setSystemReduced(mediaQuery.matches);
    syncPreference();
    mediaQuery.addEventListener("change", syncPreference);
    return () => mediaQuery.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    if (state.hydrated && state.phase === "ENTRY") {
      dispatch({ type: "ENTER_QUEST" });
    }
  }, [state.hydrated, state.phase]);

  useEffect(() => {
    if (!state.hydrated) return;
    persistBattleState(state);
  }, [state]);

  useEffect(() => {
    if (!state.hydrated) return;
    saveMotionMode(state.motionMode);
  }, [state.hydrated, state.motionMode]);

  useEffect(() => {
    if (
      state.phase !== "ACT4_REPLAY" ||
      state.replayStatus !== "playing"
    ) {
      return;
    }

    const timer = window.setTimeout(
      () => {
        const event: BattleEvent = { type: "REPLAY_STEP_FINISHED" };
        const nextState = battleReducer(state, event);
        persistBattleState(nextState);
        dispatch(event);
      },
      QUEST_ONE_REPLAY_TIMING.autoAdvance,
    );
    return () => window.clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.visibilityState === "hidden") {
        dispatch({ type: "REPLAY_PAUSE" });
      }
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () =>
      document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);

  useEffect(() => {
    if (state.phase !== "ACT2_WRONG" && state.phase !== "ACT2_PARTIAL") {
      return;
    }
    const timer = window.setTimeout(
      () => dispatch({ type: "CODE_FEEDBACK_FINISHED" }),
      3000,
    );
    return () => window.clearTimeout(timer);
  }, [state.phase]);

  useEffect(() => {
    const feedbackElement = feedbackRef.current;
    if (
      !state.codeFeedback ||
      !feedbackElement ||
      !window.matchMedia("(max-width: 767px)").matches
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const feedbackRect = feedbackElement.getBoundingClientRect();
      const commandBar = document.querySelector(
        '[aria-label="当前战斗指令"]',
      );
      const commandBarTop =
        commandBar?.getBoundingClientRect().top ?? window.innerHeight;
      const visibleBottom = Math.min(window.innerHeight, commandBarTop);
      const outsideViewport =
        feedbackRect.top < 0 || feedbackRect.bottom > visibleBottom;

      if (outsideViewport) {
        feedbackElement.scrollIntoView({
          behavior: reducedMotion ? "auto" : "smooth",
          block: "nearest",
        });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [reducedMotion, state.codeFeedback]);

  useEffect(() => {
    const feedbackElement = classificationFeedbackRef.current;
    if (
      !state.classificationFeedback ||
      !feedbackElement ||
      !window.matchMedia("(max-width: 767px)").matches
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const feedbackRect = feedbackElement.getBoundingClientRect();
      const commandBar = document.querySelector(
        '[aria-label="当前战斗指令"]',
      );
      const commandBarTop =
        commandBar?.getBoundingClientRect().top ?? window.innerHeight;
      const visibleBottom = Math.min(window.innerHeight, commandBarTop);
      const outsideViewport =
        feedbackRect.top < 0 || feedbackRect.bottom > visibleBottom;

      if (outsideViewport) {
        feedbackElement.scrollIntoView({
          behavior: reducedMotion ? "auto" : "smooth",
          block: "nearest",
        });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [reducedMotion, state.classificationFeedback]);

  useEffect(() => {
    if (!reducedMotion) return;

    if (state.phase === "ACT1_APPEARING") {
      dispatch({
        type: "ANIMATION_FINISHED",
        animation: "beast-entry",
      });
    } else if (state.phase === "ACT2_HIT" && state.checkpoint !== "ACT2_HIT") {
      dispatch({
        type: "ANIMATION_FINISHED",
        animation: "code-strike",
      });
    } else if (
      state.phase === "ACT3_FORMATION" &&
      state.checkpoint !== "ACT3_FORMATION"
    ) {
      dispatch({ type: "CLASSIFICATION_FEEDBACK_FINISHED" });
    }
  }, [reducedMotion, state.checkpoint, state.phase]);

  function handleStageAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;

    if (state.phase === "ACT1_APPEARING") {
      dispatch({
        type: "ANIMATION_FINISHED",
        animation: "beast-entry",
      });
    } else if (state.phase === "ACT2_HIT" && state.checkpoint !== "ACT2_HIT") {
      dispatch({
        type: "ANIMATION_FINISHED",
        animation: "code-strike",
      });
    } else if (
      state.phase === "ACT3_FORMATION" &&
      state.checkpoint !== "ACT3_FORMATION"
    ) {
      dispatch({ type: "CLASSIFICATION_FEEDBACK_FINISHED" });
    }
  }

  function handleMotionMode(mode: MotionMode) {
    dispatch({ type: "SET_MOTION_MODE", mode });
  }

  function handleReplayEvent(event: BattleEvent) {
    const nextState = battleReducer(state, event);
    if (nextState !== state) {
      persistBattleState(nextState);
    }
    dispatch(event);
  }

  function handleReset() {
    clearBattleProgress();
    dispatch({ type: "RESET_QUEST" });
  }

  if (!state.hydrated) {
    return (
      <main className={styles.loadingScreen}>
        <p>水灵秘境正在显现</p>
      </main>
    );
  }

  const feedback =
    state.codeFeedback === "wrong"
      ? { title: "错误", text: "妖兽闪避。" }
      : state.codeFeedback === "partial"
        ? {
            title: "部分正确",
            text: "已找到关联行，再定位打开窗口的一行。",
          }
        : state.codeFeedback === "correct"
          ? { title: "正确", text: "重入窗口已锁定。" }
          : null;

  const hpStyle = {
    "--boss-hp": `${state.bossHp}%`,
  } as CSSProperties;

  const stageAnimationClass =
    state.phase === "ACT1_APPEARING"
      ? styles.beastEntrance
      : state.phase === "ACT2_HIT" && state.checkpoint !== "ACT2_HIT"
        ? styles.codeStrike
        : state.phase === "ACT3_FORMATION" &&
            state.checkpoint !== "ACT3_FORMATION"
          ? styles.formationReveal
          : "";

  return (
    <main
      className={styles.battlePage}
      data-reduced-motion={reducedMotion ? "true" : "false"}
    >
      <header className={styles.battleHud}>
        <Link className={styles.backLink} href="/">
          返回山门
        </Link>

        <div className={styles.bossIdentity}>
          <div>
            <span>
              Quest {QUEST_ONE.id} · {QUEST_ONE.realm} · {QUEST_ONE.element}系
            </span>
            <strong>{QUEST_ONE.name}</strong>
          </div>
          <div className={styles.hpGroup}>
            <div className={styles.hpLabel}>
              <span>Boss HP</span>
              <strong>{state.bossHp}%</strong>
            </div>
            <div
              className={styles.hpTrack}
              role="progressbar"
              aria-label="Boss 本地战斗生命值"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={state.bossHp}
            >
              <span className={styles.hpFill} style={hpStyle} />
            </div>
            <small>本地学习进度</small>
          </div>
        </div>

        <div className={styles.hudActions}>
          <label>
            <span>动态效果</span>
            <select
              value={state.motionMode}
              onChange={(event) =>
                handleMotionMode(event.target.value as MotionMode)
              }
            >
              <option value="system">跟随系统</option>
              <option value="full">完整动态</option>
              <option value="reduced">减少动态</option>
            </select>
          </label>
          <button className={styles.textButton} onClick={handleReset}>
            重置修炼
          </button>
        </div>
      </header>

      <section className={styles.battleStage} aria-labelledby="stage-title">
        <div className={styles.stageHeading}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1 id="stage-title">
            {isActFour
              ? "回环噬灵"
              : isActThree
                ? "识破妖法"
              : isActTwo
                ? "锁定重入窗口"
                : "噬灵回环兽现身"}
          </h1>
        </div>

        {isActFour ? (
          <AttackReplay
            complete={state.phase === "ACT4_COMPLETE"}
            currentStep={state.replayStep}
            onNext={() => handleReplayEvent({ type: "REPLAY_NEXT" })}
            onPause={() => handleReplayEvent({ type: "REPLAY_PAUSE" })}
            onPlay={() => handleReplayEvent({ type: "REPLAY_PLAY" })}
            onPrevious={() =>
              handleReplayEvent({ type: "REPLAY_PREVIOUS" })
            }
            onRestart={() => handleReplayEvent({ type: "REPLAY_RESTART" })}
            reducedMotion={reducedMotion}
            status={state.replayStatus}
            steps={QUEST_ONE_ATTACK_REPLAY_STEPS}
            viewedSteps={state.viewedReplaySteps}
          />
        ) : isActThree ? (
          <div
            className={`${styles.classificationStage} ${stageAnimationClass}`}
            onAnimationEnd={handleStageAnimationEnd}
          >
            <ClassificationPuzzle
              answers={state.classificationAnswers}
              complete={state.phase === "ACT3_FORMATION"}
              disabled={
                state.transitionLocked || state.phase === "ACT3_FORMATION"
              }
              feedback={state.classificationFeedback}
              onChange={(field, value) =>
                dispatch({ type: "SET_CLASSIFICATION", field, value })
              }
              results={state.classificationResults}
              statusRef={classificationFeedbackRef}
            />
            <div
              className={`${styles.waterFormation} ${
                state.phase === "ACT3_FORMATION"
                  ? styles.waterFormationActive
                  : ""
              }`}
              aria-hidden="true"
            >
              <span />
              <span />
              <span />
              <strong>水</strong>
            </div>
          </div>
        ) : isActTwo ? (
          <div
            className={`${styles.codeStage} ${stageAnimationClass}`}
            onAnimationEnd={handleStageAnimationEnd}
          >
            <div className={styles.codePuzzleColumn}>
              <CodeLinePuzzle
                lines={QUEST_ONE_CODE_LINES}
                selectedLineId={state.selectedCodeLineId}
                feedback={state.codeFeedback}
                disabled={state.transitionLocked}
                onSelect={(lineId) =>
                  dispatch({ type: "SELECT_CODE_LINE", lineId })
                }
              />
              <div
                className={styles.feedbackSlot}
                ref={feedbackRef}
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {feedback ? (
                  <p
                    className={`${styles.feedback} ${
                      styles[`feedback_${state.codeFeedback}`]
                    }`}
                  >
                    <strong className={styles.feedbackTitle}>
                      {feedback.title}
                    </strong>
                    <span>{feedback.text}</span>
                  </p>
                ) : null}
              </div>
            </div>
            <div className={styles.beastSide}>
              <TemporaryVisualPlaceholder compact />
            </div>
          </div>
        ) : (
          <div
            className={`${styles.beastScene} ${stageAnimationClass}`}
            onAnimationEnd={handleStageAnimationEnd}
          >
            <TemporaryVisualPlaceholder />
          </div>
        )}
      </section>

      <section className={styles.commandBar} aria-label="当前战斗指令">
        <p className={styles.dialogue}>
          <span>守阵长老</span>
          {copy.dialogue}
        </p>
        <div className={styles.objective}>
          <span>当前目标</span>
          <strong>{copy.target}</strong>
          <small>{copy.hint}</small>
        </div>
        {isActFour ? (
          <button
            className={styles.primaryButton}
            disabled={
              state.phase === "ACT4_COMPLETE" ||
              state.transitionLocked ||
              !replayFullyViewed
            }
            onClick={() =>
              handleReplayEvent({ type: "CONFIRM_ATTACK_REPLAY" })
            }
          >
            {state.phase === "ACT4_COMPLETE" ? "回环已看破" : copy.action}
          </button>
        ) : isActThree ? (
          <button
            className={styles.primaryButton}
            disabled={state.transitionLocked}
            onClick={() => {
              if (state.phase === "ACT3_FORMATION") {
                handleReplayEvent({ type: "ENTER_ATTACK_REPLAY" });
              } else {
                dispatch({ type: "SUBMIT_CLASSIFICATION" });
              }
            }}
          >
            {state.phase === "ACT3_FORMATION" ? "追溯回环" : copy.action}
          </button>
        ) : isActTwo ? (
          state.phase === "ACT2_HIT" ? (
            <button
              className={styles.primaryButton}
              disabled={state.transitionLocked}
              onClick={() => dispatch({ type: "ENTER_CLASSIFICATION" })}
            >
              继续追击
            </button>
          ) : (
            <button
              className={styles.primaryButton}
              disabled={!state.selectedCodeLineId || state.transitionLocked}
              onClick={() => dispatch({ type: "CONFIRM_CODE_LINE" })}
            >
              {copy.action}
            </button>
          )
        ) : (
          <button
            className={styles.primaryButton}
            disabled={state.phase !== "ACT1_READY" || state.transitionLocked}
            onClick={() => dispatch({ type: "START_BATTLE" })}
          >
            {state.phase === "ACT1_APPEARING" ? "妖兽现身中" : copy.action}
          </button>
        )}
      </section>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </p>
    </main>
  );
}
