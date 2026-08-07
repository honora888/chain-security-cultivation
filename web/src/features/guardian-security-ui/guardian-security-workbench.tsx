"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import type { SignedGuardianDraftV1 } from "@/features/guardian-draft/contracts";
import { guardianDraftInputChanged } from "@/features/guardian-draft/client";
import type { GuardianHybridPublicResponse } from "@/features/guardian-llm/hybrid-analysis-types";
import {
  ContributorApiError,
  createContribution,
  type ContributionSummary,
} from "@/features/contributor-ui/contributor-api-client";
import { useWalletAuth } from "@/features/wallet-auth/wallet-auth-provider";
import { WalletIdentityControl } from "@/features/wallet-auth/wallet-identity-controls";

import {
  analyzeGuardianSample,
  GuardianSecurityApiError,
  isGuardianSampleSuccess,
  type GuardianSampleSubmission,
} from "./guardian-security-api-client";
import {
  ERROR_COPY,
  MAX_CASE_NAME_LENGTH,
  MAX_SOURCE_LENGTH,
  MAX_TOTAL_SOURCE_LENGTH,
} from "./guardian-security-copy";
import { GuardianSecurityResults } from "./guardian-security-results";
import { GuardianCandidateResults } from "./guardian-candidate-results";
import styles from "./guardian-security-ui.module.css";

type WorkbenchStatus = "idle" | "submitting" | "success" | "saving" | "saved" | "error";
type FieldName = keyof GuardianSampleSubmission;
type FieldErrors = Partial<Record<FieldName | "form", string>>;
type FlowStepState = "pending" | "current" | "complete" | "review" | "error";

const EMPTY_FORM: GuardianSampleSubmission = {
  name: "",
  vulnerableSource: "",
  attackSource: "",
  fixedSource: "",
};

const SOURCE_FIELDS: readonly {
  name: Exclude<FieldName, "name">;
  label: string;
  volume: string;
  codeLabel: string;
  required: boolean;
  hint: string;
  rows: number;
}[] = [
  {
    name: "vulnerableSource",
    label: "漏洞合约源码",
    volume: "卷宗乙 · 漏洞本体",
    codeLabel: "Solidity · Vulnerable source",
    required: true,
    hint: "提交你希望分析的候选漏洞合约源码文本。",
    rows: 16,
  },
  {
    name: "attackSource",
    label: "攻击样例源码",
    volume: "卷宗丙 · 攻击轨迹",
    codeLabel: "Solidity · Attack sample",
    required: false,
    hint: "可选。包含 receive / fallback 与重入调用的攻击结构有助于提高证据完整度。",
    rows: 12,
  },
  {
    name: "fixedSource",
    label: "修复合约源码",
    volume: "卷宗丁 · 修复对照",
    codeLabel: "Solidity · Fixed contrast",
    required: false,
    hint: "可选。提供状态更新先于外部调用的修复对照。",
    rows: 12,
  },
];

const FLOW_STEPS = [
  "提交卷宗",
  "规则鉴定",
  "五行定性",
  "异兽成册",
  "人工审核",
] as const;

const REVIEW_FACTORS = [
  "证据完整性",
  "攻击可复现性",
  "修复质量",
  "教育价值",
  "案例新颖性",
] as const;

function flowStepState(
  step: number,
  status: WorkbenchStatus,
  hasValidationErrors: boolean,
  hasDraft: boolean,
): FlowStepState {
  if (status === "success") return step <= 4 ? "complete" : "review";
  if (status === "saving") return step <= 4 ? "complete" : "current";
  if (status === "saved") return step <= 4 ? "complete" : "review";
  if (status === "submitting") return step === 1 ? "complete" : step === 2 ? "current" : "pending";
  if (status === "error") {
    const errorStep = hasDraft ? 5 : hasValidationErrors ? 1 : 2;
    return step === errorStep ? "error" : step < errorStep ? "complete" : "pending";
  }
  return step === 1 ? "current" : "pending";
}

