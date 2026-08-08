"use client";

import Image from "next/image";
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
  QUEST_ONE_SEAL_TIMING,
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
import {
  completeQuestOne,
  cultivationApiErrorMessage,
  getCultivationProfile,
} from "@/features/cultivation/cultivation-api-client";
import {
  QUEST_ONE_COMPLETION_EVIDENCE_SCHEMA_VERSION,
  type CultivationCompletionResponse,
  type CultivationProfile,
} from "@/features/cultivation/contracts";
import { cultivationRealmLabel } from "@/features/guardian-security/cultivation-labels";
import { useWalletAuth } from "@/features/wallet-auth/wallet-auth-provider";

import { AttackReplay } from "./AttackReplay";
import { BestiaryEntryDialog } from "./BestiaryEntryDialog";
import { ClassificationPuzzle } from "./ClassificationPuzzle";
import { CodeLinePuzzle } from "./CodeLinePuzzle";
import { DormantBeastLoop } from "./DormantBeastLoop";
import { QuestOneActHeading } from "./QuestOneActHeading";
import { QuestOneIcon, type QuestOneIconName } from "./QuestOneIcon";
import { RepairOrderPuzzle } from "./RepairOrderPuzzle";
import { RewardSequence } from "./RewardSequence";
import { SealFormationResult } from "./SealFormationResult";
import { WaterFormationSigil } from "./WaterFormationSigil";
import { QuestOneSceneBackground } from "./QuestOneSceneBackground";
import type { QuestOneBackgroundAct } from "./quest-1-backgrounds";
import { QuestEntryPage } from "./QuestEntryPage";
import styles from "./quest-1.module.css";

type QuestExperienceStage = "entry" | "battle";

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
    case "ACT5_REPAIR":
    case "ACT5_SEALING":
    case "ACT5_COMPLETE":
    case "ACT6_REWARDING":
    case "ACT6_COMPLETE":
    case "BESTIARY_OPEN":
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
    repairOrder: state.repairOrder,
  });
}

