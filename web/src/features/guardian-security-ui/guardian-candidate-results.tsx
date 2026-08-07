import type { GuardianCandidateOnlyAnalysisSuccess } from "@/features/guardian-llm/hybrid-analysis-types";

import styles from "./guardian-security-ui.module.css";

function TextList({ items }: { items: readonly string[] }) {
  return (
    <ul className={styles.textList}>
      {items.map((item, index) => (
        <li key={`${index}-${item}`}>{item}</li>
      ))}
    </ul>
  );
}

export function GuardianCandidateResults({
  result,
  selectedBestiaryName,
}: {
  readonly result: GuardianCandidateOnlyAnalysisSuccess;
  readonly selectedBestiaryName: string;
}) {
  const alternatives = result.llmEnhancement.bestiaryNameCandidates.filter(
    (name) => name !== selectedBestiaryName,
  );

  return (
    <section className={styles.results} aria-labelledby="candidate-results-title">
      <header className={styles.resultsHeader}>
        <div>
          <p className={styles.sectionIndex}>LLM Candidate · Human Review Gate</p>
          <h2 id="candidate-results-title">待核验安全候选</h2>
        </div>
        <span className={styles.draftStamp}>未经确定性验证</span>
      </header>

      <section className={styles.conclusionCard} aria-labelledby="candidate-name-title">
        <div className={styles.conclusionIdentity}>
          <p>Signed draft naming</p>
          <h3 id="candidate-name-title">异兽志候选名称</h3>
          <strong>{selectedBestiaryName}</strong>
          <span>LLM Candidate · Human Review Required</span>
        </div>
        <div>
          <p>{result.llmEnhancement.publicSummary}</p>
          {alternatives.length > 0 ? (
            <p>
              其他只读候选：{alternatives.join(" · ")}
            </p>
          ) : null}
        </div>
      </section>

      {result.llmEnhancement.candidateFindings.map((finding) => (
        <section
          className={styles.resultPanel}
          key={finding.candidateId}
          aria-labelledby={`${finding.candidateId}-title`}
        >
          <div className={styles.panelTitleRow}>
            <span aria-hidden="true">候</span>
            <div>
              <p>{finding.category}</p>
              <h3 id={`${finding.candidateId}-title`}>{finding.title}</h3>
            </div>
          </div>
          <p className={styles.cautionNote}>
            此发现由外部模型提出，仅作为人工审核线索，不代表漏洞已经验证。
          </p>
          <dl className={styles.summaryFacts}>
            <div>
              <dt>验证状态</dt>
              <dd>LLM Candidate · 未验证</dd>
            </div>
            <div>
              <dt>LLM 建议严重度（非权威）</dt>
              <dd>{finding.suggestedSeverity}</dd>
            </div>
            <div>
              <dt>LLM 建议置信度（非权威）</dt>
              <dd>
                {finding.suggestedConfidence.label} · {finding.suggestedConfidence.score} / 100
              </dd>
            </div>
            <div className={styles.wideFact}>
              <dt>候选解释</dt>
              <dd>{finding.explanation}</dd>
            </div>
          </dl>
          <div className={styles.detailGrid}>
            <div>
              <h4>候选攻击路径</h4>
              <TextList items={finding.attackPath} />
            </div>
            <div>
              <h4>受影响代码线索</h4>
              <TextList
                items={finding.affectedCode.map(
                  (item) => `${item.source} · ${item.location} · ${item.explanation}`,
                )}
              />
            </div>
            <div>
              <h4>建议修复</h4>
              <TextList items={finding.suggestedFix} />
            </div>
            <div>
              <h4>已知局限</h4>
              <TextList items={finding.limitations} />
            </div>
          </div>
        </section>
      ))}

      <section className={styles.reviewPanel} aria-labelledby="candidate-review-title">
        <div>
          <p>Human Review Gate</p>
          <h3 id="candidate-review-title">待人工审核</h3>
        </div>
        <dl>
          <div><dt>确定性验证</dt><dd>否</dd></div>
          <div><dt>允许发布</dt><dd>否</dd></div>
          <div><dt>允许直接收录</dt><dd>否</dd></div>
        </dl>
        <TextList items={result.limitations} />
      </section>
    </section>
  );
}