function flowStepLabel(state: FlowStepState): string {
  if (state === "complete") return "已完成";
  if (state === "current") return "当前步骤";
  if (state === "review") return "待人工审核";
  if (state === "error") return "需要处理";
  return "待进行";
}

function validateForm(form: GuardianSampleSubmission): FieldErrors {
  const errors: FieldErrors = {};
  const trimmedName = form.name.trim();
  if (trimmedName.length === 0) {
    errors.name = "请输入案例名称。";
  } else if (trimmedName.length > MAX_CASE_NAME_LENGTH) {
    errors.name = `案例名称不得超过 ${MAX_CASE_NAME_LENGTH} 字符。`;
  }
  if (form.vulnerableSource.trim().length === 0) {
    errors.vulnerableSource = "请提交漏洞合约源码文本。";
  }
  for (const field of SOURCE_FIELDS) {
    if (form[field.name].length > MAX_SOURCE_LENGTH) {
      errors[field.name] = `${field.label}不得超过 ${MAX_SOURCE_LENGTH.toLocaleString("zh-CN")} 字符。`;
    }
  }
  const totalLength = SOURCE_FIELDS.reduce(
    (total, field) => total + form[field.name].length,
    0,
  );
  if (totalLength > MAX_TOTAL_SOURCE_LENGTH) {
    errors.form = `源码总长度不得超过 ${MAX_TOTAL_SOURCE_LENGTH.toLocaleString("zh-CN")} 字符。`;
  }
  return errors;
}

function messageForError(error: unknown): string {
  if (error instanceof GuardianSecurityApiError) {
    if (error.code === "UNEXPECTED_MOSS_EVIDENCE") {
      return "当前样例返回了不符合贡献流程的链上证据状态，请稍后重试。";
    }
    if (error.code === "INVALID_RESPONSE") {
      return "服务返回了无法验证的响应，请稍后重试。";
    }
    if (error.code === "DRAFT_SIGNING_NOT_CONFIGURED") {
      return "Guardian 签名草案服务尚未配置，请稍后重试。";
    }
    if (error.code === "DRAFT_SIGNING_FAILED") {
      return "Guardian 签名草案暂时无法生成，请稍后重试。";
    }
    return ERROR_COPY[error.code];
  }
  return ERROR_COPY.INTERNAL_ERROR;
}

