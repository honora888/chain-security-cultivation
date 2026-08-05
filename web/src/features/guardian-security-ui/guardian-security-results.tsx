import type {
  AnalysisStatement,
  GuardianSecuritySuccess,
  ReentrancySignal,
} from "@/features/guardian-security/analysis-types";

import {
  PROVENANCE_LABELS,
  SOURCE_LABELS,
  STRENGTH_LABELS,
} from "./guardian-security-copy";
import styles from "./guardian-security-ui.module.css";

interface GuardianSecurityResultsProps {
  result: GuardianSecuritySuccess;
}

function TextList({ items }: { items: readonly string[] }) {
  return (
    <ul className={styles.textList}>
      {items.map((item, index) => (
        <li key={`${index}-${item}`}>{item}</li>
      ))}
    </ul>
  );
}

function StatementList({ items }: { items: readonly AnalysisStatement[] }) {
  return (
    <ul className={styles.statementList}>
      {items.map((item, index) => (
        <li key={`${index}-${item.text}`}>
          <span>{PROVENANCE_LABELS[item.provenance]}</span>
          <p>{item.text}</p>
        </li>
      ))}
    </ul>
  );
}

function SignalItem({ signal }: { signal: ReentrancySignal }) {
  return (
    <li className={styles.signalItem} data-matched={signal.matched}>
      <div className={styles.signalHeading}>
        <strong>{signal.matched ? "已匹配" : "未匹配"}</strong>
        <code>{signal.id}</code>
      </div>
      <dl className={styles.compactFacts}>
        <div>
          <dt>强度</dt>
          <dd>{STRENGTH_LABELS[signal.strength]}</dd>
        </div>
        <div>
          <dt>来源</dt>
          <dd>{SOURCE_LABELS[signal.source]}</dd>
        </div>
        <div>
          <dt>证据类型</dt>
          <dd>{PROVENANCE_LABELS[signal.evidenceType]}</dd>
        </div>
      </dl>
      <p>{signal.explanation}</p>
    </li>
  );
}