export function QuestBattleExperience() {
  const wallet = useWalletAuth();
  const [experienceStage, setExperienceStage] =
    useState<QuestExperienceStage>("entry");
  const [state, dispatch] = useReducer(
    battleReducer,
    undefined,
    () => createInitialBattleState(),
  );
  const [systemReduced, setSystemReduced] = useState(false);
  const [profile, setProfile] = useState<CultivationProfile | null>(null);
  const [profileWallet, setProfileWallet] = useState("");
  const [settlement, setSettlement] = useState<CultivationCompletionResponse | null>(null);
  const [settlementStatus, setSettlementStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [settlementError, setSettlementError] = useState<string | null>(null);
  const settlementInFlight = useRef(false);
  const hydratedOnce = useRef(false);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const classificationFeedbackRef = useRef<HTMLDivElement>(null);
  const repairFeedbackRef = useRef<HTMLDivElement>(null);

  const reducedMotion =
    state.motionMode === "reduced" ||
    (state.motionMode === "system" && systemReduced);
  const isActTwo = state.phase.startsWith("ACT2");
  const isActThree = state.phase.startsWith("ACT3");
  const isActFour = state.phase.startsWith("ACT4");
  const isActFive = state.phase.startsWith("ACT5");
  const isActSix =
    state.phase.startsWith("ACT6") || state.phase === "BESTIARY_OPEN";
  const copy = isActSix
    ? QUEST_ONE_COPY.act6
    : isActFive
      ? QUEST_ONE_COPY.act5
      : isActFour
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
  const currentWallet = wallet.walletAddress?.toLowerCase() ?? "";
  const visibleProfile = wallet.authenticated && profileWallet === currentWallet ? profile : null;

  useEffect(() => {
    if (!wallet.authenticated || !currentWallet) return;
    const controller = new AbortController();
    void getCultivationProfile(controller.signal).then((nextProfile) => {
      setProfile(nextProfile);
      setProfileWallet(currentWallet);
    }).catch(() => undefined);
    return () => controller.abort();
  }, [currentWallet, wallet.authenticated]);

  useEffect(() => {
    if (experienceStage !== "battle" || hydratedOnce.current) return;
    hydratedOnce.current = true;
    dispatch({ type: "HYDRATE", payload: loadBattleData() });
  }, [experienceStage]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setSystemReduced(mediaQuery.matches);
    syncPreference();
    mediaQuery.addEventListener("change", syncPreference);
    return () => mediaQuery.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    if (
      experienceStage === "battle" &&
      state.hydrated &&
      state.phase === "ENTRY"
    ) {
      dispatch({ type: "ENTER_QUEST" });
    }
  }, [experienceStage, state.hydrated, state.phase]);

  useEffect(() => {
    if (experienceStage !== "battle" || !state.hydrated) return;
    persistBattleState(state);
  }, [experienceStage, state]);

  useEffect(() => {
    if (experienceStage !== "battle" || !state.hydrated) return;
    saveMotionMode(state.motionMode);
  }, [experienceStage, state.hydrated, state.motionMode]);

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
    const feedbackElement = repairFeedbackRef.current;
    if (
      !state.repairFeedback ||
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
  }, [reducedMotion, state.repairFeedback]);

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
    } else if (state.phase === "ACT5_SEALING") {
      dispatch({ type: "SEAL_ANIMATION_FINISHED" });
    } else if (state.phase === "ACT6_REWARDING") {
      dispatch({ type: "REWARD_SEQUENCE_FINISHED" });
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

  function handleSealAnimationEnd(event: AnimationEvent<HTMLElement>) {
    if (
      event.target === event.currentTarget &&
      state.phase === "ACT5_SEALING"
    ) {
      dispatch({ type: "SEAL_ANIMATION_FINISHED" });
    }
  }

  function handleRewardAnimationEnd(event: AnimationEvent<HTMLElement>) {
    if (
      event.target === event.currentTarget &&
      state.phase === "ACT6_REWARDING"
    ) {
      dispatch({ type: "REWARD_SEQUENCE_FINISHED" });
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
    setSettlement(null);
    setSettlementStatus("idle");
    setSettlementError(null);
    dispatch({ type: "RESET_QUEST" });
  }

  async function handleSettlement(): Promise<void> {
    if (state.phase !== "ACT5_COMPLETE" || settlementInFlight.current) return;
    if (!wallet.authenticated) {
      setSettlementStatus("error");
      setSettlementError("请先完成钱包签名入世，再结算修炼所得。");
      return;
    }
    settlementInFlight.current = true;
    setSettlementStatus("submitting");
    setSettlementError(null);
    try {
      const result = await completeQuestOne({
        schemaVersion: QUEST_ONE_COMPLETION_EVIDENCE_SCHEMA_VERSION,
        selectedCodeLineId: state.selectedCodeLineId ?? "",
        classification: {
          vulnerability: state.classificationAnswers.vulnerability ?? "",
          element: state.classificationAnswers.element ?? "",
          risk: state.classificationAnswers.risk ?? "",
        },
        viewedReplaySteps: [...state.viewedReplaySteps],
        repairOrder: [...state.repairOrder],
      });
      setSettlement(result);
      setProfile(result.profile);
      setProfileWallet(currentWallet);
      setSettlementStatus("idle");
      dispatch({ type: "START_REWARD_SEQUENCE" });
    } catch (error) {
      setSettlementStatus("error");
      setSettlementError(cultivationApiErrorMessage(error));
    } finally {
      settlementInFlight.current = false;
    }
  }

  if (experienceStage === "entry") {
    return (
      <QuestEntryPage
        authenticated={wallet.authenticated}
        onStartQuest={() => setExperienceStage("battle")}
        profile={visibleProfile}
      />
    );
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
    "--hp-transition-duration": `${QUEST_ONE_SEAL_TIMING.hpTransition}ms`,
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

  const stageTitle = isActSix
    ? "战利品与升级"
    : isActFive
      ? "布阵封印"
      : isActFour
        ? "回环噬灵"
        : isActThree
          ? "识破妖法"
          : isActTwo
            ? "锁定重入窗口"
            : "噬灵回环兽现身";
  const guidanceIcon: QuestOneIconName = isActSix
    ? "badge"
    : isActFive
      ? "seal"
      : isActFour
        ? "reentry-loop"
        : isActThree
          ? "target"
          : isActTwo
            ? "sword"
            : "boss";
  const sceneAct = isActSix
    ? "act6"
    : isActFive
      ? "act5"
      : isActFour
        ? "act4"
        : isActThree
          ? "act3"
          : isActTwo
            ? "act2"
            : "act1";
  const formalBackgroundAct: QuestOneBackgroundAct = sceneAct;

  return (
    <main
      className={styles.battlePage}
      data-act={sceneAct}
      data-reduced-motion={reducedMotion ? "true" : "false"}
    >
      <div className={styles.contentLayer}>
        <header className={styles.battleHud}>
        <Link className={styles.backLink} href="/quests">
          返回山门
        </Link>

        <div className={styles.bossIdentity}>
          <span className={styles.hudBeastMedallion} aria-hidden="true">
            <Image
              alt=""
              height={96}
              src="/assets/quest-1/beast/reentry-devourer-bestiary-portrait-v1.webp"
              width={96}
            />
          </span>
          <div>
            <span>
              Quest {QUEST_ONE.id} · {QUEST_ONE.realm} · {QUEST_ONE.element}系
            </span>
            <strong>{QUEST_ONE.name}</strong>
            <div className={styles.hudMedallions} aria-label="关卡属性">
              <span><QuestOneIcon name="realm-jindan" aria-hidden="true" />{QUEST_ONE.realm}</span>
              <span><QuestOneIcon name="water-drop" aria-hidden="true" />水</span>
              <span data-risk="high"><QuestOneIcon name="risk-high" aria-hidden="true" />High</span>
            </div>
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
          <div className={styles.cultivatorHud}>
            <span>当前修为</span>
            <strong>{cultivationRealmLabel(visibleProfile?.progression.realm ?? "Qi Refining")}</strong>
            <small>{visibleProfile?.totalExp ?? 0} / {visibleProfile?.progression.nextRealmExp ?? 1000} EXP</small>
          </div>
          <label>
            <span>动态效果</span>
            <select
              aria-label="动态效果"
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
          {!isActSix ? (
            <button className={styles.textButton} onClick={handleReset}>
              重置修炼
            </button>
          ) : null}
        </div>
        </header>

        <section
          className={styles.battleStage}
          data-act={sceneAct}
          data-formal-background="true"
          aria-labelledby="stage-title"
        >
          <QuestOneSceneBackground act={formalBackgroundAct} />
          <div className={styles.stageDecorations} aria-hidden="true" />
          <div className={styles.stageContent}>
            <QuestOneActHeading eyebrow={copy.eyebrow} title={stageTitle} />
            <div className={styles.stageHeadingLegacy}>
              <p className={styles.eyebrow}>{copy.eyebrow}</p>
              <h1 id="stage-title-legacy">
                {isActSix
                  ? "战利品与升级"
                  : isActFive
                  ? "布阵封印"
                  : isActFour
                  ? "回环噬灵"
                  : isActThree
                    ? "识破妖法"
                  : isActTwo
                    ? "锁定重入窗口"
                    : "噬灵回环兽现身"}
              </h1>
            </div>

            {isActSix ? (
          <RewardSequence
            complete={state.phase !== "ACT6_REWARDING"}
            onAnimationEnd={handleRewardAnimationEnd}
            reducedMotion={reducedMotion}
            showChainStatus={state.phase === "ACT6_COMPLETE"}
            settlement={settlement}
          />
        ) : isActFive ? (
          state.phase === "ACT5_REPAIR" ? (
            <RepairOrderPuzzle
              disabled={state.transitionLocked}
              feedback={state.repairFeedback}
              onMove={(blockId, direction) =>
                dispatch({
                  type: "MOVE_REPAIR_BLOCK",
                  blockId,
                  direction,
                })
              }
              onReset={() => dispatch({ type: "RESET_REPAIR_ORDER" })}
              order={state.repairOrder}
              statusRef={repairFeedbackRef}
            />
          ) : (
            <SealFormationResult
              complete={state.phase === "ACT5_COMPLETE"}
              onAnimationEnd={handleSealAnimationEnd}
              reducedMotion={reducedMotion}
            />
          )
        ) : isActFour ? (
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
            <WaterFormationSigil active={state.phase === "ACT3_FORMATION"} />
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
              <DormantBeastLoop
                compact
                motion="static"
                reducedMotion={reducedMotion}
                visualState="dormant"
              />
            </div>
          </div>
        ) : (
          <div
            className={`${styles.beastScene} ${stageAnimationClass}`}
            onAnimationEnd={handleStageAnimationEnd}
          >
            <DormantBeastLoop
              motion="awakening"
              reducedMotion={reducedMotion}
              visualState="dormant"
            />
          </div>
            )}
          </div>
        </section>

        <section
        className={`${styles.commandBar} ${styles.mentorGuidancePanel}`}
        data-final-actions={isActSix ? "true" : "false"}
        aria-label="当前战斗指令"
      >
        <div className={styles.mentorPortrait}>
          <Image
            aria-hidden="true"
            alt=""
            height={256}
            src="/assets/quest-1/ui/reference-skin/mentor-portrait.webp"
            width={256}
          />
        </div>
        <p className={styles.dialogue}>
          <span>守阵长老</span>
          {copy.dialogue}
        </p>
        <div className={styles.objective}>
          <QuestOneIcon className={styles.objectiveIcon} name={guidanceIcon} aria-hidden="true" />
          <span>当前目标</span>
          <strong>{copy.target}</strong>
          <small>{copy.hint}</small>
        </div>
        {isActSix ? (
          <div className={styles.completionActions}>
            <button
              className={styles.primaryButton}
              disabled={
                state.phase === "ACT6_REWARDING" ||
                state.phase === "BESTIARY_OPEN"
              }
              onClick={() => dispatch({ type: "OPEN_BESTIARY" })}
              type="button"
            >
              {state.phase === "ACT6_REWARDING"
                ? "正在结算"
                : "查看异兽志"}
            </button>
            <button
              className={styles.secondaryButton}
              disabled={
                state.phase === "ACT6_REWARDING" ||
                state.phase === "BESTIARY_OPEN"
              }
              onClick={handleReset}
              type="button"
            >
              重新修炼
            </button>
          </div>
        ) : isActFive ? (
          <div className={styles.settlementAction}>
            <button
              className={styles.primaryButton}
              disabled={state.transitionLocked || settlementStatus === "submitting"}
              onClick={() => {
                if (state.phase === "ACT5_COMPLETE") void handleSettlement();
                else dispatch({ type: "SUBMIT_REPAIR" });
              }}
            >
              {settlementStatus === "submitting"
                ? "正在结算修炼所得…"
                : state.phase === "ACT5_SEALING"
                  ? "封印闭合中"
                  : state.phase === "ACT5_COMPLETE"
                    ? QUEST_ONE_COPY.act6.action
                    : copy.action}
            </button>
            {settlementError ? (
              <p className={styles.settlementError} role="alert" aria-live="assertive">
                {settlementError}
              </p>
            ) : null}
          </div>
        ) : isActFour ? (
          <button
            className={styles.primaryButton}
            disabled={
              state.transitionLocked ||
              (state.phase === "ACT4_REPLAY" && !replayFullyViewed)
            }
            onClick={() => {
              if (state.phase === "ACT4_COMPLETE") {
                dispatch({ type: "ENTER_REPAIR_STAGE" });
              } else {
                handleReplayEvent({ type: "CONFIRM_ATTACK_REPLAY" });
              }
            }}
          >
            {state.phase === "ACT4_COMPLETE" ? "布阵封印" : copy.action}
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

        {state.phase === "BESTIARY_OPEN" ? (
          <BestiaryEntryDialog
            onClose={() => dispatch({ type: "CLOSE_BESTIARY" })}
          />
        ) : null}

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {liveMessage}
        </p>
      </div>
    </main>
  );
}
