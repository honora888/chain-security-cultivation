"use client";

import type { RefObject } from "react";

import {
  QUEST_ONE_CLASSIFICATION_GROUPS,
} from "@/data/quest-1";
import type {
  ClassificationAnswers,
  ClassificationFeedback,
  ClassificationField,
  ClassificationResults,
  ElementAnswer,
  RiskAnswer,
  VulnerabilityAnswer,
} from "@/features/quest-1/battle-types";

import styles from "./quest-1.module.css";

interface ClassificationPuzzleProps {
  answers: ClassificationAnswers;
  results: ClassificationResults;
  feedback: ClassificationFeedback;
  complete: boolean;
  disabled: boolean;
  statusRef: RefObject<HTMLDivElement | null>;
  onChange: (
    field: ClassificationField,
    value: VulnerabilityAnswer | ElementAnswer | RiskAnswer,
  ) => void;
}

function getOverallFeedback(feedback: ClassificationFeedback): string {
  switch (feedback) {
    case "incomplete":
      return "需要完成全部判断。请选择漏洞类型、五行属性和风险等级。";
    case "incorrect":
      return "阵纹未合，再核对三项判断。";
    case "correct":
      return "妖法已识破：经典重入漏洞、水、High。";
    default:
      return "";
  }
}

export function ClassificationPuzzle({
  answers,
  results,
  feedback,
  complete,
  disabled,
  statusRef,
  onChange,
}: ClassificationPuzzleProps) {
  const overallFeedback = getOverallFeedback(feedback);

  return (
    <div className={styles.classificationPuzzle}>
      {complete ? (
        <section
          className={styles.classificationConclusion}
          aria-labelledby="classification-conclusion-title"
        >
          <span>水阵稳定</span>
          <h2 id="classification-conclusion-title">妖法已识破</h2>
          <dl>
            <div>
              <dt>漏洞类型</dt>
              <dd>经典重入漏洞</dd>
            </div>
            <div>
              <dt>五行属性</dt>
              <dd>水</dd>
            </div>
            <div>
              <dt>风险等级</dt>
              <dd>High</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <div className={styles.classificationGroups}>
        {QUEST_ONE_CLASSIFICATION_GROUPS.map((group) => {
          const result = results[group.field];
          const resultId = `classification-${group.field}-result`;

          return (
            <fieldset
              className={styles.classificationGroup}
              data-result={
                result === null ? "idle" : result ? "correct" : "incorrect"
              }
              disabled={disabled}
              key={group.field}
              aria-describedby={result === null ? undefined : resultId}
            >
              <legend>{group.legend}</legend>
              <div className={styles.classificationOptions}>
                {group.options.map((option) => {
                  const inputId = `classification-${group.field}-${option.value}`;
                  return (
                    <label className={styles.classificationOption} key={option.value}>
                      <input
                        checked={answers[group.field] === option.value}
                        id={inputId}
                        name={`classification-${group.field}`}
                        onChange={() =>
                          onChange(
                            group.field,
                            option.value as
                              | VulnerabilityAnswer
                              | ElementAnswer
                              | RiskAnswer,
                          )
                        }
                        type="radio"
                        value={option.value}
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>

              {result !== null ? (
                <p
                  className={`${styles.classificationItemResult} ${
                    result
                      ? styles.classificationItemCorrect
                      : styles.classificationItemIncorrect
                  }`}
                  id={resultId}
                >
                  <span
                    className={styles.classificationResultMark}
                    aria-hidden="true"
                  />
                  <span>
                    <strong>{result ? "正确" : "错误"}</strong>
                    {result
                      ? `${group.correctLabel}。${group.explanation}`
                      : `正确答案：${group.correctLabel}。${group.explanation}`}
                  </span>
                </p>
              ) : null}
            </fieldset>
          );
        })}
      </div>

      <div
        className={styles.classificationStatus}
        data-feedback={feedback ?? "idle"}
        ref={statusRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {overallFeedback ? <p>{overallFeedback}</p> : null}
      </div>
    </div>
  );
}