export function GuardianSecurityWorkbench() {
  const wallet = useWalletAuth();
  const [form, setForm] = useState<GuardianSampleSubmission>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<WorkbenchStatus>("idle");
  const [statusMessage, setStatusMessage] = useState(
    "准备提交新的安全案例。",
  );
  const [result, setResult] = useState<GuardianHybridPublicResponse | null>(null);
  const [analysisDigest, setAnalysisDigest] = useState<string | null>(null);
  const [signedDraft, setSignedDraft] = useState<SignedGuardianDraftV1 | null>(null);
  const [createdCase, setCreatedCase] = useState<ContributionSummary | null>(null);

  const totalSourceLength = SOURCE_FIELDS.reduce(
    (total, field) => total + form[field.name].length,
    0,
  );
  const isSubmitting = status === "submitting";
  const isBusy = status === "submitting" || status === "saving";
  const hasValidationErrors = Object.values(fieldErrors).some(Boolean);

  function updateField(field: FieldName, value: string): void {
    const nextForm = { ...form, [field]: value };
    setForm(nextForm);
    setFieldErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
    if (result !== null && guardianDraftInputChanged(form, nextForm)) {
      setResult(null);
      setAnalysisDigest(null);
      setSignedDraft(null);
      setCreatedCase(null);
      setStatus("idle");
      setStatusMessage("卷宗内容已改变，请重新进行 Guardian 鉴定。");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) return;

    const nextErrors = validateForm(form);
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setStatus("error");
      setStatusMessage("提交内容尚未通过检查，请修正标记字段。");
      return;
    }

    setFieldErrors({});
    setStatus("submitting");
    setStatusMessage("正在分析受限源码文本并生成安全案例草案……");
    try {
      const analyzed = await analyzeGuardianSample(form);
      setResult(analyzed.result);
      setAnalysisDigest(analyzed.digest);
      setSignedDraft(analyzed.signedDraft);
      setStatus("success");
      setStatusMessage("Guardian 鉴定完成，请核对异兽志草案后确认提交守阁人审核。");
    } catch (error) {
      setStatus("error");
      setStatusMessage(messageForError(error));
    }
  }

  function clearForm(): void {
    if (isBusy) return;
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setResult(null);
    setAnalysisDigest(null);
    setSignedDraft(null);
    setCreatedCase(null);
    setStatus("idle");
    setStatusMessage("准备提交新的安全案例。");
  }

  async function confirmContribution(): Promise<void> {
    if (
      !result ||
      !isGuardianSampleSuccess(result) ||
      !analysisDigest ||
      isBusy ||
      createdCase
    ) return;
    if (!wallet.authenticated) {
      setStatusMessage("请先连接钱包并签名入世，再确认提交守阁人审核。");
      return;
    }
    setStatus("saving");
    setStatusMessage("正在确认献策并提交守阁人审核……");
    try {
      const created = await createContribution({
        caseName: form.name.trim(),
        vulnerableSource: form.vulnerableSource,
        attackSource: form.attackSource,
        fixedSource: form.fixedSource,
      }, analysisDigest);
      if (!isGuardianSampleSuccess(created.analysis)) {
        throw new ContributorApiError("INVALID_RESPONSE", "服务返回了无法验证的 Guardian 鉴定结果。", 200);
      }
      setResult(created.analysis);
      setSignedDraft(null);
      setCreatedCase(created.summary);
      setStatus("saved");
      setStatusMessage("异兽献策已进入守阁人审核，当前状态为待审核。");
    } catch (error) {
      setStatus("error");
      setStatusMessage(error instanceof ContributorApiError
        ? error.message
        : "献策未能提交，请稍后重试。");
    }
  }

  return (
    <div className={styles.workbenchPage}>
      <header className={styles.siteHeader}>
        <Link className={styles.brand} href="/" aria-label="返回链安修仙录首页">
          <span className={styles.brandSeal} aria-hidden="true">链安</span>
          <span className={styles.brandCopy}>
            <strong>链安修仙录</strong>
            <small>安全贡献路径</small>
          </span>
        </Link>
        <nav className={styles.topNav} aria-label="主要导航">
          <Link href="/quests">秘境修炼</Link>
          <Link href="/bestiary">异兽志</Link>
          <Link href="/contribute">异兽献策</Link>
          <Link href="/profile">我的修仙档案</Link>
        </nav>
        <WalletIdentityControl />
      </header>

      <main className={styles.workbenchMain}>
        <section className={styles.workbenchHero} aria-labelledby="workbench-title">
          <div>
            <p className={styles.kicker}>Guardian Security Agent</p>
            <h1 id="workbench-title">异兽献策</h1>
            <p>
              提交漏洞代码、攻击样例与可选修复对照。系统将进行受限的确定性模式分析，并生成待人工审核的异兽志与 Quest 草案。
            </p>
          </div>
          <ul className={styles.statusTags} aria-label="分析边界">
            <li>Deterministic Rules</li>
            <li>No External Model</li>
            <li>Source Text Only</li>
            <li>Human Review Required</li>
          </ul>
        </section>

        <section className={styles.submissionSection} aria-labelledby="submission-title">
          <div className={styles.submissionIntro}>
            <p className={styles.sectionIndex}>Submission dossier · Sample only</p>
            <h2 id="submission-title">异兽献策</h2>
            <p>
              当前公开工作台只接受新的用户样例，不提供内置案例选择，也不会自动触发链上注册。
            </p>
            <ol className={styles.processRail} aria-label="异兽献策流程">
              {FLOW_STEPS.map((label, index) => {
                const step = index + 1;
                const stepState = flowStepState(
                  step,
                  status,
                  hasValidationErrors,
                  result !== null,
                );
                return (
                  <li
                    key={label}
                    data-state={stepState}
                    aria-current={stepState === "current" || stepState === "error" ? "step" : undefined}
                  >
                    <span>{String(step).padStart(2, "0")}</span>
                    <div>
                      <strong>{label}</strong>
                      <small>{flowStepLabel(stepState)}</small>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <form
            className={styles.sourceForm}
            onSubmit={handleSubmit}
            aria-busy={isBusy}
            noValidate
          >
            <section className={`${styles.nameField} ${styles.dossierSection}`}>
              <p className={styles.volumeLabel}>卷宗甲 · 案例身份</p>
              <div className={styles.fieldHeading}>
                <label htmlFor="guardian-case-name">案例名称</label>
                <span>{form.name.length} / {MAX_CASE_NAME_LENGTH}</span>
              </div>
              <input
                id="guardian-case-name"
                name="name"
                type="text"
                value={form.name}
                maxLength={MAX_CASE_NAME_LENGTH}
                required
                autoComplete="off"
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby="guardian-case-name-hint guardian-case-name-error"
                onChange={(event) => updateField("name", event.target.value)}
              />
              <p id="guardian-case-name-hint" className={styles.fieldHint}>
                使用便于审核者辨识的案例名称，不包含仓库路径或网址。
              </p>
              <p id="guardian-case-name-error" className={styles.fieldError}>
                {fieldErrors.name ?? ""}
              </p>
            </section>

            <div className={styles.sourceGrid}>
              {SOURCE_FIELDS.map((field) => {
                const hintId = `${field.name}-hint`;
                const errorId = `${field.name}-error`;
                return (
                  <section className={`${styles.sourceField} ${styles.dossierSection}`} key={field.name}>
                    <p className={styles.volumeLabel}>{field.volume}</p>
                    <div className={styles.fieldHeading}>
                      <label htmlFor={field.name}>
                        {field.label}
                        {field.required ? <span>必填</span> : <small>可选</small>}
                      </label>
                      <span>
                        {form[field.name].length.toLocaleString("zh-CN")} / {MAX_SOURCE_LENGTH.toLocaleString("zh-CN")}
                      </span>
                    </div>
                    <span className={styles.codeLanguage} aria-hidden="true">
                      {field.codeLabel}
                    </span>
                    <textarea
                      id={field.name}
                      name={field.name}
                      value={form[field.name]}
                      maxLength={MAX_SOURCE_LENGTH}
                      rows={field.rows}
                      required={field.required}
                      spellCheck={false}
                      aria-invalid={Boolean(fieldErrors[field.name])}
                      aria-describedby={`${hintId} ${errorId}`}
                      onChange={(event) => updateField(field.name, event.target.value)}
                    />
                    <p id={hintId} className={styles.fieldHint}>{field.hint}</p>
                    <p id={errorId} className={styles.fieldError}>
                      {fieldErrors[field.name] ?? ""}
                    </p>
                  </section>
                );
              })}
            </div>

            <aside className={styles.reviewCriteria} aria-labelledby="review-criteria-title">
              <div>
                <p className={styles.sectionIndex}>Editorial criteria</p>
                <h3 id="review-criteria-title">收录评估</h3>
                <p>
                  审核者将依据以下维度决定是否收录；审核通过后才结算贡献值。
                </p>
              </div>
              <ul>
                {REVIEW_FACTORS.map((factor) => <li key={factor}>{factor}</li>)}
              </ul>
            </aside>

            <div className={styles.sealBar}>
              <p className={styles.sealLabel}>卷宗封口 · Submission seal</p>
              <div className={styles.formFooter}>
                <div>
                  <strong>
                    源码总计 {totalSourceLength.toLocaleString("zh-CN")} / {MAX_TOTAL_SOURCE_LENGTH.toLocaleString("zh-CN")}
                  </strong>
                  <p>
                    本工具只分析受限的源码文本模式，不会编译或执行提交的合约。
                  </p>
                  <p className={styles.fieldError}>{fieldErrors.form ?? ""}</p>
                </div>
                <div className={styles.formActions}>
                  <button
                    className={styles.clearButton}
                    type="button"
                    disabled={isBusy}
                    onClick={clearForm}
                  >
                    清空卷宗
                  </button>
                  <button
                    className={styles.submitButton}
                    type="submit"
                    disabled={isBusy}
                  >
                    {isSubmitting ? "正在 Guardian 鉴兽" : "开始 Guardian 鉴兽"}
                  </button>
                </div>
              </div>

              <p
                className={styles.formStatus}
                data-status={status}
                aria-live="polite"
                role="status"
              >
                <strong>{status === "success" ? "完成" : status === "error" ? "提示" : "状态"}</strong>
                <span>{statusMessage}</span>
              </p>
            </div>
          </form>
        </section>

        {isSubmitting ? <section className={styles.guardianProgress} aria-live="polite">
          <h2>Guardian 鉴兽</h2>
          <ul>
            <li>正在鉴定漏洞类型</li>
            <li>正在推演攻击路径</li>
            <li>正在检查修复</li>
            <li>正在生成异兽志草案</li>
          </ul>
        </section> : null}

        {result ? (
          <p className={styles.formStatus} role="status" aria-live="polite">
            <strong>Guardian 草案状态</strong>
            <span>
              {signedDraft
                ? "Guardian 签名草案已生成；当前显示内容与签名内容一致。"
                : "连接钱包并完成签名入世后，可在重新鉴定时生成与身份绑定的 Guardian 签名草案。"}
            </span>
          </p>
        ) : null}

        {result?.schemaVersion === "guardian-security-candidate-analysis-v1" ? (
          <GuardianCandidateResults
            result={result}
            selectedBestiaryName={
              signedDraft?.claims.draft.selectedBestiaryName ??
              result.llmEnhancement.bestiaryNameCandidates[0]
            }
          />
        ) : result ? (
          <GuardianSecurityResults
            result={result}
            reviewState={createdCase ? "pending_review" : "draft"}
          />
        ) : null}

        {result?.schemaVersion === "guardian-security-analysis-v1" ? <section className={styles.confirmContribution} aria-labelledby="confirm-contribution-title">
          <div>
            <p className={styles.sectionIndex}>Keeper review gate</p>
            <h2 id="confirm-contribution-title">提交守阁人审核</h2>
            <p>{createdCase
              ? `献策 ${createdCase.caseId} 已保存为待审核状态。`
              : "请确认上方 Guardian 鉴定与异兽志草案。提交后进入人工审核，审核收录后才结算 Merit。"}</p>
          </div>
          {!wallet.authenticated ? <p className={styles.confirmNotice}>确认献策属于个人操作，请先使用全局钱包入口完成签名入世。</p> : null}
          <button
            className={styles.submitButton}
            type="button"
            disabled={isBusy || Boolean(createdCase) || !wallet.authenticated}
            onClick={() => void confirmContribution()}
          >
            {status === "saving" ? "正在提交审核" : createdCase ? "已进入待审核" : "确认献策 · 提交人工审核"}
          </button>
        </section> : null}

        {result?.schemaVersion === "guardian-security-candidate-analysis-v1" ? (
          <section className={styles.confirmContribution} aria-labelledby="candidate-stage-title">
            <div>
              <p className={styles.sectionIndex}>Stage 34.3 · Signed carriage only</p>
              <h2 id="candidate-stage-title">候选草案尚未接入提交</h2>
              <p>
                当前仅生成并保留待人工审核的候选草案。数据库提交、审核批准与发布能力将在后续阶段接入。
              </p>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