export function GuardianSecurityResults({
  result,
}: GuardianSecurityResultsProps) {
  const matchedSignals = result.signals.filter((signal) => signal.matched);
  const { analysis, classification, severity, confidence } = result;
  const bestiary = result.bestiaryDraft;
  const quest = result.questDraft;

  return (
    <section className={styles.results} aria-labelledby="analysis-results-title">
      <header className={styles.resultsHeader}>
        <div>
          <p className={styles.sectionIndex}>Analysis dossier</p>
          <h2 id="analysis-results-title">安全案例草案</h2>
        </div>
        <span className={styles.draftStamp}>草案 / Draft</span>
      </header>

      <section className={styles.conclusionCard} aria-labelledby="conclusion-title">
        <div className={styles.conclusionIdentity}>
          <p>Guardian determination</p>
          <h3 id="conclusion-title">鉴定结论</h3>
          <strong>{bestiary.name}</strong>
          <span>{analysis.formalType}</span>
        </div>
        <dl className={styles.conclusionFacts}>
          <div>
            <dt>五行</dt>
            <dd>
              {classification.elements.primaryElementLabel} · {classification.elements.primaryElement}
              {classification.elements.secondaryElements.length > 0
                ? ` / ${classification.elements.secondaryElements.join(" · ")}`
                : ""}
            </dd>
          </div>
          <div><dt>Realm</dt><dd>{classification.realm.realmLabel}</dd></div>
          <div><dt>Severity</dt><dd>{severity.level} · {severity.score} / 12</dd></div>
          <div><dt>Confidence</dt><dd>{confidence.label} · {confidence.score} / 100</dd></div>
          <div><dt>审核状态</dt><dd>Draft · 待审核</dd></div>
        </dl>
        <span className={styles.conclusionSeal} aria-hidden="true">未审</span>
      </section>

      <section className={styles.resultPanel} aria-labelledby="analysis-summary-title">
        <div className={styles.panelTitleRow}>
          <span aria-hidden="true">壹</span>
          <div>
            <p>Formal analysis</p>
            <h3 id="analysis-summary-title">分析摘要</h3>
          </div>
        </div>
        <dl className={styles.summaryFacts}>
          <div>
            <dt>漏洞类型</dt>
            <dd>{analysis.formalType}</dd>
          </div>
          <div>
            <dt>类别</dt>
            <dd>{analysis.category}</dd>
          </div>
          <div className={styles.wideFact}>
            <dt>根因</dt>
            <dd>{analysis.rootCause}</dd>
          </div>
          <div>
            <dt>重复性</dt>
            <dd>{analysis.repeatability}</dd>
          </div>
          <div>
            <dt>权限要求</dt>
            <dd>{analysis.privilegeRequired}</dd>
          </div>
          <div className={styles.wideFact}>
            <dt>影响</dt>
            <dd>{analysis.impact}</dd>
          </div>
        </dl>
        <div className={styles.detailGrid}>
          <div>
            <h4>受影响函数</h4>
            <TextList items={analysis.affectedFunctions} />
          </div>
          <div>
            <h4>攻击前提</h4>
            <TextList items={analysis.prerequisites} />
          </div>
          <div>
            <h4>攻击路径</h4>
            <TextList items={analysis.attackPath} />
          </div>
          <div>
            <h4>修复建议</h4>
            <TextList items={analysis.mitigations} />
          </div>
        </div>
        <details className={styles.evidenceDetails}>
          <summary>查看证据、推断与已知局限</summary>
          <div className={styles.evidenceColumns}>
            <div>
              <h4>Evidence</h4>
              <StatementList items={analysis.evidence} />
            </div>
            <div>
              <h4>Inference</h4>
              <StatementList items={analysis.inferences} />
            </div>
            <div>
              <h4>Known limitations</h4>
              <StatementList items={analysis.limitations} />
            </div>
          </div>
        </details>
      </section>

      <section className={styles.resultPanel} aria-labelledby="signals-title">
        <div className={styles.panelTitleRow}>
          <span aria-hidden="true">贰</span>
          <div>
            <p>Deterministic signals</p>
            <h3 id="signals-title">规则信号</h3>
          </div>
        </div>
        <p className={styles.panelIntro}>
          优先展示已匹配信号。信号只说明文本模式命中，不代表源码已经执行或经过正式审计。
        </p>
        <ul className={styles.signalList}>
          {matchedSignals.map((signal) => (
            <SignalItem key={signal.id} signal={signal} />
          ))}
        </ul>
        <details className={styles.allSignals}>
          <summary>查看全部 {result.signals.length} 条信号</summary>
          <ul className={styles.signalList}>
            {result.signals.map((signal) => (
              <SignalItem key={signal.id} signal={signal} />
            ))}
          </ul>
        </details>
      </section>

      <div className={styles.assessmentGrid}>
        <section className={styles.resultPanel} aria-labelledby="element-title">
          <div className={styles.panelTitleRow}>
            <span aria-hidden="true">叁</span>
            <div>
              <p>Element classification</p>
              <h3 id="element-title">五行分类</h3>
            </div>
          </div>
          <p className={styles.primaryAssessment}>
            <span>主属性</span>
            <strong>
              {classification.elements.primaryElementLabel} · {classification.elements.primaryElement}
            </strong>
          </p>
          <p>
            次属性：
            {classification.elements.secondaryElements.length > 0
              ? classification.elements.secondaryElements.join(" · ")
              : "无"}
          </p>
          <dl className={styles.scoreGrid}>
            {Object.entries(classification.elements.elementScores).map(
              ([element, score]) => (
                <div key={element}>
                  <dt>{element}</dt>
                  <dd>{score}</dd>
                  <span
                    className={styles.elementMeter}
                    role="meter"
                    aria-label={`${element} 五行积分 ${score}`}
                    aria-valuemin={0}
                    aria-valuemax={12}
                    aria-valuenow={score}
                  >
                    <i style={{ width: `${Math.min(100, (score / 12) * 100)}%` }} />
                  </span>
                </div>
              ),
            )}
          </dl>
          <TextList items={classification.elements.rationale} />
        </section>

        <section className={styles.resultPanel} aria-labelledby="realm-title">
          <div className={styles.panelTitleRow}>
            <span aria-hidden="true">肆</span>
            <div>
              <p>Learning complexity</p>
              <h3 id="realm-title">Realm</h3>
            </div>
          </div>
          <p className={styles.primaryAssessment}>
            <span>学习境界</span>
            <strong>
              {classification.realm.realmLabel} · {classification.realm.realm}
            </strong>
          </p>
          <p className={styles.scoreLine}>复杂度积分 {classification.realm.realmScore}</p>
          <p className={styles.cautionNote}>
            Realm 表示学习复杂度，不等于资产风险等级。
          </p>
          <ul className={styles.factorList}>
            {classification.realm.complexityFactors.map((factor) => (
              <li key={factor.id}>
                <span>{factor.matched ? "已计入" : "未计入"}</span>
                <code>{factor.id}</code>
                <strong>+{factor.points}</strong>
              </li>
            ))}
          </ul>
          <TextList items={classification.realm.rationale} />
        </section>

        <section className={styles.resultPanel} aria-labelledby="severity-title">
          <div className={styles.panelTitleRow}>
            <span aria-hidden="true">伍</span>
            <div>
              <p>Impact assessment</p>
              <h3 id="severity-title">Severity</h3>
            </div>
          </div>
          <p className={styles.metricHeadline}>
            <strong>{severity.level}</strong>
            <span>{severity.score} / {severity.maxScore}</span>
          </p>
          <dl className={styles.metricBreakdown}>
            <div><dt>Impact</dt><dd>{severity.breakdown.impact} / 4</dd></div>
            <div><dt>Exploitability</dt><dd>{severity.breakdown.exploitability} / 4</dd></div>
            <div><dt>Repeatability</dt><dd>{severity.breakdown.repeatability} / 2</dd></div>
            <div><dt>Privilege Exposure</dt><dd>{severity.breakdown.privilegeExposure} / 2</dd></div>
          </dl>
          <TextList items={severity.rationale} />
        </section>

        <section className={styles.resultPanel} aria-labelledby="confidence-title">
          <div className={styles.panelTitleRow}>
            <span aria-hidden="true">陆</span>
            <div>
              <p>Evidence confidence</p>
              <h3 id="confidence-title">Confidence</h3>
            </div>
          </div>
          <p className={styles.metricHeadline}>
            <strong>{confidence.label}</strong>
            <span>{confidence.score} / 100</span>
          </p>
          <p className={styles.evidenceLevel}>{confidence.evidenceLevel}</p>
          <div className={styles.detailGrid}>
            <div>
              <h4>支持因素</h4>
              <TextList items={confidence.supportingFactors} />
            </div>
            <div>
              <h4>缺失证据</h4>
              <TextList items={confidence.missingEvidence} />
            </div>
          </div>
        </section>
      </div>

      <section className={styles.mossPanel} aria-labelledby="moss-title">
        <div>
          <p>Moss Evidence</p>
          <h3 id="moss-title">Not Applicable</h3>
          <p>
            该用户样例尚未注册为 Guardian Quest，因此当前没有可供 Moss 核验的链上 Quest 身份与 Content Hash。
          </p>
        </div>
        <ol className={styles.futureFlow} aria-label="未来审核注册流程">
          <li>人工审核通过</li>
          <li>生成 Canonical Hash</li>
          <li>Moss 模拟受限注册动作</li>
          <li>管理员确认</li>
          <li>Monad 记录</li>
        </ol>
      </section>

      <div className={styles.draftGrid}>
        <section className={styles.draftPanel} data-draft="bestiary" aria-labelledby="bestiary-title">
          <div className={styles.draftHeading}>
            <div>
              <p>Bestiary dossier</p>
              <h3 id="bestiary-title">异兽志草案</h3>
            </div>
            <span>草案 / Draft</span>
          </div>
          <dl className={styles.summaryFacts}>
            <div><dt>名称</dt><dd>{bestiary.name}</dd></div>
            <div><dt>正式类型</dt><dd>{bestiary.formalType}</dd></div>
            <div><dt>主属性</dt><dd>{bestiary.primaryElement}</dd></div>
            <div><dt>次属性</dt><dd>{bestiary.secondaryElements.join(" · ") || "无"}</dd></div>
            <div><dt>境界</dt><dd>{bestiary.realm}</dd></div>
            <div><dt>严重度</dt><dd>{bestiary.severity}</dd></div>
            <div><dt>置信度</dt><dd>{bestiary.confidence}</dd></div>
            <div><dt>审核状态</dt><dd>{bestiary.reviewStatus}</dd></div>
            <div className={styles.wideFact}><dt>影响</dt><dd>{bestiary.impact}</dd></div>
          </dl>
          <div className={styles.detailGrid}>
            <div><h4>攻击模式</h4><TextList items={bestiary.attackPattern} /></div>
            <div><h4>攻击前提</h4><TextList items={bestiary.prerequisites} /></div>
            <div><h4>证据摘要</h4><TextList items={bestiary.evidenceSummary} /></div>
            <div><h4>修复建议</h4><TextList items={bestiary.mitigations} /></div>
          </div>
          <div className={styles.limitationsBlock}>
            <h4>已知局限</h4>
            <TextList items={bestiary.knownLimitations} />
          </div>
        </section>

        <section className={styles.draftPanel} data-draft="quest" aria-labelledby="quest-draft-title">
          <div className={styles.draftHeading}>
            <div>
              <p>Quest blueprint</p>
              <h3 id="quest-draft-title">Quest 草案</h3>
            </div>
            <span>草案 / Draft</span>
          </div>
          <h4 className={styles.questDraftTitle}>{quest.title}</h4>
          <p>{quest.scenario}</p>
          <div className={styles.repairSequence} aria-label="修复顺序">
            {quest.repairSequence.map((step, index) => (
              <span key={step}>
                <strong>{step}</strong>
                {index < quest.repairSequence.length - 1 ? (
                  <i aria-hidden="true">→</i>
                ) : null}
              </span>
            ))}
          </div>
          <div className={styles.detailGrid}>
            <div><h4>学习目标</h4><TextList items={quest.learningObjectives} /></div>
            <div><h4>危险代码焦点</h4><TextList items={quest.dangerousCodeFocus} /></div>
            <div><h4>攻击回放</h4><TextList items={quest.attackReplaySteps} /></div>
            <div><h4>验证清单</h4><TextList items={quest.verificationChecklist} /></div>
          </div>
          <dl className={styles.summaryFacts}>
            <div className={styles.wideFact}><dt>分类挑战</dt><dd>{quest.classificationChallenge}</dd></div>
            <div className={styles.wideFact}><dt>证据引用</dt><dd>{quest.evidenceReferences.join(" · ")}</dd></div>
            <div className={styles.wideFact}><dt>奖励草案</dt><dd>{quest.rewardDraft}</dd></div>
            <div><dt>审核状态</dt><dd>{quest.reviewStatus}</dd></div>
          </dl>
          <div className={styles.limitationsBlock}>
            <h4>已知局限</h4>
            <TextList items={quest.knownLimitations} />
          </div>
        </section>
      </div>

      <section className={styles.reviewPanel} aria-labelledby="review-title">
        <div>
          <p>Human Review Gate</p>
          <h3 id="review-title">待审核草案</h3>
        </div>
        <dl>
          <div><dt>需要人工批准</dt><dd>是</dd></div>
          <div><dt>允许发布</dt><dd>否</dd></div>
          <div><dt>贡献状态</dt><dd>待审核</dd></div>
          <div><dt>贡献值</dt><dd>审核收录后结算</dd></div>
        </dl>
        <TextList items={result.review.reasons} />
        <p>
          Guardian Security Agent 只生成分析与内容草案。审核者将根据证据完整性、攻击可复现性、修复质量、教育价值和案例新颖性决定是否收录及贡献值。
        </p>
      </section>
    </section>
  );
}
